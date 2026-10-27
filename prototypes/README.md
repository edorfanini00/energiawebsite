# Direction prototypes A and C

These are hero and first-feature prototypes made for the direction choice after the owner rejected the 616f693 page and named BrainBox as the visual benchmark.
They are not the full page. Nothing here is deployed, and the root `index.html` is unchanged.

| Route | Idea |
|---|---|
| `/prototypes/a/` | **A, edge against sky (recommended).** A full-bleed daylight render of an architectural fragment from a low camera. The light headline sits in calm sky, and the hero has no paragraph or button. The single conversion is a compact green button in the bar. |
| `/prototypes/c/` | **C, rooftop horizon.** The rooftop plant at roofline height against the sky fills the top of the screen. Below it, a solid ink band holds the headline, one supporting sentence and the CTA, so text never crosses the image. |

Both routes share one system, defined in `shared.css`:

- **Type:** Satoshi, with genuine Light 300 for display, 400 for text and 700 only for emphasis.
  - H1 is 56px at 1440 and 30px on phones, line height 1.1, tracking −0.02em.
  - H2 is 40px and 28px.
- **Layout:** one left edge for every heading, paragraph and image.
- **Palette:** daylight white and ink, with brand green used once per view.

## Run

```bash
npm run serve                                  # http://127.0.0.1:4173/prototypes/a/ and /prototypes/c/
scripts/export-proto-art.sh <art/brainbox-v2>  # renders to responsive AVIF and WebP
node scripts/proto-shots.mjs <out-dir>         # fresh-load captures at 1440×900 and 390×844, plus metrics
npx playwright test tests/prototypes.spec.mjs  # type, contrast, CTA, menu, motion and copy checks
```

## Art

The renders are original Blender 5.2.1 Cycles renders by the art worker, from `~/.hermes/workspace/energia-landing-20261027/art/brainbox-v2/` (see `manifest.json` and `V2-ART-RESULT.md` there).
No reference imagery is used.

| Master | sha256 | Used for |
|---|---|---|
| `a-desktop.png` 3200×2000 | `125cebbd…8539` | A hero (desktop); C first feature (square crop) |
| `a-phone.png` 1290×2792 | `7ecf5c9a…7b9c` | A hero (phone); C first feature on phones (4:5 crop) |
| `c-desktop.png` 3200×1560 | `997a7527…0e5c` | C hero (desktop); A first feature (21:9 crop) |
| `c-phone.png` 1290×1730 | `2286e73d…64bc` | C hero (phone); A first feature on phones (1:1 crop) |

Export command (crops are part of the record):

```bash
A_FEATURE_SRC=c-desktop.png A_FEATURE_CROP="iw:iw*9/21:0:ih*0.02" \
A_FEATURE_PHONE_SRC=c-phone.png A_FEATURE_PHONE_CROP="iw:iw:0:ih*0.16" \
C_FEATURE_SRC=a-desktop.png C_FEATURE_CROP="ih*0.8:ih*0.8:iw-ih*0.8:ih*0.2" \
C_FEATURE_PHONE_SRC=a-phone.png C_FEATURE_PHONE_CROP="iw:iw*5/4:0:ih*0.29" \
scripts/export-proto-art.sh ~/.hermes/workspace/energia-landing-20261027/art/brainbox-v2
```

## Why the hero type is ink, not white

The art was graded for white type, as on the reference. On the delivered pixels, though, white measured 2.9:1 behind A's desktop headline and about 3.1:1 behind the nav, which fails 3:1 for large text and 4.5:1 for the 15px nav.
Ink passes on the same pixels, at about 5:1 or better.
A dark scrim would have put a shadow through the headline, which the brief rules out, so both routes use ink type over the sky.
`tests/prototypes.spec.mjs` measures this against the rendered page.
