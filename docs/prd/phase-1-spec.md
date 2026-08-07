# R&A Labs — Phase 1 feature spec

Working name. Founders: Rajib Mahata, Abhishek Barnabal.

## Purpose

A showcase site for a two-founder engineering studio, built to attract clients by
demonstrating real project work, team expertise, and a repeatable delivery process.
Phase 1 is the smallest version that can go live and start generating contact
requests — everything else (customer portal, PRD e-signing, invoicing) is deferred
to later phases.

## Tech stack

| Layer | Choice | Note |
|---|---|---|
| Frontend | React | Responsive, phone + browser |
| API | .NET (ASP.NET Core) | Matches existing team stack |
| Database | PostgreSQL or Azure SQL (Basic tier) | Not SQL Server Express — see below |
| Hosting | Docker Compose | Matches existing AI Workforce deployment pattern |
| AI layer | Existing agentic workflow tooling | Chatbot + GitHub sync agent |

**Why not SQL Server Express:** 10GB database cap and a 1 core / 1GB buffer pool
limit. Fine for a demo, tight once chat logs, portfolio content, and GitHub sync
data accumulate across languages and projects.

## In scope — Phase 1

1. **Public marketing site**
   - Hero, process explainer, portfolio grid, team section, contact section
   - Responsive across phone and desktop; motion respects reduced-motion
   - Languages at launch: English, Bengali, Hindi

2. **Portfolio / project showcase**
   - Project cards: name, one-line description, stack tags, status (live / in
     build), GitHub link
   - Admin can add, edit, reorder, and unpublish cards

3. **Admin CMS**
   - Auth-gated admin area
   - Edit homepage copy, manage portfolio entries, manage team profiles
   - No self-serve customer accounts yet — that's Phase 2

4. **Team profiles**
   - Name, role, bio
   - Background job pulls GitHub stats (commit count, active repos, last commit
     time) into a snapshot shown on the profile — refreshed on a schedule, not
     live on every page load

5. **Contact intake**
   - Contact form + basic chatbot (text only, no voice yet)
   - Chatbot is scoped to answering questions from project/team/process content
     and capturing a structured lead (name, contact info, short requirement)
   - New leads create a record in the admin area and trigger an email
     notification

## Explicitly out of scope for Phase 1

Deferred to later phases, listed here so scope creep is visible rather than silent:

- Customer login, project chat, document upload
- PRD generation and dual-party e-signing
- Invoicing and payment tracking
- Voice input on the chatbot
- AI-driven marketing agent
- Languages beyond English / Bengali / Hindi

## Data model, high level

- `Project` — id, title, summary, stack tags, status, github_url, sort_order, is_published
- `TeamMember` — id, name, role, bio, github_username
- `GithubSnapshot` — team_member_id, commits_90d, active_repos, last_commit_at, captured_at
- `Lead` — id, name, contact_info, message, source (form / chatbot), status, created_at
- `PageContent` — key, locale, value (for the CMS-editable homepage copy, keyed per language)

## Non-functional requirements

- Time to first byte and Lighthouse performance score should hold up on mobile
  networks — this is a portfolio piece for engineering credibility, so a slow
  site undercuts the pitch
- Visible keyboard focus states throughout, including the admin area
- All copy pulled from `PageContent` rather than hardcoded, so translation
  doesn't require a redeploy

## Open questions for the founders

- Final brand name — affects domain, metadata, and the wordmark in the homepage sample
- Abhishek's title/role and bio for the team section
- Whether the chatbot should be able to escalate to a live notification (e.g.
  Slack/Teams) in addition to email, given the volume expected at launch
- Real contact email/inbox to wire into the lead notification flow

## Suggested next steps

1. Confirm brand name and swap it into the homepage sample
2. Stand up the .NET API + Postgres schema above
3. Wire the contact form and chatbot lead capture to email
4. Build the admin CMS screens for portfolio and team content
5. Set up the GitHub snapshot background job
