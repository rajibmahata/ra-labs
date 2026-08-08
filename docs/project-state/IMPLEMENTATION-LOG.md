# Implementation Log

## 2026-08-08 - Editorial homepage and structured customer intake

- **Task:** Make the public-to-customer journey explicit and capture a durable project brief at customer project creation.
- **Backend:** Added nullable `Goal`, `Audience`, `Requirements`, `Timeline`, `BudgetOrConstraints`, and `ReferenceLinks` fields to customer projects; extended REST/MCP application contracts, validation, DTO mapping, EF configuration, and additive migration `CustomerProjectBrief`. Existing title-only application callers remain compatible.
- **UI:** Reframed the public hero/process around Understand -> Register -> Submit brief -> Discuss -> Approve; added first-brief preparation guidance; replaced the customer title-only modal with a grouped brief form and direct project-detail navigation; surfaced the shared brief in customer and admin project detail views.
- **Validation:** `dotnet build backend/RALabs.sln --no-restore` passed with one pre-existing xUnit analyzer warning; focused backend tests passed 25/25; `web-public`, `web-customer`, and `web-admin` production builds passed.
- **Remaining risks:** Browser end-to-end submission against a migrated SQL Server database and truthful live-agent availability fallback remain follow-up QA work. Worktree was already dirty and implementation was applied on the checked-out `main` branch.

## 2026-08-08 - Admin-managed GitHub credentials and public Work repositories

- **Task:** Let administrators and linked team members manage GitHub account credentials and publish synchronized repository metadata in the public Work section.
- **Backend:** Added encrypted per-member token storage using ASP.NET Data Protection, account URL fields, token-presence-only DTO output, per-member token precedence during sync, public/admin repository feeds, manual admin sync, and the `GithubCredentials` EF migration.
- **UI:** Added GitHub URL/token fields and saved-token status to admin Team and My Profile, a manual Sync GitHub action, and public Work repository cards with technology filtering.
- **Validation:** Backend build passed; backend tests passed 63/63; `web-admin` and `web-public` production builds passed; touched-file diagnostics report no errors.
- **Remaining risks:** Sync still requires `GithubUsername` for account discovery; production Data Protection keys need durable shared persistence; public repositories are currently published from the synced repository table without an approval/privacy flag.

## 2026-08-08 — Baseline discovery and state initialization

- **Task:** Establish authoritative current implementation snapshot.
- **Agent:** AI Workforce / architecture and QA discovery.
- **Files changed:** Added `docs/project-state/` baseline records and history snapshot.
- **Database changes:** None.
- **API changes:** None.
- **UI changes:** None.
- **Tests:** `dotnet test backend/RALabs.sln --no-restore`: 56 passed; `dotnet build backend/RALabs.sln --no-restore`: passed; `web-public` and `web-admin` builds passed; `web-customer` build blocked because `tsc` was not available.
- **Result:** Baseline recorded. Production readiness correctly marked NOT PRODUCTION READY.
- **Remaining gaps:** GAP-001 through GAP-005, plus the wider traceability matrix backlog.

## 2026-08-08 — Customer tenant read isolation

- **Task:** Close cross-customer reads through REST and MCP project child-resource paths.
- **Agent:** AI Workforce / backend and security.
- **Files changed:** `backend/RALabs.Application/Services/CustomerAuthService.cs`, `CustomerProjectService.cs`, `backend/RALabs.Api/Program.cs`, `McpToolRegistry.cs`, `backend/RALabs.Tests/CustomerWorkflowTests.cs`.
- **Database changes:** None.
- **API changes:** Customer document, PRD, demo, and invoice reads now receive and validate the authenticated customer ID; MCP PRD/invoice reads validate `callerId`.
- **UI changes:** None.
- **Tests:** Customer workflow 6/6 passed; full backend suite 57/57 passed; backend build passed. All public, customer, and admin frontend builds passed after dependency restore.
- **Result:** GAP-001 VERIFIED.
- **Remaining gaps:** GAP-002, GAP-004, GAP-005, GAP-006 and broader feature/quality coverage.

## 2026-08-08 - Design and production gap audit

- **Task:** Compare rendered frontends and PWA behavior against the authoritative design references.
- **Files changed:** `web-customer/index.html`, `web-customer/src/main.tsx`, `web-customer/public/manifest.webmanifest`, `web-customer/public/sw.js`, project-state records, and `docs/reviews/DESIGN-IMPLEMENTATION-FINAL-AUDIT.md`.
- **UI changes:** Fixed customer PWA asset and service-worker registration for the `/customer/` deployment base path.
- **Validation:** Customer build passed; browser confirmed `/customer/manifest.webmanifest` and `/customer/sw.js` return 200 and the active registration scope is `/customer/`. Public 390px browser check showed no horizontal document overflow. Public portfolio/team requests returned HTTP 500 through the local Vite proxy.
- **Result:** PWA subpath gap verified closed; final design audit records NOT PRODUCTION READY.
- **Remaining gaps:** GAP-002, GAP-004, GAP-005, GAP-006, and GAP-008 plus broader feature/quality coverage.

## 2026-08-08 - API runtime and route validation

- **Task:** Validate the configured API runtime, admin proxy login, authorization matrix, and customer project lifecycle.
- **Files changed:** `web-admin/src/App.tsx`, `web-admin/src/pages/Layout.tsx`, `web-admin/src/pages/Login.tsx`, project-state records, and the design audit.
- **API changes:** None. The admin app now consistently redirects to the deployed `/admin/` base path.
- **Validation:** API running on `http://localhost:5002`; health, public, auth, customer, admin, chat, MCP, representative CRUD, role rejection, rate limiting, and state-machine paths exercised. Admin browser `/admin/` rendered the dashboard without 500. Admin production build passed.
- **Expected contract responses:** malformed slugs 400, invalid lead source 400, unauthenticated protected routes 401, wrong-role routes 403, missing PRD 404, rate-limited repeated login 429, invalid workflow transitions 409, and unsupported upload content type 415.
- **Result:** GAP-008 VERIFIED. GAP-005 advanced to PARTIAL with API evidence; production readiness remains NOT PRODUCTION READY because upload security, dependency vulnerabilities, documentation drift, and broader QA gates remain.

## 2026-08-08 - Responsive foundation, offline chat, and secure documents

- **Task:** Complete the first native-device UI hardening slice and close the unsafe customer document upload gap.
- **Files changed:** Three frontend global stylesheets, `web-customer/src/pages/Chat.tsx`, `web-customer/src/api/offlineQueue.ts`, backend document/storage services, EF migration, and project-state records.
- **UI changes:** Mobile touch targets now use 44px minimums with safe-area-aware gutters. Customer chat messages queue in IndexedDB while offline and flush after reconnect.
- **API/database changes:** Customer document uploads validate filename/type/size, store bytes in private local storage, record storage metadata, and provide ownership-checked downloads. Migration `SecureDocumentStorage` adds the required metadata columns.
- **Validation:** Public, customer, and admin production builds pass. Isolated backend build passes. Isolated backend suite passes 57/57.
- **Result:** GAP-002 VERIFIED. Production readiness remains NOT PRODUCTION READY pending object-storage deployment configuration, dependency remediation, expanded Playwright/accessibility/performance/security gates, and stale documentation cleanup.

## 2026-08-08 - Configuration, RAG query, GitHub change detection, and MCP coverage

- **Task:** Implement the next backend production-readiness slice from the gap audit.
- **Security/configuration:** Removed the committed base JWT secret, wired `IConfiguration` into Application DI, and documented OpenAI, GitHub, storage, JWT, SQL, and SMTP environment placeholders.
- **AI/RAG changes:** Added deterministic SQL-backed `rag_query` with public/project source filtering and exposed it through REST and MCP. Added MCP tools for listing, generating, and reviewing AI content drafts.
- **GitHub changes:** Repository snapshots are fingerprinted before upsert; meaningful changes enqueue a `github-reanalysis` `AgentTask` and are reported in sync results.
- **Validation:** Backend build passed; backend test suite passed 58/58; public, customer, and admin production builds passed.
- **Result:** Configuration/RAG/GitHub/MCP slice implemented. Production readiness remains NOT PRODUCTION READY pending production storage/scanning, dependency remediation, full E2E/accessibility/performance evidence, and provider decisions.

## 2026-08-08 - Secret hygiene and browser regression coverage

- **Task:** Remove an accidentally reintroduced OpenAI key and complete the available browser smoke coverage.
- **Security:** Cleared OpenAI API values from committed `appsettings.json` and `appsettings.Development.json`; keys must be supplied through environment variables or user secrets. The exposed key should be revoked and replaced outside the repository.
- **E2E:** Added customer login, admin login, and public mobile overflow checks in `e2e/tests/app-shells.spec.ts`.
- **Validation:** Full Playwright suite passed 7/7. Backend build passed. Customer dependency audit still reports 4 upstream vulnerabilities; remediation requires a reviewed dependency upgrade, including a potentially breaking Vite major update.
- **Result:** Browser regression coverage is implemented and green. Production readiness remains gated by dependency remediation, production storage/scanning, and broader accessibility/performance evidence.

## 2026-08-08 - Development API startup configuration fix

- **Issue:** The API build passed, but development startup failed because `Jwt:Secret` was empty after production secret hygiene changes.
- **Fix:** Added a clearly local-only 32+ character JWT secret to `appsettings.Development.json`; base and production configuration remain secretless and continue to require environment/user-secret injection.
- **Validation:** API started successfully, applied no pending migrations, and `/health` returned HTTP 200. Backend build passed, backend tests passed 58/58, and Playwright passed 7/7.

## 2026-08-08 - Customer voice command navigation

- **Task:** Extend customer Web Speech support from dictation to safe portal navigation commands.
- **Files changed:** `web-customer/src/pages/Chat.tsx`, `web-customer/src/voiceCommands.ts`, `web-customer/src/index.css`.
- **UI changes:** Recognized phrases can open the dashboard, account, projects, or current project, or navigate back. Unmatched speech remains in the composer; voice never submits a message or triggers a destructive action. Status feedback is announced accessibly.
- **Validation:** `web-customer` production build passed after the initial integration and lifecycle refinements.
- **Result:** Customer voice command routing is implemented. Component-test coverage remains unavailable because the customer package has no test runner; browser-level voice simulation is a follow-up QA gap.
