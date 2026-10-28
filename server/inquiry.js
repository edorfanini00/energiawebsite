// POST /api/inquiry and POST /api/challenge.
import { intakeConfig } from "./config.js";
import { database, rateLimit } from "./db.js";
import { issueChallenge, verifyProof } from "./challenge.js";
import { fieldNames, readSourcePath, readUtm, validate } from "./fields.js";
import { isJson, keyedHash, readBody, requestOrigin, sendJson, trustedIp } from "./http.js";
import { newReference, submit } from "./store.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ALLOWED_KEYS = new Set([...fieldNames, "website", "altcha", "idempotencyKey", "sourcePath", "utm"]);
export const IP_LIMIT = 10; // submissions per address per 10 minutes
export const CHALLENGE_LIMIT = 30; // challenges per address per 10 minutes

// Status lines carry no answers, addresses or references.
const log = (status) => console.log(JSON.stringify({ event: "inquiry", status }));

export function createChallengeHandler(deps = {}) {
  return async (req, res) => {
    const env = deps.env ?? process.env;
    if (req.method !== "POST") return sendJson(res, 405, { status: "method_not_allowed" }, { Allow: "POST" });
    const config = intakeConfig(env);
    if (!config) return sendJson(res, 503, { status: "unavailable" });
    const origin = requestOrigin(req, config.origins);
    if (!origin) return sendJson(res, 403, { status: "origin_rejected" });
    if (!isJson(req)) return sendJson(res, 415, { status: "json_required" });
    const ip = trustedIp(req, env);
    if (!ip) return sendJson(res, 503, { status: "unavailable" });
    try {
      const pool = deps.pool ?? database(config.databaseUrl);
      if (!(await rateLimit(pool, `challenge-ip:${keyedHash(config.hashSecret, "ip", ip)}`, CHALLENGE_LIMIT, 600)))
        return sendJson(res, 429, { status: "rate_limited" });
      // The body carries nothing; the browser sends an empty JSON object.
      const body = await readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) return sendJson(res, 422, { status: "invalid_request" });
      return sendJson(res, 200, await issueChallenge(config.hashSecret, origin, deps.now?.() ?? Date.now()));
    } catch (error) {
      if (error === 400 || error === 413) return sendJson(res, error, { status: error === 400 ? "invalid_json" : "too_large" });
      return sendJson(res, 503, { status: "unavailable" });
    }
  };
}

export function createInquiryHandler(deps = {}) {
  return async (req, res) => {
    const env = deps.env ?? process.env;
    const config = intakeConfig(env);
    if (req.method === "GET") return sendJson(res, config ? 200 : 503, { status: config ? "ready" : "unavailable" });
    if (req.method !== "POST") return sendJson(res, 405, { status: "method_not_allowed" }, { Allow: "GET, POST" });
    if (!config) return sendJson(res, 503, { status: "unavailable" });
    const origin = requestOrigin(req, config.origins);
    if (!origin) return sendJson(res, 403, { status: "origin_rejected" });
    if (!isJson(req)) return sendJson(res, 415, { status: "json_required" });
    const ip = trustedIp(req, env);
    if (!ip) return sendJson(res, 503, { status: "unavailable" });
    const hash = (kind, value) => keyedHash(config.hashSecret, kind, value);
    try {
      const pool = deps.pool ?? database(config.databaseUrl);
      if (!(await rateLimit(pool, `ip:${hash("ip", ip)}`, IP_LIMIT, 600))) return sendJson(res, 429, { status: "rate_limited" });
      const body = await readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((k) => !ALLOWED_KEYS.has(k)))
        return sendJson(res, 422, { status: "invalid_request" });
      // Honeypot: a person never sees or fills "website". Answer like a
      // success so automated senders learn nothing, and store nothing.
      if (body.website !== undefined && body.website !== "") {
        log("honeypot");
        return sendJson(res, 200, { status: "accepted", reference: newReference(), fresh: true });
      }
      if (typeof body.idempotencyKey !== "string" || !UUID.test(body.idempotencyKey) || (body.utm !== undefined && typeof body.utm !== "string"))
        return sendJson(res, 422, { status: "invalid_request" });
      const { data, errors } = validate(body);
      if (Object.keys(errors).length) return sendJson(res, 422, { status: "invalid_fields", fields: errors });
      const proofId = await verifyProof(body.altcha, config.hashSecret, origin, deps.now?.() ?? Date.now());
      if (!proofId) return sendJson(res, 422, { status: "verification_required" });
      const utm = readUtm(body.utm ?? "");
      const sourceUrl = origin + readSourcePath(body.sourcePath);
      const decision = await submit(pool, {
        key: body.idempotencyKey,
        // Same answers and source under the same key are the same inquiry.
        payloadHash: hash("payload", JSON.stringify([data, utm, sourceUrl])),
        proof: hash("proof", proofId),
        contact: hash("contact", data.email.toLowerCase()),
        answers: data,
        sourceUrl,
        utm,
      });
      log(decision.status === "accepted" ? (decision.fresh ? "accepted" : "replayed") : decision.status);
      if (decision.status === "accepted") return sendJson(res, 200, { status: "accepted", reference: decision.reference, fresh: decision.fresh });
      if (decision.status === "rate_limited") return sendJson(res, 429, { status: "rate_limited" });
      if (decision.status === "idempotency_conflict") return sendJson(res, 409, { status: "idempotency_conflict" });
      return sendJson(res, 422, { status: "verification_required" });
    } catch (error) {
      if (error === 400 || error === 413) return sendJson(res, error, { status: error === 400 ? "invalid_json" : "too_large" });
      log("unavailable");
      return sendJson(res, 503, { status: "unavailable" });
    }
  };
}
