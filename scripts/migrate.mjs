// Explicit, reversible schema migrations.
//   node scripts/migrate.mjs status
//   node scripts/migrate.mjs up
//   node scripts/migrate.mjs down --confirm-drop-inquiries   (reverts the latest)
// DATABASE_URL comes from the environment only and is never printed. Prisma
// Postgres is migrated over its direct host; app traffic stays pooled.
import { readdir, readFile } from "node:fs/promises";
import { databaseUrl } from "../server/config.js";
import { database, transaction } from "../server/db.js";

const dir = new URL("../migrations/", import.meta.url);

export async function migrations() {
  const files = (await readdir(dir)).filter((f) => /^\d{3}_[a-z0-9_]+\.up\.sql$/.test(f)).sort();
  return files.map((f) => ({ version: Number(f.slice(0, 3)), name: f.replace(/\.up\.sql$/, "") }));
}

async function locked(pool, fn) {
  return transaction(pool, async (c) => {
    // DDL may legitimately run longer than the app's statement limit.
    await c.query("SET LOCAL statement_timeout = '60000ms'");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('energia-migrations'))");
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = (await c.query("SELECT version FROM schema_migrations ORDER BY version")).rows.map((r) => r.version);
    return fn(c, applied);
  });
}

export async function up(pool) {
  const all = await migrations();
  return locked(pool, async (c, applied) => {
    const done = [];
    for (const m of all) {
      if (applied.includes(m.version)) continue;
      await c.query(await readFile(new URL(`${m.name}.up.sql`, dir), "utf8"));
      await c.query("INSERT INTO schema_migrations(version, name) VALUES ($1, $2)", [m.version, m.name]);
      done.push(m.name);
    }
    return done;
  });
}

export async function down(pool) {
  const all = await migrations();
  return locked(pool, async (c, applied) => {
    const latest = all.filter((m) => applied.includes(m.version)).pop();
    if (!latest) return null;
    await c.query(await readFile(new URL(`${latest.name}.down.sql`, dir), "utf8"));
    await c.query("DELETE FROM schema_migrations WHERE version = $1", [latest.version]);
    return latest.name;
  });
}

export async function status(pool) {
  const all = await migrations();
  return locked(pool, async (_c, applied) => all.map((m) => ({ name: m.name, applied: applied.includes(m.version) })));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const [command, flag] = process.argv.slice(2);
  const url = databaseUrl(process.env.DATABASE_URL, process.env.VERCEL === "1", "direct");
  if (!url) {
    console.error("DATABASE_URL is missing or not an allowed database.");
    process.exit(2);
  }
  if (command === "down" && flag !== "--confirm-drop-inquiries") {
    console.error("Reverting drops every inquiry. Pass --confirm-drop-inquiries to proceed.");
    process.exit(2);
  }
  const pool = database(url);
  try {
    if (command === "up") console.log(JSON.stringify({ applied: await up(pool) }));
    else if (command === "down") console.log(JSON.stringify({ reverted: await down(pool) }));
    else if (command === "status") console.log(JSON.stringify(await status(pool)));
    else {
      console.error("Usage: migrate.mjs status | up | down --confirm-drop-inquiries");
      process.exitCode = 2;
    }
  } catch (error) {
    // Report the failing stage and code only; never the message or the URL.
    console.error(JSON.stringify({ error: "migration_failed", code: error?.code ?? null }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
