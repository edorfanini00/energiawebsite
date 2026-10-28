# Energia AI landing preview

A static landing page for Energia AI, an AI control platform for commercial HVAC.
It is plain HTML, CSS and JavaScript with no framework. The only measurement is the Meta pixel (dataset “Energia AI Web”, `2313981812785333`) on the public pages. The contact section holds an inquiry form that stores answers in the site's own private database (Prisma Postgres through Vercel), read by the owner at `/admin`. The selected B implementation uses a paper headline over a panorama, a keyboard/touch four-state building day, a plan cut, operator limits, an assessment sequence and FAQ.

**Status: published** at `https://energiawebsite.vercel.app` (owner approved); the custom domain `www.energiaigroup.com` is the canonical host. API mode for local runs: `API=1 DATABASE_URL=... INQUIRY_ORIGINS=http://127.0.0.1:4173 INQUIRY_HASH_SECRET=... ADMIN_PASSWORD_HASH=... npm run serve`. The home and privacy pages are indexable, with canonical links to `https://www.energiaigroup.com`, `robots.txt` and `sitemap.xml`; `/admin` and `/api` stay `noindex`.
Do not change domains without owner approval.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The page |
| `styles.css` | Layout, type, color and motion (V3). Phone and tablet rules sit next to each component. Selected B places the headline on paper and the desktop day list beside its changing render. Frozen prototype styles remain local-only. |
| `boot.js` | Tiny synchronous bootstrap in `<head>`: sets the header state before first paint, and restores the static fallback if `main.js` fails to load or throws during setup |
| `pixel.js` | Meta pixel base code served from this site (no inline script): loads `connect.facebook.net/en_US/fbevents.js`, automatic configuration off, one `PageView` per load (`disablePushState`, so the CTA's hash change is not counted again). Skipped on loopback hosts and file pages, so local runs and tests send nothing to Meta. Not on `/admin`. **Automatic advanced matching must stay Off on the dataset** (Events Manager): the privacy page promises the answers are never sent, and with it on fbevents.js would hash the form's email and phone without any code change |
| `main.js` | Header state, the inquiry form (validation, ALTCHA proof of work with Web Crypto, idempotent retry, CTA scroll and focus, one Meta `Lead` with the reference as `eventID` only when the server stored a new inquiry), the phone menu (Escape, focus return, inert when closed; the toggle is enabled once wired), the day tabs (WAI-ARIA tabs with arrow keys, Home/End and a focusable panel; every moment stays visible without it) and section reveals |
| `assets/fonts/` | Self-hosted Satoshi woff2 (300 Light, 400, 700) |
| `assets/brand/` | Official wordmark recolored to ink, and the favicon |
| `assets/img/` | Responsive AVIF and WebP exports of the V3 Blender renders: hero, the four moments of the day and the floor plan, each with its own phone render |
| `vercel.json` | Security headers (strict same origin CSP on every path; only `/` and `/privacy` add `https://connect.facebook.net` for scripts and `https://www.facebook.com` for the pixel's images and beacons, so `/admin`, `/admin/` and any other path stay same origin only; `form-action 'self'`, nosniff, frame deny; `noindex`, `no-store` and `no-referrer` on every `/admin` path and every percent-encoded path (Vercel can resolve encoded admin filenames before serving them, but matches headers against the encoded URL); `noindex` on `/api`), asset caching, static build into `dist/`, functions and the daily cleanup cron |
| `robots.txt`, `sitemap.xml` | Allow indexing of the public pages, keep `/admin` and `/api/` out, list the canonical URLs |
| `privacy.html` | Privacy page linked from the form |
| `admin.html`, `admin.js`, `admin.css` | Private dashboard at `/admin` (never linked): list newest first, detail, CSV export, mark contacted, erase one record, sign out |
| `api/` | Vercel functions: `inquiry` (POST), `challenge` (POST, ALTCHA), `admin`, `cleanup` (cron) |
| `server/` | Field contract, validation, ALTCHA, Postgres pool with transaction local timeouts, store, admin auth, CSV |
| `migrations/` | Explicit reversible SQL (`001_inquiries.up.sql` / `.down.sql`); `scripts/migrate.mjs status|up|down --confirm-drop-inquiries` |
| `scripts/build-static.mjs`, `scripts/public-files.mjs` | The one allowlist of served files, used by the Vercel build and the local server |
| `.vercelignore` | Keeps tooling, tests and docs out of the deployed bundle |
| `scripts/serve.mjs` | Local static server that sends the same headers as `vercel.json` |
| `scripts/export-art.sh` | Exports the Blender PNG masters (hero, day moments, plan; desktop and phone) to responsive AVIF and WebP |
| `scripts/shots.mjs` | Fresh-load captures of the hero, each section and the full page at desktop, tablet, phone, narrow and landscape viewports, plus measured type |
| `tests/landing.spec.mjs` | Playwright behavior, layout and render checks |
| `COPY.md`, `SOURCES.md` | Final copy and editing record; provenance for assets and claims |

## Inquiries

- Required answers: name, work email, company, building type, total floor area; the rest are optional. The server (`server/fields.js`) is the authority: exact choices, length caps, no control characters.
- Abuse controls: ALTCHA proof of work (signed, origin bound, single use), honeypot, per address, per email and global limits, exact origin checks (this deployment's own URL, its branch alias, the production host on production, plus `INQUIRY_ORIGINS`), JSON only, 8 KB body cap. Logs carry status words only.
- Every submission carries an idempotency key; a retry of the same answers returns the original reference and stores nothing new.
- Inquiries are kept until the owner erases one in the dashboard. Nothing deletes them on a schedule: the daily `/api/cleanup` cron removes only expired rate limit, proof and session rows, over the direct (not pooled) Prisma host.
- Environment (all sensitive, Preview and Production): `DATABASE_URL` (from the Prisma integration), `INQUIRY_HASH_SECRET`, `ADMIN_PASSWORD_HASH` (scrypt; the password lives in the owner's Keychain), `CRON_SECRET`, `NOTIFY_TOKEN_SHA256` (read only notifier).
- Optional `INQUIRY_ORIGINS`: comma separated `https://` origins for every other host that serves the site without redirecting to the production host (for example the apex and `www.`, a second domain, or `energiawebsite.vercel.app`). Unset today; there is no custom domain yet. An entry with a path, query or credentials is ignored.
- Release gate for origins: `node scripts/check-origins.mjs https://host-a https://host-b` (or `CHECK_ORIGINS=...`, or `--share-file` for a protected preview). For each host it POSTs `/api/challenge` with that host's own `Origin`, with and without Fetch Metadata (expects 200), and from a foreign origin (expects 403). Run it against every served host before promoting.
- The challenge is a `POST` with an empty JSON body, so browsers without Fetch Metadata (Safari before 16.4) still send `Origin` and can use the form.
- Notifications: `~/.hermes/scripts/energia_inquiry_notify.py` polls `GET /api/admin?action=notify` with the notify token and prints new inquiries. No email.

## Run locally

```bash
npm run serve          # http://127.0.0.1:4173
```

Opening `index.html` directly from disk also works. The server is only needed to test the headers.

## Test

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_GC=1 npm ci        # pinned @playwright/test 1.64.1
npm test                                     # all browser checks
npm run test:unit                            # field contract, ALTCHA, config, CSV, no automatic deletion
npm run test:postgres                        # API, migrations and an end to end browser run on a disposable local Postgres
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
- exactly three scripts (synchronous `boot.js` before the stylesheet, deferred `main.js` and `pixel.js`), no inline script or handler attributes, and a CSP that allows same-origin scripts plus Meta's script host only
- the Meta pixel (`tests/pixel.spec.mjs`, through a stand-in hostname with Meta's script answered by a recorder, so nothing reaches Meta): loaded once with the Energia dataset on the public pages, never on `/admin` or loopback; one `Lead` with the reference as `eventID` only after a newly stored inquiry, none for validation errors, failures, a replayed reference, a filled honeypot or a double submit; the form works with Meta's script blocked; a foreign script, inline script, connection and image are still blocked by the CSP; robots, sitemap, canonical links and no `noindex` on public pages; the privacy wording
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

## Deploy

The Vercel project is `energiawebsite` (owner `edorfanini00s-projects`). Vercel's Git integration builds a preview for every pushed branch and production from `main`, so a push to `main` is a production release: merge only a head that passed two independent reviews.
Verify the deployed HTML, assets, headers and the pixel on the preview before merging, and on the live site afterwards.

## Retained artwork verification

`python3 scripts/verify-art.py /Users/edorfanini/.hermes/workspace/energia-landing-v3-20261027` checks all 12 raw masters, eight disclosed sky retouches, 12 encoding inputs and 70 responsive exports, then writes the private `ART-MANIFEST.json`. Requires Pillow and numpy. Full hashes, source-chain checks and historical receipt limitations are documented in `SOURCES.md`. This command does not render or encode images.
