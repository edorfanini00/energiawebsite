// Behaviour, layout and render checks for the Energia AI landing preview
// (direction A). These prove gates and behaviour; they do not judge taste.
// Run: npm test            (checks only)
//      npm run shots       (checks + screenshots into SHOT_DIR)
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const MAIL = "edo.orfanini@energiaigroup.com";
const CTA_HREF = `mailto:${MAIL}?subject=Energia%20AI%3A%20our%20building`;
const LINKEDIN = "https://www.linkedin.com/company/energia-ai/";
const SHOTS = process.env.SHOTS === "1";
const SHOT_DIR = process.env.SHOT_DIR || "test-results/shots";
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

// kind: which type gates apply (the brief sets desktop and phone ranges).
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, phone: false, kind: "desktop" },
  { name: "tablet-768", width: 768, height: 1024, phone: true, kind: "tablet" },
  { name: "phone-390", width: 390, height: 844, phone: true, kind: "phone" },
  { name: "phone-375", width: 375, height: 812, phone: true, kind: "phone" },
];
const TYPE = {
  desktop: { h1: [52, 60], h2: [36, 44], h3: [23, 25], body: [17, 18] },
  tablet: { h1: [30, 46], h2: [26, 36], h3: [22, 25], body: [16, 18] },
  phone: { h1: [28, 34], h2: [26, 30], h3: [22, 23], body: [16, 16] },
};

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

// Worst contrast between each text box's colour and every rendered pixel
// under it. The text is made transparent for the capture, so only the image
// (or background) behind the glyph boxes is sampled.
async function worstPixelContrast(page, browser, selector) {
  const boxes = await page.evaluate((selector) => {
    const out = [];
    for (const el of document.querySelectorAll(selector)) {
      // The closed phone menu is invisible; its links are not on screen.
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rgb = getComputedStyle(el).color.match(/\d+/g).slice(0, 3).map(Number);
      for (const r of range.getClientRects()) {
        if (r.bottom > 0 && r.top < innerHeight) out.push({ x: r.x, y: r.y, w: r.width, h: r.height, rgb });
      }
      el.style.color = "transparent";
      el.style.textDecorationColor = "transparent";
    }
    document.querySelectorAll(".arrow").forEach((a) => (a.style.visibility = "hidden"));
    return out;
  }, selector);
  const png = await page.screenshot();
  await page.evaluate(() => {
    document.querySelectorAll("[style]").forEach((el) => {
      el.style.color = "";
      el.style.textDecorationColor = "";
      el.style.visibility = "";
    });
  });
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
    return { worst: +worst.toFixed(2), boxes: boxes.length };
  }, { b64: png.toString("base64"), boxes });
  await ctx.close();
  return worst;
}

for (const vp of viewports) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("loads cleanly: no errors, fonts, images, no overflow", async ({ page }) => {
      const problems = watch(page);
      await page.goto("/");
      await settle(page);

      const fonts = await page.evaluate(() => ({
        r300: document.fonts.check('300 56px "Satoshi"'),
        r400: document.fonts.check('400 18px "Satoshi"'),
        r700: document.fonts.check('700 40px "Satoshi"'),
        loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.weight),
      }));
      expect(fonts.r300 && fonts.r400 && fonts.r700, JSON.stringify(fonts)).toBe(true);
      expect(fonts.loaded).toEqual(expect.arrayContaining(["300", "400", "700"]));

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

    test("art: hero render for this viewport, a different render in the first feature", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const art = await page.evaluate(() => ({
        hero: document.querySelector(".hero__art img").currentSrc,
        feature: document.querySelector(".feature__art img").currentSrc,
        all: [...document.querySelectorAll("main img")].map((i) => i.currentSrc),
      }));
      const narrow = vp.width <= 700;
      expect(art.hero).toMatch(narrow ? /\/assets\/img\/hero-phone-\d+\.(avif|webp)$/ : /\/assets\/img\/hero-desktop-\d+\.(avif|webp)$/);
      expect(art.feature).toMatch(narrow ? /\/assets\/img\/feature-phone-\d+\.(avif|webp)$/ : /\/assets\/img\/feature-desktop-\d+\.(avif|webp)$/);
      // The hero render is never repeated later on the page.
      expect(art.all.filter((src) => /hero-/.test(src))).toHaveLength(1);
    });

    test("type gates: restrained light display type and one scale", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const t = await page.evaluate(() => {
        const read = (el) => {
          const cs = getComputedStyle(el);
          const size = parseFloat(cs.fontSize);
          const lh = parseFloat(cs.lineHeight);
          return {
            text: el.textContent.trim().slice(0, 40),
            size, weight: cs.fontWeight, ratio: lh / size,
            tracking: parseFloat(cs.letterSpacing) / size,
            lines: Math.round(el.getBoundingClientRect().height / lh),
            family: cs.fontFamily,
          };
        };
        return {
          h1: read(document.querySelector("h1")),
          h2: [...document.querySelectorAll("h2.title")].map(read),
          h3: [...document.querySelectorAll(".step h3")].map(read),
          body: [...document.querySelectorAll(".lede")].map(read),
        };
      });
      const g = TYPE[vp.kind];
      const within = (v, [lo, hi], what) => {
        expect(v, what).toBeGreaterThanOrEqual(lo - 0.01);
        expect(v, what).toBeLessThanOrEqual(hi + 0.01);
      };
      expect(t.h1.family).toMatch(/^"?Satoshi/);
      expect(t.h1.weight).toBe("300");
      within(t.h1.size, g.h1, "h1 size");
      within(t.h1.ratio, [1.08, 1.12], "h1 line height");
      expect(Math.abs(t.h1.tracking + 0.02)).toBeLessThan(0.006);
      within(t.h1.lines, [2, 3], "h1 lines");
      expect(t.h2.length).toBe(4);
      for (const h of t.h2) {
        expect(h.weight, h.text).toBe("300");
        within(h.size, g.h2, `h2 ${h.text}`);
        within(h.lines, [1, 3], `h2 lines ${h.text}`);
      }
      for (const h of t.h3) within(h.size, g.h3, `h3 ${h.text}`);
      for (const b of t.body) within(b.size, g.body, `body ${b.text}`);
    });

    test("one hero idea: short copy, no eyebrows, one visible CTA", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const hero = await page.evaluate(() => {
        const top = document.querySelector("#top");
        const shown = (el) => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.bottom <= innerHeight && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        };
        return {
          words: [...top.querySelectorAll("p")].map((p) => p.innerText.split(/\s+/).length),
          ctas: [...document.querySelectorAll(".bar__cta, .hero__cta, .button")].filter(shown).map((a) => ({
            cls: a.className, href: a.getAttribute("href"), h: a.getBoundingClientRect().height,
            bg: getComputedStyle(a).backgroundColor,
          })),
          eyebrows: document.querySelectorAll(".eyebrow, .pill, .chip, .badge, .stat").length,
        };
      });
      for (const n of hero.words) expect(n).toBeLessThanOrEqual(8);
      expect(hero.eyebrows).toBe(0);
      expect(hero.ctas, JSON.stringify(hero.ctas)).toHaveLength(1);
      expect(hero.ctas[0].href).toBe(CTA_HREF);
      expect(hero.ctas[0].h).toBeGreaterThanOrEqual(44);
      if (vp.phone) {
        // Phone header is wordmark and Menu only; the CTA is quiet ink text in the sky.
        expect(hero.ctas[0].cls).toBe("hero__cta");
        expect(hero.ctas[0].bg).toBe("rgba(0, 0, 0, 0)");
      } else {
        expect(hero.ctas[0].cls).toBe("bar__cta");
      }
    });

    test("hero text contrast against the rendered image", async ({ page, browser }) => {
      await page.goto("/");
      await settle(page);
      await page.waitForTimeout(600);
      // Large display type needs 3:1; the 15 to 18px text needs 4.5:1.
      const h1 = await worstPixelContrast(page, browser, "#top h1");
      expect(h1.boxes).toBeGreaterThan(0);
      expect(h1.worst).toBeGreaterThanOrEqual(3);
      const small = await worstPixelContrast(page, browser, ".hero__line, .hero__cta, .bar__nav a:not(.bar__cta), .bar__toggle-label");
      expect(small.boxes).toBeGreaterThan(0);
      expect(small.worst).toBeGreaterThanOrEqual(4.5);
    });

    test("text on solid sections meets contrast", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const fails = await page.evaluate(() => {
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const rgb = (s) => s.match(/[\d.]+/g).map(Number);
        const bgOf = (el) => {
          for (let n = el; n; n = n.parentElement) {
            const c = rgb(getComputedStyle(n).backgroundColor);
            if (c.length < 4 || c[3] > 0) return c.slice(0, 3);
          }
          return [255, 255, 255];
        };
        const out = [];
        const sel = "main section:not(#top) :is(h2, h3, p, dt, dd, li, summary, a, figcaption), .foot :is(p, a)";
        for (const el of document.querySelectorAll(sel)) {
          if (!el.textContent.trim()) continue;
          const cs = getComputedStyle(el);
          const fg = lum(rgb(cs.color)), bg = lum(bgOf(el));
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
          if (ratio < (large ? 3 : 4.5)) out.push(`${el.tagName} "${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
        }
        return out;
      });
      expect(fails).toEqual([]);
    });

    test("links resolve and the CTAs are real mailtos", async ({ page, request }) => {
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
      const ctas = page.locator(".bar__cta, .hero__cta, .button");
      expect(await ctas.count()).toBe(3);
      for (const href of await ctas.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
        expect(href).toBe(CTA_HREF);
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

    test("copy avoids unsupported claims and customer-facing dashes", async ({ page }) => {
      await page.goto("/");
      const text = await page.evaluate(() => document.body.innerText + " " + document.title + " " + document.querySelector('meta[name="description"]').content);
      for (const banned of [/\b\d{1,3}\s?%/, /patent/i, /guarantee(d|s)? (savings|results)/i, /\b(save|saves|saving|cut|cuts|reduce|reduces) (up to|over|as much|\d|you|your (bills?|costs?))/i, /revolution/i, /unlock/i, /seamless/i, /testimonial/i, /trusted by/i, /no hardware/i, /tenant billing/i, /carbon credit/i, /forecasts weather/i, /deployed (in|at|across)/i, /[–—]/]) {
        expect(text, String(banned)).not.toMatch(banned);
      }
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
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
        await expect(page.locator(".bar__cta")).toBeHidden();

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(nav.locator("a").first()).toBeVisible();
        await expect(nav.locator("a").first()).toBeFocused();
        await expect(nav).not.toHaveAttribute("inert", "");
        // The conversion is reachable inside the menu.
        await expect(page.locator(".bar__cta")).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();
        await expect(nav.locator("a").first()).toBeHidden();

        // Collapsed menu is out of the tab order: skip, brand, toggle, then the hero CTA.
        await page.reload();
        const order = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Tab");
          order.push(await page.evaluate(() => {
            const el = document.activeElement;
            return el.closest("[data-nav]") ? "nav" : el.matches("[data-toggle]") ? "toggle" : el.className || el.tagName;
          }));
        }
        expect(order.slice(0, 4), order.join(",")).toEqual(["skip", "bar__brand", "toggle", "hero__cta"]);
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
      test("desktop nav is visible and the menu toggle is hidden", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-toggle]")).toBeHidden();
        await expect(page.locator("[data-nav] a")).toHaveCount(4);
        for (const a of await page.locator("[data-nav] a").all()) await expect(a).toBeVisible();
        await expect(page.locator("[data-nav]")).not.toHaveAttribute("inert", "");
        await expect(page.locator(".hero__cta")).toBeHidden();
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
        [...document.querySelectorAll("[data-reveal], h1, h2, .hero__line")]
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
        const hidden = [...document.querySelectorAll("[data-reveal], h1, .hero__line, .hero__art img")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
          .map((el) => el.className || el.tagName);
        return { hidden, smooth: getComputedStyle(document.documentElement).scrollBehavior };
      });
      expect(state.hidden).toEqual([]);
      expect(state.smooth).toBe("auto");
      expect(problems).toEqual([]);
      await ctx.close();
    });

    if (SHOTS) {
      test("screenshots for critique", async ({ page }) => {
        await page.goto("/");
        await settle(page);
        await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-hero.png` });
        if (vp.phone) {
          await page.locator("[data-toggle]").click();
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-menu.png` });
        }
      });
    }
  });
}
