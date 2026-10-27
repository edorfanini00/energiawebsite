import { test, expect } from "@playwright/test";

const narrow = [
  [768, 1024], [390, 844], [375, 812], [320, 740], [844, 390], [860, 1024],
];
const moments = ["dawn", "morning", "afternoon", "dusk"];

// Visibility includes the actual viewport and hit testing, not just CSS or focus.
async function exposed(page, locator) {
  await expect(locator).toBeFocused();
  await expect.poll(() => locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const points = [[.1, .5], [.5, .5], [.9, .5]];
    return el.matches(":focus-visible") && r.width > 0 && r.height > 0 &&
      r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth &&
      points.every(([x, y]) => {
        const hit = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y);
        return hit === el || el.contains(hit);
      });
  }), { message: "keyboard destination is visible and unobscured" }).toBe(true);
}

async function openByKeyboard(page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const selector of [".skip", ".bar__brand", "[data-toggle]"]) {
    await page.keyboard.press("Tab");
    await expect(page.locator(selector)).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true");
  await exposed(page, page.locator("[data-nav] a").first());
}

for (const [width, height] of narrow) {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    test.describe(`R1 ${width}x${height} ${reducedMotion}`, () => {
      test.use({ viewport: { width, height }, reducedMotion });
      test("forward sequential focus exits disclosure without occlusion", async ({ page }) => {
        await openByKeyboard(page);
        for (let i = 1; i < 5; i++) {
          await page.keyboard.press("Tab");
          await exposed(page, page.locator("[data-nav] a").nth(i));
        }
        await page.keyboard.press("Tab");
        await exposed(page, page.locator("[data-toggle]"));
        await page.keyboard.press("Tab");
        await exposed(page, page.locator(".hero__cta"));
        await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("[data-nav]")).toHaveAttribute("inert", "");
        await page.keyboard.press("Shift+Tab");
        await exposed(page, page.locator("[data-toggle]"));
      });
      test("reverse sequential focus exits disclosure and preserves destination", async ({ page }) => {
        await openByKeyboard(page);
        for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
        await exposed(page, page.locator("[data-toggle]"));
        for (let i = 4; i >= 0; i--) {
          await page.keyboard.press("Shift+Tab");
          await exposed(page, page.locator("[data-nav] a").nth(i));
        }
        await page.keyboard.press("Shift+Tab");
        await exposed(page, page.locator(".bar__brand"));
        await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Shift+Tab");
        await exposed(page, page.locator(".skip"));
        await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("[data-nav]")).toHaveAttribute("inert", "");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await exposed(page, page.locator("[data-toggle]"));
      });
    });
  }
}

for (const [width, height] of [[1440, 900], [768, 1024], [859, 1024], [860, 1024], [861, 1024], [390, 844], [320, 740]]) {
  test.describe(`R1 day ${width}`, () => {
    test.use({ viewport: { width, height }, reducedMotion: "reduce" });
    test("every active action is readable beside the selector at the day anchor", async ({ page }, info) => {
      await page.goto("/#day");
      await page.evaluate(() => document.fonts.ready);
      const measurements = [];
      for (const moment of moments) {
        await page.locator(`#tab-${moment}`).click();
        await page.evaluate(() => document.getElementById("day").scrollIntoView({ block: "start", behavior: "instant" }));
        const panel = page.locator(`#moment-${moment}`);
        const action = panel.locator(".moment__part--do");
        await expect(action).toBeVisible();
        const geometry = await action.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const tabs = document.querySelector("[data-day-list]").getBoundingClientRect();
          const header = document.querySelector("[data-bar]").getBoundingClientRect();
          const art = el.closest("article").querySelector(".moment__art");
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return { action: rect.toJSON(), tabs: tabs.toJSON(), headerBottom: header.bottom,
            height: innerHeight, unobscured: el.contains(hit),
            beforeArt: Boolean(el.compareDocumentPosition(art) & Node.DOCUMENT_POSITION_FOLLOWING) };
        });
        measurements.push({ moment, ...geometry });
        expect(geometry.action.top).toBeGreaterThanOrEqual(geometry.headerBottom);
        expect(geometry.action.bottom).toBeLessThanOrEqual(height);
        expect(geometry.tabs.top).toBeGreaterThanOrEqual(geometry.headerBottom);
        expect(geometry.tabs.bottom).toBeLessThanOrEqual(height);
        expect(geometry.unobscured).toBe(true);
        expect(geometry.beforeArt, "source order follows visible action → artwork").toBe(true);
        await expect(panel.locator(".moment__part--do")).toHaveCount(1);
        await expect(page.locator("#day .lede")).toContainText("See how Energia AI responds throughout the day.");
        await page.locator(`#tab-${moment}`).focus();
        await page.keyboard.press("Tab");
        await expect(panel).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(page.locator(`#tab-${moment}`)).toBeFocused();
      }
      await info.attach("day-anchor-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
    });
  });
}

test("R1 disclosure resets across 860/861 and still closes on outside click", async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 1024 });
  await openByKeyboard(page);
  await page.setViewportSize({ width: 861, height: 1024 });
  await expect(page.locator("[data-toggle]")).toBeHidden();
  await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-nav]")).not.toHaveAttribute("inert", "");
  await expect(page.locator("[data-nav] a").first()).toBeFocused();
  await expect(page.locator("[data-day-list]")).toHaveAttribute("aria-orientation", "vertical");
  await page.setViewportSize({ width: 860, height: 1024 });
  await expect(page.locator("[data-nav]")).toHaveAttribute("inert", "");
  await expect(page.locator("[data-day-list]")).toHaveAttribute("aria-orientation", "horizontal");
  await page.locator("[data-toggle]").click();
  await page.locator(".hero__art").click();
  await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
});

test("R1 metadata qualifies design intent and the plan explains its core", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /designed to/);
  await expect(page.locator(".plan figcaption")).toContainText("dark area is the building core");
});
