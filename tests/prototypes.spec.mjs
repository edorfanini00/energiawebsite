// Checks for the direction prototypes A and C (hero + first feature only).
// These cover the measurable gates in the V2 visual brief and the behaviour
// carried over from the landing page. They do not judge taste.
// Run: npx playwright test tests/prototypes.spec.mjs
import { test, expect } from "@playwright/test";

const MAIL = "mailto:edo.orfanini@energiaigroup.com";
const routes = ["a", "c"];
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, phone: false },
  { name: "phone-390", width: 390, height: 844, phone: true },
];

function watch(page) {
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => problems.push(`requestfailed: ${req.url()}`));
  page.on("response", (res) => res.status() >= 400 && problems.push(`http ${res.status()}: ${res.url()}`));
  page.on("request", (req) => {
    if (new URL(req.url()).hostname !== "127.0.0.1") problems.push(`off-origin request: ${req.url()}`);
  });
  return problems;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll("img[loading=lazy]").forEach((img) => (img.loading = "eager"));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await page.waitForTimeout(300);
}

// Worst contrast between each text box's colour and every image pixel under it.
async function worstContrast(page, browser, selector) {
  const boxes = await page.evaluate((selector) => {
    const out = [];
    for (const el of document.querySelectorAll(selector)) {
      // The closed phone menu is invisible; its links are not on screen.
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rgb = getComputedStyle(el).color.match(/\d+/g).slice(0, 3).map(Number);
      for (const r of range.getClientRects()) out.push({ x: r.x, y: r.y, w: r.width, h: r.height, rgb });
      el.style.color = "transparent";
    }
    return out;
  }, selector);
  const png = await page.screenshot();
  await page.evaluate((selector) => document.querySelectorAll(selector).forEach((el) => (el.style.color = "")), selector);
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

for (const route of routes) {
  for (const vp of viewports) {
    test.describe(`${route} ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      const url = `/prototypes/${route}/`;

      test("loads cleanly with real Satoshi 300, art and no overflow", async ({ page }) => {
        const problems = watch(page);
        await page.goto(url);
        await settle(page);
        const state = await page.evaluate(() => ({
          loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.weight),
          broken: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
          heroArt: document.querySelector("#top picture img").currentSrc,
          overflow: document.documentElement.scrollWidth - innerWidth,
        }));
        expect(state.loaded).toEqual(expect.arrayContaining(["300", "400", "700"]));
        expect(state.broken).toEqual([]);
        expect(state.heroArt).toMatch(new RegExp(`/prototypes/img/${route}-(desktop|phone)-\\d+\\.(avif|webp)$`));
        expect(state.overflow).toBeLessThanOrEqual(0);
        expect(problems).toEqual([]);
      });

      test("type gates: restrained light H1 and sentence H2", async ({ page }) => {
        await page.goto(url);
        await settle(page);
        const t = await page.evaluate(() => {
          const read = (el) => {
            const cs = getComputedStyle(el);
            const size = parseFloat(cs.fontSize);
            const lh = parseFloat(cs.lineHeight);
            return {
              size, weight: cs.fontWeight, ratio: lh / size,
              tracking: parseFloat(cs.letterSpacing) / size,
              lines: Math.round(el.getBoundingClientRect().height / lh),
              family: cs.fontFamily,
            };
          };
          return { h1: read(document.querySelector("h1")), h2: read(document.querySelector("h2")) };
        });
        const [h1min, h1max] = vp.phone ? [28, 34] : [52, 60];
        const [h2min, h2max] = vp.phone ? [26, 30] : [36, 44];
        expect(t.h1.family).toMatch(/^"?Satoshi/);
        expect(t.h1.weight).toBe("300");
        expect(t.h1.size).toBeGreaterThanOrEqual(h1min);
        expect(t.h1.size).toBeLessThanOrEqual(h1max);
        expect(t.h1.ratio).toBeGreaterThanOrEqual(1.08);
        expect(t.h1.ratio).toBeLessThanOrEqual(1.12);
        expect(Math.abs(t.h1.tracking + 0.02)).toBeLessThan(0.006);
        expect(t.h1.lines).toBeGreaterThanOrEqual(2);
        expect(t.h1.lines).toBeLessThanOrEqual(3);
        expect(t.h2.weight).toBe("300");
        expect(t.h2.size).toBeGreaterThanOrEqual(h2min);
        expect(t.h2.size).toBeLessThanOrEqual(h2max);
      });

      test("one hero idea: no long paragraph and one CTA, above the fold", async ({ page }) => {
        await page.goto(url);
        await settle(page);
        const hero = await page.evaluate(() => {
          const top = document.querySelector("#top");
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.bottom <= innerHeight && getComputedStyle(el).visibility !== "hidden";
          };
          return {
            words: [...top.querySelectorAll("p")].map((p) => p.innerText.split(/\s+/).length),
            ctas: [...document.querySelectorAll("a.cta")].filter(visible).map((a) => ({
              href: a.getAttribute("href"), h: a.getBoundingClientRect().height,
            })),
            eyebrows: top.querySelectorAll("small, .eyebrow, .pill, .chip").length,
          };
        });
        for (const n of hero.words) expect(n).toBeLessThanOrEqual(24);
        expect(hero.eyebrows).toBe(0);
        expect(hero.ctas.length).toBe(1);
        expect(hero.ctas[0].href.startsWith(MAIL)).toBe(true);
        expect(hero.ctas[0].h).toBeGreaterThanOrEqual(44);
      });

      if (route === "c") {
        test("C keeps all hero text off the image", async ({ page }) => {
          await page.goto(url);
          await settle(page);
          const g = await page.evaluate(() => ({
            art: document.querySelector(".c-hero__art").getBoundingClientRect().bottom,
            band: document.querySelector(".c-hero__band").getBoundingClientRect().top,
            heroBottom: document.querySelector("#top").getBoundingClientRect().bottom,
          }));
          expect(g.band).toBeGreaterThanOrEqual(g.art - 0.5);
          expect(g.heroBottom).toBeLessThanOrEqual(vp.height + 0.5);
        });
      }

      test("hero text contrast against the delivered render pixels", async ({ page, browser }) => {
        await page.goto(url);
        await settle(page);
        // Large display type needs 3:1; 15–18px text needs 4.5:1.
        const h1 = await worstContrast(page, browser, "#top h1");
        expect(h1.boxes).toBeGreaterThan(0);
        expect(h1.worst).toBeGreaterThanOrEqual(3);
        const small = await worstContrast(page, browser, "#top p, .bar__nav a:not(.cta), .bar__toggle-label");
        expect(small.worst).toBeGreaterThanOrEqual(4.5);
      });

      if (vp.phone) {
        test("phone menu: toggle, Escape, focus return, inert when closed", async ({ page }) => {
          await page.goto(url);
          const toggle = page.locator("[data-toggle]");
          const nav = page.locator("[data-nav]");
          await expect(nav).toHaveAttribute("inert", "");
          await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "true");
          await expect(nav).not.toHaveAttribute("inert", "");
          await expect(nav.locator("a").first()).toBeFocused();
          await page.keyboard.press("Escape");
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await expect(toggle).toBeFocused();
          await expect(nav).toHaveAttribute("inert", "");
        });
      }

      test("reduced motion and no-JS keep content visible", async ({ browser }) => {
        for (const opts of [{ reducedMotion: "reduce" }, { javaScriptEnabled: false }]) {
          const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...opts });
          const page = await ctx.newPage();
          await page.goto(`http://127.0.0.1:${process.env.PORT || 4173}${url}`);
          await page.waitForTimeout(300);
          const hidden = await page.evaluate(() =>
            [...document.querySelectorAll("h1, h2, #building p, a.cta")].filter((el) => getComputedStyle(el).opacity !== "1").length
          );
          expect(hidden, JSON.stringify(opts)).toBe(0);
          await ctx.close();
        }
      });

      test("copy avoids figures, savings claims and dashes", async ({ page }) => {
        await page.goto(url);
        const text = await page.evaluate(() => document.body.innerText);
        expect(text).not.toMatch(/%|\bsav(e|es|ing|ings)\b|guarantee|deployed|customers|[–—]/i);
      });
    });
  }
}
