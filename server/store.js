import { randomInt } from "node:crypto";
import { query, rate, transaction } from "./db.js";

// Crockford base32 without I, L, O, U: easy to read aloud over the phone.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERENCE = /^EA-[0-9A-HJKMNP-TV-Z]{8}$/;
export const newReference = () => "EA-" + Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// Answer field -> column. Empty optional answers are stored as NULL.
export const columns = {
  name: "name",
  email: "email",
  company: "company",
  buildingType: "building_type",
  floorArea: "floor_area",
  role: "role",
  buildingCount: "building_count",
  bms: "bms",
  bmsName: "bms_name",
  energySpend: "energy_spend",
  improve: "improve",
  phone: "phone",
};
export const utmColumns = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

export const CONTACT_LIMIT = 5; // accepted inquiries per email per day
export const GLOBAL_LIMIT = 300; // accepted inquiries per day, all visitors

// One idempotent submission. A key that already committed returns its
// original reference; the same key with different answers is a conflict.
// The proof is consumed in the same transaction as the insert, so a rolled
// back attempt leaves it usable for the retry.
export async function submit(pool, { key, payloadHash, proof, contact, answers, sourceUrl, utm }) {
  return transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`inquiry:${key}`]);
    const existing = await c.query("SELECT reference, payload_hash FROM inquiries WHERE idempotency_key = $1", [key]);
    if (existing.rowCount) {
      const row = existing.rows[0];
      return row.payload_hash === payloadHash ? { status: "accepted", reference: row.reference, fresh: false } : { status: "idempotency_conflict" };
    }
    const used = await c.query("INSERT INTO used_proofs(hash, expires_at) VALUES ($1, now() + interval '10 minutes') ON CONFLICT DO NOTHING RETURNING hash", [proof]);
    if (!used.rowCount) return { status: "verification_required" };
    // Check both daily budgets before spending either.
    const budgets = await c.query("SELECT key, count FROM rate_limits WHERE key = ANY($1::text[]) AND expires_at > now()", [[`contact:${contact}`, "global"]]);
    if (budgets.rows.some((r) => r.count >= (r.key === "global" ? GLOBAL_LIMIT : CONTACT_LIMIT))) return { status: "rate_limited" };
    await rate(c, `contact:${contact}`, CONTACT_LIMIT, 86400);
    await rate(c, "global", GLOBAL_LIMIT, 86400);
    const names = ["reference", "idempotency_key", "payload_hash", ...Object.values(columns), "source_url", ...utmColumns];
    const base = [key, payloadHash, ...Object.keys(columns).map((f) => answers[f] || null), sourceUrl, ...utmColumns.map((u) => utm[u] || null)];
    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = newReference();
      const inserted = await c.query(
        `INSERT INTO inquiries(${names.join(", ")}) VALUES (${names.map((_, i) => `$${i + 1}`).join(", ")})
         ON CONFLICT (reference) DO NOTHING RETURNING reference`,
        [reference, ...base],
      );
      if (inserted.rowCount) {
        await c.query("INSERT INTO inquiry_events(reference, action) VALUES ($1, 'received')", [reference]);
        return { status: "accepted", reference, fresh: true };
      }
    }
    throw new Error("reference space exhausted");
  });
}

const LIST_COLUMNS = `id, reference, created_at, status, contacted_at, ${Object.values(columns).join(", ")}, source_url, ${utmColumns.join(", ")}`;
export const PAGE_SIZE = 50;

export async function list(pool, page) {
  const r = await query(pool, `SELECT ${LIST_COLUMNS} FROM inquiries ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, [PAGE_SIZE + 1, page * PAGE_SIZE]);
  return { inquiries: r.rows.slice(0, PAGE_SIZE), page, hasMore: r.rows.length > PAGE_SIZE };
}

export async function detail(pool, reference) {
  return transaction(pool, async (c) => {
    const r = await c.query(`SELECT ${LIST_COLUMNS} FROM inquiries WHERE reference = $1`, [reference]);
    if (!r.rowCount) return null;
    const events = await c.query("SELECT action, created_at FROM inquiry_events WHERE reference = $1 ORDER BY id", [reference]);
    return { inquiry: r.rows[0], events: events.rows };
  });
}

export const EXPORT_LIMIT = 10000;
export async function exportAll(pool) {
  const r = await query(pool, `SELECT ${LIST_COLUMNS} FROM inquiries ORDER BY created_at DESC, id DESC LIMIT $1`, [EXPORT_LIMIT]);
  return r.rows;
}

// New inquiries after a cursor, oldest first, for the local notifier.
export async function since(pool, after) {
  const r = await query(
    pool,
    "SELECT id, reference, created_at, company, name, role, building_type, floor_area, building_count FROM inquiries WHERE id > $1 ORDER BY id LIMIT 100",
    [after],
  );
  return r.rows;
}

// Owner actions. Each revalidates the session under a row lock, so a logout
// committed first always wins over a mutation in flight.
async function withSession(pool, tokenHash, fn) {
  return transaction(pool, async (c) => {
    const active = await c.query("SELECT token_hash FROM admin_sessions WHERE token_hash = $1 AND expires_at > now() FOR UPDATE", [tokenHash]);
    if (!active.rowCount) return "unauthorized";
    return fn(c);
  });
}

export function setStatus(pool, tokenHash, reference, status) {
  return withSession(pool, tokenHash, async (c) => {
    const r = await c.query(
      `UPDATE inquiries SET status = $2, contacted_at = CASE WHEN $2 = 'contacted' THEN now() ELSE NULL END
       WHERE reference = $1 AND status <> $2 RETURNING reference`,
      [reference, status],
    );
    if (!r.rowCount) {
      const exists = await c.query("SELECT 1 FROM inquiries WHERE reference = $1", [reference]);
      return exists.rowCount ? "unchanged" : "not_found";
    }
    await c.query("INSERT INTO inquiry_events(reference, action) VALUES ($1, $2)", [reference, status === "contacted" ? "contacted" : "reopened"]);
    return "ok";
  });
}

// The only path that removes an inquiry: the owner erasing one record.
export function erase(pool, tokenHash, reference) {
  return withSession(pool, tokenHash, async (c) => {
    const r = await c.query("DELETE FROM inquiries WHERE reference = $1 RETURNING reference", [reference]);
    if (!r.rowCount) return "not_found";
    await c.query("INSERT INTO inquiry_events(reference, action) VALUES ($1, 'erased')", [reference]);
    return "ok";
  });
}

// Expired security rows only. Inquiries are kept until the owner erases them;
// nothing here (or anywhere else on a schedule) touches the inquiries table.
export const expiringTables = { rate_limits: "key", used_proofs: "hash", admin_sessions: "token_hash" };
export async function cleanup(pool) {
  return transaction(pool, async (c) => {
    await c.query("SET LOCAL lock_timeout = '1000ms'");
    const removed = {};
    for (const [table, key] of Object.entries(expiringTables)) {
      const r = await c.query(
        `DELETE FROM ${table} WHERE ${key} IN (SELECT ${key} FROM ${table} WHERE expires_at <= now() ORDER BY expires_at LIMIT 5000 FOR UPDATE SKIP LOCKED)`,
      );
      removed[table] = r.rowCount ?? 0;
    }
    return removed;
  });
}
