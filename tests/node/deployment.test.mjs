// .vercelignore uses gitignore rules. Exercise that upload boundary in an
// isolated Git fixture, then run the real build on only the retained files.
// No Vercel account, environment file, network or new dependency is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicFile } from "../../scripts/public-files.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("deployment upload retains every public file and builds without internal or credential files", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "energia-upload-test-"));
  try {
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    // Synthetic names only: never read a real .env or credential file.
    const denied = [".env", "assets/.env.local", "assets/nested/token.secret", "assets/nested/private.key", "assets/nested/client.pem", "server/credentials.json", "server/.private/config.json", "RESULT.md", "untracked.txt", "scripts/shots.mjs", "tests/node/unit.test.mjs", "migrations/001_inquiries.up.sql", "BUYER-PAGES-RELEASE.md"];
    const candidates = [...new Set([...tracked, ...denied])];
    execFileSync("git", ["init", "--quiet", fixture]);
    await writeFile(join(fixture, ".gitignore"), await readFile(join(root, ".vercelignore")));
    const ignored = spawnSync("git", ["-c", "core.excludesFile=/dev/null", "check-ignore", "--no-index", "--stdin", "-z"], {
      cwd: fixture, input: candidates.join("\0") + "\0", encoding: "utf8",
    });
    assert.ok([0, 1].includes(ignored.status), ignored.stderr);
    const excluded = new Set(ignored.stdout.split("\0").filter(Boolean));
    for (const path of denied) assert.ok(excluded.has(path), `${path} must stay outside the upload`);
    const included = tracked.filter(path => !excluded.has(path));
    for (const path of included) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await cp(join(root, path), join(fixture, path));
    }
    const built = spawnSync(process.execPath, ["scripts/build-static.mjs"], { cwd: fixture, encoding: "utf8" });
    assert.equal(built.status, 0, `Build after deployment filtering failed:\n${built.stderr}`);
    for (const path of tracked.filter(path => publicFile.test("/" + path))) {
      assert.ok(included.includes(path), `${path} must survive upload filtering`);
      assert.deepEqual(await readFile(join(fixture, "dist", path)), await readFile(join(root, path)), path);
    }
    for (const path of ["api/inquiry.js", "server/inquiry.js", "scripts/validate-jsonld.mjs"]) assert.ok(included.includes(path), `${path} is needed by the deployment`);
    const publicRoots = await readdir(join(fixture, "dist"));
    for (const path of ["api", "server", "scripts", "tests", "migrations", "RESULT.md", "BUYER-PAGES-RELEASE.md", ".env"]) assert.ok(!publicRoots.includes(path), `${path} must not become public`);
    for (const path of ["hvac-optimization-pilot.html", "hvac-optimization-companies.html"]) assert.ok(publicRoots.includes(path), path);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
