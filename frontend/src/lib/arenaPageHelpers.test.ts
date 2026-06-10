// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaWalletStats } from "@/lib/indexerApi";
import {
  arenaHasUsers,
  formatWarbowViewerBattlePointsDisplay,
  isArenaLastBuyWalletSurfaceUnlocked,
  resolveIndexerViewerWarbowBattlePoints,
  roundNonNegativeBigIntToSignificantDigits,
  walletHasArenaBuy,
} from "@/lib/arenaPageHelpers";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;

function buy(overrides: Partial<BuyItem> & Pick<BuyItem, "buyer" | "battle_points_after">): BuyItem {
  return {
    tx_hash: "0xabc",
    log_index: 0,
    block_number: "1",
    ...overrides,
  } as BuyItem;
}

describe("resolveIndexerViewerWarbowBattlePoints", () => {
  it("prefers the viewer's newest indexed buy over podium row values", () => {
    const bp = resolveIndexerViewerWarbowBattlePoints(VIEWER, {
      recentBuys: [buy({ buyer: VIEWER, battle_points_after: "1000" })],
      podiumRows: [
        { winners: [], values: [] },
        { winners: [VIEWER], values: ["750"] },
        { winners: [], values: [] },
        { winners: [], values: [] },
      ],
    });
    expect(bp).toBe(1000n);
  });

  it("falls back to wallet stats warbow_battle_points when recent buys omit viewer BP", () => {
    const bp = resolveIndexerViewerWarbowBattlePoints(VIEWER, {
      recentBuys: [buy({ buyer: OTHER, battle_points_after: "500" })],
      walletWarbowBattlePoints: "620",
      podiumRows: [
        { winners: [], values: [] },
        { winners: [OTHER], values: ["750"] },
        { winners: [], values: [] },
        { winners: [], values: [] },
      ],
    });
    expect(bp).toBe(620n);
  });

  it("falls back to the WarBow podium slot when wallet stats omit viewer BP", () => {
    const bp = resolveIndexerViewerWarbowBattlePoints(VIEWER, {
      recentBuys: [buy({ buyer: OTHER, battle_points_after: "500" })],
      podiumRows: [
        { winners: [], values: [] },
        { winners: [VIEWER], values: ["750"] },
        { winners: [], values: [] },
        { winners: [], values: [] },
      ],
    });
    expect(bp).toBe(750n);
  });
});

function walletStats(overrides: Partial<ArenaWalletStats> = {}): ArenaWalletStats {
  return {
    address: VIEWER,
    epochs_participated: 0,
    buy_count: 0,
    total_spent_doub: "0",
    average_buy_doub: "0",
    max_single_buy_doub: "0",
    first_buy_at: null,
    xp: "0",
    level: "1",
    xp_toward_next: "0",
    unlocked_level: "1",
    last_buy_epoch: "0",
    epoch_charm_wad: "0",
    epoch_charm_total_wad: "0",
    epoch_doub_buy_count: "0",
    pending_cred_accrual: "0",
    claimable_cred_epoch: null,
    claimable_cred: "0",
    cred_balance_wad: "0",
    prizes_won: [],
    total_won_doub: "0",
    highest_scores: [],
    warbow_battle_points: "0",
    warbow_steals: 0,
    warbow_guards: 0,
    cred_claimed: "0",
    referral_cred_earned: "0",
    longest_defended_streak: "0",
    podium_win_rate: "0",
    rank_distribution: { "1": "0", "2": "0", "3": "0" },
    ...overrides,
  };
}

describe("arena last-buy wallet surface gates", () => {
  it("detects arena activity from recent buys or podium winners", () => {
    expect(arenaHasUsers({ recentBuys: [], podiumRows: [] })).toBe(false);
    expect(arenaHasUsers({ recentBuys: [buy({ buyer: OTHER, battle_points_after: "1" })] })).toBe(
      true,
    );
    expect(
      arenaHasUsers({
        podiumRows: [{ winners: [OTHER, VIEWER, OTHER] }],
      }),
    ).toBe(true);
  });

  it("unlocks only after arena activity and a wallet buy", () => {
    const activeArena = {
      recentBuys: [buy({ buyer: OTHER, battle_points_after: "1" })],
    };
    expect(
      isArenaLastBuyWalletSurfaceUnlocked({
        walletConnected: true,
        walletStats: walletStats(),
        arenaUsers: activeArena,
      }),
    ).toBe(false);
    expect(
      isArenaLastBuyWalletSurfaceUnlocked({
        walletConnected: true,
        walletStats: walletStats({ buy_count: 1, first_buy_at: "1700000000" }),
        arenaUsers: activeArena,
      }),
    ).toBe(true);
    expect(walletHasArenaBuy(walletStats({ buy_count: 2 }))).toBe(true);
    expect(walletHasArenaBuy(undefined)).toBe(false);
  });
});

describe("formatWarbowViewerBattlePointsDisplay", () => {
  it("locale-groups BP with significant-figure rounding", () => {
    expect(formatWarbowViewerBattlePointsDisplay(1_234_567n)).toBe("1,234,600");
    expect(formatWarbowViewerBattlePointsDisplay(undefined)).toBe("—");
  });

  it("rounds non-negative integers to significant digits", () => {
    expect(roundNonNegativeBigIntToSignificantDigits(12_345n, 3)).toBe(12_300n);
  });
});
