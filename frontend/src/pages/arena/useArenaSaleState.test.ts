// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { ArenaSaleState } from "@/lib/indexerApi";
import {
  arenaCoreReadRowsFromSaleState,
  arenaWarbowPolicyRowsFromSaleState,
  coreReadRowsFromSaleState,
  feeRouterSinkRowsFromSaleState,
} from "./useArenaSaleState";

const SAMPLE: ArenaSaleState = {
  read_block_number: "100",
  block_timestamp_sec: "1700000000",
  polled_at_ms: 1,
  sale_start_sec: "1000",
  deadline_sec: "2000",
  ended: false,
  timer_extension_sec: "60",
  timer_cap_sec: "3600",
  buy_cooldown_sec: "300",
  current_min_buy_amount: "1",
  current_max_buy_amount: "2",
  current_charm_bounds_min_wad: "990000000000000000",
  current_charm_bounds_max_wad: "10000000000000000000",
  current_price_per_charm_wad: "1000000000000000000",
  charm_price: "0x1111111111111111111111111111111111111111",
  total_raised: "0",
  total_charm_weight: "0",
  total_tokens_for_sale: "0",
  initial_min_buy: "0",
  growth_rate_wad: "0",
  accepted_asset: "0x2222222222222222222222222222222222222222",
  referral_registry: "0x3333333333333333333333333333333333333333",
  launched_token: "0x4444444444444444444444444444444444444444",
  buy_fee_routing_enabled: true,
  charm_redemption_enabled: false,
  reserve_podium_payouts_enabled: false,
  time_curve_buy_router: "0x5555555555555555555555555555555555555555",
  podium_pool: "0x6666666666666666666666666666666666666666",
  doub_presale_vesting: "0x7777777777777777777777777777777777777777",
  referral_each_bps: "500",
  presale_charm_weight_bps: "1500",
  warbow_pending_flag_owner: "0x8888888888888888888888888888888888888888",
  warbow_pending_flag_plant_at: "0",
  warbow_flag_claim_bp: "0",
  warbow_flag_silence_sec: "0",
  initial_timer_sec: "3600",
  prizes_distributed: false,
  fee_router: "0x9999999999999999999999999999999999999999",
  owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  linear_charm_base_price_wad: "1000000000000000000",
  linear_charm_daily_increment_wad: "100000000000000000",
  fee_router_sinks: [
    { destination: "0x1111111111111111111111111111111111111111", weight_bps: 2000 },
    { destination: "0x2222222222222222222222222222222222222222", weight_bps: 1000 },
    { destination: "0x3333333333333333333333333333333333333333", weight_bps: 3000 },
    { destination: "0x4444444444444444444444444444444444444444", weight_bps: 0 },
    { destination: "0x5555555555555555555555555555555555555555", weight_bps: 4000 },
  ],
};

describe("coreReadRowsFromSaleState", () => {
  it("maps 31 core contract read rows in session order", () => {
    const rows = coreReadRowsFromSaleState(SAMPLE);
    expect(rows).toHaveLength(31);
    expect(rows[0]?.status).toBe("success");
    expect(rows[0]?.result).toBe(1000n);
    expect(rows[2]?.result).toBe(false);
    expect(rows[5]?.result).toEqual([
      990000000000000000n,
      10000000000000000000n,
    ]);
  });
});

describe("arenaCoreReadRowsFromSaleState", () => {
  it("maps 27 Arena core rows including supplement fields from sale-state", () => {
    const rows = arenaCoreReadRowsFromSaleState(SAMPLE);
    expect(rows).toHaveLength(27);
    expect(rows[0]?.result).toBe(1000n);
    expect(rows[2]?.result).toBe(0n);
    expect(rows[3]?.result).toBe(false);
    expect(rows[14]?.result).toBe(3600n);
    expect(rows[18]?.result).toBe(false);
    expect(rows[20]?.result).toBe("0x9999999999999999999999999999999999999999");
    expect(rows[26]?.result).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
});

describe("feeRouterSinkRowsFromSaleState", () => {
  it("maps five sink rows as destination + weightBps tuples", () => {
    const rows = feeRouterSinkRowsFromSaleState(SAMPLE);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.result).toEqual([
      "0x1111111111111111111111111111111111111111",
      2000,
    ]);
  });
});

describe("arenaWarbowPolicyRowsFromSaleState", () => {
  const rpcRows = [
    { status: "success" as const, result: [["0x01"], [1n]] },
    { status: "success" as const, result: 1n },
    { status: "success" as const, result: 2n },
    { status: "success" as const, result: 3n },
    { status: "success" as const, result: 3 },
    { status: "success" as const, result: 86400n },
    { status: "success" as const, result: 3600n },
    { status: "success" as const, result: 4n },
    { status: "success" as const, result: false },
  ];

  it("maps 13 WarBow policy rows from sale-state + 9 RPC rows", () => {
    const rows = arenaWarbowPolicyRowsFromSaleState(SAMPLE, rpcRows);
    expect(rows).toHaveLength(13);
    expect(rows[0]?.result).toBe("0x8888888888888888888888888888888888888888");
    expect(rows[1]?.result).toBe(0n);
    expect(rows[2]?.result).toEqual([["0x01"], [1n]]);
    expect(rows[6]?.result).toBe(0n);
    expect(rows[7]?.result).toBe(0n);
    expect(rows[12]?.result).toBe(false);
  });
});
