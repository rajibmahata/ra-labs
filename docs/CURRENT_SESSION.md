# CURRENT SESSION: Customer assistant onboarding

**Date:** 2026-08-08
**Focus:** Secure chatbot-to-registration and customer project chat handoff
**Owner:** GitHub Copilot

## Objective

Give public visitors a clear route from assistant conversation to a private
customer workspace, while ensuring project chat is bound to the authenticated
customer and never exposes admin or other-customer data.

## Tasks

- [x] Add customer-owned project chat read/send endpoints.
- [x] Route the customer portal through the protected project chat endpoints.
- [x] Add public assistant registration handoff copy and CTA.
- [x] Block the legacy public route from writing to customer project threads.
- [ ] Add explicit allowlisted customer assistant tools for project mutations.

## Decisions

- Passwords remain on `/customer/register`; the public assistant never collects
	or transmits credentials.
- Customer project chat resolves ownership from the JWT customer subject and
	project ownership service; cross-customer project IDs return not found.
- Customer chat receives public-safe assistant replies, but mutations require a
	future explicit confirmation and allowlisted tool boundary.

## Blockers

None for this slice.

## Next

Add structured assistant actions for confirmed project creation and brief
updates, then cover those actions with authorization and browser tests.
