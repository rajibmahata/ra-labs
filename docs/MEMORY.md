# MEMORY: ra-labs

Living project state. Updated as part of finishing a task, not after.

## Completed Features
- 2026-08-10 — **Frontend dependency audit cleared (GAP-006)**: all three apps on react-router-dom 7.18.2 + vite 6.4.3; `BrowserRouter` v6 future props removed; `npm audit` 0 vulnerabilities in each; builds pass.
- 2026-08-10 — **Admin import/export consistency (GAP-010)**: shared `CsvHelper`; Leads + Team CSV import (validation, 500-row cap, duplicate skipping, team import audited) and export with filters; Content + Reviews CSV export (export-only by design); Import/Export buttons on the Leads/Team/Content/Reviews pages. Suite: 82 passing tests.
- 2026-08-10 — **Server-side dashboard aggregate + observability (GAP-011, GAP-012)**: admin-authorized `GET /api/v1/admin/dashboard/stats` returns true counts (customers, projects by status, leads, reviews, team, portfolio, drafts, chat intervention, unread notifications, latest GitHub snapshot, repository count, knowledge chunks, pending+running agent tasks) in one call — no more page-capped client-side counting. web-admin Dashboard `load()` is server-first with a client-side fallback, and the System Status card shows synced repositories, knowledge chunks, and pending agent tasks. Suite: 82 passing tests (with GAP-010).
- 2026-08-08 — **v1.1.0 production pass (Phases A–J)**: customer portal +
  workflow backend (projects, docs, PRD dual sign, demo, invoice, feedback),
  admin Customers/Projects/Project workspace, auth hardening (roles, reset,
  refresh rotation, rate limits, security headers), chatbot/RAG retrieval
  matrix, web-public redesign to index-v2.html, 55 xUnit tests + Playwright.
- 2026-08-08 — **Admin governance pass**: persisted admin roles and team
  activation, super-admin-only team and admin-account status controls,
  confirmed Settings actions, approved-review public RAG chunks, and automatic
  public RAG refresh after public admin mutations. Private customer records
  remain outside the public index.
- Admins can create customer-owned projects from the Customers workspace;
  creation delegates to the same validated workflow used by customers.
- Customer-project admin listing now honors customer scope and searches title,
  requirements, notes, and other captured project fields.
- Customer-project admin filters are applied in the repository before paging,
  with case-insensitive behavior across SQL Server and in-memory tests.
- Customer administration now has a shared prompt contract plus search,
  status filtering, CRUD, bulk deletion, CSV import/export, and explicit
  private knowledge-chunk cleanup on deletion. Dedicated customer-management
  tests and MCP/Playwright coverage remain outstanding.
- 2026-08-09 — **Admin modal-free overhaul + dynamic 3D AI hero**: every admin
  popup replaced by inline patterns (`InlineConfirm` row-level destructive morph,
  `inline-edit-panel` forms, `inline-confirm-bar` bulk confirms); `Modal.tsx`
  deleted. Content admin grouped by key prefix with tabs; ProjectDetails
  converted to Overview/Docs/PRD/Demos/Invoices/Feedback tabs. New
  `GET /api/v1/hero-scenarios` endpoint (`HeroScenarioService`, OpenAI-generated
  visual variables, `IMemoryCache` 1 h TTL, deterministic fallback grounded in
  published projects) drives a CSS-3D animated hero on the public site. Suite:
  74 passing tests.
- 2026-08-09 — **RA Labs AI agent (GAP-019..024)**: agent orchestrator
  (`AgentChatService`): guided 7-step project intake, quick/suggested actions,
  RAG QA fallback, anonymous brief preservation + customer handoff with thread
  claiming; voice (shared `useVoice` hook, states, TTS interrupt) and LLM
  streaming gated by admin settings (`SystemSetting` store + public
  `GET /api/v1/config`); chat attachments (10 MB allowlist, private storage);
  Super Admin hardening (`CreateAdminRequest.Role`, MCP role hierarchy) +
  `AuditLog` entity/service/endpoint + admin Audit page. Migration
  `AgentSystemSettingsAuditAndChatAgent` (20260809143610). Suite: 77 passing
  tests; all three frontend production builds pass.
- 2026-08-09 — **Phase 2 self-review pass**: fixed ChatService notifications
  (pending brief + project-created now create admin notifications, matching the
  agent's promise to the user; escalation/pending-brief notifications fire only
  on flag transition); streaming route now catches provider failures
  (HttpRequestException/JsonException/IO/cancel) and falls back to the
  deterministic reply instead of aborting mid-SSE, plus 403 handling and no
  unused locals; audit-logs pagination now includes `totalPages` (frontend
  expected it); web-public AgentChat fixed last-agent lookup off-by-one
  (handoff banner + voice TTS crash), duplicate optimistic message in the
  streaming path, and streaming-bubble cleanup on error; `recognition.start()`
  wrapped in try/catch in both voice implementations. Build + 77 tests + three
  frontend builds verified after fixes.

## Current Sprint
- v1.1.0 shipped to develop. Next: M5 (marketing agent, voice chatbot, expanded
  locale set), Qdrant real embeddings, Playwright suite execution in CI.
- Phase 2 (AI agent) implementation complete; runtime browser/voice/streaming
  validation pending — SQL Server unreachable from WSL, API stopped on Windows,
  three migrations pending apply (`20260809102238`, `20260809103250`,
  `20260809143610`).

## Architecture Decisions
- ADR-001 (Postgres) **superseded** by ADR-006 (SQL Server Express Windows
  auth + containerized SQL Server for Docker).
- ADR-002 MCP thin layer, ADR-003 Qdrant hard filter (M2+), ADR-004 dual
  sign-off recorded confirmation, ADR-005 status state machine (now enforced).

## Known Bugs
- None open. GitHub sync may report 0 activity for accounts with no public
  repos in the last 90 days (expected).

## Technical Debt
- Chatbot escalation is keyword-based, not LLM-classified (BR-002 satisfied;
  an LLM intent classifier is a future improvement).
- Qdrant collection not yet wired to real embeddings (in-app chunk scoring
  used; true vector search is a M2/M5 improvement).
- Document uploads store a `/media/...` path reference; production object
  storage (S3/Azure Blob) integration pending.
- GitHub commit counts use a heuristic cap for >100 commits per repo.
- Locale content: only English seeded; other locales are filled on demand by
  the LLM translation agent when `OpenAI:ApiKey` is set, otherwise served as
  English fallback.
- Admin notifications are persisted in `AdminNotifications`; the admin UI
  polls unread items and uses foreground browser notifications after permission.
  Background phone delivery still needs VAPID/Web Push sender configuration.
- Admin deactivation revokes the account refresh token and self-deactivation is
  rejected by the application service.

## Open Questions
- Final brand name (placeholder "R&A Labs").
- Email provider for lead/reset notifications (SMTP stub works; provider TBD).
- Chatbot LLM provider at inference time (DeepSeek vs GPT-5.6 Luna vs other).

## Future Improvements
- Online invoice payment (explicitly M4+).
- VAPID/Web Push delivery and team-device fan-out for admin notifications.
- SEO metadata per locale (meta tags from CMS).
- Playwright suite wired into CI.

## Coding Conventions
- Backend: PestFlow 4-layer; services throw `AppException` subclasses; global
  middleware maps to envelope; no FluentValidation/DataAnnotations.
- Frontend: React 18 + TS strict + Vite; portal-namespaced storage keys
  (`admin.*`, `ralabs-customer.*`, `ralabs-public.*`); error-envelope parsing.
- Git: conventional commits; task-* → develop (gates) → main (release).

## Local Dev Ports (canonical)
- Backend API: http://localhost:5002 · web-public: 3004 · web-admin: 3005 ·
  web-customer: 3002. Vite proxies `/api` and `/mcp` → 5002. Docs in README,
  docs/DEPLOYMENT.md, docs/ARCHITECTURE.md, docs/checkpoints, scripts/smoke.sh.
