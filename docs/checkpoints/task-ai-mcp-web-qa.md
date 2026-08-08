# Checkpoint: task-ai-mcp + task-web + task-qa-deploy

Date: 2026-08-08
Owner agents: ai-engineer, rag-engineer, mcp-engineer, frontend-engineer,
ui-engineer, ux-engineer, security-engineer, qa-engineer, automation-engineer,
code-reviewer, devops-engineer, documentation-engineer
Gate: Code Review + QA sign-off

## What was built

### AI layer (task-ai)
- `ChatbotService` — RAG-first answering over public `KnowledgeChunk`s with a
  deterministic transactional guardrail (**BR-002**: quotes/timelines never
  presented as fact; `needs_manual_intervention` flag set instead).
- `RagIngestionService` — ingests published projects, team bios, and studio
  copy (en) into `KnowledgeChunk` rows (public scope; `CustomerProjectId`
  null; **BR-001** filter enforced by query for M2+).
- `GithubSyncService` + `GithubSyncHostedService` — scheduled pull of
  commits-90d / active-repos / last-commit into `GithubSnapshot`; every run
  writes an `AgentTask` audit row (**BR-006**). Admin trigger
  `POST /admin/github/sync`.

### MCP server (task-mcp, ADR-002)
- `McpToolRegistry` — 29 tools over the same Application services REST
  calls (no duplicated logic). `GET /mcp/tools`, `POST /mcp/call`.
  Admin tools reject non-admin tokens with 403 (no elevated access).
- Validated via MCP: create/update/delete project + team, self-edit profile,
  content CRUD, leads, threads, admins, github_sync, rag_ingest.

### Frontends
- **web-public** (PWA, port 3004): dark blueprint theme (Fraunces + DM
  Sans + IBM Plex Mono), 11-locale switcher via `GET /locales` +
  `GET /content`, home/hero + 5-step process + portfolio + team + contact,
  ChatbotWidget (thread persisted in `ralabs-public.chat.thread`), manifest +
  service worker (cache-first shell, network-first API), offline indicator.
  All copy data-driven — nothing hardcoded.
- **web-admin** (port 3005): login, sidebar layout (Dashboard, Leads,
  Portfolio, Team, My Profile, Content, Chat, Settings), namespaced
  `admin.*` storage, 401→logout, **MyProfile self-edit via PUT
  /admin/team/me** (key feature — team members update their own details →
  live on public site), team-member add/edit incl. github snapshot,
  portfolio CRUD with validation, content editor per locale, chat thread
  viewer/reply, admin account management.

### QA + deploy (task-qa-deploy)
- 26 xUnit tests (Guard, state machine, chatbot BR-002, service validation,
  auth) — all pass, in-memory EF (no SQL Express in CI).
- `scripts/smoke.sh` — 16 checks across roles; all pass.
- `docker-compose.yml` (api + web-public + web-admin + nginx gateway),
  `backend/Dockerfile`, `Dockerfile.web-public`, `Dockerfile.web-admin`,
  nginx configs (web-admin served under `/admin/`), `deploy/.env.example`,
  `deploy/deploy.sh|rollback.sh|healthcheck.sh`, `.github/workflows/deploy.yml`
  (RMEnterpriseCMS pattern: tests → build frontends → rsync to VPS → .env
  from secrets → build on VPS → health check → rollback).

## Validation evidence

| Check | Result |
|---|---|
| dotnet build + 26 tests | Passed |
| web-public / web-admin `npm run build` | Passed |
| smoke.sh (16 checks) | Passed |
| MCP tools list | 29 tools |
| MCP admin tool without token | 403 |
| RAG ingest | 13 chunks |
| Chatbot RAG answer / transactional guardrail | works / flags intervention |
| GitHub sync + AgentTask audit | completed, snapshot written |
| MCP self-edit → public site | reflected live |
| Rate limit (6 leads) | 5×201 then 429 |
| Admin CRUD via MCP (create project/team/admin) | passed |

## Decisions
- ADR-002 (MCP thin layer) confirmed in implementation.
- Deterministic chatbot guardrail (BR-002) implemented as keyword-triggered
  manual intervention; future: LLM-classified escalation.
- GitHub stats computed from public API (commits via repo commit endpoint,
  heuristic cap for pagination).
- web-admin served under `/admin/` subpath via gateway + Vite base.

## How to run / verify
See docs/DEPLOYMENT.md and backend/README. Local: `dotnet run --project
RALabs.Api`, `cd web-public && npm run dev`, `cd web-admin && npm run dev`.
Production: push to `main` → GitHub Actions deploys to VPS.
