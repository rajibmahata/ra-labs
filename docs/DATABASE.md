# DATABASE: ra-labs

## Engine

**SQL Server**, using the EF Core SqlServer provider. Local development uses
the owner-configured SQL Server Express instance with Windows authentication;
Docker deployments use a containerized SQL Server instance.

The SQL Server choice is recorded in ADR-006 and supersedes the earlier
PostgreSQL proposal in ADR-001. The implementation and deployment configuration
must remain aligned with the EF Core SqlServer provider and the repository's
owner-confirmed database decision.

**Vector data lives separately:** embeddings and vector similarity search are
handled by a Qdrant vector store (self-hosted via Docker Compose, consistent
with LexVault). The `KnowledgeChunk` table in SQL Server stores the metadata and
source mapping; the actual `embedding_vector` is generated and indexed in
Qdrant. See platform PRD v2 section 2 for the dual-pipeline design.

## Schema Overview

All entities below are defined in the platform PRD section 7 and PRD v2
section 2. Detailed column definitions, constraints, and types live in EF Core
migrations under `backend/RALabs.Infrastructure` — this section documents the
intent, relationships, and non-obvious design choices, not every column.

### Core entities (Milestone 1)

| Entity | Purpose | Key relationships |
|---|---|---|
| `Project` | Public portfolio entry (manual or auto-published from a delivered `CustomerProject`) | None directly; auto-created from `CustomerProject` + `Feedback` at M4 |
| `TeamMember` | Studio founder/contributor profile | 1:N → `GithubSnapshot` |
| `GithubSnapshot` | Periodic GitHub activity snapshot per team member (commits, repos, last commit) | N:1 → `TeamMember`; queried by `team_member_id` + `captured_at` |
| `Locale` | Supported language code and label (en, bn, hi at launch) | Referenced by `PageContent` and `KnowledgeChunk` |
| `PageContent` | Key-value CMS content per locale for all public site copy | Unique on `(key, locale)` |
| `Lead` | Captured visitor interest (form or chatbot) | Standalone; converted into a `Customer` + `CustomerProject` by admin |
| `ChatThread` | A conversation thread, typed as `lead` (pre-conversion) or `customer_project` (post-conversion) | 1:N → `ChatMessage`; `customer_project_id` nullable for lead threads |
| `ChatMessage` | Single message within a thread | N:1 → `ChatThread` |
| `AgentTask` | Audit log of every AI agent action | Standalone; referenced by type and status for monitoring |

### Customer-facing entities (Milestones 2–4)

| Entity | Purpose | Key relationships |
|---|---|---|
| `Customer` | Registered customer account | 1:N → `CustomerProject` |
| `CustomerProject` | A single client engagement; the hub entity for all customer-side data | N:1 → `Customer`; 1:N → `ChatThread`, `Document`, `ClientPrd`, `Demo`, `Invoice`, `Feedback` |
| `Document` | Uploaded requirement doc, sketch, or reference file scoped to a project | N:1 → `CustomerProject` |
| `ClientPrd` | The "client PRD" deliverable — drafted by admin+agent, reviewed and signed by both parties | N:1 → `CustomerProject` |
| `Demo` | Screenshot or URL deliverable shown to the customer | N:1 → `CustomerProject` |
| `Invoice` | Per-project invoice record (cash-only at launch) | N:1 → `CustomerProject` |
| `Feedback` | Customer rating, comment, and publish consent on project close | N:1 → `CustomerProject` |

### RAG / knowledge entity (PRD v2 section 2)

| Entity | Purpose | Key fields & relationships |
|---|---|---|
| `KnowledgeChunk` | Metadata record for each chunk of text ingested into the RAG pipeline. The embedding vector lives in Qdrant; this table stores the source mapping and chunk text. | `source_type` enum: `public_content`, `customer_document`, `thread_message`; `source_id` (FK to the originating row, polymorphic); `customer_project_id` nullable — `NULL` for public content, set for customer-scoped chunks; `locale`; `chunk_text`; `embedding_vector` (stored in Qdrant, not queried in Postgres); `created_at` |

### Relationship summary

```
Customer 1──N CustomerProject 1──N ChatThread 1──N ChatMessage
                             1──N Document
                             1──N ClientPrd
                             1──N Demo
                             1──N Invoice
                             1──N Feedback

TeamMember 1──N GithubSnapshot

ChatThread (lead type) → Lead (converted into) → Customer + CustomerProject

KnowledgeChunk → polymorphic source (public content, customer document, or thread message)
               → customer_project_id (nullable) for RAG isolation
```

### Status enums

- **Lead status:** `new`, `contacted`, `converted`, `closed`
- **CustomerProject status:** `intake` → `prd_draft` → `prd_signed` → `in_build` → `demo` → `delivered` → `closed`
- **Invoice status:** `unpaid`, `paid_cash`
- **ChatMessage sender_type:** `visitor`, `customer`, `admin`, `agent`
- **ChatThread type:** `lead`, `customer_project`
- **KnowledgeChunk source_type:** `public_content`, `customer_document`, `thread_message`
- **AgentTask status:** `pending`, `running`, `completed`, `failed`

## Migration Strategy

**Tooling:** EF Core Migrations, authored and applied through the
`RALabs.Infrastructure` project. Every migration is a C# class in
`backend/RALabs.Infrastructure/Migrations/`.

**Authoring workflow:**

1. Schema change originates from a feature requirement in the PRD or a
   deliberate refactoring.
2. Database Engineer authors the migration (`dotnet ef migrations add
   <DescriptiveName>`) in a feature branch.
3. The migration is reviewed alongside the corresponding application code.
   Breaking schema changes without corresponding API or application changes
   in the same PR are rejected.
4. Every `Up()` has a tested `Down()` — rollback is exercised in the same
   branch, not assumed to work.

**Per-environment application:**

| Environment | How migrations are applied | When |
|---|---|---|
| Dev (local Docker Compose) | `dotnet ef database update` on startup or as a manual step during development | On every branch switch or schema change |
| Staging | Applied by the CI pipeline as a pre-deploy step | Before the new API container starts |
| Production | Applied by the release pipeline with an explicit confirmation gate; large-table migrations are scheduled outside business hours or use a batching strategy | As part of the release workflow |

**Milestone boundaries:** each milestone (M1–M5) ships its own migration or
set of migrations. No milestone migration is applied to an environment that
hasn't yet been promoted to that milestone's feature set. This keeps the
schema in sync with the deployed application version.

**Zero-downtime guidelines:**

- Additive changes (new table, new nullable column, new index) are safe to
  apply before the application code deploys.
- Destructive changes (drop column, rename column, change column type) must
  follow a two-release cycle: first release adds the replacement and marks
  the old column as deprecated, second release removes it after confirming
  no code path still references it.
- Index creation on large tables should be planned and tested for SQL Server
  locking behavior; use an online index option where the deployment tier
  supports it rather than assuming PostgreSQL's `CREATE INDEX CONCURRENTLY`.

## Indexing Notes

Indexes below are justified by actual query patterns specified in the PRD and
API surface (platform PRD section 9). No speculative indexes are added.

| Table | Index / Constraint | Reason |
|---|---|---|
| `KnowledgeChunk` | Composite index on `(customer_project_id, source_type)` | **Critical.** RAG retrieval for customer content scopes queries by `customer_project_id` as a hard filter at the query layer (PRD v2 section 2). Without this index, Qdrant lookup post-filtering and Postgres metadata queries degrade linearly with chunk volume. Including `source_type` supports the common query pattern of "all chunks of type X for project Y." |
| `ChatMessage` | Composite index on `(thread_id, created_at)` | Every chat view — public chatbot, customer project thread, admin thread viewer — fetches messages ordered by `created_at` within a `thread_id`. This index prevents full scans as threads grow long. |
| `Lead` | Index on `(status)` | The admin leads inbox (`/leads`) filters by status (`new`, `contacted`, `closed`). Without this index, every inbox load scans the full `Lead` table. |
| `PageContent` | Unique constraint on `(key, locale)` | Content lookup for any public page: `SELECT value FROM PageContent WHERE key = @key AND locale = @locale`. The unique constraint also prevents duplicate content entries for the same key+locale pair. |
| `GithubSnapshot` | Composite index on `(team_member_id, captured_at)` | Team profile pages show the latest snapshot for each member: `ORDER BY captured_at DESC LIMIT 1 WHERE team_member_id = @id`. The composite index covers both the filter and the sort. |
| `ChatThread` | Index on `(type, customer_project_id)` where `customer_project_id IS NOT NULL` | When navigating from a `CustomerProject` to its thread, or when listing all lead threads vs. project threads. A partial index filters nulls for lead-type threads. |
| `Customer` | Unique constraint on `(email)` | Auth flow (login, register, invite) needs fast email-based lookups; duplicate emails are rejected at the database level. |
| `AgentTask` | Index on `(type, status, created_at DESC)` | Admin monitoring queries for failed or pending agent tasks, grouped by type, sorted newest-first. |
| `Feedback` | Index on `(customer_project_id)` where `is_published = true` | Query for publishable feedback to surface on the public portfolio (M4 feedback loop). |

**When to add more indexes:**

- Only when a specific query (identified in a code review or performance
  test) shows a sequential scan on a table expected to grow beyond trivial
  size.
- Each new index must cite the query it serves in the commit message and
  update this table.

## Data Retention

**At launch (M1–M4):** no automated retention or deletion policy. Chat
history, documents, `GithubSnapshot` records, and `AgentTask` logs accumulate
by design — the platform's value grows as conversation and project history
build up over time.

**When a retention strategy is needed (M5+):**

- `GithubSnapshot` rows older than 1 year can be pruned or down-sampled
  (keep monthly aggregates) — the homepage status bar only needs the latest
  snapshot, and historical detail belongs in an analytics pipeline.
- `AgentTask` rows older than 90 days can be archived to cold storage; only
  recent failures and the audit trail for active projects need fast lookup.
- Chat history and documents are the platform's core asset — no deletion
  without a customer-facing data export and consent mechanism, which is a
  future feature.

**PII and sensitive fields:** per platform PRD section 10 (non-functional
requirements) and the Security Engineer's standards, `Customer.email` and
`Lead.contact_info` are sensitive. At rest, these should be encrypted at the
application layer or rely on PostgreSQL column-level encryption if required
by a future compliance need. At launch, database access is restricted to the
API tier within the Docker Compose network — no direct database access from
the public internet.
