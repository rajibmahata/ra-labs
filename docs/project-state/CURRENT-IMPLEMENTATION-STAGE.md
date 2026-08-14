# RA Labs Current Implementation Stage

## Snapshot Date
2026-08-12

## Current Version
v1.2.3 (premium homepage + agent lead flow + admin professional redesign + /agent page redesign + customers page; uncommitted working tree — see IMPLEMENTATION-LOG 2026-08-11/2026-08-12)

## Overall Completion
The AI agent is now the front door of the studio: an anonymous visitor's guided conversation collects a project brief AND contact details and, on confirm, match-or-creates a customer, creates the project request, emails a confirmation with a reference, and flags a detailed admin notification. The public homepage and agent experience were redesigned to the approved dark-first premium theme (`docs/design/ralabs_agent_template.html` + `PSD2.png`). Production readiness is still gated by infrastructure, security audit, and full E2E/runtime evidence (SQL Server unreachable from WSL).

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
- RA Labs AI agent (2026-08-11): the guided create-project intake now collects contact details for anonymous visitors (name optional, email required+validated, phone optional+validated) and on confirm match-or-creates the customer (unique Email index prevents duplicates), creates the project request, sends a confirmation email (PJ-XXXXXX reference + portal link) only after persistence, and produces a DETAILED project_created_via_chat admin notification (fixed QA-001: brief details now survive the context reset via `AgentContext.CompletedBrief`). Customers skip contact steps (review at step 7; anonymous at step 10). New `ai.agent.enabled`/`ai.rag.enabled` settings flow through `/api/v1/config` and the admin Settings page. Migration `AddCustomerPhone` adds `Customers.Phone`. 92/92 backend tests pass.
- RA Labs AI agent (2026-08-09): an agent orchestrator now drives public and customer chat — intent detection with a guided project-brief intake (confirm creates the project for logged-in customers), RAG-grounded QA fallback, quick actions and per-message suggested actions, anonymous brief preservation that flags the thread for the team, and a registration handoff that binds the thread to the customer after signup. Voice is implemented with real states (listening/speaking/denied/unsupported/error), TTS with interrupt, and admin switches (`ai.voice.enabled`, `ai.voice.response`). Streaming is implemented but only active when an OpenAI key AND `ai.streaming.enabled` are configured — the server returns 409 `STREAMING_DISABLED` and the public app falls back to the standard endpoint rather than pretending to stream. Chat attachments (10 MB, type allowlist, private storage) and a safe public `GET /api/v1/config` are live. Super Admin hardening: role hierarchy in MCP and admin creation, and a full audit log (`GET /admin/audit-logs`) with hooks on login, admin CRUD, settings, portfolio, drafts, RAG, GitHub sync, team, and customer status changes.
- Premium homepage redesign (2026-08-11): web-public matches `docs/design/ralabs_agent_template.html`/`PSD2.png` — dark-first (default) + light theme via `data-theme` + `useTheme` with FOUC guard; exact template tokens (dark `#030b12`/`#69ef39`/`#26c94a`/`#3198ff`/`#8d63ff`; light ivory/emerald); two-column hero with isometric cube visual + the real functional agent panel inline (mobile = full-width inline, no bottom sheet), persistent 4-chip quick actions (🚀 Start a Project · ‹/› Our Services · 📁 Our Work · 💡 Ask Anything), "What the agent can do" cards, 5-metric strip, "Real products. Real outcomes." work cards, API-driven portfolio/team/journey/contact; nav with logo tagline, theme toggle, status pill, Start a Project CTA; `useVoice` (idle/listening/transcribing/speaking/denied/unsupported/error, interim transcripts, cancel/stop, TTS interrupt) drives honest voice UI. UX gate cleared (a11y aria-hidden, light-theme tokens/contrast, responsive 821–1100px header, /agent header styles, focus management).

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
Build PASS with `dotnet build backend/RALabs.sln`. Test PASS: 92/92 (2026-08-11; `AgentChatTests` extended for the contact-step lead flow — anonymous confirm creates customer+project+email, duplicate-email reuse, email/phone validation, Guest default, confirmation email reference, detailed admin notification). Additive migrations through `AddCustomerPhone` (20260811165839) are generated and the model snapshot matches the code (`dotnet ef migrations has-pending-model-changes` clean). The `PortfolioLiveSiteFields` migration also carries the previously-missing DDL for the `AdminNotifications` table (the earlier migration was empty), so notifications start working after apply. API runtime smoke previously passed on 2026-08-08 at `http://localhost:5002`; development startup uses an explicit local-only JWT secret while base and production configuration remain environment-only. Applying the newer migrations requires the SQL Server (Windows side) to be reachable.

## Frontend Status
`web-public`, `web-customer`, and `web-admin` production builds PASS. On 2026-08-11 the `web-public` homepage + agent experience were redesigned to the approved dark-first premium theme (`docs/design/ralabs_agent_template.html` + `PSD2.png`): exact template tokens in CSS variables, dark default + light via `data-theme` with FOUC guard and localStorage persistence (only on toggle), two-column hero with isometric cube visual and the functional agent panel inline (full-width on mobile), persistent 4-chip quick actions, capability cards, metrics strip, work cards, API-driven portfolio/team/journey/contact, restyled Nav (Georgia logo tagline, theme toggle, status pill, Start a Project), and the honest `useVoice` hook driving composer voice states. A UX gate (ux-engineer) then cleared 14 issues: a11y `aria-hidden` on the interactive panel, light-theme card gradient + muted-text contrast, 821–1100px header overflow, template-faithful mobile agent panel, `/agent` header styling, focus management, status-badge variants, error color tokens. On 2026-08-12 `web-admin` was redesigned to the professional reference (`ralabs_admin_portfolio_professional.html` + `Admin PSD.png`): aligned palette, sidebar user block, topbar search, stat cards, refined tables/pagination; `ConfirmDialog` popup is the ONLY dialog in the app (delete confirmation; all add/edit are inline panels; bulk actions use the popup); PWA manifest + index.html completed and responsive from 320px. `tsc --noEmit` and production builds pass for all three apps.

## Database Status
SQL Server is the actual configured provider and migrations exist. The 2026-08-11 phase added `AddCustomerPhone` (20260811165839); prior pending migrations include `PortfolioLiveSiteFields`, `ContentDraftProjectLink`, and `AgentSystemSettingsAuditAndChatAgent`. None has been applied to the live DB yet (SQL Server unreachable from the current WSL environment). Data integrity and non-destructive migration behavior have not been fully audited in this snapshot.

## AI/RAG Status
Chatbot, agent task, knowledge chunk, ingestion, Qdrant-ready retrieval, GitHub source snapshots, and OpenAI draft generation exist. OpenAI requires server-side `OpenAI__ApiKey`; drafts never publish automatically. Production semantic retrieval, grounding evaluation, and complete tenant-boundary tests remain incomplete.

## Authentication Status
JWT admin/customer login, refresh, password reset, rate limiting, and role policies are present. Customer project child-resource REST and MCP reads now enforce ownership with non-leaking 404 responses.

## Customer Workflow Status
Project creation/detail, structured brief intake, documents, PRD signing, demo, invoices, and feedback are represented. Full lifecycle persistence, auditability, and end-to-end workflow validation are not complete.

## Admin Workflow Status
Admin project, customer, content, team, lead, chat, GitHub, RAG, and AI draft review routes exist. The AI draft queue is available at `/admin/drafts`. On 2026-08-09 the admin console gained an enterprise command-center dashboard and consistent sorting/search/pagination across management lists; GAP-009 and GAP-010 advanced to PARTIAL. The same day the portfolio phase closed GAP-013..018: full case-study CRUD with live-site validation, feature/active management, CSV import/export, server-side filters, incremental RAG sync, and project-grounded AI refresh drafts (approval applies to the existing project without auto-publishing). The AI agent phase closed GAP-019..024: chat is now agent-driven (guided intake, handoff, QA fallback), voice/streaming/attachments exist behind admin-controlled settings, and Super Admin hardening added role-aware admin creation, an audit log page, and audit hooks across key admin actions. On 2026-08-12 the admin UI was redesigned to the approved professional reference (`ralabs_admin_portfolio_professional.html` + `Admin PSD.png`): palette aligned (sidebar `#0b1427`, content `#f5f7fb`, blue `#2563eb`, success/warning/danger tokens), sidebar user block + topbar search + stat-card rows + refined tables/pagination; the ONLY popup in the app is the delete confirmation (`ConfirmDialog` — scrim, focus trap, Escape, loading), with all create/edit flows as inline panels and bulk delete/activate/deactivate using the popup; PWA manifest + index.html completed (installable, `#0b1427`, offline fallback); responsive 320px→desktop with a sidebar icon rail ≤720px. The Customers page (`/admin/customers`) was then rebuilt as a complete zero-popup management surface (GAP-029): debounced search + status filter, Import/Export CSV, inline View + Edit panels, per-row activate/deactivate/delete (inline row confirm), and bulk activate/deactivate/delete via an inline confirmation bar. `web-admin` production build + `tsc --noEmit` pass.

## Testing Status
Backend unit/service suite: 92 passing (2026-08-11). All three frontend production builds pass (`web-public`, `web-customer`, `web-admin`). Playwright suite: 7 tests collected (live e2e run blocked — no servers/SQL in this environment). Integration tests, API tests, security regression tests beyond the existing service coverage, and comprehensive accessibility/performance coverage remain incomplete.

## Security Status
Rate limiting, JWT, role authorization, security headers, and password hashing surfaces exist. Tenant read authorization and validated private local document storage are regression-tested. Production object storage and frontend dependency vulnerabilities require remediation and review.

## Performance Status
No measured production performance baseline or load-test evidence is recorded.

## Documentation Status
Existing architecture, API, PRD, and workflow documents are present. Required project-state records were absent before this snapshot and are being established now.

## Current Sprint
No active sprint is defined; `docs/current-sprint.md` is still a template.

## Current Priority
Apply the pending migrations (`PortfolioLiveSiteFields`, `ContentDraftProjectLink`, `AgentSystemSettingsAuditAndChatAgent`, `AddCustomerPhone`) on the Windows-side SQL Server, then complete browser validation of the redesigned public homepage/agent theme AND the redesigned admin (dark+light, responsive, delete-confirmation popup, PWA install), the full anonymous lead flow → confirmation email → admin notification, and run the Playwright suite against the live API.

## Active Development Area
Premium public homepage + AI agent experience (2026-08-11), professional admin redesign (2026-08-12), and `/agent` page redesign per `ralabs_ai_agent_page.html`/`Agent PSD.png` (2026-08-12) — runtime browser validation pending.

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
2026-08-12: `dotnet build backend/RALabs.sln` (Tests project) + `web-public`, `web-admin`, `web-customer` production builds (premium redesign + admin professional redesign phases).

## Last Successful Test Run
2026-08-11: `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj`, 92 passed, 0 failed.

## Last Successful Smoke Test
2026-08-08: API route/authorization/state-machine sweep against `http://localhost:5002`; admin browser `/admin/` loaded successfully without 500.

## Production Readiness
NOT PRODUCTION READY. Secure local document storage and offline chat are implemented, but production object storage, dependency vulnerabilities, feature-completeness, and broader quality-gate evidence remain outstanding.
