# Auth service — overview

## Responsibility

- **Authenticate** HTTP requests to `/api/*` (except `POST /api/auth/login`).
- **Authorize** actions via RBAC: permissions are `(resource, action)` tuples attached to roles, assigned to users.

**Source code:** `web/src/server/auth.ts`, `web/src/server/rbac.ts`.

## Authentication mechanisms

| Mechanism | Header | Behavior |
|-----------|--------|----------|
| **JWT** | `Authorization: Bearer <jwt>` | Verified with `JWT_SECRET`. Payload uses `userId` or `sub` as numeric user id. |
| **API key** | `Authorization: Bearer <opaque>` (non-JWT shape) **or** `X-API-Key: <opaque>` | Compared with **bcrypt** against every non-null `users.api_key_hash` until match. |

**Note:** The legacy diagram in `web/docs/auth-flow.md` mentioned Basic/session-style paths; the **implemented** resolution is **JWT + API key only** (see `resolveAuthUser`).

## User model

After resolution, `AuthUser` contains:

- `id`, `email`
- `roles`: string role names from `user_roles` → `roles`
- `permissions`: distinct `{ resource, action }` from `role_permissions` → `permissions`

## Authorization

- `hasPermission(user, resource, action)` — exact match or wildcard `*/*`.
- `assertPermission(user, resource, action)` — throws `AppError` 403 when denied.

Routes typically call `requireAuth` then `assertPermission` with a resource such as `purchase_orders`, `listings`, etc.

## Dependencies

| Internal | External |
|----------|----------|
| `server/db.ts` (Postgres) | — |
| `server/errors.ts` (`AppError`) | — |
| `bcrypt`, `jsonwebtoken` | Env: `JWT_SECRET`, optional `JWT_EXPIRY` (used at login) |

## Edge cases

- **API key bcrypt scan:** Non-JWT tokens trigger a loop over users with `api_key_hash` set — acceptable for small user tables; may need optimization at very large scale.
- **Expired JWT:** Treated as unauthenticated (401), not refreshed automatically.
- **Missing permission rows:** User receives 403 for `assertPermission` even if authenticated.

## See also

- [api.md](api.md)
- [../../architecture/system-design.md](../../architecture/system-design.md)
