import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runnerPath = path.join(webRoot, "scripts/run_migrations.sh");
const migrationsDir = path.join(webRoot, "migrations");

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()
    .map((name) => `migrations/${name}`);
}

function listRunnerMigrations() {
  const runner = fs.readFileSync(runnerPath, "utf8");
  const matches = runner.match(/migrations\/\d+_[^\s]+\.sql/g) ?? [];
  return [...new Set(matches)].sort();
}

describe("migration registry", () => {
  it("lists every migrations/*.sql file in run_migrations.sh", () => {
    const onDisk = listMigrationFiles();
    const inRunner = listRunnerMigrations();

    const missingFromRunner = onDisk.filter((f) => !inRunner.includes(f));
    const orphanInRunner = inRunner.filter((f) => !onDisk.includes(f));

    assert.deepEqual(
      missingFromRunner,
      [],
      `Add to scripts/run_migrations.sh: ${missingFromRunner.join(", ")}`
    );
    assert.deepEqual(
      orphanInRunner,
      [],
      `Remove or add SQL file for: ${orphanInRunner.join(", ")}`
    );
    assert.ok(onDisk.length >= 72, "expected at least 72 migrations");
    assert.match(
      onDisk[onDisk.length - 1] ?? "",
      /072_recalculate_po_header_totals\.sql$/,
      "latest migration should be 072_recalculate_po_header_totals.sql"
    );
  });

  it("verify_migrations.sh exits 0", () => {
    execSync("bash scripts/verify_migrations.sh", {
      cwd: webRoot,
      stdio: "pipe",
    });
  });
});
