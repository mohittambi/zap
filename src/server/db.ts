import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Singleton Pool for serverless (Vercel): reuse across invocations in the same instance.
 * Use a pooled DATABASE_URL (e.g. Neon / PgBouncer) in production.
 */
function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
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
