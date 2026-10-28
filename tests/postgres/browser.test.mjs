// End to end on the real local stack: scripts/serve.mjs with API=1 against a
// disposable loopback Postgres, driven in Chrome. The public form stores a
// synthetic inquiry; the dashboard reads it back, marks it contacted,
// exports it, erases only it and logs out.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { localPostgres } from "../support/local-postgres.mjs";
import { database } from "../../server/db.js";
import { up } from "../../scripts/migrate.mjs";
import { hashPassword } from "../../server/admin.js";

const PASSWORD = "synthetic-browser-admin-password";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let pg, pool, server, browser, origin;

before(async () => {
  pg = await localPostgres();
  pool = database(pg.url);
  await up(pool);
  const port = 4300 + Math.floor(Math.random() * 600);
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["scripts/serve.mjs"], {
    env: {
      ...process.env,
      API: "1",
      PORT: String(port),
      DATABASE_URL: pg.url,
      INQUIRY_ORIGINS: origin,
      INQUIRY_HASH_SECRET: randomBytes(32).toString("hex"),
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 8000);
    server.stdout.on("data", (d) => String(d).includes("Serving") && (clearTimeout(t), resolve()));
  });
  browser = await chromium.launch(existsSync(chrome) && process.env.PW_CHANNEL !== "chromium" ? { channel: "chrome" } : {});
});

after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
  await pool?.end();
  await pg?.close();
});

test("a synthetic inquiry travels from the form to the dashboard and is erased", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto(origin + "/?utm_source=synthetic_e2e");
  await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
  await page.locator(".hero__cta").click();
  await page.keyboard.type("Synthetic E2E Tester");
  await page.keyboard.press("Tab");
  await page.keyboard.type("synthetic.e2e@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Synthetic E2E Buildings");
  await page.selectOption("#inquiry-building-type", "Mixed use");
  await page.selectOption("#inquiry-floor-area", "Under 50,000 sq ft");
  await page.selectOption("#inquiry-role", "Property manager");
  await page.selectOption("#inquiry-building-count", "More than 20");
  await page.fill("#inquiry-improve", "Synthetic end to end test.");
  await page.locator("[data-submit]").click();
  await page.locator("[data-done]").waitFor({ timeout: 30000 });
  const reference = await page.locator("[data-reference]").textContent();
  assert.match(reference, /^EA-[0-9A-HJKMNP-TV-Z]{8}$/);
  assert.deepEqual(problems, []);

  const row = (await pool.query("SELECT * FROM inquiries WHERE reference = $1", [reference])).rows[0];
  assert.equal(row.name, "Synthetic E2E Tester");
  assert.equal(row.email, "synthetic.e2e@example.com");
  assert.equal(row.building_type, "Mixed use");
  assert.equal(row.floor_area, "Under 50,000 sq ft");
  assert.equal(row.role, "Property manager");
  assert.equal(row.building_count, "More than 20");
  assert.equal(row.improve, "Synthetic end to end test.");
  assert.equal(row.utm_source, "synthetic_e2e");
  assert.equal(row.source_url, origin + "/");
  // A second, unrelated record that must survive the erase.
  await pool.query(
    `INSERT INTO inquiries(reference, idempotency_key, payload_hash, name, email, company, building_type, floor_area)
     VALUES ('EA-KEEP0000', $1, $2, 'Keep Me', 'keep@example.com', 'Keep Co', 'Office', 'Not sure')`,
    [crypto.randomUUID(), "0".repeat(64)],
  );

  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  admin.on("console", (m) => m.type() === "error" && !/401/.test(m.text()) && problems.push(m.text()));
  await admin.goto(origin + "/admin");
  await admin.locator("#password").fill("not the password");
  await admin.locator("#password").press("Enter");
  await admin.getByText("That password is not correct.").waitFor();
  await admin.locator("#password").fill(PASSWORD);
  await admin.locator("#password").press("Enter");
  const item = admin.locator(`li[data-reference="${reference}"]`);
  await item.waitFor();
  const text = await item.innerText();
  for (const v of ["Synthetic E2E Buildings", "Synthetic E2E Tester", "synthetic.e2e@example.com", "Mixed use", "Under 50,000 sq ft", "Property manager", "More than 20", "Synthetic end to end test.", "synthetic_e2e", "New"]) assert.ok(text.includes(v), v);
  // Newest first.
  assert.equal(await admin.locator("li.item").first().getAttribute("data-reference"), "EA-KEEP0000");

  await item.getByRole("button", { name: "Mark contacted" }).click();
  await admin.locator(`li[data-reference="${reference}"] .badge--done`).waitFor();
  assert.equal((await pool.query("SELECT status FROM inquiries WHERE reference = $1", [reference])).rows[0].status, "contacted");

  await admin.locator(`li[data-reference="${reference}"]`).getByRole("button", { name: "Details" }).click();
  await admin.locator("[data-detail-title]").waitFor();
  assert.ok((await admin.locator("[data-detail-history]").innerText()).includes("Contacted"));
  await admin.getByRole("button", { name: "Back to the list" }).click();

  const download = admin.waitForEvent("download");
  await admin.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  assert.match(file.suggestedFilename(), /^energia-inquiries-\d{4}-\d{2}-\d{2}\.csv$/);

  const target = admin.locator(`li[data-reference="${reference}"]`);
  await target.getByRole("button", { name: "Erase" }).click();
  await target.getByRole("button", { name: "Erase permanently" }).click();
  await admin.getByText(`${reference} was erased.`).waitFor();
  assert.equal((await pool.query("SELECT count(*) FROM inquiries WHERE reference = $1", [reference])).rows[0].count, "0");
  assert.equal((await pool.query("SELECT count(*) FROM inquiries WHERE reference = 'EA-KEEP0000'")).rows[0].count, "1");

  await admin.getByRole("button", { name: "Sign out" }).click();
  await admin.locator("#password").waitFor();
  const after = await admin.evaluate(async () => (await fetch("/api/admin?action=list")).status);
  assert.equal(after, 401);
  assert.deepEqual(problems, []);
});
