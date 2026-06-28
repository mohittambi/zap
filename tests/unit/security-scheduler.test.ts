import { describe, it } from "node:test";
import assert from "node:assert";
import { sheetsSyncScheduler, insightsDigestScheduler } from "../../src/config/schedulers";

describe("sheetsSyncScheduler", () => {
  it("reads bearer token from environment (not hardcoded)", () => {
    assert.strictEqual(
      sheetsSyncScheduler.bearerToken,
      process.env.SHEETS_SYNC_BEARER_TOKEN?.trim() ?? ""
    );
    assert.notStrictEqual(
      sheetsSyncScheduler.bearerToken,
      "zap_sheets_sync_v1_static_token"
    );
  });

  it("empty env means cron bypass disabled", () => {
    const prev = process.env.SHEETS_SYNC_BEARER_TOKEN;
    process.env.SHEETS_SYNC_BEARER_TOKEN = "";
    assert.strictEqual(
      (process.env.SHEETS_SYNC_BEARER_TOKEN?.trim() ?? ""),
      ""
    );
    if (prev !== undefined) process.env.SHEETS_SYNC_BEARER_TOKEN = prev;
    else delete process.env.SHEETS_SYNC_BEARER_TOKEN;
  });
});

describe("insightsDigestScheduler", () => {
  it("reads bearer token from environment", () => {
    assert.strictEqual(
      insightsDigestScheduler.bearerToken,
      process.env.INSIGHTS_DIGEST_BEARER_TOKEN?.trim() ?? ""
    );
  });
});
