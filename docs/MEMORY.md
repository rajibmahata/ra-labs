# MEMORY: ra-labs

Living project state. Updated as part of finishing a task, not after.

## Completed Features
- 2026-08-08 — M1 complete: public PWA (11 locales), portfolio, team +
  GitHub sync, leads + chatbot, admin CMS with team self-edit, MCP server,
  RAG ingestion, Docker/CI deploy config. Closing workflow: task branches →
  develop (gates) → main (release).

## Current Sprint
- M1 shipped. Next: M2 (customer accounts, project threads, document upload,
  web-customer PWA, per-project RAG).

## Architecture Decisions
- ADR-001 (Postgres) **superseded** by ADR-006 (SQL Server Express Windows
  auth + containerized SQL Server for Docker). See docs/DECISIONS.md.
- ADR-002 MCP thin layer, ADR-003 Qdrant hard filter (M2), ADR-004 dual
  sign-off recorded confirmation (M3), ADR-005 status state machine.

## Known Bugs
- None open. (GitHub sync may return 0 commits for accounts with no public
  activity in the last 90 days — expected behaviour, not a defect.)

## Technical Debt
- Chatbot escalation is keyword-based, not LLM-classified (BR-002 satisfied;
  an LLM intent classifier is a future improvement).
- GitHub commit counts use a heuristic cap for >100 commits per repo.
- `web-customer` frontend not yet scaffolded (M2).
- Qdrant collection not yet wired to real embeddings (M1 uses in-app chunk
  scoring; true vector search is M2).

## Open Questions
- Final brand name (placeholder "R&A Labs").
- Email provider for lead notifications (SMTP stub in place).
- Chatbot LLM provider at inference time (DeepSeek vs GPT-5.6 Luna vs other).

## Future Improvements
- Playwright UI regression suite (scaffolded in CI plan; add tests in M2).
- Online invoice payment (explicitly M4+).
- Expanded locales beyond 11.
- Voice chatbot input (M5).

## Coding Conventions
- Backend: PestFlow 4-layer; services throw `AppException` subclasses;
  global middleware maps to envelope. No FluentValidation/DataAnnotations.
- Frontend: React 18 + TS strict + Vite; portal-namespaced storage keys
  (`admin.*`, `ralabs-public.*`); error envelope parsing in the API client.
- Git: conventional commits; task-* → develop (gates) → main (release).
