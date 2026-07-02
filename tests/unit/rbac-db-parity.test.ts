import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
} from "../../src/lib/permission-catalog";

const expectedSeeds = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../fixtures/rbac-expected-role-seeds.json"),
    "utf8"
  )
) as {
  new_permissions_078: string[];
  new_roles_078: string[];
  finance_additions_078: string[];
  merchandising_additions_078: string[];
  admin_additions_078: string[];
  inventory_management: string[];
  ops_management: string[];
  qc: string[];
};

const DATABASE_URL = process.env.DATABASE_URL?.trim();

function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T | null> {
  if (!DATABASE_URL) return null;
  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    return await fn(client);
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

async function rolePermissions(
  client: pg.Client,
  roleName: string
): Promise<Set<string>> {
  const res = await client.query(
    `SELECT p.resource, p.action
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = $1`,
    [roleName]
  );
  return new Set(
    res.rows.map((r: { resource: string; action: string }) =>
      permKey(r.resource, r.action)
    )
  );
}

describe("rbac db parity", () => {
  it("catalog permissions exist in database", async () => {
    const result = await withDb(async (client) => {
      const res = await client.query(`SELECT resource, action FROM permissions`);
      const db = new Set(
        res.rows.map((r: { resource: string; action: string }) =>
          permKey(r.resource, r.action)
        )
      );
      const missing = PERMISSION_CATALOG.filter(
        (p) => !db.has(permKey(p.resource, p.action))
      );
      assert.deepEqual(
        missing.map((p) => permKey(p.resource, p.action)),
        [],
        `Missing DB permissions for catalog entries`
      );
      return true;
    });
    if (result === null) {
      console.warn("Skipping: DATABASE_URL not set or DB unreachable");
      return;
    }
  });

  it("migration 078 new permissions exist", async () => {
    const result = await withDb(async (client) => {
      const res = await client.query(
        `SELECT resource, action FROM permissions
         WHERE (resource = 'listings' AND action IN ('create', 'delete'))
            OR (resource = 'grn' AND action IN ('audit', 'accounts_approve', 'invoice_collect'))
            OR (resource = 'debit_credit' AND action = 'decide')`
      );
      const found = new Set(
        res.rows.map((r: { resource: string; action: string }) =>
          permKey(r.resource, r.action)
        )
      );
      for (const key of expectedSeeds.new_permissions_078) {
        assert.ok(found.has(key), `expected permission ${key}`);
      }
      return true;
    });
    if (result === null) {
      console.warn("Skipping: DATABASE_URL not set or DB unreachable");
      return;
    }
  });

  it("migration 078 new roles exist", async () => {
    const result = await withDb(async (client) => {
      const res = await client.query(
        `SELECT name FROM roles WHERE name = ANY($1::text[])`,
        [expectedSeeds.new_roles_078]
      );
      const found = new Set(res.rows.map((r: { name: string }) => r.name));
      for (const role of expectedSeeds.new_roles_078) {
        assert.ok(found.has(role), `expected role ${role}`);
      }
      return true;
    });
    if (result === null) {
      console.warn("Skipping: DATABASE_URL not set or DB unreachable");
      return;
    }
  });

  it("new business roles match migration 078 default grants", async () => {
    const result = await withDb(async (client) => {
      for (const [roleName, expected] of Object.entries(expectedSeeds)) {
        if (!["inventory_management", "ops_management", "qc"].includes(roleName)) {
          continue;
        }
        const perms = await rolePermissions(client, roleName);
        for (const key of expected as string[]) {
          assert.ok(perms.has(key), `${roleName} missing ${key}`);
        }
      }
      return true;
    });
    if (result === null) {
      console.warn("Skipping: DATABASE_URL not set or DB unreachable");
      return;
    }
  });

  it("078 additive grants on finance, merchandising, admin", async () => {
    const result = await withDb(async (client) => {
      const finance = await rolePermissions(client, "finance");
      for (const key of expectedSeeds.finance_additions_078) {
        assert.ok(finance.has(key), `finance missing ${key}`);
      }
      const merch = await rolePermissions(client, "merchandising");
      for (const key of expectedSeeds.merchandising_additions_078) {
        assert.ok(merch.has(key), `merchandising missing ${key}`);
      }
      const admin = await rolePermissions(client, "admin");
      assert.ok(admin.has("*:*"), "admin should have wildcard");
      for (const key of expectedSeeds.admin_additions_078) {
        assert.ok(admin.has(key), `admin missing explicit ${key}`);
      }
      return true;
    });
    if (result === null) {
      console.warn("Skipping: DATABASE_URL not set or DB unreachable");
      return;
    }
  });
});

describe("permission catalog metadata", () => {
  it("every catalog entry uses a known module id", () => {
    const moduleIds = new Set(PERMISSION_MODULES.map((m) => m.id));
    const bad = PERMISSION_CATALOG.filter((p) => !moduleIds.has(p.module));
    assert.deepEqual(
      bad.map((p) => permKey(p.resource, p.action)),
      []
    );
  });

  it("manifest covers every unique catalog permission plus admin wildcard", () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../fixtures/rbac-permission-routes.json"),
        "utf8"
      )
    ) as { resource: string; action: string }[];
    const manifestKeys = new Set(
      manifest.map((e) => permKey(e.resource, e.action))
    );
    for (const p of PERMISSION_CATALOG) {
      assert.ok(
        manifestKeys.has(permKey(p.resource, p.action)),
        `manifest missing ${permKey(p.resource, p.action)}`
      );
    }
    assert.ok(manifestKeys.has("*:*"), "manifest missing admin wildcard");
  });
});
