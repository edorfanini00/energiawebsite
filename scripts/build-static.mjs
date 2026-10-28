// Vercel build: copy exactly the public files into dist/. Functions in api/
// are bundled separately and are never served as files.
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicFile } from "./public-files.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = join(root, "dist");

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const candidates = [...(await readdir(root)).map((f) => join(root, f)), ...(await walk(join(root, "assets")))];
let count = 0;
for (const file of candidates) {
  const path = "/" + relative(root, file).split("\\").join("/");
  if (!publicFile.test(path) || !(await stat(file)).isFile()) continue;
  await mkdir(join(out, path, ".."), { recursive: true });
  await cp(file, join(out, path));
  count++;
}
console.log(`Copied ${count} public files to dist/`);
