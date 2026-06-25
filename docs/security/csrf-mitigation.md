# CSRF mitigation

Zap's web API uses **Bearer JWT tokens** in the `Authorization` header (or `X-API-Key` for programmatic access). Tokens are stored in browser `localStorage`, not in cookies.

## Why this mitigates CSRF

Classic CSRF attacks trick a browser into sending **cookie-based** session credentials on cross-site requests. Because Zap does not use cookie-based API authentication, third-party sites cannot cause the browser to attach Zap credentials automatically.

## Client behavior

- `web/src/lib/api-browser.ts` attaches `Authorization: Bearer <token>` on each `apiFetch` call.
- The login endpoint (`POST /api/auth/login`) is the only unauthenticated write path under `/api` (besides dev-only public docs).

## If cookies are added in the future

1. Set `SameSite=Strict` (or `Lax` where redirects require it) on session cookies.
2. Add CSRF tokens (double-submit cookie or synchronizer token) for state-changing requests.
3. Keep `Authorization` header auth for API clients that do not use cookies.

## Related

- [token-storage.md](./token-storage.md)
- [hardening-plan.md](./hardening-plan.md)
