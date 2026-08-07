# API: ra-labs

## Conventions

Follows `standards/api.md`. No deviations at this point.

| Convention | Application |
|---|---|
| Resource naming | Nouns, plural for collections; actions via HTTP method, not path verb |
| Status codes | 2xx success, 4xx client error, 5xx server error — no 200-with-error-payload |
| Response shape | Success: `{ "data": ... }` (object or array). Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| Input validation | Rejected at API boundary; 400 with a descriptive `error` payload |
| Internal leakage | Database column names and internal IDs never appear in the public contract |
| Pagination | Every collection endpoint supports `?page=` and `?pageSize=` (default 20, max 100). Response includes a `pagination` envelope |
| Idempotency | Resource-creation endpoints accept an optional `X-Idempotency-Key` header to prevent duplicate side effects on retry |

## Base URL

| Environment | URL | Notes |
|---|---|---|
| Local | `http://localhost:<port>/api/v1` | Port assigned by Docker Compose; inspect `docker-compose.yml` |
| Staging | TBD | |
| Production | TBD | |

## Authentication

**Scheme:** JWT bearer token (`Authorization: Bearer <token>`).

**Roles (claim `role`):**

| Role | Scope |
|---|---|
| `anonymous` | Visitors, unauthenticated chatbot users. Token optional; endpoints that allow anonymous accept unauthenticated requests. |
| `customer` | Registered customers. Token required. Scoped to their own resources (projects, threads, documents). |
| `admin` | Founders (Rajib, Abhishek). Token required. Full access to all resources and admin-only endpoints under `/api/v1/admin/`. |

**MCP authentication:** MCP tool calls authenticate with the same JWT role-scoped tokens as REST calls. No elevated access through the tool layer — the Application-layer authorization logic is identical for both REST and MCP paths. An MCP tool that requires the `admin` role returns the same 403 as its REST counterpart when called with a `customer` token.

**Token lifecycle:** Access tokens expire after 24 hours. A refresh token (returned at login) is valid for 7 days and can be exchanged for a new access token (not yet implemented in M1; deferred to M2).

## Versioning Strategy

- **Path-based:** All endpoints live under `/api/v1/`. A breaking change increments the version segment to `/api/v2/`.
- **Breaking change definition:** Removing a field, changing a field type, removing an endpoint, changing an HTTP method, or changing authentication requirements.
- **Non-breaking (no version bump):** Adding a new optional field to a response, adding a new endpoint, adding an optional query parameter.
- **Deprecation window:** A deprecated version (`/api/v1/`) remains live for at least one full milestone after `/api/v2/` ships, with a `Sunset` header announcing the removal date. Consumers are notified before removal.
- **MCP tool versioning:** MCP tool names do not carry a version prefix — the tool calls the latest active version by default. When v2 ships, v1 tools are deprecated with a deprecation notice in the tool description and removed on the same timeline as the REST sunset.

---

## Response Envelope (Shared)

Every endpoint in this document returns one of two shapes:

### Success

```json
{
  "data": { ... }         // single object, or array for collection endpoints
}
```

Collection endpoints additionally include:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 47,
    "totalPages": 3
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of what went wrong."
  }
}
```

Standard error codes:

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed request body or invalid query parameter |
| 401 | `UNAUTHORIZED` | Missing or expired token where authentication is required |
| 403 | `FORBIDDEN` | Valid token but insufficient role for the endpoint |
| 404 | `NOT_FOUND` | Resource does not exist or caller lacks visibility of it |
| 409 | `CONFLICT` | Duplicate resource (slug, email) or state-machine constraint violated |
| 429 | `RATE_LIMITED` | Too many requests — see rate-limiting notes on specific endpoints |
| 500 | `INTERNAL_ERROR` | Unhandled server failure; details logged, not exposed |

---

## Endpoints

### 1. Portfolio

Public portfolio of completed/shipped projects. Anonymous access for browsing; admin access for CRUD.

---

#### `GET /api/v1/projects`

**Auth:** anonymous (no token required)

**Purpose:** List published portfolio projects, ordered by `sort_order` ascending.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | int | No | 1 | Page number |
| `pageSize` | int | No | 20 | Items per page (max 100) |
| `tag` | string | No | — | Filter by stack tag (case-insensitive match) |

**Response `data`:** Array of project summary objects.

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "lexvault-rag-pipeline",
    "title": "LexVault RAG Pipeline",
    "summary": "Semantic retrieval paired with deterministic rules for legal documents.",
    "stackTags": ["dotnet", "qdrant", "react"],
    "status": "live",
    "coverImageUrl": "https://cdn.example.com/projects/lexvault-cover.jpg",
    "createdAt": "2025-12-01T10:00:00Z"
  }
]
```

**Errors:** Standard; 200 with empty array if no published projects.

**MCP tool:** `list_projects`

**Parameters (MCP):** `page` (int, optional), `pageSize` (int, optional), `tag` (string, optional)

---

#### `GET /api/v1/projects/{slug}`

**Auth:** anonymous (no token required)

**Purpose:** Full detail for a single published project.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `slug` | string | URL-safe project identifier, e.g. `lexvault-rag-pipeline` |

**Response `data`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "lexvault-rag-pipeline",
  "title": "LexVault RAG Pipeline",
  "summary": "Semantic retrieval paired with deterministic rules for legal documents.",
  "stackTags": ["dotnet", "qdrant", "react"],
  "status": "live",
  "githubUrl": "https://github.com/ra-labs/lexvault",
  "caseStudyBody": "## Overview\n\nFull markdown case study...",
  "coverImageUrl": "https://cdn.example.com/projects/lexvault-cover.jpg",
  "sortOrder": 1,
  "isPublished": true,
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2026-01-15T08:30:00Z"
}
```

**Errors:** Standard; 404 if the slug does not match any published project.

**MCP tool:** `get_project`

**Parameters (MCP):** `slug` (string, required)

---

#### `POST /api/v1/admin/projects`

**Auth:** admin

**Purpose:** Create a new portfolio project entry (published or draft).

**Request body:**

```json
{
  "title": "string (required, max 200)",
  "slug": "string (optional — auto-generated from title if omitted; max 100, unique)",
  "summary": "string (required, max 500)",
  "stackTags": ["string"],
  "status": "live | in_build (default: in_build)",
  "githubUrl": "string (optional, max 500)",
  "caseStudyBody": "string (optional, markdown)",
  "coverImageUrl": "string (optional, max 500)",
  "sortOrder": "int (optional, default 0)",
  "isPublished": "bool (optional, default false)"
}
```

**Response `data`:** The created project object (same shape as GET `/{slug}`).

**Status:** 201 Created

**Errors:** 400 (validation), 401, 403, 409 (duplicate slug)

**MCP tool:** `create_project`

**Parameters (MCP):** Same fields as request body, each as an individual parameter.

---

#### `PUT /api/v1/admin/projects/{id}`

**Auth:** admin

**Purpose:** Update an existing portfolio project. Sends a full replacement — omitted optional fields are cleared.

**Path parameters:** `id` — project GUID (UUID).

**Request body:** Same shape as POST (all writable fields).

**Response `data`:** The updated project object.

**Errors:** Standard; 404 if id not found.

**MCP tool:** `update_project`

**Parameters (MCP):** `id` (string, required) + all writable fields as optional parameters (only supplied fields are updated).

---

#### `DELETE /api/v1/admin/projects/{id}`

**Auth:** admin

**Purpose:** Soft-delete a portfolio project (sets `isPublished = false` and marks as deleted; not physically removed so existing references remain intact).

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:** `null`

**Status:** 204 No Content

**Errors:** 401, 403, 404

**MCP tool:** `delete_project`

**Parameters (MCP):** `id` (string, required)

---

### 2. Team

Public team profiles with GitHub activity snapshots. Anonymous access for browsing; admin CRUD for management.

---

#### `GET /api/v1/team`

**Auth:** anonymous (no token required)

**Purpose:** List all published team members.

**Response `data`:**

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "slug": "rajib-mahata",
    "name": "Rajib Mahata",
    "role": "Co-Founder & Engineer",
    "bio": "Short bio text.",
    "githubUsername": "rajibmahata",
    "avatarUrl": "https://cdn.example.com/team/rajib.jpg",
    "githubSnapshot": {
      "commits90d": 342,
      "activeRepos": 12,
      "lastCommitAt": "2026-08-06T07:15:00Z",
      "capturedAt": "2026-08-06T06:00:00Z"
    }
  }
]
```

**Errors:** Standard; 200 with empty array if no published members.

**MCP tool:** `list_team_members`

**Parameters (MCP):** None.

---

#### `GET /api/v1/team/{slug}`

**Auth:** anonymous (no token required)

**Purpose:** Full detail for a single team member.

**Path parameters:** `slug` — URL-safe name identifier, e.g. `rajib-mahata`.

**Response `data`:** Same shape as list item above, plus any additional fields (full bio markdown, social links if added later).

**Errors:** 404 if slug not found or member not published.

**MCP tool:** `get_team_member`

**Parameters (MCP):** `slug` (string, required)

---

#### `POST /api/v1/admin/team`

**Auth:** admin

**Purpose:** Add a team member profile.

**Request body:**

```json
{
  "name": "string (required, max 100)",
  "slug": "string (optional — auto-generated from name; unique)",
  "role": "string (required, max 100)",
  "bio": "string (required, markdown)",
  "githubUsername": "string (optional, max 100)",
  "avatarUrl": "string (optional, max 500)",
  "isPublished": "bool (optional, default false)"
}
```

**Response `data`:** The created team member object.

**Status:** 201 Created

**Errors:** 400, 401, 403, 409 (duplicate slug)

**MCP tool:** `create_team_member`

**Parameters (MCP):** Same fields as request body.

---

#### `PUT /api/v1/admin/team/{id}`

**Auth:** admin

**Purpose:** Update a team member profile (full replacement).

**Path parameters:** `id` — team member GUID (UUID).

**Request body:** Same shape as POST.

**Response `data`:** The updated object.

**Errors:** Standard; 404 if id not found.

**MCP tool:** `update_team_member`

**Parameters (MCP):** `id` (string, required) + writable fields as optional parameters (partial update).

---

#### `DELETE /api/v1/admin/team/{id}`

**Auth:** admin

**Purpose:** Remove a team member profile.

**Path parameters:** `id` — team member GUID (UUID).

**Status:** 204 No Content

**Errors:** 401, 403, 404

**MCP tool:** `delete_team_member`

**Parameters (MCP):** `id` (string, required)

---

### 3. Content

Multi-language page content (`PageContent` keyed by `key` + `locale`). Public read; admin CRUD.

---

#### `GET /api/v1/content`

**Auth:** anonymous (no token required)

**Purpose:** Retrieve all page content for a given locale. Used by the public site to render localized copy.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `locale` | string | Yes | — | ISO language code, e.g. `en`, `bn`, `hi` |

**Response `data`:**

```json
{
  "locale": "en",
  "content": {
    "hero.headline": "We build software that ships.",
    "hero.subheadline": "A two-founder engineering studio.",
    "process.step1.title": "Discuss",
    "process.step1.body": "We listen to what you need.",
    "...": "..."
  }
}
```

**Errors:** 400 if `locale` is missing or unsupported.

**MCP tool:** `get_content`

**Parameters (MCP):** `locale` (string, required)

---

#### `GET /api/v1/admin/content`

**Auth:** admin

**Purpose:** List all content entries, optionally filtered by locale.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `locale` | string | No | — | Filter by locale |
| `page` | int | No | 1 | Page number |
| `pageSize` | int | No | 50 | Items per page |

**Response `data`:**

```json
[
  {
    "key": "hero.headline",
    "locale": "en",
    "value": "We build software that ships.",
    "updatedAt": "2026-01-10T12:00:00Z"
  }
]
```

**MCP tool:** `list_content`

**Parameters (MCP):** `locale` (string, optional), `page` (int, optional), `pageSize` (int, optional)

---

#### `POST /api/v1/admin/content`

**Auth:** admin

**Purpose:** Create a new content entry for a given key and locale. If the `(key, locale)` pair already exists, returns 409 — use PUT to update.

**Request body:**

```json
{
  "key": "string (required, max 200)",
  "locale": "string (required, max 10, supported locale code)",
  "value": "string (required)"
}
```

**Response `data`:** The created content entry.

**Status:** 201 Created

**Errors:** 400, 401, 403, 409 (duplicate key+locale)

**MCP tool:** `create_content`

**Parameters (MCP):** `key` (string), `locale` (string), `value` (string) — all required.

---

#### `PUT /api/v1/admin/content/{key}`

**Auth:** admin

**Purpose:** Update the value of an existing content entry, identified by `key` + `locale` (locale in the request body). Creates the entry if it does not exist (upsert).

**Path parameters:** `key` — content key string.

**Request body:**

```json
{
  "locale": "string (required, max 10)",
  "value": "string (required)"
}
```

**Response `data`:** The updated (or created) content entry.

**Errors:** 400, 401, 403

**MCP tool:** `update_content`

**Parameters (MCP):** `key` (string, required), `locale` (string, required), `value` (string, required)

---

#### `DELETE /api/v1/admin/content/{key}`

**Auth:** admin

**Purpose:** Delete a content entry by key and locale.

**Path parameters:** `key` — content key string.

**Query parameters:** `locale` (string, required) — the locale of the entry to delete.

**Status:** 204 No Content

**Errors:** 400 (missing locale), 401, 403, 404

**MCP tool:** `delete_content`

**Parameters (MCP):** `key` (string, required), `locale` (string, required)

---

### 4. Leads

Visitor lead capture via contact form or chatbot. Rate-limited public submission; admin review and update.

---

#### `POST /api/v1/leads`

**Auth:** anonymous (no token required)

**Purpose:** Submit a lead from the public contact form or chatbot. Creates a `Lead` record and triggers an email notification to admins.

**Rate limiting:** 5 requests per minute per IP address (429 if exceeded).

**Request body:**

```json
{
  "name": "string (required, max 100)",
  "contactInfo": "string (required, email or phone, max 200)",
  "message": "string (required, max 2000)",
  "source": "form | chatbot (required)"
}
```

**Response `data`:**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "new",
  "createdAt": "2026-08-06T14:30:00Z"
}
```

**Status:** 201 Created

**Errors:** 400, 429

**MCP tool:** `submit_lead`

**Parameters (MCP):** `name` (string), `contactInfo` (string), `message` (string), `source` (string) — all required.

---

#### `GET /api/v1/admin/leads`

**Auth:** admin

**Purpose:** List leads, filterable by status. Sorted newest first.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | string | No | — | Filter: `new`, `contacted`, `converted`, `closed` |
| `source` | string | No | — | Filter: `form`, `chatbot` |
| `page` | int | No | 1 | |
| `pageSize` | int | No | 20 | |

**Response `data`:**

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Jane Doe",
    "contactInfo": "jane@example.com",
    "message": "I need a custom dashboard for my logistics company.",
    "source": "chatbot",
    "status": "new",
    "createdAt": "2026-08-06T14:30:00Z",
    "updatedAt": "2026-08-06T14:30:00Z"
  }
]
```

**MCP tool:** `list_unpublished_leads`

**Parameters (MCP):** `status` (string, optional), `source` (string, optional), `page` (int, optional), `pageSize` (int, optional)

---

#### `PATCH /api/v1/admin/leads/{id}`

**Auth:** admin

**Purpose:** Update lead status or notes. Used to mark a lead as contacted, converted to a customer project, or closed.

**Path parameters:** `id` — lead GUID (UUID).

**Request body (all fields optional — partial update):**

```json
{
  "status": "new | contacted | converted | closed",
  "notes": "string (optional, max 2000)"
}
```

**Response `data`:** The updated lead object.

**Errors:** 400 (invalid status transition), 401, 403, 404

**MCP tool:** `update_lead`

**Parameters (MCP):** `id` (string, required), `status` (string, optional), `notes` (string, optional)

---

### 5. Chat

Threaded conversations — public chatbot (visitor ↔ agent) and customer project threads (customer ↔ admin/agent). Anonymous access for public threads; authenticated for customer threads.

---

#### `GET /api/v1/chat/{threadId}`

**Auth:** anonymous for public chatbot threads; customer (thread owner) or admin for customer project threads

**Purpose:** Retrieve a chat thread with all its messages, ordered oldest first.

**Path parameters:** `threadId` — thread GUID (UUID).

**Response `data`:**

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "type": "lead",
  "needsManualIntervention": false,
  "customerProjectId": null,
  "createdAt": "2026-08-06T14:00:00Z",
  "messages": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "senderType": "visitor",
      "senderName": "Jane Doe",
      "content": "What tech stack do you use?",
      "attachmentUrl": null,
      "createdAt": "2026-08-06T14:00:05Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440005",
      "senderType": "agent",
      "senderName": "R&A Assistant",
      "content": "We primarily use .NET, React, and PostgreSQL — here are some projects that show our work.",
      "attachmentUrl": null,
      "createdAt": "2026-08-06T14:00:08Z"
    }
  ]
}
```

**MCP tool:** `get_thread`

**Parameters (MCP):** `threadId` (string, required)

---

#### `POST /api/v1/chat/{threadId}/messages`

**Auth:** anonymous for public chatbot threads; customer (thread owner) for customer project threads

**Purpose:** Send a message into a thread. The system processes the message through the agent pipeline (RAG retrieval + deterministic rules) and appends an agent response to the thread. If the agent cannot answer or the message requires a transactional commitment, `needsManualIntervention` is set to `true` on the thread.

**Rate limiting:** 10 requests per minute per thread (429 if exceeded).

**Path parameters:** `threadId` — thread GUID (UUID).

**Request body:**

```json
{
  "content": "string (required, max 5000)",
  "attachmentUrl": "string (optional, max 500)"
}
```

**Response `data`:** The created user message object (the agent response is appended asynchronously and returned in the next GET call — or, if synchronous processing is implemented, both messages are returned together).

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440006",
  "threadId": "880e8400-e29b-41d4-a716-446655440003",
  "senderType": "visitor",
  "senderName": "Jane Doe",
  "content": "Can you give me a quote?",
  "attachmentUrl": null,
  "createdAt": "2026-08-06T14:05:00Z"
}
```

**Status:** 201 Created

**Errors:** 400, 404 (thread not found), 429

**MCP tool:** `send_message`

**Parameters (MCP):** `threadId` (string, required), `content` (string, required), `attachmentUrl` (string, optional)

---

#### `GET /api/v1/admin/chat`

**Auth:** admin

**Purpose:** List all chat threads across the platform, filterable by type and intervention flag. Sorted by most recent activity.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | string | No | — | `lead` or `customer_project` |
| `needsManualIntervention` | bool | No | — | Filter for threads flagged for admin attention |
| `page` | int | No | 1 | |
| `pageSize` | int | No | 20 | |

**Response `data`:** Array of thread summary objects (without full message history — use GET `/{threadId}` for messages).

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "type": "lead",
    "needsManualIntervention": true,
    "customerProjectId": null,
    "lastMessageAt": "2026-08-06T14:05:00Z",
    "messageCount": 12,
    "createdAt": "2026-08-06T14:00:00Z"
  }
]
```

**MCP tool:** `list_threads`

**Parameters (MCP):** `type` (string, optional), `needsManualIntervention` (bool, optional), `page` (int, optional), `pageSize` (int, optional)

---

#### `PATCH /api/v1/admin/chat/{threadId}`

**Auth:** admin

**Purpose:** Update thread metadata — typically to clear the `needsManualIntervention` flag after an admin has responded.

**Path parameters:** `threadId` — thread GUID (UUID).

**Request body (all fields optional — partial update):**

```json
{
  "needsManualIntervention": false
}
```

**Response `data`:** The updated thread object (summary shape, without messages).

**MCP tool:** `update_thread`

**Parameters (MCP):** `threadId` (string, required), `needsManualIntervention` (bool, optional)

---

### 6. Auth

Authentication and account management. All endpoints are unauthenticated (anonymous) — they produce or refresh credentials.

---

#### `POST /api/v1/auth/register`

**Auth:** anonymous

**Purpose:** Register a new customer account. Sends a welcome email.

**Request body:**

```json
{
  "name": "string (required, max 100)",
  "email": "string (required, max 200, valid email)",
  "password": "string (required, min 8, max 100)"
}
```

**Response `data`:**

```json
{
  "customerId": "aa0e8400-e29b-41d4-a716-446655440007",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "createdAt": "2026-08-06T15:00:00Z"
}
```

**Status:** 201 Created

**Errors:** 400 (validation, weak password), 409 (email already registered)

**MCP tool:** `register_customer`

**Parameters (MCP):** `name` (string), `email` (string), `password` (string) — all required.

---

#### `POST /api/v1/auth/login`

**Auth:** anonymous

**Purpose:** Authenticate and receive a JWT access token (24h expiry) and refresh token (7d expiry).

**Request body:**

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response `data`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
  "expiresAt": "2026-08-07T15:00:00Z",
  "customer": {
    "id": "aa0e8400-e29b-41d4-a716-446655440007",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "customer"
  }
}
```

**Note on admin login:** Admin accounts are pre-seeded (not self-registered). The same `/login` endpoint returns `role: "admin"` when the credentials match an admin account.

**Errors:** 401 (invalid credentials — message does not distinguish between unknown email and wrong password)

**MCP tool:** `login`

**Parameters (MCP):** `email` (string, required), `password` (string, required)

---

#### `POST /api/v1/auth/forgot-password`

**Auth:** anonymous

**Purpose:** Initiate password reset. Sends a reset link to the registered email if the account exists. Always returns 200 to prevent email enumeration (the response is identical whether or not the email is registered).

**Request body:**

```json
{
  "email": "string (required)"
}
```

**Response `data`:** `null`

**Status:** 200 OK (always — see note above)

**Errors:** 400 (missing or malformed email)

**MCP tool:** `forgot_password`

**Parameters (MCP):** `email` (string, required)

---

### 7. Customer Projects

The core of the client-delivery workflow. Customer-owned projects with admin oversight.

---

#### `GET /api/v1/customer-projects`

**Auth:** customer (token required)

**Purpose:** List the authenticated customer's own projects.

**Query parameters:** `page`, `pageSize` (standard).

**Response `data`:**

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440008",
    "title": "Logistics Dashboard",
    "status": "in_build",
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-08-05T16:00:00Z"
  }
]
```

**MCP tool:** `list_customer_projects`

**Parameters (MCP):** `page` (int, optional), `pageSize` (int, optional)

---

#### `POST /api/v1/customer-projects`

**Auth:** customer (token required)

**Purpose:** Create a new project under the authenticated customer's account. Accepts an `X-Idempotency-Key` header.

**Request body:**

```json
{
  "title": "string (required, max 200)"
}
```

**Response `data`:** The created project object (includes auto-created `ChatThread` id).

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440008",
  "title": "Logistics Dashboard",
  "status": "intake",
  "chatThreadId": "cc0e8400-e29b-41d4-a716-446655440009",
  "createdAt": "2026-08-06T16:00:00Z"
}
```

**Status:** 201 Created

**MCP tool:** `create_customer_project`

**Parameters (MCP):** `title` (string, required), `idempotencyKey` (string, optional)

---

#### `GET /api/v1/customer-projects/{id}`

**Auth:** customer (project owner) or admin

**Purpose:** Full detail of a customer project, including status, thread reference, document count, and PRD sign status.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:**

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440008",
  "title": "Logistics Dashboard",
  "status": "prd_draft",
  "chatThreadId": "cc0e8400-e29b-41d4-a716-446655440009",
  "documentCount": 3,
  "prdStatus": "draft",
  "demoUrl": null,
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-08-05T16:00:00Z"
}
```

**Errors:** 404 if project does not exist or the customer does not own it (same 404 to avoid leaking existence).

**MCP tool:** `get_customer_project`

**Parameters (MCP):** `id` (string, required)

---

#### `GET /api/v1/admin/customer-projects`

**Auth:** admin

**Purpose:** List all customer projects across all customers.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | string | No | — | Filter by status: `intake`, `prd_draft`, `prd_signed`, `in_build`, `demo`, `delivered`, `closed` |
| `customerId` | string | No | — | Filter by customer GUID |
| `page` | int | No | 1 | |
| `pageSize` | int | No | 20 | |

**Response `data`:** Array of project summary objects (same shape as customer GET list, plus `customerId` and `customerName`).

**MCP tool:** `list_all_customer_projects`

**Parameters (MCP):** `status` (string, optional), `customerId` (string, optional), `page` (int, optional), `pageSize` (int, optional)

---

#### `GET /api/v1/admin/customer-projects/{id}`

**Auth:** admin

**Purpose:** Admin view of a customer project — identical data to the customer GET `/{id}` plus internal fields (admin notes, internal status flags).

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:** Same as customer GET `/{id}`, plus `adminNotes` (string, nullable).

**MCP tool:** `get_customer_project` *(same tool name as customer endpoint — auth scope determines visibility of admin-only fields)*

**Parameters (MCP):** `id` (string, required)

---

#### `PATCH /api/v1/admin/customer-projects/{id}`

**Auth:** admin

**Purpose:** Update project status and admin notes. The status transition is validated against the allowed state machine: `intake → prd_draft → prd_signed → in_build → demo → delivered → closed`.

**Path parameters:** `id` — project GUID (UUID).

**Request body (all fields optional — partial update):**

```json
{
  "status": "prd_draft",
  "adminNotes": "string (optional, max 5000)"
}
```

**Response `data`:** The updated project object.

**Errors:** 400 (invalid status transition), 401, 403, 404

**MCP tool:** `update_customer_project`

**Parameters (MCP):** `id` (string, required), `status` (string, optional), `adminNotes` (string, optional)

---

### 8. Documents

File uploads attached to a customer project. Customer uploads; admin can list and manage.

---

#### `POST /api/v1/customer-projects/{id}/documents`

**Auth:** customer (project owner)

**Purpose:** Upload a document (requirement doc, sketch, screenshot) to a project. The file is stored and ingested into the per-project RAG knowledge base if it contains indexable text.

**Path parameters:** `id` — project GUID (UUID).

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | The uploaded file (max 25 MB; accepted types: pdf, png, jpg, docx, txt, md) |
| `description` | string | No | Optional label for the document |

**Response `data`:**

```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440010",
  "fileName": "requirements-v2.pdf",
  "fileUrl": "https://cdn.example.com/documents/dd0e.../requirements-v2.pdf",
  "description": "Updated requirements doc",
  "uploadedBy": "customer",
  "createdAt": "2026-08-06T17:00:00Z"
}
```

**Status:** 201 Created

**Errors:** 400 (invalid file type or size), 401, 403, 404

**MCP tool:** `upload_document`

**Note (MCP):** MCP tool calls pass the file as a base64-encoded string parameter (`fileBase64`) plus `fileName` and `contentType`, since MCP does not support multipart natively. The REST multipart path remains the primary upload mechanism for frontends.

**Parameters (MCP):** `projectId` (string, required), `fileBase64` (string, required), `fileName` (string, required), `contentType` (string, required), `description` (string, optional)

---

#### `GET /api/v1/admin/customer-projects/{id}/documents`

**Auth:** admin

**Purpose:** List all documents attached to a customer project.

**Path parameters:** `id` — project GUID (UUID).

**Query parameters:** `page`, `pageSize` (standard).

**Response `data`:** Array of document objects.

**MCP tool:** `list_documents`

**Parameters (MCP):** `projectId` (string, required), `page` (int, optional), `pageSize` (int, optional)

---

### 9. Client PRD

The client-deliverable Product Requirements Document. Admin drafts, customer reviews and signs.

---

#### `GET /api/v1/customer-projects/{id}/prd`

**Auth:** customer (project owner) or admin

**Purpose:** Retrieve the client PRD for a project, including current status and sign-off timestamps.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:**

```json
{
  "id": "ee0e8400-e29b-41d4-a716-446655440011",
  "projectId": "bb0e8400-e29b-41d4-a716-446655440008",
  "content": "## Overview\n\nLogistics Dashboard is a real-time...",
  "status": "draft",
  "signedAtCustomer": null,
  "signedAtAdmin": null,
  "createdAt": "2026-08-01T10:00:00Z",
  "updatedAt": "2026-08-05T14:00:00Z"
}
```

**Errors:** 404 if no PRD exists yet for the project.

**MCP tool:** `get_prd`

**Parameters (MCP):** `projectId` (string, required)

---

#### `PUT /api/v1/customer-projects/{id}/prd`

**Auth:** admin

**Purpose:** Create or update the client PRD content. This is how the admin (with agent drafting assistance) writes and revises the PRD. After a PRD has been signed by either party, further edits require re-signing (both `signedAt` timestamps are cleared).

**Path parameters:** `id` — project GUID (UUID).

**Request body:**

```json
{
  "content": "string (required, markdown)"
}
```

**Response `data`:** The updated PRD object. If previously signed, both `signedAt*` fields reset to `null` and `status` returns to `draft`.

**Errors:** 400, 401, 403, 404

**MCP tool:** `update_prd`

**Parameters (MCP):** `projectId` (string, required), `content` (string, required)

---

#### `POST /api/v1/customer-projects/{id}/prd/sign`

**Auth:** customer (project owner)

**Purpose:** Customer signs off on the client PRD. This records the customer's name and timestamp. The project status advances to `prd_signed` once both customer and admin have signed independently (admin signs via the admin endpoint, which is the same PUT above with an admin token, or a dedicated admin sign endpoint TBD).

**Path parameters:** `id` — project GUID (UUID).

**Request body:**

```json
{
  "confirmName": "string (required, must match the customer's registered name)"
}
```

**Response `data`:** The updated PRD object with `signedAtCustomer` set.

**Errors:** 400 (name mismatch), 401, 403, 404, 409 (PRD not in signable state — must be in `draft` status and not already signed by customer)

**MCP tool:** `sign_prd`

**Parameters (MCP):** `projectId` (string, required), `confirmName` (string, required)

---

### 10. Demos

Admin shares a demo (screenshot or URL) with the customer once a project reaches `in_build`.

---

#### `POST /api/v1/admin/customer-projects/{id}/demo`

**Auth:** admin

**Purpose:** Add a demo record for a customer project. The project must be in `in_build` status or later.

**Path parameters:** `id` — project GUID (UUID).

**Request body:**

```json
{
  "type": "screenshot | url (required)",
  "urlOrAsset": "string (required, max 500 — URL or asset reference)",
  "notes": "string (optional, max 2000)"
}
```

**Response `data`:** The created demo object.

```json
{
  "id": "ff0e8400-e29b-41d4-a716-446655440012",
  "projectId": "bb0e8400-e29b-41d4-a716-446655440008",
  "type": "url",
  "urlOrAsset": "https://demo.example.com/logistics-preview",
  "notes": "First iteration — dashboard with real-time tracking.",
  "createdAt": "2026-08-06T18:00:00Z"
}
```

**Status:** 201 Created

**Errors:** 400, 401, 403, 404, 409 (project not in a demo-eligible status)

**MCP tool:** `create_demo`

**Parameters (MCP):** `projectId` (string, required), `type` (string, required), `urlOrAsset` (string, required), `notes` (string, optional)

---

#### `GET /api/v1/customer-projects/{id}/demo`

**Auth:** customer (project owner) or admin

**Purpose:** Retrieve the latest demo for a project. Returns the most recently created demo record.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:** The demo object (same shape as POST response).

**Errors:** 404 if no demo exists for the project.

**MCP tool:** `get_demo`

**Parameters (MCP):** `projectId` (string, required)

---

### 11. Invoices

Per-project invoicing. Admin creates and views; customer views their own.

---

#### `GET /api/v1/admin/customer-projects/{id}/invoice`

**Auth:** admin

**Purpose:** List all invoices for a customer project.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:**

```json
[
  {
    "id": "gg0e8400-e29b-41d4-a716-446655440013",
    "projectId": "bb0e8400-e29b-41d4-a716-446655440008",
    "amount": 5000.00,
    "currency": "USD",
    "status": "unpaid",
    "notes": "Milestone 1 — architecture phase.",
    "createdAt": "2026-08-01T10:00:00Z",
    "updatedAt": "2026-08-01T10:00:00Z"
  }
]
```

**MCP tool:** `list_invoices`

**Parameters (MCP):** `projectId` (string, required)

---

#### `POST /api/v1/admin/customer-projects/{id}/invoice`

**Auth:** admin

**Purpose:** Create a new invoice for a customer project. Accepts an `X-Idempotency-Key` header.

**Path parameters:** `id` — project GUID (UUID).

**Request body:**

```json
{
  "amount": "number (required, > 0, max 99999999.99)",
  "currency": "string (required, ISO 4217, e.g. USD, INR)",
  "status": "unpaid | paid_cash (default: unpaid)",
  "notes": "string (optional, max 2000)"
}
```

**Response `data`:** The created invoice object.

**Status:** 201 Created

**MCP tool:** `create_invoice`

**Parameters (MCP):** `projectId` (string, required), `amount` (number, required), `currency` (string, required), `status` (string, optional), `notes` (string, optional), `idempotencyKey` (string, optional)

---

#### `GET /api/v1/customer-projects/{id}/invoice`

**Auth:** customer (project owner)

**Purpose:** Customer views their own invoices for a project.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:** Same shape as admin GET (array of invoice objects).

**MCP tool:** `list_invoices` *(same tool name — auth scope restricts to customer's own projects)*

**Parameters (MCP):** `projectId` (string, required)

---

### 12. Feedback

Post-delivery customer feedback that feeds back into the public portfolio.

---

#### `POST /api/v1/customer-projects/{id}/feedback`

**Auth:** customer (project owner)

**Purpose:** Submit feedback after a project reaches `closed`. The feedback is reviewed by admin before being published to the public portfolio.

**Path parameters:** `id` — project GUID (UUID).

**Request body:**

```json
{
  "rating": "int (required, 1–5)",
  "comment": "string (required, max 2000)",
  "consentToPublish": "bool (required)"
}
```

**Response `data`:**

```json
{
  "id": "hh0e8400-e29b-41d4-a716-446655440014",
  "projectId": "bb0e8400-e29b-41d4-a716-446655440008",
  "rating": 5,
  "comment": "Amazing work — the dashboard transformed our operations.",
  "isPublished": false,
  "createdAt": "2026-08-06T19:00:00Z"
}
```

**Status:** 201 Created

**Errors:** 400, 401, 403, 404, 409 (project not in `closed` status, or feedback already submitted)

**MCP tool:** `submit_feedback`

**Parameters (MCP):** `projectId` (string, required), `rating` (int, required), `comment` (string, required), `consentToPublish` (bool, required)

---

#### `GET /api/v1/admin/customer-projects/{id}/feedback`

**Auth:** admin

**Purpose:** Retrieve feedback for a project. Admin reviews and sets `isPublished = true` to surface it on the public portfolio.

**Path parameters:** `id` — project GUID (UUID).

**Response `data`:** The feedback object (same shape as POST response).

**MCP tool:** `get_feedback`

**Parameters (MCP):** `projectId` (string, required)

---

## Quick Reference: Endpoint to MCP Tool Map

| # | Method | Path | MCP Tool |
|---|---|---|---|
| 1 | GET | `/api/v1/projects` | `list_projects` |
| 2 | GET | `/api/v1/projects/{slug}` | `get_project` |
| 3 | POST | `/api/v1/admin/projects` | `create_project` |
| 4 | PUT | `/api/v1/admin/projects/{id}` | `update_project` |
| 5 | DELETE | `/api/v1/admin/projects/{id}` | `delete_project` |
| 6 | GET | `/api/v1/team` | `list_team_members` |
| 7 | GET | `/api/v1/team/{slug}` | `get_team_member` |
| 8 | POST | `/api/v1/admin/team` | `create_team_member` |
| 9 | PUT | `/api/v1/admin/team/{id}` | `update_team_member` |
| 10 | DELETE | `/api/v1/admin/team/{id}` | `delete_team_member` |
| 11 | GET | `/api/v1/content` | `get_content` |
| 12 | GET | `/api/v1/admin/content` | `list_content` |
| 13 | POST | `/api/v1/admin/content` | `create_content` |
| 14 | PUT | `/api/v1/admin/content/{key}` | `update_content` |
| 15 | DELETE | `/api/v1/admin/content/{key}` | `delete_content` |
| 16 | POST | `/api/v1/leads` | `submit_lead` |
| 17 | GET | `/api/v1/admin/leads` | `list_unpublished_leads` |
| 18 | PATCH | `/api/v1/admin/leads/{id}` | `update_lead` |
| 19 | GET | `/api/v1/chat/{threadId}` | `get_thread` |
| 20 | POST | `/api/v1/chat/{threadId}/messages` | `send_message` |
| 21 | GET | `/api/v1/admin/chat` | `list_threads` |
| 22 | PATCH | `/api/v1/admin/chat/{threadId}` | `update_thread` |
| 23 | POST | `/api/v1/auth/register` | `register_customer` |
| 24 | POST | `/api/v1/auth/login` | `login` |
| 25 | POST | `/api/v1/auth/forgot-password` | `forgot_password` |
| 26 | GET | `/api/v1/customer-projects` | `list_customer_projects` |
| 27 | POST | `/api/v1/customer-projects` | `create_customer_project` |
| 28 | GET | `/api/v1/customer-projects/{id}` | `get_customer_project` |
| 29 | GET | `/api/v1/admin/customer-projects` | `list_all_customer_projects` |
| 30 | GET | `/api/v1/admin/customer-projects/{id}` | `get_customer_project` |
| 31 | PATCH | `/api/v1/admin/customer-projects/{id}` | `update_customer_project` |
| 32 | POST | `/api/v1/customer-projects/{id}/documents` | `upload_document` |
| 33 | GET | `/api/v1/admin/customer-projects/{id}/documents` | `list_documents` |
| 34 | GET | `/api/v1/customer-projects/{id}/prd` | `get_prd` |
| 35 | PUT | `/api/v1/customer-projects/{id}/prd` | `update_prd` |
| 36 | POST | `/api/v1/customer-projects/{id}/prd/sign` | `sign_prd` |
| 37 | POST | `/api/v1/admin/customer-projects/{id}/demo` | `create_demo` |
| 38 | GET | `/api/v1/customer-projects/{id}/demo` | `get_demo` |
| 39 | GET | `/api/v1/admin/customer-projects/{id}/invoice` | `list_invoices` |
| 40 | POST | `/api/v1/admin/customer-projects/{id}/invoice` | `create_invoice` |
| 41 | GET | `/api/v1/customer-projects/{id}/invoice` | `list_invoices` |
| 42 | POST | `/api/v1/customer-projects/{id}/feedback` | `submit_feedback` |
| 43 | GET | `/api/v1/admin/customer-projects/{id}/feedback` | `get_feedback` |

---

## Rate Limiting Summary

| Endpoint | Limit | Scope | Status |
|---|---|---|---|
| `POST /api/v1/leads` | 5 req/min | Per IP | 429 |
| `POST /api/v1/chat/{threadId}/messages` | 10 req/min | Per thread | 429 |

Rate limit headers are included on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Idempotency Summary

Endpoints that accept the `X-Idempotency-Key` header:

| Endpoint | Header |
|---|---|
| `POST /api/v1/customer-projects` | `X-Idempotency-Key` |
| `POST /api/v1/admin/customer-projects/{id}/invoice` | `X-Idempotency-Key` |

The key is stored for 24 hours. Re-sending the same key returns the original 201 response without creating a duplicate resource.
