# IMPLEMENTATION STATUS: ra-labs

Update: 2026-08-23 (second pass) — real SQL Server validation + dependency audits + CI. Original method: code inspection + live API sweeps (Production
mode, in-memory DB) + 10-test Playwright suite against the running stack +
116-test backend suite. No status below is assumed from UI presence alone.

## Overall Completion

| Area | % | Evidence |
|---|---|---|
| **Overall** | **84%** | weighted summary of rows below |
| Frontend | 85% | 3 apps build (`tsc`+vite); Playwright 10/10 incl. new Portfolio/Customer-Login/truthful-agent specs |
| Backend | 85% | `dotnet build` warning-free; 116/116 tests; endpoint sweep green |
| Database | 95% | all 13 migrations APPLIED on RAJIB\SQLEXPRESS (verified via ef migrations list); API runtime proven on real SQL Server — health up, login OK, dashboard stats return live data, RAG seeding succeeded after LINQ translation fix; clean-DB rebuild test not run (destructive) |
| APIs | 90% | full route sweep: public/customer/admin/MCP all respond correctly |
| Authentication | 90% | role matrix verified live (anon→401, customer→403 admin, admin→403 super-admin surfaces); JWT fails closed <32-char secret |
| Customer Journey | 85% | register→project→PRD dual-sign→build→demo→delivered→cash invoice→feedback→closed→portfolio publication proven end-to-end |
| Admin | 80% | CRUD/search/filter/import/export/stats/notifications verified; dedicated E2E suite still thin |
| AI Agents | 75% | orchestrator proven live: guided intake → contact steps → review → confirm → customer+project+notification+email |
| RAG | 60% | ingestion now seeds at startup (14 chunks); retrieval returns real data; **keyword scoring only — no embeddings/Qdrant (M2)** |
| Voice | 40% | Web Speech implementation + states exist, honestly gated OFF by config; **never runtime-verified in a browser here** |
| GitHub Integration | 65% | sync job runs, graceful without token, tokens encrypted at rest; real-token run unverified |
| Notifications | 75% | in-app notifications verified live; email = console stub until SMTP configured; push not implemented |
| Security | 85% | headers, CORS allowlist, rate limits (observed 429s), IDOR guards, private storage, zero public DTO leaks; npm audit 0 vulnerabilities ×3 apps; `dotnet list package --vulnerable` clean ×4 projects; fixed non-translatable enum.ToString() LINQ found only on real SQL Server path |
| Testing | 70% | 116 unit/service + 10 E2E green; authenticated admin E2E + accessibility/performance suites missing |
| PWA/Mobile | 75% | manifests + SW registration base-path aware; mobile overflow fixed & regression-tested; Lighthouse not run |

## Feature Matrix (key features)

| Feature | UI | API | DB | Agent | RAG | Tested | Status |
|---|---|---|---|---|---|---|---|
| Public site (premium theme) | ✅ | ✅ | ✅ | — | ✅ | E2E | COMPLETE |
| Portfolio showcase + case studies | ✅ | ✅ | ✅ | ✅ | ✅ | E2E | COMPLETE |
| NEW: Portfolio menu page (summary + live/GitHub links) | ✅ | ✅ | ✅ | — | — | E2E | COMPLETE |
| Team profiles (public-safe DTO) | ✅ | ✅ | ✅ | ✅ | ✅ | API+E2E | COMPLETE (email/token leak removed) |
| Customer Login entry from public site | ✅ | ✅ (config) | — | — | — | E2E | COMPLETE (portal URL was misconfigured → fixed) |
| Contact form → Lead | ✅ | ✅ | ✅ | — | — | E2E | COMPLETE |
| Guided agent intake (anon) → customer+project | ✅ | ✅ | ✅ | ✅ | — | API E2E | COMPLETE (rate-limit aware clients required) |
| Chatbot/RAG QA over seeded content | ✅ | ✅ | ✅ | ✅ | ⚠️ | API | PARTIAL — keyword scoring; startup seeding fixed this audit |
| Customer portal (projects/docs/chat) | ✅ | ✅ | ✅ | ✅ | — | API+E2E | COMPLETE |
| PRD workflow (draft→dual sign→prd_signed) | ✅ | ✅ | ✅ | — | — | Unit+E2E | COMPLETE (deadlock fixed 08-22) |
| Demo / Invoice (cash-only) / Feedback | ✅ | ✅ | ✅ | — | — | Unit+E2E | COMPLETE |
| Feedback → public portfolio loop (BR-005) | ✅ | ✅ | ✅ | — | ✅ | Unit+E2E | COMPLETE (was a stub → implemented 08-22) |
| Voice input/output | ✅ | — | — | ⚠️ | — | NOT RUNTIME-TESTED | PARTIAL (honest gating; verify in Chrome/Edge before claiming) |
| SSE streaming replies | ✅ | ✅ | ✅ | ⚠️ | — | NOT RUNTIME-TESTED | PARTIAL (needs OpenAI key + setting) |
| GitHub sync → snapshots/repos | ✅ | ✅ | ✅ | ✅ | ✅ | partial | PARTIAL (no-token run verified; token run unverified) |
| Admin dashboard aggregates | ✅ | ✅ | ✅ | — | — | API | COMPLETE |
| Audit log (super-admin) | ✅ | ✅ | ✅ | — | — | API | COMPLETE |
| MCP tool layer (64 tools) | — | ✅ | — | ✅ | ✅ | API | COMPLETE (parity incl. customer mgmt) |
| CSV import/export (customers/leads/team/portfolio/reviews/content) | ✅ | ✅ | ✅ | — | — | Unit | COMPLETE |
| Marketing agent (M5) | ❌ | ❌ | ❌ | ❌ | ❌ | — | NOT IMPLEMENTED |
| Semantic embeddings / Qdrant | ❌ | ❌ | partial | — | ❌ | — | NOT IMPLEMENTED (M2; SQL metadata store ready) |
| Online invoice payment | ❌ | ❌ | ❌ | — | — | — | NOT IMPLEMENTED (explicitly future) |

## Broken Features (found & fixed during this audit)

| Location | Problem | Root cause | Severity | Fix |
|---|---|---|---|---|
| `DbInitializer` | RAG index EMPTY on fresh DB → every knowledge question escalated | ingestion never ran at startup | **Critical** | seed `IngestPublicContentAsync` at startup (verified: 14 chunks; DocSignerHub query answered) |
| `CustomerProjectService.SavePrdAsync` | projects deadlocked at `intake`; could never reach `prd_signed` | ADR-005 transition missing; both sign gates require `prd_draft` | **Critical** | auto-transition on first draft + regression test |
| `ModerateFeedbackAsync` | BR-005 portfolio loop was a stub comment | publisher never implemented | High | idempotent auto-publish linked via `Project.CustomerProjectId` + test |
| `Program.cs` CORS | config existed but middleware never wired | implicit routing order | High | explicit `UseRouting` + `UseCors` (preflight 204 verified) |
| `POST /seed/full` | unauthenticated reseed in Production | dev helper mapped globally | High | Development-only (404 verified in prod mode) |
| `SecurityHeadersMiddleware` | `microphone=()` blocked the product's own voice feature | copy-paste policy | Medium | `microphone=(self)` |
| web-public mobile nav | closed off-canvas menu widened page to ~708px @390px viewport + hidden focusable links | transformed fixed element counts toward scrollWidth | Medium | `display:none` when closed + slide-in keyframe; E2E pan-check added |
| `ChatService` agent messages | `CreatedAt = UtcNow.AddSeconds(1)` corrupted chat chronology | hack to force ordering | Medium | real timestamps (replies persist after users by design) |
| Public `/api/v1/team*` | leaked `Email`, `HasGithubToken`, internal flags | shared admin DTO | High | dedicated `PublicTeamMemberDto` (verified: zero leaks) |
| `App:CustomerPortalUrl` | pointed at the PUBLIC site (3004) not the portal | config typo | High | corrected to `http://localhost:3002/customer`; nav link added |
| `/agent` page | fake conversations, fake agent roster ("Online", fake versions), hardcoded "Rajib Mahata · Administrator" chip shown to visitors | prototype filler | High (trust) | replaced with REAL team members from API; fakes deleted (E2E asserts absence) |
| Nav status pill | "Studio capacity: Available" — unverifiable claim | marketing filler | Medium | config-driven "AI agent online" tied to `ai.agent.enabled` |

## Misleading UI remaining

- None known in `web-public`. `web-admin` dashboards render real server aggregates.
- The chatbot's deterministic answers are grounded retrieval, clearly framed ("Here's what I found") — acceptable until LLM integration lands.

## Unnecessary Code (safe to remove later, low priority)

- `docs/NEXT_SESSION.md`, `docs/KNOWN_ISSUES.md` — empty templates superseded by project-state docs.
- `web-public/src/pages/Work.tsx` vs new `Portfolio.tsx` overlap intentionally retained (grid vs detail-row views); revisit if redundant after feedback.
- Legacy `docs/prd/platform-prd.md`, `-v2.md` kept as history per doc policy (marked superseded).

## Agent Status

| Agent | Exists | API Tools | RAG | Tested | Status |
|---|---|---|---|---|---|
| Chat orchestrator (public/customer intake) | ✅ | via Application services only (never touches DB directly) | ✅ keyword | Live E2E | WORKING |
| RAG retrieval | ✅ | `rag_query` (+internal) | ✅ | API | WORKING (keyword) |
| GitHub sync | ✅ | `github_sync` | indexes repos | startup log | PARTIAL (untested with real token) |
| Translation agent | ✅ | internal | n/a | unit | PARTIAL (no provider key) |
| AI content drafts | ✅ | `generate_project_draft` etc. | ✅ | unit | PARTIAL (needs OpenAI key) |
| Marketing agent (M5) | ❌ | ❌ | ❌ | ❌ | NOT IMPLEMENTED |

Agents use controlled Application-service paths exclusively; no direct DB access anywhere in agent code (verified by inspection: `AgentChatService` → services only).

## Customer Journey (verified via API E2E + Playwright)

Landing **PASS** → Understand offer **PASS** (hero/capabilities/journey sections) → Start Project **PASS** (hero panel + /agent) → Chat requirements **PASS** (7-step intake) → Name/Email/Phone **PASS** (validated; email enforced) → Submit **PASS** (confirm → creates records) → Account created **PASS** (match-or-create; random credential) → Confirmation email **PARTIAL** (dispatched to sender; delivery needs SMTP) → Customer login **PASS** (portal + nav entry; forgot/reset flows unit-covered) → Project workspace **PASS** → Conversation **PASS** → Document upload **PASS** (validated, ownership-checked) → Human intervention **PASS** (escalation flag + notification observed) → Requirement refinement **PASS** (thread + brief visible to admin) → PRD **PASS** (auto prd_draft) → Dual signature **PASS** (gates enforced) → Development **PASS** (status machine) → Demo **PASS** → Feedback **PASS** → Delivery/close **PASS** → Portfolio publication **PASS** (BR-005 auto-entry verified live).

## Production Readiness

### Is this application production ready?

**NO.**

### Can a real customer use it today?

**LIMITED** — the complete public→agent→project journey works today with the deterministic (non-LLM) agent; a customer can register, chat, upload documents, sign PRDs, and receive invoices. Limitations: email delivery requires SMTP configuration; agent answers are keyword-grounded (no conversational LLM); voice is disabled by default and unverified.

### Critical blockers

1. ~~Database migration validation~~ **DONE 2026-08-23**: all migrations applied; API verified running on SQL Server Express with real data.
2. **SMTP provider decision + configuration** — confirmation/reset emails currently log to console. Needs: provider account + `Email:*` env values.
3. **Production secrets** — `Jwt:Secret`, OpenAI key, GitHub PATs must be supplied per-environment (fail-closed enforced for JWT).
4. ~~Dependency vulnerabilities~~ **DONE**: 0 npm vulnerabilities across all three apps; no vulnerable NuGet packages (direct or transitive).

### Recommended next steps

1. **Critical**: apply migrations on Windows SQL Server; configure SMTP (`Email:*`) or enable `RequireSmtp` gate; supply production `Jwt:Secret`.
2. **High**: browser-runtime verification of voice (Chrome/Edge, permission-denied paths) before enabling `ai.voice.enabled`; wire Playwright into CI; dependency audit re-run.
3. **Medium**: LLM provider selection to enable conversational/streaming agent; semantic embeddings + source attribution (M2); production object storage for uploads.
4. **Low**: marketing agent (M5); expanded locales content; performance/load baseline.

— Generated by the audit; update as gates close. Evidence scripts/transcripts: session logs 2026-08-22/23.
