import { describe, it } from "node:test";
import assert from "node:assert";
import {
  filterNavItemsByQuery,
  flattenNavItems,
  formatShortcut,
  getShortcutsByCategory,
  isTypingTarget,
  matchShortcut,
} from "../../src/lib/keyboard-shortcuts";
import { navGroups } from "../../src/lib/nav-groups";

describe("formatShortcut", () => {
  it("formats meta shortcuts for Mac", () => {
    assert.strictEqual(formatShortcut({ key: "k", metaOrCtrl: true }, true), "⌘K");
  });

  it("formats meta shortcuts for non-Mac", () => {
    assert.strictEqual(formatShortcut({ key: "k", metaOrCtrl: true }, false), "Ctrl+K");
  });

  it("formats shift slash", () => {
    assert.strictEqual(formatShortcut({ key: "/", shift: true }, true), "⇧/");
  });
});

describe("isTypingTarget", () => {
  it("returns true for input elements", () => {
    const input = { tagName: "INPUT", isContentEditable: false } as unknown as HTMLElement;
    assert.strictEqual(isTypingTarget(input), true);
  });

  it("returns false for button elements", () => {
    const button = { tagName: "BUTTON", isContentEditable: false } as unknown as HTMLElement;
    assert.strictEqual(isTypingTarget(button), false);
  });
});

describe("flattenNavItems", () => {
  it("includes admin-only items for admins", () => {
    const rows = flattenNavItems(navGroups, true);
    assert.ok(rows.some((r) => r.href === "/settings/users"));
  });

  it("excludes admin-only items for non-admins", () => {
    const rows = flattenNavItems(navGroups, false);
    assert.ok(!rows.some((r) => r.href === "/settings/users"));
  });

  it("filters by query", () => {
    const rows = flattenNavItems(navGroups, true);
    const filtered = filterNavItemsByQuery(rows, "bins");
    assert.ok(filtered.some((r) => r.href === "/bins"));
    assert.ok(!filtered.some((r) => r.href === "/labels"));
  });
});

describe("matchShortcut", () => {
  it("matches cmd+k style shortcuts", () => {
    const event = {
      key: "k",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.strictEqual(matchShortcut(event, { key: "k", metaOrCtrl: true }), true);
  });

  it("rejects when typing guard would apply separately", () => {
    const event = {
      key: "b",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.strictEqual(matchShortcut(event, { key: "b", metaOrCtrl: true }), false);
  });
});

describe("getShortcutsByCategory", () => {
  it("deduplicates help shortcuts with same label", () => {
    const help = getShortcutsByCategory("help");
    const guideRows = help.filter((s) => s.label.includes("guide"));
    assert.strictEqual(guideRows.length, 1);
  });
});
