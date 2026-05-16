// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { warbowFlagPlantMutedLine } from "@/lib/warbowFlagPlantCopy";

describe("warbowFlagPlantMutedLine", () => {
  it("uses claim BP, doubled loss BP, and silence as whole minutes (ceil)", () => {
    const s = warbowFlagPlantMutedLine({ claimBp: 1000n, silenceSec: 300n });
    expect(s).toMatch(
      /Earn .+ WarBow Points if no one buys in .+ minutes, lose .+ WarBow Points if someone buys before that time ends\./,
    );
    expect(s).toMatch(/5 minutes/);
  });

  it("uses at least one minute for sub-minute silence", () => {
    const s = warbowFlagPlantMutedLine({ claimBp: 1000n, silenceSec: 30n });
    expect(s).toMatch(/1 minutes/);
  });
});
