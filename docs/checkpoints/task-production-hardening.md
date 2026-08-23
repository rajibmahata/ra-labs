# Production Hardening Checkpoint

Date: 2026-08-08
Status: Implementation complete for this slice; production release blocked by remaining gates.

## Built

- Added mobile safe-area gutters and 44px touch targets across public, customer, and admin responsive surfaces.
- Added IndexedDB customer chat queue with reconnect flushing.
- Replaced the customer document upload placeholder with validated private local storage.
- Added authorized document download route and EF migration `SecureDocumentStorage`.

## Validation

- `web-public`: `npm run build` passed.
- `web-customer`: `npm run build` passed.
- `web-admin`: `npm run build` passed.
- Backend isolated build passed.
- Backend tests: 58 passed, 0 failed, including secure upload/download regression coverage.
- Existing API route sweep recorded expected success and contract error responses.
- Browser checks passed at desktop and 390x844 mobile viewports for public, customer, and admin routes; no horizontal overflow was observed and login controls were at least 44px tall.

## Decisions

- Existing DTO and route contracts were preserved where possible.
- Local storage is outside the web root and is an implementation step, not the final production object-storage provider.
- Uploads accept PDF, PNG, JPEG, and DOCX up to 10 MB; download ownership is enforced at the application boundary.

## Remaining Gates

- Configure approved production object storage and malware/content scanning.
- Resolve customer dependency audit vulnerabilities.
- Expand Playwright authenticated mobile/desktop coverage and add accessibility/performance/security gates.
- Authoritative SQL Server architecture/database documentation reconciled; historical PRD/design references remain historical.
- Obtain code review and QA sign-off before merging from a task branch.

## Continuation: 2026-08-22 production-readiness pass

### Built

- CORS actually wired: `Cors:AllowedOrigins` → `AddCors("ApiCors")` + `UseCors` (previously config existed but no middleware; cross-origin frontends would fail).
- `POST /seed/full` mapped only in Development (was unauthenticated in production).
- `GET /health` probes the database via `CanConnectAsync`; returns 503 with `{status:"unhealthy", database:"down"}` when SQL Server is unreachable (orchestrator-ready signal).
- Permissions-Policy changed to `microphone=(self)` — the previous `microphone=()` contradicted the voice-enabled agent feature.
- Data Protection keys persisted under `DataProtection:KeyDirectory` (default `<base>/data-protection-keys/`), application name `RALabs` — encrypted GitHub tokens now survive container restarts.
- Seeded admin password overridable via `Seed:AdminPassword` (dev default retained with a startup warning).
- SSE streaming provider failures logged before deterministic fallback.
- MCP parity (ADM-001): `get_customer`, `update_customer`, `set_customer_status`, `delete_customer`, `delete_customers`, `import_customers` (CSV text arg), `export_customers` (CSV text result), `get_dashboard_stats`, `list_notifications`, `mark_notification_read`, `list_reviews`, `moderate_review`; published definition for `generate_project_refresh`; `create_admin` role param; `list_customers` search/isActive filters via `ICustomerManagementService`.
- Tests: `CustomerManagementTests` (search/filter/pagination totals, duplicate-email conflict, refresh-token revocation on update/deactivate, knowledge-chunk cleanup on delete, bulk-delete dedupe, import validation/duplicate/max-row errors, export credential exclusion), `McpToolContractTests` (role labels, governance coverage, unique names). `RALabs.Tests` references `RALabs.Api`.
- Dependency fix: `Microsoft.Extensions.Caching.Memory` 8.0.0 → 8.0.1 (NU1903 high advisory GHSA-qj66-m88j-hmgj).

### Validation

- Backend: `dotnet test` — 114 passed, 0 failed; build warning-free (CS8604 warnings in `ProjectService` import helpers fixed).
- Frontends: `npm run build` (includes `tsc`) passes for web-public, web-customer, web-admin.

### Decisions

- `/health` keeps its simple JSON shape but adds `database` status and a 503 on DB failure so Docker/Kubernetes health gates are meaningful.
- Customer CSV import over MCP accepts raw CSV text rather than multipart, keeping tool arguments JSON-only while exercising the same service path as REST.
- Chat attachment downloads remain capability-URL based (public agent has no identity); thread access already follows the same GUID-capability model.

### Remaining Gates

- Apply pending migrations on Windows-side SQL Server (`PortfolioLiveSiteFields`, `ContentDraftProjectLink`, `AgentSystemSettingsAuditAndChatAgent`, `AddCustomerPhone`).
- Runtime browser + Playwright validation against a live API; object storage provider decision remains open.

## Continuation: 2026-08-22 functional + UI validation pass

### Built

- PRD workflow fix (ADR-005): `CustomerProjectService.SavePrdAsync` now
  transitions intake → prd_draft when the first PRD draft is saved; previously
  both sign gates required prd_draft and nothing ever set it — projects
  deadlocked at intake. Regression test added.
- BR-005 implementation: `ModerateFeedbackAsync(approved: true)` on a
  delivered/closed project auto-creates the public portfolio entry
  (title/slug from project, summary+case study from goal/audience/requirements,
  demo URL → liveSiteUrl, linked via `Project.CustomerProjectId`, idempotent).
  New repo method `ExistsForCustomerProjectAsync`. Regression test added.
- web-public mobile nav overflow fix: closed menu is display:none (no layout
  contribution, no focus traps), open uses nav-slide-in keyframe,
  html{overflow-x:clip} guard.
- Playwright spec hardening: stable #contact-* selectors, `.or()` for async
  fetch races, `[role="status"]`/`.form-success` assertions, pan-based mobile
  overflow assertion.

### Validation (live stack)

- API run in Production mode with in-memory DB (fail-closed JWT verified).
- Full endpoint sweep + security matrix green (see CHANGELOG entry).
- Customer lifecycle E2E green through close → approve → public portfolio.
- MCP: 64 tools, authenticated admin calls live, role enforcement holds.
- Playwright: 7/7 passing (was 4/7 before fixes).
- Backend 116/116 tests; three frontend production builds pass.

### Environment notes (not product bugs)

- e2e Playwright runs under Windows node; WSL env vars do not propagate
  (use `cmd.exe /c "set VAR=...&& npx playwright test"`).
- Windows-side process held :3002 (unrelated `/platform/` app); customer dev
  server validated on :3102 via RALABS_CUSTOMER_URL.
- web-public node_modules is Windows-installed (rollup native module); its
  vite must launch under Windows node. Linux `vite build` fails there, but
  `npm run build` under Windows works.
