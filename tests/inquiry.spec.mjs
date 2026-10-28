// The inquiry form in the browser at 320, 390, 768 and 1440: CTA scroll and
// focus, keyboard only completion, inline errors, sending, success, failure
// and an idempotent retry. /api is answered in the test process by the real
// validation and ALTCHA code with an in-memory store, so timeouts and
// failures can be injected; tests/postgres covers the real database.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { issueChallenge, verifyProof } from "../server/challenge.js";
import { validate } from "../server/fields.js";

const SECRET = "c".repeat(64);
const MAIL = "edo.orfanini@energiaigroup.com";
const SHOT_DIR = process.env.INQUIRY_SHOT_DIR;
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });
// Element captures are stitched while scrolling, so the fixed header would
// land mid image. Hide it for the capture only.
const shoot = async (page, name) => {
  await page.evaluate(() => (document.querySelector(".bar").style.visibility = "hidden"));
  await page.locator("#contact").screenshot({ path: `${SHOT_DIR}/${name}.png` });
  await page.evaluate(() => (document.querySelector(".bar").style.visibility = ""));
};

// A stand-in for /api with the server's own checks. `plan` scripts what
// happens to each POST: "ok", "timeout" (stored, then the response is
// lost), "fail" (503), "slow" (held until released).
async function mockApi(page, plan = []) {
  const origin = new URL(page.url() === "about:blank" ? "http://127.0.0.1:4173" : page.url()).origin;
  const api = { posts: [], store: new Map(), challenges: 0, challengeRequests: [], release: null };
  await page.route("**/api/challenge", async (route) => {
    api.challenges++;
    const request = route.request();
    api.challengeRequests.push({ method: request.method(), body: request.postData(), type: request.headers()["content-type"] });
    if (request.method() !== "POST") return route.fulfill({ status: 405, json: { status: "method_not_allowed" } });
    await route.fulfill({ json: await issueChallenge(SECRET, origin) });
  });
  await page.route("**/api/inquiry", async (route) => {
    const body = route.request().postDataJSON();
    const step = plan[api.posts.length] ?? "ok";
    api.posts.push(body);
    if (step === "fail") return route.fulfill({ status: 503, json: { status: "unavailable" } });
    const { data, errors } = validate(body);
    if (Object.keys(errors).length) return route.fulfill({ status: 422, json: { status: "invalid_fields", fields: errors } });
    if (!(await verifyProof(body.altcha, SECRET, origin))) return route.fulfill({ status: 422, json: { status: "verification_required" } });
    let fresh = false;
    if (!api.store.has(body.idempotencyKey)) {
      api.store.set(body.idempotencyKey, { reference: "EA-" + String(api.store.size + 1).padStart(8, "0").replace(/0/g, "A"), data });
      fresh = true;
    }
    const { reference } = api.store.get(body.idempotencyKey);
    if (step === "timeout") return route.abort("timedout");
    if (step === "slow") await new Promise((r) => (api.release = r));
    return route.fulfill({ json: { status: "accepted", reference, fresh } });
  });
  return api;
}

const VIEWPORTS = [
  { name: "320", width: 320, height: 740, phone: true },
  { name: "390", width: 390, height: 844, phone: true },
  { name: "768", width: 768, height: 1024, phone: true },
  { name: "1440", width: 1440, height: 900, phone: false },
];

// The optional questions are behind a closed disclosure.
const openMore = async (page) => {
  const more = page.locator("[data-more]");
  if (!(await more.evaluate((d) => d.open))) await more.locator("summary").click();
  await expect(more).toHaveAttribute("open", "");
};
const shownReference = /^EA [0-9A-Z]{8}$/;

const fill = async (page) => {
  await page.fill("#inquiry-name", "Synthetic Tester");
  await page.fill("#inquiry-email", "synthetic.tester@example.com");
  await page.fill("#inquiry-company", "Synthetic Test Buildings LLC");
  await page.selectOption("#inquiry-building-type", "Healthcare");
  await page.selectOption("#inquiry-floor-area", "Over 500,000 sq ft");
};

// Visible, fully on screen and not under the fixed header.
const exposed = (page, selector) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const bar = document.querySelector(".bar").getBoundingClientRect().bottom;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.top >= bar - 1 && r.bottom <= innerHeight && (hit === el || el.contains(hit));
  }, selector);

for (const vp of VIEWPORTS) {
  test.describe(`inquiry ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("nothing is requested from /api until someone types", async ({ page }) => {
      const calls = [];
      page.on("request", (r) => r.url().includes("/api/") && calls.push(r.url()));
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await page.locator("#inquiry-name").focus();
      await page.keyboard.press("Tab");
      expect(calls).toEqual([]);
      await expect(page.locator("[data-submit]")).toBeEnabled();
      await expect(page.locator(".contact__fallback")).toBeHidden();
    });

    test("every Discuss savings CTA scrolls to the form and focuses the first field", async ({ page }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      const ctas = vp.width > 860 ? [".bar__cta"] : [".hero__cta", "menu"];
      for (const cta of ctas) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
        if (cta === "menu") {
          await page.locator("[data-toggle]").click();
          await expect(page.locator(".bar__cta")).toBeVisible();
          await page.locator(".bar__cta").click();
          await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "false");
        } else {
          await expect(page.locator(cta)).toHaveText(cta === ".bar__cta" ? "Discuss savings" : "Discuss your savings");
          await page.locator(cta).click();
        }
        await expect(page.locator("#inquiry-name")).toBeFocused();
        await page.waitForFunction(() => {
          const r = document.querySelector("#inquiry-name").getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        });
        await page.waitForTimeout(700); // let a smooth scroll settle
        expect(await exposed(page, "#inquiry-name"), cta).toBe(true);
        expect(new URL(page.url()).hash).toBe("#contact");
      }
    });

    test("keyboard only: from the CTA to a confirmed inquiry", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const api = await mockApi(page);
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await page.locator(vp.width > 860 ? ".bar__cta" : ".hero__cta").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#inquiry-name")).toBeFocused();
      await page.keyboard.type("Synthetic Keyboard Tester");
      await page.keyboard.press("Tab");
      await page.keyboard.type("keyboard.tester@example.com");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Synthetic Keyboard Co");
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-building-type")).toBeFocused();
      await page.keyboard.type("Education");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Not");
      await page.keyboard.press("Tab");
      // The optional details are closed; Enter on the summary opens them.
      await expect(page.locator("[data-more] > summary")).toBeFocused();
      await expect(page.locator("#inquiry-role")).toBeHidden();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-more]")).toHaveAttribute("open", "");
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-role")).toBeFocused();
      await page.keyboard.type("Facilities");
      await page.keyboard.press("Tab");
      await page.keyboard.type("+1 555 0100");
      await page.keyboard.press("Tab");
      await page.keyboard.type("2");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Prefer");
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-bms")).toBeFocused();
      await page.keyboard.type("Yes");
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-bms-name")).toBeFocused();
      await page.keyboard.type("Synthetic BMS");
      await page.keyboard.press("Tab");
      await expect(page.locator("#inquiry-improve")).toBeFocused();
      await page.keyboard.type("Synthetic keyboard test.");
      // The honeypot is skipped: Tab goes straight to Send.
      await page.keyboard.press("Tab");
      await expect(page.locator("[data-submit]")).toBeFocused();
      await page.keyboard.press("Enter");
      // Focus lands on the heading, not the container, and no ring frames
      // the confirmation or its heading like a card.
      await expect(page.locator(".inquiry__done-title")).toBeFocused();
      await expect(page.locator(".inquiry__done-title")).toHaveText("Thanks. We’ll be in touch shortly.");
      const rings = await page.evaluate(() => {
        const done = document.querySelector("[data-done]");
        const title = document.querySelector(".inquiry__done-title");
        return { doneTabindex: done.getAttribute("tabindex"), doneOutline: getComputedStyle(done).outlineStyle, titleFocusVisible: title.matches(":focus-visible"), titleOutline: getComputedStyle(title).outlineStyle };
      });
      expect(rings).toEqual({ doneTabindex: null, doneOutline: "none", titleFocusVisible: true, titleOutline: "none" });
      await expect(page.locator("[data-reference]")).toHaveText(shownReference);
      await expect(page.locator("[data-done]")).not.toContainText("-");
      await expect(page.locator("[data-inquiry]")).toBeHidden();
      expect(api.challengeRequests.length).toBeGreaterThan(0);
      for (const c of api.challengeRequests) expect(c).toEqual({ method: "POST", body: "{}", type: "application/json" });
      expect(api.posts).toHaveLength(1);
      const sent = api.posts[0];
      expect({ ...sent, altcha: "", idempotencyKey: "" }).toEqual({
        name: "Synthetic Keyboard Tester",
        email: "keyboard.tester@example.com",
        company: "Synthetic Keyboard Co",
        buildingType: "Education",
        floorArea: "Not sure",
        role: "Facilities or engineering",
        phone: "+1 555 0100",
        buildingCount: "2 to 5",
        energySpend: "Prefer not to say",
        bms: "Yes",
        bmsName: "Synthetic BMS",
        improve: "Synthetic keyboard test.",
        website: "",
        sourcePath: "/",
        utm: "",
        altcha: "",
        idempotencyKey: "",
      });
      expect(sent.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      if (SHOT_DIR && [390, 1440].includes(vp.width)) await shoot(page, `success-${vp.width}`);
    });

    test("inline errors are tied to their fields and clear as they are fixed", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const api = await mockApi(page);
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      // First view: five fields, a closed disclosure and Send.
      await expect(page.locator("[data-more]")).not.toHaveAttribute("open", "");
      await expect(page.locator("#inquiry-role")).toBeHidden();
      if (SHOT_DIR && [390, 1440].includes(vp.width)) {
        await page.locator("#contact").scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await shoot(page, `idle-${vp.width}`);
      }
      await page.locator("[data-submit]").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#inquiry-name")).toBeFocused();
      const expected = {
        "inquiry-name": "Enter your name.",
        "inquiry-email": "Enter your work email.",
        "inquiry-company": "Enter your company.",
        "inquiry-building-type": "Choose a building type.",
        "inquiry-floor-area": "Choose a floor area.",
      };
      for (const [id, message] of Object.entries(expected)) {
        const field = page.locator(`#${id}`);
        await expect(field).toHaveAttribute("aria-invalid", "true");
        await expect(field).toHaveAccessibleDescription(message);
        await expect(page.locator(`#${id}-error`)).toHaveText(message);
        await expect(page.locator(`#${id}-error`)).toBeVisible();
      }
      await expect(page.locator("#inquiry-role")).not.toHaveAttribute("aria-invalid", "true");
      // Nothing optional is wrong, so the optional details stay closed.
      await expect(page.locator("[data-more]")).not.toHaveAttribute("open", "");
      expect(api.posts).toHaveLength(0);
      if (SHOT_DIR && [390, 1440].includes(vp.width)) await shoot(page, `errors-${vp.width}`);
      await page.keyboard.type("Synthetic Tester");
      await expect(page.locator("#inquiry-name-error")).toHaveText("");
      await expect(page.locator("#inquiry-name")).not.toHaveAttribute("aria-invalid");
      await page.fill("#inquiry-email", "not an email");
      // A bad phone typed, then the disclosure closed again: sending opens it.
      await openMore(page);
      await page.fill("#inquiry-phone", "call me");
      await page.locator("[data-more] > summary").click();
      await expect(page.locator("#inquiry-phone")).toBeHidden();
      await page.locator("[data-submit]").click();
      await expect(page.locator("#inquiry-email")).toBeFocused();
      await expect(page.locator("#inquiry-email-error")).toHaveText("Enter an email address like name@company.com.");
      await expect(page.locator("[data-more]")).toHaveAttribute("open", "");
      await expect(page.locator("#inquiry-phone")).toBeVisible();
      await expect(page.locator("#inquiry-phone")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#inquiry-phone")).toHaveAccessibleDescription("Enter a phone number using digits, spaces, + or parentheses.");
      await expect(page.locator("#inquiry-phone-error")).toHaveText("Enter a phone number using digits, spaces, + or parentheses.");
      expect(api.posts).toHaveLength(0);
      if (SHOT_DIR && [390, 1440].includes(vp.width)) await shoot(page, `errors-phone-${vp.width}`);
      // With the required answers fixed, the phone is the first error: focus
      // goes into the disclosure, closed or not.
      await page.fill("#inquiry-email", "synthetic.tester@example.com");
      await page.fill("#inquiry-company", "Synthetic Test Buildings LLC");
      await page.selectOption("#inquiry-building-type", "Office");
      await page.selectOption("#inquiry-floor-area", "Not sure");
      await page.locator("[data-more] > summary").click();
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-more]")).toHaveAttribute("open", "");
      await expect(page.locator("#inquiry-phone")).toBeFocused();
      expect(api.posts).toHaveLength(0);
    });

    test("sending state, then a timeout keeps the answers and the retry is not a duplicate", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/?utm_source=synthetic&utm_campaign=retry");
      const api = await mockApi(page, ["timeout", "slow"]);
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await fill(page);
      await page.locator("[data-submit]").click();
      // First attempt reaches the server, then its response is lost.
      const failure = page.locator("[data-failure]");
      await expect(failure).toContainText("Your details could not be sent. Please try again, or email");
      await expect(failure.locator(`a[href="mailto:${MAIL}"]`)).toHaveText(MAIL);
      await expect(page.locator("[data-submit]")).toBeEnabled();
      await expect(page.locator("[data-submit]")).toBeFocused();
      await expect(page.locator("#inquiry-name")).toHaveValue("Synthetic Tester");
      await expect(page.locator("#inquiry-floor-area")).toHaveValue("Over 500,000 sq ft");
      // Retry: held server side so the sending state can be read.
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-submit]")).toBeDisabled();
      await expect(page.locator("[data-inquiry]")).toHaveAttribute("aria-busy", "true");
      await expect(page.locator("[data-submit-label]")).toHaveText("Sending");
      await expect(page.locator("[data-status]")).toHaveText("Sending your details.");
      await expect.poll(() => api.release !== null).toBe(true);
      api.release();
      await expect(page.locator(".inquiry__done-title")).toBeFocused();
      expect(api.posts).toHaveLength(2);
      expect(api.posts[1].idempotencyKey).toBe(api.posts[0].idempotencyKey);
      expect(api.store.size).toBe(1);
      const reference = [...api.store.values()][0].reference;
      expect(reference).toMatch(/^EA-/);
      await expect(page.locator("[data-reference]")).toHaveText(reference.replace("-", " "));
      expect(api.posts[0].utm).toBe("?utm_source=synthetic&utm_campaign=retry");
    });

    test("a server failure keeps the answers; changed answers get a new key", async ({ page }) => {
      await page.goto("/");
      const api = await mockApi(page, ["fail", "fail", "ok"]);
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await fill(page);
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-failure]")).toContainText("Your details were not sent. Please try again, or email");
      await expect(page.locator("#inquiry-company")).toHaveValue("Synthetic Test Buildings LLC");
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-failure]")).toContainText("Your details were not sent.");
      expect(api.posts[1].idempotencyKey).toBe(api.posts[0].idempotencyKey);
      await page.fill("#inquiry-company", "Edited Synthetic Co");
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-done]")).toBeVisible();
      expect(api.posts[2].idempotencyKey).not.toBe(api.posts[0].idempotencyKey);
      expect(api.posts[2].company).toBe("Edited Synthetic Co");
    });

    test("server field errors land on their fields", async ({ page }) => {
      await page.goto("/");
      await page.route("**/api/challenge", (route) => route.fulfill({ json: { parameters: { algorithm: "PBKDF2/SHA-256", nonce: "00".repeat(16), salt: "00".repeat(16), cost: 1, keyLength: 32, keyPrefix: "" } } }));
      await page.route("**/api/inquiry", (route) => route.fulfill({ status: 422, json: { status: "invalid_fields", fields: { company: "Use 120 characters or fewer." } } }));
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await fill(page);
      await page.locator("[data-submit]").click();
      await expect(page.locator("#inquiry-company")).toBeFocused();
      await expect(page.locator("#inquiry-company-error")).toHaveText("Use 120 characters or fewer.");
      await expect(page.locator("[data-submit]")).toBeEnabled();
      await expect(page.locator("[data-more]")).not.toHaveAttribute("open", "");
    });

    test("a server field error inside the closed optional details opens them", async ({ page }) => {
      await page.goto("/");
      await page.route("**/api/challenge", (route) => route.fulfill({ json: { parameters: { algorithm: "PBKDF2/SHA-256", nonce: "00".repeat(16), salt: "00".repeat(16), cost: 1, keyLength: 32, keyPrefix: "" } } }));
      await page.route("**/api/inquiry", (route) => route.fulfill({ status: 422, json: { status: "invalid_fields", fields: { phone: "Enter a phone number using digits, spaces, + or parentheses." } } }));
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await fill(page);
      await expect(page.locator("[data-more]")).not.toHaveAttribute("open", "");
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-more]")).toHaveAttribute("open", "");
      await expect(page.locator("#inquiry-phone")).toBeFocused();
      await expect(page.locator("#inquiry-phone-error")).toHaveText("Enter a phone number using digits, spaces, + or parentheses.");
    });

    test("optional details: closed at first, one 44px line that opens and closes", async ({ page }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      const more = page.locator("[data-more]");
      const summary = more.locator("summary");
      await expect(more).not.toHaveAttribute("open", "");
      await expect(summary).toHaveText("Add optional details role, buildings, BMS, energy spend");
      await expect(summary.locator("span")).toHaveText("role, buildings, BMS, energy spend");
      expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
      for (const id of ["role", "phone", "building-count", "energy-spend", "bms", "improve"]) await expect(page.locator(`#inquiry-${id}`)).toBeHidden();
      // Closed, Tab goes from the last required field to the summary, then Send.
      await page.locator("#inquiry-floor-area").focus();
      await page.keyboard.press("Tab");
      await expect(summary).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator("[data-submit]")).toBeFocused();
      await summary.click();
      await expect(more).toHaveAttribute("open", "");
      for (const id of ["role", "phone", "building-count", "energy-spend", "bms", "improve"]) await expect(page.locator(`#inquiry-${id}`)).toBeVisible();
      await expect(more.locator("fieldset")).toHaveAccessibleName("Optional details");
      if (SHOT_DIR && [390, 1440].includes(vp.width)) {
        await page.waitForTimeout(300);
        await shoot(page, `open-${vp.width}`);
      }
      await summary.click();
      await expect(more).not.toHaveAttribute("open", "");
    });

    test("the improve field counts characters near its limit", async ({ page }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await openMore(page);
      const hint = page.locator("#inquiry-improve-hint");
      const field = page.locator("#inquiry-improve");
      await expect(hint).toHaveText("Up to 1,000 characters.");
      await field.fill("x".repeat(800));
      await expect(hint).toHaveText("Up to 1,000 characters.");
      await field.fill("x".repeat(801));
      await expect(hint).toHaveText("801 of 1,000 characters");
      await expect(hint).not.toHaveAttribute("aria-live", /.*/);
      await field.fill("x".repeat(1200)); // maxlength keeps the first 1,000
      await expect(field).toHaveValue("x".repeat(1000));
      await expect(hint).toHaveText("1,000 of 1,000 characters");
      await expect(hint).toHaveAttribute("aria-live", "polite");
      await expect(field).toHaveAccessibleDescription(/1,000 of 1,000 characters/);
      await field.fill("Short.");
      await expect(hint).toHaveText("Up to 1,000 characters.");
      await expect(hint).not.toHaveAttribute("aria-live", /.*/);
    });

    test("Which one? appears only with a BMS; the honeypot is out of reach", async ({ page }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
      await openMore(page);
      await expect(page.locator("#inquiry-bms-name")).toBeHidden();
      await page.selectOption("#inquiry-bms", "Yes");
      await expect(page.locator("#inquiry-bms-name")).toBeVisible();
      await page.fill("#inquiry-bms-name", "Synthetic");
      await page.selectOption("#inquiry-bms", "No");
      await expect(page.locator("#inquiry-bms-name")).toBeHidden();
      await expect(page.locator("#inquiry-bms-name")).toHaveValue("");
      const trap = page.locator("#inquiry-website");
      await expect(trap).toHaveAttribute("tabindex", "-1");
      await expect(page.locator(".inquiry__trap")).toHaveAttribute("aria-hidden", "true");
      const box = await trap.boundingBox();
      expect(box.width * box.height).toBeLessThanOrEqual(1);
      await expect(page.getByRole("textbox", { name: /leave this field empty/i })).toHaveCount(0);
    });

    test("consent line and privacy link", async ({ page, request }) => {
      await page.goto("/");
      await expect(page.locator(".inquiry__consent")).toHaveText("We use these details only to reply about your building. Privacy");
      const link = page.locator(".inquiry__privacy");
      await expect(link).toHaveAttribute("href", "/privacy");
      const box = await link.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      // The 44px target does not stretch the sentence where it wraps: every
      // line of the consent sits one line height below the one before.
      const lines = await page.locator(".inquiry__consent").evaluate((p) => {
        const range = document.createRange();
        range.selectNodeContents(p);
        const tops = [...new Set([...range.getClientRects()].map((r) => Math.round(r.bottom)))].sort((a, b) => a - b);
        return { tops, lineHeight: parseFloat(getComputedStyle(p).lineHeight) };
      });
      for (let i = 1; i < lines.tops.length; i++) expect(lines.tops[i] - lines.tops[i - 1], JSON.stringify(lines)).toBeLessThanOrEqual(lines.lineHeight + 1);
      const res = await request.get("/privacy");
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain("We keep inquiries until we no longer need them or you ask us to delete them.");
      expect(html).toContain(`mailto:${MAIL}`);
      expect(html).toContain('content="noindex, nofollow"');
    });
  });
}

test.describe("privacy page", () => {
  test("states indefinite keeping, deletion on request, and no dashes", async ({ page }) => {
    const problems = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("requestfailed", (r) => problems.push(r.url()));
    await page.goto("/privacy");
    const text = await page.locator("body").innerText();
    expect(text).toContain("We keep inquiries until we no longer need them or you ask us to delete them.");
    expect(text).toContain(`To request deletion, email ${MAIL}.`);
    expect(text).not.toMatch(/365|retention period|automatically delete(d)? (after|within) \d/i);
    expect(text.match(/.{0,20}[-‐-―−].{0,20}/g)).toBeNull();
    expect(problems).toEqual([]);
    await expect(page.locator("a[href='/']").first()).toBeVisible();
  });
});

test.describe("admin page", () => {
  test("is noindex, not linked from the public page, and asks for a password", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("a[href*='admin']").count()).toBe(0);
    expect(await page.content()).not.toContain("/admin");
    await page.route("**/api/admin**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
    await page.goto("/admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator("#password")).toBeFocused();
    await expect(page.locator("[data-board]")).toBeHidden();
  });
});

test.describe("contact without the form", () => {
  test("no JavaScript: one email line, no Prefer email?", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator(".contact__alt")).toBeHidden();
    await expect(page.locator(".contact__fallback")).toBeVisible();
    expect(await page.locator("#contact").innerText()).not.toContain("Prefer email?");
    await ctx.close();
  });

  test("form off after a failed start: one email line, no Prefer email?", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
    await expect(page.locator(".contact__alt")).toBeVisible();
    await page.evaluate(() => document.querySelector("#contact").setAttribute("data-form-off", ""));
    await expect(page.locator(".contact__alt")).toBeHidden();
    await expect(page.locator(".contact__fallback")).toBeVisible();
    await expect(page.locator("[data-inquiry]")).toBeHidden();
  });
});

// The dashboard against a scripted /api/admin with synthetic rows: list
// cleanups, focus after every action that rebuilds the list, and a sign out
// that only leaves when the server confirms it.
const ADMIN_ROWS = () => [
  {
    id: 2, reference: "EA-SYNTH0002", created_at: "2026-10-27T20:00:00Z", status: "new", contacted_at: null,
    name: "Synthetic Owner", email: "synthetic.owner@example.com", company: "Synthetic Towers LLC", building_type: "Office",
    floor_area: "Over 500,000 sq ft", role: "Owner or executive", building_count: "6 to 20", bms: "Yes", bms_name: "Synthetic BMS",
    energy_spend: "Over $1M", improve: "Synthetic test row.\nSecond line.", phone: "+1 555 0100", source_url: "https://example.com/",
    utm_source: "synthetic", utm_medium: "email", utm_campaign: "fall", utm_term: null, utm_content: null,
  },
  {
    id: 1, reference: "EA-SYNTH0001", created_at: "2026-10-26T15:00:00Z", status: "new", contacted_at: null,
    name: "Minimal Synthetic", email: "minimal@example.com", company: "Minimal Synthetic Co", building_type: "Retail",
    floor_area: "Not sure", role: null, building_count: null, bms: null, bms_name: null, energy_spend: null, improve: null, phone: null,
    source_url: "https://example.com/", utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
  },
];

async function mockAdmin(page, { logout = [] } = {}) {
  const state = { rows: ADMIN_ROWS(), logouts: 0 };
  await page.route("**/api/admin**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const action = url.searchParams.get("action");
      if (action === "session") return route.fulfill({ json: { csrf: "c".repeat(64) } });
      if (action === "list") return route.fulfill({ json: { inquiries: state.rows, page: 0, hasMore: false } });
      if (action === "detail") {
        const row = state.rows.find((r) => r.reference === url.searchParams.get("reference"));
        return route.fulfill({ json: { inquiry: row, events: [{ action: "received", created_at: row.created_at }] } });
      }
      return route.fulfill({ status: 400, json: { error: "invalid_action" } });
    }
    const body = req.postDataJSON();
    if (body.action === "status") {
      const row = state.rows.find((r) => r.reference === body.reference);
      row.status = body.status;
      row.contacted_at = body.status === "contacted" ? "2026-10-27T21:00:00Z" : null;
      return route.fulfill({ json: { ok: true } });
    }
    if (body.action === "erase") {
      state.rows = state.rows.filter((r) => r.reference !== body.reference);
      return route.fulfill({ json: { ok: true } });
    }
    if (body.action === "logout") {
      const code = logout[state.logouts++] ?? 200;
      return route.fulfill({ status: code, json: code === 200 ? { ok: true } : { error: "unavailable" } });
    }
    return route.fulfill({ status: 400, json: { error: "invalid_request" } });
  });
  return state;
}

for (const width of [390, 1440]) {
  test.describe(`dashboard ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("list: company only in the title, campaign tags in words", async ({ page }) => {
      await mockAdmin(page);
      await page.goto("/admin");
      const item = page.locator('li[data-reference="EA-SYNTH0002"]');
      await expect(item).toBeVisible();
      await expect(item.locator(".item__title")).toContainText("Synthetic Towers LLC");
      const terms = await item.locator(".answers dt").allTextContents();
      expect(terms).not.toContain("Company");
      expect(terms).toEqual(expect.arrayContaining(["Campaign source", "Campaign medium", "Campaign name"]));
      expect(terms.some((t) => /utm/i.test(t))).toBe(false);
      await item.getByRole("button", { name: "Details" }).click();
      await expect(page.locator("[data-detail-title]")).toBeFocused();
      const detail = await page.locator("[data-detail-answers] dt").allTextContents();
      expect(detail).toContain("Company");
      expect(detail).toContain("Campaign source");
    });

    test("focus stays put after mark, back and erase rebuild the list", async ({ page }) => {
      await mockAdmin(page);
      await page.goto("/admin");
      const item = () => page.locator('li[data-reference="EA-SYNTH0001"]');
      await expect(item()).toBeVisible();
      await item().getByRole("button", { name: "Mark contacted" }).focus();
      await page.keyboard.press("Enter");
      await expect(item().locator(".badge--done")).toBeVisible();
      // The same control on the same inquiry, now offering the reverse.
      await expect(item().getByRole("button", { name: "Mark as new" })).toBeFocused();
      if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/admin-marked-${width}.png`, fullPage: true });
      await page.keyboard.press("Enter");
      await expect(item().getByRole("button", { name: "Mark contacted" })).toBeFocused();

      await item().getByRole("button", { name: "Details" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-detail-title]")).toBeFocused();
      await page.getByRole("button", { name: "Back to the list" }).focus();
      await page.keyboard.press("Enter");
      await expect(item().getByRole("button", { name: "Details" })).toBeFocused();

      await item().getByRole("button", { name: "Erase", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(item().getByRole("button", { name: "Keep it" })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(item().getByRole("button", { name: "Erase permanently" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByText("EA-SYNTH0001 was erased.")).toBeVisible();
      await expect(page.locator("#board-title")).toBeFocused();
      await expect(item()).toHaveCount(0);
    });

    test("sign out stays on the dashboard until the server confirms it", async ({ page }) => {
      const state = await mockAdmin(page, { logout: [503, 200] });
      await page.goto("/admin");
      await expect(page.locator('li[data-reference="EA-SYNTH0002"]')).toBeVisible();
      const signOut = page.getByRole("button", { name: "Sign out" });
      await signOut.click();
      await expect(page.locator("[data-error]")).toHaveText("Could not sign out. Try again.");
      await expect(page.locator("[data-board]")).toBeVisible();
      await expect(page.locator("[data-login]")).toBeHidden();
      await expect(signOut).toBeFocused();
      await signOut.click();
      await expect(page.locator("#password")).toBeFocused();
      await expect(page.locator("[data-board]")).toBeHidden();
      await expect(page.locator("[data-list] li")).toHaveCount(0);
      expect(state.logouts).toBe(2);
    });

    test("sign out on a network failure also stays", async ({ page }) => {
      await mockAdmin(page);
      await page.goto("/admin");
      await expect(page.locator('li[data-reference="EA-SYNTH0002"]')).toBeVisible();
      await page.route("**/api/admin", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.fallback()));
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page.locator("[data-error]")).toHaveText("Could not sign out. Try again.");
      await expect(page.locator("[data-board]")).toBeVisible();
    });
  });
}
