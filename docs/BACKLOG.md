# BACKLOG: ra-labs

Structured, testable requirements. Each item follows the same shape so any agent can pick it up without re-deriving intent.

## Format

```
## <ID> - <Title>
Status: <proposed | scoped | in-progress | in-review | done>
Owner: <agent>
Priority: <p0 | p1 | p2 | p3>

### Description
What is needed and why, in plain language.

### Acceptance Criteria
- Testable condition 1
- Testable condition 2

### Notes
Anything relevant: constraints, related items, links.
```

## Items

<!-- Add backlog items below using the format above -->

## UI-001 - Admin modal-free overhaul + dynamic 3D AI hero
Status: done
Owner: frontend/backend/ai
Priority: p1

### Description
Remove every modal and confirmation dialog from the admin panel and give the
public homepage a dynamic LLM-driven 3D hero banner.

### Acceptance Criteria
- Zero `Modal`/`ConfirmDialog`/modal-backdrop usage remains in `web-admin/src`.
- Content admin groups keys by first-dot prefix with a tab rail; ProjectDetails
  uses Overview/Docs/PRD/Demos/Invoices/Feedback tabs.
- `GET /api/v1/hero-scenarios` returns validated LLM-generated visual variables,
  cached 1 h, with a deterministic data-driven fallback when OpenAI is unset.
- `Hero.tsx` renders a CSS-3D animated scene (layers/orbit/grid), honors
  `prefers-reduced-motion`, and falls back when the endpoint is unavailable.
- 6 hero-scenario tests added; full backend suite passes (74 tests).

### Notes
See the "Post-overhaul state" section in `docs/FEATURE_INDEX.md`.

## ADM-001 - Complete customer management QA
Status: in-progress
Owner: GitHub Copilot
Priority: p1

### Description
Finish dedicated regression and end-to-end coverage for the customer management
slice and expose every new public admin function through MCP.

### Acceptance Criteria
- Search, filtered pagination, edit validation, duplicate email, lifecycle,
  deletion cleanup, import row errors, and export secret exclusion have focused
  backend tests.
- Playwright covers customer search, selection, confirmation, import, export,
  and destructive actions.
- MCP tools cover the customer management API contract.

### Notes
Implementation baseline: `docs/prd/admin-management-consolidated-prompt.md`.
