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
