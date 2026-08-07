# DECISIONS: ra-labs

Architecture Decision Records for this project. One entry per decision. Never edit a past decision to reverse it; instead add a new entry that supersedes it and link back.

## Format

```
## ADR-<number> - <Title>
Date: <date>
Status: <proposed | accepted | superseded by ADR-N>
Owner: <agent>

### Context
What prompted this decision.

### Decision
What was decided.

### Alternatives Considered
Other options that were evaluated and why they were not chosen.

### Consequences
What this makes easier, what it makes harder, and any follow-up it requires.
```

## Records

## ADR-006 - SQL Server Express (Windows auth) over PostgreSQL — supersedes ADR-001
Date: 2026-08-07
Status: accepted (supersedes ADR-001)
Owner: solution-architect

### Context
ADR-001 chose PostgreSQL to avoid SQL Server Express's 10GB database cap and
1-core/1GB buffer-pool limit. At implementation time the owner directed that
the platform use the existing local SQL Server Express instance
(`RAJIB\SQLEXPRESS`) with Windows Authentication for day-to-day development,
and a containerized SQL Server (SA auth) for the Docker demo path — the same
dual pattern already proven on the PestFlow reference. This platform's launch
scale does not approach Express's limits.

### Decision
Use **SQL Server Express** as the database engine. Dev connection string:
`Server=RAJIB\SQLEXPRESS;Database=RALabsDb;Trusted_Connection=True;
TrustServerCertificate=True;MultipleActiveResultSets=True;` (Windows auth).
The Docker Compose demo path uses a containerized SQL Server 2022 with SQL
auth. EF Core SqlServer provider with migrations (ADR: migrations, not
`EnsureCreated`). An empty connection string falls back to the EF in-memory
provider for CI and zero-setup dev. ADR-001 is superseded.

### Consequences
- **Easier**: matches the owner's existing SQL Express + Windows auth
  tooling; no separate Postgres container for daily dev; in-memory fallback
  keeps CI/tests provider-agnostic.
- **Harder**: the 10GB / 1-core / 1GB limits apply if data grows
  unexpectedly; Windows-auth connection only works when the API runs on the
  Windows host (the Docker path must use SQL auth + a containerized server).
- **Follow-up**: keep the production deployment's SQL Server connection via
  `DB_*` env vars (RMEnterpriseCMS pattern) so the containerized path is
  first-class.



## ADR-001 - PostgreSQL over SQL Server Express
Date: 2026-08-06
Status: accepted
Owner: solution-architect

### Context
The v1 platform PRD (section 4) explicitly ruled out SQL Server Express. This platform accumulates data continuously across multiple dimensions: chatbot conversation history (every visitor message and every customer project thread), documents uploaded by customers, multi-language `PageContent` rows (English, Bengali, Hindi, plus 4+ planned expansion locales), and GitHub snapshot history for team profiles. SQL Server Express imposes a 10GB database size cap and limits the buffer pool to 1 core / 1GB of RAM, regardless of the host machine's hardware.

### Decision
Use **PostgreSQL** (self-hosted via Docker Compose, version 16 or later) as the primary relational database. EF Core with the Npgsql provider is the data access layer in `RALabs.Infrastructure`.

### Alternatives Considered
1. **SQL Server Express**: Rejected for the reasons above — the 10GB cap would be hit once chat history, document storage, and multi-language content accumulate. The 1-core/1GB buffer pool limit would degrade query performance on a machine that otherwise has headroom.
2. **Azure SQL Basic tier (DTU-based)**: Mentioned as an alternative in the PRD, but the founders' existing stack uses Docker Compose on a VPS, not Azure. Introducing an Azure dependency for the database alone would fracture the hosting model and add a recurring cost with no clear benefit over self-hosted PostgreSQL at this scale.
3. **SQLite**: Would work for development but concurrency limits make it unsuitable for a production web application with chat, agents, and multiple frontends hitting the API simultaneously.

### Consequences
- **Easier**: No arbitrary data cap; full use of host machine resources; consistent with the founders' existing Docker Compose stack; Npgsql provider is mature and well-documented.
- **Harder**: Slightly different SQL dialect from SQL Server (e.g. `LIMIT`/`OFFSET` vs `TOP`, `ILIKE` vs case-insensitive collation, UUID type handling). Migration tooling is EF Core's, which abstracts most of this.
- **Follow-up**: None required — this is a one-time platform choice.

---

## ADR-002 - MCP server is a thin tool-definition layer over Application services
Date: 2026-08-06
Status: accepted
Owner: solution-architect

### Context
Platform PRD v2 (section 3) requires that every API the platform exposes is callable as an MCP tool, serving React frontends, runtime AI agents, and the founders' OpenCode AI Workforce agents through one consistent interface. The risk is that MCP tool definitions end up re-implementing business logic, creating two code paths that diverge over time.

### Decision
The MCP server lives **inside `RALabs.Api`** as a thin tool-definition layer. Every MCP tool delegates to the same `RALabs.Application` service methods that the REST controllers call. There is no separate MCP service, no second copy of business logic, and no separate DI container or database connection. REST and MCP are two protocol front-ends over one shared application layer.

Concretely: a tool like `get_customer_project(id)` calls `ICustomerProjectService.GetByIdAsync(id)` — the exact same method the `CustomerProjectsController.Get(int id)` REST endpoint calls. Auth on MCP calls mirrors REST: role-scoped JWT tokens, no elevated access through the tool layer.

### Alternatives Considered
1. **Separate MCP microservice with its own application layer**: Rejected — duplicates business logic, creates two code paths to maintain and test, and increases the surface area for inconsistency between what REST returns and what MCP tools return.
2. **MCP tools built directly against Infrastructure/repositories, bypassing Application**: Rejected — skips validation, authorization checks, and business rules that the Application layer enforces. An MCP tool that calls the repository directly would bypass the domain invariant that a `ClientPrd` can only be signed when the project is in `prd_draft` status, for example.
3. **No MCP server — agents call REST endpoints directly**: Rejected — MCP tools provide structured tool definitions (names, descriptions, parameter schemas) that agents need for discovery and correct invocation. Raw REST calls require agents to know URL patterns, HTTP methods, and request body shapes, which is fragile.

### Consequences
- **Easier**: Single source of truth for all business logic; any bug fix or feature change in an Application service automatically applies to both REST and MCP callers. Testing effort is halved — test the Application service once, and both protocol layers are covered.
- **Harder**: The `RALabs.Api` project carries both REST controller and MCP tool definition responsibilities. Tool definitions must be kept in sync with any changes to Application service signatures. MCP tool descriptions must be maintained alongside the REST API documentation.
- **Follow-up**: MCP tool definitions must be co-located with their corresponding REST controllers in the `RALabs.Api` project structure, grouped by resource (e.g., `Controllers/ProjectsController.cs` and `Mcp/Tools/ProjectTools.cs` both live under a `Projects` area).

---

## ADR-003 - Qdrant vector store with customer_project_id hard filter at query layer
Date: 2026-08-06
Status: accepted
Owner: solution-architect

### Context
Platform PRD v2 (section 2) introduces RAG-powered chat for both the public chatbot and the per-project customer agent. Public content (portfolio, team, process copy) is available to all visitors. Per-project content (customer documents, thread history, sketches) must be **strictly scoped** to the owning customer — a project agent must never retrieve chunks from another customer's project. The platform PRD v2 explicitly states: "This is a hard filter at the query layer, not a prompt instruction."

### Decision
Use **Qdrant** as the vector store, self-hosted via Docker Compose — the same technology already proven on the founders' LexVault project. Retrieval queries enforce a **hard `customer_project_id` filter** as a Qdrant filter condition, applied before the vector similarity search executes. The `customer_project_id` is never included in the prompt as an instruction to the LLM to "only use relevant documents" — it is a query-level tenant isolation mechanism.

For public content, `customer_project_id` is `null`, and queries without a filter return public chunks only. For customer-scoped queries, the filter `customer_project_id = <uuid>` is always present, and there is no code path that allows a customer-scoped query to run without it.

### Alternatives Considered
1. **Prompt-level filtering ("only answer from documents belonging to this customer")**: Rejected — prompts can be ignored, overridden by jailbreak attempts, or simply not respected by the model. This is a security boundary, not a relevance hint.
2. **Separate Qdrant collections per customer**: Rejected — creates N collections to manage (schema changes, re-indexing, connection pooling). Qdrant's native filter support achieves the same isolation within a single collection without the operational overhead.
3. **PostgreSQL with pgvector instead of Qdrant**: Rejected — while pgvector is viable for smaller datasets, Qdrant is purpose-built for vector search with better performance at scale, has already been proven on LexVault, and is a trivial addition to the Docker Compose stack (one extra container).

### Consequences
- **Easier**: Tenant isolation is enforced by the infrastructure, not by prompt engineering — a code bug that forgets the filter returns no results rather than leaking data. Single Qdrant collection means a single index to maintain and re-index on schedule.
- **Harder**: Every code path that queries Qdrant must supply the filter correctly. A new query added by an engineer who doesn't know this rule could accidentally skip the filter. Mitigation: the retrieval service method signature requires `customerProjectId` as a non-nullable parameter for customer-scoped calls, making it impossible to forget at the type level.
- **Follow-up**: The `KnowledgeChunk` entity's `customer_project_id` field must be indexed in Qdrant as a filterable payload field. Ingestion jobs must correctly set `customer_project_id` for every chunk derived from customer-scoped sources.

---

## ADR-004 - Dual sign-off on ClientPrd is a recorded confirmation, not cryptographic e-signature
Date: 2026-08-06
Status: accepted
Owner: solution-architect

### Context
The platform PRD (section 6.7) specifies that both the customer and an admin must independently sign off on the client PRD before the project can transition to `prd_signed` status. The sign-off gates the status transition: both `signed_at_customer` and `signed_at_admin` timestamps must be non-null. The PRD explicitly states: "Signing is a recorded confirmation (name + timestamp), not a full cryptographic e-signature product at launch."

### Decision
The dual sign-off is implemented as a **recorded confirmation**: when a customer clicks "Sign PRD," the system records the authenticated user's name and a `signed_at_customer` timestamp. The same applies for the admin with `signed_at_admin`. There is no integration with an external e-signature vendor (e.g., DocuSign, HelloSign), no cryptographic signature, no audit trail beyond the timestamp, and no legal-weight document sealing.

The `ClientPrd` domain model stores both fields and enforces the invariant: status transitions to `prd_signed` only when both timestamps are set.

### Alternatives Considered
1. **Full cryptographic e-signature integration (DocuSign/HelloSign/Adobe Sign)**: Rejected at launch — adds vendor dependency, recurring cost, integration complexity, and compliance surface that is not currently required. The founders have not confirmed they need legally-binding e-signatures.
2. **Single sign-off (admin-only)**: Rejected — the dual sign-off is a core workflow requirement: the customer must explicitly confirm they agree with the PRD before work starts. Admin-only sign-off would miss the customer buy-in step.
3. **Sign-off via email link (click to confirm)**: Rejected — adds complexity (email delivery, link expiry, replay protection) for no meaningful gain over an in-app button behind JWT auth. The customer is already authenticated when they sign.

### Consequences
- **Easier**: No external vendor dependency, no recurring cost, no compliance audit overhead. The sign-off is a simple state transition in the domain model, testable with unit tests without mocking a third-party API.
- **Harder**: If the founders later require legally-binding e-signatures, this confirmation model must either be extended (add a `SignatureProvider` field and vendor integration alongside the existing timestamps) or replaced. The `ClientPrd` model is designed with the timestamps as nullable fields, so adding a vendor-provided signature ID later is a non-breaking schema change.
- **Follow-up**: Flag to founders if a client or legal advisor demands a cryptographically verifiable signature. The `ClientPrd` entity should reserve a nullable `ExternalSignatureId` column in the initial migration to avoid a schema migration if e-signature integration is added later.

---

## ADR-005 - CustomerProject status is a constrained enumerated workflow with timestamp gates
Date: 2026-08-06
Status: accepted
Owner: solution-architect

### Context
The platform PRD (section 6.6) defines a linear status workflow for customer projects: `intake` → `prd_draft` → `prd_signed` → `in_build` → `demo` → `delivered` → `closed`. The `prd_signed` transition specifically requires both customer and admin sign-off timestamps (see ADR-004). Without explicit constraints, status could be set to any value at any time, bypassing the workflow.

### Decision
`CustomerProject.Status` is a **constrained enumerated type** (enum or value object backed by a string column) with exactly these values in order: `intake`, `prd_draft`, `prd_signed`, `in_build`, `demo`, `delivered`, `closed`. Transitions are gated by domain logic:

- `intake` → `prd_draft`: Requires a `ClientPrd` record to exist (admin has drafted the PRD).
- `prd_draft` → `prd_signed`: Requires both `signed_at_customer` AND `signed_at_admin` to be non-null on the associated `ClientPrd`.
- `prd_signed` → `in_build`: Automatic or admin-triggered once signed.
- `in_build` → `demo`: Requires a `Demo` record to exist.
- `demo` → `delivered`: Admin action; customer feedback becomes available on this transition.
- `delivered` → `closed`: Requires `Feedback` to exist; triggers portfolio feedback loop.

The status enumeration and transition rules live in `RALabs.Domain` as domain logic, not in the controller or application layer as a validation check.

### Alternatives Considered
1. **Free-text status string**: Rejected — no way to enforce workflow, no way to query "all projects in build," and no way to gate transitions on business rules.
2. **Separate status table with allowed transitions**: Rejected — over-engineered for a linear workflow. A state machine table adds schema complexity (status table, transition table, join logic) for a workflow that has exactly one forward path per status. The enum with domain validation handles this cleanly.
3. **Workflow engine (e.g., Elsa, Workflow Core)**: Rejected — adds a library dependency and learning curve for a linear, seven-state workflow. If the workflow later grows to branching paths, parallel approvals, or SLA timers, a workflow engine can be introduced behind the same domain interface.

### Consequences
- **Easier**: Status transitions are explicit and auditable — every status change can be logged with who triggered it, when, and what gate was satisfied. Querying by status is a simple enum comparison. The domain layer protects invariants (e.g., cannot set `prd_signed` without both timestamps) regardless of how the object is constructed or called.
- **Harder**: Adding a new status or a non-linear transition path requires a code change to the domain enum and transition logic, plus a migration if the enum is stored as a string. The linear constraint means a project cannot skip states (e.g., jump from `intake` directly to `in_build`) — this is intentional but could be inconvenient for a project that starts with an externally-written PRD.
- **Follow-up**: The `CustomerProject` domain entity must expose a `TransitionTo(CustomerProjectStatus target)` method (or individual `MoveToPrdDraft()`, `Sign()`, etc.) rather than a public setter on the `Status` property. This ensures the gate logic cannot be bypassed by setting the property directly.
