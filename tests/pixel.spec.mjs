// The Meta pixel, the widened CSP and indexing. pixel.js never loads on a
// loopback host, so these tests reach the local server through a stand-in
// hostname (energia.pixel.test, mapped to 127.0.0.1 in Chrome). Meta's
// script is answered here by a recorder, so nothing is ever sent to Meta;
// its host still has to pass the real CSP from vercel.json. /api is answered
// with the server's own validation and ALTCHA code.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { issueChallenge, verifyProof } from "../server/challenge.js";
import { validate } from "../server/fields.js";

const PIXEL_ID = "2313981812785333";
const FBEVENTS = "https://connect.facebook.net/en_US/fbevents.js";
const PORT = Number(process.env.PORT || 4173);
const HOST = `http://energia.pixel.test:${PORT}`;
const SECRET = "d".repeat(64);
const STRICT = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'none'";
const PUBLIC = "default-src 'none'; script-src 'self' https://connect.facebook.net; style-src 'self'; img-src 'self' https://www.facebook.com; font-src 'self'; connect-src 'self' https://www.facebook.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'none'";

test.use({
  launchOptions: {
    // The form needs a secure context for Web Crypto, as on the real https host.
    args: ["--host-resolver-rules=MAP energia.pixel.test 127.0.0.1", `--unsafely-treat-insecure-origin-as-secure=${HOST}`],
  },
});

// Stands in for fbevents.js: takes over the base code's queue and records
// every call, the way Meta's script does before sending anything.
const RECORDER = `(function () {
  var f = window.fbq;
  window.__fb = { calls: [], loads: (window.__fb ? window.__fb.loads : 0) + 1 };
  f.callMethod = function () { window.__fb.calls.push(JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)))); };
  f.queue.splice(0).forEach(function (args) { f.callMethod.apply(f, args); });
})();`;

// Every request that leaves the site, and every CSP violation.
async function watchMeta(page, { block = false } = {}) {
  const seen = { offsite: [], finished: [], failed: {}, errors: [], fbevents: 0 };
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.hostname !== "energia.pixel.test" && url.hostname !== "127.0.0.1") seen.offsite.push(r.url());
  });
  page.on("requestfinished", (r) => seen.finished.push(r.url()));
  page.on("requestfailed", (r) => (seen.failed[r.url()] = r.failure()?.errorText));
  page.on("pageerror", (e) => seen.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && seen.errors.push(m.text()));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
  });
  await page.route("https://connect.facebook.net/**", (route) => {
    if (block || route.request().url() !== FBEVENTS) return route.abort("blockedbyclient");
    seen.fbevents++;
    return route.fulfill({ contentType: "text/javascript", body: RECORDER });
  });
  // Nothing may reach Meta from a test, whatever the script tries.
  await page.route("https://www.facebook.com/**", (route) => route.abort("blockedbyclient"));
  return seen;
}

const calls = (page) => page.evaluate(() => (window.__fb ? window.__fb.calls : []));
const leads = async (page) => (await calls(page)).filter((c) => c[0] === "track" && c[1] === "Lead");

// /api/challenge and /api/inquiry with the server's checks. `plan` scripts
// each POST: "ok", "timeout" (stored, response lost), "fail" (503),
// "conflict" (409), "limited" (429), "invalid" (422 invalid_fields).
async function mockApi(page, plan = []) {
  const api = { posts: [], store: new Map() };
  await page.route("**/api/challenge", async (route) => route.fulfill({ json: await issueChallenge(SECRET, HOST) }));
  await page.route("**/api/inquiry", async (route) => {
    const body = route.request().postDataJSON();
    const step = plan[api.posts.length] ?? "ok";
    api.posts.push(body);
    if (body.website) return route.fulfill({ json: { status: "accepted", reference: "EA-HONEYP0T", fresh: true } });
    if (step === "fail") return route.fulfill({ status: 503, json: { status: "unavailable" } });
    if (step === "conflict") return route.fulfill({ status: 409, json: { status: "idempotency_conflict" } });
    if (step === "limited") return route.fulfill({ status: 429, json: { status: "rate_limited" } });
    if (step === "invalid") return route.fulfill({ status: 422, json: { status: "invalid_fields", fields: { company: "Enter your company." } } });
    const { data, errors } = validate(body);
    if (Object.keys(errors).length) return route.fulfill({ status: 422, json: { status: "invalid_fields", fields: errors } });
    if (!(await verifyProof(body.altcha, SECRET, HOST))) return route.fulfill({ status: 422, json: { status: "verification_required" } });
    let fresh = false;
    if (!api.store.has(body.idempotencyKey)) {
      api.store.set(body.idempotencyKey, { reference: "EA-PIXEL" + String(api.store.size + 1).padStart(3, "0"), data });
      fresh = true;
    }
    const { reference } = api.store.get(body.idempotencyKey);
    if (step === "timeout") return route.abort("timedout");
    return route.fulfill({ json: { status: "accepted", reference, fresh } });
  });
  return api;
}

const fill = async (page) => {
  await page.fill("#inquiry-name", "Synthetic Tester");
  await page.fill("#inquiry-email", "synthetic.tester@example.com");
  await page.fill("#inquiry-company", "Synthetic Test Buildings LLC");
  await page.selectOption("#inquiry-building-type", "Healthcare");
  await page.selectOption("#inquiry-floor-area", "Over 500,000 sq ft");
};
const open = async (page, path = "/") => {
  await page.goto(HOST + path);
  await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
  await expect.poll(() => calls(page)).toContainEqual(["track", "PageView"]);
};
const done = (page) => expect(page.locator(".inquiry__done-title")).toBeFocused();

test.describe("Meta pixel", () => {
  test("loads once on the public pages with the Energia dataset, and never on /admin or loopback", async ({ page }) => {
    const seen = await watchMeta(page);
    await open(page);
    expect(await calls(page)).toEqual([["set", "autoConfig", false, PIXEL_ID], ["init", PIXEL_ID], ["track", "PageView"]]);
    // fbevents.js counts pushState as a page view; the CTA uses pushState.
    expect(await page.evaluate(() => window.fbq.disablePushState)).toBe(true);
    expect(await page.locator(`script[src="${FBEVENTS}"]`).count()).toBe(1);
    expect(await page.locator('script[src="pixel.js"]').count()).toBe(1);
    expect(seen.fbevents).toBe(1);
    // Exactly Meta's script host; nothing else leaves the site.
    expect(seen.offsite).toEqual([FBEVENTS]);
    expect(await page.evaluate(() => window.__csp)).toEqual([]);

    await page.goto(HOST + "/privacy");
    await expect.poll(() => calls(page)).toEqual([["set", "autoConfig", false, PIXEL_ID], ["init", PIXEL_ID], ["track", "PageView"]]);
    expect(await page.locator('script[src="/pixel.js"]').count()).toBe(1);
    expect(await page.locator(`script[src="${FBEVENTS}"]`).count()).toBe(1);

    await page.route("**/api/admin**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
    const before = seen.offsite.length;
    await page.goto(HOST + "/admin");
    await expect(page.locator("#password")).toBeFocused();
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
    expect(await page.locator("script[src*='pixel'], script[src*='facebook']").count()).toBe(0);
    expect(seen.offsite.length).toBe(before);
    expect(readFileSync("admin.html", "utf8")).not.toMatch(/pixel|facebook/i);

    // The same page on the loopback address loads no pixel at all.
    await page.goto("/");
    await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
    expect(seen.offsite.length).toBe(before);
    // The dashboard's own signed out probe is the only console error.
    expect(seen.errors.filter((e) => !/status of 401/.test(e))).toEqual([]);
  });

  test("one Lead with the reference as event ID after a stored inquiry, and none for validation errors", async ({ page }) => {
    const seen = await watchMeta(page);
    await open(page);
    const api = await mockApi(page, ["invalid", "ok"]);
    // Client side validation: nothing is sent and no Lead.
    await page.locator("[data-submit]").click();
    await expect(page.locator("#inquiry-name-error")).toHaveText("Enter your name.");
    expect(api.posts).toHaveLength(0);
    // Server side validation error: no Lead.
    await fill(page);
    await page.locator("[data-submit]").click();
    await expect(page.locator("#inquiry-company-error")).toHaveText("Enter your company.");
    expect(await leads(page)).toEqual([]);
    // Stored: exactly one Lead, after the success state, with the reference.
    await page.locator("[data-submit]").click();
    await done(page);
    const reference = [...api.store.values()][0].reference;
    expect(await leads(page)).toEqual([["track", "Lead", {}, { eventID: reference }]]);
    // No value, currency or answers travel with it.
    expect(JSON.stringify(await calls(page))).not.toMatch(/value|currency|Synthetic|example\.com|Healthcare/);
    await page.waitForTimeout(500);
    expect(await leads(page)).toHaveLength(1);
    expect(seen.offsite).toEqual([FBEVENTS]);
    expect(seen.errors.filter((e) => !/422/.test(e))).toEqual([]);
  });

  test("a retry that returns the existing reference sends no Lead", async ({ page }) => {
    await watchMeta(page);
    await open(page);
    const api = await mockApi(page, ["timeout", "ok"]);
    await fill(page);
    await page.locator("[data-submit]").click();
    await expect(page.locator("[data-failure]")).toContainText("Your details could not be sent.");
    await page.locator("[data-submit]").click();
    await done(page);
    expect(api.posts[1].idempotencyKey).toBe(api.posts[0].idempotencyKey);
    expect(api.store.size).toBe(1);
    expect(await leads(page)).toEqual([]);
  });

  test("failures send no Lead; the eventual stored inquiry sends exactly one", async ({ page }) => {
    await watchMeta(page);
    await open(page);
    const api = await mockApi(page, ["fail", "limited", "conflict", "ok"]);
    await fill(page);
    for (const message of ["Your details were not sent.", "Too many messages were sent from here just now.", "Your details were not sent."]) {
      await page.locator("[data-submit]").click();
      await expect(page.locator("[data-failure]")).toContainText(message);
      await expect(page.locator("[data-submit]")).toBeEnabled();
      expect(await leads(page)).toEqual([]);
    }
    await page.locator("[data-submit]").click();
    await done(page);
    const reference = [...api.store.values()][0].reference;
    expect(await leads(page)).toEqual([["track", "Lead", {}, { eventID: reference }]]);
  });

  test("a double click, Enter and a resubmit after success fire one Lead", async ({ page }) => {
    await watchMeta(page);
    await open(page);
    const api = await mockApi(page);
    await fill(page);
    await page.locator("[data-submit]").dblclick();
    await page.locator("#inquiry-company").press("Enter").catch(() => {});
    await done(page);
    // Submitting the hidden form again sends nothing more.
    await page.evaluate(() => {
      const form = document.querySelector("[data-inquiry]");
      form.hidden = false;
      form.requestSubmit();
    });
    await page.waitForTimeout(500);
    expect(api.posts).toHaveLength(1);
    const reference = [...api.store.values()][0].reference;
    expect(await leads(page)).toEqual([["track", "Lead", {}, { eventID: reference }]]);
  });

  test("a filled honeypot gets the decoy success but no Lead", async ({ page }) => {
    await watchMeta(page);
    await open(page);
    const api = await mockApi(page);
    await fill(page);
    await page.locator("#inquiry-website").evaluate((el) => (el.value = "https://spam.example"));
    await page.locator("[data-submit]").click();
    await done(page);
    expect(api.posts[0].website).toBe("https://spam.example");
    expect(await leads(page)).toEqual([]);
  });

  test("with Meta's script blocked the form still succeeds, without errors", async ({ page }) => {
    const seen = await watchMeta(page, { block: true });
    await page.goto(HOST + "/");
    await page.waitForFunction(() => document.querySelector("[data-inquiry][data-ready]"));
    const api = await mockApi(page);
    await fill(page);
    await page.locator("[data-submit]").click();
    await done(page);
    expect(api.store.size).toBe(1);
    expect(seen.errors.filter((e) => !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(e))).toEqual([]);
  });
});

// The headers vercel.json gives a path: every matching rule in order, later
// rules overriding earlier ones (as Vercel and scripts/serve.mjs apply them).
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const headersFor = (path) => {
  const out = {};
  for (const rule of vercel.headers) {
    if (new RegExp("^" + rule.source.replace(/\(\.\*\)/g, ".*") + "$").test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
};

test.describe("CSP", () => {
  test("encoded admin filenames retain the complete private response policy", async ({ request }) => {
    for (const path of ["/%61dmin", "/ad%6din", "/%61%64%6d%69%6e", "/%61%64%6D%69%6E", "/%61dmin.html"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(await response.text(), path).toContain('<title>Inquiries · Energia AI</title>');
      expect(response.headers(), path).toMatchObject({
        "content-security-policy": STRICT,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-robots-tag": "noindex, nofollow, noarchive",
      });
      expect(headersFor(path), path).toMatchObject({
        "Content-Security-Policy": STRICT,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      });
    }
  });

  test("only the home and privacy pages allow Meta's hosts; everything else keeps the strict policy", async ({ request }) => {
    for (const path of ["/", "/privacy"]) expect((await request.get(path)).headers()["content-security-policy"], path).toBe(PUBLIC);
    for (const path of ["/admin", "/admin.js", "/styles.css", "/robots.txt", "/missing"]) expect((await request.get(path)).headers()["content-security-policy"], path).toBe(STRICT);
    // The site-wide default is exactly the policy production had before.
    expect(vercel.headers[0].source).toBe("/(.*)");
    expect(headersFor("/x")["Content-Security-Policy"]).toBe(STRICT);
    for (const path of ["/", "/privacy"]) expect(headersFor(path)["Content-Security-Policy"], path).toBe(PUBLIC);
    // Vercel also serves the dashboard at /admin/ (and the privacy page at
    // /privacy/): those variants must fall back to the strict policy, and the
    // dashboard keeps no-store, no-referrer and noindex on every variant.
    for (const path of ["/admin", "/admin/", "/admin%2F", "/admin.html", "/admin.js", "/privacy/", "/privacy.html", "/index.html"]) {
      expect(headersFor(path)["Content-Security-Policy"], path).toBe(STRICT);
    }
    for (const path of ["/admin", "/admin/", "/admin%2F", "/admin.html"]) {
      expect(headersFor(path), path).toMatchObject({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" });
    }
  });

  test("a foreign script, connection or image is still blocked on the public page", async ({ page }) => {
    const seen = await watchMeta(page);
    await open(page);
    const result = await page.evaluate(async () => {
      const load = (src) => new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve("loaded");
        s.onerror = () => resolve("blocked");
        document.head.appendChild(s);
      });
      const out = {
        foreign: await load("https://cdn.example.com/evil.js"),
        // Meta's beacon host is for images and beacons, not scripts.
        beaconHost: await load("https://www.facebook.com/evil.js"),
        inline: (() => {
          const s = document.createElement("script");
          s.textContent = "window.__inline = true";
          document.head.appendChild(s);
          return window.__inline === true ? "ran" : "blocked";
        })(),
      };
      try { await fetch("https://api.example.com/x"); out.fetch = "sent"; } catch { out.fetch = "blocked"; }
      out.image = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve("loaded");
        img.onerror = () => resolve("blocked");
        img.src = "https://img.example.com/p.gif";
      });
      await new Promise((r) => setTimeout(r, 200));
      return out;
    });
    expect(result).toEqual({ foreign: "blocked", beaconHost: "blocked", inline: "blocked", fetch: "blocked", image: "blocked" });
    const violations = await page.evaluate(() => window.__csp);
    expect(violations).toEqual(expect.arrayContaining([
      { directive: "script-src-elem", blocked: "https://cdn.example.com/evil.js" },
      { directive: "script-src-elem", blocked: "https://www.facebook.com/evil.js" },
      { directive: "script-src-elem", blocked: "inline" },
      { directive: "connect-src", blocked: "https://api.example.com/x" },
      { directive: "img-src", blocked: "https://img.example.com/p.gif" },
    ]));
    // CSP stopped each of them in the browser: none completed.
    for (const url of ["https://cdn.example.com/evil.js", "https://www.facebook.com/evil.js", "https://img.example.com/p.gif"]) {
      expect(seen.failed[url], url).toBe("csp");
      expect(seen.finished).not.toContain(url);
    }
    expect(seen.offsite.filter((u) => !seen.failed[u])).toEqual([FBEVENTS]);
  });

  test("Meta's script is blocked on /admin", async ({ page }) => {
    await watchMeta(page);
    await page.route("**/api/admin**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
    await page.goto(HOST + "/admin");
    const outcome = await page.evaluate(() => new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      s.onload = () => resolve("loaded");
      s.onerror = () => resolve("blocked");
      document.head.appendChild(s);
    }));
    expect(outcome).toBe("blocked");
    expect(await page.evaluate(() => window.__csp)).toContainEqual({ directive: "script-src-elem", blocked: FBEVENTS });
  });
});

test.describe("indexing", () => {
  test("robots allows the site, keeps /admin and /api out, and names the sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toBe("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://www.energiaigroup.com/sitemap.xml\n");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()["content-type"]).toMatch(/^application\/xml/);
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(["https://www.energiaigroup.com/", "https://www.energiaigroup.com/privacy"]);
  });

  test("public pages are indexable with a canonical; /admin and /api stay noindex", async ({ request }) => {
    for (const [path, canonical] of [["/", "https://www.energiaigroup.com/"], ["/privacy", "https://www.energiaigroup.com/privacy"]]) {
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"], path).toBeUndefined();
      const html = await res.text();
      expect(html, path).not.toMatch(/noindex|name="robots"/);
      expect(html.match(/rel="canonical"/g), path).toHaveLength(1);
      expect(html, path).toContain(`<link rel="canonical" href="${canonical}">`);
    }
    const admin = await request.get("/admin");
    expect(admin.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
    expect(admin.headers()["cache-control"]).toBe("no-store");
    expect(await admin.text()).toContain('<meta name="robots" content="noindex, nofollow, noarchive">');
    // /api is served by functions on Vercel; the header comes from vercel.json.
    const api = vercel.headers.find((r) => r.source === "/api/(.*)");
    expect(api.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    expect(vercel.headers.find((r) => r.source === "/(.*)").headers.map((h) => h.key)).not.toContain("X-Robots-Tag");
  });
});

test.describe("privacy wording", () => {
  test("names the Meta pixel and its cookies truthfully and keeps the existing promises", async ({ page }) => {
    await watchMeta(page);
    await page.goto(HOST + "/privacy");
    const text = await page.locator("main").innerText();
    expect(text).toContain("This website uses the Meta pixel, a measurement tool from Meta Platforms");
    expect(text).toContain("tells Meta the address of the page you viewed, including any campaign tags in it, and, if your browser shares it, the page you came from, such as Facebook or Instagram.");
    expect(text).toContain("It also gives Meta your IP address and details about your browser and device, such as its screen size and time zone.");
    expect(text).toContain("The pixel may set two cookies on this site: _fbp, which lets Meta recognize your browser on later visits, and _fbc, which records that you arrived through a link on Facebook or Instagram, such as one of our ads.");
    expect(text).toContain("Meta may also read or set its own cookies on facebook.com, which can let it connect your visit to a Facebook or Instagram account you are signed in to.");
    expect(text).toContain("Meta handles this information under its own privacy policy.");
    expect(text).toContain("When you send the form, the pixel tells Meta that an inquiry was sent, with its reference number. It does not send your answers.");
    expect(text).toContain("Apart from the Meta pixel, the site uses no analytics, advertising tools or third party scripts, and sets no cookies of its own for visitors.");
    // The old claims are gone.
    expect(text).not.toMatch(/No tracking|uses no analytics, advertising pixels|sets no cookies for visitors|browser type|such as a Meta ad/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "How Energia AI handles the details you send through the inquiry form, and what the Meta pixel measures on this site.");
    // Unchanged promises.
    expect(text).toContain("We do not sell them, share them for marketing or add you to a mailing list.");
    expect(text).toContain("We keep inquiries until we no longer need them or you ask us to delete them.");
    expect(text.trim()).toMatch(/Updated October 28, 2026$/);
    // American spelling, no dashes, no invented entities.
    expect(text).not.toMatch(/[‐-―−–—]| - |\b(Inc|Ltd|LLC|Limited|Ireland)\b|recognise|organisation|analyse/);
    await expect(page.locator("h2#tracking")).toHaveText("Meta pixel");
  });
});
