#!/usr/bin/env node
/**
 * Wrapper around sync-eautomate-grn-details.ts (tsx) for parity with other .mjs sync scripts.
 * Prefer: npm run sync:grn:details / sync:grn:details:all
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const ts = path.join(__dirname, "sync-eautomate-grn-details.ts");
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");

const r = spawnSync(
  process.execPath,
  [tsxCli, ts, ...process.argv.slice(2)],
  { cwd: root, stdio: "inherit", env: process.env }
);
process.exit(r.status === null ? 1 : r.status);
