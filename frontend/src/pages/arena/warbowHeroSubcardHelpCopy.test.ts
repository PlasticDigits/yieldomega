// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { warbowHeroSubcardHelpCopy } from "./warbowHeroSubcardHelpCopy";

const COSTS = {
  stealCostLabel: "1K",
  guardCostLabel: "10K",
  bypassCostLabel: "50K",
  revengeCostLabel: "1K",
  maxStealsPerDay: 3,
};

describe("warbowHeroSubcardHelpCopy", () => {
  it("includes steal band, drain, cap, and bypass numbers", () => {
    const copy = warbowHeroSubcardHelpCopy("steal", COSTS);
    expect(copy.title).toBe("Steal");
    expect(copy.body.join(" ")).toContain("1× and 50×");
    expect(copy.body.join(" ")).toContain("10%");
    expect(copy.body.join(" ")).toContain("1%");
    expect(copy.body.join(" ")).toContain("3 times per UTC day");
    expect(copy.body.join(" ")).toContain("50K DOUB");
  });

  it("includes guard duration and softened drain", () => {
    const copy = warbowHeroSubcardHelpCopy("guard", COSTS);
    expect(copy.body.join(" ")).toContain("6-hour");
    expect(copy.body.join(" ")).toContain("10K DOUB");
    expect(copy.body.join(" ")).toContain("1%");
  });

  it("includes revenge window and drain", () => {
    const copy = warbowHeroSubcardHelpCopy("revenge", COSTS);
    expect(copy.body.join(" ")).toContain("24h");
    expect(copy.body.join(" ")).toContain("10%");
  });

  it("includes flag silence, reward, and penalty", () => {
    const copy = warbowHeroSubcardHelpCopy("flag", COSTS);
    expect(copy.body.join(" ")).toContain("5 minutes");
    expect(copy.body.join(" ")).toContain("+1,000 BP");
    expect(copy.body.join(" ")).toContain("−2,000 BP");
    expect(copy.body.join(" ")).toContain("Level 5");
  });
});
