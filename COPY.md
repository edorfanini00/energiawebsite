# COPY

Final visible copy for the landing preview, in page order, with the reasoning and the editing record.
The source of truth is `index.html`. Keep this file in sync when the copy changes.

Surface: Decide/Learn. Each section carries one idea:

1. Hero: what Energia AI is.
2. Building: why one fixed schedule fails.
3. How it works: model, learn, control.
4. Operator limits: the boundaries the system works inside.
5. Contact and FAQ: start a conversation about one building.

## Hero

**A building that thinks ahead.**

Energia AI is an AI control platform for commercial HVAC. It learns how each zone of your building heats and cools, reads weather forecasts and occupancy schedules, and adjusts setpoints before rooms drift. Every decision weighs energy against comfort.

CTA: **Talk about your building** (`mailto:edo.orfanini@energiaigroup.com?subject=Energia AI: our building`)

## Building

**No two buildings hold heat the same way.**

West glass takes the afternoon sun. A full floor on Tuesday runs warm by eleven. Fixed schedules treat every day the same and correct a room only after it drifts. Energia AI learns how your building responds, then plans the next hours around it.

## How it works

**From model to setpoint.**

- **Model.** We build a thermal model of your building from its floor plans, HVAC equipment and operating history. Physics describes how heat moves between zones. A neural network learns the behavior physics misses.
- **Learn.** A reinforcement learning agent trains inside that model across simulated weather and occupancy conditions. It is rewarded for holding comfort and penalized for wasted energy.
- **Control.** On each control cycle the agent reads the building, checks the forecast and proposes new setpoints. Every proposal is checked against your limits before it reaches the building management system.

## Operator limits

**Operators set the limits.**

Energia AI’s control architecture is designed around boundaries agreed with your facilities team. Every proposed setpoint is checked against them before it reaches your BMS.

- **Setpoint range.** Heating and cooling setpoints stay inside the range you approve, with a deadband between them to avoid simultaneous heating and cooling.
- **Fresh air.** Outdoor air minimums for your site, based on standards such as ASHRAE 62.1, are part of the control constraints. Ventilation is not traded for energy.
- **Equipment.** Equipment limits are defined with your facilities team before control is enabled.
- **Fallback.** If the connection drops or a reading looks wrong, control hands back to your existing sequences.
- **Life safety.** Fire, smoke and critical equipment alarms take priority. Energia AI steps back and your building’s own systems and manual override take over.
- **Your BMS.** We connect through open protocols such as BACnet and Modbus. Compatibility is confirmed with your team during an assessment.

## Contact and FAQ

**Talk about your building.**

Tell us what you run and what you want to fix. We will tell you plainly whether Energia AI is a fit.

- **Which buildings is Energia AI for?** Commercial buildings with central HVAC run through a building management system. An assessment tells us whether yours is a good candidate.
- **What data do you need?** Floor plans, HVAC equipment details, BMS points with trend history, and your occupancy schedules. Weather forecasts come from public sources.
- **How do you assess savings?** We compare a proposed control strategy with how the building runs today. Results depend on your equipment and the operating data your building keeps. Simulation results are not a guarantee of savings in your building.
- **Does it need hardware on site?** Expect a small gateway next to your BMS. It reads points and writes setpoints over your building’s protocols. The AI runs on that gateway or in our cloud, depending on your security requirements.
- **Can operators take control back?** Yes. Your existing control sequences stay in place underneath. Operators keep manual override, and if Energia AI loses its connection or sees bad data, control returns to those sequences.

Footer: Email, LinkedIn, “Images are original concept renderings, not a client installation.”, © 2026 Energia AI.

## Rules this copy follows

- No savings percentages, client names, testimonials, ratings, certifications or deployment counts. The 15 to 25% figure in the MVP document is a design target, so the page leaves it out entirely.
- No dashes in customer-facing text. Avoids “revolutionize”, “unlock”, “seamless” and future slogans. A Playwright test (`copy avoids unsupported claims…`) fails if these or a `%` figure return.
- Safety and fallback are written as control architecture under one “designed around” sentence. They are not presented as field-verified behavior.
- Equipment control is not promised for fans, pumps or valves. The technical document says the current simulator does not model them.
- Energia AI reads weather forecasts and occupancy schedules. It does not produce weather forecasts.
- BMS fit depends on an assessment. No “works with every system” or “no hardware” claims.
- Roadmap items (tenant billing, carbon credit marketplace, chatbot) are not mentioned.

## Editing record (SlopMonster)

The tool is SlopMonster at commit `3fc9787d9337b57c599a80afbefbbb3be5a8eb0b` (https://github.com/ItsssssJack/SlopMonster). Evidence is in `~/.hermes/workspace/energia-landing-20261027/evidence/slopmonster/`.

| Step | File | Result |
|---|---|---|
| Claude draft v1 | `draft-v1.md` | `deslop.py` 5/5 (`checker-draft-v1.txt`) |
| Cross-family pass | `cleanse-out.txt`, `cleanse-err.txt` | `tools/cleanse.sh` with `DESLOP_WRITER=claude` ran the Codex CLI (codex-cli 0.157.1, ChatGPT subscription login, no API key). Exit 0. |
| Review of Codex edits | `final-v2.md` | Accepted: the product category stated first, a fix to the fixed-schedule claim, and flags on the safety and hardware claims. Rejected: replacing the hero line and adding em dashes. |
| v2 | `final-v2.md` | 5/5 (`checker-final-v2.txt`) |
| Parent evidence corrections | `index.html` | Weather and occupancy inputs, equipment limits, ASHRAE wording, fallback framing, the savings FAQ, and simulated conditions |
| v3 on page | `index.html` | First run 4/5 (rule-of-three in the savings FAQ), reworded, then 5/5 (`checker-index-html-v3.txt`) |

A 5/5 score only means no scored patterns matched. The claims were checked separately against the sources listed in `SOURCES.md`.
