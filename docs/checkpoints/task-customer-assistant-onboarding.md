# Checkpoint: customer assistant onboarding

Date: 2026-08-08
Gate: Focused tests and frontend builds

## What was built

- Added authenticated customer routes for project chat read/send:
  `/api/v1/customer/projects/{id}/chat` and
  `/api/v1/customer/projects/{id}/chat/messages`.
- Reused `CustomerProjectService.GetMyProjectAsync` for ownership checks, so a
  project belonging to another customer resolves as not found.
- Routed `web-customer` project chat through project-scoped authenticated APIs
  instead of the shared public thread routes.
- Added a public assistant registration handoff and homepage explanation. The
  CTA links to the existing registration form and does not collect passwords in
  chat.
- Blocked customer tokens from using the legacy public message route and
  blocked visitor writes to customer-project threads.
- Enabled public-safe assistant replies for authenticated customer project
  messages. No admin or arbitrary repository operations are exposed.

## Validation evidence

| Check | Result |
|---|---|
| Focused chatbot + customer workflow tests | 12 passed, 0 failed |
| Full backend test suite | 64 passed, 0 failed |
| `web-public` production build | Passed |
| `web-customer` production build | Passed |
| Changed backend/frontend diagnostics | No errors |

## Security boundary

The assistant currently supports public knowledge answers, lead qualification,
registration handoff, and customer-owned project chat. It does not collect
passwords, read another customer's project, access admin APIs, or perform
unconfirmed project mutations. Explicit allowlisted customer mutation tools are
the next implementation slice.

## How to verify

1. Open the public homepage and start the chatbot.
2. Send a project-intent message such as `I want to start a project`.
3. Confirm the private-workspace CTA links to `/customer/register`.
4. Register, open an owned project, and confirm chat loads/sends through the
   customer project-chat route.