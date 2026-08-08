# CHANGELOG: ra-labs

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
