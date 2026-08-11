# CHANGELOG: ra-labs

## [Unreleased] - live portfolio + RA Labs AI agent (2026-08-09)

### Added
- **Portfolio live-site showcase (GAP-013..018):** `Project` case-study fields
  (live site URL with HTTPS-preferred validation and duplicate check, category,
  business purpose, problem, solution, key features, screenshots, duration,
  team member links, completed date, gated customer reference, featured/active
  flags); admin portfolio management (server-side filters, feature/active
  toggles, CSV import/export, bulk actions, AI refresh drafts); public featured
  homepage section and structured case-study detail pages; incremental per-
  project RAG sync on every mutation; project-grounded AI refresh pipeline that
  applies on approval without auto-publishing. Migrations `PortfolioLiveSiteFields`
  (20260809102238) and `ContentDraftProjectLink` (20260809103250).
- **RA Labs AI agent (GAP-019..024):** `AgentChatService` orchestrator driving
  public + customer chat — guided 7-step project intake with confirm
  (customers get a real project; anonymous briefs are preserved and flagged
  for the team), quick actions + per-message suggested actions, RAG-grounded
  QA fallback, registration handoff (`?agent=<threadId>`) with thread claiming;
  full-screen `/agent` pages in `web-public` and `web-customer`; shared
  `useVoice` hook (states, permission UX, TTS with interrupt) gated by admin
  settings; SSE streaming with honest fallback (409 `STREAMING_DISABLED` when
  no provider key or setting off); chat attachments (rate-limited, 10 MB,
  allowlist, private storage); `SystemSetting` store + safe public
  `GET /api/v1/config` + super-admin settings UI; Super Admin hardening
  (`CreateAdminRequest.Role`, MCP role hierarchy) and full audit log
  (`AuditLog` entity, `/admin/audit-logs` endpoint, admin Audit page with
  filters/pagination). Migration `AgentSystemSettingsAuditAndChatAgent`
  (20260809143610).
- Backend regression coverage now totals 77 passing tests (+3 agent tests);
  all three frontend production builds pass.

### Fixed
- Chat escalations, pending briefs, and chat-created projects now all create
  admin notifications (previously only escalations did, despite the agent
  promising the team had been notified).
- Streaming route falls back to the deterministic reply when the AI provider
  fails mid-stream instead of aborting; forbidden threads return 403.
- Audit-log pagination payload includes `totalPages`.
- Public agent page: last-agent-message lookup off-by-one (handoff banner +
  voice TTS crash), duplicate optimistic message in the streaming path, and
  partial streaming bubble cleanup on error.
- Voice input guards `recognition.start()` synchronous failures (permission
  denied no longer leaves the UI stuck in "listening").

## [Unreleased] - admin modal-free overhaul + dynamic 3D AI hero

### Added
- **Admin panel is now 100% popup-free:** all `Modal`/`ConfirmDialog`/modal-backdrop
  usage replaced with inline patterns — `InlineConfirm` row-level destructive morph,
  `inline-edit-panel` create/edit forms, `inline-confirm-bar` bulk confirmations
  (Portfolio, Team, Content, Leads, Settings, Reviews, Customers). `Modal.tsx`
  and the modal CSS were deleted; shared classes `.inline-edit-panel`,
  `.inline-confirm-bar`, `.content-tabs` added to `web-admin` styles.
- **Content section prefix tabs:** keys grouped by first-dot prefix in a tab rail
  (All + per-group counts) above the table; locale filter unchanged.
- **ProjectDetails master-detail tabs:** Overview / Docs / PRD / Demos / Invoices /
  Feedback rail with live counts; all existing handlers preserved.
- **Dynamic 3D AI hero banner:** `GET /api/v1/hero-scenarios` returns LLM-generated
  visual variables (theme, colors, orbit count/speed, labels, project focus)
  grounded in public knowledge chunks and published projects, cached in
  `IMemoryCache` for 1 h with a deterministic data-driven fallback when OpenAI is
  not configured. `HeroScenarioService` + DI registration + `AddMemoryCache()`.
  Public `Hero.tsx` renders the scene with pure CSS 3D transforms (layers / orbit /
  grid themes, `prefers-reduced-motion` respected) and falls back to the
  deterministic default when the endpoint is unavailable.
- Backend regression coverage now totals 74 passing tests (+6 hero scenario tests).

## [Unreleased] - admin governance + public RAG synchronization

### Added
- Persisted `admin` and `super_admin` roles with super-admin-only governance
  for team members and admin-account activation.
- Settings status controls with confirmation dialogs; deactivation revokes
  existing admin refresh tokens and self-deactivation is rejected.
- Automatic public RAG refresh after project, team, CMS content, review
  moderation, and review approval mutations.
- Approved reviews are included in public RAG retrieval while customer-private
  project data remains project-scoped.
- Admin-created customer projects from the Customers workspace, including
  title, goal, requirements, and timeline capture.
- Customer-project admin search now covers project context fields and the
  Customers-to-Projects customer filter is enforced by the API.
- Customer-project filters are applied before pagination, with case-insensitive
  matching across the SQL Server and in-memory providers.
- Added the consolidated admin-management prompt and the first full customer
  management slice: search/status filtering, detail/edit/delete, bulk delete,
  CSV import/export, filtered pagination metadata, and private knowledge cleanup.
- Backend regression coverage now totals 68 passing tests.

## [Unreleased] - voice assistant + admin notifications

### Added
- Public chatbot voice input through the browser Web Speech API, with a
  graceful typed-input fallback.
- Warm retrieval fallback copy that invites free brainstorming and a team
  follow-up without bluntly claiming missing knowledge.
- Persisted admin notifications for leads, escalated chats, customer
  registrations, and customer project activity.
- Admin notification bell, unread count, notification page, mark-read actions,
  foreground browser alerts, and installable admin PWA shell.

## [Unreleased] - language fix + LLM translation agent (task-i18n-agent)

### Added
- **LLM translation agent** (`TranslationAgentService`): on a language change,
  missing locale content is translated by the model on demand and persisted as
  `PageContent` rows (cached — one model call per locale, serialized per
  locale). Activates automatically when `OpenAI:ApiKey` is configured.

### Fixed
- **Language switcher was broken**: only English content was seeded, so every
  other locale returned an empty content map and the site rendered raw content
  keys. `GET /api/v1/content?locale=X` now merges English values for any keys
  the translation agent has not produced yet — the UI never shows raw keys,
  even with no API key configured.

## [1.1.1] - 2026-08-08 (verification pass)

### Fixed
- **P0 concurrency bug**: `Guard` used a shared static error list; concurrent
  requests could corrupt each other's validation. Now `AsyncLocal`-isolated per
  execution context. Regression test added (56 tests total).
- **P0 MCP error mapping**: MCP argument errors returned 500 and leaked the
  exception message; now 400 VALIDATION_ERROR with a clean envelope.
- **P0 seed default**: `Seed:DemoOnStartup` defaults to `false`; seeding is
  explicit via `/seed/full`.
- Zero nullable-reference warnings in the backend build.
- Admin login no longer pre-validates password length (server is the source of
  truth; aligned with customer portal).

## [1.1.0] - 2026-08-08

### Added
- **Customer portal (web-customer PWA)**: register/login/forgot/reset, dashboard,
  project detail (status timeline, document upload, PRD view + sign, demo,
  invoices, feedback), project chat, account; refresh-token auth client.
- **Customer workflow backend**: customer auth (register/login/refresh/reset),
  projects, documents, PRD draft + dual sign, demo, invoice, feedback; enforced
  `CustomerProjectStateMachine` (ADR-005) + BR-003 (cash-only), BR-004
  (feedback-before-close), BR-005 (publish-on-approval).
- **Admin workflow**: Customers list, Projects kanban board, Project workspace
  (status transitions, admin notes, PRD editor + admin sign, demo, invoice,
  feedback approve), thread deep-link.
- **Auth hardening**: admin `RequireRole("admin")`, customer
  `RequireRole("customer")`, password reset (email code, expiry, hashed),
  refresh-token rotation, `IEmailSender` (SMTP + dev console), strict login
  rate limit (5/min), security headers (API + gateway), admin projects pagination.
- **Chatbot/RAG**: punctuation normalization, lemmatization-light stemming,
  stop-word filtering, conversation context, weighted scoring, rich studio
  knowledge; answers the required question matrix; no false positives;
  BR-002 transactional guardrail.
- **Design**: `web-public` rebuilt to index-v2.html (light cream/emerald/brass,
  Newsreader+Inter+IBM Plex Mono, gradient covers, em-dash stats, pulsing badge).
- **Tests**: 55 xUnit (customer workflow, auth security, chatbot retrieval
  matrix, state machine, validation) + Playwright scaffold (`e2e/`).

### Changed
- Admin REST endpoints now require the `admin` role (was any authenticated user).
- Customer project statuses use snake_case in the API (`prd_draft`, `prd_signed`,
  `in_build`).

### Fixed
- Customer workflow deadlock: feedback is captured at `delivered`, close requires it.
- Chatbot keyword matching false positives / misses.
- N+1 team snapshot queries (batch load).

## [1.0.0] - 2026-08-08
Initial release: public PWA, admin CMS, portfolio/team, leads+chatbot, MCP server,
AI layer, deploy config. See earlier commits.
