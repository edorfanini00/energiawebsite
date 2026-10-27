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

## Visual benchmark (principles only, no assets reused)

- **BrainBox AI home page** (https://brainboxai.com/en/). The owner named it as the visual benchmark after rejecting the 616f693 page. Fresh captures at 1440×900 and 390×844, with computed type, are in `~/.hermes/workspace/energia-landing-20261027/brainbox-reference/`.
  - Observed: Atlas Grotesk 300 at 56/61.6px (28px on phones), white over a sky-dominated photo of a real-scale building fragment from a low camera. The hero has no paragraph. The first feature is a 36px sentence heading with emphasis in bold.
  - Used here: light restrained display type (Satoshi 300, 56/30px), a life-size architectural fragment against sky, one hero idea, and sentence headings with weight emphasis.
  - Not used: any image, copy, metric, red tab, card carousel or layout grid. The headline is ink, not white, because white measured under 3:1 on our render.

## Earlier design references (616f693, superseded)

Captured with Playwright on 2026-10-27 at 1440×900 and 390×844. Screenshots and computed styles are in `~/.hermes/workspace/energia-landing-20261027/evidence/ref-*`.

- **Phasic** (https://www.phasic.ai/; Awwwards nominee page https://www.awwwards.com/sites/phasic-energy). Observed: a single engineered object photographed in isolation on a light neutral ground, a very large display headline (H1 128px, weight 400, −3.84px tracking), one short supporting line, square-cornered CTAs and a strict frame grid. Used here: an isolated studio object as the hero image, large controlled type and square buttons.
- **Sustainable Metal Cloud** (https://smc.co/; Awwwards nominee page https://www.awwwards.com/sites/sustainable-metal-cloud). Observed: a white page with a single saturated brand green used for CTAs and key words. Used here: green kept for action only. Its swirling green ribbon and two-tone headline were not used.
- **Accenta** (https://www.awwwards.com/sites/accenta, honorable mention). Listed by the parent and not inspected in this build.
- **Current Energia site** (`current-site.png`): dark background, blurred teal and violet glows, pill chips, centered stack. This preview moves away from all of those.

No reference artwork, layout or copy was copied. No award status is claimed for this page.

## Imagery

All images on the page are original Blender 5.2.1 Cycles renders made for this preview by the separate art worker.
- They show fictional architecture, not a client installation.
- They contain no baked-in labels, UI or telemetry.
- No downloaded, paid or reference imagery was used.
- The editable scenes, scripts, proofs and manifests stay private in `~/.hermes/workspace/energia-landing-20261027/art/brainbox-v2/`. Only the exported web files ship. See `V2-ART-RESULT.md` and `V2-FEATURE-ART-RESULT.md` there.

| Web files | Master | sha256 (master PNG) | Camera |
|---|---|---|---|
| `hero-desktop-{1440,2160,2880}.{avif,webp}` | `a-desktop.png` 3200×2000 | `125cebbde679541250c32407a03a7d1234f87f8fe5d0315d5f15a79ecaaa8539` | CAM_A_Desktop, 24 mm, eye height 1.7 m, corrected verticals |
| `hero-phone-{780,1170}.{avif,webp}` | `a-phone.png` 1290×2792 | `7ecf5c9ace66d782e0c39bc34a5053170319386b8b7c5ccceb5b477a942257fe` | CAM_A_Phone, 24 mm, 1.7 m |
| `feature-desktop-{1400,2100,2800}.{avif,webp}` | `feature-desktop.png` 2800×1200 | `cb6f28b80f9eb8fc297032e327480e5c2052fba37fccb260d90a6120714467a6` | CAM_Feature_Desktop, 35 mm, 1.7 m, west facade in low afternoon sun |
| `feature-phone-{600,900,1200}.{avif,webp}` | `feature-phone.png` 1200×1500 | `63e52b8b672a1058cf06475fe4c46dc5cfe8782876844b1353fa882b905153a3` | CAM_Feature_Phone, 35 mm, 1.7 m |

`scripts/export-art.sh` produces the responsive files: an ffmpeg Lanczos resize, then `cwebp -q 82` and `avifenc -q 62`.
- The hero and the first feature use different renders. No render is repeated on the page.
- The 616f693 renders (an isometric model on a grey plate) and the direction C rooftop renders are not in the bundle.
- The A/C prototypes remain in git history at tag `proto-ac-20261027`.
