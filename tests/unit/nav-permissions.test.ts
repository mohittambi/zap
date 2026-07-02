import { describe, it } from "node:test";
import assert from "node:assert";
import { filterNavSections, navGroups } from "../../src/lib/nav-groups";
import { NAV_ITEM_PERMISSIONS } from "../../src/lib/permission-catalog";

const sampleSections = [
  {
    title: "Queues",
    items: [
      { href: "/inbound/pending-audits", label: "Pending Audits", icon: () => null },
      { href: "/inbound/grns", label: "All GRNs", icon: () => null },
    ],
  },
];

describe("filterNavSections permissions", () => {
  it("hides gated items without permission", () => {
    const out = filterNavSections(sampleSections, false, false, () => false);
    const labels = out.flatMap((s) => s.items.map((i) => i.label));
    assert.ok(!labels.includes("Pending Audits"));
    assert.ok(labels.includes("All GRNs"));
  });

  it("shows gated items with matching permission", () => {
    const out = filterNavSections(
      sampleSections,
      false,
      false,
      (r, a) => r === "grn" && a === "audit"
    );
    const labels = out.flatMap((s) => s.items.map((i) => i.label));
    assert.ok(labels.includes("Pending Audits"));
  });

  it("adminOnly items still require isAdmin", () => {
    const sections = [
      {
        title: "Admin",
        items: [
          {
            href: "/settings/roles",
            label: "Role Management",
            icon: () => null,
            adminOnly: true,
          },
        ],
      },
    ];
    const out = filterNavSections(sections, false, false, () => true);
    assert.strictEqual(out.length, 0);
    const outAdmin = filterNavSections(sections, true, false, () => false);
    assert.strictEqual(outAdmin[0]?.items.length, 1);
  });

  it("filters all NAV_ITEM_PERMISSIONS hrefs across navGroups", () => {
    const gatedHrefs = Object.keys(NAV_ITEM_PERMISSIONS);
    const allItems = navGroups.flatMap((g) =>
      g.sections.flatMap((s) => s.items)
    );
    for (const href of gatedHrefs) {
      const item = allItems.find((i) => i.href === href);
      if (!item) continue;
      const gates = NAV_ITEM_PERMISSIONS[href];
      const sections = [{ title: "T", items: [item] }];
      const hidden = filterNavSections(sections, false, false, () => false);
      assert.strictEqual(
        hidden.length === 0 || hidden[0]?.items.length === 0,
        true,
        `expected hidden nav item ${href}`
      );
      const allow = (r: string, a: string) =>
        gates.some((g) => g.resource === r && g.action === a);
      const shown = filterNavSections(sections, false, false, allow);
      assert.ok(
        shown.some((s) => s.items.some((i) => i.href === href)),
        `expected visible nav item ${href}`
      );
    }
  });
});
