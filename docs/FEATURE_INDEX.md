# FEATURE INDEX: ra-labs

| Feature | Epic | Status | Owner |
|---|---|---|---|
| Public site (PWA, 11 locales) — index-v2.html design | M1 | done | frontend-engineer |
| Portfolio showcase + admin CRUD | M1 | done | backend/frontend |
| Team profiles + GitHub sync snapshots | M1 | done | ai/backend |
| Contact form + chatbot lead capture | M1 | done | ai/frontend |
| Admin CMS (dashboard, leads, portfolio, team self-edit, content, chat, settings) | M1 | done | frontend |
| MCP server (40+ tools over Application layer) | M1 | done | mcp/backend |
| RAG ingestion (public content) + chatbot retrieval | M1 | done | rag-engineer |
| Multi-admin auth (Rajib/Abhishek/any team member) | M1 | done | backend |
| Backend validation + error envelope | M1 | done | backend |
| Password reset + refresh-token rotation (admin + customer) | M1 | done | backend |
| Role enforcement (RequireRole admin/customer) + security headers | M1 | done | security |
| Customer accounts (register/login/forgot/reset) | M2 | done | backend/frontend |
| Customer projects + status workflow (ADR-005) | M2 | done | backend |
| Project chat thread (customer ↔ admin/agent) | M2 | done | backend/frontend |
| Document upload (customer portal) | M2 | done | backend/frontend |
| Client PRD draft + dual sign-off (BR-004, ADR-004) | M3 | done | backend/frontend |
| Demo delivery (screenshot/URL) | M4 | done | backend/frontend |
| Invoicing (cash-only, BR-003) | M4 | done | backend/frontend |
| Feedback loop → publish (BR-005) | M4 | done | backend/frontend |
| web-customer PWA | M2 | done | frontend |
| Admin: Customers + Projects kanban + Project workspace | M2/M4 | done | frontend |
| Admin governance: roles, team activation, admin account status | M1 | done | backend/frontend |
| Admin-created customer projects + scoped search | M2 | done | backend/frontend |
| Customer admin CRUD, bulk actions, CSV import/export | M2 | in-progress | backend/frontend |
| Public RAG mutation synchronization + approved reviews | M1 | done | backend/rag |
| Admin Workflow: Modal-free / Inline Platform-Independent Editing | M1.5 | done | frontend |
| Content Section: Prefix-Based Tabbed Reorganization | M1.5 | done | frontend |
| Project Details: Tabbed / Master-Detail layout for Admin | M2 | done | frontend |
| Dynamic 3D AI Hero Banner (Public Site, LLM Scenarios) | M5 | done | ai/frontend/backend |
| Public hero scenarios API (`GET /api/v1/public/hero-scenarios`, LLM-generated animation variables, `IMemoryCache` TTL 1 h, deterministic no-key fallback) | M5 | done | backend/ai |
| Admin Audit Logging (actor/action/entity/before/after) | M2 | missing | backend |
| MCP Parity covering complete ICustomerManagementService | M2 | missing | mcp/backend |
| Continuous Validation/AI Agent Task Service | M4 | missing | backend/ai |
| E2E suite coverage for full Admin Workflows | M4 | missing | qa |
| Docker Compose + GitHub Actions deploy (RMEnterpriseCMS pattern) | M1 | done | devops |
| Tests (55 xUnit) + Playwright scaffold | M1–M4 | done | qa/automation |
| Marketing agent, voice chatbot, expanded locales | M5 | planned | — |

## Admin Panel UX Audit (2026-08-08)

Mechanism per page: `modal` = popup dialog; `inline` = state-based in-table/in-page UI; `page` = dedicated route; `none` = not present. Baseline before the modal-free overhaul.

| Page | View | Create | Edit | Delete | Destructive / status | Popups to remove |
|---|---|---|---|---|---|---|
| Dashboard | page (stats + recent leads) | none | none | none | none | none |
| Customers | table (+ agent in-flight detail) | modal Add Customer | modal edit (in-flight) | bulk delete via ConfirmDialog | bulk activate/deactivate via ConfirmDialog; Add project for customer modal | 3 modals + confirm |
| Projects | table → dedicated `/admin/projects/:id` | none | inline status select | none | none | none |
| ProjectDetail | dedicated page, stacked cards | inline (demo/invoice forms) | inline (status, notes, PRD) | none | inline PRD sign, feedback approve | none |
| Portfolio | table | modal Create/Edit Project | modal (same) | ConfirmDialog | publish/unpublish ConfirmDialog | 1 modal + 2 confirms |
| Team | table | modal Add/Edit Team Member | modal (same) | ConfirmDialog | activate/deactivate ConfirmDialog | 1 modal + 2 confirms |
| Content | table + locale filter | modal Create Entry | modal Edit Entry | ConfirmDialog | none | 1 modal + 1 confirm |
| Leads | table | none | inline notes editor (hand-rolled modal-backdrop) | none | none | 1 modal-backdrop |
| Reviews | table + published filter | none | none | none | moderate (publish/unpublish) ConfirmDialog | 1 confirm |
| Settings | admin list | modal Add Admin | none | none | deactivate ConfirmDialog | 1 modal + 1 confirm |
| Chat | thread viewer/reply | none | none | none | none | none |
| Drafts | cards | none | none | none | inline approve/reject buttons | none |
| Notifications | list + topbar popover | none | none | none | inline mark-read | none |
| MyProfile | dedicated form | none | inline form | none | inline GitHub sync | none |
| Login | dedicated | none | none | none | none | none |

Total popups in scope: 8 `Modal`/modal-backdrop usages + 9 `ConfirmDialog` usages across Portfolio, Team, Content, Leads, Reviews, Settings, Customers. `InlineConfirm` component exists and is unused; it will be the shared inline destructive pattern.

### Refactor schedule

1. Portfolio, Team, Content, Leads, Reviews, Settings, Projects — expansion-row + inline forms (no agent activity on these files).
2. Customers — deferred until the concurrent customer-management slice checkpoints.
3. Content prefix tabs; ProjectDetail master-detail tabs.
4. Dynamic hero: `HeroScenarioService` + endpoint + cache + tests, then CSS-3D `Hero.tsx` renderer.

### Post-overhaul state (2026-08-09)

All four refactor items are complete:

- **Modal-free admin (100%):** Portfolio, Team, Content, Leads, Settings, Reviews, Customers, Projects converted to inline patterns (`InlineConfirm` row-level destructive morph, `inline-edit-panel` create/edit forms, `inline-confirm-bar` bulk confirmations). `components/Modal.tsx` deleted; `Modal`/`ConfirmDialog`/modal-backdrop usage in `web-admin/src` is zero; modal CSS removed. New shared CSS: `.inline-edit-panel`, `.inline-confirm-bar`, `.content-tabs`/`.content-tab`.
- **Content tabs:** keys grouped by first-dot prefix with a tab rail (All + per-group counts) above the table; locale filter unchanged.
- **ProjectDetail tabs:** master-detail rail (Overview / Docs / PRD / Demos / Invoices / Feedback) with live counts; all handlers preserved.
- **Dynamic hero:** `backend/RALabs.Application/Services/HeroScenarioService.cs` (LLM-generated theme/colors/orbits/labels via OpenAI `json_object`, grounded in public knowledge chunks + published projects, `IMemoryCache` 1 h TTL, deterministic data-driven fallback). Registered in DI (requires `AddMemoryCache()` in `Program.cs`). Endpoint `GET /api/v1/hero-scenarios` returns `{ data: { theme, accent, secondary, tertiary, orbitCount, orbitSpeed, labels, projectFocus, generatedAt } }`. Frontend `Hero.tsx` renders the scene with pure CSS 3D transforms (layers / orbit / grid themes, `prefers-reduced-motion` respected) and falls back to the deterministic default when the endpoint is unavailable. `Microsoft.Extensions.Caching.Memory` package added to `RALabs.Application`. 6 new tests in `HeroScenarioTests.cs` (suite: 74 xUnit tests, all passing).
