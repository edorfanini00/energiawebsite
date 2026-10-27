import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const evidence = process.env.COPY_EVIDENCE_DIR || "test-results/copy-correction";
const forbidden = /illustrati(?:ve|on)|fictional|renderings?|rendered|\bdemo\b|\bconcept\b|simulated visual|sample imagery|not readings from a real site|not a client installation/i;
const caption = "The dark area is the building core. Outlines divide the floor into zones. The fine grid represents the control volumes used to calculate heat flow.";
const actions = {
  dawn: "Starts each zone only as early as it needs to be ready when people arrive",
  morning: "Keeps occupied rooms comfortable inside your approved setpoint range",
  afternoon: "Began cooling the west rooms before the sun reached them",
  dusk: "Stops spending energy on empty rooms",
};

for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [375, 812], [320, 740]]) {
  test.describe(`copy correction ${width}`, () => {
    test.use({ viewport: { width, height } });
    test("useful copy, accessible content, compact layout and native captures", async ({ page }) => {
      mkdirSync(evidence, { recursive: true });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (["error", "warning"].includes(message.type())) errors.push(message.text());
      });
      page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
      page.on("response", response => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      await page.goto("/");
      // Paint the actual page and load lazy images without replacing any asset or CSS.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
          scrollTo({ top: y, behavior: "instant" });
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        await document.fonts.ready;
      });
      await expect(page.locator("#day .lede")).toContainText("Energia AI plans for both, hour by hour.");
      await expect(page.locator(".plan figcaption")).toHaveText(caption);
      await expect(page.locator(".day__caption, .foot__note")).toHaveCount(0);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /designed to/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.locator(".steps")).toContainText("across simulated weather and occupancy");
      await expect(page.locator("body")).toContainText("Simulation results are not a guarantee of savings in your building.");

      const captureSection = async (selector, filename) => {
        const section = page.locator(selector);
        await section.evaluate(el => el.scrollIntoView({ block: "start", behavior: "instant" }));
        // Let the real marker/reveal transitions finish and avoid centering a tall
        // section beneath the sticky header. No screenshot-only page styling.
        await expect.poll(() => section.evaluate(el =>
          el.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length
        )).toBe(0);
        // The tall day element capture can restart percentage-position marker
        // transitions in Chrome. Keep day captures at the real viewport size.
        if (selector === "#day") await page.screenshot({ path: join(evidence, filename) });
        else await section.screenshot({ path: join(evidence, filename) });
      };
      const snapshots = {};
      for (const [moment, action] of Object.entries(actions)) {
        await page.locator(`#tab-${moment}`).click();
        await expect(page.locator(`#tab-${moment}`)).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("[data-moment]:visible")).toHaveCount(1);
        await expect(page.locator(`#moment-${moment} .moment__part--do`)).toContainText(action);
        await expect.poll(() => page.locator(`#moment-${moment} img`).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
        const text = await page.locator("body").innerText();
        const aria = await page.locator("body").ariaSnapshot();
        const attributes = await page.locator("[alt], [aria-label], [title], [aria-description]").evaluateAll(elements =>
          elements.flatMap(el => ["alt", "aria-label", "title", "aria-description"].map(name => el.getAttribute(name) || "")).join("\n"));
        for (const content of [text, aria, attributes]) expect(content).not.toMatch(forbidden);
        snapshots[moment] = { text, aria, attributes };
        await captureSection("#day", `${width}-day-${moment}.png`);
      }
      await captureSection("#model", `${width}-plan.png`);
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await page.screenshot({ path: join(evidence, `${width}-footer-viewport.png`) });
      await page.locator(".foot").screenshot({ path: join(evidence, `${width}-footer.png`) });

      const geometry = await page.evaluate(() => {
        const day = document.querySelector("#day");
        const layout = document.querySelector(".day__layout");
        const grid = document.querySelector(".foot__grid");
        const rect = el => el.getBoundingClientRect().toJSON();
        const children = [...grid.children].map(rect);
        return {
          dayBottomSpace: rect(day).bottom - rect(layout).bottom,
          dayPadding: parseFloat(getComputedStyle(day).paddingBottom),
          footer: rect(grid), children,
          footerRows: getComputedStyle(grid).gridTemplateRows.split(" ").length,
          empty: [...document.querySelectorAll("#day p, .plan figcaption, .foot p")].filter(el => !el.textContent.trim()).length,
          overflow: [...document.querySelectorAll("body *")].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
          }).map(el => `${el.tagName}.${el.className}`),
          scrollWidth: document.documentElement.scrollWidth,
          brokenImages: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.currentSrc),
          fonts: [...document.fonts].filter(font => font.status === "loaded").map(font => font.weight),
        };
      });
      expect(Math.abs(geometry.dayBottomSpace - geometry.dayPadding)).toBeLessThan(1);
      expect(geometry.children).toHaveLength(3);
      expect(geometry.footerRows).toBe(width > 860 ? 1 : 3);
      expect(geometry.footer.bottom - Math.max(...geometry.children.map(rect => rect.bottom))).toBeLessThan(1);
      expect(geometry.empty).toBe(0);
      expect(geometry.overflow).toEqual([]);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
      expect(geometry.brokenImages).toEqual([]);
      expect(geometry.fonts).toEqual(expect.arrayContaining(["300", "400", "700"]));
      expect(errors).toEqual([]);
      writeFileSync(join(evidence, `${width}-evidence.json`), JSON.stringify({ viewport: { width, height }, snapshots, geometry, errors }, null, 2));
    });
  });
}
