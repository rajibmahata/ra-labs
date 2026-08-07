# R&A Labs Platform — PRD v2

Status: supersedes `platform-prd.md` (v1) on architecture and infrastructure.
Feature scope in v1 sections 6.1–6.11, personas (section 3), and the base data
model (section 7) still apply — this document adds three cross-cutting
requirements that change how those features are built, not what they do.
Companion files: `platform-prd.md` (v1, full feature detail), `wireframes.html`
(updated architecture diagram + all screen sketches), `index.html` (visual
reference).

## What's new in v2

1. **Progressive Web App** — `web-public` and `web-customer` are installable
   and work offline for previously-loaded content
2. **RAG-powered AI agent chat** — the chatbot and project agents answer from
   the studio's own project/team/process content and a customer's own project
   documents, not just static prompts
3. **MCP server** — every API the platform exposes is also callable as an MCP
   tool, so the same endpoints serve the React frontends, the runtime AI
   agents, and the founders' own OpenCode AI Workforce agents through one
   consistent interface

These apply from M1 onward — they're foundational, not a later phase.

---

## 1. Progressive Web App

Applies to `web-public` and `web-customer`. `web-admin` stays a standard
authenticated web app (installability isn't a priority for an internal tool).

- Web app manifest (name, icons, theme color matching the `index.html` palette,
  `display: standalone`)
- Service worker: cache-first for static assets and the app shell, network-first
  for API calls, so the shell loads offline and shows a clear "you're offline"
  state for anything that needs live data
- `web-customer` specifically: a customer who's mid-conversation on a project
  should be able to open the app offline and still read their existing thread,
  documents, and status — new messages queue and send once back online
- Installable on both desktop and mobile (Add to Home Screen)
- Lighthouse PWA checks pass before each milestone ships

## 2. RAG-powered AI agent chat

Reuses the dual-pipeline pattern from the founders' own LexVault project:
semantic retrieval (vector search) paired with deterministic rules for anything
that must be exact rather than "close enough."

**What gets ingested:**
- Public content: portfolio project descriptions, team bios, process copy, FAQ
  content — chunked and embedded so the public chatbot (6.5 in v1) can answer
  specific visitor questions instead of just capturing a lead
- Per-project content, scoped to that customer only: uploaded documents,
  sketches (via OCR/caption if image-based), and the thread history — so the
  project agent (6.6 in v1) can answer "what did we already say about X" or
  help draft the client PRD from what's actually been discussed, instead of
  re-asking the customer

**Deterministic layer:** anything transactional — quote figures, timelines,
contractual language in the client PRD — is never left to retrieval alone.
The agent either pulls it from a structured field (the `ClientPrd` or
`Invoice` record itself) or flags for manual intervention, same as the
existing escalation pattern in v1 section 6.5/6.6.

**Stack:**
- Qdrant for vector storage, self-hosted via Docker Compose — consistent with
  the existing VPS/Docker Compose hosting setup, and the same vector DB choice
  already proven on LexVault
- Embeddings generated on ingest (new document, new portfolio entry, new
  chat message) and on a nightly re-index for content edited outside the
  normal flow

**Data model addition:**

| Entity | Key fields |
|---|---|
| `KnowledgeChunk` | id, source_type (`public_content` / `customer_document` / `thread_message`), source_id, customer_project_id (nullable — null for public content), locale, chunk_text, embedding_vector, created_at |

Retrieval always filters by `customer_project_id` for anything scoped to a
customer — a project agent must never retrieve another customer's chunks.
This is a hard filter at the query layer, not a prompt instruction.

## 3. MCP server

All platform APIs (portfolio, team, leads, chat, customer projects, documents,
client PRD, demos, invoices, feedback — full list in v1 section 9) are exposed
two ways from the same underlying service layer:

- REST, for the React frontends
- MCP tools, for agents — both the runtime chatbot/project agents (which call
  their own platform's data through MCP rather than a separate internal
  client) and, more directly useful day to day, the founders' own OpenCode AI
  Workforce agents, which can then inspect and act on the live platform the
  same way they work on any other project

Practically: the MCP server is a thin tool-definition layer over the existing
Application-layer services (not a second copy of the business logic), so a
tool like `get_customer_project(id)` or `list_unpublished_leads()` calls the
same code path the REST controller calls. Auth on MCP calls mirrors REST —
role-scoped tokens, no elevated access via the tool layer.

## 4. Updated architecture

See the diagram in `wireframes.html` (architecture section) — the API tier now
shows three modules side by side (Core services, AI agent layer, MCP server),
and the data tier adds the Qdrant vector store next to the primary database.

## 5. Updated milestones

| Milestone | Adds |
|---|---|
| M1 | Public site, portfolio, team + GitHub sync, contact/chatbot lead capture, admin CMS — **plus** PWA shell for `web-public`, MCP server wrapping the M1 endpoints, and RAG ingestion for public content |
| M2 | Customer accounts, project threads, chat, document upload — **plus** PWA for `web-customer`, per-project RAG ingestion (documents + thread history), MCP tools for the new endpoints |
| M3 | Client PRD workflow — **plus** the project agent drafts from RAG context, deterministic fields still gate what the agent can state as fact |
| M4 | Demo delivery, invoicing, feedback loop |
| M5 | Marketing agent, voice chatbot input, expanded language set |

## 6. Implementation sequence for the new cross-cutting pieces

1. Stand up the MCP server alongside the existing API project, wrapping the M1
   Application-layer services first
2. Add the Qdrant container to the Docker Compose stack; build the ingestion
   job for public content (portfolio, team, process copy)
3. Wire the public chatbot to retrieve from the public `KnowledgeChunk` set
   before falling back to lead capture
4. Add the PWA manifest + service worker to `web-public`; verify installability
   and offline shell behavior
5. Repeat ingestion + MCP wiring for customer-scoped content once M2 lands,
   with the `customer_project_id` filter enforced at the query layer
6. Add PWA support to `web-customer`, including the offline-queued message
   behavior described in section 1

## 7. Open questions carried over / added

- Which LLM serves the runtime chatbot and project agents at inference time —
  the workforce already has DeepSeek and GPT-5.6 Luna configured as providers
  for the dev-agent side; whether the customer-facing agent reuses one of
  these or uses a separate provider is unconfirmed
- Everything listed in v1 section 12 (brand name, Abhishek's bio, email
  provider, e-signature requirement, African locale choice) still stands
