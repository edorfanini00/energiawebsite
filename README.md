# Energia AI landing preview

A static landing page for Energia AI, an AI control platform for commercial HVAC.
It is plain HTML, CSS and JavaScript with no build step, framework, analytics or data collection. The selected B implementation uses a paper headline over a panorama, a keyboard/touch four-state building day, a plan cut, operator limits, an assessment sequence and FAQ.

**Status: draft preview.** Every page carries `noindex` (meta tag, `X-Robots-Tag` header and `robots.txt`).
Do not deploy to production or change domains without owner approval.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The page |
| `styles.css` | Layout, type, color and motion (V3). Phone and tablet rules sit next to each component. Selected B places the headline on paper and the desktop day list beside its changing render. Frozen prototype styles remain local-only. |
| `boot.js` | Tiny synchronous bootstrap in `<head>`: sets the header state before first paint, and restores the static fallback if `main.js` fails to load or throws during setup |
| `main.js` | Header state, the phone menu (Escape, focus return, inert when closed; the toggle is enabled once wired), the day tabs (WAI-ARIA tabs with arrow keys, Home/End and a focusable panel; every moment stays visible without it) and section reveals |
| `assets/fonts/` | Self-hosted Satoshi woff2 (300 Light, 400, 700) |
| `assets/brand/` | Official wordmark recolored to ink, and the favicon |
| `assets/img/` | Responsive AVIF and WebP exports of the V3 Blender renders: hero, the four moments of the day and the floor plan, each with its own phone render |
| `vercel.json` | Security headers (strict CSP, nosniff, frame deny, noindex) and asset caching |
| `.vercelignore` | Keeps tooling, tests and docs out of the deployed bundle |
| `scripts/serve.mjs` | Local static server that sends the same headers as `vercel.json` |
| `scripts/export-art.sh` | Exports the Blender PNG masters (hero, day moments, plan; desktop and phone) to responsive AVIF and WebP |
| `scripts/shots.mjs` | Fresh-load captures of the hero, each section and the full page at desktop, tablet, phone, narrow and landscape viewports, plus measured type |
| `tests/landing.spec.mjs` | Playwright behavior, layout and render checks |
| `COPY.md`, `SOURCES.md` | Final copy and editing record; provenance for assets and claims |

## Run locally

```bash
npm run serve          # http://127.0.0.1:4173
```

Opening `index.html` directly from disk also works. The server is only needed to test the headers.

## Test

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_GC=1 npm ci        # pinned @playwright/test 1.64.1
npm test                                     # all checks
SHOTS=1 SHOT_DIR=shots npm test              # checks plus screenshots
```

The tests use the installed Google Chrome when it is present and need no browser download.
On a machine without Chrome, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

The tests run at 1440×900, 768×1024, 390×844, 375×812, 320×740 and 844×390. They cover:

- console errors, failed requests and requests to any other origin
- fonts and images loaded, and no horizontal overflow
- every anchor, mailto and external link, and every asset served
- interactive targets of at least 44 px, and a visible focus ring
- the FAQ opening and closing from the keyboard
- the phone menu: toggle, Escape returning focus, removal from the tab order when closed, and closing on link click
- the page without JavaScript, and with reduced motion
- no overlap between header controls and hero copy (rectangle intersections) without JavaScript, and with `main.js` blocked; content stays visible and the nav usable in both cases
- printing shows sections that were never scrolled into view
- focus rings reach 3:1 against the actual rendered pixels around them, on paper, the white bar and inside the phone menu; a deliberately pale ring on paper must fail
- first paint with `main.js` held back matches the final header (no fallback menu, layout shift under 0.1, hero contact link usable, Menu disabled until wired), and five cold loads per viewport stay under 0.1 layout shift
- `boot.js` blocked keeps the static fallback with no late jump; `main.js` throwing during setup restores the fallback
- exactly two scripts (synchronous `boot.js` before the stylesheet, deferred `main.js`), no inline script or handler attributes, and a CSP that allows same-origin scripts only
- the local server answers a malformed URL with 400 and keeps serving (tooling only, not deployed)
- text contrast measured against actual hero background pixels (3:1 for the headline, 4.5:1 for smaller text) and on every solid section
- the type scale: Satoshi 300 headline at 56 to 60 px on desktop and 34 px on phones, line height and tracking, H2 and H3 sizes, 17 to 18 px ledes and 16 px secondary text (steps, rules, FAQ answers)
- one visible CTA in the hero, a quiet text link on phones, and the hero render not repeated later
- banned claims, dashes and `%` figures in the copy

## Update the renders

```bash
scripts/export-art.sh ~/.hermes/workspace/energia-landing-v3-20261027/art/masters/web   # hero-*, day-<moment>-*, plan-*
```

This needs `ffmpeg`, `cwebp` and `avifenc`.

## Deploy (preview only)

The Vercel project is `energiawebsite` (owner `edorfanini00s-projects`). Deploy a preview only, without `--prod`.
Then verify the deployed HTML, assets and headers before sharing the link.

## Retained artwork verification

`python3 scripts/verify-art.py /Users/edorfanini/.hermes/workspace/energia-landing-v3-20261027` checks all 12 raw masters, eight disclosed sky retouches, 12 encoding inputs and 70 responsive exports, then writes the private `ART-MANIFEST.json`. Requires Pillow and numpy. Full hashes, source-chain checks and historical receipt limitations are documented in `SOURCES.md`. This command does not render or encode images.
