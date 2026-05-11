// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  WARBOW_STEAL_VICTIM_INVALID_ADDRESS,
  warbowStealVictimInputFormatError,
} from "./warbowStealVictimInput";

describe("warbowStealVictimInputFormatError", () => {
  it("returns null for empty or whitespace-only input (GitLab #195)", () => {
    expect(warbowStealVictimInputFormatError("")).toBeNull();
    expect(warbowStealVictimInputFormatError("   ")).toBeNull();
  });

  it("returns null for a valid address", () => {
    expect(
      warbowStealVictimInputFormatError("0x2222222222222222222222222222222222222222"),
    ).toBeNull();
  });

  it("returns validation copy for partial or malformed hex", () => {
    expect(warbowStealVictimInputFormatError("0xabc")).toBe(WARBOW_STEAL_VICTIM_INVALID_ADDRESS);
    expect(warbowStealVictimInputFormatError("not-an-address")).toBe(WARBOW_STEAL_VICTIM_INVALID_ADDRESS);
  });
});
