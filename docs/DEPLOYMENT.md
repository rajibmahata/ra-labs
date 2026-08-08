# DEPLOYMENT: ra-labs

## Environments

| Environment | Purpose | Host | Access |
|---|---|---|---|
| Local | Primary dev: API via `dotnet run` on **port 5002** (Windows auth to `RAJIB\SQLEXPRESS`), frontends via Vite (**3004** public, **3005** admin) | Developer machine | localhost |
| Docker demo | Full stack via `docker compose up` (containerized SQL Server SA auth) | Any Docker host | localhost |
| Production | Live deploy on the VPS (same host as RMEnterpriseCMS) | VPS `/opt/ralabs` | public domain |

## Deployment method — RMEnterpriseCMS pattern

- **Docker Compose** on a single VPS behind an **nginx gateway**.
- **Images are built on the VPS** from repository source (`docker compose up
  -d --build`) — no registry needed.
- **GitHub Actions** (`.github/workflows/deploy.yml`) deploys on push/merge
  to `main`: backend tests → build web-public + web-admin → rsync source to
  `/opt/ralabs` → generate `.env` from GitHub secrets → `deploy.sh`
  (build, up, health-check, auto-rollback).
- **Database**: SQL Server (Express). Dev = `RAJIB\SQLEXPRESS` Windows auth;
  compose/demo and production = SQL auth via `DB_*` env vars composed into
  `ConnectionStrings:DefaultConnection`.

### Stack services
| Service | Role | Port (local) |
|---|---|---|
| api | RALabs.Api (REST + MCP + AI jobs) | 8080 (compose) |
| web-public | React PWA (nginx) | 3004 (dev) |
| web-admin | React admin CMS (nginx, `/admin/`) | 3005 (dev) |
| web-customer | React customer portal PWA (nginx, `/customer/`) | 3002 (dev) |
| gateway | nginx reverse proxy | 80/443 |

### Secrets (never committed)
`DB_HOST/DB_NAME/DB_USER/DB_PASSWORD`, `JWT_SECRET` (≥32 chars),
`GITHUB_TOKEN`, `SMTP_*`, `APP_DOMAIN`, `CERT_EMAIL`, `SEED_ON_STARTUP`.
Template: `deploy/.env.example`. Pipeline fails fast if `DB_*`, `JWT_SECRET`,
or `APP_DOMAIN` are missing.

### Rollback
`deploy.sh` records `.deployed-sha` / `.previous-sha`; on health-check
failure it redeploys the previous tag. Manual: `deploy/rollback.sh`.
Migrations are forward-only; pre-deploy `pg_dump`-equivalent for SQL Server
(backup via `BACKUP DATABASE` or SQL backup job) before schema changes.

## How to run (dev)

```
# API (Windows host, SQL Express Windows auth) — http://localhost:5002
cd backend
dotnet run --project RALabs.Api
# empty DefaultConnection → in-memory fallback

# Frontends
cd web-public && npm install && npm run dev    # :3004
cd web-admin && npm install && npm run dev     # :3005
cd web-customer && npm install && npm run dev  # :3002

# Smoke
bash scripts/smoke.sh http://localhost:5002
```

## First-time VPS setup

1. `mkdir -p /opt/ralabs` and copy `deploy/.env.example` → `/opt/ralabs/.env`,
   fill secrets.
2. Add the deploy SSH public key to the VPS user's `authorized_keys`.
3. Create the `RALabsDb` database on the target SQL Server.
4. Push to `main` — CI syncs, builds, deploys, health-checks.
5. Configure `APP_DOMAIN` DNS → VPS; issue SSL via the gateway (Let's
   Encrypt pattern from RMEnterpriseCMS).
