# Auth service — API

Base path: `/api/auth`

| Method | Path | Auth | Description |
|--------|------|--------|-------------|
| POST | `/auth/login` | Public | Email + password → JWT and user |
| GET | `/auth/me` | Bearer or API key | Current user + roles (via `loadUserWithRoles`) |
| POST | `/auth/refresh-api-key` | Bearer | Issues new API key (implementation restricts by permission — see route) |

## POST /api/auth/login

**Request (JSON):**

```json
{ "email": "user@example.com", "password": "secret" }
```

**Success:** JSON with `token` (JWT) and `user` object.

**Errors:** 401 invalid credentials; 400 malformed body.

## GET /api/auth/me

**Headers:** `Authorization: Bearer <jwt>` or API key as documented in [overview.md](overview.md).

**Success:** User profile suitable for UI (shape defined in route handler).

**Errors:** 401 if missing/invalid auth.

## POST /api/auth/refresh-api-key

Regenerates a long-lived API key for automation clients. Requires authenticated user and appropriate RBAC (see `web/src/app/api/auth/refresh-api-key/route.ts`).

**Success:** Returns new key **once** — store securely; only the hash is persisted.

## Error shape

Aligned with app convention: `{ "error": "message", "code?": "..." }` with 4xx/5xx status.
