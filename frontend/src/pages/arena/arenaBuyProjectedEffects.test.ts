// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  buildArenaBuyProjectedEffectLines,
  formatBuyProjectedSpendLine,
} from "./arenaBuyProjectedEffects";

const fmt = (a: `0x${string}`) => `${a.slice(0, 6)}…`;

describe("formatBuyProjectedSpendLine", () => {
  it("formats spend as negative 3-decimal asset amount", () => {
    expect(formatBuyProjectedSpendLine(2_260_000_000_000_000_000n, 18, "CL8Y")).toBe(
      "-2.260 CL8Y",
    );
  });
});

describe("buildArenaBuyProjectedEffectLines", () => {
  it("includes CHARM, spend, timer, BP base, and last buyer for a calm-timer CL8Y buy", () => {
    const lines = buildArenaBuyProjectedEffectLines({
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
    expect(lines[1]).toBe("-5.523 CL8Y");
    expect(lines).toContain("+120s");
    expect(lines).not.toContain("+120s timer");
    expect(lines).not.toContain("time-booster");
    expect(lines).toContain("+250 BP Base");
    expect(lines[lines.length - 1]).toBe("Become Last Buyer");
  });

  it("shows +{900-remaining}s under 13 minutes with separate Reset BP pill", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 600,
      timerExtensionPreview: 0,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain("+300s");
    expect(lines).not.toContain("Hard-reset");
    expect(lines).toContain("+250 BP Base");
    expect(lines).toContain("+500 BP Reset");
    expect(lines).not.toContain("+250 BP + reset");
  });

  it("shows +1 streak (N) when continuing own defended streak", () => {
    const wallet = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 800,
      activeDefendedStreak: 1n,
      walletAddress: wallet,
      recentBuys: [
        {
          buyer: wallet,
          actual_seconds_added: "60",
          buyer_active_defended_streak: "1",
          block_number: "1",
          tx_hash: "0xabc",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          new_deadline: "1",
          total_raised_after: "1",
          buy_index: "1",
        },
      ],
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain("+1 streak (2)");
    expect(lines).not.toContain("Start or break");
    expect(lines).not.toContain("Continue your streak");
  });

  it("uses charmWeightTotalWad for the +CHARM chip when provided (referral / presale bonus weight)", () => {
    const lines = buildArenaBuyProjectedEffectLines({
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
    const lines = buildArenaBuyProjectedEffectLines({
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

  it("hides WarBow flag preview below level 5 (#299)", () => {
    const rival = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      estimatedSpendWei: 1n,
      decimals: 18,
      secondsRemaining: 900,
      plantWarBowFlag: true,
      flagOwnerAddr: rival,
      flagPlantAtSec: 1n,
      walletAddress: "0x2222222222222222222222222222222222222222",
      playerLevel: 4,
      formatRivalWallet: fmt,
    });
    expect(lines.some((s) => s.includes("pending flag"))).toBe(false);
  });
});
