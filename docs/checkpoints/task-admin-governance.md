# Checkpoint: Admin governance and public RAG synchronization

Date: 2026-08-08
Owner: GitHub Copilot
Gate: Backend tests + admin production build

## What was built

- Added persisted `admin` and `super_admin` role handling to admin JWTs.
- Added separate team-member activation state; reactivation leaves the member
  unpublished until an administrator explicitly republishes the profile.
- Added super-admin-only team activation/deactivation controls with bulk UI
  actions and confirmation dialogs.
- Added admin-account status management in Settings. Deactivation revokes
  refresh tokens, and the service rejects self-deactivation.
- Added automatic public RAG refresh after public project, team, CMS content,
  review moderation, and review approval mutations.
- Added approved review chunks to the public index. Customer-private records
  are not inserted into public chunks.
- Allowed both `admin` and `super_admin` to use customer-scoped RAG queries.
- Added admin-created customer projects from the Customers workspace by
  delegating to the existing validated customer-project creation workflow.
- Added customer-project search across captured context fields and enforced
  the customer filter used by the Customers workspace and MCP listing tool.
- Moved customer-project search, status, and customer filters into the
  repository query so filtering happens before pagination.

## Validation evidence

| Check | Result |
|---|---|
| `dotnet test backend/RALabs.Tests/RALabs.Tests.csproj --no-restore` | Passed: 68 tests, 0 failures |
| `Push-Location web-admin; npm run build; Pop-Location` | Passed |
| Isolated API build with `BaseOutputPath=.tmp-api-build` | Passed |
| Existing analyzer warning | `xUnit2002` in `CustomerWorkflowTests.cs`; unrelated to this task |

## Decisions

- Public RAG synchronization is performed after successful responses at the
  API boundary and logs failures without changing an already-successful user
  mutation into a failed request.
- Customer-project data is excluded from public ingestion; project-scoped RAG
  ingestion remains a separate follow-up requiring explicit authorization and
  private document filtering.

## How to verify

1. Sign in as a `super_admin` in the admin portal.
2. Open Settings and deactivate another admin account; confirm the dialog.
3. Attempt to sign in with the deactivated account and verify access is denied.
4. Change a published project or approve a review, then call the public RAG
   query and verify the updated public chunk is searchable.
5. Run the backend test and admin build commands above.
