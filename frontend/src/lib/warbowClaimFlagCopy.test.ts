// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { warbowClaimFlagHelperLines } from "./warbowClaimFlagCopy";

describe("warbowClaimFlagHelperLines", () => {
  it("formats reward and penalty from onchain claim BP", () => {
    const lines = warbowClaimFlagHelperLines({ claimBp: 1000n });
    expect(lines.rewardLine).toBe(
      "+1,000 BP if you claim after the silence window with no other buyer in between",
    );
    expect(lines.penaltyLine).toBe(
      "−2,000 BP if another wallet buys after silence ends but before you claim",
    );
    expect(lines.earlyInterruptLine).toContain("without the 2× penalty");
  });
});
