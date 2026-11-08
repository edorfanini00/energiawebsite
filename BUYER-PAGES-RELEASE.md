# Buyer resources and public contact handoff

This change adds `/hvac-optimization-pilot` and `/hvac-optimization-companies` to the existing static site. The overview remains at `/hvac-optimization`. The homepage and overview link to both resources, and the resources link to one another and the existing `/#contact` form.

The pilot page adapts the complete approved draft into a planning checklist with roles, control permissions, operating and stop requirements, measurement, site-specific cost drivers, ten written decision prompts and proceed/revise/stop outcomes. It makes no promise of a price, duration or implemented control feature. The comparison preserves six sourced vendor descriptions and explicitly identifies Energia as its publisher, with no ranking or performance superiority claim.

The owner's subsequent instruction removes the personal public email and all mail links from the deployed site. The form remains the contact route. Privacy instructions use its existing fields and are tested against a disposable PostgreSQL database. Failure states retain answers and direct visitors to retry Send; no-JavaScript or unsupported-browser visitors receive enable/reload guidance. No new mailbox or alternative intake service is introduced.

## Technical boundaries

- Both pages are static HTML with existing fonts and brand assets. Scoped editorial CSS adds readable lists and a keyboard-accessible contents navigation. No dependencies or page scripts are added.
- The public-file allowlist, clean routes, sitemap, per-page metadata and Organization/WebSite/WebPage graphs include both pages. The five-URL sitemap has no invented modification dates. The build validates each exact JSON-LD CSP hash; no inline executable permission is added.
- On arrival at `/#contact`, the homepage reuses its existing CTA scroll and first-field focus behavior. Form fields, validation, payload, API, auth, database, notifications and pixel behavior are unchanged.
- Privacy usage/consent wording refers to replying to the inquiry to include privacy requests. Retention, deletion rights, security, tracking disclosures and consent behavior are preserved.
- No migrations, secrets, infrastructure, domains, email accounts or schedules change. Historical local prototypes and documentation remain excluded from the public build.

## Validation and release ownership

Run with Node 24: `npm ci`, `npm run build`, `npm run test:unit`, `npm run test:postgres`, and `npm test`. PostgreSQL tests create and remove their own loopback cluster. Set `BUYER_SCREENSHOTS`, `SEO_SCREENSHOTS` and `COPY_EVIDENCE_DIR` to external evidence directories for ordinary browser captures; pass Playwright `--output` an external directory as well.

Buyer-guide checks cover 1440, 390 and 320 pixel viewports, actual image loads, full-page overflow, source URLs, complete sections, keyboard contents navigation, no-JavaScript reading, return-home links and contact focus. Contact checks scan every built file for personal email/mail links and cover success, retries, unsupported browsers and privacy requests. Existing menu, FAQ, form, pixel and private-route tests remain in the full suite.

The builder opens a PR only. The parent owns two independent reviews of the final head, protected hosted-preview acceptance, approval, merge and production verification. No manual deployment is part of this handoff. Rollback is a source revert; there are no data or infrastructure changes to undo. A rollback that retains the owner's email-removal requirement should keep the contact/privacy changes while reverting the buyer resources.
