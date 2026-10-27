# Energia V3 copy

Selected B. Source of truth: `index.html`. Audience: commercial building owners and facilities teams. Purpose: explain the control design and invite a building-fit conversation via the existing mailto. The day is an illustrative mechanism, not live product UI.

## Page text in DOM order

Skip to content

The day

How it learns

Limits

Questions

Talk to us

Menu

HVAC control that sees the day coming.

Energia AI is an AI control platform for commercial HVAC, designed to learn how your building heats and cools and plan setpoints around weather and occupancy.

Talk about your building

The load on your building changes by the hour.

A fixed schedule does not adjust when the weather or occupancy changes. Energia AI plans for both. Step through one day in an illustrative building.

06:30 Dawn

10:00 Floors fill

15:30 West sun

19:30 Evening

What Energia AI does

Plans the day from the forecast and your occupancy schedule, including when each zone should start conditioning so it is ready on time.

06:30 Before anyone arrives

What changes

The forecast shows a clear, warm afternoon. The building is still empty and the low sun is on the far side.

What Energia AI does

Keeps occupied zones inside the setpoint range you approved, with outdoor air at or above your ventilation minimums.

10:00 Floors fill up

What changes

People arrive, and the morning sun moves onto the south face.

What Energia AI does

Began cooling the west zones before the sun reached them, using the forecast, and now holds them inside your range.

15:30 Sun on the west glass

What changes

The sun is low in the west and falls straight onto the west windows. Those rooms are now gaining heat fastest.

What Energia AI does

Lets empty zones move within the wider unoccupied range you set, keeps occupied rooms in range, and starts on tomorrow’s plan.

19:30 The building empties

What changes

Most people have gone home. A few rooms are still in use.

An illustrative day in a fictional building, rendered for this page. The times and actions are examples, not readings from a real site.

It starts with a model of your building.

Your floor plans become thermal zones. Energia AI then learns how each zone responds to sun, people and your HVAC. West zone Corner South zone Interior West zone Corner South zone Interior

The first floor of the same fictional building at 15:30, cut below the ceiling. The dark area is the building core. Outlines show how a plan divides into zones. The fine grid stands for the control volumes the model uses to calculate heat flow.

Model

We build a thermal model from floor plans, HVAC equipment data and operating history. Physics describes how heat moves between zones. A neural network learns what physics misses.

Train

A reinforcement learning agent practises inside that model across simulated weather and occupancy. It is rewarded for holding comfort and penalized for wasted energy.

Control

On each control cycle it reads the building, checks the forecast and proposes setpoints. Your limits check every proposal before it reaches your building management system (BMS).

Your team sets the limits.

The control architecture is designed around boundaries agreed with your facilities team. Every proposed setpoint is checked against them before it reaches your BMS.

Setpoint range

Heating and cooling setpoints stay inside the range you approve, with a deadband between them to avoid simultaneous heating and cooling.

Fresh air

Outdoor air minimums for your site, based on standards such as ASHRAE 62.1, are control constraints. Ventilation is not reduced below those minimums to save energy.

Equipment

Equipment limits are agreed with your facilities team before control is enabled.

Fallback

If the connection drops or a reading looks wrong, control returns to your existing sequences.

Life safety

Fire, smoke and critical equipment alarms take priority. Energia AI steps back and your building’s own systems and manual override take over.

Your BMS

We connect through open protocols such as BACnet and Modbus. Compatibility is confirmed with your team in an assessment.

What it takes to start.

From a first look at your building to a gateway beside your BMS.

Assessment

We review your HVAC equipment, BMS points and trend history, and confirm protocol compatibility with your team.

Model and comparison

We build the model from your floor plans and operating data, then compare a proposed control strategy with how the building runs today. Simulation results are not a guarantee of savings in your building.

Gateway

A small gateway next to your BMS reads points and writes setpoints over your building’s protocols. The AI runs on the gateway or in our cloud, depending on your security requirements.

Questions

Which buildings is Energia AI for?

Commercial buildings with central HVAC run through a building management system. An assessment tells us whether yours is a good candidate.

What data do you need?

Floor plans, HVAC equipment details, BMS points with trend history, and your occupancy schedules. Weather forecasts come from public sources.

Can operators take control back?

Yes. Your existing control sequences stay in place. Operators keep manual override, and if Energia AI loses its connection or sees bad data, control returns to those sequences.

Talk about your building.

Tell us what you run and what you want to fix. We will tell you plainly whether Energia AI is a fit.

Talk about your building

edo.orfanini@energiaigroup.com

Email

LinkedIn (opens in a new tab)

Images are original renderings of a fictional building, not a client installation.

© 2026 Energia AI

## Editing record

The retained implementation was written by Claude; this continuation was edited by Codex, giving it a different model-family editorial pass without launching another model process. The inherited progress log reports a 5/5 pattern check; a new local checker receipt is recorded in `copy-check.log` in the V3 evidence root.

- Preserved the selected headline, changing-day story, floor-plan explanation, operator boundaries, numbered start sequence and FAQ.
- Changed the short dawn tab from “Before arrival” to “Dawn” so narrow controls remain readable; the panel still says “Before anyone arrives”.
- Qualified the hero with “designed to” and shortened its explanation. The primary technical document describes forecast integration and equipment extensions as design work; no field deployment is inferred.
- Checked the wording against Core MVP and the technical architecture, separately from the pattern checker. Kept explicit simulation, compatibility and illustrative-day qualifications.
- No customer-facing dashes, fabricated readings, testimonials, logos, savings percentages or performance guarantees were added. Existing manual override and fallback details remain.

No model subprocess or paid API was used for editing. The pattern checker does not establish truth or writing quality; the contextual editorial review and source map are separate evidence.

## Round 1 corrections

Moved each existing control-action paragraph before its image without changing its wording or duplicating it. Added “The dark area is the building core.” to the plan caption.

Meta description: Energia AI is an AI control platform for commercial HVAC, designed to learn how your building heats and cools and plan setpoints around weather and occupancy, inside the limits your team sets.
