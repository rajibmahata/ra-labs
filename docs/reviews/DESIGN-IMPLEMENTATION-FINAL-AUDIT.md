# Design and Implementation Final Audit

Date: 2026-08-08
References: `docs/design/index-v2.html`, `docs/design/wireframes.html`, current React frontends, backend state records.

## Executive Decision

**NOT PRODUCTION READY.** The public shell follows the intended light editorial direction and the customer PWA subpath defect is fixed and browser-verified. Production approval is blocked by four customer dependency vulnerabilities, production storage/content-scanning work, and incomplete E2E/accessibility/performance/security gates. The earlier public API 500 was a runtime availability issue and is verified cleared when the API runs on its configured proxy target.

This audit preserves the existing implementation. No frontend application was rebuilt or replaced.

## Scope and Evidence

| Area | Result | Evidence |
|---|---|---|
| Public visual shell | Partial pass | Homepage rendered at desktop and 390px viewport; Newsreader/Inter/IBM Plex Mono, cream/emerald/brass tokens, editorial hero, process, contact, footer present. |
| Public content rendering | Pass with runtime prerequisite | Direct public project/team/content requests return 200 with the API running on `http://localhost:5002`; the earlier 500 reproduced only while the API process was unavailable. |
| Customer routing | Pass | Login route rendered at `/customer/login`; basename `/customer` resolved links correctly. |
| Customer PWA | Pass after fix | `/customer/manifest.webmanifest` and `/customer/sw.js` returned 200; active service-worker scope was `/customer/`. Root paths returned 404 before the fix. |
| Mobile layout | Partial pass | Public page at 390x844 had no horizontal document overflow. SVG art children extend beyond the art box but are clipped by its overflow boundary. |
| Admin responsive source review | Partial | Sidebar collapses to icon rail at 768px; authenticated dashboard rendering was not exercised because no test credential was used. |
| Backend tests | Pass | Full suite: 58/58 passed, including secure upload/download regression coverage. |
| Frontend builds | Pass | `web-public`, `web-customer`, and `web-admin` production builds passed. |
| API smoke | Partial pass | Health, public, auth, customer, admin, chat, MCP, representative CRUD, authorization, and state-machine routes passed against `http://localhost:5002`; exhaustive deployment and mutation coverage remains a QA gate. |
| Accessibility | Partial | Semantic landmarks, labels, focus-visible styles, reduced-motion styles, and live/error regions are present. Automated axe/WCAG run is not evidenced. |
| Performance | Not validated | No Lighthouse or production performance baseline captured. |
| Security | Partial | Tenant read isolation and local private upload/download authorization are fixed and tested; production object storage/content scanning and dependency remediation remain open. |
| Chatbot/RAG isolation | Not fully validated | Backend surfaces and tests exist; browser/API tenant and grounding validation remains incomplete. |

## Confirmed Findings

### High: Public content API runtime dependency, verified cleared

**Problem:** The public homepage returned HTTP 500 when the configured API process was unavailable.

**Expected:** The homepage should render published portfolio and team records, or a deliberate empty state when no records exist.

**Actual:** With the API running on `http://localhost:5002`, public project/team/content routes return successfully and the admin browser dashboard loads without a 500.

**Owner surface:** `web-public/src/pages/Home.tsx`, `web-public/src/api/client.ts`, API/proxy runtime configuration.

**Required action:** Keep API startup and Vite proxy configuration aligned, and add this runtime check to deployment validation.

### High: Customer PWA base-path defect, fixed

**Problem:** The customer app is deployed at `/customer/`, but manifest, icon, service-worker, and cache URLs were rooted at `/`.

**Fix:** HTML asset links are relative, runtime registration uses Vite `BASE_URL`, manifest declares `/customer/` start and scope, and service-worker cache URLs derive from registration scope.

**Validation:** Customer build passed; browser confirmed 200 responses and active registration at `/customer/sw.js` with `/customer/` scope.

### High: Production document storage remains incomplete

Local private storage, type/size validation, and ownership-checked downloads are implemented and covered by regression tests. Production approval still requires moving bytes behind the approved object-storage provider and adding content/malware scanning. See `GAP-002`.

### High: Dependency vulnerabilities remain open

`web-customer` `npm audit` previously reported four vulnerabilities: three moderate and one high. A compatible upgrade and regression run are still required. See `GAP-006`.

### Medium: Historical documentation references remain

Authoritative architecture and database documents now describe SQL Server. Historical PRD/design documents retain their original PostgreSQL wording and should be treated as superseded references.

## Design Comparison

The React public app is structurally aligned with the reference: header/wordmark, editorial hero, dual CTA, five-step process, selected work, team, contact form, final CTA, chatbot, and footer are present. The token palette and typography are also aligned with `index-v2.html`.

The remaining fidelity gap is primarily data-dependent: portfolio and team sections require the API runtime to be available. Existing design-gap findings also remain relevant for exact metadata/card treatment and admin workflow parity; they are not silently marked complete by a successful static build.

The admin UI uses a distinct operational dark-sidebar/light-content system. This is consistent with its role as an internal tool, but wireframe parity and authenticated responsive behavior require a real admin session for final QA.

## Required Release Gates

1. Retain the verified API/proxy alignment for `GAP-008` in deployment smoke tests.
2. Move validated, authorized document storage behind production object storage and content scanning (`GAP-002`).
3. Remediate or explicitly accept the `npm audit` findings after dependency review (`GAP-006`).
4. Keep SQL Server architecture documentation aligned with ADR-006 (`GAP-004` verified).
5. Run Playwright, accessibility, performance, API smoke, chatbot/RAG isolation, and deployment/PWA installability checks in CI or a documented QA environment (`GAP-005`).

## Files Changed During This Audit

- `web-customer/index.html`
- `web-customer/src/main.tsx`
- `web-customer/public/manifest.webmanifest`
- `web-customer/public/sw.js`
- `docs/project-state/GAP-REGISTER.md`
- `docs/project-state/CURRENT-IMPLEMENTATION-STAGE.md`
- `docs/reviews/DESIGN-IMPLEMENTATION-FINAL-AUDIT.md`
