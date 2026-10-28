import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const MAX_BODY = 8000;

export function sendJson(res, code, body, headers = {}) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// On Vercel only the platform's overwritten header is trusted; a client's
// own X-Forwarded-For never decides a rate limit key.
export function trustedIp(req, env = process.env) {
  const ip = env.VERCEL === "1" ? req.headers["x-vercel-forwarded-for"] : req.socket?.remoteAddress;
  return typeof ip === "string" && isIP(ip.trim()) ? ip.trim() : null;
}

export const isJson = (req) => /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(String(req.headers["content-type"] ?? ""));

// Vercel usually supplies a parsed req.body; a raw local request is read
// with the same size bound. Throws 400 or 413.
export async function readBody(req) {
  const length = req.headers["content-length"];
  if (length && (!/^\d+$/.test(String(length)) || Number(length) > MAX_BODY)) throw 413;
  let preparsed;
  try {
    preparsed = req.body;
  } catch {
    throw 400; // Vercel's lazy parser throws on malformed JSON
  }
  if (preparsed !== undefined) {
    const raw = typeof preparsed === "string" ? preparsed : Buffer.isBuffer(preparsed) ? preparsed.toString("utf8") : JSON.stringify(preparsed);
    if (Buffer.byteLength(raw) > MAX_BODY) throw 413;
    try {
      return JSON.parse(raw);
    } catch {
      throw 400;
    }
  }
  const chunks = [];
  let bytes = 0;
  const timer = setTimeout(() => req.destroy(), 5000);
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_BODY) throw 413;
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    clearTimeout(timer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw 400;
  }
}

// The origin a request comes from, only if it is one of the exact allowed
// origins. Same origin GETs carry no Origin header, so the Host is used then,
// but only together with Sec-Fetch-Site: same-origin.
export function requestOrigin(req, origins, { requireHeader = false, env = process.env } = {}) {
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin") return null;
  const header = req.headers.origin;
  if (header !== undefined) return origins.includes(header) ? header : null;
  if (requireHeader || site !== "same-origin") return null;
  const host = String(req.headers.host ?? "").toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return null;
  const derived = `${env.VERCEL === "1" ? "https" : "http"}://${host}`;
  return origins.includes(derived) ? derived : null;
}

export const keyedHash = (secret, kind, value) => createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Constant time comparison of two strings of any length.
export function equalSecret(a, b) {
  return timingSafeEqual(Buffer.from(sha256(String(a)), "hex"), Buffer.from(sha256(String(b)), "hex"));
}
