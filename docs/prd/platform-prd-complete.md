# R&A Labs Platform — Complete PRD

Status: final — supersedes `platform-prd.md` and `platform-prd-v2.md`. Both
are kept for history; this is the single document to build from.
Companion files: `wireframes.html` (screen structure + architecture diagram),
`index.html` (visual reference — see open item on this below),
`opencode-ai-workforce` (the agents/standards/workflow this gets built with).

**Naming note carried over:** "client PRD" = the in-product signed document
between the studio and a customer (section 5.7). This document is the
platform PRD.

---

## 1. Overview

A showcase and client-delivery platform for a two-founder engineering
studio. It attracts clients with real project work and a repeatable
process, and it runs client work end to end — intake, signed client PRD,
build, demo, delivery — with every delivered project feeding back into the
public portfolio.

## 2. Goals

- A visitor understands the studio and sees evidence of it within one
  scroll of the homepage
- A visitor reaches "lead captured" without leaving the chat widget
- A signed client project moves from PRD to delivered demo entirely inside
  the platform
- A delivered project reaches the public portfolio with one admin action
- The whole thing is buildable by the OpenCode AI Workforce on the
  founders' existing stack, using the workforce's own agents and standards

## 3. Personas

| Persona | Description | Primary actions |
|---|---|---|
| Visitor | Anonymous, browsing the public site | Browse portfolio/team, chat, submit contact form |
| Lead | A visitor who submitted contact info | Gets emailed to create an account |
| Customer | Authenticated, has one or more projects | Discuss requirements, sign client PRD, upload docs, track status, invoice |
| Admin (founder) | Rajib or Abhishek | Manage content, respond to leads, run client projects, publish delivered work |
| Agent (system) | AI agents acting on the platform's behalf | Chat, RAG retrieval, GitHub sync, flag manual intervention |

## 4. Tech stack and repository layout

| Layer | Choice |
|---|---|
| Frontend (public, customer, admin) | React, PWA for public + customer |
| API | .NET (ASP.NET Core, EF Core) |
| Database | PostgreSQL (or Azure SQL Basic) — not SQL Server Express |
| Vector store | Qdrant, self-hosted via Docker Compose |
| Hosting | Docker Compose |
| Agent tooling | OpenCode AI Workforce (see companion repo) |
| Testing | `dotnet test`, Playwright |

```
backend/
  RALabs.Api  RALabs.Application  RALabs.Domain  RALabs.Infrastructure  RALabs.Tests
web-public/   web-customer/   web-admin/
docs/
  prd/  design/  decisions/  reviews/  learning/  reports/
```

## 5. Feature specifications

### 5.1 Public marketing site
Hero, process explainer, portfolio grid, team grid, contact section.
Responsive to phone width, `prefers-reduced-motion` respected. PWA:
installable manifest, cache-first shell, network-first API calls.

### 5.2 Multi-language content
Launch: English, Bengali, Hindi. Planned: French, Russian, Japanese, and one
African language (assumption: Swahili, unconfirmed). Copy stored in
`PageContent` keyed by locale — never hardcoded.

### 5.3 Portfolio / project showcase
`Project` entries with title, summary, stack tags, status, GitHub link,
optional case study, cover image. Created manually or auto-created from an
approved, published `Feedback` record (section 5.10).

### 5.4 Team profiles and GitHub sync
`TeamMember` + scheduled job populating `GithubSnapshot` (commits/90d,
active repos, last commit) — shown on profile and the homepage status bar.

### 5.5 Contact intake and chatbot
Text-first chatbot (voice deferred to M5), scoped to answering from
published content via RAG retrieval (section 5.11) before falling back to
lead capture. Every conversation/form submission creates a `Lead` and
triggers an admin email. Escalates to `needs_manual_intervention` for
anything transactional.

### 5.6 Customer accounts and project threads
`CustomerProject` per engagement, one `ChatThread`, a document library, a
client PRD, status, demo, invoice. Status: `intake → prd_draft →
prd_signed → in_build → demo → delivered → closed`.

### 5.7 Client PRD and dual sign-off
Admin (agent-assisted, drafting from RAG context) writes it; customer
reviews and requests changes in-thread; both sign independently
(`signed_at_customer`, `signed_at_admin`) to unlock `prd_signed`. Recorded
confirmation, not a notarized e-signature product, at launch.

### 5.8 Demo delivery
`Demo` record (screenshot or URL) once `in_build` is ready to show.

### 5.9 Invoicing
`Invoice` per project — cash only at launch, but every invoice is tracked,
nothing off-the-books. Online payment is an explicit future phase.

### 5.10 Delivery feedback loop
On `closed`: prompt for rating/comment/publish consent. Approved feedback
plus final URL creates the public `Project` entry — the loop that turns
client work into the next lead.

### 5.11 RAG-powered agent chat
Dual-pipeline pattern (semantic retrieval + deterministic fields for
anything transactional), matching the founders' LexVault design.

- **Ingested:** public content (portfolio, team, process, FAQ) for the
  public chatbot; per-customer documents, sketches, and thread history for
  the project agent, scoped strictly by `customer_project_id`
- **Never left to retrieval:** quote figures, timelines, contractual
  language — pulled from structured fields (`ClientPrd`, `Invoice`) or
  flagged for manual intervention
- **Stack:** Qdrant, embeddings generated on ingest + nightly re-index

### 5.12 MCP server
Every API is exposed as both REST (for the frontends) and MCP tools (for
the runtime agents and the OpenCode AI Workforce agents themselves), from
the same Application-layer service — not a duplicated code path. Auth on
MCP calls mirrors REST; no elevated access via the tool layer.

## 6. Data model

| Entity | Key fields |
|---|---|
| `Project` | id, title, summary, stack_tags, status, github_url, cover_image, sort_order, is_published |
| `TeamMember` | id, name, role, bio, github_username |
| `GithubSnapshot` | team_member_id, commits_90d, active_repos, last_commit_at, captured_at |
| `Locale` | code, label |
| `PageContent` | key, locale, value |
| `Lead` | id, name, contact_info, message, source, status |
| `ChatThread` | id, type (lead/customer_project), needs_manual_intervention |
| `ChatMessage` | id, thread_id, sender_type, content, attachment_url, created_at |
| `Customer` | id, name, email, password_hash, created_at |
| `CustomerProject` | id, customer_id, title, status, created_at |
| `Document` | id, customer_project_id, uploaded_by, file_url, created_at |
| `ClientPrd` | id, customer_project_id, content, status, signed_at_customer, signed_at_admin |
| `Demo` | id, customer_project_id, type, url_or_asset, notes |
| `Invoice` | id, customer_project_id, amount, currency, status, notes |
| `Feedback` | id, customer_project_id, rating, comment, is_published |
| `AgentTask` | id, type, status, payload, created_at |
| `KnowledgeChunk` | id, source_type, source_id, customer_project_id (nullable), locale, chunk_text, embedding_vector, created_at |

## 7. System architecture

Four tiers — see `wireframes.html` for the diagram. Actors → three PWA-enabled
React frontends → .NET API layer (core services / AI agent layer / MCP
server, three modules over one service layer) → data tier (Postgres, Qdrant,
GitHub API, email/SMTP).

## 8. Non-functional requirements

- Role-based JWT auth: anonymous, customer, admin
- Rate limiting on public contact/chatbot endpoints
- Accessibility: keyboard focus, reduced motion, contrast
- PWA: installable, offline shell, Lighthouse pass before each milestone ships
- Every `AgentTask` logged — agent actions are auditable, never silent
- RAG retrieval filtered by `customer_project_id` at the query layer, not
  the prompt layer — verified, not assumed

---

## 9. Implementation plan

Each numbered task below is not complete until it clears all six gates in
the OpenCode AI Workforce's `WORKFLOW.md` (architecture, code, security,
performance, QA, documentation review). This section defines *what* to
build and in *what order*; `STANDARDS.md` in the workforce repo defines the
bar it's built to. Update `docs/current-sprint.md` and
`docs/completed-features.md` as each task lands, not at milestone end.

### M1 — Foundation: public site, portfolio, team, admin, lead capture

1. Scaffold via `new-project.sh /path ra-labs`
2. Domain entities: `Project`, `TeamMember`, `GithubSnapshot`, `Locale`,
   `PageContent`, `Lead`, `ChatThread`, `ChatMessage`
3. EF Core `DbContext` + initial Postgres migration
4. Repository + Specification pattern for filtered/paged queries (published
   status, locale)
5. CQRS: `CreateProject`, `UpdateProject`, `PublishProject`,
   `ListProjects`, `GetProjectBySlug` — same shape for `TeamMember`
6. MCP tool definitions mirroring the above, over the same Application
   services (not a second implementation)
7. Scheduled GitHub sync job → `GithubSnapshot`
8. Contact form + chatbot endpoint → `Lead`, triggers admin email
9. Admin auth (JWT, admin role)
10. RAG ingestion pipeline (Qdrant) for public content; chatbot retrieves
    before falling back to lead capture
11. `web-public`: home, `/work`, `/work/:slug`, `/team`, `/team/:slug`,
    `/contact`; PWA manifest + service worker (cache-first shell,
    network-first API)
12. `web-admin`: dashboard, leads inbox, portfolio/team/content CRUD
13. Seed `PageContent` for English/Bengali/Hindi; locale switcher

**M1 acceptance:** portfolio/team CRUD works end to end from the admin UI,
GitHub sync populates real snapshot data, contact form and chatbot both
create `Lead` records, MCP tools exist for every M1 endpoint, `web-public`
passes a Lighthouse PWA check.

### M2 — Customer accounts and project threads

1. Domain entities: `Customer`, `CustomerProject`, `Document`
2. Customer auth: register/login/forgot-password, separate role from admin
3. CQRS: `CreateCustomerProject`, `PostMessage`, `UploadDocument`,
   `GetProjectThread`; MCP tools mirrored
4. Per-project RAG ingestion (documents + thread history), hard
   `customer_project_id` filter at the query layer
5. `web-customer`: login/register, dashboard, project detail (thread,
   documents, status); PWA with offline message queue
6. `web-admin`: thread view, manual-intervention queue

**M2 acceptance:** a customer can register, open a thread, upload a
document, and see it in the admin view; retrieval scoping verified with two
test customers, confirmed no cross-contamination (explicit QA test, not
assumed from the filter existing in code).

### M3 — Client PRD workflow

1. Domain entity: `ClientPrd`
2. CQRS: `DraftClientPrd` (agent-assisted from RAG + thread context),
   `UpdateClientPrd`, `SignClientPrd` (customer and admin independently)
3. Status gate: `prd_signed` only when both signatures are present
4. `web-customer` + `web-admin`: PRD view/edit/sign UI

**M3 acceptance:** a client PRD can be drafted, edited, and signed by both
parties; explicit test confirms agent drafting never states a number or
date that isn't pulled from a structured field.

### M4 — Demo, invoicing, feedback loop

1. Domain entities: `Demo`, `Invoice`, `Feedback`
2. CQRS for each — admin-only writes, customer-visible reads
3. On `closed`: prompt feedback; approved + published feedback creates a
   public `Project` entry
4. `web-admin`: demo upload, invoice entry; `web-customer`: view demo/
   invoice, submit feedback

**M4 acceptance:** a demo and invoice both attach correctly to a project;
closing a project and approving feedback produces a real portfolio entry
without manual re-entry.

### M5 — Marketing agent, voice chat, expanded locales

1. Marketing agent drafts posts from published portfolio entries — always
   human-reviewed before publish, never auto-posted
2. Voice input on the chatbot widget
3. Additional `PageContent` locales: French, Russian, Japanese, and the
   confirmed African-language target

**M5 acceptance:** as scoped above — this milestone should not start until
M1–M4 are each independently demoable, not just "mostly working."

## 10. Open questions

- Final brand name — see naming discussion in chat; not yet settled
- Abhishek's title/bio for the team section
- Email provider (SMTP vs. transactional service)
- Whether the client PRD needs a legally-binding e-signature vendor beyond
  the recorded-confirmation approach in section 5.7
- African locale target (Swahili assumed, unconfirmed)
- Which LLM serves the runtime chatbot/project agents — DeepSeek and
  GPT-5.6 Luna are already configured for the dev-agent side; whether the
  customer-facing agent reuses one or uses a separate provider is open
