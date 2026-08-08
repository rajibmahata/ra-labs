# MEMORY: ra-labs

Living project state. Updated as part of finishing a task, not after.

## Completed Features
- 2026-08-08 — **v1.1.0 production pass (Phases A–J)**: customer portal +
  workflow backend (projects, docs, PRD dual sign, demo, invoice, feedback),
  admin Customers/Projects/Project workspace, auth hardening (roles, reset,
  refresh rotation, rate limits, security headers), chatbot/RAG retrieval
  matrix, web-public redesign to index-v2.html, 55 xUnit tests + Playwright.

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

## Open Questions
- Final brand name (placeholder "R&A Labs").
- Email provider for lead/reset notifications (SMTP stub works; provider TBD).
- Chatbot LLM provider at inference time (DeepSeek vs GPT-5.6 Luna vs other).

## Future Improvements
- Online invoice payment (explicitly M4+).
- Voice chatbot input (M5).
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
