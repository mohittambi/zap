/**
 * Scheduler configuration for external cron triggers.
 * Set SHEETS_SYNC_BEARER_TOKEN in environment (never commit the value).
 */
export const sheetsSyncScheduler = {
  jobName: "sheets_sync_every_5_min",
  schedule: "*/5 * * * *",
  endpoint: "https://zap-rust.vercel.app/api/sync/sheets",
  bearerToken: process.env.SHEETS_SYNC_BEARER_TOKEN?.trim() ?? "",
} as const;

export const insightsDigestScheduler = {
  jobName: "insights_digest_daily",
  schedule: "0 6 * * *",
  endpoint: process.env.INSIGHTS_DIGEST_ENDPOINT?.trim() ?? "/api/insights/digest",
  bearerToken: process.env.INSIGHTS_DIGEST_BEARER_TOKEN?.trim() ?? "",
} as const;
