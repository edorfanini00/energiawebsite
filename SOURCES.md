# SOURCES

Where each brand asset, image, font, design reference and product claim comes from.

## Brand

| Item | Source | How it is used |
|---|---|---|
| Wordmark | https://framerusercontent.com/assets/c0LHicZODGuq8EA3pLRTvE1njg.png (626×417 RGBA, white glyphs, sha256 `5899975f07aa714ead0d1df95d39288bd00148f8f3135663ca7db5f91f4baa6d`), linked from https://www.energiaigroup.com/ | Cropped to its alpha bounding box (424×48), with the original alpha kept and the fill set to ink `#171814`. Saved as `assets/brand/energia-ai-wordmark-ink.png`. No new mark was drawn. |
| Favicon | The first glyph (E) of the same wordmark | Paper glyph on an ink square, 64×64: `assets/brand/favicon.png` |
| Green `#567740` | Live site design token `--token-d2c4f753-…: #567740` in the HTML served by energiaigroup.com (read 2026-10-27) | Primary CTA background (white text, 5.11:1) and focus ring |
| Light green `#82c95e` | `rgb(130, 201, 94)` in the same live HTML | Focus ring on the ink operator-limits section |
| Typeface | The live site's computed styles use Satoshi for headings and UI | Self-hosted Satoshi 300 (Light), 400 and 700 woff2 from Fontshare (Indian Type Foundry), under the ITF Free Font License (FFL) v2.0. https://www.fontshare.com/licenses/itf-ffl, read 2026-10-27, says “All Fontshare fonts are 100% free for personal and commercial use” and covers self-hosting. Files are in `assets/fonts/`. `satoshi-300.woff2` is the woff2 that Fontshare's own CSS API (`api.fontshare.com/v2/css?f[]=satoshi@300`) points to on cdn.fontshare.com. Its name table reads “Satoshi Light”, usWeightClass 300, sha256 `8a24f395b65048dea9dece6444525fa3adf180057d82c3f831095bff3feda5a0`. It is a genuine light master, not a synthesized weight. The 500 weight is no longer used and was removed. |
| Contact | `mailto:edo.orfanini@energiaigroup.com`, the published contact. LinkedIn: https://www.linkedin.com/company/energia-ai/ | Every CTA is a plain mailto link. The page has no forms or data submission; it requests only same-origin page assets. |

The live site's other claims were deliberately not reused because nothing in the sources substantiates them: “patent pending”, “Up to 30%”, “Up to 45%”, BACnet/Modbus/LonWorks “connects to” as blanket claims, tenant billing, carbon credit marketplace and the AI chatbot.

## V3 product claims and scope

Primary authority: `/Users/edorfanini/Desktop/EnergiAI/docuento tecnico/Energia AI tehnical document-.pdf` and `/Users/edorfanini/Desktop/EnergiAI/Core MVP Goal/Core MVP Goal.docx`. Preserved extracts read during continuation are `sources/tech-doc.txt` and `sources/core-mvp.txt` in the V3 evidence root. The technical document distinguishes the existing SBCS simulator from proposed deployment architecture. Core MVP describes simulation first, then gateway deployment. Neither proves a field installation or realized savings.

- Hero: commercial HVAC control, a thermal model, weather and occupancy inputs, and anticipatory setpoints describe the design intent in technical document Parts 1 and 4–6 and Core MVP Automated HVAC Adjustments. The page says “designed to”; it does not claim a deployed forecast-enabled controller. Part 3 explicitly lists forecast integration, radiative heat transfer and expanded equipment actuation as simulator limitations.
- The day: 06:30, 10:00, 15:30 and 19:30 are fictional scenario times. Dawn illustrates scheduled conditioning; morning illustrates approved setpoints and ventilation constraints; afternoon illustrates forecast-led cooling; evening illustrates occupied/unoccupied targets. Core MVP section 2 supports anticipatory control as an objective. Technical document Parts 4–5 describe the forecast/control design, and section 7.6 describes constraints. These scenes are not simulator output, telemetry, measured comfort or a customer case study. The nearby caption states that times and actions are examples.
- Model: thermal zones and the control-volume grid come from Part 1 and Part 2 steps 1–3. Physics plus a GRU neural layer, simulation training with Soft Actor-Critic, and a comfort/energy reward come from Part 1. The floor-plan overlay is explanatory geometry on the fictional building, not a real model output or product interface.
- Control: reading the building, forecasts, proposed setpoints and checking limits before BMS writes map to Part 4 sections 3–4 and 7.6. Operator-defined limits, fallback and emergency priority describe architecture, not certification. The page explicitly introduces them as design boundaries.
- Limits: setpoint range/deadband, fresh-air minimums, equipment constraints and life-safety priority map to section 7.6. ASHRAE 62.1 is named by the supplied architecture; no current compliance or certification is claimed. Connection/data fallback maps to Part 4 section 4 and the Integration layer.
- Getting started and FAQ: floor plans, equipment metadata, trend history and occupancy schedules map to Part 2. Gateway, edge/cloud inference and BACnet/Modbus architecture map to Parts 4 and 6. Protocol compatibility is assessed with the facilities team; universal integration is not asserted.
- Savings: Core MVP's 15–25% is a simulation target. The baseline-versus-policy report's modeled results are not used as field proof. The page shows no percentage, customer, testimonial, savings guarantee, deployment count or fabricated reading. It explicitly says simulation results do not guarantee building savings.

## Selected composition and retained reference evidence

Evidence root: `/Users/edorfanini/.hermes/workspace/energia-landing-v3-20261027`.

Research and artwork were completed before this continuation. No new research, paid assets, image generation or rendering was performed. `DIRECTION.md` records actual comparisons and selects B. `candidates/` preserves the A/B desktop and phone screenshots. `references/` preserves the original fresh-load captures; these are evidence only, never shipped assets.

- BrainBox AI (`https://brainboxai.com/en/`): observed light type, restrained first-view copy and real-scale architecture. B borrows hierarchy and scale principles, while placing all text on warm paper to solve the actual overlay contrast failures in A.
- Phasic (`https://www.phasic.ai/`, Awwwards nominee listing): observed one changing visual explaining a mechanism. The four-state building day serves that explanatory role here. No SOTD status is claimed for Phasic.
- Sustainable Metal Cloud (`https://smc.co/`, nominee listing): restrained brand green was considered. No artwork or branded motif is reused.
- LPAS and Belgrade Arbor: retained SOTD reference captures and listing evidence informed architectural context, daylight, warm interiors and the plan view. `DIRECTION.md` distinguishes observed qualities from the chosen implementation.

B uses the saved paper headline/panorama and the vertical desktop day list. Final corrections follow its written rules: 60px desktop / 34px phone H1, a single visible first-view CTA, and a short phone tab label. The original prototype routes retain their frozen stylesheet for comparison and are excluded from preview deployment.

## V3 image provenance

Every rendered image shows the same fictional building. No reference image, stock photo, purchased asset or customer installation appears. Only optimized assets in `assets/img/` ship.

- Editable scene: `art/blend/v3-c2-final.blend` in the V3 evidence root; SHA-256 `7b75118dc52f719420f5848cf35491a5c9145576eeb8805099e997b54fcc27b4`.
- Scene authoring and read-only rendering: `art/scripts/build_scene.py`, `render_view.py`, `run_render.sh`, `run_finals.sh`. Render receipts and per-shot logs are beside the raw masters. `art/masters/finals-status.log` records successful serial exits for all 12 shots.
- Raw masters: `art/masters/{hero-desktop,hero-phone,day-{dawn,morning,afternoon,dusk}-{desktop,phone},plan-desktop,plan-phone}.png`. Hero cameras are street-level; day cameras are the raised rooftop vantage; plan cameras are overhead cuts. Each phone view has its own camera.
- Retouch: eight day masters have a disclosed sky-horizon hairline cleanup in `art/masters/retouched/`, made by `art/scripts/retouch_horizon.py`. Original masters remain intact. `retouch-log.jsonl` records full input/output hashes and changed-pixel counts. The verifier confirms all changed pixels are confined to the recorded narrow horizon rows and flat sky runs reaching a frame edge; the rest is unchanged. No geometry, window, tree or light was repainted.
- Encoding inputs: `art/masters/web/` contains byte-identical copies of those eight retouches and the four unchanged hero/plan masters. Pass this directory to `scripts/export-art.sh`, not the raw master directory.
- Responsive files: **70**, verified by decoding, dimensions and SHA-256. Hero: 10; four day states: 48; plan: 12. The inherited “56 exports” was an incorrect count. All 70 total 6,606,615 bytes on disk; browsers request a responsive subset.
- Encoding: ffmpeg Lanczos resize to width with even height, WebP quality 80/method 6/sharp YUV, AVIF quality 60/speed 4/YUV 444. The existing export log is `art/logs/export.log`.
- Full machine-readable inventory: `ART-MANIFEST.json` in the evidence root, generated by `python3 scripts/verify-art.py <evidence-root>`. It includes actual absolute paths, full hashes, dimensions, bytes, render settings/camera receipts, raw → retouch → encoding-input → responsive-export lineage, scripts and limitations.

The historical render receipts identify temporary scene copies and omit full scene hashes; their final-run log records a 16-character source prefix that matches the retained scene. The export log omits per-file source hashes. The continuation verified preserved files and lineage without claiming a new render or byte-for-byte encoder reproduction.

Plan labels and outlines use the retained cameras' plan coordinates, documented alongside the SVG in `index.html`. They are real text and vector outlines over the original render, not baked-in UI. Phone framing crops the floor plan and uses its matching overlay.

Known visual limits: original CGI, no people, repeated architectural/tree structure, and some stylization. The phone hero deliberately crops away its unused sky field. Local checks do not establish universal visual quality or photorealism. Independent current-head review and hosted preview verification remain parent-owned gates.
