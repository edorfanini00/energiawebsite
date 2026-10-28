// GET /api/cleanup, called by the daily Vercel cron. Removes expired rate
// limit, used proof and session rows only; inquiries are never touched.
import { databaseUrl, hexSecret } from "./config.js";
import { database } from "./db.js";
import { equalSecret, sendJson } from "./http.js";
import { cleanup } from "./store.js";

export function createCleanupHandler(deps = {}) {
  return async (req, res) => {
    const env = deps.env ?? process.env;
    if (req.method !== "GET") return sendJson(res, 405, { status: "method_not_allowed" }, { Allow: "GET" });
    // Vercel sends CRON_SECRET as a bearer token. Validate before any DB work.
    if (!hexSecret(env.CRON_SECRET)) return sendJson(res, 503, { status: "unavailable" });
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || !/^Bearer [a-f0-9]{64,128}$/.test(auth) || !equalSecret(auth.slice(7), env.CRON_SECRET))
      return sendJson(res, 401, { status: "unauthorized" });
    const url = databaseUrl(env.DATABASE_URL, env.VERCEL === "1");
    if (!url) return sendJson(res, 503, { status: "unavailable" });
    try {
      const removed = await cleanup(deps.pool ?? database(url));
      return sendJson(res, 200, { status: "done", removed, inquiries: "kept" });
    } catch {
      return sendJson(res, 503, { status: "unavailable" });
    }
  };
}
