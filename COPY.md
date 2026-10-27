# COPY

Final visible copy for the landing preview (direction A), in page order, followed by the editing record.
The source of truth is `index.html`. Keep this file in sync when the copy changes.

Surface: Decide/Learn. Each section carries one idea:

1. Hero: what Energia AI is, in one headline and one category line.
2. Building: why one fixed schedule fails.
3. How it works: model, learn and control, then one control cycle as type.
4. Operator limits: the boundaries the system works inside.
5. Contact and FAQ: start a conversation about one building.

Every CTA is `mailto:edo.orfanini@energiaigroup.com?subject=Energia AI: our building`. That covers the bar ("Talk to us", inside the menu on phones), the phone hero link and the contact button ("Talk about your building").

## Page copy

Navigation: **How it works**, **Operator limits**, **Questions**, **Talk to us**.

**A building that thinks ahead.**

AI control for commercial HVAC.

Talk about your building

**No two buildings hold heat the same way.**

West glass takes the afternoon sun. A full floor on Tuesday runs warm by eleven. A fixed schedule does not adjust when the weather or occupancy changes. Energia AI learns how your building responds, then plans the next hours around it.

**From a model of your building to HVAC setpoints.**

Energia AI builds a thermal model of your building, trains a control agent inside it, then proposes setpoints that your limits check first.

**Model**

We build the model from floor plans, HVAC equipment and operating history. Physics describes how heat moves between zones. A neural network learns what physics misses.

**Learn**

A reinforcement learning agent trains inside that model across simulated weather and occupancy conditions. It is rewarded for holding comfort and penalized for wasted energy.

**Control**

On each control cycle the agent reads the building, checks the forecast and proposes new setpoints for your building management system (BMS).

One control cycle

- Read the building

- Check the forecast

- Propose setpoints

- Check your limits

- Write to your BMS

**Operators set the limits.**

The control architecture is designed around boundaries agreed with your facilities team. Every proposed setpoint is checked against them before it reaches your BMS.

**Setpoint range**

Heating and cooling setpoints stay inside the range you approve, with a deadband between them to avoid simultaneous heating and cooling.

**Fresh air**

Outdoor air minimums for your site, based on standards such as ASHRAE 62.1, are control constraints. Ventilation is not reduced below those minimums to save energy.

**Equipment**

Equipment limits are agreed with your facilities team before control is enabled.

**Fallback**

If the connection drops or a reading looks wrong, control returns to your existing sequences.

**Life safety**

Fire, smoke and critical equipment alarms take priority. Energia AI steps back and your building’s own systems and manual override take over.

**Your BMS**

We connect through open protocols such as BACnet and Modbus. Compatibility is confirmed with your team in an assessment.

**Talk about your building.**

Tell us what you run and what you want to fix. We will tell you plainly whether Energia AI is a fit.

Talk about your building edo.orfanini@energiaigroup.com

**Questions**

**Which buildings is Energia AI for?**

Commercial buildings with central HVAC run through a building management system. An assessment tells us whether yours is a good candidate.

**What data do you need?**

Floor plans, HVAC equipment details, BMS points with trend history, and your occupancy schedules. Weather forecasts come from public sources.

**How do you assess savings?**

We compare a proposed control strategy with how the building runs today. Results depend on your equipment and available operating data. Simulation results are not a guarantee of savings in your building.

**Does it need hardware on site?**

Expect a small gateway next to your BMS. It reads points and writes setpoints over your building’s protocols. The AI runs on that gateway or in our cloud, depending on your security requirements.

**Can operators take control back?**

Yes. Your existing control sequences stay in place. Operators keep manual override, and if Energia AI loses its connection or sees bad data, control returns to those sequences.

- Email

- LinkedIn (opens in a new tab)

Images are original concept renderings, not a client installation.

© 2026 Energia AI

## Editing record (V2, direction A)

- **Hero.** The five-line lede was removed from the art. The hero now carries only the headline and "AI control for commercial HVAC.", per the V2 brief (one hero idea, no paragraph over the art).
- **Shortened from 616f693.**
  - The How it works intro and steps.
  - The operator limits, which keep every fact.
  - "Fixed schedules treat every day the same." The clause "and correct a room only after it drifts" was dropped as too broad.
- **SlopMonster (2026-10-27).**
  - The checker scored 5/5 before and after editing.
  - The second pass was the Codex CLI via `cleanse.sh` with `DESLOP_WRITER=claude`. It exited 0. Its output and notes are in `~/.hermes/workspace/energia-landing-20261027/evidence/slopmonster-v2/`.
  - Accepted: "HVAC setpoints", "conditions", the "(BMS)" expansion, "not reduced below those minimums to save energy", "available operating data", and dropping "underneath".
  - Rejected:
    - The hero rewrite, which would break the one-line hero.
    - Every em dash, because customer-facing dashes are banned.
    - The shortened limits lede, which dropped the "checked before it reaches your BMS" fact.
  - Restored from the sourced copy: the deadband's purpose ("to avoid simultaneous heating and cooling") and "Energia AI steps back" for life safety.
- **Fix round 1 (after the independent reviews of 42fd9e1).** The sentence "Fixed schedules treat every day the same." became "A fixed schedule does not adjust when the weather or occupancy changes." Fixed schedules can vary by day of week, so the old sentence was broader than the point; reviewer A recommended the change. No other copy changed. The Tuesday example is illustrative, not a client result.
- **Claims.** No figures, savings, customers or deployments appear. Every fact maps to a row in `SOURCES.md`.
