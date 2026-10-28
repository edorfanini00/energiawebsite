// /api/admin: the owner's private dashboard API.
// Login compares a scrypt hash of the password (the password itself lives
// only in the owner's Keychain); sessions are random tokens stored hashed,
// in a Secure HttpOnly SameSite=Strict cookie, with a CSRF token for writes.
// A separate read only notify token may list new inquiries and nothing else.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { hexSecret, intakeConfig } from "./config.js";
import { database, query, rateLimit } from "./db.js";
import { equalSecret, isJson, keyedHash, readBody, sendJson, sha256, trustedIp } from "./http.js";
import { REFERENCE, detail, erase, exportAll, list, setStatus, since } from "./store.js";
import { toCsv } from "./csv.js";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "__Host-energia_admin";
export const SESSION_SECONDS = 8 * 3600;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PASSWORD_HASH = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/;

export async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const key = await scryptAsync(password, Buffer.from(salt, "hex"), 32, SCRYPT);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function passwordMatches(password, stored) {
  const m = PASSWORD_HASH.exec(stored ?? "");
  if (!m || typeof password !== "string" || password.length > 256) return false;
  const key = await scryptAsync(password, Buffer.from(m[1], "hex"), 32, SCRYPT);
  return timingSafeEqual(key, Buffer.from(m[2], "hex"));
}

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function sessionToken(req) {
  const tokens = String(req.headers.cookie ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`${SESSION_COOKIE}=`))
    .map((s) => s.slice(SESSION_COOKIE.length + 1));
  return tokens.length === 1 && /^[a-f0-9]{64}$/.test(tokens[0]) ? tokens[0] : null;
}

export function createAdminHandler(deps = {}) {
  return async (req, res) => {
    const env = deps.env ?? process.env;
    const reply = (code, body, headers = {}) => sendJson(res, code, body, { ...SECURITY_HEADERS, ...headers });
    const config = intakeConfig(env);
    if (!config || !PASSWORD_HASH.test(env.ADMIN_PASSWORD_HASH ?? "")) return reply(503, { error: "unavailable" });
    if (!["GET", "POST"].includes(req.method)) return reply(405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
    const url = new URL(req.url ?? "/api/admin", "http://localhost");
    const action = req.method === "GET" ? (url.searchParams.get("action") ?? "list") : null;
    const ip = trustedIp(req, env);
    if (!ip) return reply(503, { error: "unavailable" });
    const pool = deps.pool ?? database(config.databaseUrl);
    const hash = (kind, value) => keyedHash(config.hashSecret, kind, value);
    try {
      // Read only notifier: a bearer token whose SHA-256 is configured.
      if (action === "notify") {
        const auth = req.headers.authorization;
        if (!hexSecret(env.NOTIFY_TOKEN_SHA256) || typeof auth !== "string" || !/^Bearer [A-Za-z0-9_-]{32,128}$/.test(auth) || !equalSecret(sha256(auth.slice(7)), env.NOTIFY_TOKEN_SHA256))
          return reply(401, { error: "unauthorized" });
        if (!(await rateLimit(pool, `notify:${hash("ip", ip)}`, 60, 600))) return reply(429, { error: "rate_limited" });
        const after = Number(url.searchParams.get("after") ?? 0);
        if (!Number.isSafeInteger(after) || after < 0) return reply(400, { error: "invalid_cursor" });
        const rows = await since(pool, after);
        return reply(200, { inquiries: rows, cursor: rows.length ? Number(rows[rows.length - 1].id) : after });
      }
      // Browser requests: same site only; writes must also name the origin.
      const site = req.headers["sec-fetch-site"];
      const sameSite = site === undefined || site === "same-origin" || (req.method === "GET" && site === "none");
      const origin = req.headers.origin;
      if (!sameSite || (origin !== undefined && !config.origins.includes(origin)) || (req.method === "POST" && origin === undefined))
        return reply(403, { error: "origin_rejected" });
      let body = {};
      if (req.method === "POST") {
        if (!isJson(req)) return reply(415, { error: "json_required" });
        const value = await readBody(req);
        if (!value || typeof value !== "object" || Array.isArray(value)) return reply(400, { error: "invalid_request" });
        body = value;
      }
      const version = hash("admin-version", env.ADMIN_PASSWORD_HASH);
      if (body.action === "login") {
        if (!(await rateLimit(pool, `admin-login:${hash("ip", ip)}`, 5, 900)) || !(await rateLimit(pool, "admin-login-global", 50, 900)))
          return reply(429, { error: "rate_limited" });
        if (!(await passwordMatches(body.password, env.ADMIN_PASSWORD_HASH))) return reply(401, { error: "unauthorized" });
        const token = randomBytes(32).toString("hex");
        const csrf = randomBytes(32).toString("hex");
        await query(pool, `INSERT INTO admin_sessions(token_hash, csrf, credential_version, expires_at) VALUES ($1, $2, $3, now() + $4 * interval '1 second')`, [
          sha256(token),
          csrf,
          version,
          SESSION_SECONDS,
        ]);
        return reply(200, { csrf }, { "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` });
      }
      const token = sessionToken(req);
      if (!token) return reply(401, { error: "unauthorized" });
      const tokenHash = sha256(token);
      const sessions = await query(pool, "SELECT csrf FROM admin_sessions WHERE token_hash = $1 AND credential_version = $2 AND expires_at > now()", [tokenHash, version]);
      if (!sessions.rowCount) return reply(401, { error: "unauthorized" });
      const csrf = sessions.rows[0].csrf;
      if (!(await rateLimit(pool, `admin-session:${tokenHash}`, 240, 60))) return reply(429, { error: "rate_limited" });

      if (req.method === "POST") {
        if (typeof req.headers["x-csrf-token"] !== "string" || !equalSecret(req.headers["x-csrf-token"], csrf)) return reply(403, { error: "csrf_rejected" });
        if (body.action === "logout") {
          await query(pool, "DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
          return reply(200, { ok: true }, { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
        }
        if (typeof body.reference !== "string" || !REFERENCE.test(body.reference)) return reply(400, { error: "invalid_reference" });
        let outcome;
        if (body.action === "status" && ["new", "contacted"].includes(body.status)) outcome = await setStatus(pool, tokenHash, body.reference, body.status);
        else if (body.action === "erase" && body.confirm === body.reference) outcome = await erase(pool, tokenHash, body.reference);
        else return reply(400, { error: "confirmation_required" });
        if (outcome === "unauthorized") return reply(401, { error: "unauthorized" });
        if (outcome === "not_found") return reply(404, { error: "not_found" });
        return reply(200, { ok: true });
      }

      if (action === "session") return reply(200, { csrf });
      if (action === "detail") {
        const reference = url.searchParams.get("reference") ?? "";
        if (!REFERENCE.test(reference)) return reply(400, { error: "invalid_reference" });
        const found = await detail(pool, reference);
        return found ? reply(200, found) : reply(404, { error: "not_found" });
      }
      if (action === "export") {
        const rows = await exportAll(pool);
        const stamp = new Date().toISOString().slice(0, 10);
        res.statusCode = 200;
        for (const [k, v] of Object.entries({
          ...SECURITY_HEADERS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="energia-inquiries-${stamp}.csv"`,
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff",
        }))
          res.setHeader(k, v);
        return res.end(toCsv(rows));
      }
      if (action === "list") {
        const page = Number(url.searchParams.get("page") ?? 0);
        if (!Number.isInteger(page) || page < 0 || page > 10000) return reply(400, { error: "invalid_page" });
        return reply(200, await list(pool, page));
      }
      return reply(400, { error: "invalid_action" });
    } catch (error) {
      if (error === 400 || error === 413) return reply(error, { error: error === 400 ? "invalid_json" : "too_large" });
      return reply(503, { error: "unavailable" });
    }
  };
}
