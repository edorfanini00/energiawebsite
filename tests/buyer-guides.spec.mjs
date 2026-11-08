import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const guides = ["/hvac-optimization-pilot", "/hvac-optimization-companies"];
const sources = {
  "/hvac-optimization-pilot": [
    "https://www.energy.gov/cmei/femp/measurement-and-verification-options-federal-energy-and-water-saving-projects",
    "https://www.ashb.com/wp-content/uploads/2025/12/Survey-Executive-Summary.pdf",
    "https://www.jll.com/content/dam/legacy/jll-com/documents/pdf/research/global/25-insights-global-state-of-facilities-management-report.pdf",
  ],
  "/hvac-optimization-companies": [
    "https://brainboxai.com/en/solutions/ai-control",
    "https://r8tech.io/solutions/",
    "https://www.siemens.com/en-us/products/building-x/applications/comfort-ai/",
    "https://www.75f.io/smart-building-automation",
    "https://www.jll.com/en-us/client-stories/lasalle-investment-management-supercharges-building-efficiency-with-innovative-ai-solution",
    "https://coppertreeanalytics.com/kaizen-aso/",
    "https://www.energy.gov/cmei/femp/measurement-and-verification-options-federal-energy-and-water-saving-projects",
  ],
};

for (const width of [1440, 390, 320]) {
  for (const path of guides) {
    test(`${path} at ${width}: complete readable guide, sources, keyboard navigation and contact`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
      });
      await expect(page.locator("h1")).toHaveCount(1);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/[-–—]|Editorial handoff|Customer facing draft|Publish only|Proposed path|unpublished draft/);
      expect(text.split(/\s+/).length).toBeGreaterThan(1400);
      await expect(page.locator('script[src]')).toHaveCount(1);
      await expect(page.locator('script[src]')).toHaveAttribute('src', '/contact-links.js');
      expect(await page.locator('main a[href^="https:"]').evaluateAll(links => links.map(a => a.href))).toEqual(sources[path]);
      // Check the actual text boxes throughout the page, not just the viewport top.
      expect(await page.locator("main :is(p, li, h1, h2, h3)").evaluateAll(elements => elements.filter(el => {
        const box = el.getBoundingClientRect();
        return box.left < 0 || box.right > innerWidth || el.scrollWidth > el.clientWidth + 1;
      }).map(el => el.textContent))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const localLinks = await page.locator('main a[href^="/"]').evaluateAll(links => [...new Set(links.map(a => a.getAttribute("href").split("#")[0]))]);
      for (const href of localLinks) expect((await request.get(href)).status()).toBe(200);
      if (path.endsWith("pilot")) {
        await expect(page.locator("#use-a-written-decision-record + p")).toContainText("Copy these prompts");
        await expect(page.locator('[aria-labelledby="use-a-written-decision-record"] p strong')).toHaveCount(10);
        expect(text).toContain("cost and quote for an Energia AI pilot depend");
        expect(text).toContain("not a claim that every listed control or service is implemented");
        for (const outcome of ["Proceed:", "Revise:", "Stop:"]) expect(text).toContain(outcome);
      } else {
        await expect(page.locator("main h3")).toHaveCount(6);
        expect(text).toContain("vendor authored buying guide, not an independent ranking");
        expect(text).toContain("We have not tested these products against one another");
        expect(text).toContain("not evidence of savings in an occupied building");
      }
      if (process.env.BUYER_SCREENSHOTS) {
        await mkdir(process.env.BUYER_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: join(process.env.BUYER_SCREENSHOTS, `${path.slice(1)}-${width}.png`), fullPage: true });
        await page.screenshot({ path: join(process.env.BUYER_SCREENSHOTS, `${path.slice(1)}-${width}-top.png`) });
      }
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
      const contents = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
      for (const link of await contents.all()) {
        const href = await link.getAttribute("href");
        await link.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(href)).toBeFocused();
        await expect(page.locator(href)).toBeInViewport();
      }
      // A cross-page anchor must focus the real form on arrival, without a second click.
      await page.locator('main a[data-contact-source]').click();
      await expect(page).toHaveURL(/\/\?source_path=%2F[^#]*#contact$/);
      await expect(page.locator("#inquiry-name")).toBeFocused();
      await expect(page.locator("#inquiry-name")).toBeInViewport();
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-email")).toBeFocused();
    });
  }
}

for (const path of guides) {
  test(`${path}: static navigation works without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(baseURL + path);
      const link = page.getByRole("navigation", { name: "On this page" }).getByRole("link").last();
      const href = await link.getAttribute("href");
      await link.click();
      await expect(page.locator(href)).toBeInViewport();
      await page.locator('main a[data-contact-source]').click();
      await expect(page.locator(".contact__fallback")).toBeVisible();
      await expect(page.locator(".contact__fallback")).toContainText("reload this page to try again");
      await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    } finally { await context.close(); }
  });
}

test("home and overview link to both resources, with a return route between them", async ({ page }) => {
  for (const entry of ["/", "/hvac-optimization"]) {
    for (const path of guides) {
      await page.goto(entry);
      await page.locator(`a[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(path + "$"));
      const other = guides.find(candidate => candidate !== path);
      await page.locator(`a[href="${other}"]`).click();
      await expect(page).toHaveURL(new RegExp(other + "$"));
      await page.getByRole("link", { name: "Energia AI, home" }).click();
      await expect(page.locator("#hero-title")).toBeVisible();
    }
  }
});
