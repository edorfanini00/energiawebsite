import { test, expect } from "@playwright/test";

test("pilot invitation preserves contact focus and describes a bounded measured offer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-cta]")).toHaveText(["Discuss a pilot", "Discuss a pilot"]);
  for (const cta of await page.locator("[data-cta]").all()) await expect(cta).toHaveAttribute("href", "#contact");
  await expect(page.locator("#contact-title")).toHaveText("Start with one building.");
  await expect(page.locator("#inquiry-title")).toHaveText("Request a pilot discussion");
  await expect(page.locator(".start__steps h3")).toHaveText(["Review the building", "Agree the pilot", "Measure the result"]);
  const start = page.locator("#start");
  for (const phrase of ["HVAC running beyond occupancy", "recurring manual adjustments", "unexplained energy use", "existing commercial building with compatible central controls", "existing controls provider", "metering", "who pays and retains the bill savings", "baseline", "control permissions", "field comparison", "weather and occupancy", "cost and comfort together"]) {
    await expect(start).toContainText(phrase);
  }
  const includes = page.locator(".faq__item").filter({ hasText: "What does a pilot include?" });
  await includes.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(includes.locator("p")).toBeVisible();
  await expect(includes).toContainText("measurement period and responsibilities are agreed");
  await page.keyboard.press("Enter");
  await expect(includes.locator("p")).toBeHidden();
  await page.locator(".bar__cta").click();
  await expect(page.locator("#inquiry-name")).toBeFocused();
});

test("control, fallback and integrations remain site prerequisites", async ({ page }) => {
  await page.goto("/");
  const row = label => page.locator(".ledger__row").filter({ has: page.locator("dt", { hasText: label }) });
  const intro = page.locator("#limits .lede");
  await expect(intro).toContainText("Your team approves the operating boundaries and can review control changes");
  await expect(intro).toContainText("Before control begins, we verify permissions, manual override and fallback with your engineer and existing controls provider");
  await expect(row("Setpoint range")).toContainText("We agree permitted setpoint ranges and verify the heating and cooling deadband with your engineer");
  await expect(row("Fresh air")).toContainText("We agree ventilation requirements with your engineer and verify how the pilot will preserve them");
  await expect(row("Equipment")).toContainText("We agree equipment limits and permitted changes with your facilities team and controls provider");
  await expect(row("Fallback")).toContainText("We test the return to existing controls and manual override on site");
  await expect(row("Fallback")).toContainText("connection loss and unreliable readings");
  await expect(row("Life safety")).toContainText("We verify the pilot’s control boundaries against your site’s fire, smoke and critical equipment protections");
  await expect(row("Your BMS")).toContainText("assess BACnet or Modbus compatibility");
  await expect(row("Your BMS")).toContainText("before committing to a pilot");
  // Consolidate the gate in the introduction without shifting work to the buyer.
  await expect(page.locator("#limits")).not.toContainText(/your engineer must|must approve|before a pilot can control equipment/i);
  const control = page.locator(".faq__item").filter({ hasText: "Can operators take control back?" });
  await expect(control).toContainText("Your team retains control authority");
  await expect(control).toContainText("Before enabling equipment control, we agree approvals and visibility");
  await expect(control).toContainText("verify manual override and fallback on site with your engineer and existing controls provider");
});

test("all scenarios and collapsed FAQs distinguish preparation from field evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#day .lede")).toContainText("This example shows how predictive control could help");
  await expect(page.locator(".moment__action-label")).toHaveText(Array(4).fill("Possible control action"));
  await expect(page.locator(".hero__line")).toContainText("It learns your building’s response to weather, occupancy and control changes");
  await expect(page.locator(".hero__line")).toContainText("measured pilot within your team’s operating limits");
  await expect(page.locator("#model .lede")).toContainText("learns how your building responds to weather, occupancy and HVAC changes");
  await expect(page.locator("#model .lede")).toContainText("available plans and operating data");
  await expect(page.locator(".steps li").last()).toContainText("learned building response helps evaluate adaptive HVAC setpoints");
  await expect(page.locator(".steps li").last()).toContainText("verify limits with your engineer and BMS provider before equipment control");
  await expect(page.locator(".steps")).toContainText("scope depends on the control issue and data available");
  const savings = page.locator(".faq__item").filter({ hasText: "How much could my building save?" });
  await expect(savings).toContainText("Savings must be established by a measured pilot");
  await expect(savings).toContainText("not measured field savings");
  // textContent includes inactive day panels and closed FAQ answers. These
  // claims must not return in content hidden on the initial viewport either.
  const copy = await page.locator("main").textContent();
  for (const banned of [
    /If the connection drops/i, /control returns to (your existing|those) sequences/i,
    /Energia AI steps back/i, /Began cooling/i, /Keeps occupied rooms comfortable/i,
    /Your floor plans become thermal zones/i, /We connect through open protocols/i,
    /guaranteed? (savings|reductions|results)/i, /\d+(?:\.\d+)?\s*%/,
    /no hardware|all (BMS|BAS|HVAC) systems|certified|field proven/i,
    /\b\d+\s*(day|week|month)\s*(pilot|proof)/i,
  ]) expect(copy).not.toMatch(banned);
});
