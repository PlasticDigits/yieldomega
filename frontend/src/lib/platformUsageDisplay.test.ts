// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatPlatformUsageDecimalStat,
  platformUsageVelocityAvgSuffix,
} from "@/lib/platformUsageDisplay";

describe("formatPlatformUsageDecimalStat", () => {
  it("rounds long indexer decimals for display", () => {
    expect(formatPlatformUsageDecimalStat("28.081632653061224")).toBe("28.08");
  });

  it("passes through undefined", () => {
    expect(formatPlatformUsageDecimalStat(undefined)).toBeUndefined();
  });
});

describe("platformUsageVelocityAvgSuffix", () => {
  it("labels each velocity window distinctly", () => {
    expect(platformUsageVelocityAvgSuffix("1h")).toContain("last hour");
    expect(platformUsageVelocityAvgSuffix("24h")).toContain("24h");
    expect(platformUsageVelocityAvgSuffix("sale")).toContain("sale start");
  });
});
