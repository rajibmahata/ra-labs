# CHANGELOG: ra-labs

## [Unreleased] - audit + truthful-UI pass (2026-08-23)

### Fixed
- **RAG empty at startup (critical):** fresh databases had zero knowledge
  chunks — every factual question escalated. `DbInitializer` now ingests the
  public index at startup (verified: 14 chunks; "Tell me about DocSignerHub"
  returns real data).
- Agent chat messages no longer future-stamped (`AddSeconds(1)` removed) —
  chronology in admin views and exports is now real.
- Public team API leaked `email` / `hasGithubToken` / activation flags via the
  admin DTO; new `PublicTeamMemberDto` exposes only public fields.
- `App:CustomerPortalUrl` pointed at the public site instead of the portal.

### Added / Changed
- `/agent`: fake conversations, fake agent roster ("OpenCode · v1.2.1",
  "Online"), and the hardcoded administrator chip are gone; sidebar + rail now
  render the REAL team from the API with profile links. Portfolio showcase and
  trust chips retained.
- New Portfolio menu + `/portfolio` page: project rows with cover, summary,
  stack tags, status badge, and Case study / Live site / GitHub links.
- Nav gains a Customer Login entry (config-driven, mobile + desktop).
- Status pill is now config-driven ("AI agent online") instead of the
  unverifiable "Studio capacity: Available".

## [Unreleased] - functional + UI validation pass (2026-08-22)

### Fixed
- **PRD workflow deadlock (ADR-005/BR-004):** `SavePrdAsync` never performed the
  `intake → prd_draft` transition, and both sign gates require `prd_draft` —
  projects created through the normal flow could never reach `prd_signed`.
  Drafting a PRD now auto-transitions intake → prd_draft. Regression test
  added (`DraftingPrd_AutoTransitions_IntakeToPrdDraft_AndDualSignCompletes`);
  the old full-workflow test masked the bug by transitioning manually.
- **BR-005 portfolio feedback loop was a stub:** approving feedback only set
  `IsPublished`; no public `Project` entry was ever created. Approval on a
  delivered/closed project now auto-publishes a portfolio entry derived from
  the customer project (goal/audience/requirements case study, demo URL as
  live site, `Project.CustomerProjectId` link), idempotent via new
  `IProjectRepository.ExistsForCustomerProjectAsync`. Regression test added
  (`ApprovingFeedback_AfterDelivery_CreatesPublicPortfolioEntry_Once`).
- **Mobile nav horizontal overflow (web-public):** the closed off-canvas menu
  (fixed, `translateX(105%)`) expanded `scrollWidth` to ~708px on 390px
  viewports. Closed nav is now `display:none` (also removes hidden links from
  keyboard/a11y tree); open state slides in via `nav-slide-in` keyframe;
  `html { overflow-x: clip }` as belt-and-braces.

### Validated (live API, Production mode, in-memory DB)
- Public: health (DB probe), projects/featured/team/content/locales/config,
  lead creation, chat thread + message flow, hero scenarios.
- Security: `/seed/full` 404 outside Development; security headers present
  (`microphone=(self)`); CORS preflight 204 for allowed origins, ACAO echoed,
  disallowed origins get no headers; admin endpoints 401 anonymous; MCP
  admin tools 403 without role; JWT fails closed without a ≥32-char secret.
- Customer lifecycle E2E: register → login → create project (intake) → PRD
  draft (auto prd_draft) → dual sign (prd_signed) → in_build → demo →
  delivered → invoice (cash-only) → feedback → closed → approve → public
  portfolio entry appears at `/api/v1/projects`.
- Admin: login, dashboard stats aggregate, customer search, customer-project
  listing, PRD save/sign, status transitions, notifications.
- MCP: all 64 published tools verified; authenticated calls to
  `list_customers` / `export_customers` / `get_dashboard_stats` return live
  data; role enforcement holds.
- Playwright suite: **7/7 passing** against live API + all three dev servers
  (homepage/hero/agent panel render, portfolio navigation, team page, contact
  form success path, customer + admin login shells, mobile overflow check).
  Test selectors hardened (stable `#contact-*` ids, `.or()` combinator for
  async fetch race, `[role="status"]`/`.form-success`, pan-based overflow
  assertion).

## [Unreleased] - production-readiness pass (2026-08-22)

### Changed
- **CORS wired (was config-only):** `Cors:AllowedOrigins` from appsettings now
  drives a real `AddCors`/`UseCors("ApiCors")` pipeline; no origins configured
  means same-origin only.
- **`POST /seed/full` is development-only.** The unauthenticated reseed
  endpoint no longer exists in production builds.
- **`GET /health` probes the database** and returns 503 `{status:"unhealthy",
  database:"down"}` when SQL Server is unreachable — orchestrator-ready.
- **Permissions-Policy allows `microphone=(self)`** (was `microphone=()`, which
  contradicted the voice-enabled agent).
- **Data Protection keys persist** to `DataProtection:KeyDirectory` (default:
  `data-protection-keys/` beside the binary) so encrypted GitHub tokens survive
  container restarts; application name pinned to `RALabs`.
- **Seeded admin password configurable** via `Seed:AdminPassword` (falls back to
  the documented dev default with a startup warning when unset).
- Streaming provider failures are now logged before the deterministic fallback.

### Added
- **MCP parity for customer management + admin observability (ADM-001):** new
  tools `get_customer`, `update_customer`, `set_customer_status`,
  `delete_customer`, `delete_customers`, `import_customers` (CSV text),
  `export_customers` (CSV text), `get_dashboard_stats`, `list_notifications`,
  `mark_notification_read`, `list_reviews`, `moderate_review`; published
  definition added for the previously undiscoverable `generate_project_refresh`;
  `create_admin` exposes the optional `role` parameter; `list_customers`
  gained search/isActive filters (delegates to `ICustomerManagementService`
  instead of the raw repository).
- **Tests:** `CustomerManagementTests` (12 facts: search/filter/pagination,
  duplicate-email conflict, refresh-token revocation on update/deactivate,
  delete cleanup of project knowledge chunks, bulk-delete dedupe, import
  validation/duplicate/max-row behavior, export credential exclusion) and
  `McpToolContractTests` (role labels, governance tool coverage, unique names).
  `RALabs.Tests` now references `RALabs.Api`. Suite: 114 passing.

### Fixed
- `Microsoft.Extensions.Caching.Memory` bumped 8.0.0 → 8.0.1 (NU1903 high-
  severity advisory GHSA-qj66-m88j-hmgj).
- Nullable-annotation warnings in `ProjectService` import helpers eliminated;
  backend builds warning-free.

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
