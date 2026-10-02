# Consolidated Prompt: Admin Management System

Build a complete, consistent administration system for R&A Labs using the existing React 18 + Vite + TypeScript admin app, ASP.NET Core .NET 8 four-layer backend, SQL Server EF Core persistence, MCP tool layer, and existing RAG synchronization boundaries.

## Product Goal

Every admin-managed resource must support the same predictable management workflow without duplicating business rules:

- search and server-side filtering;
- newest records first where chronological ordering applies;
- pagination with accurate filtered totals;
- view/read details;
- create/add;
- edit/update with client and server validation;
- delete with an explicit confirmation dialog;
- activate/deactivate where the resource has a lifecycle state;
- select-all for the current filtered page;
- bulk activate, bulk deactivate, and bulk delete where applicable, each confirmed;
- import and export, including export of selected rows or all rows in the current scope;
- success/error/loading/empty states;
- role-aware actions for `admin` and `super_admin`.

## Resources In Scope

Apply the contract to customers, customer projects, team members, public portfolio projects, reviews, leads, chat/messages, CMS content, drafts, notifications, admin accounts, and settings. Preserve resource-specific business rules and state machines.

## Customer Management Requirements

The Customers workspace must provide:

- a server-side search field matching name and email;
- newest customer records first;
- accurate pagination after search/status filters;
- a status filter for active/inactive/all;
- row actions for view, edit, activate/deactivate, and delete;
- an Add Customer form;
- select-all for the visible filtered page;
- confirmed bulk activate and bulk deactivate;
- confirmed bulk delete;
- import of validated CSV rows with a clear result for created, skipped, and invalid rows;
- export of selected customers or all customers in the current filtered scope;
- form validation for name, email, password, duplicate email, CSV headers, row limits, and field lengths;
- preservation of customer-project ownership and explicit cleanup of customer-private RAG chunks on deletion;
- customer-private data must never enter the public RAG index or public retrieval results.

Customer deletion must be deliberate and auditable. Because projects cascade from customers, the implementation must explicitly remove private knowledge chunks associated with deleted customer projects before or as part of deletion. Do not silently convert a hard delete into deactivation.

## Roles and Governance

- `admin` and `super_admin` may manage customer records and customer projects.
- Only `super_admin` may manage team-member activation and admin-account activation/role governance, consistent with existing authorization.
- Team members must not activate or deactivate one another.
- Deactivated accounts must lose access according to existing authentication behavior.
- A deactivated team member must not appear on public pages until explicitly republished after reactivation.

## API and Architecture Rules

- Keep business rules in Application services, not in route handlers or React components.
- Keep persistence queries and filtered counts in repositories so pagination is correct.
- Return the existing API envelope and pagination shape.
- Every new HTTP capability must have an equivalent MCP tool or an explicit documented reason why it is not exposed through MCP.
- Reuse existing validation guards, exception mapping, confirmation dialogs, toast/loading patterns, and role policies.
- Preserve existing public APIs and customer-project workflow unless a contract change is required.
- Use structured CSV parsing with quoted-field support, row limits, and no credential or secret logging.
- Do not commit generated output, secrets, `bin/`, `obj/`, `dist/`, `node_modules/`, or local API build directories.

## RAG and Background Agent Rules

- Public mutations refresh the public index after a successful mutation.
- Approved public reviews may be indexed; pending/rejected reviews and customer-private records may not.
- Customer projects, documents, chat content, credentials, and PII remain project-scoped/private and must never be inserted into public chunks.
- Any private RAG ingestion must enforce customer/project authorization and use a separate scope/filter from public retrieval.
- Background agent work must be observable, retry-safe, and failure-isolated: a failed synchronization must not turn a successful CRUD mutation into a failed request, but it must be logged and surfaced to admin diagnostics.

## UX and Validation Rules

- Every destructive or lifecycle-changing action requires a confirmation dialog.
- Forms validate before submission and still rely on server-side validation as the source of truth.
- Buttons must be disabled while an action is in progress.
- Bulk actions must operate only on selected IDs in the current visible scope unless the UI explicitly says “all filtered results.”
- Import results must identify row numbers and actionable validation errors.
- Export must not expose password hashes, refresh tokens, private files, or other secrets.
- Empty, loading, error, and no-search-results states are required.
- Preserve accessible labels, keyboard operation, and responsive behavior.

## Required Verification

For each resource slice:

1. Read the current implementation, current-session notes, PRD, and repository conventions before editing.
2. Add focused service/repository tests for validation, authorization, filtering, ordering, pagination, bulk behavior, import/export, and destructive cleanup.
3. Run `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj --no-restore`.
4. Run the affected frontend production build from its app directory.
5. Run relevant Playwright/MCP checks for the UI and public/private RAG boundary.
6. Record decisions, validation evidence, known gaps, and verification steps in a checkpoint under `docs/checkpoints/`.
7. Update `docs/MEMORY.md`, `docs/BACKLOG.md`, `docs/FEATURE_INDEX.md`, `docs/CHANGELOG.md`, and the current-session record.

## Current Implementation Baseline

Already implemented in the existing repository: customer creation, customer activation/deactivation, visible-page selection, customer-project creation, customer-project search/filtering before pagination, persisted super-admin governance, confirmation dialogs for implemented lifecycle/destructive actions, approved-review public RAG indexing, and public RAG refresh after public mutations.

The next customer slice must close the remaining gaps: server-side customer search/filtering, view/edit/delete, bulk delete, import/export, filtered pagination totals, private-chunk deletion cleanup, and focused regression coverage.
