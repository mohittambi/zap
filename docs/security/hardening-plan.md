# Zap Security Hardening Plan

All 27 security gaps from the audit are fixed in 6 phases, ordered by risk severity. Each phase lists specific code changes, migrations (if needed), acceptance criteria, and test cases.

**Test infrastructure:** Node built-in `node:test` + `tsx` runner. Unit tests in `web/tests/unit/`, API tests in `web/tests/api/`. Security tests use `web/tests/unit/security-*.test.ts`.

**Migration:** `070_security_hardening.sql`

**Verify:** `npm run verify:migrations` (registry parity) and `npm run migrate` (applies SQL + post-check for 070 objects). See [`../deployment/migrations.md`](../deployment/migrations.md).

## Phase 1 — Critical Secrets (Items 1, 2, 3, 20)

### 1.1 Remove JWT secret fallback + generate new secret

- `web/src/server/auth.ts` — `getJwtSecret()` throws if `JWT_SECRET` is missing
- `web/src/app/api/auth/login/route.ts` — imports `getJwtSecret()` (no duplicate constant)
- `web/.env` — new 64-char hex `JWT_SECRET`
- `web/.env.local.example` — empty `JWT_SECRET=` with generation instructions

**DB impact:** Rotating `JWT_SECRET` invalidates all existing JWTs. Users must re-login. Password hashes unchanged.

**Acceptance criteria:**
- App refuses to start/sign tokens if `JWT_SECRET` is missing
- `.env` contains a randomly generated secret
- `.env.local.example` documents generation

**Tests:** `tests/unit/security-auth.test.ts`

### 1.2 Verify `.env` never committed

Run `git log --all -- web/.env`. If committed, rotate DB password and scrub history.

### 1.3 Rotate hardcoded sync bearer token

- `web/src/config/schedulers.ts` — reads `SHEETS_SYNC_BEARER_TOKEN` from env
- `web/src/app/api/sync/sheets/route.ts` — empty token disables cron bypass
- `web/.env` — new `SHEETS_SYNC_BEARER_TOKEN`

**Tests:** `tests/unit/security-scheduler.test.ts`

---

## Phase 2 — Authentication Hardening (Items 4, 7, 8, 12)

### 2.1 Rate limiting on login

- `web/src/server/lib/rateLimiter.ts` — in-memory sliding window
- `web/src/app/api/auth/login/route.ts` — 5 attempts per IP per 60s, 429 + `Retry-After`

**Tests:** `tests/unit/security-rate-limiter.test.ts`

### 2.2 Global auth middleware

- `web/src/middleware.ts` — 401 on `/api/**` without `Authorization` or `X-API-Key` (except public paths)

**Tests:** `tests/api/security-middleware.test.mjs`, `tests/api/security-headers.test.mjs`

### 2.3 API key prefix (O(1) lookup)

- Migration `070` — `users.api_key_prefix`
- `web/src/server/auth.ts` — prefix lookup with legacy fallback scan
- `web/src/app/api/auth/refresh-api-key/route.ts` — stores prefix

### 2.4 Token invalidation

- Migration `070` — `users.token_invalidated_at`
- `web/src/server/auth.ts` — reject JWT if `iat` < `token_invalidated_at`
- `web/src/app/api/admin/users/[id]/route.ts` — set on deactivation

**Tests:** `tests/unit/security-auth.test.ts`

---

## Phase 3 — Security Headers and CORS (Items 6, 9, 16, 19)

### 3.1 Security headers in `next.config.ts`

`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`, `CSP`

### 3.2 SSL — `db.ts` uses `ssl: true` (system CA store)

### 3.3 HTTPS-only `images.remotePatterns`

---

## Phase 4 — Authorization and Access Control (Items 10, 15, 21, 22, 24, 25, 5)

- Debug endpoint admin-only
- 500 errors return generic message (`errors.ts`)
- Forms IDOR fixes
- `/api/api-docs` protected in production
- Custom query builder requires `query_builder:read`
- `refresh-api-key` uses `assertPermission(user, "*", "*")`
- `web/docs/security/csrf-mitigation.md`

**Tests:** `tests/unit/errors.test.ts`, `tests/unit/security-forms-idor.test.ts`, `tests/unit/security-api-docs.test.ts`

---

## Phase 5 — Upload and Input Hardening (Items 11, 13, 14, 23, 27)

- Mermaid `securityLevel: "strict"`
- `web/src/server/lib/uploadGuards.ts` — size/type checks on upload routes
- Debit-note upload validation
- Fetch timeouts on external calls
- `npm audit` for `xlsx`

**Tests:** `tests/unit/security-upload-guards.test.ts`

---

## Phase 6 — Low Priority (Items 17, 18, 26)

- `web/docs/security/token-storage.md`
- `admin_audit_log` table + `adminAuditService.ts`
- `.gitignore` — `mobile/.env`

**Tests:** `tests/unit/security-admin-audit.test.ts`

---

## Migration 070

See `web/migrations/070_security_hardening.sql` for:
- `users.api_key_prefix`
- `users.token_invalidated_at`
- `query_builder:read` permission (admin role)
- `admin_audit_log` table

---

## Implementation order

1. Write this document
2. Phases 1–6 in order
3. Apply migration 070
4. Run `npm run test:unit` and `npm run test:api`
