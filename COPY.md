# Energia V3 copy

Selected B. Source of truth: `index.html`. Audience: commercial building owners and facilities teams. Purpose: show owners what they gain (lower HVAC costs, comfort in occupied rooms, less routine adjustment), explain how the control design delivers it, and invite a specific first conversation via the existing mailto. The day is a scenario explaining the mechanism, not live product UI.

## Page text in DOM order

Skip to content

The day

How it learns

Limits

Questions

Discuss savings

Menu

Spend less on HVAC. Keep people comfortable.

Energia AI is an AI control platform for commercial HVAC, designed to reduce wasted heating and cooling and the routine adjustments your team handles every day.

Discuss your savings

What your building gains  *(screen reader heading, not shown)*

Lower operating costs

Heating and cooling run when and where spaces are in use, so less energy goes to empty rooms and unneeded runtime.

Comfort for occupants

Energia AI plans ahead for weather and the day’s schedule to keep rooms in use within the comfort range your team sets.

Less routine adjustment

Your team spends less time changing setpoints by hand and keeps oversight, limits and manual override.

The load on your building changes by the hour.

A fixed schedule does not adjust when the weather or occupancy changes. Energia AI plans for both, hour by hour.

06:30 Dawn

10:00 Floors fill

15:30 West sun

19:30 Evening

What Energia AI does

Starts each zone only as early as it needs to be ready when people arrive, not hours ahead on a fixed schedule.

06:30 Before anyone arrives

What changes

The building is empty. The forecast shows a warm afternoon.

What Energia AI does

Keeps occupied rooms comfortable inside your approved setpoint range, with fresh air at or above your ventilation minimums.

10:00 Floors fill up

What changes

People arrive, and the morning sun moves onto the south face.

What Energia AI does

Began cooling the west rooms before the sun reached them, so they stay comfortable instead of overheating.

15:30 Sun on the west glass

What changes

West windows catch the afternoon sun. Those rooms gain heat fastest.

What Energia AI does

Stops spending energy on empty rooms by moving them to your wider unoccupied range, while rooms still in use stay comfortable.

19:30 The building empties

What changes

Most people have gone home. A few rooms are still in use.

It starts with a model of your building.

Your floor plans become thermal zones. Energia AI then learns how each zone responds to sun, people and your HVAC.

West zone

Corner

South zone

Interior

West zone

Corner

South zone

Interior

The dark area is the building core. Outlines divide the floor into zones. The fine grid represents the control volumes used to calculate heat flow.

Model

Floor plans, HVAC data and operating history become a thermal model of how heat moves through your building.

Train

The AI practices across simulated weather and occupancy, learning to balance comfort and energy use before it controls any equipment.

Control

It proposes setpoints from current conditions and the forecast. Your limits check each one before it reaches your building management system (BMS).

Your team sets the limits.

The control design puts your facilities team in charge of operating boundaries, with checks before every setpoint reaches your BMS.

Setpoint range

Setpoints stay inside the range you approve, with a deadband to avoid simultaneous heating and cooling.

Fresh air

Your site’s outdoor air minimums, based on standards such as ASHRAE 62.1, are control constraints. Ventilation is not reduced below them to save energy.

Equipment

Your facilities team agrees equipment limits before control is enabled.

Fallback

If the connection drops or a reading looks wrong, control returns to your existing sequences.

Life safety

Fire, smoke and critical equipment alarms take priority. Energia AI steps back and your building’s own systems and manual override take over.

Your BMS

We connect through open protocols such as BACnet and Modbus, and confirm compatibility with your team during the assessment.

What it takes to start.

Find the opportunity, compare control strategies, then plan the integration.

Assessment

We review HVAC equipment, BMS points and trend history with your team to identify waste and confirm compatibility.

Model and comparison

We compare proposed control with current operation in a model of your building, evaluating cost and comfort together. Simulation results are not a guarantee of savings in your building.

Gateway

A gateway beside your BMS reads data and writes setpoints. Your security requirements decide whether the AI runs on the gateway or in our cloud.

Questions

Which buildings is Energia AI for?

Commercial buildings with central HVAC and a building management system. An assessment confirms suitability.

How much could my building save?

It depends on how your building runs today, its equipment, local weather, occupancy and energy prices. An assessment of your site looks at savings potential and comfort together.

What data do you need?

Floor plans, HVAC equipment details, BMS points with trend history, and your occupancy schedules. Weather forecasts come from public sources.

Can operators take control back?

Yes. Operators keep manual override and your existing control sequences. If the connection drops or data looks wrong, control returns to those sequences.

Find the savings opportunity in your building.

Tell us your building type, current HVAC and operating schedules. A first conversation covers where energy may be wasted, whether Energia AI fits your equipment and BMS, and how integration and savings measurement would work.

Discuss your savings

edo.orfanini@energiaigroup.com

Email

LinkedIn (opens in a new tab)

© 2026 Energia AI

## Editing record

The retained implementation was written by Claude; this continuation was edited by Codex, giving it a different model-family editorial pass without launching another model process. The inherited progress log reports a 5/5 pattern check; a new local checker receipt is recorded in `copy-check.log` in the V3 evidence root.

- Preserved the selected headline, changing-day story, floor-plan explanation, operator boundaries, numbered start sequence and FAQ.
- Changed the short dawn tab from “Before arrival” to “Dawn” so narrow controls remain readable; the panel still says “Before anyone arrives”.
- Qualified the hero with “designed to” and shortened its explanation. The primary technical document describes forecast integration and equipment extensions as design work; no field deployment is inferred.
- Checked the wording against Core MVP and the technical architecture, separately from the pattern checker. Kept explicit simulation and compatibility qualifications. The historical illustrative-day label was subsequently removed by the owner correction below.
- No customer-facing dashes, fabricated readings, testimonials, logos, savings percentages or performance guarantees were added. Existing manual override and fallback details remain.

No model subprocess or paid API was used for editing. The pattern checker does not establish truth or writing quality; the contextual editorial review and source map are separate evidence.

## Round 1 corrections

Moved each existing control-action paragraph before its image without changing its wording or duplicating it. Added “The dark area is the building core.” to the plan caption.

Meta description: Energia AI is an AI control platform for commercial HVAC, designed to learn how your building heats and cools and plan setpoints around weather and occupancy, inside the limits your team sets.

## Owner copy correction · 2026-10-27

Removed illustration explanations from the day introduction, day caption, plan caption and footer at the owner’s direction. The plan keeps its useful core, zone and control-volume explanation. Internal provenance remains here and in `SOURCES.md`; it is not page copy. No synonymous image labels were added. Technical simulation/results qualifications, design-intent metadata, all four controller actions and exact contact links remain unchanged. Frozen local-only prototypes are historical comparison evidence, not the served landing page.

## Benefits pass · 2026-10-27

Owner feedback: the page talked about the product but not savings, benefits, or why to talk to Energia. The page now leads with outcomes and uses the mechanism to explain them.

- Title, meta description and hero: “Spend less on HVAC. Keep people comfortable.” with one “designed to” qualification. Header CTA “Discuss savings”, hero and contact CTA “Discuss your savings”. Mailto addresses and subjects unchanged. `noindex, nofollow` kept.
- New `#benefits` row between the hero and the day: lower operating costs, comfort for occupants, less routine adjustment. It is a description list under a screen reader only H2 (“What your building gains”), with no visible eyebrow and no controls.
- The four day actions now state the owner gain: start only as early as needed, keep occupied rooms comfortable within approved limits, cool ahead of afternoon sun, stop spending energy on empty rooms.
- Model, limits and start copy condensed. The thermal model that Energia AI learns from, training in simulation, limit checks before BMS writes, deadband, ASHRAE 62.1 based fresh air minimums, life safety priority, BACnet/Modbus with assessment, and the simulation qualification are kept. American spelling (“practices”).
- New FAQ “How much could my building save?”: names the factors and says an assessment looks at savings potential and comfort together. No range.
- Contact: “Find the savings opportunity in your building.” Says what to send (building type, current HVAC, operating schedules) and what a first conversation covers (where energy may be wasted, equipment and BMS fit, how integration and savings measurement would work). No estimate, audit, report, booking tool or form.
- No savings percentages, ROI, customers, guarantees, image explanations or dash characters. Four alt texts lost compound hyphens (“Street level”, “late afternoon”, “Midmorning”, “Midafternoon”).
- Visible prose: 810 → 836 words (+26, +3.2%) by static count of `index.html`, despite the new 66 word benefits row, a new FAQ and a more specific contact. Evidence: `benefits-pass/copy-compare.json` in the V3 evidence root.

## Benefits pass, fix round 1 · 2026-10-27

Applied after two independent reviews of 7e6dbd1.

- CTAs read “Discuss savings” (header) and “Discuss your savings” (hero, contact), and the meta description ends “Discuss the savings opportunity in your building.”, because each link opens an email rather than a self serve tool. Mailto addresses and subjects unchanged.
- First benefit now parses: “Heating and cooling run when and where spaces are in use…”. The comfort benefit states the purpose (“to keep rooms in use within the comfort range your team sets”) rather than a measured result.
- Dawn action no longer contradicts itself: “Starts each zone only as early as it needs to be ready when people arrive, not hours ahead on a fixed schedule.”
- Day lede names the product once: “…Energia AI plans for both, hour by hour.”
- Contact lede avoids the repeated “HVAC” and names what is measured: “…whether Energia AI fits your equipment and BMS, and how integration and savings measurement would work.”
- American English in alt text: “sidewalk” instead of “pavement” (hero and 15:30), “across an intersection” instead of “across a crossing” (hero). The plan overlay source comment now says “meters” and “centered”.
- Headlines keep their sentences and phrases together: each hero promise is its own line at every width, “savings opportunity” stays on one line from 360px up, and below 360px the day heading sets “changes by the hour.” on its own line instead of splitting “your building”.
