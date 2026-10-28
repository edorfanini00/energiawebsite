// A disposable local stack: loopback Postgres, migrations and the real API
// handlers behind a Node HTTP server. Synthetic secrets only.
import { createServer, request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { localPostgres } from "./local-postgres.mjs";
import { database } from "../../server/db.js";
import { up } from "../../scripts/migrate.mjs";
import { createChallengeHandler, createInquiryHandler } from "../../server/inquiry.js";
import { createAdminHandler, hashPassword } from "../../server/admin.js";
import { createCleanupHandler } from "../../server/cleanup.js";
import { sha256 } from "../../server/http.js";

export const ADMIN_PASSWORD = "synthetic-admin-password-for-tests";
export const NOTIFY_TOKEN = "synthetic_notify_token_" + "n".repeat(24);

export async function startStack() {
  const pg = await localPostgres();
  const pool = database(pg.url);
  await up(pool);
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = {
    DATABASE_URL: pg.url,
    INQUIRY_ORIGINS: origin,
    INQUIRY_HASH_SECRET: randomBytes(32).toString("hex"),
    ADMIN_PASSWORD_HASH: await hashPassword(ADMIN_PASSWORD),
    CRON_SECRET: randomBytes(32).toString("hex"),
    NOTIFY_TOKEN_SHA256: sha256(NOTIFY_TOKEN),
  };
  const routes = {
    "/api/inquiry": createInquiryHandler({ env }),
    "/api/challenge": createChallengeHandler({ env }),
    "/api/admin": createAdminHandler({ env }),
    "/api/cleanup": createCleanupHandler({ env }),
  };
  server.on("request", (req, res) => {
    const handler = routes[new URL(req.url, origin).pathname];
    if (handler) handler(req, res);
    else res.writeHead(404).end();
  });

  // Raw HTTP so Origin, Host and Sec-Fetch-Site are exactly what a test sets.
  function call(method, path, { headers = {}, body, raw } = {}) {
    return new Promise((resolve, reject) => {
      const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
      const req = httpRequest(origin + path, { method, headers: { ...(payload !== undefined ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}), ...headers } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      req.on("error", reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  }
  const same = { "Sec-Fetch-Site": "same-origin" };
  async function proof() {
    const r = await call("GET", "/api/challenge", { headers: same });
    if (r.status !== 200) throw new Error(`challenge ${r.status}`);
    const solution = await solveChallenge({ challenge: r.json, deriveKey });
    return Buffer.from(JSON.stringify({ challenge: r.json, solution })).toString("base64");
  }
  const submit = (payload, headers = {}) => call("POST", "/api/inquiry", { headers: { Origin: origin, ...same, ...headers }, body: payload });

  async function login(password = ADMIN_PASSWORD) {
    const r = await call("POST", "/api/admin", { headers: { Origin: origin, ...same }, body: { action: "login", password } });
    const cookie = (r.headers["set-cookie"] ?? [])[0]?.split(";")[0];
    return { ...r, cookie, csrf: r.json?.csrf };
  }
  const admin = (session, method, query = "", body) =>
    call(method, "/api/admin" + query, { headers: { Origin: origin, ...same, ...(session?.cookie ? { Cookie: session.cookie } : {}), ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}) }, body });

  return {
    env,
    origin,
    pool,
    call,
    proof,
    submit,
    login,
    admin,
    q: (sql, values) => pool.query(sql, values),
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await pool.end();
      await pg.close();
    },
  };
}
