// API and Postgres integration on a disposable loopback cluster: intake
// validation, ALTCHA, idempotency, rate limits, honeypot, admin auth,
// status, export, erase, logout, the notify token and cleanup.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ADMIN_PASSWORD, NOTIFY_TOKEN, startStack } from "../support/stack.mjs";
import { hashPassword } from "../../server/admin.js";
import { messages } from "../../server/fields.js";
import { CONTACT_LIMIT, GLOBAL_LIMIT } from "../../server/store.js";
import { IP_LIMIT } from "../../server/inquiry.js";
import { query, transaction } from "../../server/db.js";

let s;
before(async () => {
  s = await startStack();
});
after(async () => {
  await s?.close();
});
// Every test starts with fresh rate limits; inquiries persist unless a test clears them.
beforeEach(async () => {
  await s.q("TRUNCATE rate_limits, used_proofs");
});

const answers = (over = {}) => ({
  name: "Synthetic Tester",
  email: `synthetic+${randomUUID().slice(0, 8)}@example.com`,
  company: "Synthetic Test Buildings LLC",
  buildingType: "Office",
  floorArea: "200,000 to 500,000 sq ft",
  role: "Facilities or engineering",
  buildingCount: "2 to 5",
  bms: "Yes",
  bmsName: "Synthetic BMS",
  energySpend: "Prefer not to say",
  improve: "Synthetic test.\nSecond line.",
  phone: "+1 555 0100",
  ...over,
});
const payload = async (over = {}, key = randomUUID()) => ({ ...answers(over), idempotencyKey: key, sourcePath: "/", utm: "?utm_source=test&utm_campaign=synthetic&_vercel_share=SECRET", website: "", altcha: await s.proof() });
const count = async () => Number((await s.q("SELECT count(*) FROM inquiries")).rows[0].count);

describe("intake", () => {
  test("readiness says ready without details", async () => {
    const r = await s.call("GET", "/api/inquiry");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { status: "ready" });
  });

  test("a valid inquiry is stored exactly, with source, UTM and a reference", async () => {
    const body = await payload();
    const r = await s.submit(body);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, "accepted");
    assert.equal(r.json.fresh, true);
    assert.match(r.json.reference, /^EA-[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal(r.headers["cache-control"], "no-store");
    const row = (await s.q("SELECT * FROM inquiries WHERE reference = $1", [r.json.reference])).rows[0];
    assert.deepEqual(
      [row.name, row.email, row.company, row.building_type, row.floor_area, row.role, row.building_count, row.bms, row.bms_name, row.energy_spend, row.improve, row.phone],
      [body.name, body.email, body.company, body.buildingType, body.floorArea, body.role, body.buildingCount, body.bms, body.bmsName, body.energySpend, body.improve, body.phone],
    );
    assert.equal(row.idempotency_key, body.idempotencyKey);
    assert.equal(row.source_url, s.origin + "/");
    assert.equal(row.utm_source, "test");
    assert.equal(row.utm_campaign, "synthetic");
    assert.equal(row.status, "new");
    assert.ok(row.created_at instanceof Date);
    assert.ok(!JSON.stringify(row).includes("SECRET"), "share token never stored");
    const events = (await s.q("SELECT action FROM inquiry_events WHERE reference = $1", [r.json.reference])).rows;
    assert.deepEqual(events, [{ action: "received" }]);
  });

  test("optional answers may be left out and are stored as NULL", async () => {
    const body = { ...(await payload()), role: "", buildingCount: "", bms: "", bmsName: "", energySpend: "", improve: "", phone: "" };
    const r = await s.submit(body);
    assert.equal(r.status, 200, r.text);
    const row = (await s.q("SELECT role, bms, improve, phone FROM inquiries WHERE reference = $1", [r.json.reference])).rows[0];
    assert.deepEqual(row, { role: null, bms: null, improve: null, phone: null });
  });

  test("validation: missing, wrong choices, too long and unknown keys", async () => {
    const before = await count();
    let r = await s.submit({ ...(await payload()), name: "", buildingType: "Castle", improve: "x".repeat(1001), email: "nope" });
    assert.equal(r.status, 422);
    assert.deepEqual(r.json, { status: "invalid_fields", fields: { name: messages.required.name, email: messages.email, buildingType: messages.choice, improve: messages.tooLong(1000) } });
    r = await s.submit({ ...(await payload()), extra: "x" });
    assert.deepEqual([r.status, r.json.status], [422, "invalid_request"]);
    r = await s.submit({ ...(await payload()), idempotencyKey: "not-a-uuid" });
    assert.deepEqual([r.status, r.json.status], [422, "invalid_request"]);
    r = await s.submit([1, 2]);
    assert.equal(r.status, 422);
    assert.equal(await count(), before);
  });

  test("transport checks: origin, fetch site, content type, size, JSON", async () => {
    const body = await payload();
    assert.equal((await s.submit(body, { Origin: "https://evil.example" })).status, 403);
    assert.equal((await s.call("POST", "/api/inquiry", { headers: { "Sec-Fetch-Site": "same-origin" }, body })).status, 403);
    assert.equal((await s.submit(body, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await s.call("POST", "/api/inquiry", { headers: { Origin: s.origin, "Content-Type": "text/plain" }, raw: JSON.stringify(body) })).status, 415);
    assert.equal((await s.call("POST", "/api/inquiry", { headers: { Origin: s.origin }, raw: JSON.stringify({ ...body, improve: "x".repeat(9000) }) })).status, 413);
    assert.equal((await s.call("POST", "/api/inquiry", { headers: { Origin: s.origin }, raw: "{not json" })).status, 400);
    assert.equal((await s.call("PUT", "/api/inquiry")).status, 405);
  });

  test("challenge: a POST from an allowed Origin only, and rate limited", async () => {
    const post = (headers, opts = { body: {} }) => s.call("POST", "/api/challenge", { headers, ...opts });
    const get = await s.call("GET", "/api/challenge", { headers: { Origin: s.origin, "Sec-Fetch-Site": "same-origin" } });
    assert.deepEqual([get.status, get.headers.allow], [405, "POST"]);
    assert.equal((await post({ "Sec-Fetch-Site": "same-origin" })).status, 403, "no Origin header");
    assert.equal((await post({ Origin: "https://evil.example" })).status, 403);
    assert.equal((await post({ Origin: "null" })).status, 403);
    assert.equal((await post({ Origin: s.origin, "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await post({ Origin: s.origin, "Sec-Fetch-Site": "same-site" })).status, 403);
    assert.equal((await post({ Origin: s.origin, "Content-Type": "text/plain" }, { raw: "{}" })).status, 415);
    assert.equal((await post({ Origin: s.origin }, { body: { extra: 1 } })).status, 422);
    assert.equal((await post({ Origin: s.origin }, { raw: "{nope" })).status, 400);
    const ok = await post({ Origin: s.origin, "Sec-Fetch-Site": "same-origin" });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.parameters.data.origin, s.origin);
    // Safari before 16.4: Origin on the POST, no Fetch Metadata at all.
    const safari = await post({ Origin: s.origin });
    assert.equal(safari.status, 200);
    assert.equal(safari.json.parameters.data.origin, s.origin);
    let last;
    for (let i = 0; i < 30; i++) last = await post({ Origin: s.origin, "Sec-Fetch-Site": "same-origin" });
    assert.equal(last.status, 429);
  });

  test("release gate: scripts/check-origins.mjs passes an allowed host and fails one that is not", async () => {
    const run = async (...origins) => {
      try {
        const { stdout } = await promisify(execFile)(process.execPath, ["scripts/check-origins.mjs", ...origins]);
        return { code: 0, out: JSON.parse(stdout) };
      } catch (e) {
        return { code: e.code, out: JSON.parse(e.stdout) };
      }
    };
    const ok = await run(s.origin);
    assert.equal(ok.code, 0);
    assert.deepEqual(ok.out.results, [{ origin: s.origin, sameOrigin: 200, noFetchMetadata: 200, crossOrigin: 403, ok: true }]);
    // Same server, a host name that is not on the allowlist: the gate fails.
    const other = s.origin.replace("127.0.0.1", "localhost");
    const bad = await run(s.origin, other);
    assert.equal(bad.code, 1);
    assert.equal(bad.out.passed, false);
    assert.deepEqual(bad.out.results.map((r) => [r.sameOrigin, r.crossOrigin, r.ok]), [[200, 403, true], [403, 403, false]]);
  });

  test("intake without Fetch Metadata (older Safari) is accepted from the allowed Origin", async () => {
    const r = await s.call("POST", "/api/inquiry", { headers: { Origin: s.origin }, body: await payload() });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, "accepted");
  });
});

describe("ALTCHA", () => {
  test("missing, garbage or reused proofs are refused", async () => {
    const before = await count();
    const body = await payload();
    assert.deepEqual((await s.submit({ ...body, altcha: undefined })).json, { status: "verification_required" });
    assert.deepEqual((await s.submit({ ...body, altcha: "AAAA" })).json, { status: "verification_required" });
    const first = await s.submit(body);
    assert.equal(first.status, 200);
    // The same proof cannot vouch for a different inquiry.
    const reuse = await s.submit({ ...(await payload()), altcha: body.altcha });
    assert.deepEqual([reuse.status, reuse.json.status], [422, "verification_required"]);
    assert.equal(await count(), before + 1);
  });

  test("a proof issued for another origin is refused", async () => {
    const other = await startStack();
    try {
      const foreign = await other.proof();
      const r = await s.submit({ ...(await payload()), altcha: foreign });
      assert.deepEqual([r.status, r.json.status], [422, "verification_required"]);
    } finally {
      await other.close();
    }
  });
});

describe("idempotency", () => {
  test("a retry after a lost response returns the same reference and stores nothing new", async () => {
    const body = await payload();
    const first = await s.submit(body);
    const before = await count();
    // Exact replay, same proof (as the browser does after a timeout).
    const again = await s.submit(body);
    assert.equal(again.status, 200);
    assert.deepEqual(again.json, { status: "accepted", reference: first.json.reference, fresh: false });
    // Replay with a fresh proof, as after a proof expiry.
    const third = await s.submit({ ...body, altcha: await s.proof() });
    assert.deepEqual(third.json, { status: "accepted", reference: first.json.reference, fresh: false });
    assert.equal(await count(), before);
    assert.equal(Number((await s.q("SELECT count(*) FROM inquiry_events WHERE reference = $1", [first.json.reference])).rows[0].count), 1);
  });

  test("concurrent duplicates commit exactly once", async () => {
    const key = randomUUID();
    const a = await payload({}, key);
    const b = { ...a, altcha: await s.proof() };
    const before = await count();
    const results = await Promise.all([s.submit(a), s.submit(b)]);
    assert.deepEqual(results.map((r) => r.status), [200, 200]);
    assert.equal(results[0].json.reference, results[1].json.reference);
    assert.deepEqual(results.map((r) => r.json.fresh).sort(), [false, true]);
    assert.equal(await count(), before + 1);
  });

  test("the same key with different answers is a conflict, not an overwrite", async () => {
    const body = await payload();
    const first = await s.submit(body);
    const r = await s.submit({ ...body, company: "Different Synthetic Co", altcha: await s.proof() });
    assert.deepEqual([r.status, r.json.status], [409, "idempotency_conflict"]);
    const row = (await s.q("SELECT company FROM inquiries WHERE reference = $1", [first.json.reference])).rows[0];
    assert.equal(row.company, body.company);
  });
});

describe("honeypot and rate limits", () => {
  test("a filled honeypot looks accepted but stores nothing", async () => {
    const before = await count();
    const r = await s.submit({ ...(await payload()), website: "https://spam.example" });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "accepted");
    assert.equal(await count(), before);
  });

  test("per address: the eleventh submission in ten minutes is refused", async () => {
    // Proofs are fetched first; challenges have their own budget.
    const bodies = [];
    for (let i = 0; i <= IP_LIMIT; i++) bodies.push(await payload());
    const results = [];
    for (const body of bodies) results.push((await s.submit(body)).status);
    assert.deepEqual(results.slice(0, IP_LIMIT), Array(IP_LIMIT).fill(200));
    assert.equal(results[IP_LIMIT], 429);
  });

  test("per email: at most five accepted inquiries a day", async () => {
    const email = `same+${randomUUID().slice(0, 6)}@example.com`;
    const statuses = [];
    for (let i = 0; i <= CONTACT_LIMIT; i++) statuses.push((await s.submit(await payload({ email }))).status);
    assert.deepEqual(statuses, [...Array(CONTACT_LIMIT).fill(200), 429]);
  });

  test("per email: eight concurrent submissions store exactly five", async () => {
    const email = `race+${randomUUID().slice(0, 6)}@example.com`;
    const bodies = [];
    for (let i = 0; i < 8; i++) bodies.push(await payload({ email })); // fresh proof and key each
    const statuses = (await Promise.all(bodies.map((b) => s.submit(b)))).map((r) => r.status);
    assert.equal(statuses.filter((c) => c === 200).length, CONTACT_LIMIT, JSON.stringify(statuses));
    assert.equal(statuses.filter((c) => c === 429).length, 8 - CONTACT_LIMIT, JSON.stringify(statuses));
    assert.equal(Number((await s.q("SELECT count(*) FROM inquiries WHERE email = $1", [email])).rows[0].count), CONTACT_LIMIT);
    // A refused attempt rolls back: its proof stays unspent for a retry.
    assert.equal(Number((await s.q("SELECT count(*) FROM used_proofs")).rows[0].count), CONTACT_LIMIT);
    assert.equal((await s.q("SELECT count FROM rate_limits WHERE key = 'global'")).rows[0].count, CONTACT_LIMIT);
  });

  test("global: concurrent submissions never pass the daily total", async () => {
    await s.q("INSERT INTO rate_limits(key, count, expires_at) VALUES ('global', $1, now() + interval '1 day')", [GLOBAL_LIMIT - 2]);
    const bodies = [];
    for (let i = 0; i < 6; i++) bodies.push(await payload()); // six different emails
    const before = await count();
    const statuses = (await Promise.all(bodies.map((b) => s.submit(b)))).map((r) => r.status);
    assert.deepEqual([...statuses].sort(), [200, 200, 429, 429, 429, 429], JSON.stringify(statuses));
    assert.equal(await count(), before + 2);
    assert.equal((await s.q("SELECT count FROM rate_limits WHERE key = 'global'")).rows[0].count, GLOBAL_LIMIT);
    // A refused attempt spends no per email budget either.
    assert.equal(Number((await s.q("SELECT count(*) FROM rate_limits WHERE key LIKE 'contact:%'")).rows[0].count), 2);
  });
});

describe("dashboard API", () => {
  test("every read and write needs a session: 401 without one", async () => {
    for (const q of ["", "?action=list", "?action=session", "?action=export", "?action=detail&reference=EA-ABCDEFGH", "?action=notify"]) {
      const r = await s.admin(null, "GET", q);
      assert.equal(r.status, 401, q);
      assert.ok(!r.text.includes("@example.com"));
    }
    for (const action of ["status", "erase", "logout"]) assert.equal((await s.admin(null, "POST", "", { action, reference: "EA-ABCDEFGH" })).status, 401, action);
    assert.equal((await s.admin({ cookie: "__Host-energia_admin=" + "0".repeat(64) }, "GET", "?action=list")).status, 401);
  });

  test("login: wrong password 401, rate limited, then a hardened session cookie", async () => {
    assert.equal((await s.login("wrong password")).status, 401);
    const ok = await s.login();
    assert.equal(ok.status, 200);
    const cookie = ok.headers["set-cookie"][0];
    assert.match(cookie, /^__Host-energia_admin=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
    assert.match(ok.csrf, /^[a-f0-9]{64}$/);
    // The session row holds only a hash of the token.
    const token = ok.cookie.split("=")[1];
    assert.equal((await s.q("SELECT count(*) FROM admin_sessions WHERE token_hash = $1", [token])).rows[0].count, "0");
    for (let i = 0; i < 4; i++) await s.login("wrong password");
    assert.equal((await s.login()).status, 429, "sixth attempt in 15 minutes");
  });

  test("list, detail, status, export, erase and logout", async () => {
    await s.q("DELETE FROM inquiries");
    const older = await s.submit(await payload({ company: "Older Synthetic Co" }));
    const newer = await s.submit(await payload({ company: "Newer Synthetic Co", improve: "=SUM(A1)" }));
    await s.q("TRUNCATE rate_limits");
    const session = await s.login();

    const list = await s.admin(session, "GET", "?action=list");
    assert.equal(list.status, 200);
    assert.deepEqual(list.json.inquiries.map((r) => r.company), ["Newer Synthetic Co", "Older Synthetic Co"]);
    for (const key of ["name", "email", "company", "role", "building_type", "floor_area", "building_count", "bms", "bms_name", "energy_spend", "improve", "phone", "source_url", "utm_source", "reference", "created_at", "status"])
      assert.ok(key in list.json.inquiries[0], key);

    const detail = await s.admin(session, "GET", `?action=detail&reference=${older.json.reference}`);
    assert.equal(detail.json.inquiry.company, "Older Synthetic Co");
    assert.deepEqual(detail.json.events.map((e) => e.action), ["received"]);

    // Writes need the CSRF token and this origin.
    assert.equal((await s.admin({ cookie: session.cookie }, "POST", "", { action: "status", reference: older.json.reference, status: "contacted" })).status, 403);
    assert.equal((await s.call("POST", "/api/admin", { headers: { Origin: "https://evil.example", Cookie: session.cookie, "X-CSRF-Token": session.csrf }, body: { action: "status", reference: older.json.reference, status: "contacted" } })).status, 403);
    const mark = await s.admin(session, "POST", "", { action: "status", reference: older.json.reference, status: "contacted" });
    assert.equal(mark.status, 200);
    const marked = (await s.q("SELECT status, contacted_at FROM inquiries WHERE reference = $1", [older.json.reference])).rows[0];
    assert.equal(marked.status, "contacted");
    assert.ok(marked.contacted_at);
    await s.admin(session, "POST", "", { action: "status", reference: older.json.reference, status: "new" });
    assert.equal((await s.q("SELECT status, contacted_at FROM inquiries WHERE reference = $1", [older.json.reference])).rows[0].contacted_at, null);

    const csv = await s.admin(session, "GET", "?action=export");
    assert.equal(csv.status, 200);
    assert.match(csv.headers["content-type"], /^text\/csv/);
    assert.match(csv.headers["content-disposition"], /^attachment; filename="energia-inquiries-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.ok(csv.text.includes("Newer Synthetic Co") && csv.text.includes("Older Synthetic Co"));
    assert.ok(csv.text.includes(`"'=SUM(A1)"`), "formula defused");

    // Erase needs the reference typed back, and removes only that record.
    assert.equal((await s.admin(session, "POST", "", { action: "erase", reference: newer.json.reference })).status, 400);
    const erased = await s.admin(session, "POST", "", { action: "erase", reference: newer.json.reference, confirm: newer.json.reference });
    assert.equal(erased.status, 200);
    assert.equal((await s.q("SELECT count(*) FROM inquiries WHERE reference = $1", [newer.json.reference])).rows[0].count, "0");
    assert.equal((await s.q("SELECT count(*) FROM inquiries WHERE reference = $1", [older.json.reference])).rows[0].count, "1");
    const events = (await s.q("SELECT action FROM inquiry_events WHERE reference = $1 ORDER BY id", [newer.json.reference])).rows.map((r) => r.action);
    assert.deepEqual(events, ["received", "erased"]);
    assert.equal((await s.admin(session, "POST", "", { action: "erase", reference: newer.json.reference, confirm: newer.json.reference })).status, 404);

    const out = await s.admin(session, "POST", "", { action: "logout" });
    assert.equal(out.status, 200);
    assert.match(out.headers["set-cookie"][0], /Max-Age=0/);
    assert.equal((await s.admin(session, "GET", "?action=list")).status, 401);
    assert.equal((await s.admin(session, "POST", "", { action: "erase", reference: older.json.reference, confirm: older.json.reference })).status, 401);
    assert.equal((await s.q("SELECT count(*) FROM inquiries WHERE reference = $1", [older.json.reference])).rows[0].count, "1");
  });

  test("login limits hold under concurrent attempts", async () => {
    // Eight wrong passwords at once from one address: the per address
    // budget of five is spent atomically, so exactly five reach scrypt.
    const statuses = (await Promise.all(Array.from({ length: 8 }, () => s.login("wrong password")))).map((r) => r.status);
    assert.deepEqual([...statuses].sort(), [401, 401, 401, 401, 401, 429, 429, 429], JSON.stringify(statuses));
    assert.equal((await s.q("SELECT count FROM rate_limits WHERE key LIKE 'admin-login:%'")).rows[0].count, 6, "capped at the limit plus one");
    // The global budget: 50 per 15 minutes across every address.
    await s.q("TRUNCATE rate_limits");
    await s.q("INSERT INTO rate_limits(key, count, expires_at) VALUES ('admin-login-global', 47, now() + interval '15 minutes')");
    const global = (await Promise.all(Array.from({ length: 5 }, () => s.login("wrong password")))).map((r) => r.status);
    assert.deepEqual([...global].sort(), [401, 401, 401, 429, 429], JSON.stringify(global));
  });

  test("the challenge limit holds under concurrent requests", async () => {
    const statuses = (await Promise.all(Array.from({ length: 34 }, () => s.call("POST", "/api/challenge", { headers: { Origin: s.origin }, body: {} })))).map((r) => r.status);
    assert.equal(statuses.filter((c) => c === 200).length, 30, JSON.stringify(statuses));
    assert.equal(statuses.filter((c) => c === 429).length, 4);
  });

  test("an expired session gets 401 for reads and writes", async () => {
    const r = await s.submit(await payload({ company: "Expiry Synthetic Co" }));
    await s.q("TRUNCATE rate_limits");
    const session = await s.login();
    assert.equal((await s.admin(session, "GET", "?action=list")).status, 200);
    await s.q("UPDATE admin_sessions SET expires_at = now() - interval '1 second'");
    assert.equal((await s.admin(session, "GET", "?action=list")).status, 401);
    assert.equal((await s.admin(session, "GET", "?action=session")).status, 401);
    assert.equal((await s.admin(session, "POST", "", { action: "erase", reference: r.json.reference, confirm: r.json.reference })).status, 401);
    assert.equal((await s.admin(session, "POST", "", { action: "status", reference: r.json.reference, status: "contacted" })).status, 401);
    const row = (await s.q("SELECT status FROM inquiries WHERE reference = $1", [r.json.reference])).rows[0];
    assert.equal(row.status, "new", "nothing changed and nothing was erased");
  });

  test("changing the password ends every existing session", async () => {
    const r = await s.submit(await payload({ company: "Rotation Synthetic Co" }));
    await s.q("TRUNCATE rate_limits");
    const session = await s.login();
    assert.equal((await s.admin(session, "GET", "?action=list")).status, 200);
    const original = s.env.ADMIN_PASSWORD_HASH;
    try {
      s.env.ADMIN_PASSWORD_HASH = await hashPassword("a rotated synthetic password");
      assert.equal((await s.admin(session, "GET", "?action=list")).status, 401);
      assert.equal((await s.admin(session, "POST", "", { action: "erase", reference: r.json.reference, confirm: r.json.reference })).status, 401);
      assert.equal((await s.login(ADMIN_PASSWORD)).status, 401, "the old password no longer signs in");
      const fresh = await s.login("a rotated synthetic password");
      assert.equal(fresh.status, 200);
      assert.equal((await s.admin(fresh, "GET", "?action=list")).status, 200);
    } finally {
      s.env.ADMIN_PASSWORD_HASH = original;
    }
    assert.equal(Number((await s.q("SELECT count(*) FROM inquiries WHERE reference = $1", [r.json.reference])).rows[0].count), 1);
  });

  test("the notify token reads new inquiries after a cursor, and nothing else", async () => {
    const bearer = { Authorization: `Bearer ${NOTIFY_TOKEN}` };
    const start = await s.call("GET", "/api/admin?action=notify&after=0", { headers: bearer });
    assert.equal(start.status, 200);
    const cursor = start.json.cursor;
    const r = await s.submit(await payload({ company: "Notify Synthetic Co", role: "Owner or executive" }));
    const next = await s.call("GET", `/api/admin?action=notify&after=${cursor}`, { headers: bearer });
    assert.deepEqual(next.json.inquiries.map((i) => [i.reference, i.company, i.role]), [[r.json.reference, "Notify Synthetic Co", "Owner or executive"]]);
    assert.deepEqual(Object.keys(next.json.inquiries[0]).sort(), ["building_count", "building_type", "company", "created_at", "floor_area", "id", "name", "reference", "role"]);
    assert.equal((await s.call("GET", `/api/admin?action=notify&after=${next.json.cursor}`, { headers: bearer })).json.inquiries.length, 0);
    assert.equal((await s.call("GET", "/api/admin?action=notify", { headers: { Authorization: "Bearer " + "x".repeat(40) } })).status, 401);
    // The token is not a session: it cannot list, export or erase.
    for (const q of ["?action=list", "?action=export"]) assert.equal((await s.call("GET", "/api/admin" + q, { headers: bearer })).status, 401, q);
    assert.equal((await s.call("POST", "/api/admin", { headers: { ...bearer, Origin: s.origin }, body: { action: "erase", reference: r.json.reference, confirm: r.json.reference } })).status, 401);
  });
});

describe("cleanup keeps every inquiry", () => {
  test("cron auth, then expired security rows go and inquiries of any age stay", async () => {
    assert.equal((await s.call("GET", "/api/cleanup")).status, 401);
    assert.equal((await s.call("GET", "/api/cleanup", { headers: { Authorization: "Bearer " + "0".repeat(64) } })).status, 401);
    await s.submit(await payload({ company: "Ancient Synthetic Co" }));
    // Backdate every inquiry by three years, far past any retention window.
    await s.q("UPDATE inquiries SET created_at = now() - interval '3 years'");
    const inquiriesBefore = (await s.q("SELECT reference, name, email FROM inquiries ORDER BY id")).rows;
    assert.ok(inquiriesBefore.length > 0);
    await s.q("INSERT INTO rate_limits VALUES ('old', 1, now() - interval '1 hour'), ('live', 1, now() + interval '1 hour')");
    await s.q("INSERT INTO used_proofs VALUES ('old', now() - interval '1 hour')");
    await s.q("INSERT INTO admin_sessions VALUES ($1, 'c', 'v', now() - interval '1 hour')", ["e".repeat(64)]);
    const r = await s.call("GET", "/api/cleanup", { headers: { Authorization: `Bearer ${s.env.CRON_SECRET}` } });
    assert.equal(r.status, 200);
    assert.equal(r.json.inquiries, "kept");
    assert.ok(r.json.removed.rate_limits >= 1 && r.json.removed.used_proofs >= 1 && r.json.removed.admin_sessions >= 1);
    assert.deepEqual((await s.q("SELECT key FROM rate_limits WHERE key IN ('old', 'live')")).rows, [{ key: "live" }]);
    assert.deepEqual((await s.q("SELECT reference, name, email FROM inquiries ORDER BY id")).rows, inquiriesBefore);
    // Run it again: still nothing removed from inquiries.
    await s.call("GET", "/api/cleanup", { headers: { Authorization: `Bearer ${s.env.CRON_SECRET}` } });
    assert.deepEqual((await s.q("SELECT reference, name, email FROM inquiries ORDER BY id")).rows, inquiriesBefore);
  });
});

describe("pooled transaction limits", () => {
  test("timeouts are transaction local and do not leak to the next borrower", async () => {
    const inside = await transaction(s.pool, async (c) => (await c.query("SHOW statement_timeout")).rows[0].statement_timeout);
    assert.equal(inside, "5s");
    const c = await s.pool.connect();
    try {
      assert.equal((await c.query("SHOW statement_timeout")).rows[0].statement_timeout, "0");
    } finally {
      c.release();
    }
    await assert.rejects(query(s.pool, "SELECT pg_sleep(6)"), (e) => e.code === "57014");
    assert.equal((await query(s.pool, "SELECT 1 AS ok")).rows[0].ok, 1);
  });
});
