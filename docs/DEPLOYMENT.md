# DEPLOYMENT: ra-labs

## Environments

| Environment | Purpose | Host | Access |
|---|---|---|---|
| Local | Primary development and demo environment; full stack runs via `docker compose up` | Developer machine | `localhost` ports mapped per service |
| Staging | Pre-release validation mirroring production; runs the same compose stack | VPS (TBD) | Internal-only, authenticated |
| Production | Live public-facing deployment | VPS (TBD) | Public: `web-public` on port 80/443; `web-customer` and `web-admin` on subdomains or path-based routing via reverse proxy |

All three environments use the same `docker-compose.yml` definition. Differences are isolated to environment-specific `.env` files (`local.env`, `staging.env`, `production.env`), none of which are committed to the repository.

## Deployment Method

The project is deployed as a **Docker Compose stack**, consistent with the tech stack declared in `platform-prd.md` section 4 and the VPS/Docker Compose hosting setup referenced in `platform-prd-v2.md` section 2.

### Stack services

| Service | Role | Image source | Port mapping (local) |
|---|---|---|---|
| `api` | ASP.NET Core backend (RALabs.Api + Application + Domain + Infrastructure); also hosts the MCP server and the scheduled GitHub sync job | Built from `backend/` Dockerfile | `8080:8080` |
| `web-public` | React marketing site (home, portfolio, team, contact, PWA shell) | Built from `web-public/` Dockerfile; served via Nginx | `3000:80` |
| `web-customer` | React customer portal (auth, project threads, documents, PWA with offline queue) | Built from `web-customer/` Dockerfile; served via Nginx | `3001:80` |
| `web-admin` | React admin CMS (content, leads, portfolio, team) | Built from `web-admin/` Dockerfile; served via Nginx | `3002:80` |
| `postgres` | PostgreSQL 16 — primary relational database | `postgres:16-alpine` | `5432:5432` |
| `qdrant` | Qdrant vector store — RAG embeddings for chatbot and project agents | `qdrant/qdrant:latest` (pinned to a stable minor at time of scaffold) | `6333:6333` (HTTP), `6334:6334` (gRPC) |
| `reverse-proxy` | Caddy — terminates TLS, routes to frontends and API by hostname/path | `caddy:2-alpine` | `80:80`, `443:443` |

### Persistent storage

| Volume | Service | Contents | Backup priority |
|---|---|---|---|
| `postgres-data` | `postgres` | All relational data (users, projects, leads, content, etc.) | High — nightly `pg_dump` |
| `qdrant-data` | `qdrant` | Vector embeddings and chunk metadata | Medium — can be re-indexed from source content, but nightly snapshot avoids rebuild delay |
| `caddy-data` | `reverse-proxy` | TLS certificates (auto-managed via Let's Encrypt) | Low — auto-renewed |

### Scheduled jobs

The GitHub sync job (described in `platform-prd.md` section 6.4) runs as a **background scheduled task within the `api` container** — not a separate worker container. This avoids an additional service in the compose stack and keeps the job co-located with the database it writes to. The job is triggered by a timer in the Application layer (e.g., `IHostedService` or `BackgroundService`), pulling GitHub stats on a configurable interval for each `TeamMember` with a `github_username`.

The RAG nightly re-index (described in `platform-prd-v2.md` section 2) runs on the same schedule within the `api` container, regenerating embeddings for content edited outside the normal ingestion flow.

### Reverse proxy routing

Caddy handles all ingress. Routing logic (defined in `Caddyfile`, mounted as a volume):

- `/api/*` → `api:8080`
- `/mcp/*` → `api:8080` (MCP server is a thin layer over the same API — see `platform-prd-v2.md` section 3)
- `public.<domain>` → `web-public:80`
- `app.<domain>` → `web-customer:80`
- `admin.<domain>` → `web-admin:80`

For local development, services are accessed directly on mapped ports; the reverse proxy is used primarily in staging and production.

## Pipeline

### Workflow reference

The CI/CD pipeline follows:
- **`workflows/devops-deployment.md`** (located at `~/.config/opencode/workflows/devops-deployment.md`) — defines the pipeline setup, secret handling, environment documentation, and rollback verification steps
- **`workflows/release.md`** (located at `~/.config/opencode/workflows/release.md`) — defines the per-milestone release process: quality gate confirmation, go/no-go call, deployment execution, and post-release verification

The pipeline configuration itself is based on `templates/github-actions/ci-cd.template.yml` (from the OpenCode AI Workforce shared templates), adapted to this project's multi-service Composer stack.

### Pipeline stages

| Stage | Trigger | What happens | Failure behavior |
|---|---|---|---|
| **Build & Test** | Push to `main`, PR to `main` | `dotnet restore` → `dotnet build -c Release` → `dotnet test` with coverage collection; test results published as artifacts | Fails loudly — no downstream stages proceed |
| **Security Scan** | After Build & Test passes | `dotnet list package --vulnerable --include-transitive` | Fails on any critical/high CVEs; blocks image build |
| **Playwright UI Regression** | After Build & Test passes | Runs Playwright test suite against the staging environment (or a temporary compose stack brought up in CI) | Fails on any regression; blocks deploy |
| **Lighthouse PWA Check** | After Build & Test passes (targets `web-public`, `web-customer`) | Runs Lighthouse audit; asserts PWA score meets threshold, installability, offline shell behavior | Fails if PWA requirements (from `platform-prd-v2.md` section 1) are not met |
| **Build & Push Images** | Push to `main` only (not PRs) | `docker build` per service → tag with `git sha` and `latest` → push to container registry | Fails on build error or registry auth failure |
| **Deploy to Staging** | After image push succeeds | SSH to staging VPS → `docker compose pull` → `docker compose up -d` → health check | Fails on connection, pull, or health check failure; alert fires |
| **Deploy to Production** | Manual trigger (Release Manager go/no-go per `workflows/release.md` step 4), targeting the `production` GitHub Environment with required approvers | Same as staging: SSH → pull → up -d → health check | Fails on any step; rollback is immediate (see Rollback Plan) |

### Per-milestone release gates

Before each milestone ships, the following quality gates must pass (aligned with the Definition of Done in `docs/prd/project-brief.md`):

1. **Backend tests:** All `dotnet test` suites pass with no skipped tests (skipped tests are treated as failures in CI)
2. **Playwright UI regression:** Full suite passes against the staging compose stack
3. **Lighthouse PWA:** `web-public` and `web-customer` both pass PWA installability and offline behavior checks
4. **Security scan:** No unaddressed critical or high-severity vulnerabilities in dependencies
5. **Code review:** Every included PR has a passing code review per `workflows/code-review.md`
6. **Architecture review:** Cross-cutting changes have passed architecture review per `workflows/architecture-review.md`
7. **Release Manager sign-off:** Go/no-go call documented per `workflows/release.md` step 4

Staging deployment is the final pre-release gate — the candidate images must survive staging for a defined soak period (at minimum, a full health-check pass and a smoke test of critical paths) before the production deploy is triggered.

## Rollback Plan

### Detection

A deployment is considered bad if any of the following occur:

- **Health check failure:** `docker compose up -d` exits non-zero, or the health check on any service fails within the retry window
- **Smoke test failure:** Post-deploy automated smoke tests (basic GET on `/api/health`, `/` on each frontend) return non-2xx or timeout
- **Manual observation:** The Release Manager or on-call founder observes a regression within the monitoring window (first hour post-deploy)

### Rollback procedure

The stack is built from **immutable images** tagged by `git sha`. Rollback does not require rebuilding — it redeploys the previous known-good image tag.

1. **Identify the last known-good tag:** The CI/CD pipeline maintains an artifact or environment variable tracking the previous successful deployment tag.
2. **Redeploy:** Set `TAG=<previous-sha>` and run `docker compose pull && docker compose up -d` on the target VPS.
3. **Verify:** Re-run the health checks and smoke tests against the rolled-back stack.

This procedure is automated in the CI/CD pipeline. A `deploy` failure in the staging or production environment triggers a rollback job that:
1. Logs the failed deployment details (service, error, logs) to `MEMORY.md` under Known Bugs
2. Pulls and redeploys the previous tag
3. Runs the same health check
4. Alerts (email/Slack — provider TBD) on success or failure of the rollback itself

### Database rollback

**Migrations are forward-only** — each milestone ships with a migration that adds or alters schema, and there is no automated down-migration.

For data-level rollback:
- **Pre-migration snapshot:** A `pg_dump` of the database is taken automatically before each deployment migration runs (as a CI step or a pre-migration hook in the API startup)
- **Restore:** If a migration corrupts data, restore from the pre-migration dump and re-deploy the previous image tag
- **Vector store (Qdrant):** Rollback is handled by re-indexing from source content after restoring the relational DB — Qdrant snapshots are taken nightly as a faster recovery path

Schema changes are scoped per milestone and tested against a staging database that mirrors production volume. No migration reaches production without first running against the staging dataset.

## Secrets Management

All secrets are injected at runtime from environment files or Docker Compose secrets — **never committed to the repository, never hardcoded in configuration files, and never logged.**

### Secret inventory

| Secret | Used by | Scope | Rotation guidance |
|---|---|---|---|
| `DB_CONNECTION_STRING` | `api` | PostgreSQL connection (includes host, port, database, user, password) | Rotate on credential compromise or quarterly |
| `JWT_SIGNING_KEY` | `api` | Signs and validates JWT tokens for customer and admin auth | Rotate on key compromise; invalidates all existing sessions |
| `GITHUB_TOKEN` | `api` (scheduled GitHub sync job) | Authenticates to the GitHub API for team member stats | Rotate on token expiry (GitHub enforces) or compromise |
| `EMAIL_SMTP_HOST` / `EMAIL_SMTP_PORT` / `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASSWORD` | `api` | Sends lead notifications, account invites, and status change emails | Rotate on credential compromise or provider change |
| `LLM_API_KEY` | `api` (chatbot and project agent) | Authenticates to the LLM provider for RAG-powered chat responses | Rotate on key compromise or provider rotation |
| `REGISTRY_URL` / `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | CI/CD pipeline | Pushes built images to the container registry | Rotate on credential compromise |
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` | CI/CD pipeline | SSH into staging and production VPS for deployment | Rotate SSH keys on compromise or quarterly |

### Storage per environment

| Environment | Secrets store | How secrets reach containers |
|---|---|---|
| **Local** | `.env.local` file in the project root (gitignored) | `docker compose --env-file .env.local up` |
| **Staging** | `.env.staging` file on the VPS, provisioned out-of-band (never committed) | `docker compose --env-file /opt/ralabs/.env.staging up -d` |
| **Production** | `.env.production` file on the VPS, provisioned out-of-band (never committed); GitHub Encrypted Secrets for CI/CD pipeline | `docker compose --env-file /opt/ralabs/.env.production up -d`; CI/CD injects `REGISTRY_*`, `DEPLOY_*`, and `LLM_API_KEY` from GitHub Secrets via the `environment: production` protection rule |

### Guards

- `.env.*` is listed in `.gitignore` and verified by a pipeline lint step (commit containing `.env` fails CI)
- Pipeline logs never echo environment variable values — the CI/CD template configures log masking for all secret names
- All GitHub Encrypted Secrets are scoped to the `production` and `staging` environments with required reviewer protection — no single actor can trigger a production deploy without approval
- JWT signing key is generated per environment and never shared — a staging token is not valid in production and vice versa

## Standards Applied

- `standards/cloud.md` — infrastructure as code, least-privilege credentials, secret handling
- `standards/security.md` — pipeline security, secrets rotation, logging of secret access
- `standards/git.md` — CI must pass before code review; no secrets in repository history

(If a project-local `standards/` directory has not yet been created, these refer to the shared workforce standards at `~/.config/opencode/standards/`.)
