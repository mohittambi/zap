/**
 * Bulk eAutomate sync scripts should avoid Supabase transaction pooler (6543):
 * large TRUNCATE/upsert batches hit statement_timeout and deadlocks more often.
 */

export function resolveSyncDatabaseUrl(url = process.env.DATABASE_URL?.trim()) {
  if (!url) return url;
  const direct = process.env.DATABASE_URL_DIRECT?.trim();
  if (direct) return direct;
  if (url.includes(":6543/")) {
    console.warn(
      "[sync-db] Using port 5432 for bulk sync (transaction pooler :6543 may time out).",
      "Set DATABASE_URL_DIRECT to override."
    );
    return url.replace(":6543/", ":5432/");
  }
  return url;
}

/** Disable statement timeout for long vendor listing upserts / TRUNCATE. */
export async function configureSyncPgSession(client) {
  await client.query("SET statement_timeout = 0");
  await client.query("SET lock_timeout = '10min'");
}

export function isRetryableSyncDbError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  const code = err.code;
  return (
    code === "40P01" ||
    code === "57014" ||
    /deadlock detected/i.test(msg) ||
    /statement timeout/i.test(msg) ||
    /canceling statement due to statement timeout/i.test(msg) ||
    /Connection terminated unexpectedly/i.test(msg) ||
    /connection.*closed/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|EPIPE|57P01|08006|08003/i.test(msg) ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT"
  );
}
