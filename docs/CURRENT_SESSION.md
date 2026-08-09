# CURRENT SESSION: Voice assistant and admin notifications

**Date:** 2026-08-08
**Focus:** Voice-enabled chatbot escalation and admin activity notifications
**Owner:** GitHub Copilot

## Objective

Let visitors speak to the public assistant, receive a warm human handoff when
needed, and give the team a secure notification workflow for new requests and
customer activity.

## Tasks

- [x] Add warm retrieval fallback and free brainstorming copy.
- [x] Add browser voice input to the public chatbot.
- [x] Persist admin notifications and wire lead/chat/customer events.
- [x] Add admin notification center, polling, and foreground browser alerts.
- [x] Make the admin app installable with a notification-aware service worker.
- [ ] Configure VAPID/Web Push sender for background delivery while the app is closed.

## Decisions

- Passwords remain on `/customer/register`; the public assistant never collects
	or transmits credentials.
- Voice input is an enhancement over the existing text submission path and is
	hidden when Web Speech API support is unavailable.
- Notification endpoints are admin-role protected and notification text avoids
	raw customer chat content because it may appear on a phone lock screen.
- Foreground browser notifications work for a logged-in admin after permission;
	background phone delivery requires VAPID sender configuration.

## Blockers

None for this slice.

## Next

Add VAPID subscription storage/sending and Playwright coverage for voice,
notification permission, unread state, and installed-phone behavior.

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
