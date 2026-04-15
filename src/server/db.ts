import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return true;
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isSupabaseHost(url: string | undefined): boolean {
  if (!url) return false;
  return /supabase\.co/i.test(url);
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
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      connectionTimeoutMillis: Number(
        process.env.PG_CONNECTION_TIMEOUT_MS ?? 20_000
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
