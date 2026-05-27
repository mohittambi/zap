import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openSelectDropdownOnArrowKey } from "../../src/lib/open-select-dropdown-on-arrow-key.ts";

function keyEvent(key: string): { key: string; preventDefault: () => void; defaultPrevented: boolean } {
  let prevented = false;
  return {
    key,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  };
}

describe("openSelectDropdownOnArrowKey", () => {
  it("opens on ArrowDown when closed", () => {
    let open = false;
    const e = keyEvent("ArrowDown");
    openSelectDropdownOnArrowKey(e as never, (v) => {
      open = v;
    });
    assert.equal(open, true);
    assert.equal(e.defaultPrevented, true);
  });

  it("opens on ArrowUp when closed", () => {
    let open = false;
    const e = keyEvent("ArrowUp");
    openSelectDropdownOnArrowKey(e as never, (v) => {
      open = v;
    });
    assert.equal(open, true);
    assert.equal(e.defaultPrevented, true);
  });

  it("does nothing when already open", () => {
    let calls = 0;
    const e = keyEvent("ArrowDown");
    openSelectDropdownOnArrowKey(
      e as never,
      () => {
        calls += 1;
      },
      true
    );
    assert.equal(calls, 0);
    assert.equal(e.defaultPrevented, false);
  });

  it("ignores other keys", () => {
    let calls = 0;
    const e = keyEvent("Enter");
    openSelectDropdownOnArrowKey(e as never, () => {
      calls += 1;
    });
    assert.equal(calls, 0);
    assert.equal(e.defaultPrevented, false);
  });
});
