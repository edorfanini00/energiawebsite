import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://predictivehvaccontrol.com";
const pages = [["/", "index.html"], ["/privacy", "privacy.html"], ["/hvac-optimization", "hvac-optimization.html"]];

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const [path, file] of pages) {
    test(`${file} at ${viewport.width}: built identity, CSP, image and readable layout`, async ({ page, request }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(() => {
        window.__seoCsp = [];
        document.addEventListener("securitypolicyviolation", e => window.__seoCsp.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
      });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toBe(await readFile(join("dist", file), "utf8"));
      expect(html).not.toMatch(/https:\/\/(?:www\.energiaigroup\.com|commercialhvacoptimization\.com|[^/]*vercel\.app)/);
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", SITE + path);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", SITE + path);
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Energia AI");
      const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
      expect(await page.locator('script[type="application/ld+json"]').textContent()).toBe(block);
      const graph = JSON.parse(block);
      expect(graph["@context"]).toBe("https://schema.org");
      expect(graph["@graph"].map(n => n["@type"])).toEqual(["Organization", "WebSite", "WebPage"]);
      expect(graph["@graph"][0]).toMatchObject({ name: "Energia AI", url: SITE + "/" });
      expect(graph["@graph"][1]).toMatchObject({ name: "Energia AI", url: SITE + "/", publisher: { "@id": SITE + "/#organization" } });
      expect(graph["@graph"][2]).toMatchObject({ url: SITE + path, name: await page.title(), description: await page.locator('meta[name="description"]').getAttribute("content") });
      expect(block).not.toMatch(/rating|price|review|sameAs|dateModified|datePublished|SearchAction/);
      const hash = "'sha256-" + createHash("sha256").update(block).digest("base64") + "'";
      const csp = response.headers()["content-security-policy"];
      expect(csp.match(/'sha256-[^']+'/g)).toEqual([hash]);
      expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
      expect(csp).toContain("form-action 'self'");
      if (path === "/hvac-optimization") expect(csp).not.toContain("facebook");
      const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(imageUrl.startsWith(SITE + "/assets/")).toBe(true);
      const image = await request.get(new URL(imageUrl).pathname);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/webp");
      expect(await page.evaluate(async src => {
        const img = new Image(); img.src = src; await img.decode(); return img.naturalWidth > 0 && img.naturalHeight > 0;
      }, new URL(imageUrl).pathname)).toBe(true);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(img => { img.loading = "eager"; return img.decode(); }));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => window.__seoCsp)).toEqual([]);
      // An exact data hash must not authorize a new executable inline script.
      await page.evaluate(() => {
        const script = document.createElement("script"); script.textContent = "window.__unapprovedInline = true"; document.head.append(script);
      });
      await expect.poll(() => page.evaluate(() => window.__seoCsp.some(e => e.blocked === "inline"))).toBe(true);
      expect(await page.evaluate(() => window.__unapprovedInline)).toBeUndefined();
      if (process.env.SEO_SCREENSHOTS) {
        await mkdir(process.env.SEO_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: join(process.env.SEO_SCREENSHOTS, `${file.replace(".html", "")}-${viewport.width}.png`), fullPage: true });
      }
      if (path === "/hvac-optimization") {
        expect(await page.locator("main").innerText()).not.toMatch(/[-–—]/);
        await page.getByRole("link", { name: "Discuss a pilot", exact: true }).click();
        await expect(page).toHaveURL(/\/#contact$/);
        await expect(page.locator("#contact-title")).toBeInViewport();
        if (viewport.width < 700) {
          await page.locator("[data-toggle]").click();
          await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true");
        }
        await page.locator(".bar__cta").click();
        await expect(page.locator("#inquiry-name")).toBeFocused();
        if (viewport.width < 700) await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
      }
    });
  }

  for (const javaScriptEnabled of [true, false]) {
    test(`FAQ at ${viewport.width}, JS ${javaScriptEnabled}: raw answers, retained DOM and sequential focus`, async ({ browser, baseURL, request }) => {
      const context = await browser.newContext({ viewport, javaScriptEnabled, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        const raw = await (await request.get("/")).text();
        await page.goto(baseURL + "/");
        if (javaScriptEnabled) await expect(page.locator("html")).toHaveAttribute("data-menu-ready", "");
        const items = page.locator(".faq__item");
        await expect(items).toHaveCount(5);
        for (const item of await items.all()) {
          const answer = await item.locator("p").textContent();
          expect(raw).toContain(answer);
          await expect(item.locator("p")).toBeAttached();
          await expect(item.locator("p")).toBeHidden();
        }
        const first = items.first();
        // Test real native disclosure behavior with a focusable descendant.
        // This is local test DOM only, not duplicate or hidden production text.
        await first.locator("p").evaluate(p => {
          const a = document.createElement("a"); a.href = "/hvac-optimization"; a.textContent = "Test guide link"; p.append(a);
        });
        await first.locator("summary").focus();
        await page.keyboard.press("Tab");
        await expect(items.nth(1).locator("summary")).toBeFocused();
        await first.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(first.locator("p")).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(first.locator("p a")).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Enter");
        await expect(first.locator("p")).toBeHidden();
        await expect(first.locator("p")).toBeAttached();
        await page.keyboard.press("Tab");
        await expect(items.nth(1).locator("summary")).toBeFocused();
        await page.getByRole("link", { name: "Read the HVAC optimization guide" }).click();
        await expect(page).toHaveURL(/\/hvac-optimization$/);
        await page.getByRole("link", { name: "Energia AI, home" }).click();
        await expect(page.locator("#hero-title")).toHaveText("Lower HVAC operating costs. Keep your team in control.");
      } finally { await context.close(); }
    });
  }
}

test("built sitemap, public allowlist and private exclusions stay coherent", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])).toEqual(pages.map(([path]) => SITE + path));
  expect(sitemap).not.toContain("lastmod");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toBe(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  const admin = await request.get("/admin");
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  expect(await admin.text()).toContain('content="noindex, nofollow, noarchive"');
  expect(await admin.text()).not.toContain('rel="canonical"');
  for (const path of ["/SEO-RELEASE.md", "/server/config.js", "/scripts/validate-jsonld.mjs", "/tests/seo.spec.mjs", "/.env"]) expect((await request.get(path)).status()).toBe(404);
});
