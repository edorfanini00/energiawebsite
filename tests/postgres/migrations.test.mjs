// The schema migration applies, reverts and reapplies cleanly, and is
// idempotent when run twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { localPostgres } from "../support/local-postgres.mjs";
import { database } from "../../server/db.js";
import { down, status, up } from "../../scripts/migrate.mjs";

test("001_inquiries is explicit and reversible", async () => {
  const pg = await localPostgres();
  const pool = database(pg.url);
  const tables = async () => (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map((r) => r.tablename);
  try {
    assert.deepEqual(await up(pool), ["001_inquiries"]);
    assert.deepEqual(await up(pool), [], "second run is a no-op");
    assert.deepEqual(await tables(), ["admin_sessions", "inquiries", "inquiry_events", "rate_limits", "schema_migrations", "used_proofs"]);
    assert.deepEqual(await status(pool), [{ name: "001_inquiries", applied: true }]);
    // Columns hold every form answer plus the bookkeeping the brief asks for.
    const columns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inquiries' ORDER BY ordinal_position")).rows.map((r) => r.column_name);
    for (const c of ["reference", "idempotency_key", "created_at", "name", "email", "company", "building_type", "floor_area", "role", "building_count", "bms", "bms_name", "energy_spend", "improve", "phone", "source_url", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "status", "contacted_at"])
      assert.ok(columns.includes(c), c);
    assert.ok(!columns.some((c) => /expire|retain|delete/.test(c)), "no expiry column on inquiries");
    assert.equal(await down(pool), "001_inquiries");
    assert.deepEqual(await tables(), ["schema_migrations"]);
    assert.deepEqual(await up(pool), ["001_inquiries"]);
  } finally {
    await pool.end();
    await pg.close();
  }
});

test("the CLI refuses to revert without the explicit flag and never prints the URL", async () => {
  const { execFile } = await import("node:child_process");
  const run = (args, env) => new Promise((r) => execFile(process.execPath, ["scripts/migrate.mjs", ...args], { env: { ...process.env, ...env } }, (error, stdout, stderr) => r({ code: error?.code ?? 0, out: stdout + stderr })));
  const secret = "postgres://user:CANARY_PASSWORD@db.prisma.io:5432/postgres?sslmode=require";
  const refused = await run(["down"], { DATABASE_URL: secret });
  assert.equal(refused.code, 2);
  assert.ok(!refused.out.includes("CANARY_PASSWORD"));
  const bad = await run(["status"], { DATABASE_URL: "postgres://u:CANARY_PASSWORD@evil.example/x" });
  assert.equal(bad.code, 2);
  assert.ok(!bad.out.includes("CANARY_PASSWORD"));
});
