# R&A Labs — project rules

This file is binding on every agent (including the git agent). Read
`docs/REPOSITORY.md` for the branch/merge workflow and `docs/PRD/*` for
product scope before acting.

## Stack (owner-confirmed, supersedes older PRD notes)

- Frontends: React 18 + Vite + TypeScript — `web-public` (PWA, 11 locales),
  `web-customer` (PWA, M2+), `web-admin` (standard SPA)
- Backend: .NET 8, four layers — `RALabs.Api` / `RALabs.Application` /
  `RALabs.Domain` / `RALabs.Infrastructure`
- Database: **SQL Server** — dev on local `RAJIB\SQLEXPRESS` with Windows
  auth; Docker demo uses a containerized SQL Server (SA auth). EF Core
  SqlServer provider with migrations. ADR-006 supersedes ADR-001.
- Vector store: Qdrant (RAG, public content M1; per-project M2+)
- MCP server: thin tool-definition layer over the Application services
  (ADR-002) — every endpoint is also an MCP tool; MCP is used to validate
  UI/behavior in QA.
- Hosting: Docker Compose on the VPS, RMEnterpriseCMS deployment pattern
  (images built on the VPS, GitHub Actions deploy on push to `main`).

## Git workflow (mandatory — see docs/REPOSITORY.md)

- Branches: `main` (stable, deploy target) · `develop` (integration) ·
  `task-<module>` (one per module task).
- NEVER commit directly to `main` or `develop`. Always work on a `task-*`
  branch created from `develop`.
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`.
- Merge `task-*` → `develop` only after the module passes its gates
  (tests + code review + QA sign-off recorded in the task's checkpoint
  file under `docs/checkpoints/`).
- Merge `develop` → `main` only at Release Manager go/no-go.
- CI/CD deploys on push to `main`.

## Organization-style execution

- Use the workforce agents per gate (product, architecture, backend, api,
  frontend, ui, ai/rag, mcp, security, performance, qa, automation, code
  review, refactoring, documentation, release).
- Log progress into `docs/reports/`, `docs/sessions/`, `docs/learning/` and
  record gate outcomes in `docs/reviews/` as you go — not only at milestone
  end.
- Every completed task gets a checkpoint file in `docs/checkpoints/` with
  what was built, validation evidence, decisions, and how to verify it.
- Keep living docs current as part of finishing a task: `docs/MEMORY.md`,
  `docs/BACKLOG.md`, `docs/DECISIONS.md`, `docs/FEATURE_INDEX.md`,
  `docs/CHANGELOG.md`.
- Nothing is hardcoded: all site copy lives in the `PageContent` table per
  locale; team profiles and portfolio are admin-editable and shown live on
  the UI.

## Validation

- Backend: `dotnet test` must pass.
- UI regression: Playwright.
- Every public function is validated through the MCP server in QA.
- Once M1 exists: validate against the current implementation before
  changing it, and confirm a change doesn't break existing functionality.
