// Benefits pass: owners see cost, comfort and routine work outcomes before
// the mechanics, and the contact section says what a first conversation
// covers. Copy, hierarchy and layout checks at the review widths.
import { test, expect } from "@playwright/test";

const MAIL = "edo.orfanini@energiaigroup.com";
const CTA_HREF = `mailto:${MAIL}?subject=Energia%20AI%3A%20our%20building`;
const BENEFITS = ["Lower operating costs", "Comfort for occupants", "Less routine adjustment"];
const IMAGE_META = /illustrati(?:ve|on)|fictional|renderings?|rendered|\bdemo\b|\bconcept\b|simulated visual|sample imagery|artist'?s impression|not a real (building|site)|not readings from a real site|not a client installation/i;

// Everything a visitor can read or hear: visible text, title, description,
// alt text and accessible names.
const allCopy = (page) => page.evaluate(() => [
  document.body.innerText,
  document.title,
  document.querySelector('meta[name="description"]').content,
  ...[...document.querySelectorAll("[alt], [aria-label], [title]")].flatMap((el) => [el.getAttribute("alt"), el.getAttribute("aria-label"), el.getAttribute("title")]),
].filter(Boolean).join("\n"));

test.describe("benefits pass copy", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("hero leads with the outcome and an outcome CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#top h1")).toHaveText("Spend less on HVAC. Keep people comfortable.");
    await expect(page.locator(".hero__line")).toHaveText("Energia AI is an AI control platform for commercial HVAC, designed to reduce wasted heating and cooling and the routine adjustments your team handles every day.");
    await expect(page.locator(".hero__cta")).toHaveText("Explore your savings");
    await expect(page.locator(".bar__cta")).toHaveText("Explore savings");
    await expect(page.locator(".contact .button")).toHaveText("Explore your savings");
    await expect(page).toHaveTitle("Energia AI · Spend less on commercial HVAC");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /AI control platform for commercial HVAC, designed to reduce wasted heating and cooling/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  test("benefits sit between the hero and the day, with a heading for assistive tech", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() => [...document.querySelectorAll("main > section")].map((s) => s.id));
    expect(order.slice(0, 3)).toEqual(["top", "benefits", "day"]);
    // A real H2 names the region for screen readers; it adds no visible eyebrow.
    const section = page.locator("#benefits");
    await expect(section).toHaveAttribute("aria-labelledby", "benefits-title");
    await expect(page.locator("#benefits-title")).toHaveText("What your building gains");
    await expect(page.locator("#benefits-title")).toHaveClass("visually-hidden");
    expect(await page.locator("#benefits-title").evaluate((el) => el.tagName)).toBe("H2");
    await expect(page.getByRole("region", { name: "What your building gains" })).toHaveCount(1);
    await expect(section.locator("dt")).toHaveText(BENEFITS);
    const dd = section.locator("dd");
    await expect(dd).toHaveCount(3);
    await expect(dd.nth(0)).toContainText("less energy goes to empty rooms");
    await expect(dd.nth(1)).toContainText("rooms in use stay in the comfort range your team sets");
    await expect(dd.nth(2)).toContainText("keeps oversight, limits and manual override");
    // No controls inside, so the keyboard path from the hero to the day is unchanged.
    await expect(section.locator("a, button, input, summary, [tabindex]")).toHaveCount(0);
    // Benefits are stated before any mechanism section.
    const text = await page.locator("main").innerText();
    expect(text.indexOf("Lower operating costs")).toBeLessThan(text.indexOf("The load on your building"));
    expect(text.indexOf("Lower operating costs")).toBeLessThan(text.indexOf("It starts with"));
  });

  test("each day action states what the owner gains", async ({ page }) => {
    await page.goto("/");
    const actions = await page.locator(".moment__part--do p").allInnerTexts();
    expect(actions).toEqual([
      "Starts each zone just early enough to be comfortable when people arrive, instead of conditioning an empty building.",
      "Keeps occupied rooms comfortable inside your approved setpoint range, with fresh air at or above your ventilation minimums.",
      "Began cooling the west rooms before the sun reached them, so they stay comfortable instead of overheating.",
      "Stops spending energy on empty rooms by moving them to your wider unoccupied range, while rooms still in use stay comfortable.",
    ]);
  });

  test("contact names the opportunity and what a first conversation covers", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#contact-title")).toHaveText("Find the savings opportunity in your building.");
    const lede = page.locator(".contact .lede");
    for (const part of ["building type", "current HVAC", "operating schedules", "where energy may be wasted", "fits your HVAC and BMS", "what integration and measurement would involve"]) {
      await expect(lede).toContainText(part);
    }
    // No promise of an instant estimate, free audit, report or booking tool.
    await expect(lede).not.toContainText(/estimate|free|audit|report|book|calendar|guarantee/i);
    await expect(page.locator("form, input, textarea, iframe")).toHaveCount(0);
  });

  test("savings FAQ answers plainly without a number", async ({ page }) => {
    await page.goto("/");
    const item = page.locator(".faq__item").filter({ has: page.locator("summary", { hasText: "How much could my building save?" }) });
    await expect(item).toHaveCount(1);
    await item.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(item).toHaveAttribute("open", "");
    const answer = item.locator("p");
    await expect(answer).toBeVisible();
    for (const factor of ["how your building runs today", "equipment", "weather", "occupancy", "energy prices", "savings potential and comfort together"]) {
      await expect(answer).toContainText(factor);
    }
    await expect(answer).not.toContainText(/\d/);
  });

  test("no unsupported numbers, results, customers or guarantees", async ({ page }) => {
    await page.goto("/");
    const copy = await allCopy(page);
    // The only digits are the four day times, ASHRAE 62.1 and the copyright year.
    const digits = copy.replace(/\b\d{2}:\d{2}\b/g, "").replace("ASHRAE 62.1", "").replace("© 2026", "");
    expect(digits.match(/.{0,20}\d.{0,20}/g)).toBeNull();
    for (const banned of [/%|percent/i, /[$€£]/, /\bROI\b|return on investment|payback/i, /customers?\b|clients?\b|case stud|testimonial|trusted by|deployed (in|at|across)|installed in/i, /free (audit|assessment|estimate)/i, /no hardware/i, /within \w+ (days|weeks|months)/i]) {
      expect(copy, String(banned)).not.toMatch(banned);
    }
    // The single guarantee sentence is the simulation qualification.
    expect(copy.match(/guarantee/gi)).toHaveLength(1);
    expect(copy).toContain("Simulation results are not a guarantee of savings in your building.");
  });

  test("no copy explains the images, no dashes, American spelling", async ({ page }) => {
    await page.goto("/");
    const copy = await allCopy(page);
    expect(copy).not.toMatch(IMAGE_META);
    // Hyphens, en and em dashes, minus and other dash characters.
    expect(copy.match(/.{0,20}[-‐-―−].{0,20}/g)).toBeNull();
    expect(copy).not.toMatch(/practis|colour|centre|metre|optimis|behaviour|organis|analys(e|ing)|favour|licen[cs]e/i);
  });

  test("mailtos are exactly the established addresses and subjects", async ({ page }) => {
    await page.goto("/");
    const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => [a.className, a.getAttribute("href")]));
    expect(mailtos).toEqual([
      ["bar__cta", CTA_HREF],
      ["hero__cta textlink", CTA_HREF],
      ["button", CTA_HREF],
      ["contact__mail", `mailto:${MAIL}`],
      ["", `mailto:${MAIL}`],
    ]);
  });
});

// Layout of the new row and the header CTA at each review width.
for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [861, 1024], [1440, 900]]) {
  test.describe(`benefits layout ${width}`, () => {
    test.use({ viewport: { width, height } });

    test("benefits row fits, keeps rhythm and the header CTA fits", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const rect = (el) => el.getBoundingClientRect().toJSON();
        const vw = document.documentElement.clientWidth;
        const items = [...document.querySelectorAll(".benefits__list > div")];
        const lines = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
        const cta = document.querySelector(".bar__cta");
        const nav = [...document.querySelectorAll(".bar__nav a:not(.bar__cta)")];
        return {
          vw,
          heroBottom: rect(document.querySelector("#top")).bottom,
          benefits: rect(document.querySelector("#benefits")),
          dayTop: rect(document.querySelector("#day")).top,
          dayHeadTop: rect(document.querySelector("#day-title")).top,
          items: items.map(rect),
          dtLines: items.map((d) => lines(d.querySelector("dt"))),
          ddLines: items.map((d) => lines(d.querySelector("dd"))),
          ddSize: items.map((d) => getComputedStyle(d.querySelector("dd")).fontSize),
          wide: [...document.querySelectorAll("#benefits *")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 1 && (r.left < -1 || r.right > vw + 1);
          }).length,
          cta: cta.checkVisibility() ? { ...rect(cta), lineHeight: parseFloat(getComputedStyle(cta).lineHeight), whiteSpace: getComputedStyle(cta).whiteSpace } : null,
          navRight: nav.length && nav[0].checkVisibility() ? Math.max(...nav.map((a) => a.getBoundingClientRect().right)) : null,
          barBottom: rect(document.querySelector(".bar")).bottom,
        };
      });
      // Directly after the hero, before the day.
      expect(Math.abs(m.benefits.top - m.heroBottom)).toBeLessThan(1);
      expect(m.benefits.bottom).toBeLessThanOrEqual(m.dayTop + 0.5);
      expect(m.wide).toBe(0);
      expect(m.ddSize).toEqual(["16px", "16px", "16px"]);
      // Breathing room: the first rule clears the art, and the day heading
      // sits well below the last benefit without a cavernous gap.
      expect(m.items[0].top - m.heroBottom).toBeGreaterThanOrEqual(40);
      const gap = m.dayHeadTop - m.benefits.bottom;
      expect(gap).toBeGreaterThanOrEqual(80);
      expect(gap).toBeLessThanOrEqual(180);
      if (width > 860) {
        // Three columns sharing one top line, each term on one line.
        expect(new Set(m.items.map((r) => Math.round(r.top))).size).toBe(1);
        expect(m.items[0].right).toBeLessThan(m.items[1].left);
        expect(m.dtLines).toEqual([1, 1, 1]);
        for (const n of m.ddLines) expect(n).toBeLessThanOrEqual(4);
        // Header CTA is one line, inside the bar and clear of the nav links.
        expect(m.cta).not.toBeNull();
        expect(m.cta.whiteSpace).toBe("nowrap");
        expect(m.cta.right).toBeLessThanOrEqual(m.vw - 20);
        expect(m.cta.bottom).toBeLessThanOrEqual(m.barBottom);
        expect(m.navRight).toBeLessThan(m.cta.left - 16);
      } else {
        // One column, stacked in reading order, terms on at most two lines.
        for (let i = 1; i < 3; i++) expect(m.items[i].top).toBeGreaterThanOrEqual(m.items[i - 1].bottom + 24);
        for (const n of m.dtLines) expect(n).toBeLessThanOrEqual(2);
        for (const n of m.ddLines) expect(n).toBeLessThanOrEqual(5);
      }
    });

    test("keyboard moves from the hero straight into the day", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-day][data-ready]"));
      // Focus the last hero or header control, then Tab once.
      const start = width > 860 ? ".bar__cta" : ".hero__cta";
      await page.locator(start).focus();
      await page.keyboard.press("Tab");
      await expect(page.locator("#tab-afternoon")).toBeFocused();
      const exposed = await page.evaluate(() => {
        const el = document.activeElement;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return r.top >= 0 && r.bottom <= innerHeight && (hit === el || el.contains(hit));
      });
      expect(exposed, "focused tab is on screen and not under the header").toBe(true);
    });
  });
}
