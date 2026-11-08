# Search resource and contact attribution release

## Behavior

A contact link on the guide, pilot, comparison, About, research evidence or privacy page now carries that page's canonical path in `source_path`. With JavaScript, it also carries the five supported UTM fields from that page's current URL. The homepage submits the resulting source and tags through the existing inquiry API, PostgreSQL columns, dashboard and CSV export. No migration or new service is required.

The shared `attribution.js` parser accepts only seven known public paths. It drops repeated UTM fields, values longer than 100 characters and every attribution parameter from queries longer than 2,000 characters. It removes unsupported control characters and ignores other query fields. Repeated or invalid source paths fall back to `/`; that fallback does not establish direct acquisition. The server independently normalizes the submitted source and tags.

These are visitor-supplied context fields, not verified acquisition data. Only the final resource → contact hop is preserved. A resource → resource journey does not carry earlier tags. External referrer and earlier journey remain unknown. No cookies, localStorage or sessionStorage are used. Native links preserve the resource path without JavaScript, but current campaign tags cannot be carried and the existing form still requires JavaScript. Existing Meta PageView/Lead behavior is unchanged; no pixel was added to the resource pages.

Privacy text explains those limits and retains reply-only use, the existing form-only contact path and retention protections.

## Content and sources

`/about` describes the company approach and site evaluation boundaries. It includes only the verified identity “Edoardo Orfanini, founder” and links his actual LinkedIn profile and the existing company profile. It does not publish unverified biographies, legal details, credentials, customers or field results. `/hvac-optimization-evidence` is an organizationally published research interpretation, with explicit AI assistance disclosure. It preserves study denominators, methods, synthetic tariff limitations and implementation scope. It does not claim human technical review or Energia field savings.

The public copy comes from the supplied research handoff dated November 8, 2026 (`FACTS.md`, `ABOUT.md`, `EVIDENCE.md`, `SOURCES.md`, outside the repository). The parent subsequently verified the founder identity on the official LinkedIn company People page and the linked public profile, documented in the internal parent handoff. The private research and company source documents are not deployed.

Primary public citations:

- [Crowe et al., commissioning study](https://eta-publications.lbl.gov/sites/default/files/crowe_-_building_commissioning_costs_and_savings_.pdf), sections 2 and 3.1, Tables 1 and 2, Figure 2.
- [Kramer et al., Proving the Business Case for Building Analytics](https://eta-publications.lbl.gov/sites/default/files/kramer_provingbuildinganalytics_october2020.pdf), sections 2, 3.1, 3.2 and 3.5, Tables 4 and 5.
- [Zanetti et al., predictive control field study](https://eta-publications.lbl.gov/sites/default/files/2024-10/field_performance_of_building_load_flexibility_model_predictive_control.pdf), sections 2, 3.3, 4.1, 4.2 and 5.

The new pages have production canonicals, metadata, Organization/WebSite identity and AboutPage or Article structured data with matching CSP hashes. All seven public pages are in the sitemap, dated to their actual November 8 edit. No FAQ, llms, new crawler rule or ranking/citation promise was added.

## Validation and release

Use Node 24 and the pinned Playwright package. `npm run test:unit` checks normalization, form/security contracts and an isolated build after applying the actual `.vercelignore` rules. `npm test` exercises the built site. `npm run test:postgres` uses disposable loopback PostgreSQL, real HTTP handlers, ALTCHA and browser submissions; it does not use remote data. `PLAYWRIGHT_SKIP_BROWSER_GC=1` must be used if installing a required browser revision. Do not remove shared browser caches.

Focused RED tests reproduced permissive source/duplicate tag handling and both missing new routes before implementation. New browser and database cases cover direct home, all resource contact links, tagged/untagged journeys, blocked storage, no JavaScript, malformed and oversized attribution, reload/history, keyboard focus, reduced motion, privacy requests and failed/lost-response/idempotent retries. Pixel tests use the trustworthy loopback hostname `energia.pixel.localhost` with every Meta request intercepted; they do not rely on Chromium granting a secure context to an arbitrary HTTP `.test` host. The existing regression suites remain required. Final exact totals and visual evidence are recorded in the external build/RESULT.md handoff.

`.vercelignore` explicitly includes both new HTML files and both attribution modules. The upload fixture verifies they are tracked, retained, built byte-for-byte and never accompanied by internal or credential files. Existing Vercel `cleanUrls` serves the new routes; no DNS, remote database or account changes are needed.

Parent release owners must review the final PR SHA independently, approve factual publication, verify the automatic preview is Ready, and perform protected-preview checks using the correct accepted origin and their authorized cookie. Builder does not merge or manually deploy. After authorized merge, verify production Ready state, deployed SHA/tree, all seven canonical pages, actual source links/assets, CSP and source-bearing contact URLs using read-only checks. No synthetic production inquiry or Meta event is authorized by this work.

Rollback is a reviewed revert of this PR through the existing deployment pipeline. No migration rollback is needed. Existing inquiry records remain intact; older stored source fields retain their original meaning. Search discovery/indexing follow-through belongs to the parent and is separate from implementation correctness.
