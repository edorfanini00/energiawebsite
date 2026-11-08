import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Fail the build if a content edit leaves a stale CSP hash. The default
// policy and private routes never need permission for inline scripts.
export async function validateJsonLd(root, vercel) {
  for (const [file, path] of [["index.html", "/"], ["privacy.html", "/privacy"], ["hvac-optimization.html", "/hvac-optimization"], ["hvac-optimization-pilot.html", "/hvac-optimization-pilot"], ["hvac-optimization-companies.html", "/hvac-optimization-companies"]]) {
    const html = await readFile(join(root, file), "utf8");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (blocks.length !== 1) throw new Error(`${file}: expected one JSON-LD block`);
    const data = JSON.parse(blocks[0][1]);
    if (data["@context"] !== "https://schema.org" || data["@graph"]?.length !== 3) throw new Error(`${file}: invalid identity graph`);
    const hash = "'sha256-" + createHash("sha256").update(blocks[0][1]).digest("base64") + "'";
    const policy = vercel.headers.find(r => r.source === path)?.headers.find(h => h.key === "Content-Security-Policy")?.value;
    const script = policy?.split(";").find(d => d.trim().startsWith("script-src "));
    if (!script?.split(/\s+/).includes(hash) || /unsafe-inline|unsafe-eval/.test(policy)) throw new Error(`${file}: JSON-LD CSP hash mismatch or unsafe policy`);
  }
}
