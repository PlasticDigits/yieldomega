// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  mapArenaV2AdvancedCoreRowsFromArenaTimers,
  userSaleRowsFromWalletStats,
} from "@/pages/arena/arenaProtocolIndexerBridge";
import { ARENA_V2_ADVANCED_CORE_ROW_INDICES } from "@/pages/arena/arenaV2AdvancedSessionBridge";
import type { ArenaTimersResponse, ArenaWalletStats } from "@/lib/indexerApi";

const DOUB = "0x" + "a".repeat(40);

const timers: ArenaTimersResponse = {
  read_block_number: "100",
  block_timestamp_sec: "1700000000",
  last_buy_deadline_sec: "1700003600",
  timer_cap_sec: "86400",
  arena_start_sec: "1699990000",
  paused: false,
  total_doub_raised: "5000000000000000000000",
  podium_deadlines_sec: ["1700003600", "0", "0", "0"],
  charm_price_wad: "1000000000000000000000",
  doub: DOUB,
  referral_registry: "0x" + "b".repeat(40),
  timer_extension_sec: "120",
  buy_cooldown_sec: "300",
  time_arena_buy_router: "0x" + "c".repeat(40),
};

describe("mapArenaV2AdvancedCoreRowsFromArenaTimers", () => {
  it("maps timers JSON into protocol accordion core indices", () => {
    const rows = mapArenaV2AdvancedCoreRowsFromArenaTimers(timers);
    expect(rows).toBeDefined();
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.totalDoubRaised]?.result).toBe(
      5000000000000000000000n,
    );
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.doub]?.result).toBe(DOUB);
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.timerExtensionSec]?.result).toBe(120n);
  });
});

describe("userSaleRowsFromWalletStats", () => {
  it("maps wallet stats into connected-user accordion rows", () => {
    const stats: ArenaWalletStats = {
      address: "0x" + "1".repeat(40),
      epochs_participated: 2,
      buy_count: 5,
      total_spent_doub: "0",
      average_buy_doub: "0",
      max_single_buy_doub: "0",
      first_buy_at: null,
      xp: "0",
      level: "1",
      prizes_won: [],
      total_won_doub: "0",
      highest_scores: [],
      warbow_battle_points: "42",
      warbow_guard_until: "1700001000",
      warbow_steals: 0,
      warbow_guards: 0,
      cred_claimed: "0",
      referral_cred_earned: "0",
      longest_defended_streak: "3",
      podium_win_rate: "0",
      rank_distribution: { "1": "0", "2": "0", "3": "0" },
      epoch_charm_wad: "1000000000000000000",
    };
    const rows = userSaleRowsFromWalletStats(stats);
    expect(rows?.[0]?.result).toBe(42n);
    expect(rows?.[2]?.result).toBe(1000000000000000000n);
    expect(rows?.[3]?.result).toBe(5n);
    expect(rows?.[6]?.result).toBe(3n);
  });
});
