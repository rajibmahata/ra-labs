# CHANGELOG: ra-labs

## [1.0.0] - 2026-08-08

### Added
- **Backend foundation** (4-layer .NET 8): Domain entities/enums/state machine,
  Application services with formalized PestFlow-pattern validation
  (exception hierarchy → global middleware → `{error:{code,message}}`
  envelope), EF Core SqlServer migrations + in-memory fallback, JWT admin
  auth (24h), rate limiting (contact/chat/auth), `DbInitializer` seed.
- **M1 API** (`/api/v1`): portfolio, team, content (11 locales), leads,
  chat threads + chatbot, auth; admin CRUD under `/api/v1/admin`.
- **MCP server**: 29 tools over the Application layer (ADR-002);
  `GET /mcp/tools`, `POST /mcp/call`; role-scoped.
- **AI layer**: RAG ingestion of public content; chatbot with deterministic
  transactional guardrail (BR-002); GitHub sync hosted service + AgentTask
  audit (BR-006).
- **Frontends**: `web-public` PWA (dark blueprint theme, 11-locale switcher,
  portfolio/team/contact, chatbot widget, service worker); `web-admin` CMS
  (dashboard, leads, portfolio, team, My-Profile self-edit, content, chat,
  settings) with portal-namespaced storage.
- **Seed data**: 11 locales, 2 team members + 2 admin accounts (Rajib from
  rajiblabs.com, Abhishek from LinkedIn), 10 GitHub portfolio projects, 27
  English content keys. Nothing hardcoded — all data-driven.
- **QA**: 26 xUnit tests, `scripts/smoke.sh` (16 checks).
- **Deployment**: docker-compose, Dockerfiles, nginx gateway, deploy scripts,
  `.github/workflows/deploy.yml` (RMEnterpriseCMS pattern).

### Changed
- ADR-001 superseded by ADR-006: SQL Server Express (`RAJIB\SQLEXPRESS`,
  Windows auth) over PostgreSQL, with containerized SQL Server for the
  Docker path.

### Fixed
- JWT `sub` claim mapping (MapInboundClaims=false) so `/admin/team/me`
  resolves the authenticated admin.
- AgentTask update EF tracking conflict.
- MCP partial-update validation for team self-edit.
