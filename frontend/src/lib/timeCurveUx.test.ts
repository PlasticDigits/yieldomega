// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  buildBuyFeedNarrative,
  buildBuyHistoryPoints,
  buildWarbowFeedNarrative,
  describeStealPreflight,
  describeTimerPreview,
} from "./timeCurveUx";

describe("describeTimerPreview", () => {
  it("explains the hard-reset band in critical time", () => {
    expect(describeTimerPreview(120, 120)).toEqual({
      tone: "critical",
      label: "Clutch window",
      detail: "A buy here hard-resets the clock toward 15 minutes, which can flip the entire room.",
    });
  });

  it("describes normal pressure in calmer phases", () => {
    expect(describeTimerPreview(7200, 120)).toEqual({
      tone: "calm",
      label: "Room to set up a move",
      detail: "A standard buy currently adds about 120s to the clock.",
    });
  });
});

describe("buildBuyFeedNarrative", () => {
  it("turns a hard-reset buy into a battle story", () => {
    const narrative = buildBuyFeedNarrative(
      {
        block_number: "100",
        tx_hash: "0x1",
        log_index: 0,
        buyer: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "1000000000000000000",
        charm_wad: "1000000000000000000",
        price_per_charm_wad: "1000000000000000000",
        new_deadline: "999",
        total_raised_after: "1000000000000000000",
        buy_index: "1",
        actual_seconds_added: "900",
        timer_hard_reset: true,
        battle_points_after: "950",
        bp_streak_break_bonus: "300",
        bp_ambush_bonus: "200",
        bp_clutch_bonus: "150",
        flag_planted: true,
        buyer_active_defended_streak: "2",
        buyer_best_defended_streak: "4",
      },
      undefined,
    );

    expect(narrative.headline).toContain("yanked the timer back from the brink");
    expect(narrative.detail).toContain("added 900s");
    expect(narrative.tags).toContain("hard reset");
    expect(narrative.tags).toContain("ambush");
  });
});

describe("buildWarbowFeedNarrative", () => {
  it("explains a steal with the BP swing", () => {
    const narrative = buildWarbowFeedNarrative(
      {
        kind: "steal",
        block_number: "101",
        log_index: 1,
        tx_hash: "0x2",
        block_timestamp: "1700000000",
        detail: {
          attacker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          victim: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          amount_bp: "250",
          bypassed_victim_daily_limit: true,
        },
      },
      undefined,
    );

    expect(narrative.eyebrow).toBe("WarBow steal");
    expect(narrative.detail).toBe("Momentum changed hands for 250 BP.");
    expect(narrative.tags).toContain("cap bypass");
  });
});

describe("buildBuyHistoryPoints", () => {
  it("builds compact timer and raise history view models", () => {
    const points = buildBuyHistoryPoints([
      {
        block_number: "100",
        tx_hash: "0x1",
        log_index: 0,
        buyer: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "1000000000000000000",
        charm_wad: "1000000000000000000",
        price_per_charm_wad: "1000000000000000000",
        new_deadline: "999",
        total_raised_after: "1000000000000000000",
        buy_index: "1",
        actual_seconds_added: "300",
      },
      {
        block_number: "101",
        tx_hash: "0x2",
        log_index: 1,
        buyer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        amount: "2000000000000000000",
        charm_wad: "1000000000000000000",
        price_per_charm_wad: "2000000000000000000",
        new_deadline: "1200",
        total_raised_after: "3000000000000000000",
        buy_index: "2",
        actual_seconds_added: "900",
        timer_hard_reset: true,
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]?.hardReset).toBe(true);
    expect(points[0]?.meta).toContain("Hard reset");
    expect(points[1]?.buyer).toContain("0x123456");
  });
});

describe("describeStealPreflight", () => {
  it("flags the 2x rule before signing", () => {
    expect(
      describeStealPreflight({
        connected: true,
        saleActive: true,
        saleEnded: false,
        viewer: "0x1111111111111111111111111111111111111111",
        victim: "0x2222222222222222222222222222222222222222",
        viewerBattlePoints: 500n,
        victimBattlePoints: 900n,
        victimStealsToday: 0n,
        maxStealsPerDay: 3n,
        bypassSelected: false,
        guardActive: false,
      }),
    ).toMatchObject({
      tone: "error",
      title: "2x rule not met",
    });
  });

  it("approves an eligible target with readable cap detail", () => {
    expect(
      describeStealPreflight({
        connected: true,
        saleActive: true,
        saleEnded: false,
        viewer: "0x1111111111111111111111111111111111111111",
        victim: "0x2222222222222222222222222222222222222222",
        viewerBattlePoints: 500n,
        victimBattlePoints: 1200n,
        victimStealsToday: 1n,
        maxStealsPerDay: 3n,
        bypassSelected: false,
        guardActive: false,
      }),
    ).toMatchObject({
      tone: "success",
      title: "Steal looks eligible",
    });
  });
});
