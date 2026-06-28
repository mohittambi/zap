import { describe, it } from "node:test";
import assert from "node:assert";
import { filterNavSections, navGroups } from "../../src/lib/nav-groups";

describe("filterNavSections super admin", () => {
  const settingsGroup = navGroups.find((g) => g.id === "settings");
  const insightsGroup = navGroups.find((g) => g.id === "insights");

  it("hides Activity Log and Insights for admin without super admin", () => {
    assert.ok(settingsGroup);
    assert.ok(insightsGroup);

    const settingsSections = filterNavSections(settingsGroup!.sections, true, false);
    const settingsLabels = settingsSections.flatMap((s) => s.items.map((i) => i.label));
    assert.ok(settingsLabels.includes("User Management"));
    assert.ok(settingsLabels.includes("EAN Mappings"));
    assert.ok(!settingsLabels.includes("Activity Log"));

    const insightsSections = filterNavSections(insightsGroup!.sections, true, false);
    assert.strictEqual(insightsSections.length, 0);
  });

  it("shows Activity Log and Insights for super admin", () => {
    assert.ok(settingsGroup);
    assert.ok(insightsGroup);

    const settingsSections = filterNavSections(settingsGroup!.sections, true, true);
    const settingsLabels = settingsSections.flatMap((s) => s.items.map((i) => i.label));
    assert.ok(settingsLabels.includes("Activity Log"));

    const insightsSections = filterNavSections(insightsGroup!.sections, true, true);
    const insightLabels = insightsSections.flatMap((s) => s.items.map((i) => i.label));
    assert.ok(insightLabels.includes("Overview"));
    assert.ok(insightLabels.includes("Forecasting"));
  });
});
