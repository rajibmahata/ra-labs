# R&A Labs Platform

A showcase + client-delivery platform for a two-founder engineering studio
(Rajib Mahata, Abhishek Burnwal). Public PWA marketing site, admin CMS where
team members self-edit their profiles (live on the public site), leads +
chatbot, RAG-powered assistant, and an MCP server exposing every API as a
tool.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 8, 4-layer (Api / Application / Domain / Infrastructure) |
| Database | SQL Server Express (`RAJIB\SQLEXPRESS`, Windows auth, dev) / containerized SQL Server (Docker) |
| ORM | EF Core migrations (in-memory fallback for CI) |
| Frontends | React 18 + TypeScript + Vite — `web-public` (PWA), `web-admin` (CMS) |
| Vector/AI | In-app RAG retrieval (Qdrant-ready, M2); chatbot with deterministic guardrails |
| MCP | Thin tool layer over Application services — 29 tools |
| Hosting | Docker Compose on a VPS + GitHub Actions (RMEnterpriseCMS pattern) |

## Quick Start

```bash
# Backend (Windows host — SQL Express Windows auth; empty conn string = in-memory)
cd backend
dotnet run --project RALabs.Api   # http://localhost:5002

# Public site (PWA) — port 3004
cd web-public && npm install && npm run dev

# Admin CMS — port 3005
cd web-admin && npm install && npm run dev

# Smoke test
bash scripts/smoke.sh http://localhost:5002
```

### Login (after seed)

| Role | Email | Password |
|---|---|---|
| Admin — Rajib | rajib@ralabs.dev | Admin@1234 |
| Admin — Abhishek | abhishek@ralabs.dev | Admin@1234 |

Each admin logs into `/admin`, edits their own profile (My Profile) and it
reflects on the public site immediately.

## Key Endpoints

- `GET /health`, `POST /seed/full` (idempotent)
- Public: `GET /api/v1/projects`, `/team`, `/content?locale=`, `/locales`,
  `POST /api/v1/leads`, `POST /api/v1/chat/threads`,
  `POST /api/v1/chat/{id}/messages`
- Admin: `/api/v1/admin/projects|team|content|leads|chat|admins`,
  `GET|PUT /api/v1/admin/team/me` (self-edit)
- MCP: `GET /mcp/tools`, `POST /mcp/call`
- AI ops: `POST /api/v1/admin/github/sync`, `POST /api/v1/admin/rag/ingest`

## Documentation

- `docs/PRD/*` — product requirements
- `docs/DECISIONS.md` — ADRs (incl. ADR-006 SQL Express)
- `docs/API.md` — full endpoint reference
- `docs/REPOSITORY.md` — branch/merge workflow (main → develop → task-*)
- `docs/checkpoints/` — per-task implementation records
- `docs/DEPLOYMENT.md` — VPS + CI deployment

## Repo

https://github.com/rajibmahata/ra-labs
