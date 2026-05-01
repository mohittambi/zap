# Environment variables reference

**Canonical template:** `web/.env.local.example` (copy to `.env.local`). Never commit secrets.

## Core (required for local web)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs JWTs for `POST /api/auth/login` |
| `JWT_EXPIRY` | Optional (default `7d`) |

## Deployment / browser

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Optional; if the browser must call a different API origin |

## Supabase Storage (optional)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key — **server only**; used by `zapStorage.ts` |
| `ZAP_STORAGE_BUCKET_OUTBOUND` / `ZAP_STORAGE_BUCKET_INBOUND` | Bucket name overrides |

## eAutomate (optional — sync + proxy)

| Variable | Purpose |
|----------|---------|
| `EAUTOMATE_BASE_URL` | Default `https://web.eautomate.in` |
| `EAUTOMATE_COOKIE` | Session cookie string |
| `EAUTOMATE_BEARER_TOKEN` | Alternative auth header |
| `EAUTOMATE_LOGIN_USER_ID` / `EAUTOMATE_LOGIN_PASSWORD` | Programmatic login |
| `EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL` | Persist refreshed cookie to `.env.local` |
| `EAUTOMATE_FETCH_TIMEOUT_MS` | Bound long HTTP calls |

## See also

- [web-setup.md](web-setup.md)
- [../operations/sync-runbook.md](../operations/sync-runbook.md)
