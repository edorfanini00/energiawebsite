// Capture and measure the direction prototypes at the reference viewports.
// Each viewport gets a fresh page load (no resizing a loaded page), then a
// hero capture, a first-feature capture and computed type/landmark metrics.
// Usage: node scripts/proto-shots.mjs <out-dir> [base-url]
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] || "proto-shots";
const base = process.argv[3] || "http://127.0.0.1:4173";
mkdirSync(out, { recursive: true });

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
const routes = ["a", "c"];
const viewports = [
  { name: "desktop", width: 1440, height: 900, scale: 1 },
  { name: "phone", width: 390, height: 844, scale: 2 },
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

    await page.goto(`${base}/prototypes/${route}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
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
        fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
        satoshi300: document.fonts.check('300 56px "Satoshi"'),
        overflowX: document.documentElement.scrollWidth > innerWidth,
        hero: box(hero),
        h1: type("h1"),
        h2: type("h2"),
        body: type("#building p"),
        ctaAboveFold: [...document.querySelectorAll("a.cta")].some((a) => {
          const r = a.getBoundingClientRect();
          return r.height > 0 && r.bottom <= innerHeight && getComputedStyle(a).visibility !== "hidden";
        }),
      };
    });

    const stem = `${route}-${vp.name}`;
    await page.screenshot({ path: join(out, `${stem}-hero.png`) });
    await page.evaluate(() => {
      const el = document.querySelector("#building");
      window.scrollTo(0, el.getBoundingClientRect().top + scrollY - (innerWidth > 860 ? 0 : 0));
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${stem}-first-feature.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(out, `${stem}-full.png`), fullPage: true });

    report.push({ route, viewport: vp.name, metrics, errors, foreign, failed });
    await context.close();
  }
}
await browser.close();
writeFileSync(join(out, "measured-layout.json"), JSON.stringify(report, null, 2));
for (const r of report) {
  const m = r.metrics;
  console.log(`${r.route}/${r.viewport}: H1 ${m.h1.size}/${m.h1.weight} lh ${m.h1.ratio} ${m.h1.lines} lines at x${m.h1.x} y${m.h1.y} w${m.h1.w}; H2 ${m.h2.size}/${m.h2.weight} ${m.h2.lines} lines; body ${m.body.size}; satoshi300 ${m.satoshi300}; overflowX ${m.overflowX}; cta above fold ${m.ctaAboveFold}; errors ${r.errors.length}; foreign ${r.foreign.length}; failed ${r.failed.length}`);
  if (r.failed.length) console.log("   failed:", r.failed.join(", "));
}
