import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  MODULE_NAV_PERMISSIONS,
  NAV_ITEM_PERMISSIONS,
  canAccessNavGroup,
  canAccessNavItem,
  permissionKey,
} from "../../src/lib/permission-catalog";
import { navGroups } from "../../src/lib/nav-groups";

describe("permission-catalog", () => {
  it("lists purchase_orders in inbound and outbound modules", () => {
    const inbound = PERMISSION_CATALOG.filter((p) => p.module === "inbound");
    const outbound = PERMISSION_CATALOG.filter((p) => p.module === "outbound");
    assert.ok(inbound.some((p) => p.resource === "purchase_orders"));
    assert.ok(outbound.some((p) => p.resource === "purchase_orders"));
  });

  it("canAccessNavGroup allows wildcard", () => {
    assert.strictEqual(canAccessNavGroup("outbound", () => true), true);
    assert.strictEqual(
      canAccessNavGroup("outbound", (r, a) => r === "*" && a === "*"),
      true
    );
  });

  it("canAccessNavGroup checks module gates", () => {
    const hasPoRead = (r: string, a: string) =>
      r === "purchase_orders" && a === "read";
    assert.strictEqual(canAccessNavGroup("outbound", hasPoRead), true);
    assert.strictEqual(canAccessNavGroup("products", hasPoRead), false);
  });

  it("canAccessNavItem gates finance queues", () => {
    const noPerms = () => false;
    assert.strictEqual(
      canAccessNavItem("/inbound/pending-audits", noPerms),
      false
    );
    const canAudit = (r: string, a: string) => r === "grn" && a === "audit";
    assert.strictEqual(
      canAccessNavItem("/inbound/pending-audits", canAudit),
      true
    );
  });

  it("every PERMISSION_CATALOG entry has a valid module", () => {
    const ids = new Set(PERMISSION_MODULES.map((m) => m.id));
    for (const p of PERMISSION_CATALOG) {
      assert.ok(ids.has(p.module), `${permissionKey(p.resource, p.action)} module`);
    }
  });

  it("every NAV_ITEM_PERMISSIONS href denies without gate and allows with gate", () => {
    for (const [href, gates] of Object.entries(NAV_ITEM_PERMISSIONS)) {
      const deny = () => false;
      assert.strictEqual(
        canAccessNavItem(href, deny),
        false,
        `expected deny for ${href}`
      );
      const allow = (r: string, a: string) =>
        gates.some((g) => g.resource === r && g.action === a);
      assert.strictEqual(
        canAccessNavItem(href, allow),
        true,
        `expected allow for ${href}`
      );
    }
  });

  it("every nav group id with MODULE_NAV_PERMISSIONS gates correctly", () => {
    const navGroupIds = navGroups.map((g) => g.id);
    for (const groupId of navGroupIds) {
      const gates = MODULE_NAV_PERMISSIONS[groupId];
      if (!gates?.length) continue;
      const deny = () => false;
      assert.strictEqual(
        canAccessNavGroup(groupId, deny),
        false,
        `expected deny for nav group ${groupId}`
      );
      const allow = (r: string, a: string) =>
        gates.some((g) => g.resource === r && g.action === a);
      assert.strictEqual(
        canAccessNavGroup(groupId, allow),
        true,
        `expected allow for nav group ${groupId}`
      );
    }
  });
});
