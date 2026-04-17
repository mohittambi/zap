/**
 * Truncate eAutomate-synced tables, then run scripts/sync-all-eautomate.sh.
 *
 * Requires ZAP_CONFIRM_TRUNCATE_SYNC=1 (any target DB).
 * Loads web/.env.local then .env (same as other tools).
 *
 * Usage:
 *   cd web && ZAP_CONFIRM_TRUNCATE_SYNC=1 node scripts/run-reset-and-sync-eautomate.mjs
 *   npm run sync:eautomate:fresh
 *
 * Pass-through args to master sync, e.g.:
 *   npm run sync:eautomate:fresh -- --skip-vendor-details
 */
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const extra = process.argv.slice(2);
const dryRun = extra.includes("--dry-run");

if (!dryRun && process.env.ZAP_CONFIRM_TRUNCATE_SYNC !== "1") {
  console.error(
    "Refusing to truncate: set ZAP_CONFIRM_TRUNCATE_SYNC=1 and re-run.",
  );
  console.error("(Pass --dry-run to skip truncate and only dry-run the sync steps.)");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("DATABASE_URL is not set (web/.env.local or environment).");
  process.exit(1);
}

if (!dryRun) {
  const sqlPath = path.join(root, "scripts", "reset-eautomate-synced-data.sql");
  console.log("Truncating eAutomate-synced tables…");
  const tr = spawnSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    { stdio: "inherit", cwd: root, env: process.env },
  );
  if (tr.status !== 0) {
    process.exit(tr.status ?? 1);
  }
} else {
  console.log("Dry run: skipping truncate.");
}
console.log("Running master sync…");
const sync = spawnSync("bash", ["scripts/sync-all-eautomate.sh", ...extra], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

console.log("Done: reset + sync:eautomate:all");
