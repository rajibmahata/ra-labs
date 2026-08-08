# PRE-FIX IMPLEMENTATION AUDIT — ra-labs

Date: 2026-08-08
Author: Principal Engineer / Product Engineering Lead
Scope: full repository, verified against `docs/design/wireframes.html`,
`docs/design/index-v2.html`, the PRDs, and the ADRs.
Status: baseline captured BEFORE the production-fix pass began.

Legend: IMPLEMENTED · PARTIALLY_IMPLEMENTED · MISSING · BROKEN · INCORRECT ·
TECHNICAL_DEBT · UNKNOWN

Severity: P0 = critical/broken/security · P1 = core functionality ·
P2 = major UX/design · P3 = enhancement/optimization

---

## 1. Design fidelity

| Item | Class | Severity | Notes |
|---|---|---|---|
| Global palette | INCORRECT | P0 | Current `web-public` uses dark blueprint (`#0a0f1a`, `#00d4a8`, Fraunces/DM Sans). index-v2.html mandates light cream `#FAF6EF`, emerald `#1F5C46`/`#123A2C`, brass `#B8863B`/`#E9D6AE`, Newsreader+Inter+IBM Plex Mono. |
| Typography scale | INCORRECT | P0 | Reference: Newsreader serif headings, Inter body, IBM Plex Mono for stats/mono labels. Current: Fraunces + DM Sans. |
| Header/wordmark | PARTIALLY_IMPLEMENTED | P1 | Reference wordmark "R&A *Labs*" (italic emerald) + nav + live badge. Current nav exists but not the exact mark/badge treatment. |
| Hero | PARTIALLY_IMPLEMENTED | P1 | Reference: eyebrow + serif H1 with brass highlight span + lede + dual CTA + layered gradient art. Current Hero differs in copy shape and art. |
| Process (5 steps) | PARTIALLY_IMPLEMENTED | P1 | Reference has dashed connector line + numbered circles. Current Process exists but styling differs. |
| Portfolio cards | INCORRECT | P0 | Reference: gradient cover (g1/g2/g3), status label, title, description, tags, meta row (build time + github). Current ProjectCard: dark gradient palette, no build-time meta. |
| Team cards | PARTIALLY_IMPLEMENTED | P1 | Reference: initials avatar gradient, name, brass role, mono stats (commits/active repos/last commit). Current TeamCard differs. |
| Contact panel | PARTIALLY_IMPLEMENTED | P1 | Reference: emerald gradient panel + brass on-dark CTA. Current exists but dark theme. |
| Footer | PARTIALLY_IMPLEMENTED | P1 | Reference: "© 2026 R&A Labs" + mono "built by the studio it describes". |
| Responsive breakpoints | PARTIALLY_IMPLEMENTED | P1 | Reference collapses at 820px. Current uses own breakpoints. |
| `prefers-reduced-motion` | IMPLEMENTED | P3 | Present. |
| Focus-visible | IMPLEMENTED | P3 | Emerald outline in reference; current has its own. |

## 2. Wireframe functional contract

| Item | Class | Severity | Notes |
|---|---|---|---|
| Public home regions (nav/hero/process/work/team/contact) | PARTIALLY_IMPLEMENTED | P1 | Structure present; fidelity differs. |
| Portfolio detail page | IMPLEMENTED | P3 | `/work/:slug` present. |
| Admin dashboard (stats + activity table) | PARTIALLY_IMPLEMENTED | P1 | Sidebar + stat cards exist; Projects entry absent. |
| Admin add/edit project | IMPLEMENTED | P2 | Portfolio CRUD present. |
| Admin add/edit team member (+ snapshot read-only) | IMPLEMENTED | P2 | Present incl. snapshot. |
| Admin leads inbox + thread preview + convert | PARTIALLY_IMPLEMENTED | P1 | Leads list present; convert-to-customer and thread preview not wired. |
| Customer portal (register/login/dashboard/project/chat/docs/PRD/approval/demo/invoice/feedback) | MISSING | P0 | No `web-customer`, no customer API. |

## 3. Architecture

| Item | Class | Severity | Notes |
|---|---|---|---|
| 4-layer clean architecture | IMPLEMENTED | P3 | Api/Application/Domain/Infrastructure. |
| Repository pattern | IMPLEMENTED | P3 | Present. |
| State machine (ADR-005) | PARTIALLY_IMPLEMENTED | P1 | `CustomerProjectStateMachine` exists but no service enforces it (no customer workflow). |
| MCP thin layer (ADR-002) | IMPLEMENTED | P3 | 29 tools. |
| CQRS | NOT_APPLICABLE | P3 | Not required; services are use-case orchestrators. |
| DI composition root | IMPLEMENTED | P3 | Present. |

## 4. Backend / API

| Item | Class | Severity | Notes |
|---|---|---|---|
| Admin REST auth | INCORRECT | P0 | Admin group uses `RequireAuthorization()` only; no `RequireRole("admin")`. Any authenticated token passes. |
| JWT sub claim | IMPLEMENTED | P3 | `MapInboundClaims=false` fixed. |
| Password reset / forgot-password | MISSING | P0 | No flow at all. |
| Refresh token exchange | MISSING | P1 | Login returns a refresh token but no endpoint consumes it. |
| Customer register/login | MISSING | P0 | Admin-only auth. |
| Customer workflow endpoints | MISSING | P0 | projects/chat/docs/PRD/demo/invoice/feedback all absent. |
| Validation envelope | IMPLEMENTED | P3 | Guard + middleware → `{error:{code,message}}`. |
| Rate limiting | PARTIALLY_IMPLEMENTED | P1 | contact/chat/auth; reset/login endpoints not covered. |
| Pagination | PARTIALLY_IMPLEMENTED | P1 | Projects/leads/threads paginated; admin lists not. |
| N+1 queries | BROKEN | P1 | `TeamService` fetches latest snapshot per member (N+1). |
| Lead → customer conversion | MISSING | P1 | Not implemented. |

## 5. Database

| Item | Class | Severity | Notes |
|---|---|---|---|
| EF Core SqlServer migrations | IMPLEMENTED | P3 | Present (ADR-006). |
| Customer entities (M2–M4) | IMPLEMENTED | P3 | Domain entities exist. |
| Customer repositories | MISSING | P1 | None. |
| Indexes | PARTIALLY_IMPLEMENTED | P3 | Some composite indexes; customer tables none. |
| Seed data | PARTIALLY_IMPLEMENTED | P2 | 11 locales, 2 team, 10 projects, en content only; other locales empty. |

## 6. AI / RAG / Chatbot

| Item | Class | Severity | Notes |
|---|---|---|---|
| Chatbot retrieval | PARTIALLY_IMPLEMENTED | P1 | Keyword overlap; no punctuation normalization, no stemming, no stop-words, no conversation history. |
| BR-002 transactional guardrail | IMPLEMENTED | P3 | Manual-intervention flag. |
| Qdrant vector store | MISSING | P1 | Not wired; in-app chunk scoring only. |
| BR-001 customer isolation | MISSING | P1 | No customer chunks; no filter enforced. |
| No-leak guarantee | IMPLEMENTED | P3 | Public-only chunks; customer data not ingested. |
| Voice input | MISSING | P3 | M5 scope. |

## 7. Frontend

| Item | Class | Severity | Notes |
|---|---|---|---|
| web-public PWA | PARTIALLY_IMPLEMENTED | P1 | Manifest+SW present; theme wrong. |
| web-admin CMS | PARTIALLY_IMPLEMENTED | P1 | Missing Customers/Projects/PRD/Demo/Invoice/Feedback. |
| web-customer | MISSING | P0 | Empty dir. |
| Loading/empty/error states | PARTIALLY_IMPLEMENTED | P1 | Home has them; many admin pages partial. |
| i18n | PARTIALLY_IMPLEMENTED | P1 | 11 locales; en-only content; hardcoded UI strings; no SEO meta per locale. |
| Portal storage namespacing | IMPLEMENTED | P3 | `admin.*`, `ralabs-public.*`. |

## 8. Security

| Item | Class | Severity | Notes |
|---|---|---|---|
| Role enforcement on admin endpoints | BROKEN | P0 | `RequireRole("admin")` missing. |
| Password reset | MISSING | P0 | — |
| IDOR protection | PARTIALLY_IMPLEMENTED | P1 | No customer routes yet to protect; admin ID checks light. |
| Security headers (gateway) | PARTIALLY_IMPLEMENTED | P1 | nginx configs have some; API none. |
| Secrets in repo | IMPLEMENTED | P3 | None committed; `.env` gitignored. |
| PII logging | UNKNOWN | P2 | No structured logging redaction. |

## 9. Performance

| Item | Class | Severity | Notes |
|---|---|---|---|
| N+1 team snapshots | BROKEN | P1 | — |
| Chatbot full chunk scan per query | TECHNICAL_DEBT | P2 | Loads all public chunks. |
| Public endpoint caching | MISSING | P3 | None. |

## 10. Testing

| Item | Class | Severity | Notes |
|---|---|---|---|
| Unit tests (Guard, state machine, chatbot BR-002, services) | IMPLEMENTED | P3 | 26 tests pass. |
| API integration tests | MISSING | P1 | — |
| Auth/authorization tests | MISSING | P1 | — |
| Customer workflow tests | MISSING | P1 | — |
| Admin workflow tests | MISSING | P1 | — |
| Playwright | MISSING | P2 | CI references it; no suite. |

## 11. Documentation

| Item | Class | Severity | Notes |
|---|---|---|---|
| Living docs (MEMORY/BACKLOG/DECISIONS/CHANGELOG/checkpoints) | IMPLEMENTED | P3 | Present. |
| docs/reviews (pre-fix, design-gap, post-fix) | MISSING | P1 | This file is the first. |
| docs/features | MISSING | P2 | Dir absent. |
| README accuracy | PARTIALLY_IMPLEMENTED | P2 | Ports updated; customer portal absent. |

---

## Summary counts (pre-fix)
- P0 (critical/broken/security): 7
- P1 (core functionality): 19
- P2 (major UX/design): 10
- P3 (enhancement): 18

See `docs/reviews/DESIGN-GAP-ANALYSIS.md` for the page-by-page design comparison.
