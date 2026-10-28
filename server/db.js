import pg from "pg";

const pools = new Map();

// One small pool per URL and function instance. Prisma's pooler rejects
// timeout settings in the startup packet, so limits are applied per
// transaction below instead of as connection options.
export function database(url) {
  let pool = pools.get(url);
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 3,
      // Dispose on every release; Prisma's remote pool handles reuse, and no
      // idle client survives a suspended function.
      maxUses: 1,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10000,
      query_timeout: 7000,
    });
    // The error object can carry connection details; never log it.
    pool.on("error", () => console.error("PostgreSQL idle connection failed; client discarded"));
    pools.set(url, pool);
  }
  return pool;
}

export async function transaction(pool, fn) {
  const client = await pool.connect();
  let discard = false;
  const onError = () => {
    discard = true;
  };
  client.on("error", onError);
  try {
    await client.query("BEGIN");
    // LOCAL keeps the limits on this transaction without leaking session
    // state to the next borrower of the pooled backend.
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true; // never return a connection in an unknown state
    }
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(discard);
  }
}

// A single statement gets the same server side limits as a mutation.
export function query(pool, sql, values) {
  return transaction(pool, (c) => c.query(sql, values));
}

// Fixed window counter. Returns true while the key is within its limit.
export async function rate(client, key, limit, seconds) {
  const r = await client.query(
    `INSERT INTO rate_limits(key, count, expires_at)
     VALUES ($1, 1, now() + $3 * interval '1 second')
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE LEAST(rate_limits.count + 1, $2 + 1) END,
       expires_at = CASE WHEN rate_limits.expires_at <= now() THEN excluded.expires_at ELSE rate_limits.expires_at END
     RETURNING count`,
    [key, limit, seconds],
  );
  return r.rows[0].count <= limit;
}

export const rateLimit = (pool, key, limit, seconds) => transaction(pool, (c) => rate(c, key, limit, seconds));
