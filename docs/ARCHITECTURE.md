# ARCHITECTURE: ra-labs

## Overview
R&A Labs is a four-tier showcase-and-client-delivery platform for a two-founder engineering studio. It attracts clients through a multi-language public site with chatbot lead capture, and runs client projects end-to-end — from requirement intake through a signed client PRD, build, demo, and delivery — with every completed project feeding back into the public portfolio.

The four tiers are:

1. **Actors** — visitors (anonymous), customers (authenticated), admins (founders — Rajib & Abhishek), and system agents (chatbot, project agent, GitHub sync agent, MCP clients including the founders' own OpenCode AI Workforce agents).
2. **React frontends** — `web-public` (marketing site + PWA), `web-customer` (customer portal + PWA), and `web-admin` (admin CMS, standard web app).
3. **.NET API tier** — `RALabs.Api` exposing REST controllers and an MCP tool-definition layer over three internal modules: Core Services, AI Agent Layer, and MCP Server. All three call the same `RALabs.Application` service layer; no business logic is duplicated.
4. **Data & integrations** — PostgreSQL (primary relational store), Qdrant (vector store for RAG), GitHub API (team activity snapshots), and email/SMTP (lead notifications, account invites, status changes).

## Component Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│  ACTORS:  Visitors  ·  Customers  ·  Admins  ·  MCP/Agent clients   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  web-public   │   │ web-customer  │   │  web-admin    │
│  React · PWA  │   │ React · PWA   │   │  React · SPA  │
│  (port 3004)  │   │ (port 3005)   │   │ (port 3002)   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │   REST            │   REST            │   REST
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        RALabs.Api  (ASP.NET Core)                    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│  │  Core Services    │ │  AI Agent Layer   │ │  MCP Server      │     │
│  │  ──────────────── │ │  ──────────────── │ │  ──────────────── │     │
│  │  CMS / PageContent│ │  Chatbot agent    │ │  Tool definitions│     │
│  │  Portfolio/Team   │ │  Project agent    │ │  (thin layer over│     │
│  │  Client PRD       │ │  RAG retrieval    │ │   Application    │     │
│  │  Invoicing        │ │  GitHub sync job  │ │   services, auth │     │
│  │  Leads / Contacts │ │  Marketing agent  │ │   mirrors REST)  │     │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘     │
│           │                    │                    │               │
│           └────────────────────┼────────────────────┘               │
│                                ▼                                     │
│                    RALabs.Application                                │
│                   (single service layer)                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│  PostgreSQL      │ │  Qdrant       │ │  Integrations       │
│  ─────────────── │ │  ──────────── │ │  ────────────────── │
│  Projects, Team  │ │  vector store │ │  GitHub API (REST)  │
│  Leads, Threads  │ │  embeddings   │ │  Email / SMTP       │
│  ClientPrd, Docs │ │  semantic     │ │  LLM provider (TBD) │
│  Invoices, etc.  │ │  search (RAG) │ │                     │
└─────────────────┘ └───────────────┘ └─────────────────────┘
```

All containers run under Docker Compose: PostgreSQL, Qdrant, and the .NET API. React frontends are served via a development proxy during local work and built as static assets in production. MCP tool definitions live alongside REST controllers in `RALabs.Api` and delegate to the same Application-layer services — there is no second copy of business logic.

## Layering

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION                                            │
│  RALabs.Api — Controllers (REST) + MCP tool definitions  │
│  React frontends — web-public, web-customer, web-admin   │
├──────────────────────────────────────────────────────────┤
│  APPLICATION                                             │
│  RALabs.Application — use-case orchestration services    │
│  DTOs, validators, service interfaces                    │
│  Consumed by BOTH REST controllers AND MCP tools         │
├──────────────────────────────────────────────────────────┤
│  DOMAIN                                                  │
│  RALabs.Domain — entities, value objects, domain events  │
│  Business rules and invariants (no external deps)        │
├──────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                          │
│  RALabs.Infrastructure — EF Core DbContext, repositories │
│  Qdrant client, GitHub API client, email sender          │
│  Implements interfaces from Application and Domain       │
└──────────────────────────────────────────────────────────┘
```

**Project reference graph (confirmed against `.csproj` files):**

- `RALabs.Api` → `RALabs.Application`, `RALabs.Infrastructure`
- `RALabs.Application` → `RALabs.Domain`
- `RALabs.Infrastructure` → `RALabs.Application`
- `RALabs.Tests` → `RALabs.Application`

Domain depends on nothing. Infrastructure depends on Application (which depends on Domain), never the reverse. Api composes Application and Infrastructure through DI registration.

## Key Design Decisions
All architectural decisions are recorded in [DECISIONS.md](./DECISIONS.md). The following ADRs directly shape this architecture:

| ADR | Decision | Impact |
|-----|----------|--------|
| ADR-001 | PostgreSQL over SQL Server Express | Relational store choice; no Express 10GB/1GB limits |
| ADR-002 | MCP server as thin layer over Application services | REST and MCP share one code path; no duplicated logic |
| ADR-003 | Qdrant with customer_project_id hard filter at query layer | RAG retrieval isolation; tenant-boundary enforced by code, not prompt |
| ADR-004 | Dual sign-off is recorded confirmation (name + timestamp) | No external e-signature vendor at launch |
| ADR-005 | CustomerProject status workflow with timestamp gates | State machine enforced in domain; signed_at_customer + signed_at_admin gate prd_signed |

## Cross-Cutting Concerns

### Authentication and Authorization
- **JWT-based**, with three roles: `anonymous` (no token required for public endpoints), `customer`, `admin`.
- Authorization is enforced server-side on every request. MCP tool calls carry the same JWT and are subject to the same role checks as REST calls — no elevated access through the tool layer.
- Public endpoints (portfolio, team, content, lead capture, chatbot) are unauthenticated. Customer-scoped endpoints require `customer` role and filter results to the authenticated customer's own data. Admin endpoints require `admin` role.
- Password hashing uses a standard adaptive algorithm (bcrypt or ASP.NET Core Identity defaults).

### Rate Limiting
- Applied on the public contact form endpoint (`POST /api/leads`) and the public chatbot endpoint (`POST /api/chat/*/messages`) to prevent spam and abuse.
- Implemented as ASP.NET Core rate-limiting middleware, configured per-endpoint with a reasonable threshold (e.g. 5 submissions per IP per minute for contact form, 20 messages per IP per minute for chatbot).
- Authenticated endpoints are not rate-limited at launch but are logged for future tuning.

### Logging and Observability
- Structured logging (Serilog or ASP.NET Core default logging) with correlation IDs traced through every request.
- **Every `AgentTask` is logged** with type, status, payload summary, and timestamp — agent actions are auditable, not silent. This covers chatbot responses, GitHub sync runs, RAG ingestions, and project-agent messages.
- Scheduled jobs (GitHub sync, nightly re-index) log start, completion, and outcome.

### Error Handling
- Global exception middleware returns consistent error responses: a predictable JSON shape with `error.code`, `error.message`, and (in development) `error.details`.
- HTTP status codes follow standard semantics: 2xx success, 4xx client error (400 validation, 401 unauthorised, 403 forbidden, 404 not found), 5xx server error (500 internal, 503 service unavailable).
- AI model failures (chatbot, RAG retrieval) have defined fallbacks: chatbot falls back to lead-capture prompt; RAG retrieval falls back to "I don't have information on that" with manual-intervention flag.
- Internal implementation details (stack traces, database field names) never leak into error responses in non-development environments.

### Caching Strategy
- **PWA service worker**: cache-first for static assets and the app shell; network-first for API calls. The shell loads offline and displays a clear offline indicator for live-data sections.
- **Server-side**: no distributed cache at launch. EF Core change tracker and PostgreSQL query planning are the primary performance mechanisms. Future milestones may add output caching for public portfolio/team endpoints if load warrants it.
- **`web-customer` PWA**: caches thread history and documents locally so a customer can read existing project content offline. New messages queue and send once back online.

### PWA and Service Worker Strategy
- `web-public` and `web-customer` are Progressive Web Apps with web app manifests and service workers. `web-admin` is a standard authenticated SPA — offline installability is not a priority for the founders' internal tool.
- Service worker: `workbox`-based or hand-rolled, with a cache-first strategy for the app shell (HTML, CSS, JS, fonts, icons) and network-first for API calls.
- Lighthouse PWA checks must pass before each milestone ships.
- Manifest specifies app name, icons, theme color matching the `index.html` blueprint palette, and `display: standalone`.

## Data Flow

### Representative request 1: Visitor chatbot message → Lead created → Admin notified

```
Visitor types "build me a returns fraud copilot" in the public chatbot widget
        │
        ▼
POST /api/chat/{threadId}/messages  [anonymous, rate-limited]
        │
        ▼
RALabs.Api ChatController
  → delegates to ChatService (RALabs.Application)
        │
        ▼
ChatService:
  1. Retrieves RAG context from Qdrant (public KnowledgeChunks)
  2. Constructs prompt with retrieved chunks + system instructions
  3. Calls LLM provider for response
  4. Persists ChatMessage (sender_type: visitor, then agent)
  5. If visitor expresses purchase intent → creates Lead record
  6. Enqueues email notification for admin
        │
        ▼
Infrastructure:
  - QdrantClient performs vector search on public KnowledgeChunks
  - EF Core persists ChatMessage + Lead to PostgreSQL
  - EmailSender dispatches notification (SMTP or provider)
        │
        ▼
Admin receives email, logs into /admin/leads, sees the new lead
```

### Representative request 2: Customer RAG query with hard customer_project_id filter

```
Customer asks "what did we discuss about the authentication module?"
in their project thread
        │
        ▼
POST /api/chat/{threadId}/messages  [JWT: customer role]
        │
        ▼
RALabs.Api ChatController
  → extracts customer_id from JWT claims
  → delegates to ChatService.GetRagResponse(customerId, threadId, message)
        │
        ▼
ChatService:
  1. Loads CustomerProject to confirm thread belongs to this customer
  2. Queries Qdrant with HARD filter: customer_project_id = project.Id
     (NOT a prompt instruction — a Qdrant filter condition)
  3. Retrieved chunks are scoped to THIS customer's documents + thread history only
  4. Constructs prompt with filtered chunks
  5. Calls LLM provider
  6. Persists ChatMessage (sender_type: agent)
        │
        ▼
At no point does another customer's data enter the prompt or retrieval results.
The filter is applied before the vector similarity search runs, not after.
```

### Representative request 3: CustomerProject status transition (prd_draft → prd_signed)

```
Customer clicks "Sign PRD" on their project page
        │
        ▼
POST /api/customer-projects/{id}/prd/sign  [JWT: customer role]
        │
        ▼
RaLabs.Api ClientPrdController
  → delegates to ClientPrdService.Sign(id, userId, role)
        │
        ▼
ClientPrdService (Application layer):
  1. Loads ClientPrd aggregate from repository
  2. Validates current state: status must be prd_draft
  3. Sets signed_at_customer = UtcNow (for customer sign) or
     signed_at_admin = UtcNow (for admin sign)
  4. Domain logic: if BOTH timestamps are non-null → transition status to prd_signed
  5. Persists via repository
```

## Known Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **LLM provider for runtime chatbot unconfirmed** | Cannot finalize model client integration until provider is chosen (DeepSeek vs GPT-5.6 Luna vs separate provider). | Abstract behind an `ILLMProvider` interface in Infrastructure; swap implementation once confirmed. |
| **Email provider (SMTP vs transactional service) TBD** | Email sending implementation is placeholder until provider selected. | Abstract behind `IEmailSender` interface; default to SMTP stub for development. |
| **Brand name not settled** ("R&A Labs" is a placeholder) | All UI copy, manifests, and email templates use placeholder name. | Use environment variable / config value for brand name; single-point-of-change across all frontends and templates. |
| **E-signature is recorded confirmation (name + timestamp), not cryptographic** | If founders later require legally-binding e-signatures (DocuSign-style), the current confirmation model must be extended or replaced. | ADR-004 captures this as an intentional product scoping decision. The `ClientPrd` model stores confirmation metadata and can be extended without breaking the domain. |
| **African locale target unconfirmed** (assumed Swahili) | Locale data seed may need adjustment once confirmed. | Locale list is data-driven via `Locale` table; adding/changing a locale is a data operation, not a code change. |

## Standards Applied
This project follows these standards without exception:

| Standard | Applied to |
|----------|------------|
| `standards/architecture.md` | Module boundaries, layering, DI, documenting decisions |
| `standards/backend.md` | Repository pattern, validation at boundaries, background-job idempotency, structured logging |
| `standards/api.md` | REST resource naming, HTTP status codes, consistent error shape, explicit auth requirements, pagination |
| `standards/ai.md` | Model timeout/fallback, RAG retrieval grounding, structured-output validation, index sync with source of truth |
| `standards/database.md` | Migrations-only schema, FK enforcement, query parameterization, N+1 avoidance, sensitive-data identification |

No recorded exceptions to these standards at time of writing. Any future deviation must be logged as a decision in [DECISIONS.md](./DECISIONS.md) with a reason, per the architecture standard.

## Technologies and Versions
| Component | Technology | Version |
|-----------|-----------|---------|
| API runtime | ASP.NET Core | .NET 8.0 |
| ORM | Entity Framework Core | 8.x |
| Database | PostgreSQL | 16 (Docker) |
| Vector store | Qdrant | latest stable (Docker) |
| Frontend framework | React | 18.x |
| Service worker | Workbox or hand-rolled | — |
| E2E testing | Playwright | latest stable |
| Backend testing | xUnit | 2.5.x |
| Container runtime | Docker Compose | v2 |
