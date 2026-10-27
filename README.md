# Energia AI landing preview

A static landing page for Energia AI, an AI control platform for commercial HVAC.
It is plain HTML, CSS and JavaScript with no build step, framework, analytics or data collection.

**Status: draft preview.** Every page carries `noindex` (meta tag, `X-Robots-Tag` header and `robots.txt`).
Do not deploy to production or change domains without owner approval.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The page |
| `styles.css` | Layout, type, color and motion. Desktop, tablet and phone compositions are written separately. |
| `main.js` | Header state, the phone menu (Escape, focus return, inert when closed) and section reveals |
| `assets/fonts/` | Self-hosted Satoshi woff2 (400, 500, 700) |
| `assets/brand/` | Official wordmark recolored to ink, and the favicon |
| `assets/img/` | Responsive AVIF and WebP exports of the Blender renders |
| `vercel.json` | Security headers (strict CSP, nosniff, frame deny, noindex) and asset caching |
| `.vercelignore` | Keeps tooling, tests and docs out of the deployed bundle |
| `scripts/serve.mjs` | Local static server that sends the same headers as `vercel.json` |
| `scripts/export-art.sh` | Exports Blender PNG masters to responsive AVIF and WebP |
| `tests/landing.spec.mjs` | Playwright behavior, layout and render checks |
| `COPY.md`, `SOURCES.md` | Final copy and editing record; provenance for assets and claims |

## Run locally

```bash
npm run serve          # http://127.0.0.1:4173
```

Opening `index.html` directly from disk also works. The server is only needed to test the headers.

## Test

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_GC=1 npm install   # pinned @playwright/test 1.64.1
npm test                                     # all checks
SHOTS=1 SHOT_DIR=shots npm test              # checks plus screenshots
```

The tests use the installed Google Chrome when it is present and need no browser download.
On a machine without Chrome, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

The tests run at 1440×900, 768×1024, 390×844 and 375×812. They cover:

- console errors, failed requests and requests to any other origin
- fonts and images loaded, and no horizontal overflow
- every anchor, mailto and external link, and every asset served
- interactive targets of at least 44 px, and a visible focus ring
- the FAQ opening and closing from the keyboard
- the phone menu: toggle, Escape returning focus, removal from the tab order when closed, and closing on link click
- the page without JavaScript, and with reduced motion
- text contrast measured against the hero render pixels
- banned claims, dashes and `%` figures in the copy

## Update the renders

```bash
scripts/export-art.sh path/to/hero-desktop.png path/to/control-detail.png
```

This needs `ffmpeg`, `cwebp` and `avifenc`.

## Deploy (preview only)

The Vercel project is `energiawebsite` (owner `edorfanini00s-projects`). Deploy a preview only, without `--prod`.
Then verify the deployed HTML, assets and headers before sharing the link.
