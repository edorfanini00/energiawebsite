// Runtime configuration. Every value is validated before use and never
// echoed back; a missing or malformed value disables the feature (503).

// Prisma Postgres only on Vercel (pooled for app traffic, direct for
// migrations), or a loopback database for local tests. Errors never include
// the supplied URL.
export function databaseUrl(raw, vercel = process.env.VERCEL === "1", purpose = "runtime") {
  try {
    if (!raw || raw.trim() !== raw || /[\s\\]/.test(raw)) return null;
    const authority = /^[a-z]+:\/\/([^/?#]+)/.exec(raw)?.[1];
    if (!authority || authority.split("@").length !== 2 || authority.endsWith(":")) return null;
    const db = new URL(raw);
    const keys = [...db.searchParams.keys()];
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      db.hash ||
      !db.username ||
      !/^\/[^/]+$/.test(db.pathname) ||
      keys.some((key) => key !== "sslmode") ||
      new Set(keys).size !== keys.length ||
      /[\x00-\x20/\\]/.test(decodeURIComponent(db.pathname.slice(1))) ||
      /[\x00-\x20]/.test(decodeURIComponent(db.username)) ||
      /[\x00-\x1f]/.test(decodeURIComponent(db.password))
    )
      return null;
    if (!vercel && db.hostname === "127.0.0.1") {
      if (keys.length && db.searchParams.get("sslmode") !== "disable") return null;
      return db.href;
    }
    if (
      !["db.prisma.io", "pooled.db.prisma.io"].includes(db.hostname) ||
      (db.port !== "" && db.port !== "5432") ||
      !db.password ||
      !["require", "verify-full"].includes(db.searchParams.get("sslmode") ?? "")
    )
      return null;
    db.hostname = purpose === "runtime" ? "pooled.db.prisma.io" : "db.prisma.io";
    db.port = "5432";
    db.search = "?sslmode=verify-full";
    return db.href;
  } catch {
    return null;
  }
}

// A bare origin. Case and one trailing slash are normalized; a path, query,
// fragment or credentials make the entry invalid, and it is dropped.
function exactOrigin(value, vercel) {
  try {
    if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(value)) return null;
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
    if (!vercel && url.protocol === "http:" && url.hostname === "127.0.0.1") return url.origin;
    return null;
  } catch {
    return null;
  }
}

// The exact origins allowed to post. On Vercel: this deployment's own URL
// (which its share link opens), its branch alias, the production hostname
// for production deployments, plus INQUIRY_ORIGINS: an optional comma
// separated list for every other host that serves the site without a
// redirect (www and the apex, a second domain). scripts/check-origins.mjs is
// the release gate that proves each served host is allowed.
export function allowedOrigins(env = process.env) {
  const vercel = env.VERCEL === "1";
  const hosts = [];
  if (vercel) {
    hosts.push(env.VERCEL_URL, env.VERCEL_BRANCH_URL);
    if (env.VERCEL_ENV === "production") hosts.push(env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  const candidates = hosts
    .filter((h) => typeof h === "string" && /^[a-z0-9.-]+$/i.test(h))
    .map((h) => `https://${h.toLowerCase()}`)
    .concat((env.INQUIRY_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return [...new Set(candidates.map((o) => exactOrigin(o, vercel)).filter(Boolean))];
}

const HEX_SECRET = /^[a-f0-9]{64,128}$/;
export const hexSecret = (value) => typeof value === "string" && HEX_SECRET.test(value);

// Settings shared by the intake and admin APIs.
export function intakeConfig(env = process.env) {
  const url = databaseUrl(env.DATABASE_URL, env.VERCEL === "1");
  const origins = allowedOrigins(env);
  if (!url || !origins.length || !hexSecret(env.INQUIRY_HASH_SECRET)) return null;
  return { databaseUrl: url, origins, hashSecret: env.INQUIRY_HASH_SECRET };
}
