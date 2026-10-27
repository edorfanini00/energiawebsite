// Capture and measure the landing page at the review viewports (V3).
// Each viewport gets a fresh page load (no resizing a loaded page), then a
// hero capture, one capture per section, a full-page capture and computed
// type and landmark metrics.
// Usage: node scripts/shots.mjs <out-dir> [base-url] [--hero-only]
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const out = process.argv[2] || "shots";
const heroOnly = process.argv.includes("--hero-only");
const base = process.argv[3] || "http://127.0.0.1:4173";
mkdirSync(out, { recursive: true });

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
process.on("SIGTERM", async () => { await browser.close(); process.exit(143); });
const routes = ["selected-b"];
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, scale: 1 },
  { name: "tablet-768", width: 768, height: 1024, scale: 2 },
  { name: "phone-390", width: 390, height: 844, scale: 2 },
  { name: "phone-375", width: 375, height: 812, scale: 2 },
  { name: "narrow-320", width: 320, height: 740, scale: 2 },
  { name: "landscape-844", width: 844, height: 390, scale: 2 },
];
const report = [];

for (const route of routes) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    const foreign = [];
    const failed = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => !r.url().startsWith(base) && !r.url().startsWith("data:") && foreign.push(r.url()));
    page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll(".hero__art img, .bar__brand img")].map((img) => img.decode()));
    });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const type = (sel) => {
        const el = document.querySelector(sel);
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        return {
          text: el.innerText,
          size: cs.fontSize,
          weight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          ratio: +(lh / parseFloat(cs.fontSize)).toFixed(3),
          letter: cs.letterSpacing,
          color: cs.color,
          lines: Math.round(el.getBoundingClientRect().height / lh),
          ...box(el),
        };
      };
      const hero = document.querySelector("#top");
      return {
        innerWidth, innerHeight,
        localLab: {
          domContentLoadedMs: Math.round(performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd),
          loadMs: Math.round(performance.getEntriesByType("navigation")[0].loadEventEnd),
          transferredBytesAtHeroCapture: performance.getEntriesByType("resource").reduce((sum, r) => sum + r.transferSize, 0),
        },
        fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
        satoshi300: document.fonts.check('300 56px "Satoshi"'),
        overflowX: document.documentElement.scrollWidth > innerWidth,
        hero: box(hero),
        h1: type("h1"),
        h2: type("h2"),
        body: type("#day .lede"),
        ctaAboveFold: [...document.querySelectorAll(".bar__cta, .hero__cta")].some((a) => {
          const r = a.getBoundingClientRect();
          return r.height > 0 && r.bottom <= innerHeight && getComputedStyle(a).visibility !== "hidden";
        }),
      };
    });

    const stem = vp.name;
    await page.screenshot({ path: join(out, `${stem}-hero.png`) });
    if (!heroOnly) {
      if (vp.width <= 860) {
        await page.locator("[data-toggle]").click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${stem}-menu.png`) });
        await page.keyboard.press("Escape");
      }
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) {
          scrollTo(0, y);
          await new Promise(resolve => setTimeout(resolve, 70));
        }
      });
      for (const id of ["day", "model", "limits", "start", "contact"]) {
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          window.scrollTo(0, el.getBoundingClientRect().top + scrollY);
        }, id);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(out, `${stem}-section-${id}.png`) });
      }
      // Each moment of the day, selected through its tab like a visitor would.
      for (const m of ["dawn", "morning", "afternoon", "dusk"]) {
        const tab = page.locator(`#tab-${m}`);
        if (!(await tab.isVisible())) throw new Error(`Missing day tab: ${m}`);
        await tab.click();
        await page.evaluate(() => window.scrollTo(0, document.getElementById("day").getBoundingClientRect().top + scrollY));
        await page.evaluate(() => Promise.all([...document.querySelectorAll("[data-moment]:not([hidden]) img")].map((i) => i.decode())));
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${stem}-day-${m}.png`) });
      }
      await page.locator("#tab-afternoon").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${stem}-full.png`), fullPage: true });
    }

    const unloaded = await page.locator("img").evaluateAll(imgs => imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.currentSrc));
    report.push({ route, viewport: vp.name, metrics, errors, foreign, failed, unloaded });
    await context.close();
  }
}
await browser.close();
writeFileSync(join(out, "measured-layout.json"), JSON.stringify(report, null, 2));
const sources = Object.fromEntries(["index.html", "styles.css", "main.js", "boot.js", "scripts/shots.mjs"].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
writeFileSync(join(out, "capture-source.json"), JSON.stringify({ capturedAt: new Date().toISOString(), base, reducedMotion: "reduce", network: "local loopback, no throttling", sources }, null, 2));
for (const r of report) {
  const m = r.metrics;
  console.log(`${r.route}/${r.viewport}: H1 ${m.h1.size}/${m.h1.weight} lh ${m.h1.ratio} ${m.h1.lines} lines at x${m.h1.x} y${m.h1.y} w${m.h1.w}; H2 ${m.h2.size}/${m.h2.weight} ${m.h2.lines} lines; body ${m.body.size}; satoshi300 ${m.satoshi300}; overflowX ${m.overflowX}; cta above fold ${m.ctaAboveFold}; errors ${r.errors.length}; foreign ${r.foreign.length}; failed ${r.failed.length}`);
  if (r.failed.length) console.log("   failed:", r.failed.join(", "));
}

if (report.some(r => r.errors.length || r.foreign.length || r.failed.length || r.unloaded.length || r.metrics.overflowX)) process.exitCode = 1;
