# Checkpoint: Customer management slice

Date: 2026-08-09
Owner: GitHub Copilot
Gate: Backend regression + isolated API build + admin production build

## What was built

- Added the consolidated admin-management contract in
  `docs/prd/admin-management-consolidated-prompt.md`.
- Added customer server-side search and active/inactive filtering with newest-
  first ordering and complete pagination metadata.
- Added customer detail, edit, delete, and bulk-delete APIs and UI actions.
- Added confirmed row and bulk lifecycle controls through the application
  service; deactivation revokes customer refresh tokens.
- Added CSV import with fixed headers, row-level validation, duplicate handling,
  and a 500-row limit.
- Added CSV export for selected or filtered customers without password hashes,
  refresh tokens, reset tokens, or private credentials.
- Added explicit project-scoped knowledge-chunk deletion before customer
  deletion, preserving the public/private RAG boundary.

## Validation evidence

| Check | Result |
|---|---|
| `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj --no-restore` | Passed: 68 tests, 0 failures |
| `dotnet build backend/RALabs.Api/RALabs.Api.csproj --no-restore -p:BaseOutputPath=.api-build/` | Passed |
| `Push-Location web-admin; npm run build; Pop-Location` | Passed |

The normal API output build was blocked by an already-running `RALabs.Api`
process holding its DLLs; the isolated build passed without stopping it.
An existing xUnit analyzer warning remains in `CustomerWorkflowTests.cs`.

## Decisions

- Customer deletion remains a hard delete and is confirmed explicitly; it is
  not silently converted to deactivation.
- Customer-private knowledge chunks are deleted by project ID before the EF
  customer cascade removes dependent projects.
- Export uses a deliberately narrow operational schema and never serializes
  credential fields.
- Import creates active accounts and reports duplicate rows as skipped/errors.

## Remaining gates

- Add focused tests for customer search, filtered pagination, edit validation,
  duplicate email, deletion cleanup, import row errors, and export secrecy.
- Expose and validate the new customer operations through MCP.
- Add Playwright coverage for search, selection, confirmation, import, export,
  and destructive actions.

## How to verify manually

1. Sign in as an admin and open Customers.
2. Search by name/email and switch active status filters; verify page counts.
3. View and edit a customer, then activate/deactivate with confirmation.
4. Import a CSV using `name,email,password` headers and inspect row errors.
5. Export all or selected customers and verify no credential columns exist.
6. Delete a customer only after confirming the project/private-data warning.
