/**
 * Scheduler configuration kept in code (not environment variables).
 * Rotate `bearerToken` here and in the external scheduler together.
 */
export const sheetsSyncScheduler = {
  jobName: "sheets_sync_every_5_min",
  schedule: "*/5 * * * *",
  endpoint: "https://zap-rust.vercel.app/api/sync/sheets",
  bearerToken: "zap_sheets_sync_v1_static_token",
} as const;

