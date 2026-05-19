// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchTimecurveSaleState,
  type TimecurveSaleState,
} from "@/lib/indexerApi";
import {
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";

export const TIMECURVE_SALE_STATE_QUERY_KEY = ["timecurve-sale-state"] as const;

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

function successRow(result: unknown): ContractReadRow {
  return { status: "success", result };
}

/** Maps indexer sale-state JSON to the same row order as `useTimeCurveSaleSession` `coreContracts`. */
export function coreReadRowsFromSaleState(s: TimecurveSaleState): readonly ContractReadRow[] {
  const addr = (v: string) => v as `0x${string}`;
  return [
    successRow(BigInt(s.sale_start_sec)),
    successRow(BigInt(s.deadline_sec)),
    successRow(s.ended),
    successRow(BigInt(s.current_min_buy_amount)),
    successRow(BigInt(s.current_max_buy_amount)),
    successRow([BigInt(s.current_charm_bounds_min_wad), BigInt(s.current_charm_bounds_max_wad)]),
    successRow(BigInt(s.current_price_per_charm_wad)),
    successRow(addr(s.charm_price)),
    successRow(addr(s.accepted_asset)),
    successRow(addr(s.referral_registry)),
    successRow(BigInt(s.total_raised)),
    successRow(BigInt(s.total_charm_weight)),
    successRow(BigInt(s.total_tokens_for_sale)),
    successRow(BigInt(s.initial_min_buy)),
    successRow(BigInt(s.growth_rate_wad)),
    successRow(BigInt(s.timer_extension_sec)),
    successRow(BigInt(s.timer_cap_sec)),
    successRow(BigInt(s.buy_cooldown_sec)),
    successRow(addr(s.launched_token)),
    successRow(s.buy_fee_routing_enabled),
    successRow(s.charm_redemption_enabled),
    successRow(s.reserve_podium_payouts_enabled),
    successRow(addr(s.time_curve_buy_router)),
    successRow(addr(s.podium_pool)),
    successRow(addr(s.warbow_pending_flag_owner)),
    successRow(BigInt(s.warbow_pending_flag_plant_at)),
    successRow(BigInt(s.warbow_flag_claim_bp)),
    successRow(BigInt(s.warbow_flag_silence_sec)),
    successRow(addr(s.doub_presale_vesting)),
    successRow(BigInt(s.referral_each_bps)),
    successRow(BigInt(s.presale_charm_weight_bps)),
  ];
}

export function useTimecurveSaleStateQuery(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());
  return useQuery({
    queryKey: TIMECURVE_SALE_STATE_QUERY_KEY,
    queryFn: async () => {
      const body = await fetchTimecurveSaleState();
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    enabled: indexerOn && Boolean(tc),
    staleTime: 0,
    refetchInterval: () => getIndexerBackoffPollMs(2000),
    placeholderData: (previous) => previous,
  });
}
