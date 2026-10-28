// Minimal static server for local preview and Playwright tests.
// Mirrors the security headers in vercel.json so tests see the same policy.
// With API=1 it also mounts the real /api handlers (the inquiry tests point
// them at a disposable loopback database).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanUrls, publicFile } from "./public-files.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const headersFor = (path) => {
  const out = {};
  for (const rule of vercel.headers) {
    const pattern = new RegExp("^" + rule.source.replace(/\(\.\*\)/g, ".*") + "$");
    if (pattern.test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
};
// A malformed URL gets the site-wide headers only (the catch-all rule).
const headers = headersFor("/\0");
// Hero and first-feature prototypes are local-only and never deployed.
const prototypes = process.env.PROTOTYPES === "1" ? /^\/prototypes\/(?:[ab]\.html|styles\.css)$/ : /^$/;
const api = {};
if (process.env.API === "1") {
  for (const name of ["inquiry", "challenge", "admin", "cleanup"]) api[`/api/${name}`] = (await import(`../api/${name}.js`)).default;
}

createServer(async (req, res) => {
  // A malformed URL or percent-escape gets a 400; it must not stop the server.
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400, headers).end("Bad request");
    return;
  }
  if (api[path]) return api[path](req, res);
  const target = cleanUrls[path] ?? path;
  if ((!publicFile.test(target) && !prototypes.test(target)) || target.includes("..")) {
    res.writeHead(404, headersFor(path)).end("Not found");
    return;
  }
  const file = normalize(join(root, target));
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, { ...headersFor(path), "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, headersFor(path)).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
