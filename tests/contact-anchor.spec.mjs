import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Hold the real deferred script after main.js so rendering can happen before
// parsing finishes. This reproduces a slow resource without changing page code.
test("cross-page contact focus survives a delayed deferred resource", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.contactTrace = [];
    const record = event => window.contactTrace.push({ event: event.type, target: event.target.id || event.target.nodeName, ready: document.readyState, active: document.activeElement?.id, y: scrollY, time: performance.now() });
    for (const type of ["focusin", "focusout", "DOMContentLoaded", "load", "scroll"]) window.addEventListener(type, record, true);
  });
  await page.goto("/hvac-optimization-companies");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/pixel.js", async route => { await gate; await route.continue(); });
  try {
    await page.locator('main a[data-contact-source]').click({ noWaitAfter: true });
    await expect(page.locator("[data-inquiry]")).toHaveAttribute("data-ready", "");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => document.readyState)).toBe("interactive");
  } finally { release(); }
  await page.waitForLoadState("load");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(testInfo.outputPath("focus-events.json"), JSON.stringify(await page.evaluate(() => window.contactTrace), null, 2));
  await expect(page.locator("#inquiry-name")).toBeFocused();
  await expect(page.locator("#inquiry-name")).toBeInViewport();
});

const nextFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const exposed = page => page.evaluate(() => {
  const field = document.querySelector("#inquiry-name");
  const box = field.getBoundingClientRect();
  const header = document.querySelector(".bar").getBoundingClientRect();
  return box.top >= header.bottom && box.bottom <= innerHeight && document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === field;
});

async function holdResource(page, pattern) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(pattern, async route => { await gate; await route.continue(); });
  return release;
}

async function settledContact(page, screenshot) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page);
  await expect.poll(() => exposed(page)).toBe(true);
  // Assert after the scroll has finished, not the transient focus that hid
  // the original race. A bounded settle window also catches late resets.
  await page.waitForTimeout(1100);
  await expect(page.locator("#inquiry-name")).toBeFocused();
  expect(await exposed(page)).toBe(true);
  if (screenshot) await page.screenshot({ path: screenshot });
  await page.keyboard.press("Tab");
  await expect(page.locator("#inquiry-email")).toBeFocused();
  await nextFrames(page);
  await expect(page.locator("#inquiry-email")).toBeFocused();
}

for (const width of [320, 390, 1440]) {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    test(`delayed resource: all three contact origins at ${width}, motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.emulateMedia({ reducedMotion });
      for (const path of ["/hvac-optimization-pilot", "/hvac-optimization-companies", "/privacy"]) {
        await page.goto(path);
        const release = await holdResource(page, "**/pixel.js");
        try {
          await page.locator('main a[data-contact-source]').click({ noWaitAfter: true });
          await expect(page.locator("[data-inquiry]")).toHaveAttribute("data-ready", "");
          await nextFrames(page);
          expect(await page.evaluate(() => document.readyState)).toBe("interactive");
        } finally { release(); }
        await settledContact(page);
        await page.unroute("**/pixel.js");
      }
    });
  }
}

for (const action of ["none", "pointer", "keyboard", "wheel", "fragment"]) {
  test(`slow hero image: ${action} interaction before load`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const release = await holdResource(page, "**/assets/img/hero-*");
    try {
      await page.goto("/#contact", { waitUntil: "domcontentloaded" });
      await nextFrames(page);
      expect(await page.evaluate(() => document.readyState)).toBe("interactive");
      if (action === "pointer") await page.locator("#inquiry-company").click();
      if (action === "keyboard") {
        await page.locator("#inquiry-name").focus();
        await page.keyboard.press("Tab");
        await expect(page.locator("#inquiry-email")).toBeFocused();
      }
      if (action === "wheel") await page.mouse.wheel(0, -500);
      if (action === "fragment") await page.getByRole("link", { name: "Energia AI, back to top" }).click();
    } finally { release(); }
    await page.waitForLoadState("load");
    await nextFrames(page);
    await page.waitForTimeout(300);
    if (action === "none") await settledContact(page);
    if (action === "pointer") await expect(page.locator("#inquiry-company")).toBeFocused();
    if (action === "keyboard") await expect(page.locator("#inquiry-email")).toBeFocused();
    if (action === "wheel" || action === "fragment") await expect(page.locator("#inquiry-name")).not.toBeFocused();
    if (action === "fragment") await expect(page).toHaveURL(/#top$/);
  });
}

for (const width of [320, 390, 1440]) {
  test(`ordinary contact arrival and history at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/hvac-optimization-pilot");
    await page.locator('main a[data-contact-source]').click();
    // No intercepted or substituted resources in the visual evidence.
    await settledContact(page, testInfo.outputPath(`contact-${width}.png`));
    await page.goBack();
    await expect(page).toHaveURL(/\/hvac-optimization-pilot$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/\?source_path=%2F[^#]*#contact$/);
    await page.locator('.foot__links a[href="#contact"]').click();
    await settledContact(page);
  });
}

test("modified contact link opens a new tab without navigating its source", async ({ page }) => {
  await page.goto("/hvac-optimization-companies");
  const opened = page.context().waitForEvent("page", { timeout: 10000 });
  await page.locator('main a[data-contact-source]').click({ modifiers: ["ControlOrMeta"] });
  const popup = await opened;
  try {
    await expect(page).toHaveURL(/\/hvac-optimization-companies$/);
    await expect(popup).toHaveURL(/\/\?source_path=%2F[^#]*#contact$/);
    // A modified click opens a background tab; select it before expecting
    // its rendering-frame focus handoff or sending it keyboard input.
    await popup.bringToFront();
    await settledContact(popup);
  } finally { await popup.close(); }
});

test("privacy contact remains a native anchor without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + "/privacy");
    await page.locator('main a[data-contact-source]').click();
    await expect(page).toHaveURL(/\/\?source_path=%2F[^#]*#contact$/);
    await expect(page.locator("#contact-title")).toBeInViewport();
    await expect(page.locator(".contact__fallback")).toBeVisible();
  } finally { await context.close(); }
});
