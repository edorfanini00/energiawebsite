# SOURCES

Where each brand asset, image, font, design reference and product claim comes from.

## Brand

| Item | Source | How it is used |
|---|---|---|
| Wordmark | https://framerusercontent.com/assets/c0LHicZODGuq8EA3pLRTvE1njg.png (626×417 RGBA, white glyphs, sha256 `5899975f07aa714ead0d1df95d39288bd00148f8f3135663ca7db5f91f4baa6d`), linked from https://www.energiaigroup.com/ | Cropped to its alpha bounding box (424×48), with the original alpha kept and the fill set to ink `#171814`. Saved as `assets/brand/energia-ai-wordmark-ink.png`. No new mark was drawn. |
| Favicon | The first glyph (E) of the same wordmark | Paper glyph on an ink square, 64×64: `assets/brand/favicon.png` |
| Green `#567740` | Live site design token `--token-d2c4f753-…: #567740` in the HTML served by energiaigroup.com (read 2026-10-27) | Primary CTA background (white text, 5.11:1) and focus ring |
| Light green `#82c95e` | `rgb(130, 201, 94)` in the same live HTML | Rule labels on the ink section (8.89:1 on `#171814`) |
| Typeface | The live site's computed styles use Satoshi for headings and UI | Self-hosted Satoshi 400, 500 and 700 woff2 from Fontshare (Indian Type Foundry), under the ITF Free Font License (FFL) v2.0. https://www.fontshare.com/licenses/itf-ffl, read 2026-10-27, says “All Fontshare fonts are 100% free for personal and commercial use” and covers self-hosting. Files are in `assets/fonts/`. |
| Contact | `mailto:edo.orfanini@energiaigroup.com`, the published contact. LinkedIn: https://www.linkedin.com/company/energia-ai/ | Every CTA is a plain mailto link. The page has no forms and makes no network requests. |

The live site's other claims were deliberately not reused because nothing in the sources substantiates them: “patent pending”, “Up to 30%”, “Up to 45%”, BACnet/Modbus/LonWorks “connects to” as blanket claims, tenant billing, carbon credit marketplace and the AI chatbot.

## Product claims

| Claim on page | Source |
|---|---|
| AI control platform for commercial HVAC. It learns zone thermal behavior and adjusts setpoints, weighing energy against comfort. | *Energia AI technical document*, Introduction and Part 1 (`~/Desktop/EnergiAI/docuento tecnico/Energia AI tehnical document-.pdf`) |
| Reads weather forecasts and occupancy schedules | Technical doc, Data Aggregation and Forecasting Layer and Part 5 (NOAA/OpenWeather forecasts, occupancy schedules from the BMS). Energia consumes forecasts and does not produce weather forecasts. |
| Thermal model from floor plans, HVAC equipment and operating history. Physics plus a neural network. | Technical doc, Part 1: the SBCS hybrid simulator, finite-difference heat transfer between control volumes, and a GRU neural layer |
| A reinforcement learning agent trains in simulation and is rewarded for comfort and penalized for energy | Technical doc, Part 1 and section 3: Soft Actor-Critic, with a reward weighing comfort loss, energy and emissions |
| Each control cycle reads the building, checks forecasts, proposes setpoints, and checks them against limits before the BMS | Technical doc, section 4, Real-Time Inference Flow. The page leaves out the document's five-minute interval. |
| Setpoint range and deadband | Technical doc, section 7.6 (2), Temperature Setpoint Boundaries |
| Outdoor air minimums based on standards such as ASHRAE 62.1 are part of the control constraints | Technical doc, section 7.6 (1). This is a design requirement, so no certification or compliance is claimed. |
| Equipment limits are defined with the facilities team before control is enabled | A deliberately conservative statement. Technical doc Part 1 says fans, VAV dampers, pumps and actuator delays are not modelled in the current simulator, so the page promises nothing about those devices. |
| Fallback to existing sequences on a lost connection or bad data | Technical doc, section 4 (rule-based or MPC fallback) and the Integration layer. Written as architecture under “control architecture is designed around…”. |
| Life-safety alarms take priority | Technical doc, section 7.6 (6), Safety and Emergency Override Conditions |
| BACnet and Modbus; fit is confirmed in an assessment | Technical doc, Integration layer and Part 6 (BACnet/IP, Modbus TCP, OPC-UA). The page does not claim universal compatibility. |
| Gateway next to the BMS, with AI on the gateway or in the cloud | Technical doc, section 6 (cloud and edge inference) and Part 6 (gateway device) |
| How savings are assessed. No percentage is shown. | *Core MVP Goal.docx* gives 15 to 25% as a target, not a measured result. Per the parent review the page shows no figure. |

## Content references (structure only)

- **BrainBox AI** (https://brainboxai.com/, https://brainboxai.com/en/solutions/ai-control, https://brainboxai.com/en/articles/lifting-the-veil-on-brainbox-ais-data-architecture). The owner suggested it as a content reference for a company doing similar work. Taken from it: the order of the story (building behavior → decision → HVAC action → operator control → fit conversation) and the customer problems it names (fixed schedules, changing weather and occupancy, balancing cost and comfort, keeping the facilities team in charge). Not taken: any product name, accuracy figure, savings figure, command volume, testimonial, case study, control frequency or BACnet priority detail. None of these describe Energia.

## Design references (principles only, no assets reused)

Captured with Playwright on 2026-10-27 at 1440×900 and 390×844. Screenshots and computed styles are in `~/.hermes/workspace/energia-landing-20261027/evidence/ref-*`.

- **Phasic** (https://www.phasic.ai/; Awwwards nominee page https://www.awwwards.com/sites/phasic-energy). Observed: a single engineered object photographed in isolation on a light neutral ground, a very large display headline (H1 128px, weight 400, −3.84px tracking), one short supporting line, square-cornered CTAs and a strict frame grid. Used here: an isolated studio object as the hero image, large controlled type and square buttons.
- **Sustainable Metal Cloud** (https://smc.co/; Awwwards nominee page https://www.awwwards.com/sites/sustainable-metal-cloud). Observed: a white page with a single saturated brand green used for CTAs and key words. Used here: green kept for action only. Its swirling green ribbon and two-tone headline were not used.
- **Accenta** (https://www.awwwards.com/sites/accenta, honorable mention). Listed by the parent and not inspected in this build.
- **Current Energia site** (`current-site.png`): dark background, blurred teal and violet glows, pill chips, centered stack. This preview moves away from all of those.

No reference artwork, layout or copy was copied. No award status is claimed for this page.

## Imagery

All images on the page are original Blender renders made for this preview by the separate art worker. They are fictional architecture, not a client installation, and contain no baked-in labels or telemetry. Masters, the `.blend`, source scripts and the manifest are in `~/.hermes/workspace/energia-landing-20261027/art/`. See `ART-RESULT.md` there for the Blender version, engine, cameras and materials.

Responsive files in `assets/img/` are produced by `scripts/export-art.sh` (ffmpeg Lanczos resize, `cwebp -q 82`, `avifenc -q 62`).

Final masters integrated (art worker v7, `ART-RESULT.md`, `manifest.json`):

| Web files | Master | sha256 (master PNG) | Size | Camera | Edge colour |
|---|---|---|---|---|---|
| `hero-desktop-{1200,1800,2400}.{avif,webp}` | `art/hero-desktop.png` | `623af07b10a4b435e263bfbe3dd719c92c1ed8c6dcec33e96523135a8d5a155f` | 2400×1500 RGB | CAM_Hero_Desktop | `#cbc8c4` (CSS `--plate`) |
| `control-detail-{800,1200,1800}.{avif,webp}` | `art/control-detail.png` | `14b4239f6cb7c6660881a8769768b5ed0876215255bd7599d7f777dd591a7ba3` | 1800×1200 RGB | CAM_Control_Detail | `#aeaba5` (CSS `--plate-detail`) |

The portrait render `art/hero-mobile.png` (CAM_Hero_Mobile, sha256 `0a2d665f…`) is not used. On the page its plinth came within about 2 px of the frame edge at 390 px wide, and an inset on the plate colour showed visible seams. Phones show a 1:1 crop of the desktop hero instead, which is the same scene and camera, with about 15 px clear right of the plinth. A 5 to 8% pullback of CAM_Hero_Mobile has been requested through the parent.

Render details:

- Blender 5.2.1 LTS, Cycles on Metal GPU, 256 spp, AgX.
- Scene `art/blend/energia-architecture-v7-final.blend`. It uses procedural materials only, with no downloaded or paid assets.
- PSNR of the full-size exports against the masters: hero desktop AVIF 46.8 dB and WebP 44.9 dB; control detail AVIF 45.5 dB and WebP 41.2 dB.
