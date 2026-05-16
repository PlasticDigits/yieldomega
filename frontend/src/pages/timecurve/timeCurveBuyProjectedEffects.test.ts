// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { buildTimeCurveBuyProjectedEffectLines } from "./timeCurveBuyProjectedEffects";

const fmt = (a: `0x${string}`) => `${a.slice(0, 6)}…`;

describe("buildTimeCurveBuyProjectedEffectLines", () => {
  it("includes CHARM, CL8Y spend, timer credit, BP base, and latest buyer for a calm-timer CL8Y buy", () => {
    const lines = buildTimeCurveBuyProjectedEffectLines({
      charmWadSelected: 5_515_000_000_000_000_000n,
      estimatedSpendWei: 5_523_000_000_000_000_000n,
      decimals: 18,
      secondsRemaining: 900,
      timerExtensionPreview: 120,
      activeDefendedStreak: 2n,
      plantWarBowFlag: false,
      flagOwnerAddr: undefined,
      flagPlantAtSec: undefined,
      walletAddress: undefined,
      formatRivalWallet: fmt,
    });
    expect(lines[0]).toMatch(/\+5\.515 CHARM/);
    expect(lines[1]).toMatch(/5\.523 CL8Y spend/);
    expect(lines).toContain("+120s timer");
    expect(lines).toContain("+120s time-booster credit");
    expect(lines).toContain("+250 BP base");
    expect(lines[lines.length - 1]).toBe("Become latest buyer");
  });

  it("uses hard-reset copy when under 13 minutes remain", () => {
    const lines = buildTimeCurveBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 600,
      timerExtensionPreview: 0,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain("Hard-reset timer toward 15m");
    expect(lines).toContain("+250 BP + reset bonus");
  });

  it("uses charmWeightTotalWad for the +CHARM chip when provided (referral / presale bonus weight)", () => {
    const lines = buildTimeCurveBuyProjectedEffectLines({
      charmWadSelected: 10n * 10n ** 18n,
      charmWeightTotalWad: 12n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 900,
      timerExtensionPreview: 0,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines[0]).toMatch(/\+12 CHARM/);
  });

  it("adds replace-flag copy when planting over another holder", () => {
    const rival = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildTimeCurveBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 900,
      timerExtensionPreview: 10,
      plantWarBowFlag: true,
      flagOwnerAddr: rival,
      flagPlantAtSec: 1n,
      walletAddress: "0x2222222222222222222222222222222222222222",
      formatRivalWallet: fmt,
    });
    expect(lines.some((s) => s.includes("Replace") && s.includes("pending flag"))).toBe(true);
  });
});
