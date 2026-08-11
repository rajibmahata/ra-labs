# RA Labs Current Implementation Stage

## Snapshot Date
2026-08-09

## Current Version
v1.1.1 (commit `7a9f5bc7a1b380b5c3d1aa47497d9b153b965449`)

## Overall Completion
Implementation slices are complete for GitHub repository automation, reviewable OpenAI project drafts, admin approval, private customer documents, browser voice input, the live portfolio showcase, and the RA Labs AI agent (guided intake, voice, streaming, attachments, system settings, super admin audit). Production readiness is still gated by infrastructure, security audit, and full E2E evidence.

## Working Features
- .NET 8 four-project backend builds successfully.
- 77 backend tests pass.
- SQL Server EF Core provider and migrations are present.
- Public project, team, content, lead, and chatbot endpoints are registered.
- Admin and customer JWT authentication flows are registered.
- Customer project, document, PRD, demo, invoice, and feedback services exist.
- MCP registry, rate limiting, security headers middleware, GitHub sync, and RAG ingestion surfaces exist.
- MCP also exposes AI draft review and deterministic permission-scoped RAG query operations.
- `web-public`, `web-customer`, and `web-admin` production builds pass.
- Customer project child-resource reads now enforce authenticated customer ownership in REST and MCP paths.
- Customer PWA manifest, icons, service-worker registration, and service-worker cache URLs are base-path aware for `/customer/`.
- GitHub sync persists repository URL, description, language, technology metadata, and README snapshots.
- GitHub sync detects meaningful repository snapshot changes and queues a re-analysis `AgentTask`.
- OpenAI project drafting is server-only, key-gated, factual-source constrained, and persisted as pending `ContentDraft` records.
- Admin draft queue supports explicit approve/reject review; approval creates an unpublished `Project` record.
- Customer chat supports Web Speech API dictation plus safe navigation commands for dashboard, account, projects, current project, and back; customer file upload/download uses authorized private storage.
- Public homepage now explains the customer journey from understanding through approval, with a structured first-brief preparation section.
- Customer project creation captures goal, audience, requirements, timeline, budget or constraints, and reference links; the brief is visible in customer and admin project details and creation opens the project room.
- Admin Team and My Profile support GitHub account URLs and write-only personal access tokens; tokens are encrypted at rest and never returned to the UI. Admins can manually trigger synchronization, and public Work renders synchronized repository metadata beside curated projects.
- Portfolio projects are now a live-site showcase (2026-08-09): case-study fields (live site URL with HTTPS-preferring validation and duplicate check, category, business purpose, problem, solution, key features, screenshots, duration, team member links, completed date, customer reference gated by showCustomerReference, isFeatured, isActive), admin feature/active/import/export management with server-side filters, incremental per-project RAG chunk sync on every mutation, and an AI refresh pipeline that drafts from the project's own verified data and applies on approval without auto-publishing.
- RA Labs AI agent (2026-08-09): an agent orchestrator now drives public and customer chat — intent detection with a guided 7-step project-brief intake (confirm creates the project for logged-in customers), RAG-grounded QA fallback, quick actions and per-message suggested actions, anonymous brief preservation that flags the thread for the team, and a registration handoff that binds the thread to the customer after signup. Voice is implemented with real states (listening/speaking/denied/unsupported/error), TTS with interrupt, and admin switches (`ai.voice.enabled`, `ai.voice.response`). Streaming is implemented but only active when an OpenAI key AND `ai.streaming.enabled` are configured — the server returns 409 `STREAMING_DISABLED` and the public app falls back to the standard endpoint rather than pretending to stream. Chat attachments (10 MB, type allowlist, private storage) and a safe public `GET /api/v1/config` are live. Super Admin hardening: role hierarchy in MCP and admin creation, and a full audit log (`GET /admin/audit-logs`) with hooks on login, admin CRUD, settings, portfolio, drafts, RAG, GitHub sync, team, and customer status changes.

## Partially Working Features
- Customer portal source and production build now pass after restoring its dependency tree.
- Browser smoke coverage passes 7/7 across public, customer login, admin login, and mobile overflow flows.
- Voice command routing is build-validated, but browser simulation and a dedicated component-test runner are not yet configured.
- Customer project lifecycle is represented in domain/application code but is not fully validated end to end.
- Chatbot/RAG has deterministic SQL retrieval with public/project permission filtering and Qdrant-ready infrastructure; semantic production retrieval and model-provider integration are incomplete.
- Public site design references exist; browser audit confirms the shell is responsive without horizontal page overflow. The earlier work/team 500 was reproduced with the API unavailable and cleared when the API was started on the configured proxy target.
- CMS, GitHub, AI draft, approval, PWA, localization, and admin workflows have implementation slices but lack complete production validation.

## Missing Features
- Complete production coverage across all requested public, customer, admin, AI, CMS, payment, marketing, and collaboration requirements.
- Complete integration/E2E/Playwright coverage and QA sign-offs.
- Approved production object-storage integration and complete file-content scanning pipeline.
- Complete observability, deployment, performance, accessibility, and security audit evidence.

## Known Bugs
- GitHub sync currently needs `GithubUsername` in addition to the account URL; repository publication has no per-repository approval/privacy flag yet; Data Protection keys require durable shared production storage for multi-instance deployments.

## Current Architecture
React 18 + Vite 6 frontends (2026-08-10: react-router-dom 7.18.2 + vite 6.4.3 across all three apps to clear `npm audit`); ASP.NET Core minimal API; Domain/Application/Infrastructure layers; EF Core SQL Server provider; Qdrant client; MCP thin tool registry. `docs/ARCHITECTURE.md` contains stale PostgreSQL references that conflict with the actual SQL Server project configuration and `AGENTS.md`.

## Backend Status
Build PASS with `dotnet build backend/RALabs.sln`. Test PASS: 82/82 (2026-08-10; added `DashboardStatsTests` for the aggregate endpoint and `ImportExportTests` for the admin CSV flows). Additive migrations through `PortfolioLiveSiteFields` (20260809102238), `ContentDraftProjectLink` (20260809103250), and `AgentSystemSettingsAuditAndChatAgent` (20260809143610) are generated and the model snapshot matches the code (`dotnet ef migrations has-pending-model-changes` clean). The `PortfolioLiveSiteFields` migration also carries the previously-missing DDL for the `AdminNotifications` table (the earlier migration was empty), so notifications start working after apply. API runtime smoke previously passed on 2026-08-08 at `http://localhost:5002`; development startup uses an explicit local-only JWT secret while base and production configuration remain environment-only. Health, public, auth, customer, admin, chat, MCP, representative CRUD, authorization, and state-machine paths were exercised. Admin browser proxy login/dashboard also PASS. Applying the three new migrations requires the SQL Server (Windows side) to be reachable.

## Frontend Status
`web-public`, `web-customer`, and `web-admin` production builds PASS. On 2026-08-10 all three frontends were upgraded to react-router-dom 7.18.2 + vite 6.4.3 (`BrowserRouter future` props removed — v7 defaults) and `npm audit` now reports 0 vulnerabilities in each. On 2026-08-09 the `web-admin` build additionally passed with the rebuilt command-center dashboard (KPI grid, donut/bar charts, pending actions, activity feed, quick actions, GitHub sync action) and the shared consistency kit (StatCard, DonutChart, BarChart, Pagination, SortableTh) applied across Leads, Team, Portfolio, Content, and Reviews. The same day the portfolio phase shipped: `web-admin` Portfolio page gained the extended case-study form, feature/active toggles, filters, CSV import/export, bulk actions, and an AI Draft action; `web-public` gained a featured-work homepage section and a structured case-study detail page (facts, built-by team, problem/solution, key features, screenshots, live-site link). The AI agent phase shipped: full-screen `/agent` pages in `web-public` and `web-customer` (quick actions, suggested-action chips, attachments, thinking state, handoff banner, streaming with fallback on public), the shared `useVoice` hook + `speech.d.ts` typings, a `?agent=` registration bridge on the customer Register page, and admin Settings "AI & Voice" card plus the new Audit Log page. On 2026-08-10 the admin consistency kit was completed with Import/Export buttons on Leads and Team and Export buttons on Content and Reviews (Portfolio already had both).

## Database Status
SQL Server is the actual configured provider and migrations exist. The 2026-08-09 phases added three additive migrations (`PortfolioLiveSiteFields`, `ContentDraftProjectLink`, `AgentSystemSettingsAuditAndChatAgent`); none has been applied to the live DB yet (SQL Server unreachable from the current WSL environment). Data integrity and non-destructive migration behavior have not been fully audited in this snapshot.

## AI/RAG Status
Chatbot, agent task, knowledge chunk, ingestion, Qdrant-ready retrieval, GitHub source snapshots, and OpenAI draft generation exist. OpenAI requires server-side `OpenAI__ApiKey`; drafts never publish automatically. Production semantic retrieval, grounding evaluation, and complete tenant-boundary tests remain incomplete.

## Authentication Status
JWT admin/customer login, refresh, password reset, rate limiting, and role policies are present. Customer project child-resource REST and MCP reads now enforce ownership with non-leaking 404 responses.

## Customer Workflow Status
Project creation/detail, structured brief intake, documents, PRD signing, demo, invoices, and feedback are represented. Full lifecycle persistence, auditability, and end-to-end workflow validation are not complete.

## Admin Workflow Status
Admin project, customer, content, team, lead, chat, GitHub, RAG, and AI draft review routes exist. The AI draft queue is available at `/admin/drafts`. On 2026-08-09 the admin console gained an enterprise command-center dashboard and consistent sorting/search/pagination across management lists; GAP-009 and GAP-010 advanced to PARTIAL. The same day the portfolio phase closed GAP-013..018: full case-study CRUD with live-site validation, feature/active management, CSV import/export, server-side filters, incremental RAG sync, and project-grounded AI refresh drafts (approval applies to the existing project without auto-publishing). The AI agent phase closed GAP-019..024: chat is now agent-driven (guided intake, handoff, QA fallback), voice/streaming/attachments exist behind admin-controlled settings, and Super Admin hardening added role-aware admin creation, an audit log page, and audit hooks across key admin actions. Remaining follow-ups: the aggregate stats endpoint (GAP-011) and RAG/sync status surface (GAP-012).

## Testing Status
Backend unit/service suite: 77 passing. All three frontend production builds pass. Playwright suite: 7 passing. Integration tests, API tests, security regression tests beyond the existing service coverage, and comprehensive accessibility/performance coverage remain incomplete.

## Security Status
Rate limiting, JWT, role authorization, security headers, and password hashing surfaces exist. Tenant read authorization and validated private local document storage are regression-tested. Production object storage and frontend dependency vulnerabilities require remediation and review.

## Performance Status
No measured production performance baseline or load-test evidence is recorded.

## Documentation Status
Existing architecture, API, PRD, and workflow documents are present. Required project-state records were absent before this snapshot and are being established now.

## Current Sprint
No active sprint is defined; `docs/current-sprint.md` is still a template.

## Current Priority
Apply the three pending migrations (`PortfolioLiveSiteFields`, `ContentDraftProjectLink`, `AgentSystemSettingsAuditAndChatAgent`) on the Windows-side SQL Server, then complete browser validation of the portfolio and AI agent features (agent pages, voice, streaming with a configured OpenAI key, attachments, settings, audit log). After that: address file upload security and dependency vulnerabilities, reconcile architecture docs, then the GAP-011/GAP-012 backend follow-ups.

## Active Development Area
RA Labs AI agent (agent orchestrator, voice, streaming, attachments, system settings, super admin audit) — implementation done, runtime validation pending.

## Blockers
- Customer dependency audit findings require review.
- Production object storage provider and malware/content scanning policy are not yet configured.
- API runtime smoke evidence is recorded; repeatable deployment and database migration validation remain pending (three additive migrations pending apply; SQL Server unreachable from the current WSL environment).
- Product/provider decisions remain open for production LLM, email, and vector retrieval operations.

## Technical Debt
Stale architecture database references; local storage needs production object-storage replacement; incomplete audit/event model; missing comprehensive E2E/security/performance evidence; template living documents.

## Open Questions
- Which production LLM, email, object storage, and Qdrant deployment are approved?
- Is the current checked-out `main` branch the intended implementation branch despite repository workflow requiring `task-*` branches from `develop`?
- Which missing features are in the current release scope versus later milestones?

## Last Validated Commit
`7a9f5bc7a1b380b5c3d1aa47497d9b153b965449`

## Last Successful Build
2026-08-09: `dotnet build backend/RALabs.sln`; `web-admin`, `web-public`, and `web-customer` production builds (AI agent phase).

## Last Successful Test Run
2026-08-09: `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj --no-build`, 77 passed, 0 failed.

## Last Successful Smoke Test
2026-08-08: API route/authorization/state-machine sweep against `http://localhost:5002`; admin browser `/admin/` loaded successfully without 500.

## Production Readiness
NOT PRODUCTION READY. Secure local document storage and offline chat are implemented, but production object storage, dependency vulnerabilities, feature-completeness, and broader quality-gate evidence remain outstanding.
