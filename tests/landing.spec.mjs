// Behaviour, layout and render checks for the Energia AI landing preview.
// Run: npm test            (checks only)
//      npm run shots       (checks + screenshots into SHOT_DIR)
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const MAIL = "edo.orfanini@energiaigroup.com";
const LINKEDIN = "https://www.linkedin.com/company/energia-ai/";
const SHOTS = process.env.SHOTS === "1";
const SHOT_DIR = process.env.SHOT_DIR || "test-results/shots";
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, phone: false },
  { name: "tablet-768", width: 768, height: 1024, phone: true },
  { name: "phone-390", width: 390, height: 844, phone: true },
  { name: "phone-375", width: 375, height: 812, phone: true },
];

// Collect console errors, page errors, failed or off-origin requests.
function watch(page) {
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on("response", (res) => {
    if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
  });
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname !== "127.0.0.1") problems.push(`off-origin request: ${req.url()}`);
  });
  return problems;
}

// Scroll through the page so lazy images load and reveals fire.
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.6);
    // Bounded: at most 40 steps even if the page grows while scrolling.
    for (let y = 0, n = 0; y <= document.documentElement.scrollHeight && n < 40; y += step, n++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    await new Promise((r) => setTimeout(r, 300));
    await document.fonts.ready;
    const loaded = (img) =>
      img.complete ? null : new Promise((r) => {
        img.addEventListener("load", r, { once: true });
        img.addEventListener("error", r, { once: true });
        setTimeout(r, 8000);
      });
    await Promise.all([...document.images].map(loaded));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
}

for (const vp of viewports) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("loads cleanly: no errors, fonts, images, no overflow", async ({ page }) => {
      const problems = watch(page);
      await page.goto("/");
      await settle(page);

      const fonts = await page.evaluate(() => ({
        r400: document.fonts.check('400 18px "Satoshi"'),
        r500: document.fonts.check('500 18px "Satoshi"'),
        loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.weight),
      }));
      expect(fonts.r400 && fonts.r500, JSON.stringify(fonts)).toBe(true);
      expect(fonts.loaded).toEqual(expect.arrayContaining(["400", "500"]));

      const broken = await page.evaluate(() =>
        [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src)
      );
      expect(broken).toEqual([]);

      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > vw + 1 || r.left < -1);
          })
          .map((el) => `${el.tagName}.${el.className}`);
        return { scroll: document.documentElement.scrollWidth, vw, wide: wide.slice(0, 10) };
      });
      expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.vw);
      expect(overflow.wide, JSON.stringify(overflow)).toEqual([]);

      expect(problems).toEqual([]);
    });

    test("links resolve and the CTA is a real mailto", async ({ page, request }) => {
      await page.goto("/");
      const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      expect(links.length).toBeGreaterThan(5);
      for (const href of links) {
        if (href.startsWith("#")) {
          const id = href.slice(1);
          expect(await page.locator(`[id="${id}"]`).count(), `anchor ${href}`).toBe(1);
        } else if (href.startsWith("mailto:")) {
          expect(href.split("?")[0]).toBe(`mailto:${MAIL}`);
        } else {
          expect(href, "only the published LinkedIn page is external").toBe(LINKEDIN);
        }
      }
      const ctas = page.locator("a.button");
      expect(await ctas.count()).toBeGreaterThanOrEqual(2);
      for (const href of await ctas.evaluateAll((as) => as.map((a) => a.href))) {
        expect(href).toBe(`mailto:${MAIL}?subject=Energia%20AI%3A%20our%20building`);
      }
      await expect(page.locator("form")).toHaveCount(0);

      // Every local asset referenced by the markup is served.
      const assets = await page.evaluate(() => {
        const urls = new Set();
        document.querySelectorAll("img[src], link[href]").forEach((el) => urls.add(el.getAttribute("src") || el.getAttribute("href")));
        document.querySelectorAll("source[srcset]").forEach((el) =>
          el.getAttribute("srcset").split(",").forEach((part) => urls.add(part.trim().split(" ")[0]))
        );
        return [...urls].filter((u) => !/^(https?:|mailto:|#)/.test(u));
      });
      for (const url of assets) {
        const res = await request.get(`/${url}`);
        expect(res.status(), url).toBe(200);
      }
    });

    test("interactive targets are at least 44px and focus is visible", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      if (vp.phone) await page.locator("[data-toggle]").click();
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("a, button, summary")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 0 && cs.visibility !== "hidden" && !el.classList.contains("skip");
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el: `${el.tagName} ${el.textContent.trim().slice(0, 30)}`, w: Math.round(r.width), h: Math.round(r.height) };
          })
          .filter((t) => t.w < 44 || t.h < 44)
      );
      expect(small).toEqual([]);
      // Start the keyboard check from a fresh load so focus begins at the document.
      await page.reload();

      // Tab from the top: skip link first, then a visible outline on the next control.
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip")).toBeFocused();
      await page.keyboard.press("Tab");
      const ring = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return { tag: document.activeElement.tagName, style: cs.outlineStyle, width: cs.outlineWidth };
      });
      expect(ring.style).not.toBe("none");
      expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
    });

    test("FAQ opens and closes from the keyboard", async ({ page }) => {
      await page.goto("/");
      const item = page.locator(".faq__item").nth(2);
      const summary = item.locator("summary");
      await summary.focus();
      await expect(item).not.toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(item).toHaveAttribute("open", "");
      await expect(item.locator("p")).toBeVisible();
      await expect(item.locator("p")).toContainText("not a guarantee of savings");
      await page.keyboard.press("Space");
      await expect(item).not.toHaveAttribute("open", "");
    });

    if (vp.phone) {
      test("phone menu: toggle, Escape, focus return, link closes", async ({ page }) => {
        await page.goto("/");
        const toggle = page.locator("[data-toggle]");
        const nav = page.locator("[data-nav]");
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(nav).toHaveAttribute("inert", "");
        await expect(nav.locator("a").first()).toBeHidden();

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(nav.locator("a").first()).toBeVisible();
        await expect(nav.locator("a").first()).toBeFocused();
        await expect(nav).not.toHaveAttribute("inert", "");

        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();
        await expect(nav.locator("a").first()).toBeHidden();

        // Collapsed menu is out of the tab order: skip, brand, then the toggle.
        await page.reload();
        const order = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Tab");
          order.push(await page.evaluate(() => {
            const el = document.activeElement;
            return el.closest("[data-nav]") ? "nav" : el.matches("[data-toggle]") ? "toggle" : el.className || el.tagName;
          }));
        }
        expect(order.slice(0, 3), order.join(",")).toEqual(["skip", "bar__brand", "toggle"]);
        expect(order, order.join(",")).not.toContain("nav");

        // Keyboard open moves focus into the menu.
        await toggle.focus();
        await page.keyboard.press("Enter");
        await expect(nav.locator("a").first()).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(toggle).toBeFocused();

        await toggle.click();
        await nav.getByRole("link", { name: "Questions" }).click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(page).toHaveURL(/#questions$/);
      });
    } else {
      test("copy avoids unsupported claims and customer-facing dashes", async ({ page }) => {
        await page.goto("/");
        const text = await page.evaluate(() => document.body.innerText + " " + document.title + " " + document.querySelector('meta[name="description"]').content);
        for (const banned of [/\b\d{1,3}\s?%/, /patent/i, /guarantee(d|s)? (savings|results)/i, /revolution/i, /unlock/i, /seamless/i, /testimonial/i, /no hardware/i, /tenant billing/i, /carbon credit/i, /forecasts weather/i, /[\u2013\u2014]/]) {
          expect(text, String(banned)).not.toMatch(banned);
        }
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      });

      test("desktop nav is visible and the menu toggle is hidden", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-toggle]")).toBeHidden();
        await expect(page.locator("[data-nav] a")).toHaveCount(4);
        for (const a of await page.locator("[data-nav] a").all()) await expect(a).toBeVisible();
        await expect(page.locator("[data-nav]")).not.toHaveAttribute("inert", "");
      });
    }

    test("navigation and content work without JavaScript", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.waitForTimeout(1500);
      for (const a of await page.locator("[data-nav] a").all()) await expect(a).toBeVisible();
      await expect(page.locator("[data-toggle]")).toBeHidden();
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal], h1, h2, .hero__lede")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length
      );
      expect(hidden).toBe(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await ctx.close();
    });

    test("reduced motion shows all content without animation", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const problems = watch(page);
      await page.goto("/");
      await page.waitForTimeout(150);
      const state = await page.evaluate(() => {
        const hidden = [...document.querySelectorAll("[data-reveal], .hero__title span, .hero__lede, .hero__art img")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
          .map((el) => el.className || el.tagName);
        return { hidden, smooth: getComputedStyle(document.documentElement).scrollBehavior };
      });
      expect(state.hidden).toEqual([]);
      expect(state.smooth).toBe("auto");
      expect(problems).toEqual([]);
      await ctx.close();
    });

    test("hero text contrast against the rendered image", async ({ page, browser }) => {
      await page.goto("/");
      await settle(page);
      await page.waitForTimeout(1600);
      // Hide the text, keep its boxes, and sample the pixels underneath.
      const boxes = await page.evaluate(() => {
        const els = [...document.querySelectorAll(".hero__title span, .hero__lede")];
        const out = [];
        for (const el of els) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rgb = getComputedStyle(el).color.match(/\d+/g).slice(0, 3).map(Number);
          for (const r of range.getClientRects()) out.push({ x: r.x, y: r.y, w: r.width, h: r.height, rgb });
        }
        document.querySelectorAll(".hero__title, .hero__lede").forEach((el) => (el.style.color = "transparent"));
        return out;
      });
      const png = await page.screenshot();
      const ctx = await browser.newContext();
      const probe = await ctx.newPage();
      const worst = await probe.evaluate(async ({ b64, boxes }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        let worst = Infinity;
        for (const bx of boxes) {
          const fg = lum(...bx.rgb);
          const x = Math.max(0, Math.floor(bx.x)), y = Math.max(0, Math.floor(bx.y));
          const w = Math.min(c.width - x, Math.ceil(bx.w)), h = Math.min(c.height - y, Math.ceil(bx.h));
          if (w <= 0 || h <= 0) continue;
          const d = g.getImageData(x, y, w, h).data;
          for (let i = 0; i < d.length; i += 4) {
            const bg = lum(d[i], d[i + 1], d[i + 2]);
            worst = Math.min(worst, (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05));
          }
        }
        return worst;
      }, { b64: png.toString("base64"), boxes });
      await ctx.close();
      expect(boxes.length).toBeGreaterThan(3);
      expect(worst).toBeGreaterThanOrEqual(4.5);
    });

    if (SHOTS) {
      test("screenshots for critique", async ({ page }) => {
        await page.goto("/");
        await settle(page);
        await page.waitForTimeout(1600);
        await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-hero.png` });
        await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in")));
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-full.png`, fullPage: true });
        for (const id of ["building", "how", "limits", "contact"]) {
          await page.locator(`#${id}`).scrollIntoViewIfNeeded();
          await page.evaluate((id) => {
            const el = document.getElementById(id);
            window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 72);
          }, id);
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-section-${id}.png` });
        }
        if (vp.phone) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.locator("[data-toggle]").click();
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-menu.png` });
        }
      });
    }
  });
}
