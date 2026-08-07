# REPOSITORY: ra-labs

Git workflow and repository conventions. This file is the authority for the
git agent and every committing agent.

## Branches

| Branch | Purpose | Who writes to it |
|---|---|---|
| `main` | Stable, deploy target. CI/CD deploys on push to `main` | Only Release Manager merges `develop` → `main` |
| `develop` | Integration branch — the accumulated product | Merges from `task-*` branches after gates pass |
| `task-<module>` | One branch per module/task (e.g. `task-foundation`, `task-auth`) | Feature work, created from `develop` |

## Rules

1. **Never commit directly to `main` or `develop`.** Always branch `task-*`
   from `develop`.
2. Create a branch per deliverable, not per drive-by edit:
   `git checkout develop && git pull && git checkout -b task-<module>`.
3. Conventional commit messages:
   `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` — one concern
   per commit, imperative tense.
4. A `task-*` branch merges to `develop` **only** after:
   - Backend builds and `dotnet test` passes (if backend touched);
   - Frontend builds and relevant tests/Playwright pass (if frontend touched);
   - Code review + QA sign-off are recorded in `docs/checkpoints/<task>.md`;
   - No secrets, `.env*`, `bin/`, `obj/`, `node_modules/`, or `dist/` are
     committed.
5. `develop` → `main` happens only at Release Manager go/no-go, recorded in
   `docs/reviews/` and `docs/CHANGELOG.md`.
6. Keep `main` and `develop` protected in GitHub settings (if available):
   require pull request + status checks, disallow force-push.
7. Rebase/merge: use `--no-ff` merges into `develop`/`main` so branch
   history is preserved (readable org audit trail).

## Flow

```
task-* (from develop) → gates (tests + review + QA record)
  → merge --no-ff into develop
      → integration smoke passes
          → Release Manager: merge develop into main (--no-ff)
              → CI/CD deploys (RMEnterpriseCMS pattern)
```

## Repository layout

```
backend/          RALabs.Api / Application / Domain / Infrastructure / Tests
web-public/       React PWA — marketing site (11 locales), portfolio, team,
                  contact, chatbot widget
web-customer/     React PWA — customer portal (M2+)
web-admin/        React SPA — admin CMS
docs/             prd/ design/ decisions/ reviews/ learning/ reports/
                  checkpoints/ sessions/ + living state (MEMORY, BACKLOG,
                  DECISIONS, FEATURE_INDEX, CHANGELOG, REPOSITORY, API,
                  DATABASE, ARCHITECTURE, DEPLOYMENT, UI)
deploy/           deploy.sh, rollback.sh, provision.sh, ssl-init.sh,
                  renew-ssl.sh, backup.sh, healthcheck.sh, .env.example
docker-compose.yml
Dockerfile.api
Dockerfile.web-public / web-admin
.github/workflows/deploy.yml
```

## Secrets

- Never commit `.env*`, tokens, or connection strings. Use the GitHub
  Secrets (`production` environment) + the deploy `.env` template
  (`deploy/.env.example`).
- A commit containing `.env` fails the CI lint gate.
