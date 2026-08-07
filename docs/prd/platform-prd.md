# R&A Labs Platform — Product Requirements Document

Status: draft for agent handoff
Founders: Rajib Mahata, Abhishek Barnabal
Companion docs: `phase-1-spec.md` (earlier, narrower scope draft — superseded by this
document), `index.html` (visual/design reference for the public homepage)

This document is written for an autonomous coding agent (OpenCode AI Workforce) to
build against directly. Where a decision was not specified by the founders, an
explicit assumption is stated — flag assumptions back to the founders rather than
silently changing them.

**Naming note:** this platform has a client-facing feature also called "PRD"
(section 6.6). To avoid confusion, this document is referred to throughout as
**the platform PRD**, and the in-product client deliverable is referred to as
**the client PRD**.

---

## 1. Overview

A showcase and client-delivery platform for a two-founder engineering studio. It
has two jobs:

1. **Attract clients** — a public site demonstrating real project work, team
   expertise, and a repeatable delivery process, in multiple languages.
2. **Run client work** — once a visitor becomes a lead, the platform carries them
   through requirement intake, a signed client PRD, build, demo, and delivery,
   with the finished project feeding back into the public portfolio.

Every completed project — whether built for a client or by the studio itself —
becomes a portfolio entry that helps win the next one.

## 2. Goals

- A visitor can understand what the studio does and see evidence of it within one
  scroll of the homepage
- A visitor can go from "interested" to "lead captured" without leaving the chat
  widget
- A signed-off client project can go from PRD to delivered demo without any
  step happening outside the platform (chat, documents, status, all in one place)
- Every delivered project can be published to the public portfolio with one
  admin action
- The whole thing runs on the founders' existing .NET/React/Docker stack so the
  AI Workforce tooling can build and maintain it the same way it builds client
  projects

## 3. Personas

| Persona | Description | Primary actions |
|---|---|---|
| Visitor | Anonymous, browsing the public site | Browse portfolio/team, chat, submit contact form |
| Lead | A visitor who submitted contact info | Gets emailed to create an account |
| Customer | Authenticated, has one or more projects | Discuss requirements, review/sign client PRD, upload docs, track status, pay/track invoice |
| Admin (founder) | Rajib or Abhishek | Manage content, portfolio, team profiles, respond to leads, run client projects, publish delivered work |
| Agent (system) | AI agents acting on the platform's behalf | Answer chatbot questions, pull GitHub stats, draft marketing content, flag items needing human intervention |

## 4. Tech stack and repository layout

| Layer | Choice |
|---|---|
| Frontend (public + customer + admin) | React |
| API | .NET (ASP.NET Core, EF Core) |
| Database | PostgreSQL (or Azure SQL Basic tier) — **not** SQL Server Express, see note below |
| Hosting | Docker Compose |
| AI layer | Existing agentic workflow tooling (OpenCode AI Workforce agents) |
| Testing | `dotnet test` for backend; Playwright for UI regression |

**Why not SQL Server Express:** 10GB database cap and a 1 core / 1GB buffer pool
limit. This platform accumulates chat history, documents, multi-language content,
and GitHub sync snapshots continuously — it will outgrow Express quickly.

Suggested repo layout, matching the existing AI Workforce project convention:

```
backend/
  RALabs.Api
  RALabs.Application
  RALabs.Domain
  RALabs.Infrastructure
  RALabs.Tests
web-public/       React — marketing site, portfolio, team, contact, chatbot widget
web-customer/     React — customer portal
web-admin/        React — admin CMS
docs/
  sessions/  learning/  reviews/  decisions/  reports/
```

## 5. Information architecture

**Public (`web-public`)**
- `/` — home (hero, process, portfolio preview, team preview, contact)
- `/work` — full portfolio, filterable by tag/stack
- `/work/:slug` — project detail
- `/team` — team grid
- `/team/:slug` — individual profile with GitHub snapshot
- `/contact` — contact form
- Chatbot widget available on every public page

**Customer (`web-customer`)**, auth required
- `/login`, `/register`, `/forgot-password`
- `/dashboard` — list of the customer's projects
- `/projects/:id` — status, chat thread, document upload, client PRD, demo, invoice

**Admin (`web-admin`)**, auth required, admin role only
- `/leads` — inbox of captured leads, convert to customer project
- `/projects` — all client projects across customers, status board
- `/projects/:id` — same view as customer side plus manual-intervention queue,
  client PRD editor, demo upload, invoice entry
- `/portfolio` — manage published `Project` entries
- `/team` — manage team profiles
- `/content` — edit homepage/site copy per locale
- `/settings` — locales, email templates, GitHub sync config

## 6. Feature specifications

### 6.1 Public marketing site
- Hero, process explainer (5 steps: discuss, sketch, architect, build, refine —
  matches `index.html`), portfolio grid, team grid, contact section
- Responsive to phone width; motion respects `prefers-reduced-motion`
- Visual language follows `index.html`: dark blueprint background, signal-teal
  accent, Fraunces/IBM Plex type pairing — apply consistently to `/work`, `/team`,
  and detail pages, not just the homepage

### 6.2 Multi-language content
- Launch locales: English, Bengali, Hindi. Planned expansion: French, Russian,
  Japanese, and at least one widely-spoken African language (assumption: Swahili,
  pending founder confirmation)
- All homepage/site copy stored in a `PageContent` table keyed by locale, not
  hardcoded, so adding a language doesn't require a redeploy
- Locale switcher in the public site header; default locale by browser language,
  falling back to English

### 6.3 Portfolio / project showcase
- `Project` entries: title, summary, stack tags, status (live / in build),
  GitHub link, optional case-study body, cover image
- Sourced two ways: manually created by an admin, or auto-created when a client
  project is marked delivered and the customer's feedback is approved for publish
- Admin can reorder, unpublish, and edit any entry

### 6.4 Team profiles and GitHub sync
- `TeamMember`: name, role, bio, GitHub username
- Background job (scheduled, not on-request) pulls per-member commit count
  (trailing 90 days), active repo count, and last-commit timestamp into a
  `GithubSnapshot`, shown on the profile and summarized in the homepage status bar
  ("2 agents active · last commit 4m ago" pattern from `index.html`)

### 6.5 Contact intake and chatbot
- Contact form: name, email, short requirement text
- Chatbot: text-first at launch (voice deferred), scoped to answering questions
  from published project/team/process content and capturing a structured lead
- Every chatbot conversation and form submission creates a `Lead`; admin gets an
  email notification and sees it in `/leads`
- When the chatbot can't answer or the visitor asks for something transactional
  (quote, timeline), it flags `needs_manual_intervention = true` on the thread
  so an admin picks it up — this same flag is reused in 6.6 for client threads

### 6.6 Customer accounts and project threads
- Customer registers or is invited by email after a lead is converted
- Each `CustomerProject` has one `ChatThread` (agent-assisted, same
  manual-intervention pattern as 6.5), a document library, a client PRD, a
  status, a demo record, and an invoice
- Status values: `intake` → `prd_draft` → `prd_signed` → `in_build` → `demo` →
  `delivered` → `closed`
- Customer can upload requirement documents and sketches to the thread; admin
  and the agent can both post messages

### 6.7 Client PRD and dual e-sign
- Admin (with agent drafting assistance) writes the client PRD from the intake
  conversation
- Customer reviews inline and requests changes via the thread
- Both customer and admin sign off independently; `signed_at_customer` and
  `signed_at_admin` timestamps gate the status transition to `prd_signed`
- Signing is a recorded confirmation (name + timestamp), not a full
  cryptographic e-signature product at launch — flag to founders if a
  legally-binding e-signature vendor (e.g. DocuSign-style) is required later

### 6.8 Demo delivery
- Once a project reaches `in_build` and is ready to show, admin adds a `Demo`
  record: type (screenshot or URL), the asset itself, and notes
- Customer sees it in their project view and can respond in the thread

### 6.9 Invoicing
- `Invoice` per project: amount, currency, status (`unpaid`, `paid_cash`), notes
- **No online payment at launch** — cash only, but every invoice is tracked in
  the system so nothing is off-the-books. Online payment is a clearly separated
  future phase, not built now.

### 6.10 Delivery feedback loop
- On `closed`, customer is prompted for feedback: rating, comment, and consent
  to publish
- Approved feedback and the project's final URL feed into the public `Project`
  entry (6.3), closing the loop from client work back to the portfolio that
  attracts the next client

### 6.11 AI agent responsibilities (summary)

| Agent | Responsibility | Escalates to human when |
|---|---|---|
| Chatbot agent | Answer visitor questions, capture leads | Question needs a quote/timeline/commitment |
| Project agent | Assist in client threads, help draft client PRD | Ambiguous requirement or scope change |
| GitHub sync agent | Refresh `GithubSnapshot` on schedule | Sync failure (bad token, rate limit) |
| Marketing agent (phase 5, not launch) | Draft social/content posts from published portfolio entries | Always — posts are reviewed before publishing |

## 7. Data model

| Entity | Key fields |
|---|---|
| `Project` | id, title, summary, stack_tags, status, github_url, cover_image, sort_order, is_published |
| `TeamMember` | id, name, role, bio, github_username |
| `GithubSnapshot` | team_member_id, commits_90d, active_repos, last_commit_at, captured_at |
| `Locale` | code, label |
| `PageContent` | key, locale, value |
| `Lead` | id, name, contact_info, message, source (form/chatbot), status |
| `ChatThread` | id, type (lead/customer_project), needs_manual_intervention |
| `ChatMessage` | id, thread_id, sender_type (visitor/customer/admin/agent), content, attachment_url, created_at |
| `Customer` | id, name, email, password_hash, created_at |
| `CustomerProject` | id, customer_id, title, status, created_at |
| `Document` | id, customer_project_id, uploaded_by, file_url, created_at |
| `ClientPrd` | id, customer_project_id, content, status, signed_at_customer, signed_at_admin |
| `Demo` | id, customer_project_id, type, url_or_asset, notes |
| `Invoice` | id, customer_project_id, amount, currency, status, notes |
| `Feedback` | id, customer_project_id, rating, comment, is_published |
| `AgentTask` | id, type, status, payload, created_at |

## 8. System architecture

Four tiers, matching the diagram already reviewed with the founders:

1. **Actors** — visitors, customers, admins
2. **React frontend** — `web-public`, `web-customer`, `web-admin`
3. **.NET API layer** — core services (CMS, client PRD, invoicing) and the AI
   agent layer (chatbot, GitHub sync) as separate modules within the same API,
   sharing the same database
4. **Data & integrations** — PostgreSQL/Azure SQL, GitHub API, email/SMTP

## 9. API surface, high level

| Resource | Key endpoints |
|---|---|
| Portfolio | `GET /api/projects`, `GET /api/projects/{slug}`, admin CRUD under `/api/admin/projects` |
| Team | `GET /api/team`, `GET /api/team/{slug}`, admin CRUD under `/api/admin/team` |
| Content | `GET /api/content?locale=`, admin CRUD under `/api/admin/content` |
| Leads | `POST /api/leads`, admin list/update under `/api/admin/leads` |
| Chat | `POST /api/chat/{threadId}/messages`, `GET /api/chat/{threadId}` |
| Auth | `POST /api/auth/register`, `/login`, `/forgot-password` |
| Customer projects | `GET/POST /api/customer-projects`, `GET /api/customer-projects/{id}` |
| Documents | `POST /api/customer-projects/{id}/documents` |
| Client PRD | `GET/PUT /api/customer-projects/{id}/prd`, `POST .../prd/sign` |
| Demos | `POST /api/admin/customer-projects/{id}/demo` |
| Invoices | `GET/POST /api/admin/customer-projects/{id}/invoice` |
| Feedback | `POST /api/customer-projects/{id}/feedback` |

## 10. Non-functional requirements

- Role-based auth (JWT): anonymous, customer, admin
- Rate limiting on the public contact form and chatbot endpoint to prevent spam
- Email delivery for lead notifications, account invites, and status changes
  (provider TBD — flag to founders)
- Accessibility: visible keyboard focus, reduced-motion respected, sufficient
  contrast on the dark theme from `index.html`
- Performance: homepage should stay fast on mobile networks — it is itself a
  credibility signal for an engineering studio
- Logging on every `AgentTask` so agent actions are auditable, not silent

## 11. Build order (milestones)

1. **M1** — Public site, portfolio, team + GitHub sync, contact form + chatbot
   lead capture, admin CMS for content/portfolio/team (this is the scope covered
   in `phase-1-spec.md`)
2. **M2** — Customer accounts, project threads, chat, document upload
3. **M3** — Client PRD workflow (draft, edit, dual sign-off)
4. **M4** — Demo delivery, invoicing, feedback loop into the public portfolio
5. **M5** — Marketing agent, voice chatbot input, expanded language set

Each milestone should ship independently testable and demoable — don't hold M1
for features that belong in M3+.

## 12. Assumptions and open questions

- Final brand name is not settled (`index.html` uses "R&A Labs" as a placeholder)
- Abhishek's title/bio for the team section is not yet provided
- Email provider (SMTP vs a transactional email service) not chosen
- Legally-binding e-signature requirement for the client PRD is unconfirmed —
  current spec treats it as an in-app recorded confirmation, not a notarized
  signature
- African language target for the expanded locale set assumed as Swahili pending
  confirmation
- Whether the internal AI agents should run on the same LLM provider already used
  for the AI Workforce tooling, or a different one for the customer-facing
  chatbot, is unconfirmed
