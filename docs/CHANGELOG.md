# CHANGELOG: ra-labs

## [Unreleased] - language fix + LLM translation agent (task-i18n-agent)

### Added
- **LLM translation agent** (`TranslationAgentService`): on a language change,
  missing locale content is translated by the model on demand and persisted as
  `PageContent` rows (cached — one model call per locale, serialized per
  locale). Activates automatically when `OpenAI:ApiKey` is configured.

### Fixed
- **Language switcher was broken**: only English content was seeded, so every
  other locale returned an empty content map and the site rendered raw content
  keys. `GET /api/v1/content?locale=X` now merges English values for any keys
  the translation agent has not produced yet — the UI never shows raw keys,
  even with no API key configured.

## [1.1.1] - 2026-08-08 (verification pass)

### Fixed
- **P0 concurrency bug**: `Guard` used a shared static error list; concurrent
  requests could corrupt each other's validation. Now `AsyncLocal`-isolated per
  execution context. Regression test added (56 tests total).
- **P0 MCP error mapping**: MCP argument errors returned 500 and leaked the
  exception message; now 400 VALIDATION_ERROR with a clean envelope.
- **P0 seed default**: `Seed:DemoOnStartup` defaults to `false`; seeding is
  explicit via `/seed/full`.
- Zero nullable-reference warnings in the backend build.
- Admin login no longer pre-validates password length (server is the source of
  truth; aligned with customer portal).

## [1.1.0] - 2026-08-08

### Added
- **Customer portal (web-customer PWA)**: register/login/forgot/reset, dashboard,
  project detail (status timeline, document upload, PRD view + sign, demo,
  invoices, feedback), project chat, account; refresh-token auth client.
- **Customer workflow backend**: customer auth (register/login/refresh/reset),
  projects, documents, PRD draft + dual sign, demo, invoice, feedback; enforced
  `CustomerProjectStateMachine` (ADR-005) + BR-003 (cash-only), BR-004
  (feedback-before-close), BR-005 (publish-on-approval).
- **Admin workflow**: Customers list, Projects kanban board, Project workspace
  (status transitions, admin notes, PRD editor + admin sign, demo, invoice,
  feedback approve), thread deep-link.
- **Auth hardening**: admin `RequireRole("admin")`, customer
  `RequireRole("customer")`, password reset (email code, expiry, hashed),
  refresh-token rotation, `IEmailSender` (SMTP + dev console), strict login
  rate limit (5/min), security headers (API + gateway), admin projects pagination.
- **Chatbot/RAG**: punctuation normalization, lemmatization-light stemming,
  stop-word filtering, conversation context, weighted scoring, rich studio
  knowledge; answers the required question matrix; no false positives;
  BR-002 transactional guardrail.
- **Design**: `web-public` rebuilt to index-v2.html (light cream/emerald/brass,
  Newsreader+Inter+IBM Plex Mono, gradient covers, em-dash stats, pulsing badge).
- **Tests**: 55 xUnit (customer workflow, auth security, chatbot retrieval
  matrix, state machine, validation) + Playwright scaffold (`e2e/`).

### Changed
- Admin REST endpoints now require the `admin` role (was any authenticated user).
- Customer project statuses use snake_case in the API (`prd_draft`, `prd_signed`,
  `in_build`).

### Fixed
- Customer workflow deadlock: feedback is captured at `delivered`, close requires it.
- Chatbot keyword matching false positives / misses.
- N+1 team snapshot queries (batch load).

## [1.0.0] - 2026-08-08
Initial release: public PWA, admin CMS, portfolio/team, leads+chatbot, MCP server,
AI layer, deploy config. See earlier commits.
