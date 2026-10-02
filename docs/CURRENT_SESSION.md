# CURRENT SESSION: Admin modal-free overhaul and dynamic 3D AI hero

**Date:** 2026-08-09
**Focus:** Popup-free admin UX and LLM-driven public hero banner
**Owner:** opencode

## Objective

Make the admin panel platform-independent (no modal popups — everything inline
and state-based) and give the public homepage a dynamic 3D hero driven by
LLM-generated visual variables.

## Tasks

- [x] Phase 1: per-page audit matrix recorded in `docs/FEATURE_INDEX.md`.
- [x] Phase 2: Portfolio, Team, Content, Leads, Settings, Reviews, Customers made
  modal-free (`InlineConfirm` row-level destructive morph, `inline-edit-panel`
  forms, `inline-confirm-bar` bulk confirms); `Modal.tsx` + modal CSS deleted.
- [x] Phase 3: Content admin grouped by key prefix with a tab rail; ProjectDetails
  master-detail tabs (Overview/Docs/PRD/Demos/Invoices/Feedback).
- [x] Phase 4: `HeroScenarioService` + `GET /api/v1/hero-scenarios` endpoint
  (LLM-generated theme/colors/orbits/labels, `IMemoryCache` 1 h TTL, deterministic
  data-driven fallback), DI registration, `AddMemoryCache()`, 6 new tests.
- [x] Phase 4b: public `Hero.tsx` CSS-3D renderer (layers/orbit/grid, reduced-motion
  support, fallback to deterministic default while the endpoint is unavailable).
- [x] Phase 5: full suite passes (74 tests), all three frontends build, live
  smoke test of `/api/v1/hero-scenarios` returns 200.

## Decisions

- 3D engine is pure CSS transforms — no new frontend dependencies.
- The LLM only produces visual variables; headline/CTA copy stays i18n-key based.
- Hero scenarios are cached for 1 hour so public page loads never trigger model calls.

## Blockers

None. The concurrent customer-management slice was committed mid-flight by other
agents; this work merged on top without touching its shared files beyond the
approved Program.cs/DI wiring.

## Next

Playwright spot checks for the inline destructive morphs, tabs, and hero scenes;
seed parity for the new public copy remains part of the homepage task.

## Continuation update: admin governance and RAG

- Added persisted `super_admin` governance for team members and admin account
	activation status, with confirmation dialogs in Settings.
- Public RAG now refreshes after public project, team, CMS content, review
	moderation, and review approval mutations; approved reviews are indexed.
- Customer-private project data remains outside the public index.
- Admins can create customer-owned projects directly from the Customers
	workspace using the existing validated workflow.
- Customer project search now covers context fields and enforces the customer
	filter used when navigating from Customers.
- Customer-project filtering now happens before pagination and is
	case-insensitive across providers.
- Validation: 68 backend tests pass, the API build passes, and the
	`web-admin` production build passes.
- Checkpoint: `docs/checkpoints/task-admin-governance.md`.

## Continuation update: consolidated customer management

- Added the consolidated admin-management implementation prompt at
	`docs/prd/admin-management-consolidated-prompt.md`.
- Added customer search, active/inactive filtering, complete pagination
	metadata, detail, edit, delete, bulk delete, CSV import, and CSV export
	contracts and UI actions.
- Customer export excludes password hashes, refresh tokens, reset tokens, and
	other credential fields.
- Customer deletion explicitly removes project-scoped knowledge chunks before
	the EF customer cascade removes dependent customer projects.
- Existing admin creation and status flows remain available; status changes
	now revoke refresh tokens when deactivating through the management service.
- Validation: 68 backend tests pass, isolated API build passes, and the
	`web-admin` production build passes.
- Remaining gates: dedicated customer-management tests, MCP validation, and
	Playwright coverage for import/export and destructive actions.
