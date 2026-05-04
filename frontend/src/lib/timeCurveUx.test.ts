// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  buildBuyFeedNarrative,
  buildBuyHistoryPoints,
  buildWarbowFeedNarrative,
  describeStealPreflight,
  describeTimerPreview,
  formatBuyDetailRows,
  pickBuyHighlightStat,
  listBuyImpactTicks,
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

  it("explains when remaining is at timer cap (no +120s until below cap)", () => {
    const r = describeTimerPreview(350_000, 0);
    expect(r.label).toBe("Timer at max window");
    expect(r.detail).toContain("maximum remaining time");
  });
});

describe("pickBuyHighlightStat", () => {
  const baseBuy = {
    block_number: "1",
    tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    log_index: 0,
    buyer: "0x1111111111111111111111111111111111111111",
    amount: "1",
    charm_wad: "1",
    price_per_charm_wad: "1",
    new_deadline: "1",
    total_raised_after: "1",
    buy_index: "1",
  };

  it("prefers flag penalty over other signals", () => {
    const h = pickBuyHighlightStat({
      ...baseBuy,
      bp_flag_penalty: "2000",
      timer_hard_reset: true,
      bp_streak_break_bonus: "500",
    });
    expect(h.label).toContain("Flag penalty");
  });

  it("surfaces timer hard reset when no higher-priority row", () => {
    const h = pickBuyHighlightStat({
      ...baseBuy,
      timer_hard_reset: true,
      actual_seconds_added: "300",
    });
    expect(h.label).toContain("Timer hard reset");
    expect(h.sub).toContain("300");
  });

  it("falls back to WarBow BP total", () => {
    const h = pickBuyHighlightStat({
      ...baseBuy,
      battle_points_after: "500",
    });
    expect(h.label).toContain("WarBow");
    expect(h.sub).toContain("500");
  });

  it("does not treat indexer flag_planted as a buy highlight (ABI is always true today)", () => {
    const h = pickBuyHighlightStat({
      ...baseBuy,
      flag_planted: true,
      battle_points_after: "50",
    });
    expect(h.label).not.toContain("Flag");
    expect(h.label).toContain("WarBow");
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

    expect(narrative.eyebrow).toBe("Momentum shift");
    expect(narrative.headline).toContain("pulled the timer back into safer ground");
    expect(narrative.detail).toContain("added 900s");
    expect(narrative.tags).toContain("hard reset");
    expect(narrative.tags).toContain("ambush");
    expect(narrative.tags).not.toContain("flag planted");
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

describe("listBuyImpactTicks", () => {
  it("returns up to five distinct impact chips in priority order", () => {
    const ticks = listBuyImpactTicks(
      {
        block_number: "1",
        tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        log_index: 0,
        buyer: "0x1111111111111111111111111111111111111111",
        amount: "1",
        charm_wad: "1",
        price_per_charm_wad: "1",
        new_deadline: "1",
        total_raised_after: "1",
        buy_index: "1",
        bp_flag_penalty: "10",
        bp_ambush_bonus: "5",
        bp_clutch_bonus: "3",
        battle_points_after: "100",
        actual_seconds_added: "30",
      },
      5,
    );
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks[0]?.tone).toBe("danger");
    expect(ticks.some((t) => t.id === "ambush")).toBe(true);
  });
});

describe("formatBuyDetailRows", () => {
  it("lists core indexer fields for a buy row", () => {
    const rows = formatBuyDetailRows({
      block_number: "1",
      tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      log_index: 0,
      buyer: "0x1234567890abcdef1234567890abcdef12345678",
      amount: "10",
      charm_wad: "10",
      price_per_charm_wad: "1",
      new_deadline: "1",
      total_raised_after: "10",
      buy_index: "0",
    });
    expect(rows.some((r) => r.label === "Buyer" && r.value.includes("0x1234"))).toBe(true);
    expect(rows.some((r) => r.label.includes("Buy.flagPlanted"))).toBe(true);
    expect(rows.some((r) => r.label.includes("opted into WarBow flag plant"))).toBe(true);
    expect(rows.some((r) => r.label === "Transaction")).toBe(true);
    expect(rows.length).toBeGreaterThan(12);
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
        attackerStealsToday: 0n,
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
        attackerStealsToday: 0n,
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
