// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { xpForCharm } from "@/lib/arenaXpMath";
import {
  buildArenaBuyActualEffectLines,
  buildArenaBuyProjectedEffectLines,
  BUY_PREVIEW_START_TIMER,
  formatBuyProjectedGuideCredLine,
  formatBuyProjectedLevelLine,
  formatBuyProjectedXpLine,
  inferSecondsRemainingBeforeBuy,
  mergeArenaBuyProjectedEffectBonusLines,
  previewBuyPlayerLevelAfterCharm,
} from "./arenaBuyProjectedEffects";
import { STREAK_PILL_END_OTHER, STREAK_PILL_END_OWN } from "@/lib/timeArenaBuyPreview";
import type { BuyItem } from "@/lib/indexerApi";

const fmt = (a: `0x${string}`) => `${a.slice(0, 6)}…`;

describe("formatBuyProjectedXpLine", () => {
  it("formats XP from cleared CHARM weight", () => {
    const charmWad = 5_515_000_000_000_000_000n;
    expect(formatBuyProjectedXpLine(charmWad)).toBe(
      `+${xpForCharm(charmWad).toString()}xp`,
    );
  });
});

describe("previewBuyPlayerLevelAfterCharm", () => {
  it("levels up when charm XP crosses the cached threshold", () => {
    const charmWad = 5_515_000_000_000_000_000n;
    expect(previewBuyPlayerLevelAfterCharm(1, 5, charmWad)).toEqual({
      levelBefore: 1,
      levelAfter: 2,
    });
    expect(formatBuyProjectedLevelLine(1, 2)).toBe("1->2 Level (+1 max move)");
  });
});

describe("buildArenaBuyProjectedEffectLines", () => {
  it("includes XP, timer, BP base, and last buyer for a calm-timer CL8Y buy", () => {
    const charmWad = 5_515_000_000_000_000_000n;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: charmWad,
      secondsRemaining: 900,
      timerExtensionPreview: 120,
      activeDefendedStreak: 2n,
      plantWarBowFlag: false,
      flagOwnerAddr: undefined,
      flagPlantAtSec: undefined,
      walletAddress: undefined,
      formatRivalWallet: fmt,
    });
    expect(lines[0]).toBe(formatBuyProjectedXpLine(charmWad));
    expect(lines[0]).not.toMatch(/CHARM/);
    expect(lines.some((line) => line.startsWith("-"))).toBe(false);
    expect(lines).toContain("+120s");
    expect(lines).not.toContain("+120s timer");
    expect(lines).not.toContain("time-booster");
    expect(lines).toContain("+250 BP Base");
    expect(lines[lines.length - 1]).toBe("Last Buyer");
  });

  it("shows +{900-remaining}s under 13 minutes with separate Reset BP pill", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
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
      secondsRemaining: 800,
      activeDefendedStreak: 0n,
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
    expect(lines).not.toContain("Start streak");
    expect(lines).not.toContain("Start or break");
    expect(lines).not.toContain("Continue your streak");
  });

  it("warns when the holder buys above the defended-streak window", () => {
    const wallet = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      secondsRemaining: 1000,
      activeDefendedStreak: 2n,
      walletAddress: wallet,
      recentBuys: [
        {
          buyer: wallet,
          actual_seconds_added: "120",
          buyer_active_defended_streak: "2",
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
      playerLevel: 5,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain(STREAK_PILL_END_OWN);
  });

  it("shows End Streak when breaking a rival below the window", () => {
    const holder = "0x1111111111111111111111111111111111111111" as const;
    const rival = "0x2222222222222222222222222222222222222222" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      secondsRemaining: 800,
      walletAddress: rival,
      recentBuys: [
        {
          buyer: holder,
          actual_seconds_added: "120",
          buyer_active_defended_streak: "2",
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
      playerLevel: 5,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain(STREAK_PILL_END_OTHER);
    expect(lines).toContain("+200 BP Streak break");
  });

  it("uses charmWeightTotalWad for the +xp chip when provided (referral / presale bonus weight)", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 10n * 10n ** 18n,
      charmWeightTotalWad: 12n * 10n ** 18n,
      secondsRemaining: 900,
      timerExtensionPreview: 0,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines[0]).toBe(formatBuyProjectedXpLine(12n * 10n ** 18n));
  });

  it("adds replace-flag copy when planting over another holder", () => {
    const rival = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      secondsRemaining: 900,
      timerExtensionPreview: 10,
      plantWarBowFlag: true,
      flagOwnerAddr: rival,
      flagPlantAtSec: 1n,
      walletAddress: "0x2222222222222222222222222222222222222222",
      formatRivalWallet: fmt,
    });
    expect(lines.some((s) => s.includes("Replace flag"))).toBe(true);
  });

  it("shows level-up chip after the XP pill when a buy crosses a threshold", () => {
    const charmWad = 5_515_000_000_000_000_000n;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: charmWad,
      secondsRemaining: 900,
      playerLevel: 1,
      xpTowardNext: 5n,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines[0]).toBe(formatBuyProjectedXpLine(charmWad));
    expect(lines[1]).toBe("1->2 Level (+1 max move)");
  });

  it("uses post-buy level for WarBow BP preview (#299)", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 10n * 10n ** 18n,
      secondsRemaining: 600,
      playerLevel: 3,
      xpTowardNext: 18n,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain("3->4 Level (+1 max move)");
    expect(lines.some((line) => line.includes("BP"))).toBe(true);
  });

  it("shows START TIMER when Last Buy epoch is unarmed", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      secondsRemaining: undefined,
      lastBuyTimerArmed: false,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain(BUY_PREVIEW_START_TIMER);
    expect(lines).not.toContain("Timer pending");
  });

  it("shows Timer pending when countdown is unknown but timer may be armed", () => {
    const lines = buildArenaBuyProjectedEffectLines({
      secondsRemaining: undefined,
      plantWarBowFlag: false,
      formatRivalWallet: fmt,
    });
    expect(lines).toContain("Timer pending");
    expect(lines).not.toContain(BUY_PREVIEW_START_TIMER);
  });

  it("hides WarBow flag preview below level 5 (#299)", () => {
    const rival = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyProjectedEffectLines({
      charmWadSelected: 1n * 10n ** 18n,
      secondsRemaining: 900,
      plantWarBowFlag: true,
      flagOwnerAddr: rival,
      flagPlantAtSec: 1n,
      walletAddress: "0x2222222222222222222222222222222222222222",
      playerLevel: 4,
      formatRivalWallet: fmt,
    });
    expect(lines.some((s) => s.includes("flag"))).toBe(false);
  });
});

describe("buildArenaBuyActualEffectLines", () => {
  const baseBuy: BuyItem = {
    block_number: "100",
    tx_hash: "0xabc",
    log_index: 1,
    block_timestamp: "1700000000",
    buyer: "0x1111111111111111111111111111111111111111",
    amount: "5500",
    charm_wad: "5515000000000000000",
    price_per_charm_wad: "0",
    new_deadline: "1700001000",
    total_raised_after: "0",
    buy_index: "42",
    actual_seconds_added: "120",
    timer_hard_reset: false,
  };

  it("includes XP, actual timer seconds, and Last Buyer from indexed buy rows", () => {
    const lines = buildArenaBuyActualEffectLines(baseBuy, { playerLevel: 5 });
    expect(lines[0]).toBe(formatBuyProjectedXpLine(5515000000000000000n));
    expect(lines).toContain("+120s");
    expect(lines[lines.length - 1]).toBe("Last Buyer");
  });

  it("uses indexed buyer_active_defended_streak for streak pill copy", () => {
    const lines = buildArenaBuyActualEffectLines(
      {
        ...baseBuy,
        buyer_active_defended_streak: "2",
      },
      { playerLevel: 5 },
    );
    expect(lines).toContain("+1 streak (2)");
    expect(lines).not.toContain("Start streak");
  });

  it("shows Start streak when indexed active defended streak is one", () => {
    const lines = buildArenaBuyActualEffectLines(
      {
        ...baseBuy,
        buyer_active_defended_streak: "1",
      },
      { playerLevel: 5 },
    );
    expect(lines).toContain("+1 streak (1)");
    expect(lines).not.toContain("Start streak");
  });

  it("infers pre-buy remaining from deadline, actual seconds, and block time", () => {
    expect(inferSecondsRemainingBeforeBuy(baseBuy)).toBe(880);
  });

  it("shows End Streak in results when indexed streak-break BP is present", () => {
    const lines = buildArenaBuyActualEffectLines(
      {
        ...baseBuy,
        buyer_active_defended_streak: "1",
        bp_streak_break_bonus: "200",
      },
      { playerLevel: 5 },
    );
    expect(lines).toContain(STREAK_PILL_END_OTHER);
    expect(lines).not.toContain("+1 streak (1)");
  });

  it("shows warning when a holder ends their streak above the window", () => {
    const wallet = "0x1111111111111111111111111111111111111111" as const;
    const lines = buildArenaBuyActualEffectLines(
      {
        ...baseBuy,
        buyer: wallet,
        block_timestamp: "1700000000",
        new_deadline: "1700001120",
        actual_seconds_added: "120",
        buyer_active_defended_streak: "0",
      },
      {
        playerLevel: 5,
        recentBuys: [
          {
            ...baseBuy,
            buyer: wallet,
            block_number: "99",
            log_index: 0,
            buyer_active_defended_streak: "2",
          },
        ],
      },
    );
    expect(lines).toContain(STREAK_PILL_END_OWN);
  });
});

describe("formatBuyProjectedGuideCredLine", () => {
  it("formats the flat referrer CRED pill", () => {
    expect(formatBuyProjectedGuideCredLine(5n * 10n ** 18n)).toBe("+5 Guide CRED");
  });
});

describe("mergeArenaBuyProjectedEffectBonusLines", () => {
  it("inserts bonus pills before Last Buyer", () => {
    expect(
      mergeArenaBuyProjectedEffectBonusLines(
        ["+1xp", BUY_PREVIEW_START_TIMER, "Last Buyer"],
        ["+5 Guide CRED"],
      ),
    ).toEqual(["+1xp", BUY_PREVIEW_START_TIMER, "+5 Guide CRED", "Last Buyer"]);
  });

  it("appends bonuses when Last Buyer is absent", () => {
    expect(mergeArenaBuyProjectedEffectBonusLines(["+1xp"], ["+5 Guide CRED"])).toEqual([
      "+1xp",
      "+5 Guide CRED",
    ]);
  });
});
