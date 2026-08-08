# Checkpoint: Customer Intake and Homepage Journey

## Date
2026-08-08

## Built

- Added a structured customer project brief with goal, audience, requirements, timeline, budget or constraints, and reference links.
- Persisted the brief through the domain model, Application service, REST/MCP contracts, EF configuration, and additive SQL Server migration `CustomerProjectBrief`.
- Replaced the customer title-only creation modal with a guided form and direct navigation to the created project.
- Displayed the saved brief in customer and admin project detail views.
- Reframed the public homepage around Understand, Register, Submit brief, Discuss, and Approve, with first-brief preparation guidance.

## Validation Evidence

- `dotnet build backend/RALabs.sln --no-restore`: passed; one existing xUnit analyzer warning remains.
- Focused backend tests: 25 passed, 0 failed.
- `npm run build` in `web-public`: passed.
- `npm run build` in `web-customer`: passed.
- `npm run build` in `web-admin`: passed.
- Migration source contains six nullable additive columns and matching rollback operations.

## Decisions

- The UI requires project title and goal for new submissions.
- The Application API keeps goal nullable for compatibility with existing title-only callers and projects.
- Chat remains the live discussion channel; the brief is the durable initial context.
- No file upload was added to the initial brief; existing secure documents remain available from the project room.

## Follow-up Verification

- Apply the migration to the target SQL Server database before testing a new brief through the running API.
- Add browser coverage for public CTA, registration, full brief submission, brief visibility, and chat entry.
- Add truthful agent availability/unavailable fallback behavior.
