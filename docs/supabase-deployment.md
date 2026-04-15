# Supabase + Vercel

Zap’s `web` app uses **PostgreSQL via `pg`** and a single **`DATABASE_URL`**. There is **no** `@supabase/supabase-js` client in this repo today—you point `DATABASE_URL` at Supabase’s Postgres (or any hosted Postgres).

## 1. Connection string (Postgres)

In the Supabase dashboard: **Project → Connect** (or **Database → Settings**, scroll to **Connection string**). Copy the URI Supabase shows — it includes a **`[YOUR-PASSWORD]`** placeholder you replace with your database password (**Database → Settings → Database password** / reset if needed).

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
