# Canonical domain preparation

The selected main hostname is **https://predictivehvaccontrol.com**. This supersedes the initial direction. **commercialhvacoptimization.com stays parked and untouched**, with no redirect or binding. Do not change the existing energiaigroup.com site or email DNS.

This change prepares coherent metadata, public URLs, Organization/WebSite/WebPage identity and one buyer guide. It does not establish indexing, rankings, citations, savings or live domain readiness. The approved hero, artwork, existing FAQ, privacy, pixel and backend controls are preserved. The guide has no pixel script. No migration or notification change is needed.

## Parent release requirements

1. Obtain two independent reviews of the exact final PR head, including rendered editorial/visual and security review. Validate the hosted preview before merge; local tests cannot prove Vercel routing or domain configuration.
2. Bind only predictivehvaccontrol.com to the intended Vercel project and configure its DNS through the authorized parent release process. Do not redirect the parked domain. Do not assume a www hostname is bound or served.
3. Before the canonical hostname serves the form, append `https://predictivehvaccontrol.com` to the existing comma separated `INQUIRY_ORIGINS` production environment value, preserving other intentionally served origins. Apply the same explicit entry to a preview environment only if that environment must serve this hostname. Do not copy secrets into reports. New deployments must receive the updated value.
4. `server/config.js` also accepts `VERCEL_URL`, `VERCEL_BRANCH_URL`, and, only on production, `VERCEL_PROJECT_PRODUCTION_URL`. The exact value of that last variable may still be the Vercel alias, so the explicit entry above removes the ambiguity. Do not add wildcards, the parked hostname, or change `requestOrigin`.
5. After the reviewed release is deployed by the parent, verify canonical HTML, OG, all sitemap URLs, real image loading, CSP, private noindex headers, the CTA and FAQ behavior on the actual host. Run `node scripts/check-origins.mjs https://predictivehvaccontrol.com` and every other hostname intentionally serving the form. This issues challenge requests only: expect 200 with same-origin metadata, 200 without Fetch Metadata, and 403 for a foreign origin. Do not send a valid live inquiry.
6. Confirm the alias/deployed commit and public output match the reviewed tree. Account-level indexing submissions and subsequent search measurement belong to the parent after live verification.

## Local reproduction

Use Node 24 (package engine), then `npm ci`, `npm run build`, `npm run test:unit`, `npm run test:postgres`, and `npm test`. Postgres tests require local `initdb`, `pg_ctl` and `createdb`; they create disposable loopback databases with synthetic secrets and no external delivery. Browser tests build and serve `dist/` with the real Vercel CSP rules. They emulate desktop/mobile viewports in Chrome, not physical devices.

For a static built preview: `SERVE_DIST=1 PORT=4173 npm run serve`, then open `http://127.0.0.1:4173`. This does not mount the API. Use the existing synthetic test stack for form integration, never a production database. Optional screenshot capture: `SEO_SCREENSHOTS=/absolute/evidence/path npm test -- tests/seo.spec.mjs`.

The JSON-LD blocks are static and contain only brand, URL, page identity and visible descriptions. Each clean public route permits only its exact SHA-256 JSON-LD hash; no unsafe inline/eval permission is added. The build checks the hashes against copied HTML. If a JSON-LD block changes, update only its corresponding hash in `vercel.json` and rerun the tests. Encoded/noncanonical HTML paths retain the strict fallback policy; they are not sitemap URLs.

## Rollback and boundaries

Before merge, close the PR or revert the scoped commit. If released, parent can revert this change and redeploy the previous reviewed version, coordinating canonical/DNS/origin configuration with that version. A source revert alone does not undo domain or environment changes. No database rollback is involved. Keep unrelated served origins until intentionally retired.

Google references checked on November 8, 2026: [site names](https://developers.google.com/search/docs/appearance/site-names), [structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), and [AI features](https://developers.google.com/search/docs/appearance/ai-features). The foundation follows normal crawlability and useful-content practices; structured data is not a ranking or AI citation promise. Product copy is grounded in the owner's original Core MVP Goal and technical architecture documents plus the approved November 8 buyer-value release, without treating goals or simulation as field validation.
