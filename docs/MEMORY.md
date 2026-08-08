# MEMORY: ra-labs

Living project state. Updated as part of finishing a task, not after.

## Completed Features
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

## Current Sprint
- v1.1.0 shipped to develop. Next: M5 (marketing agent, voice chatbot, expanded
  locale set), Qdrant real embeddings, Playwright suite execution in CI.

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
