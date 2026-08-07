# Project brief — for the OpenCode AI Workforce

Project: R&A Labs platform (working name — see naming note in chat; not yet final)
Root: `/mnt/e/rajibmahata/ra-labs`
Reference docs (copy into `docs/prd/` and `docs/design/` before starting):
`platform-prd.md`, `platform-prd-v2.md`, `phase-1-spec.md`, `index.html`, `wireframes.html`

This is a new project, not a change to something already running — so the
"validate before changing, don't break what works" standing rule applies from
M2 onward (once M1 exists to build on top of), not to the initial scaffold.

## What to build

Read `platform-prd.md` for the full feature set and `platform-prd-v2.md` for
the PWA / RAG chat / MCP server requirements — those three apply from M1
onward, not as a later add-on. `wireframes.html` is the structural reference
for every screen; `index.html` is the visual language reference for the
public site (apply the same direction to the customer portal and, more
lightly, the admin CMS).

## Milestone → agent role mapping

Map these to whichever of the 27 workforce agents fit — this brief doesn't
assume specific agent names since the roster isn't in this doc.

| Role | Responsible for |
|---|---|
| Architecture/planning agent | Confirms the M1–M5 breakdown, flags scope risk before a milestone starts |
| Backend/API agent | `RALabs.Api` / `.Application` / `.Domain` / `.Infrastructure`, EF Core + Postgres, MCP tool definitions over the same service layer |
| Frontend agent — public | `web-public`: home, portfolio, team, contact, PWA shell |
| Frontend agent — customer | `web-customer`: auth, project thread, documents, client PRD view, PWA + offline queue |
| Frontend agent — admin | `web-admin`: dashboard, portfolio/team/content CRUD, leads inbox |
| AI/RAG agent | Qdrant ingestion pipeline, chatbot + project agent retrieval, the deterministic-fields guardrail described in v2 section 2 |
| QA agent | `dotnet test` for backend, Playwright for UI regression — same tooling already wired up for PestFlow |
| Docs/reporting agent | Writes to `docs/reviews/`, `docs/learning/`, `docs/reports/` per task, same convention as PestFlow |

## Definition of done, per milestone

- M1: public site live locally via Docker Compose, portfolio/team CRUD works
  from the admin CMS, GitHub sync job populates real snapshot data, contact
  form and chatbot both create `Lead` records, MCP tools exist for all M1
  endpoints, `web-public` passes a Lighthouse PWA check
- M2: customer can register, open a project thread, upload a document, and
  see it reflected in the admin view; per-project RAG ingestion filters
  correctly by `customer_project_id` (verify with two test customers, confirm
  no cross-contamination)
- M3: client PRD can be drafted, edited, and signed by both parties; agent
  drafting pulls only from RAG + structured fields, never invents numbers
- M4: demo record and invoice both attach to a project; closing a project
  prompts for feedback and, once approved, creates a public `Project` entry
- M5: as scoped in `platform-prd.md` section 11

## Standing rules carried over from the shared workforce config

- Validate against what already exists before changing it, once there's
  something to validate against
- Log implementation progress step by step in `docs/reports/`, not just at
  the end of a milestone
- Keep the design professional throughout — this is a portfolio piece for an
  engineering studio, so sloppy execution undercuts the pitch it's making

## Note on session/token usage

Given the DeepSeek token-usage problem already seen on PestFlow (high spend,
little proportional progress), scope each OpenCode session to one deliverable
from the definition-of-done list above, not "build M1." Consider reserving
the larger-context provider (GPT-5.6 Luna) for the architecture/planning and
AI/RAG agent work, where the wider PRD context matters most, and keeping the
narrower implementation tasks (a single CRUD endpoint, a single component) on
DeepSeek where the cheaper cost matters more than context size.

## Open items to resolve before or during M1

Everything listed in `platform-prd.md` section 12 and `platform-prd-v2.md`
section 7 — brand name, Abhishek's role/bio, email provider, e-signature
requirement, locale set, and which LLM serves the runtime chatbot.
