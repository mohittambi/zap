import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PERMISSION_CATALOG } from "../../src/lib/permission-catalog";

const webRoot = path.resolve(__dirname, "../..");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(webRoot, "tests/fixtures/rbac-permission-routes.json"),
    "utf8"
  )
) as {
  resource: string;
  action: string;
  sourceFile?: string;
  authCanOnly?: boolean;
}[];

const catalogKeys = new Set(
  PERMISSION_CATALOG.map((p) => `${p.resource}:${p.action}`)
);

function fileContainsPermissionGate(
  filePath: string,
  resource: string,
  action: string
): boolean {
  const content = fs.readFileSync(filePath, "utf8");
  const resourcePatterns = [
    `"${resource}", "${action}"`,
    `'${resource}', '${action}'`,
    `\`${resource}\`, \`${action}\``,
  ];
  const hasResourceAction = resourcePatterns.some((p) => content.includes(p));
  const hasPermissionCall =
    content.includes("assertPermission") || content.includes("hasPermission");
  if (resource === "*" && action === "*") {
    return (
      hasPermissionCall &&
      (content.includes('"*", "*"') ||
        content.includes("'*', '*'") ||
        content.includes('assertAdmin'))
    );
  }
  return hasResourceAction && hasPermissionCall;
}

describe("rbac route manifest", () => {
  it("every manifest permission is in catalog or is admin wildcard", () => {
    for (const entry of manifest) {
      const key = `${entry.resource}:${entry.action}`;
      if (key === "*:*") continue;
      assert.ok(
        catalogKeys.has(key),
        `manifest entry ${key} not in PERMISSION_CATALOG`
      );
    }
  });

  it("every non-authCanOnly entry with sourceFile still gates the permission", () => {
    const missing: string[] = [];
    for (const entry of manifest) {
      if (entry.authCanOnly || !entry.sourceFile) continue;
      const abs = path.join(webRoot, entry.sourceFile);
      if (!fs.existsSync(abs)) {
        missing.push(`${entry.resource}:${entry.action} -> missing file ${entry.sourceFile}`);
        continue;
      }
      if (!fileContainsPermissionGate(abs, entry.resource, entry.action)) {
        missing.push(
          `${entry.resource}:${entry.action} -> no assertPermission/hasPermission in ${entry.sourceFile}`
        );
      }
    }
    assert.deepEqual(missing, []);
  });

  it("authCanOnly entries are documented catalog permissions without direct route gate", () => {
    const authCanOnly = manifest.filter((e) => e.authCanOnly);
    assert.ok(authCanOnly.length >= 4);
    for (const entry of authCanOnly) {
      const key = `${entry.resource}:${entry.action}`;
      assert.ok(catalogKeys.has(key), `${key} should be in catalog`);
    }
  });
});
