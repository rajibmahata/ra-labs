# Super Admin Account (Development / Test Only)

The platform seeds two admin accounts on first startup. The **super admin**
account exists so the full AI & Voice settings and Audit Log can be exercised.

> These credentials are for local development and test environments only.
> Production deployments must change the super admin email and password and
> must not reuse these defaults. Never commit real credentials.

| Role | Email | Password | Notes |
|---|---|---|---|
| Super admin | `rajib@ralabs.dev` | `Admin@1234` | Full access incl. AI & Voice settings, Audit Log, granting the `super_admin` role |
| Admin | `abhishek@ralabs.dev` | `Admin@1234` | Standard admin; cannot edit settings or view the audit log |

## Where they are seeded

- `backend/RALabs.Infrastructure/DbInitializer.cs` (~line 85) — super admin seed.
- Passwords are stored as salted hashes (`IPasswordHasher`), never in plain text.

## Privileges enforced server-side

| Capability | `admin` | `super_admin` |
|---|---|---|
| Admin CRUD | – | ✔ (create / activate-deactivate) |
| Grant `super_admin` role | – | ✔ |
| AI & Voice settings (`GET/PUT /api/v1/admin/settings`) | – | ✔ |
| Audit Log (`GET /api/v1/admin/audit-logs`) | – | ✔ |
| Portfolio / team / content / chat / RAG / GitHub | ✔ | ✔ |
| MCP admin tools | ✔ | ✔ (role hierarchy: super_admin satisfies admin) |

## Reset a forgotten password

1. Use `POST /api/v1/auth/forgot-password` (sends a reset code via SMTP) or
2. In a scratch script against the database, re-hash with `IPasswordHasher`
   and update `AdminUsers.PasswordHash`.

## Audit trail

Privileged actions (logins, admin CRUD, settings changes, portfolio/team
mutations, draft reviews, RAG ingests, GitHub syncs, customer status changes)
are recorded in the `AuditLogs` table and visible under **Settings → Audit Log**
for super admins.
