// Release gate for the inquiry origin allowlist. For every host that serves
// the site, POST /api/challenge the way that host's own page does (expect
// 200), once with Fetch Metadata and once without it as older Safari sends
// it, and once from a foreign origin (expect 403). A host missing from the
// allowlist (www versus the apex, a second domain, the vercel.app alias)
// fails here instead of silently sending every visitor to the email fallback.
//
//   node scripts/check-origins.mjs https://energia.example https://www.energia.example
//   CHECK_ORIGINS="https://a.example,https://b.example" node scripts/check-origins.mjs
//   node scripts/check-origins.mjs --share-file path/to/SHARE-LINK.txt
//
// --share-file opens a protected preview through its Vercel share link and
// checks that deployment's origin; the token is never printed. Each passing
// host spends two of its address's 30 challenges per 10 minutes.
import { readFileSync } from "node:fs";

const FOREIGN = "https://cross-origin.invalid";
const args = process.argv.slice(2);
const origins = [];
let shareFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--share-file") shareFile = args[++i];
  else origins.push(args[i]);
}
origins.push(...(process.env.CHECK_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean));

// A share link answers with a redirect that sets the deployment's access
// cookie; later requests to that origin carry it.
const cookies = new Map();
if (shareFile) {
  const link = new URL(readFileSync(shareFile, "utf8").trim());
  const r = await fetch(link, { redirect: "manual" });
  const jar = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!jar) {
    console.error(`share link for ${link.origin} set no cookie (status ${r.status})`);
    process.exit(1);
  }
  cookies.set(link.origin, jar);
  origins.push(link.origin);
}

if (!origins.length) {
  console.error("usage: node scripts/check-origins.mjs <https://origin> ... [--share-file file]");
  process.exit(2);
}

async function challenge(target, headers) {
  const res = await fetch(target + "/api/challenge", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(cookies.has(target) ? { Cookie: cookies.get(target) } : {}), ...headers },
    body: "{}",
  });
  return res.status;
}

const results = [];
for (const raw of new Set(origins)) {
  let target;
  try {
    target = new URL(raw).origin;
  } catch {
    results.push({ origin: raw, ok: false, error: "not a URL" });
    continue;
  }
  const sameOrigin = await challenge(target, { Origin: target, "Sec-Fetch-Site": "same-origin" });
  const noFetchMetadata = await challenge(target, { Origin: target });
  const crossOrigin = await challenge(target, { Origin: FOREIGN });
  results.push({ origin: target, sameOrigin, noFetchMetadata, crossOrigin, ok: sameOrigin === 200 && noFetchMetadata === 200 && crossOrigin === 403 });
}

const passed = results.every((r) => r.ok);
console.log(JSON.stringify({ at: new Date().toISOString(), passed, expected: { sameOrigin: 200, noFetchMetadata: 200, crossOrigin: 403 }, results }, null, 2));
process.exit(passed ? 0 : 1);
