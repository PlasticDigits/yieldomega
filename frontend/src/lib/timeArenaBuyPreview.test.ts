// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARENA_BUY_PREVIEW_POLICY,
  inferDefendedStreakHolderFromRecentBuys,
  previewBuyTimerSecondsAdded,
  previewWarbowBuyEffects,
} from "./timeArenaBuyPreview";

describe("previewBuyTimerSecondsAdded", () => {
  const policy = DEFAULT_ARENA_BUY_PREVIEW_POLICY;

  it("returns +120s in the calm band", () => {
    expect(previewBuyTimerSecondsAdded(900, policy)).toEqual({
      secondsAdded: 120,
      hardReset: false,
    });
  });

  it("hard-reset adds 900 − remaining under 13m", () => {
    expect(previewBuyTimerSecondsAdded(600, policy)).toEqual({
      secondsAdded: 300,
      hardReset: true,
    });
    expect(previewBuyTimerSecondsAdded(693, policy)).toEqual({
      secondsAdded: 207,
      hardReset: true,
    });
  });

  it("increments by one each second in the hard-reset band", () => {
    const a = previewBuyTimerSecondsAdded(600, policy).secondsAdded;
    const b = previewBuyTimerSecondsAdded(599, policy).secondsAdded;
    expect(b - a).toBe(1);
  });

  it("returns 0 when already at timer cap (extension branch)", () => {
    const capped = { ...policy, timerCapSec: 5_000 };
    expect(previewBuyTimerSecondsAdded(5_000, capped)).toEqual({
      secondsAdded: 0,
      hardReset: false,
    });
  });
});

describe("previewWarbowBuyEffects", () => {
  const policy = DEFAULT_ARENA_BUY_PREVIEW_POLICY;
  const holder = "0x1111111111111111111111111111111111111111" as const;
  const rival = "0x2222222222222222222222222222222222222222" as const;

  it("decomposes BP for hard reset + clutch", () => {
    const fx = previewWarbowBuyEffects({
      secondsRemaining: 25,
      policy,
      walletAddress: rival,
      recentBuys: [
        {
          buyer: holder,
          actual_seconds_added: "60",
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
    });
    expect(fx.timer).toEqual({ secondsAdded: 875, hardReset: true });
    expect(fx.bpPills.map((p) => p.label)).toEqual([
      "Base",
      "Reset",
      "Clutch",
      "Streak break",
      "Ambush",
    ]);
    expect(fx.bpPills.find((p) => p.label === "Streak break")?.amount).toBe(200);
    expect(fx.streak).toEqual({ kind: "end_other", priorStreak: 2, bpAmount: 200 });
  });

  it("shows continue streak for the window holder", () => {
    const fx = previewWarbowBuyEffects({
      secondsRemaining: 800,
      policy,
      walletAddress: holder,
      activeDefendedStreak: 2n,
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
    });
    expect(fx.streak).toEqual({ kind: "continue", nextStreak: 3 });
    expect(fx.bpPills.map((p) => p.label)).toEqual(["Base"]);
  });

  it("continues streak from indexer head when onchain read is still zero (#366)", () => {
    const fx = previewWarbowBuyEffects({
      secondsRemaining: 800,
      policy,
      walletAddress: holder,
      activeDefendedStreak: 0n,
      recentBuys: [
        {
          buyer: holder,
          actual_seconds_added: "120",
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
    });
    expect(fx.streak).toEqual({ kind: "continue", nextStreak: 2 });
  });

  it("warns when the holder buys above the defended-streak window", () => {
    const fx = previewWarbowBuyEffects({
      secondsRemaining: 1000,
      policy,
      walletAddress: holder,
      activeDefendedStreak: 2n,
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
    });
    expect(fx.streak).toEqual({ kind: "end_own" });
  });

  it("ends a rival streak when buying above the defended-streak window", () => {
    const fx = previewWarbowBuyEffects({
      secondsRemaining: 1000,
      policy,
      walletAddress: rival,
      recentBuys: [
        {
          buyer: holder,
          actual_seconds_added: "120",
          buyer_active_defended_streak: "3",
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
    });
    expect(fx.streak).toEqual({ kind: "end_other" });
    expect(fx.bpPills.map((p) => p.label)).toEqual(["Base"]);
  });

  it("does not emit a time-booster duplicate pill (timer only)", () => {
    const fx = previewWarbowBuyEffects({ secondsRemaining: 900, policy });
    expect(fx.timer?.secondsAdded).toBe(120);
  });
});

describe("inferDefendedStreakHolderFromRecentBuys", () => {
  it("skips buys with zero timer movement", () => {
    const holder = "0x1111111111111111111111111111111111111111";
    expect(
      inferDefendedStreakHolderFromRecentBuys([
        {
          buyer: "0x2222222222222222222222222222222222222222",
          actual_seconds_added: "0",
          buyer_active_defended_streak: "5",
          block_number: "1",
          tx_hash: "0x1",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          new_deadline: "1",
          total_raised_after: "1",
          buy_index: "1",
        },
        {
          buyer: holder,
          actual_seconds_added: "10",
          buyer_active_defended_streak: "3",
          block_number: "2",
          tx_hash: "0x2",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          new_deadline: "1",
          total_raised_after: "1",
          buy_index: "2",
        },
      ]),
    ).toEqual({ holder, holderActiveStreak: 3n });
  });

  it("clears the holder when the newest buy happened at or above the window", () => {
    expect(
      inferDefendedStreakHolderFromRecentBuys([
        {
          buyer: "0x1111111111111111111111111111111111111111",
          actual_seconds_added: "120",
          buyer_active_defended_streak: "0",
          block_number: "2",
          tx_hash: "0x2",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          // remaining before = 1700001120 - 120 - 1700000000 = 1000 ≥ 900 → holder cleared
          new_deadline: "1700001120",
          block_timestamp: "1700000000",
          total_raised_after: "1",
          buy_index: "2",
        },
        {
          buyer: "0x1111111111111111111111111111111111111111",
          actual_seconds_added: "120",
          buyer_active_defended_streak: "2",
          block_number: "1",
          tx_hash: "0x1",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          new_deadline: "1",
          total_raised_after: "1",
          buy_index: "1",
        },
      ]),
    ).toBeUndefined();
  });

  it("treats a missing streak field as holder with unknown streak (pre-#366 indexer)", () => {
    const holder = "0x1111111111111111111111111111111111111111";
    expect(
      inferDefendedStreakHolderFromRecentBuys([
        {
          buyer: holder,
          actual_seconds_added: "120",
          block_number: "1",
          tx_hash: "0x1",
          log_index: 0,
          amount: "1",
          charm_wad: "1",
          price_per_charm_wad: "1",
          // remaining before = 880 < 900 → under window
          new_deadline: "1700001000",
          block_timestamp: "1700000000",
          total_raised_after: "1",
          buy_index: "1",
        },
      ]),
    ).toEqual({ holder, holderActiveStreak: undefined });
  });
});
