# Supabase + Vercel

Zap’s `web` app uses **PostgreSQL via `pg`** and a single **`DATABASE_URL`**. There is **no** `@supabase/supabase-js` client in this repo today—you point `DATABASE_URL` at Supabase’s Postgres (or any hosted Postgres).

## 1. Connection string (Postgres)

In the Supabase dashboard: **Project → Connect** (or **Database → Settings**, scroll to **Connection string**). Copy the URI Supabase shows — it includes a **`[YOUR-PASSWORD]`** placeholder you replace with your database password (**Database → Settings → Database password** / reset if needed).

**Wrong host (common mistake):** `https://<ref>.supabase.co` is the **project / REST** URL. Postgres **direct** host is always **`db.<ref>.supabase.co`**, not `<ref>.supabase.co`. Using the non-`db.` hostname for `postgresql://…:5432` often hits CDN/edge IPs (e.g. Cloudflare) and ends in **`ETIMEDOUT`**, not a password error.

Hostnames and ports differ by mode; **always use the string from the dashboard** rather than hand-building URLs.

Supabase typically offers three styles:

| Mode | Typical use | Notes |
| ---- | ----------- | ----- |
| **Direct** | Long-lived clients, some migration tools | Host often `db.<project-ref>.supabase.co`, port **5432**. May require **IPv6** on some networks. |
| **Pooler — session** | Persistent connections when you need **IPv4** | Through Supabase’s pooler in **session** mode; host often `aws-0-<region>.pooler.supabase.com` with a **project-specific user** (e.g. `postgres.<ref>`). |
| **Pooler — transaction** | **Serverless** / short-lived connections | Port often **6543** — best default for **Vercel** Route Handlers and `pg` opening many short connections. |

**Zap-specific picks:**

- **Vercel production** — use **transaction pooler** (`…:6543` / transaction mode) for `DATABASE_URL` unless Supabase’s Connect UI recommends otherwise.
- **Local `npm run dev`** — direct or session pooler is fine; transaction pooler often works too.
- **`npm run migrate` from your laptop** — if a migration fails through the transaction pooler, retry with the **direct** `5432` URI once, then switch back to the pooler for runtime if you prefer.

Format is always `postgresql://…` (you may see `postgres://`; both work with `pg`).

Set in `.env.local` (local) and Vercel **Environment Variables** (Production):

```bash
DATABASE_URL=postgresql://…copy-from-dashboard…
```

Also set:

- `JWT_SECRET` — long random string (required for Zap auth).
- `JWT_EXPIRY` — optional, e.g. `7d`.

## 2. Optional Supabase API keys (future / other clients)

Supabase has moved to **Publishable** and **Secret** keys (prefixes `sb_publishable_…` and `sb_secret_…`). In the dashboard: **Project Settings → API Keys**, open the **“Publishable and secret API keys”** tab. There is still a **“Legacy anon, service_role API keys”** tab for the older JWT-style keys if you follow older tutorials.

| Dashboard label | Typical env name in apps | Notes |
| ---------------- | ------------------------ | ----- |
| **Publishable** (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` or a custom name | Browser / mobile; use with **Row Level Security (RLS)**. Replaces the old **anon** key for new projects. |
| **Secret** (`sb_secret_…`) | `SUPABASE_SERVICE_ROLE_KEY` or e.g. `SUPABASE_SECRET_KEY` | **Server, Edge Functions, workers only** — never expose to the client. Replaces the old **service_role** key for new projects. |

Base URL is unchanged: `https://<project-ref>.supabase.co` → e.g. `NEXT_PUBLIC_SUPABASE_URL`.

If you add `@supabase/supabase-js`, pass the **publishable** key where the SDK docs say “anon key”, and the **secret** key only in server code where they say “service role”.

**Never** commit real keys. Rotate compromised keys under **Settings → API Keys** (create new keys and revoke old ones).

## 3. Migrations

Run from your machine or CI (not inside the Vercel build):

```bash
cd web
npm install
npm run migrate
```

Seeds under `npm run seed` are intended for **localhost** only—do not run them against production unless you know what you’re doing.

## 4. Vercel

1. **Root Directory** = `web`.
2. Add `DATABASE_URL`, `JWT_SECRET`, and any other vars from `.env.local.example` your deployment needs (e.g. eAutomate sync is optional).

See also the root [README](../../README.md) **Deploy (Vercel)** section.

## 5. Mental model: where login runs

Zap login does **not** call `https://<project>.supabase.co` (REST). Flow:

```text
Browser → POST /api/auth/login → Node (pg Pool) → TCP to Postgres (DATABASE_URL)
```

Failures with **`ETIMEDOUT`** / **`AggregateError`** happen on that **last hop** (network connect to Postgres). They are **not** “wrong email/password” and **not** missing Supabase publishable/secret API keys for this app path.

### Two different Supabase surfaces

| Layer | What it is | Credentials | Used by Zap `web` today? |
| ----- | ---------- | ----------- | ------------------------- |
| **REST / HTTP API** | `https://<project-ref>.supabase.co` (PostgREST, Auth, etc.) | Publishable / anon / secret API keys | No — unless you add `@supabase/supabase-js` or call REST yourself |
| **Postgres (TCP)** | `postgresql://…` in **`DATABASE_URL`** | Database user + password | **Yes** — all `query()` / migrations via `pg` |

Production issues like **`ETIMEDOUT`** are almost always **layer 2** (wrong host/port/mode for serverless), not layer 1.

### Anti-pattern to avoid on Vercel

**Serverless + direct Postgres** (`db.<ref>.supabase.co:5432` only) is a common source of timeouts: IPv6 routing, short-lived functions, and many concurrent connects. Prefer the **transaction pooler (port 6543)** for runtime `DATABASE_URL` on Vercel; keep **direct** for migrations if the pooler rejects a specific DDL statement.

## 6. Troubleshooting: `ETIMEDOUT` / `AggregateError` on login or API

1. **Set `DATABASE_URL` to the transaction pooler** from **Connect** (transaction mode, port **6543**). Update **Vercel → Environment Variables** and **redeploy**. Local can use the same URI, or direct if your network is stable.
2. Confirm **`DATABASE_URL`** exists for **Production** (and **Preview** if you test previews).
3. **`src/server/db.ts`** already sets IPv4-first DNS, TLS for `*.supabase.co`, and configurable timeouts (`PG_CONNECTION_TIMEOUT_MS`, `PG_POOL_MAX`). That helps but does **not** replace a pooler URL on Vercel.
4. **`src/server/errors.ts`** unwraps **`AggregateError`** so API responses are not `{ "error": "" }` when `pg` wraps multiple connection errors.

If you use a non-Supabase host, add `?sslmode=require` (or equivalent) to the URI.
