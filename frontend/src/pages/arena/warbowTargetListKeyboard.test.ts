// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { moveWarbowTargetListIndex } from "./warbowTargetListKeyboard";

describe("moveWarbowTargetListIndex (GitLab #321)", () => {
  it("wraps ArrowDown across the end of the list", () => {
    expect(moveWarbowTargetListIndex("ArrowDown", 2, 3)).toEqual({ index: 0, handled: true });
  });

  it("wraps ArrowUp across the start of the list", () => {
    expect(moveWarbowTargetListIndex("ArrowUp", 0, 3)).toEqual({ index: 2, handled: true });
  });

  it("jumps to first and last options with Home and End", () => {
    expect(moveWarbowTargetListIndex("Home", 2, 5)).toEqual({ index: 0, handled: true });
    expect(moveWarbowTargetListIndex("End", 1, 5)).toEqual({ index: 4, handled: true });
  });

  it("ignores unrelated keys", () => {
    expect(moveWarbowTargetListIndex("Enter", 1, 3)).toBeNull();
  });
});
