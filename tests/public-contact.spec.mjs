import { test, expect } from "@playwright/test";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

const pages = ["/", "/privacy", "/hvac-optimization", "/hvac-optimization-pilot", "/hvac-optimization-companies"];
const privateAddress = /edo\.orfanini@energiaigroup\.com|mailto:/i;

test("built public files contain no personal address or mail link, including display assets", async () => {
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else expect((await readFile(path)).toString("utf8"), path).not.toMatch(privateAddress);
    }
  }
  await scan("dist");
});

for (const width of [1440, 390, 320]) {
  test(`public contact and privacy at ${width}: no personal email and usable form route`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const path of pages) {
      await page.goto(path);
      expect(await page.content()).not.toMatch(privateAddress);
      expect(await page.locator("body").innerText()).not.toMatch(privateAddress);
    }
    await page.goto("/privacy");
    await expect(page.locator("#choices + p")).toContainText("Privacy request");
    await page.getByRole("link", { name: "inquiry form", exact: true }).click();
    await expect(page.locator("#inquiry-name")).toBeFocused();
    await expect(page.locator("#inquiry-name")).toBeInViewport();
    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page.locator("#inquiry-name")).toBeFocused();
    await page.locator(".foot__links").getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page.locator("#inquiry-name")).toBeFocused();
    if (process.env.BUYER_SCREENSHOTS) {
      await mkdir(process.env.BUYER_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.BUYER_SCREENSHOTS, `contact-${width}.png`) });
      await page.goto("/privacy");
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(process.env.BUYER_SCREENSHOTS, `privacy-${width}.png`), fullPage: true });
    }
  });
}
