// Behaviour, layout and render checks for the Energia AI landing preview
// (V3, "one building, one day"). These prove gates and behaviour; they do not
// judge taste.
// Run: npm test            (checks only)
//      npm run shots       (checks + screenshots into SHOT_DIR)
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";

const MAIL = "edo.orfanini@energiaigroup.com";
const CTA_HREF = `mailto:${MAIL}?subject=Energia%20AI%3A%20our%20building`;
const LINKEDIN = "https://www.linkedin.com/company/energia-ai/";
const SHOTS = process.env.SHOTS === "1";
const SHOT_DIR = process.env.SHOT_DIR || "test-results/shots";
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

// kind: which type gates apply. Ledes are 17 to 18px. Secondary text (steps,
// the day's moments, limits, start steps and FAQ answers) is a deliberate 16px
// at every width.
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, phone: false, kind: "desktop" },
  { name: "tablet-768", width: 768, height: 1024, phone: true, kind: "tablet" },
  { name: "phone-390", width: 390, height: 844, phone: true, kind: "phone" },
  { name: "phone-375", width: 375, height: 812, phone: true, kind: "phone" },
  { name: "narrow-320", width: 320, height: 740, phone: true, kind: "phone" },
  { name: "landscape-844", width: 844, height: 390, phone: true, kind: "tablet" },
];
const TYPE = {
  desktop: { h1: [56, 60], h1Lines: [2, 3], h2: [42, 44], h3: [21.5, 22], lede: [17, 18], secondary: [16, 16] },
  tablet: { h1: [38, 46], h1Lines: [2, 3], h2: [30, 36], h3: [20, 21], lede: [17, 18], secondary: [16, 16] },
  phone: { h1: [34, 34], h1Lines: [2, 4], h2: [30, 30], h3: [20, 20], lede: [17, 17.5], secondary: [16, 16] },
};
const MOMENTS = ["dawn", "morning", "afternoon", "dusk"];

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
// Explicit instant scrolling prevents rectangle/screenshot drift during pixel probes.
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.6);
    // Bounded: at most 40 steps even if the page grows while scrolling.
    for (let y = 0, n = 0; y <= document.documentElement.scrollHeight && n < 40; y += step, n++) {
      window.scrollTo({ top: y, behavior: "instant" });
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
    window.scrollTo({ top: 0, behavior: "instant" });
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
    return { worst, boxes: boxes.length };
  }, { b64: png.toString("base64"), boxes });
  await ctx.close();
  return worst;
}


// Records layout shifts without recent input, with the shifted nodes.
const SHIFT_INIT = () => {
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__shifts.push({ v: e.value, t: Math.round(e.startTime), nodes: (e.sources || []).map((s) => (s.node && ((s.node.getAttribute && s.node.getAttribute("class")) || s.node.nodeName)) || "?").slice(0, 4) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const shiftTotal = (page) => page.evaluate(() => window.__shifts.reduce((a, s) => a + s.v, 0));

// Layout facts that must not change between first paint and the enhanced page.
const headerState = (page) => page.evaluate(() => {
  const vis = (el) => el && el.getBoundingClientRect().height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const toggle = document.querySelector("[data-toggle]");
  const cta = document.querySelector(".hero__cta");
  const c = cta.getBoundingClientRect();
  return {
    h1Top: Math.round(document.querySelector("h1").getBoundingClientRect().top),
    barBottom: Math.round(document.querySelector(".bar").getBoundingClientRect().bottom),
    navLinksVisible: [...document.querySelectorAll("[data-nav] a")].filter(vis).length,
    toggleVisible: vis(toggle),
    toggleDisabled: toggle.disabled,
    ctaVisible: vis(cta),
    ctaHit: vis(cta) ? document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)?.closest(".hero__cta") === cta : null,
    html: document.documentElement.className,
  };
});

// Every visible header control against every hero copy element: any
// rectangle intersection larger than 1px² is reported. Also checks the bar
// ends above the headline.
async function overlaps(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { el: `${el.tagName}.${el.className}`.slice(0, 40), x: r.left, y: r.top, r: r.right, b: r.bottom };
    };
    const header = [...document.querySelectorAll(".bar a, .bar button, .bar img")].filter(vis).map(rect);
    const hero = [...document.querySelectorAll("#top h1, #top p, #top a")].filter(vis).map(rect);
    const list = [];
    for (const a of header) {
      for (const b of hero) {
        const w = Math.min(a.r, b.r) - Math.max(a.x, b.x);
        const h = Math.min(a.b, b.b) - Math.max(a.y, b.y);
        if (w > 1 && h > 1) list.push(`${a.el} over ${b.el} (${Math.round(w)}x${Math.round(h)})`);
      }
    }
    const barBottom = Math.max(...header.map((r) => r.b));
    const h1Top = document.querySelector("#top h1").getBoundingClientRect().top;
    if (barBottom > h1Top + 0.5) list.push(`bar bottom ${Math.round(barBottom)} below h1 top ${Math.round(h1Top)}`);
    return { list, rects: { header, hero } };
  });
}

// For the focused element: read its focus outline, hide it, screenshot, and
// measure the outline colour against every pixel in the band the outline
// occupies. Returns null when nothing visible is focused.
// `probe` is one reusable page (from its own context) that decodes the
// screenshots, so a test does not open a browser context per focus stop.
async function ringContrast(page, probe) {
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || !el.matches(":focus-visible")) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) return null;
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === "none") return { el: `${el.tagName}.${el.className}`, none: true };
    const out = {
      el: `${el.tagName}.${el.className}`,
      rgb: cs.outlineColor.match(/[\d.]+/g).slice(0, 3).map(Number),
      off: parseFloat(cs.outlineOffset), w: parseFloat(cs.outlineWidth),
      x: r.left, y: r.top, r: r.right, b: r.bottom,
    };
    el.style.outlineColor = "transparent";
    return out;
  });
  if (!ring) return null;
  if (ring.none) return { el: ring.el, worst: 0 };
  const png = await page.screenshot();
  await page.evaluate(() => { if (document.activeElement) document.activeElement.style.outlineColor = ""; });
  const worst = await probe.evaluate(async ({ b64, ring }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const fg = lum(...ring.rgb);
    const inner = ring.off + 0.5, outer = ring.off + ring.w - 0.5;
    let worst = Infinity;
    let samples = 0;
    const x0 = Math.max(0, Math.floor(ring.x - outer)), x1 = Math.min(c.width - 1, Math.ceil(ring.r + outer));
    const y0 = Math.max(0, Math.floor(ring.y - outer)), y1 = Math.min(c.height - 1, Math.ceil(ring.b + outer));
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Signed distance from the element box (negative inside, for inset
        // outlines); the outline band lies between inner and outer.
        const px = x + 0.5, py = y + 0.5;
        const inside = px > ring.x && px < ring.r && py > ring.y && py < ring.b;
        const dist = inside
          ? -Math.min(px - ring.x, ring.r - px, py - ring.y, ring.b - py)
          : Math.max(Math.max(ring.x - px, 0, px - ring.r), Math.max(ring.y - py, 0, py - ring.b));
        if (dist < inner || dist > outer) continue;
        const i = (y * c.width + x) * 4;
        const bg = lum(d[i], d[i + 1], d[i + 2]);
        worst = Math.min(worst, (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05));
        samples++;
      }
    }
    // No sampled pixels means the band was mis-measured: report it as a failure.
    return samples > 20 ? worst : 0;
  }, { b64: png.toString("base64"), ring });
  return { el: ring.el, worst };
}

// Script contract: exactly one tiny synchronous same-origin bootstrap in
// <head> before the stylesheet (so the header state is set before first
// paint), then the deferred main.js. No inline script or handler
// attributes, and the CSP allows same-origin scripts only.
test("scripts: synchronous boot.js before CSS, deferred main.js, no inline; CSP self only", async () => {
  const { readFileSync, statSync } = await import("node:fs");
  const html = readFileSync("index.html", "utf8");
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1].trim(), body: m[2].trim() }));
  expect(tags.map((t) => t.attrs)).toEqual(['src="boot.js"', 'src="main.js" defer']);
  for (const t of tags) expect(t.body).toBe("");
  expect(html.indexOf('src="boot.js"')).toBeLessThan(html.indexOf('rel="stylesheet"'));
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  const boot = readFileSync("boot.js", "utf8");
  expect(statSync("boot.js").size).toBeLessThan(1500);
  expect(boot).not.toMatch(/\beval\b|new Function|document\.write|innerHTML/);
  const csp = JSON.parse(readFileSync("vercel.json", "utf8")).headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
  expect(csp).toMatch(/script-src 'self';/);
  expect(csp).not.toMatch(/sha256-|unsafe-inline|unsafe-eval/);
});

// The local preview server is tooling, not the deployed site. It must answer
// a malformed percent-escape with an error status and keep serving.
test("local server survives a malformed URI", async () => {
  const port = 4390 + Math.floor(Math.random() * 100);
  const child = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (b) => (log += b));
  child.stderr.on("data", (b) => (log += b));
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`server did not start: ${log}`)), 5000);
      child.stdout.on("data", () => { if (log.includes("Serving")) { clearTimeout(t); resolve(); } });
    });
    const get = (path) => new Promise((resolve) => {
      const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET" }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on("error", (e) => resolve(`error ${e.code}`));
      req.end();
    });
    const bad = await get("/%E0%A4%A");
    await new Promise((r) => setTimeout(r, 300));
    expect(child.exitCode, log).toBeNull();
    expect([400, 404]).toContain(bad);
    expect(await get("/")).toBe(200);
    expect(await get("/%2e%2e/package.json")).toBe(404);
    expect(await get("/package.json")).toBe(404);
  } finally {
    // Stop only the server this test started.
    if (child.exitCode === null) child.kill("SIGTERM");
  }
});

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

    test("art: own render per viewport for the hero, the day and the plan; nothing repeated", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const art = await page.evaluate(() => ({
        hero: document.querySelector(".hero__art img").currentSrc,
        day: [...document.querySelectorAll("[data-moment]")].map((m) => ({ id: m.id, hidden: m.hidden, src: m.querySelector("img").currentSrc })),
        plan: document.querySelector(".plan img").currentSrc,
        all: [...document.querySelectorAll("main img")].map((i) => i.currentSrc).filter(Boolean),
      }));
      const narrow = vp.width <= 700;
      expect(art.hero).toMatch(narrow ? /\/assets\/img\/hero-phone-\d+\.(avif|webp)$/ : /\/assets\/img\/hero-desktop-\d+\.(avif|webp)$/);
      expect(art.plan).toMatch(narrow ? /\/assets\/img\/plan-phone-\d+\.(avif|webp)$/ : /\/assets\/img\/plan-desktop-\d+\.(avif|webp)$/);
      // The selected moment (15:30) shows its own render, in the portrait cut on narrow screens.
      const shown = art.day.filter((m) => !m.hidden);
      expect(shown.map((m) => m.id)).toEqual(["moment-afternoon"]);
      expect(shown[0].src).toMatch(vp.width <= 860 ? /day-afternoon-phone-\d+\.(avif|webp)$/ : /day-afternoon-desktop-\d+\.(avif|webp)$/);
      // Each loaded render appears once: the hero is not reused in the day or the plan.
      expect(art.all.filter((src) => /hero-/.test(src))).toHaveLength(1);
      expect(new Set(art.all).size).toBe(art.all.length);
    });

    test("type gates: light display type, 18/16 lede, 16px secondary text", async ({ page }) => {
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
          h3: [...document.querySelectorAll(".benefits dt, .step h3, .start__steps h3, .moment:not([hidden]) .moment__title")].map(read),
          lede: [...document.querySelectorAll(".lede")].map(read),
          secondary: [...document.querySelectorAll(".benefits dd, .step p, .ledger dd, .faq__item p, .moment__part p, .start__steps p")].map(read),
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
      within(t.h1.ratio, [1.02, 1.06], "h1 line height");
      expect(Math.abs(t.h1.tracking + 0.03)).toBeLessThan(0.006);
      within(t.h1.lines, g.h1Lines, "h1 lines");
      expect(t.h2.length).toBe(4);
      for (const h of t.h2) {
        expect(h.weight, h.text).toBe("300");
        within(h.size, g.h2, `h2 ${h.text}`);
        within(h.lines, [1, 3], `h2 lines ${h.text}`);
      }
      for (const h of t.h3) within(h.size, g.h3, `h3 ${h.text}`);
      expect(t.h3.length).toBe(10);
      expect(t.lede.length).toBe(5);
      for (const b of t.lede) within(b.size, g.lede, `lede ${b.text}`);
      expect(t.secondary.length).toBe(27);
      for (const b of t.secondary) within(b.size, g.secondary, `secondary ${b.text}`);
    });

    test("one hero idea: headline plus one sentence pair, no eyebrows, one visible CTA", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const hero = await page.evaluate(() => {
        const top = document.querySelector("#top");
        const shown = (el) => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.bottom <= innerHeight && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        };
        return {
          h1Words: top.querySelector("h1").innerText.split(/\s+/).length,
          paragraphs: top.querySelectorAll("p").length,
          words: [...top.querySelectorAll("p")].map((p) => p.innerText.split(/\s+/).length),
          ctas: [...document.querySelectorAll(".bar__cta, .hero__cta, .button")].filter(shown).map((a) => ({
            cls: a.className, href: a.getAttribute("href"), h: a.getBoundingClientRect().height,
            bg: getComputedStyle(a).backgroundColor,
          })),
          eyebrows: document.querySelectorAll(".eyebrow, .pill, .chip, .badge, .stat").length,
        };
      });
      expect(hero.h1Words).toBeLessThanOrEqual(8);
      expect(hero.paragraphs).toBe(1);
      for (const n of hero.words) expect(n).toBeLessThanOrEqual(32);
      expect(hero.eyebrows).toBe(0);
      expect(hero.ctas, JSON.stringify(hero.ctas)).toHaveLength(1);
      expect(hero.ctas[0].href).toBe(CTA_HREF);
      expect(hero.ctas[0].h).toBeGreaterThanOrEqual(44);
      if (vp.phone) {
        // Phone header is wordmark and Menu only; the CTA is quiet ink text on paper.
        expect(hero.ctas[0].cls).toBe("hero__cta textlink");
        expect(hero.ctas[0].bg).toBe("rgba(0, 0, 0, 0)");
      } else {
        expect(hero.ctas[0].cls).toBe("bar__cta");
      }
    });

    test("hero text contrast against the actual rendered background", async ({ page, browser }) => {
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
        const sel = "main section:not(#top) :is(h2, h3, h4, p, dt, dd, li, summary, a, figcaption, button .t, button .l, .plan__label), .foot :is(p, a)";
        for (const el of document.querySelectorAll(sel)) {
          if (!el.textContent.trim() || !el.checkVisibility()) continue;
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
      const item = page.locator(".faq__item").filter({ has: page.locator("summary", { hasText: "What data do you need?" }) });
      const summary = item.locator("summary");
      await summary.focus();
      await expect(item).not.toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(item).toHaveAttribute("open", "");
      await expect(item.locator("p")).toBeVisible();
      await expect(item.locator("p")).toContainText("trend history");
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
      // Precise wording (review fix): fixed schedules vary by day of week, so
      // the page says what they do not do rather than "treat every day the same".
      expect(text).not.toMatch(/treat every day the same/i);
      expect(text).toContain("A fixed schedule does not adjust when the weather or occupancy changes.");
      // Keep substantive results qualifications and useful product copy; omit image meta-copy.
      expect(text).toContain("Simulation results are not a guarantee of savings in your building.");
      expect(text).toContain("Energia AI plans for both, hour by hour.");
      expect(text).not.toMatch(/illustrati(?:ve|on)|fictional|renderings?|rendered|\bdemo\b|\bconcept\b|simulated visual|sample imagery|not readings from a real site|not a client installation/i);
      expect(text).not.toMatch(/\b\d+(\.\d+)?\s?(°|deg|kwh|kw\b|ppm)/i);
    });

    // The day: four illustrative moments as WAI-ARIA tabs on a day line.
    test("day tabs: roles, selection, arrows, Home/End and Tab into the panel", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const tabs = page.locator("[data-day-list] [role=tab]");
      await expect(page.locator("[data-day-list]")).toHaveAttribute("role", "tablist");
      await expect(page.locator("[data-day-list]")).toHaveAttribute("aria-label", "Times of day");
      await expect(tabs).toHaveCount(4);
      const state = () => page.evaluate(() => ({
        selected: [...document.querySelectorAll("[role=tab]")].filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.id),
        tabindex: [...document.querySelectorAll("[role=tab]")].map((t) => t.tabIndex),
        shown: [...document.querySelectorAll("[role=tabpanel]")].filter((p) => !p.hidden && p.checkVisibility()).map((p) => p.id),
        at: document.querySelector("[data-dayline]").style.getPropertyValue("--at"),
        focus: document.activeElement.id,
      }));
      // Each tab controls its own panel; each panel is labelled by its tab.
      for (const [i, m] of MOMENTS.entries()) {
        await expect(tabs.nth(i)).toHaveAttribute("aria-controls", `moment-${m}`);
        await expect(page.locator(`#moment-${m}`)).toHaveAttribute("aria-labelledby", `tab-${m}`);
      }
      expect(await state()).toMatchObject({ selected: ["tab-afternoon"], tabindex: [-1, -1, 0, -1], shown: ["moment-afternoon"], at: "0.656" });

      await expect(page.locator("[role=tablist]")).toHaveAttribute("aria-orientation", vp.phone ? "horizontal" : "vertical");
      await tabs.nth(2).focus();
      await page.keyboard.press("ArrowRight");
      expect(await state()).toMatchObject({ selected: ["tab-dusk"], shown: ["moment-dusk"], focus: "tab-dusk", at: "0.906" });
      await page.keyboard.press("ArrowRight");   // wraps to the first moment
      expect(await state()).toMatchObject({ selected: ["tab-dawn"], shown: ["moment-dawn"], focus: "tab-dawn" });
      await page.keyboard.press("ArrowLeft");    // wraps back to the last
      expect(await state()).toMatchObject({ selected: ["tab-dusk"], focus: "tab-dusk" });
      await page.keyboard.press("Home");
      expect(await state()).toMatchObject({ selected: ["tab-dawn"], tabindex: [0, -1, -1, -1] });
      await page.keyboard.press("End");
      expect(await state()).toMatchObject({ selected: ["tab-dusk"], tabindex: [-1, -1, -1, 0] });
      await page.keyboard.press("ArrowDown");
      expect(await state()).toMatchObject({ selected: ["tab-dawn"] });
      await page.keyboard.press("ArrowRight");

      // Tab leaves the tab row for the selected panel, which carries its content.
      await page.keyboard.press("Tab");
      expect((await state()).focus).toBe("moment-morning");
      await expect(page.locator("#moment-morning")).toBeFocused();
      await expect(page.locator("#moment-morning")).toContainText("Floors fill up");
      await expect(page.locator("#moment-morning")).toContainText("What Energia AI does");
      // Shift+Tab returns to the selected tab, not to a hidden one.
      await page.keyboard.press("Shift+Tab");
      expect((await state()).focus).toBe("tab-morning");
    });

    test("day tabs: pointer and touch select a moment and load its render", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.phone, isMobile: vp.phone, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const problems = watch(page);
      await page.goto("/");
      await page.locator("#day").scrollIntoViewIfNeeded();
      const seen = [];
      for (const m of ["dawn", "dusk", "morning", "afternoon"]) {
        const tab = page.locator(`#tab-${m}`);
        if (vp.phone) await tab.tap(); else await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(page.locator(`#moment-${m}`)).toBeVisible();
        await expect(page.locator("[data-moment]:visible")).toHaveCount(1);
        const img = page.locator(`#moment-${m} img`);
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0), { timeout: 10000 }).toBe(true);
        seen.push(await img.evaluate((i) => i.currentSrc.split("/").pop()));
      }
      // Four different renders, all of this viewport's cut.
      expect(new Set(seen).size, seen.join(",")).toBe(4);
      for (const src of seen) expect(src).toMatch(vp.width <= 860 ? /-phone-\d+\.(avif|webp)$/ : /-desktop-\d+\.(avif|webp)$/);
      // Targets on the day line stay large enough to tap.
      for (const box of await page.locator("[role=tab]").evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().toJSON()))) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      expect(problems).toEqual([]);
      await ctx.close();
    });

    test("plan: zone outlines and labels sit on this viewport's render", async ({ page }) => {
      await page.goto("/");
      await page.locator("#model").scrollIntoViewIfNeeded();
      await settle(page);
      const plan = await page.evaluate(() => {
        const frame = document.querySelector(".plan__frame").getBoundingClientRect();
        const img = document.querySelector(".plan img");
        const svg = [...document.querySelectorAll(".plan__zones")].filter((s) => s.checkVisibility());
        const labels = [...document.querySelectorAll(".plan__label")].filter((l) => l.checkVisibility()).map((l) => {
          const r = l.getBoundingClientRect();
          return { text: l.textContent, inside: r.left >= frame.left - 1 && r.right <= frame.right + 1 && r.top >= frame.top - 1 && r.bottom <= frame.bottom + 1 };
        });
        const ir = img.getBoundingClientRect();
        return {
          svg: svg.map((s) => s.getAttribute("class")), labels,
          aspect: +(frame.width / frame.height).toFixed(3), natural: +(img.naturalWidth / img.naturalHeight).toFixed(3),
          fills: Math.abs(ir.width - frame.width) < 1 && Math.abs(ir.height - frame.height) < 1,
        };
      });
      expect(plan.svg).toEqual([vp.width <= 700 ? "plan__zones plan__zones--phone" : "plan__zones plan__zones--desktop"]);
      expect(plan.labels.map((l) => l.text)).toEqual(["West zone", "Corner", "South zone", "Interior"]);
      for (const l of plan.labels) expect(l.inside, l.text).toBe(true);
      // The overlay is drawn in plan metres, so the frame must keep the render's exact aspect (no crop).
      expect(Math.abs(plan.aspect - plan.natural)).toBeLessThan(0.01);
      expect(plan.fills).toBe(true);
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
        expect(order.slice(0, 4), order.join(",")).toEqual(["skip", "bar__brand", "toggle", "hero__cta textlink"]);
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
        await expect(page.locator("[data-nav] a")).toHaveCount(5);
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
      // Every moment of the day is on the page in order, with no inert tab controls.
      const day = await page.evaluate(() => ({
        shown: [...document.querySelectorAll("[data-moment]")].filter((m) => m.checkVisibility()).map((m) => m.id),
        tabsShown: document.querySelector(".day__tabs").checkVisibility(),
        roles: document.querySelectorAll("[role=tab], [role=tabpanel]").length,
      }));
      expect(day).toEqual({ shown: ["moment-dawn", "moment-morning", "moment-afternoon", "moment-dusk"], tabsShown: false, roles: 0 });
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



    // Fix round 2 regressions: first paint and late or failed scripts.

    test("first paint with main.js delayed shows the final header, no shift", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.addInitScript(SHIFT_INIT);
      let release;
      const held = new Promise((r) => (release = r));
      await page.route("**/main.js", async (route) => { await held; await route.continue(); });
      await page.goto("/", { waitUntil: "commit" });
      // HTML parsed and CSS applied, deferred main.js still held back.
      await page.waitForFunction(() => document.readyState === "interactive" && document.querySelector("h1"));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const early = await headerState(page);
      if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.name}-early-mainjs-pending.png` });
      release();
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
      const late = await headerState(page);
      const shifts = await page.evaluate(() => window.__shifts);
      expect(early.h1Top, JSON.stringify({ early, late })).toBe(late.h1Top);
      expect(early.barBottom).toBe(late.barBottom);
      expect(shifts.reduce((a, s) => a + s.v, 0), JSON.stringify(shifts)).toBeLessThan(0.1);
      if (vp.phone) {
        expect(early.navLinksVisible, "no fallback menu at first paint").toBe(0);
        expect(early.toggleVisible).toBe(true);
        // Not clickable before its handler exists; enabled once main.js runs.
        expect(early.toggleDisabled).toBe(true);
        expect(late.toggleDisabled).toBe(false);
        // The hero contact link works while main.js is pending.
        expect(early.ctaVisible && early.ctaHit).toBe(true);
        await page.locator("[data-toggle]").click();
        await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true");
      } else {
        expect(early.navLinksVisible).toBe(5);
      }
      await ctx.close();
    });

    test("cold loads: layout shift stays under 0.1", async ({ browser }) => {
      const values = [];
      for (let i = 0; i < 5; i++) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.addInitScript(SHIFT_INIT);
        await page.goto("/", { waitUntil: "load" });
        await page.waitForTimeout(400);
        values.push(+(await shiftTotal(page)).toFixed(3));
        await ctx.close();
      }
      test.info().annotations.push({ type: "cls", description: values.join(",") });
      expect(Math.max(...values), values.join(",")).toBeLessThan(0.1);
    });

    test("boot.js blocked: static fallback stays, no late enhancement", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.addInitScript(SHIFT_INIT);
      await page.route("**/boot.js", (route) => route.abort());
      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(500);
      const state = await headerState(page);
      expect(state.html).not.toMatch(/\bjs\b/);
      expect(state.navLinksVisible).toBe(5);
      expect(state.toggleVisible).toBe(false);
      expect((await overlaps(page)).list).toEqual([]);
      expect(await shiftTotal(page)).toBeLessThan(0.1);
      await ctx.close();
    });

    test("main.js throwing during setup restores the fallback", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.route("**/main.js", (route) => route.fulfill({ contentType: "text/javascript", body: 'throw new Error("simulated main.js failure");' }));
      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(400);
      const state = await headerState(page);
      expect(state.html).not.toMatch(/\bjs\b/);
      expect(state.navLinksVisible).toBe(5);
      expect(state.toggleVisible).toBe(false);
      expect((await overlaps(page)).list).toEqual([]);
      const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length);
      expect(hidden).toBe(0);
      await ctx.close();
    });

    // Fix round 1 regressions. Each one failed on 42fd9e1.

    test("no-JS: header and hero content never overlap", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.waitForTimeout(500);
      const hits = await overlaps(page);
      expect(hits.rects.header.length, "header controls measured").toBeGreaterThan(1);
      expect(hits.list, JSON.stringify(hits.list)).toEqual([]);
      // The fallback nav and the contact action stay reachable.
      for (const a of await page.locator("[data-nav] a").all()) await expect(a).toBeVisible();
      await ctx.close();
    });

    test("main.js blocked: content visible, navigation usable, no overlap", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.route("**/main.js", (route) => route.abort());
      await page.goto("/");
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => ({
        hidden: [...document.querySelectorAll("[data-reveal], h1, h2, .hero__line")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).map((el) => el.className || el.tagName),
        enhanced: document.documentElement.className,
      }));
      expect(state.hidden).toEqual([]);
      for (const a of await page.locator("[data-nav] a").all()) await expect(a).toBeVisible();
      await expect(page.locator("[data-toggle]")).toBeHidden();
      await expect(page.locator("[data-moment]:visible")).toHaveCount(4);
      await expect(page.locator(".day__tabs")).toBeHidden();
      await page.locator("[data-moment] img").evaluateAll(imgs =>
        Promise.all(imgs.map(img => { img.loading = "eager"; return img.decode(); }))
      );
      for (const moment of MOMENTS) {
        await expect(page.locator(`#moment-${moment} .moment__part--do`)).toBeVisible();
        await expect(page.locator(`#moment-${moment} img`)).toBeVisible();
      }
      const hits = await overlaps(page);
      expect(hits.list, JSON.stringify(hits.list)).toEqual([]);
      await ctx.close();
    });

    test("print: content below the fold is visible without scrolling", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(400);
      await page.emulateMedia({ media: "print" });
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal]")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
          .map((el) => el.className || el.tagName)
      );
      expect(hidden).toEqual([]);
      // With the tabs wired, print still shows all four moments and no tab row.
      await expect(page.locator("[data-moment]:visible")).toHaveCount(4);
      await expect(page.locator(".day__tabs")).toBeHidden();
      await expect(page.locator("[data-toggle]")).toBeHidden();
      await page.locator("[data-moment] img").evaluateAll(imgs =>
        Promise.all(imgs.map(img => { img.loading = "eager"; return img.decode(); }))
      );
      for (const moment of MOMENTS) {
        await expect(page.locator(`#moment-${moment} .moment__part--do`)).toBeVisible();
        await expect(page.locator(`#moment-${moment} img`)).toBeVisible();
      }
    });

    test("focus rings reach 3:1 against the pixels around them", async ({ page, browser }) => {
      // Instant scrolling, so a focused control is on screen when sampled.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await settle(page);
      const probeCtx = await browser.newContext();
      const probe = await probeCtx.newPage();
      const results = [];
      const measureStops = async (label, stops) => {
        for (let i = 0; i < stops; i++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(80);
          const r = await ringContrast(page, probe);
          if (r) results.push({ ...r, label });
        }
      };
      // From the top: skip link, then the bar and hero on paper, then on
      // through the sections (the bar turns white once the page scrolls).
      await measureStops("page", 22);
      if (vp.phone) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.locator("[data-toggle]").click();
        await page.waitForTimeout(400);
        await measureStops("open menu", 4);
      }
      const failing = results.filter((r) => r.worst < 3);
      expect(failing, JSON.stringify(failing)).toEqual([]);
      const names = results.map((r) => r.el).join(" | ");
      expect(names).toContain("skip");
      expect(names).toContain("bar__brand");
      expect(names).toMatch(vp.phone ? /bar__toggle/ : /bar__cta/);
      if (vp.phone) expect(names).toContain("hero__cta");
      expect(names).toContain("button");
      expect(names).toContain("dayline__tab");
      expect(names).toContain("ARTICLE.moment");
      expect(names).toContain("SUMMARY");
      expect(names).toContain("contact__mail");

      // Sampler control: a pale ring on paper must measure under 3:1.
      // Keep a deliberately failing control after removing sky-backed text.
      if (vp.phone) await page.keyboard.press("Escape");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.focus(".bar__brand");
      await page.evaluate(() => document.querySelector(".bar__brand").style.setProperty("outline-color", "#dddddd", "important"));
      const control = await ringContrast(page, probe);
      expect(control, "control ring measured").not.toBeNull();
      expect(control.worst, JSON.stringify(control)).toBeLessThan(3);
      await probeCtx.close();
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
