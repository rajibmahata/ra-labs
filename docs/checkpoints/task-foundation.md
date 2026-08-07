# Checkpoint: task-foundation

Date: 2026-08-07
Owner agents: solution-architect, backend-engineer, api-engineer, database-engineer, security-engineer, qa-engineer
Gate: Code Review + QA sign-off (backend builds, smoke suite passed)

## What was built

Backend foundation for the R&A Labs platform:

- **Domain** (`RALabs.Domain`): entities (AdminUser, Project, TeamMember,
  GithubSnapshot, Locale, PageContent, Lead, ChatThread/ChatMessage,
  AgentTask, KnowledgeChunk, + M2-4 customer entities), enums, repository
  interfaces, `CustomerProjectStateMachine` (ADR-005).
- **Application** (`RALabs.Application`): exception hierarchy
  (`AppException` + Validation/Unauthorized/Forbidden/NotFound/Conflict/
  RateLimited), error-code envelope, `Guard` validation helper
  (PestFlow-pattern, formalized), pagination, DTOs, services
  (Project/Team/Content/Lead/Chat/Auth) with per-field validation.
- **Infrastructure** (`RALabs.Infrastructure`): EF Core SqlServer DbContext
  + configs, repositories, `PasswordHasher` (PBKDF2-SHA256) + `JwtService`
  (HS256, 24h), DI (JWT bearer with `MapInboundClaims=false`, SqlServer +
  in-memory fallback), `DbInitializer` (migrations + seed), initial EF
  migration `InitialCreate`.
- **Api** (`RALabs.Api`): Minimal API endpoints under `/api/v1` (+ `/admin`),
  global exception middleware mapping to the `{error:{code,message}}`
  envelope, rate limiting (contact 5/min, chat 10/min, auth 10/min),
  `/health`, `/seed/full` (idempotent).

## Seed data (nothing hardcoded — data-driven)

- 11 locales: en, hi, bn, fr, es, ar, zh, pt, de, ja, ru
- 2 team members + 2 admin accounts: Rajib Mahata (rajiblabs.com resume),
  Abhishek Burnwal (LinkedIn: TCS AVP, ~10y Microsoft stack, Azure AI-102,
  Asansol). Both log in and self-edit their profiles via `/admin/team/me`.
- 10 portfolio projects from Rajib's GitHub (LexVault, DocSignerHub,
  AI Student Tutor, ARIA, FoodFleet, MedRemind, ArtForge, AI Resume
  Reviewer, RajibLabs Platform, AgentTube).
- 27 English content keys (hero, process, portfolio, team, contact, nav).

## Validation evidence

Ran API in-memory (`ASPNETCORE_ENVIRONMENT=Test`, empty connection string).
Smoke suite passed:

| Check | Result |
|---|---|
| `GET /health` | 200 healthy |
| `GET /api/v1/projects` (paginated) | 200, seeded data |
| `GET /api/v1/projects/lexvault` | 200 |
| `GET /api/v1/projects/nope` | 404 |
| `GET /api/v1/team`, `GET /api/v1/team/rajib-mahata` | 200 |
| `GET /api/v1/content?locale=en|hi` | 200 per locale |
| `GET /api/v1/locales` | 200 (11) |
| `POST /api/v1/auth/login` ok / bad pw | 200 / 401 |
| `GET /api/v1/admin/*` without token | 401 |
| `POST /api/v1/admin/projects` missing title | 400 VALIDATION_ERROR |
| `POST /api/v1/admin/content` duplicate | 409 CONFLICT |
| `PUT /api/v1/admin/team/me` self-edit → public page | reflected live |
| `POST /api/v1/leads` valid / invalid | 201 / 400 |
| Rate limit (6 rapid leads) | 201×5 then 429 |

## Decisions

- ADR-006: SQL Server Express (`RAJIB\SQLEXPRESS`, Windows auth) over
  PostgreSQL — supersedes ADR-001.
- Formalized PestFlow validation: exception hierarchy → global middleware →
  consistent envelope; no FluentValidation/DataAnnotations.
- EF Core migrations (not EnsureCreated) for schema; in-memory fallback for
  CI/dev-without-SQL.

## How to run / verify

```
cd backend
dotnet run --project RALabs.Api --urls http://localhost:5000
# with appsettings.json connection string → SQL Express Windows auth
# (empty DefaultConnection → in-memory)
curl http://localhost:5000/health
curl -X POST http://localhost:5000/seed/full   # idempotent re-seed
```
