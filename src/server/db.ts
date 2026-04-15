import dns from "node:dns";
import pg from "pg";

const { Pool } = pg;

// Supabase hostnames are often dual-stack; Node defaults can prefer IPv6 first. Vercel and some
// networks don't reach IPv6 reliably → ETIMEDOUT on connect. Prefer IPv4 for Postgres hosts.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

let pool: pg.Pool | null = null;

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return true;
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isSupabaseHost(url: string | undefined): boolean {
  if (!url) return false;
  // Direct: *.supabase.co — Pooler: *.pooler.supabase.com (transaction pooler :6543)
  return /supabase\.co|pooler\.supabase\.com/i.test(url);
}

/**
 * Singleton Pool for serverless (Vercel): reuse across invocations in the same instance.
 * Prefer Supabase **transaction pooler** (port 6543) in production — direct `db.*:5432` often causes
 * `ETIMEDOUT` from serverless networks (IPv6 / routing). See docs/supabase-deployment.md.
 */
function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const config: pg.PoolConfig = {
      // Port comes from the URL (6543 for Supabase transaction pooler, 5432 for direct); node-pg does not override it.
      connectionString,
      // Serverless: keep pool small; Supabase pooler has its own limits.
      max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 5 : 10)),
      connectionTimeoutMillis: Number(
        process.env.PG_CONNECTION_TIMEOUT_MS ?? 30_000
      ),
      idleTimeoutMillis: 30_000,
    };
    // Supabase managed Postgres requires TLS; matches common Supabase + node-pg examples.
    if (!isLocalDatabase(connectionString) && isSupabaseHost(connectionString)) {
      config.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(config);
  }
  return pool;
}

export async function query(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult> {
  return getPool().query(text, params);
}

export default getPool;
