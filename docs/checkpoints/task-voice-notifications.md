# Checkpoint: voice assistant + admin notifications

Date: 2026-08-08
Owner: GitHub Copilot
Gate: Automated validation complete; manual phone QA remains

## What was built

- Chatbot retrieval misses now use warm escalation copy: the visitor is invited
  to share details, the admin/team is asked to follow up, and brainstorming is
  explicitly free and focused on shaping an innovative product or business.
- Public chatbot voice input uses browser Web Speech API support when available.
  The transcript is appended to the normal text draft; unsupported browsers keep
  the typed input flow.
- Added persisted `AdminNotification` records with EF Core migration,
  repository, application service, and admin-only list/mark-read endpoints.
- Notifications are created for public leads, escalated visitor/customer chat,
  customer registration, customer project creation, document uploads, PRD
  signing, and feedback submission.
- Admin now has a top-bar bell/unread count, notification popover, full
  Notifications route, polling, mark-read controls, and foreground browser
  notifications after permission is granted.
- Admin is installable as a PWA with manifest, icons, and a service worker that
  handles future push payloads and notification clicks.

## Privacy and authorization

- Notification endpoints require the `admin` role.
- Push/browser notification text does not include raw customer chat content.
- Related IDs are retained for authenticated admin navigation and audit context.
- No password or credential is handled by the assistant.

## Validation evidence

| Check | Result |
|---|---|
| Focused chatbot tests | 21 passed |
| Backend test suite | 65 passed; one pre-existing xUnit analyzer warning |
| API host build in isolated output | Passed |
| web-public build | Passed |
| web-admin build | Passed |
| EF migration generation | Passed: `AdminNotifications` |

## Manual QA still required

Install the admin app on a phone, log in, grant notification permission from the
bell, then submit a lead or trigger an escalation from another session. Confirm
the unread count, foreground phone notification, mark-read action, and PWA
notification click behavior. Background delivery while the app is closed needs
VAPID/Web Push sender configuration before it can be enabled in production.
