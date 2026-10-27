// Minimal static server for local preview and Playwright tests.
// Mirrors the security headers in vercel.json so tests see the same policy.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
};
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const headers = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const allowed = /^\/(index\.html|styles\.css|main\.js|robots\.txt|assets\/[\w./-]+)$/;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const target = path === "/" ? "/index.html" : path;
  if (!allowed.test(target) || target.includes("..")) {
    res.writeHead(404, headers).end("Not found");
    return;
  }
  const file = normalize(join(root, target));
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, { ...headers, "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, headers).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
