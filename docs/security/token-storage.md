# Token storage

## Web (Next.js)

JWT tokens are stored in **`localStorage`** under the key `zap_token` (`web/src/lib/api-browser.ts`).

| Aspect | Detail |
|--------|--------|
| Risk | Any XSS vulnerability can exfiltrate the token |
| Mitigation | Content-Security-Policy headers (`next.config.ts`), minimal `dangerouslySetInnerHTML`, Mermaid `securityLevel: "strict"` |
| Expiry | Configurable via `JWT_EXPIRY` (default 7 days) |
| Revocation | `users.token_invalidated_at` rejects JWTs issued before that timestamp (e.g. on account deactivation) |

### Future option

Migrating to **httpOnly, Secure, SameSite** cookies would reduce XSS token theft risk but requires CSRF protection for cookie-authenticated requests. See [csrf-mitigation.md](./csrf-mitigation.md).

## Mobile (React Native)

Tokens are stored in the **device Keychain** (`mobile/src/shared/auth/tokenStorage.ts`) with `ACCESSIBLE.WHEN_UNLOCKED`. This is the recommended pattern for native clients.

## API keys

API keys are shown once on generation (`POST /api/auth/refresh-api-key`). Only a bcrypt hash and a 12-character lookup prefix are stored server-side.

## Related

- [hardening-plan.md](./hardening-plan.md)
- [csrf-mitigation.md](./csrf-mitigation.md)
