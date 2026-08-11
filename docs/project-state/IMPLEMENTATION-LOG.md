# Implementation Log

## 2026-08-10 - Frontend dependency audit cleared + admin import/export consistency (GAP-006, GAP-010)

- **Task:** Clear the four `npm audit` findings (3 moderate, 1 high) that existed in every frontend, and finish the GAP-010 import/export consistency work (only Customers and Portfolio had it).
- **GAP-006 (dependencies):** All three apps upgraded react-router-dom 6.26.2 → 7.18.2 (react-router SSR hydration/constructor injection + open-redirect advisories) and vite 5.4.x → 6.4.3 (esbuild ^0.25.0, dev-server request-reading advisory). The v6-only `future={{ v7_startTransition, v7_relativeSplatPath }}` props were removed from `BrowserRouter` in `web-customer/src/main.tsx`, `web-public/src/main.tsx`, and `web-admin/src/App.tsx` (both flags are v7 defaults; `basename="/customer"` retained). Result: `npm audit` reports 0 vulnerabilities in all three apps and each production build passes.
- **GAP-010 (import/export):** New `CsvHelper` (RFC-4180 escaping/parsing) in `RALabs.Application/Common` replaces the duplicated private helpers in `CustomerManagementService`. New admin routes: `POST /admin/leads/import` + `GET /admin/leads/export` (honors status/source filters; headers `name,contactInfo,message,source`; per-row validation, 500-row cap, duplicate contactInfo skipped), `POST /admin/team/import` (11-column CSV, slug auto-generated from name, duplicate slug/email skipped, audit hook `team.import`) + `GET /admin/team/export`, `GET /admin/content/export` (key,locale,value,updatedAt; optional locale filter), `GET /admin/reviews/export` (honors search/published; includes customer + project names). Content and Reviews are export-only by design (keyed CMS copy is created in-app; feedback originates from customers). New repo method `ILeadRepository.ContactInfoExistsAsync`.
- **Frontend:** `client.ts` gains `leads.importCsv/exportCsv`, `team.importCsv/exportCsv`, `content.exportCsv`, `reviews.exportCsv`; Leads and Team pages get Import + Export CSV buttons (import via hidden file input, toast summary, refresh; export honors current filters), Content and Reviews get Export CSV buttons (Portfolio already had both).
- **Also:** fixed the xUnit analyzer warning (`Assert.NotNull` on a `Guid` → `Assert.NotEqual(Guid.Empty, ...)` in `CustomerWorkflowTests.cs`).
- **Tests:** `ImportExportTests.cs` (4 tests): lead import create/skip/error rows, lead export filter honoring, team import slug-skip + auto-slug, team/content export payloads incl. quoted-CSV escaping. Suite: 82/82.
- **Validation:** backend build 0 errors; 82/82 tests pass; `tsc` + production build pass for all three frontends; Playwright suite collects 7 tests (live e2e run still blocked — SQL Server unreachable from WSL, so the API cannot start).
- **Docs:** GAP-006 VERIFIED, GAP-010 DONE (evidence + resolution recorded); CURRENT-IMPLEMENTATION-STAGE known-bugs section cleared of the two resolved items.

## 2026-08-10 - Server-side dashboard aggregate + RAG/GitHub observability (GAP-011, GAP-012)

- **Task:** Replace the dashboard's N+1 client-side aggregation with one admin-authorized aggregate endpoint, and surface RAG/GitHub sync status in the admin System Status card.
- **Backend:** `DashboardStatsService` (`IDashboardStatsService`): one `GetAsync()` returns customer totals (active/inactive), customer projects total + by-status, leads total/new/new-7d/by-status, reviews total/published/pending, team total/active, portfolio total/published, pending drafts, chat threads needing manual intervention, unread notifications, latest GitHub snapshot (synced-at + last-commit across the team), repository count, knowledge chunk count, and pending+running agent task count. Counts use true `CountAsync` queries (no page-size caps, so they stay accurate at scale). Repo surface additions in `Repositories.cs`: `ICustomerRepository.CountAllAsync(search, isActive)` (splits the existing combined admin query), `ICustomerProjectRepository.CountByStatusAsync`, `ILeadRepository.CountNewSinceAsync`, `ILeadRepository.CountAsync(status, source)` (split so status-only counts work), `IChatRepository.CountThreadsAsync(type, needsManualIntervention)`, `INotificationRepository.CountAsync(unread)`, `IContentDraftRepository.CountAsync(status)`, `IGithubRepositoryRepository.CountAsync(search)`, `IKnowledgeChunkRepository.CountAsync`, `IAgentTaskRepository.CountByStatusAsync`, `ITeamRepository.GetLatestSnapshotsAsync(ids)` (latest snapshot per member in one pass; skips GitHub traversal when no teams exist). Route: admin-authorized `GET /api/v1/admin/dashboard/stats` returning `{ data: DashboardStatsDto }`.
- **Frontend (web-admin):** `client.ts` gains `statsApi.get()`; `Dashboard.tsx` `load()` is now server-first — it calls the stats endpoint in parallel with the activity feed (5-lead page, 5-chat-thread page, 10 pending drafts, 5 recent notifications) and only falls back to a module-level `aggregateClientSide()` (same per-source parallel `Promise.allSettled` aggregation as before, minus the new server-only fields) when the endpoint is unavailable, showing a partial-data notice. System Status card gains Synced repositories, Knowledge chunks, and Pending agent tasks rows; the Dashboard now also shows the leads-new-7d card.
- **Tests:** `DashboardStatsTests.cs` seeds customers/projects/leads/drafts/threads/notifications/repositories/chunks/tasks and asserts every aggregate count (78 total backend tests). Note: this EF InMemory setup does not expose Added-but-unsaved entities to queries, so the test saves before querying (same pattern as the existing suite).
- **Docs:** GAP-011 and GAP-012 marked DONE with evidence; GAP-009's resolution now references the shipped endpoint.
- **Validation:** `dotnet build backend/RALabs.sln` passed (0 errors); 78/78 backend tests passed; `web-admin` `tsc --noEmit` and production build passed. Runtime browser validation of the new card still pending (SQL Server unreachable from WSL).

## 2026-08-09 - AI agent phase 2 self-review pass (bug fixes)

- **Task:** Static review of the Phase 2 code paths after the main build (runtime validation still blocked by SQL unreachability).
- **Backend fixes:** `ChatService` now creates admin notifications for pending briefs and chat-created projects (the agent promised "the team has been notified" but only the escalation path notified); notifications fire only when the flag transitions false->true to avoid duplicates; the streaming route catches provider failures (HttpRequestException/JsonException/IO/cancellation) and falls back to the deterministic reply instead of aborting mid-SSE, returns 403 for forbidden threads, and drops the unused local; the audit-logs route now returns `totalPages` in its pagination payload (the admin Audit page expects it).
- **Frontend fixes:** `web-public/AgentChat.tsx` last-agent-message lookup used the full message index on the filtered array (off-by-one → handoff banner missed and `voice.speak(undefined.content)` could throw when voice response was on) — now reverse-find; the streaming path appended the optimistic visitor message twice — fixed; failed streams now remove the partial streaming bubble; `recognition.start()` wrapped in try/catch in `useVoice` and the customer agent page (a synchronous permission throw left the UI stuck in "listening"). `web-customer/AgentChat.tsx` last-reply lookup hardened the same way.
- **Validation:** backend build passed; 77/77 tests passed; `web-public`, `web-customer`, `web-admin` production builds passed.

## 2026-08-09 - RA Labs AI agent: orchestrator, voice, streaming, settings, super admin audit (GAP-019..024)

- **Task:** Turn the keyword chatbot into an actual agent: full-screen ChatGPT-style experience on public + customer apps, guided project intake and registration handoff, voice input/output with proper states and an admin switch, LLM streaming with honest fallback, chat attachments, system settings + public config endpoint, and Super Admin hardening with an audit trail.
- **Backend:** `SystemSetting` + `AuditLog` entities (with repositories `ISettingRepository`/`IAuditLogRepository` and services `SettingService`/`AuditService`); `ChatThread` gained `CustomerId` (ownership binding) and `AgentContext` (JSON state); `ChatMessage` gained `SuggestedActions`; `AgentChatService` implements `IAgentService` + `IChatStreamingService`: intent detection (create/start/build/develop/new project/...) driving a guided 7-step project-brief intake (name/problem/users/features+tech/timeline/budget/extras -> confirm), quick actions and per-message suggested actions, RAG-grounded QA fallback, anonymous brief preservation (`PendingBrief` flags the thread for the team + notification), customer confirm creates the project via `CustomerProjectService`, registration handoff `?agent=<threadId>` + `ClaimThreadAsync` binding, and an OpenAI SSE streaming path that is only active when a provider key AND `ai.streaming.enabled` are configured (409 `STREAMING_DISABLED` otherwise); `CustomerProjectService` now takes `IChatRepository` instead of `IChatService` to break the ChatService->AgentChatService->CustomerProjectService->ChatService cycle; `ChatService` gained agent integration, `ClaimThreadAsync`, `AppendUserMessageAsync`/`AppendAgentMessageAsync`, and ownership-scoped `GetThreadAsync(customerId)`; `CreateAdminRequest.Role` added (only admin/super_admin; only a super admin may grant super_admin); MCP `EnsureAdmin` accepts the role hierarchy and `/mcp/call` resolves the caller id for super admins too; `DbInitializer` seeds settings defaults (voice off, streaming off, model gpt-4o-mini, max audio 60s).
- **Routes:** public `GET /api/v1/config` (voice/streaming flags, providers, model, max audio duration, customer portal URL — never secrets), `POST /api/v1/chat/attachments` (rate-limited "chat", 10 MB cap, type allowlist, private storage) + `GET /api/v1/chat/attachments/{**path}`, `POST /api/v1/chat/{threadId}/messages/stream` (SSE); customer `POST/GET /agent/thread`, `POST /agent/thread/{id}/messages`, `POST /agent/thread/{id}/claim`; admin `GET/PUT /admin/settings` (super_admin, key allowlist) and `GET /admin/audit-logs` (super_admin). Audit hooks on auth.login, admin.create, project.*, github.sync, draft.review, rag.ingest, team.*, customer.status, settings.update via a shared `GetActorId` helper.
- **Migration:** `AgentSystemSettingsAuditAndChatAgent` (20260809143610): adds `SystemSettings` and `AuditLogs` tables plus `ChatThread.CustomerId`/`AgentContext` and `ChatMessage.SuggestedActions`.
- **Public UI:** new full-screen `/agent` page (thread key `ralabs-public.chat.thread` shared with the widget, quick actions, suggested-action chips, attachment upload + image preview, thinking state, streaming bubbles with fallback, registration handoff banner linking to the customer portal with the thread id); shared `useVoice` hook (listening/speaking/denied/unsupported/error states, permission UX, max-duration auto-stop, TTS with interrupt) + shared `speech.d.ts` typings; voice and streaming gated by `GET /api/v1/config`.
- **Customer UI:** new full-screen `/agent` page; Register reads `?agent=` into localStorage (`ralabs-customer.agent-thread`) so the agent page claims the thread and resumes the pending brief; inline voice (listening + TTS speaking) with the same states.
- **Admin UI:** `Settings.tsx` gained a super_admin-only "AI & Voice" card (voice/streaming toggles, model, STT/TTS providers, max audio duration) plus a Role selector on the admin-create form; new `AuditLog.tsx` page (super_admin-only, action/actor filters, pagination) with nav entry.
- **Validation:** `dotnet build backend/RALabs.sln` passed; 77/77 backend tests passed (added `AgentChatTests.cs`: anonymous intake -> pending brief, customer confirm -> project created, QA fallback); `has-pending-model-changes` clean; `web-public`, `web-customer`, `web-admin` production builds passed; `docs/SUPER-ADMIN-CREDENTIALS.md` and frontend `.env.example` files added. Runtime browser/voice/streaming validation still pending (SQL Server unreachable from WSL; three migrations pending apply on the Windows side).
- **Result:** GAP-019..024 all DONE. Remaining: runtime validation, plus pre-existing GAP-011/GAP-012 backend follow-ups.

## 2026-08-09 - Live portfolio / customer showcase (GAP-013..018)

- **Task:** Turn the `Project` portfolio into a live-site showcase: case-study fields, admin feature/active/import/export management, featured homepage + structured case-study pages, incremental RAG sync, and an AI refresh pipeline grounded in verified project data.
- **Backend:** `Project` entity extended (liveSiteUrl, category, businessPurpose, problemSolved, solution, keyFeatures, screenshots, duration, teamMemberIds, completedAt, customerReference, showCustomerReference, isFeatured, isActive); DTOs extended + `TeamBriefDto`/`ProjectDetailDto`/import-export result records; `Guard.HttpsUrl` + duplicate live-URL check; `ProjectService` rewritten (ListAdminAsync with search/category/status/featured/active/published + pagination newest-first, GetAdminByIdAsync, SetActiveAsync, SetFeaturedAsync, ImportAsync/ExportAsync mirroring the Customers CSV pattern, RAG sync hooks on every mutation); `RagIngestionService.SyncProjectAsync` (delete `project:{id}`, re-add only when active+published, honors showCustomerReference); `ContentDraft.ProjectDraftId` + `GenerateProjectRefreshAsync` (grounded prompt from the project's own stored data) + review that applies to the existing project without auto-publishing and re-syncs RAG; MCP tools `generate_project_refresh` + updated create/update/review tool args; routes: admin `GET /projects/{id}`, `PATCH /projects/{id}/active`, `PATCH /projects/{id}/featured`, `POST /projects/import`, `GET /projects/export`, `POST /content-drafts/generate-for-project/{projectId}`, public `GET /projects/featured`, `GET /projects/{slug}` now returns ProjectDetailDto.
- **Migrations:** `PortfolioLiveSiteFields` (20260809102238, 14 columns incl. JSON list columns) and `ContentDraftProjectLink` (20260809103250). Note: the earlier `AdminNotifications` migration was empty (no DDL); the diff correctly surfaced its missing `AdminNotifications` table, which is now created by `PortfolioLiveSiteFields` so the notification feature works after apply.
- **Admin UI:** `client.ts` projects API rewritten (Paginated<Project>, get, setActive, setFeatured, importCsv, exportCsv blob, drafts.generateForProject) with `request` helper extended for FormData/blob; `Portfolio.tsx` rebuilt with extended form (case-study fields, team checkboxes, URL validation), server-side filters (search/category/status/featured/active), feature/active row toggles, Import/Export buttons, bulk publish/unpublish/feature/unfeature/delete with confirmations, and an AI Draft row action; `types/index.ts` Project/ProjectForm extended; CSS `form-grid`/`checkbox-group`.
- **Public UI:** `client.ts` ProjectSummary/ProjectDetail extended + TeamBrief + `getFeaturedProjects`; Homepage "Currently featured work" section (renders only when data exists); ProjectCard live-site/github meta; WorkDetail structured case study (facts row, built-by team chips, business purpose / problem / solution, key features, screenshots grid — all conditional on data), "Live site" link alongside GitHub (all `target="_blank" rel="noopener noreferrer"`); CSS for facts/sections/team-inline/feature-list/screenshot-grid.
- **Validation:** `dotnet build backend/RALabs.sln` passed; 74/74 backend tests passed (added fake ITeamRepository/IRagIngestionService stubs and fixed stale ProjectService/DTO constructor call sites); `dotnet ef migrations has-pending-model-changes` clean; `web-admin` and `web-public` production builds passed. Runtime browser validation still pending (SQL Server unreachable from WSL; migration apply must run on the Windows side where the DB lives).
- **Result:** GAP-013..018 all DONE. Remaining: browser validation, and the pre-existing GAP-011 (aggregate stats endpoint) / GAP-012 (RAG/sync status surface) backend follow-ups.

## 2026-08-09 - Admin enterprise dashboard audit

- **Task:** Audit the admin console against the enterprise-dashboard transformation request (READ -> UNDERSTAND -> AUDIT -> GAP ANALYSIS -> IMPLEMENT).
- **Audit evidence:** Full admin API surface read (`web-admin/src/api/client.ts` 521 lines; backend admin route sweep 328-607 of `Program.cs`); capability matrix built across all 16 admin pages; CSS infrastructure inventory (`stat-grid`, `stat-card`, badge system, state-message, card, table all exist).
- **Findings:** GAP-009 (dashboard minimal, 126 lines, leads-only), GAP-010 (no sorting anywhere; capabilities inconsistent per page; customer-projects list lacks pagination), GAP-011 (no aggregate stats endpoint; client-side counting capped at 100 rows), GAP-012 (no RAG chunk or consolidated GitHub sync status surface). All existing pages are already modal-free; bulk selection exists on Reviews/Team/Portfolio/Customers; Customers is the only import/export page.
- **Decision:** Reuse existing admin endpoints for the dashboard via parallel client-side aggregation (avoids touching the agent-dirty backend), while registering GAP-011 as the recommended backend follow-up. Zero new npm dependencies: charts rendered in CSS/SVG.
- **Result:** GAP-009 through GAP-012 registered. Implementation follows in the next log entries.

## 2026-08-09 - Admin command center dashboard

- **Task:** Replace the four-stat dashboard with an enterprise command center (GAP-009).
- **UI changes:** Rebuilt `Dashboard.tsx` with 8 KPI cards (total/active/inactive customers, customer projects, 7-day new leads, pending reviews, team members, portfolio publishing, pending drafts, chat intervention), a leads-by-status donut, customer-projects and portfolio bar charts, a system status card (GitHub last sync, last team commit, pending drafts, unread notifications), a pending-actions queue, a recent activity feed (leads, drafts, chat merged by timestamp), quick actions, and refresh/GitHub-sync actions. All metrics aggregate client-side in parallel from existing admin endpoints using `Promise.allSettled` with graceful per-source degradation. Zero new npm dependencies (SVG/CSS charts).
- **Components added:** `StatCard`, `DonutChart`, `BarChart` (shared consistency kit start); `Pagination`, `SortableTh`.
- **Validation:** `web-admin` production build (`tsc && vite build`) passed. Runtime browser validation deferred: SQL Server instance `RAJIB\SQLEXPRESS` was unreachable from the current WSL environment, so the API could not start.
- **Result:** GAP-009 advanced to PARTIAL. GAP-011 (backend aggregate endpoint) remains the recommended backend follow-up.

## 2026-08-09 - Admin consistency kit rollout

- **Task:** Apply sorting, search, and pagination consistently across admin lists (GAP-010).
- **UI changes:** Leads gained a search box plus sortable Name/Contact/Source/Status/Date columns and the shared Pagination; Team gained search, sortable Name/Role/GitHub/Published/Active columns, and client-side pagination; Portfolio gained search, sortable Title/Status/Published/Order/Created columns, and pagination; Content gained search plus sortable Key/Locale/Updated columns; Reviews now renders the shared Pagination footer. Customer-projects deliberately remains a kanban board where pagination does not apply (recorded as a design decision in GAP-010).
- **Validation:** `web-admin` production build passed. Browser validation deferred due to SQL Server being unreachable from WSL (see previous entry).
- **Remaining:** Import/export parity beyond Customers, and the GAP-011 aggregate endpoint.


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
