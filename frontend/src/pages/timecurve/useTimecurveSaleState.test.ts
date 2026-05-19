// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { TimecurveSaleState } from "@/lib/indexerApi";
import { coreReadRowsFromSaleState } from "./useTimecurveSaleState";

const SAMPLE: TimecurveSaleState = {
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
