# RA Labs Current Implementation Stage

## Snapshot Date
2026-08-08

## Current Version
v1.1.1 (commit `7a9f5bc7a1b380b5c3d1aa47497d9b153b965449`)

## Overall Completion
Implementation slices are complete for GitHub repository automation, reviewable OpenAI project drafts, admin approval, private customer documents, and browser voice input. Production readiness is still gated by infrastructure, security audit, and full E2E evidence.

## Working Features
- .NET 8 four-project backend builds successfully.
- 58 backend tests pass.
- SQL Server EF Core provider and migrations are present.
- Public project, team, content, lead, and chatbot endpoints are registered.
- Admin and customer JWT authentication flows are registered.
- Customer project, document, PRD, demo, invoice, and feedback services exist.
- MCP registry, rate limiting, security headers middleware, GitHub sync, and RAG ingestion surfaces exist.
- MCP also exposes AI draft review and deterministic permission-scoped RAG query operations.
- `web-public`, `web-customer`, and `web-admin` production builds pass.
- Customer project child-resource reads now enforce authenticated customer ownership in REST and MCP paths.
- Customer PWA manifest, icons, service-worker registration, and service-worker cache URLs are base-path aware for `/customer/`.
- GitHub sync persists repository URL, description, language, technology metadata, and README snapshots.
- GitHub sync detects meaningful repository snapshot changes and queues a re-analysis `AgentTask`.
- OpenAI project drafting is server-only, key-gated, factual-source constrained, and persisted as pending `ContentDraft` records.
- Admin draft queue supports explicit approve/reject review; approval creates an unpublished `Project` record.
- Customer chat supports Web Speech API dictation plus safe navigation commands for dashboard, account, projects, current project, and back; customer file upload/download uses authorized private storage.
- Public homepage now explains the customer journey from understanding through approval, with a structured first-brief preparation section.
- Customer project creation captures goal, audience, requirements, timeline, budget or constraints, and reference links; the brief is visible in customer and admin project details and creation opens the project room.
- Admin Team and My Profile support GitHub account URLs and write-only personal access tokens; tokens are encrypted at rest and never returned to the UI. Admins can manually trigger synchronization, and public Work renders synchronized repository metadata beside curated projects.

## Partially Working Features
- Customer portal source and production build now pass after restoring its dependency tree.
- Browser smoke coverage passes 7/7 across public, customer login, admin login, and mobile overflow flows.
- Voice command routing is build-validated, but browser simulation and a dedicated component-test runner are not yet configured.
- Customer project lifecycle is represented in domain/application code but is not fully validated end to end.
- Chatbot/RAG has deterministic SQL retrieval with public/project permission filtering and Qdrant-ready infrastructure; semantic production retrieval and model-provider integration are incomplete.
- Public site design references exist; browser audit confirms the shell is responsive without horizontal page overflow. The earlier work/team 500 was reproduced with the API unavailable and cleared when the API was started on the configured proxy target.
- CMS, GitHub, AI draft, approval, PWA, localization, and admin workflows have implementation slices but lack complete production validation.

## Missing Features
- Complete production coverage across all requested public, customer, admin, AI, CMS, payment, marketing, and collaboration requirements.
- Complete integration/E2E/Playwright coverage and QA sign-offs.
- Approved production object-storage integration and complete file-content scanning pipeline.
- Complete observability, deployment, performance, accessibility, and security audit evidence.

## Known Bugs
- `npm audit` reports four customer frontend dependency vulnerabilities (three moderate, one high); remediation requires a reviewed dependency upgrade and may include a breaking Vite major update.
- Existing xUnit analyzer warning: `Assert.NotNull` is used on a `Guid` value type in `CustomerWorkflowTests.cs`.
- GitHub sync currently needs `GithubUsername` in addition to the account URL; repository publication has no per-repository approval/privacy flag yet; Data Protection keys require durable shared production storage for multi-instance deployments.

## Current Architecture
React 18 + Vite frontends; ASP.NET Core minimal API; Domain/Application/Infrastructure layers; EF Core SQL Server provider; Qdrant client; MCP thin tool registry. `docs/ARCHITECTURE.md` contains stale PostgreSQL references that conflict with the actual SQL Server project configuration and `AGENTS.md`.

## Backend Status
Build PASS with `dotnet build backend/RALabs.sln --no-restore`. Test PASS: 63/63. Additive migrations `ContentDraftsAndGithubRepositories` and `GithubCredentials` are generated. API runtime smoke previously passed on 2026-08-08 at `http://localhost:5002`; development startup uses an explicit local-only JWT secret while base and production configuration remain environment-only. Health, public, auth, customer, admin, chat, MCP, representative CRUD, authorization, and state-machine paths were exercised. Admin browser proxy login/dashboard also PASS.

## Frontend Status
`web-public`, `web-customer`, and `web-admin` production builds PASS after restoring customer dependencies. Customer PWA subpath registration is browser-verified fixed. Customer dependency audit still reports four vulnerabilities. Public API runtime/proxy checks now pass when the API is running on its configured target. The latest `web-public` and `web-admin` builds also pass with GitHub repository presentation and credential management enabled.

## Database Status
SQL Server is the actual configured provider and migrations exist. Data integrity and non-destructive migration behavior have not been fully audited in this snapshot.

## AI/RAG Status
Chatbot, agent task, knowledge chunk, ingestion, Qdrant-ready retrieval, GitHub source snapshots, and OpenAI draft generation exist. OpenAI requires server-side `OpenAI__ApiKey`; drafts never publish automatically. Production semantic retrieval, grounding evaluation, and complete tenant-boundary tests remain incomplete.

## Authentication Status
JWT admin/customer login, refresh, password reset, rate limiting, and role policies are present. Customer project child-resource REST and MCP reads now enforce ownership with non-leaking 404 responses.

## Customer Workflow Status
Project creation/detail, structured brief intake, documents, PRD signing, demo, invoices, and feedback are represented. Full lifecycle persistence, auditability, and end-to-end workflow validation are not complete.

## Admin Workflow Status
Admin project, customer, content, team, lead, chat, GitHub, RAG, and AI draft review routes exist. The AI draft queue is available at `/admin/drafts`; complete workflow and design validation are pending.

## Testing Status
Backend unit/service suite: 58 passing. All three frontend production builds pass. Playwright suite: 7 passing. Integration tests, API tests, security regression tests beyond the existing service coverage, and comprehensive accessibility/performance coverage remain incomplete.

## Security Status
Rate limiting, JWT, role authorization, security headers, and password hashing surfaces exist. Tenant read authorization and validated private local document storage are regression-tested. Production object storage and frontend dependency vulnerabilities require remediation and review.

## Performance Status
No measured production performance baseline or load-test evidence is recorded.

## Documentation Status
Existing architecture, API, PRD, and workflow documents are present. Required project-state records were absent before this snapshot and are being established now.

## Current Sprint
No active sprint is defined; `docs/current-sprint.md` is still a template.

## Current Priority
Address file upload security and dependency vulnerabilities, reconcile architecture docs, then validate API/UI workflows.

## Active Development Area
Customer onboarding journey and structured project intake.

## Blockers
- Customer dependency audit findings require review.
- Production object storage provider and malware/content scanning policy are not yet configured.
- API runtime smoke evidence is recorded; repeatable deployment and database migration validation remain pending.
- Product/provider decisions remain open for production LLM, email, and vector retrieval operations.

## Technical Debt
Stale architecture database references; local storage needs production object-storage replacement; incomplete audit/event model; missing comprehensive E2E/security/performance evidence; template living documents.

## Open Questions
- Which production LLM, email, object storage, and Qdrant deployment are approved?
- Is the current checked-out `main` branch the intended implementation branch despite repository workflow requiring `task-*` branches from `develop`?
- Which missing features are in the current release scope versus later milestones?

## Last Validated Commit
`7a9f5bc7a1b380b5c3d1aa47497d9b153b965449`

## Last Successful Build
2026-08-08: `dotnet build backend/RALabs.sln --no-restore`; `web-public`, `web-customer`, and `web-admin` builds.

## Last Successful Test Run
2026-08-08: `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj --no-restore`, 58 passed, 0 failed.

## Last Successful Smoke Test
2026-08-08: API route/authorization/state-machine sweep against `http://localhost:5002`; admin browser `/admin/` loaded successfully without 500.

## Production Readiness
NOT PRODUCTION READY. Secure local document storage and offline chat are implemented, but production object storage, dependency vulnerabilities, feature-completeness, and broader quality-gate evidence remain outstanding.
