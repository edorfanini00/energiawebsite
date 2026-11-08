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
  await page.locator("[data-more] > summary").click();
  await page.selectOption("#inquiry-role", "Property manager");
  await page.selectOption("#inquiry-building-count", "More than 20");
  await page.fill("#inquiry-improve", "Synthetic end to end test.");
  await page.locator("[data-submit]").click();
  await page.locator("[data-done]").waitFor({ timeout: 30000 });
  // Shown with a space (no dashes for visitors); stored with its hyphen.
  const shown = await page.locator("[data-reference]").textContent();
  assert.match(shown, /^EA [0-9A-HJKMNP-TV-Z]{8}$/);
  const reference = shown.replace(" ", "-");
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

test("privacy instructions lead to a stored synthetic request through the existing form", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(origin + "/privacy");
    await page.getByRole("link", { name: "inquiry form", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.id === "inquiry-name");
    await page.fill("#inquiry-name", "Synthetic Privacy Tester");
    await page.fill("#inquiry-email", "synthetic.privacy@example.com");
    await page.fill("#inquiry-company", "Privacy request");
    await page.selectOption("#inquiry-building-type", "Other");
    await page.selectOption("#inquiry-floor-area", "Not sure");
    await page.locator("[data-more] > summary").click();
    await page.fill("#inquiry-improve", "Synthetic privacy request: please show or delete my prior inquiry details.");
    await page.locator("[data-submit]").click();
    await page.locator("[data-done]").waitFor({ timeout: 30000 });
    const shown = await page.locator("[data-reference]").textContent();
    const reference = shown.replace(" ", "-");
    const row = (await pool.query("SELECT * FROM inquiries WHERE reference = $1", [reference])).rows[0];
    assert.equal(row.company, "Privacy request");
    assert.equal(row.improve, "Synthetic privacy request: please show or delete my prior inquiry details.");
    assert.equal(await page.locator('a[href^="mailto:"]').count(), 0);
    assert.match(await page.locator("[data-done]").innerText(), /Keep this reference for your records/);
    await pool.query("DELETE FROM inquiries WHERE reference = $1", [reference]);
  } finally { await page.close(); }
});

// Every inquiry goes through the actual HTTP handler, ALTCHA solver and a
// disposable local PostgreSQL. No browser request may leave loopback.
for (const path of ['/', '/hvac-optimization', '/hvac-optimization-pilot', '/hvac-optimization-companies', '/about', '/hvac-optimization-evidence', '/privacy']) {
  for (const tagged of [false, true]) {
    test(`real persistence: ${path} to contact, ${tagged ? 'tagged' : 'untagged'}`, async () => {
      await pool.query('TRUNCATE rate_limits, used_proofs');
      const page = await browser.newPage({ viewport: { width: tagged ? 390 : 1440, height: 900 } });
      const external = [];
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      await page.addInitScript(() => {
        for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, { get() { throw new Error('unavailable'); } });
      });
      try {
        await page.goto(origin + path + (tagged ? '?utm_source=synthetic_search&utm_medium=organic&utm_campaign=source_proof&utm_term=building&utm_content=resource&email=PRIVATE&_vercel_share=SECRET' : ''));
        if (path !== '/') await page.locator('main a[data-contact-source]').first().click();
        else await page.locator(tagged ? '.hero__cta' : '.bar__cta').click();
        await page.waitForFunction(() => document.activeElement?.id === 'inquiry-name');
        await page.fill('#inquiry-name', 'Synthetic Provenance Tester');
        await page.fill('#inquiry-email', `source.${crypto.randomUUID()}@example.com`);
        await page.fill('#inquiry-company', 'Synthetic Source Buildings');
        await page.selectOption('#inquiry-building-type', 'Office');
        await page.selectOption('#inquiry-floor-area', 'Not sure');
        await page.locator('[data-submit]').click();
        await page.locator('[data-done]').waitFor({ timeout: 30000 });
        const reference = (await page.locator('[data-reference]').textContent()).replace(' ', '-');
        const row = (await pool.query('SELECT * FROM inquiries WHERE reference = $1', [reference])).rows[0];
        assert.equal(row.source_url, origin + path);
        for (const [key, value] of Object.entries({ utm_source: 'synthetic_search', utm_medium: 'organic', utm_campaign: 'source_proof', utm_term: 'building', utm_content: 'resource' })) assert.equal(row[key], tagged ? value : null);
        assert.ok(!JSON.stringify(row).match(/PRIVATE|SECRET/));
        assert.deepEqual(external, []);
      } finally { await page.close(); }
    });
  }
}

test('source attribution survives actual failed submission, stored response loss and idempotent retry', async () => {
  await pool.query('TRUNCATE rate_limits, used_proofs');
  const page = await browser.newPage();
  const posts = [];
  try {
    await page.goto(origin + '/hvac-optimization-pilot?utm_source=synthetic_retry');
    await page.locator('main a[data-contact-source]').click();
    await page.fill('#inquiry-name', 'Synthetic Retry Tester');
    await page.fill('#inquiry-email', 'synthetic.retry@example.com');
    await page.fill('#inquiry-company', 'Synthetic Retry Building');
    await page.selectOption('#inquiry-building-type', 'Office');
    await page.selectOption('#inquiry-floor-area', 'Not sure');
    await page.evaluate(() => { window.__leads = []; window.fbq = (...args) => window.__leads.push(args); });
    await page.route('**/api/inquiry', async route => {
      posts.push(route.request().postDataJSON());
      if (posts.length === 1) return route.fulfill({ status: 503, json: { status: 'unavailable' } });
      if (posts.length === 2) { const response = await route.fetch(); assert.equal(response.status(), 200); return route.abort('timedout'); }
      return route.continue();
    });
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-submit]').click();
      await page.getByText(/Your answers are still in the form/).waitFor();
      await page.locator('[data-submit]:enabled').waitFor();
      assert.equal(await page.inputValue('#inquiry-name'), 'Synthetic Retry Tester');
    }
    await page.locator('[data-submit]').click();
    await page.locator('[data-done]').waitFor({ timeout: 30000 });
    assert.equal(posts.length, 3);
    assert.equal(new Set(posts.map(p => p.idempotencyKey)).size, 1);
    for (const post of posts) { assert.equal(post.sourcePath, '/hvac-optimization-pilot'); assert.equal(post.utm, 'utm_source=synthetic_retry'); }
    const rows = (await pool.query('SELECT * FROM inquiries WHERE idempotency_key = $1', [posts[0].idempotencyKey])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source_url, origin + '/hvac-optimization-pilot');
    assert.equal(rows[0].utm_source, 'synthetic_retry');
    assert.equal((await pool.query('SELECT count(*) FROM inquiry_events WHERE reference = $1 AND action = $2', [rows[0].reference, 'received'])).rows[0].count, '1');
    assert.deepEqual(await page.evaluate(() => window.__leads), []);
  } finally { await page.close(); }
});
