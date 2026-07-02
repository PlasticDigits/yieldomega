// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { indexerBaseUrl } from "@/lib/addresses";
import { parseDoubUsdWad } from "@/lib/doubSpotUsdPrice";
import {
  fetchLegacyArenaSaleState,
  fetchArenaTimers,
  type ArenaSaleState,
} from "@/lib/indexerApi";
import {
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";

export const ARENA_SALE_STATE_QUERY_KEY = ["arena-sale-state"] as const;
export const ARENA_TIMERS_QUERY_KEY = ["arena-timers"] as const;

/** Wagmi multicall row shape shared by Simple and Arena sale-state mappers. */
export type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

function successRow(result: unknown): ContractReadRow {
  return { status: "success", result };
}

/** Maps indexer sale-state JSON to the same row order as `useArenaSaleSession` `coreContracts`. */
export function coreReadRowsFromSaleState(s: ArenaSaleState): readonly ContractReadRow[] {
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

/**
 * Maps indexer sale-state to Arena `coreTcData` row order (27 rows).
 */
export function arenaCoreReadRowsFromSaleState(s: ArenaSaleState): readonly ContractReadRow[] {
  const addr = (v: string) => v as `0x${string}`;
  return [
    successRow(BigInt(s.sale_start_sec)),
    successRow(BigInt(s.deadline_sec)),
    successRow(BigInt(s.total_raised)),
    successRow(s.ended),
    successRow(BigInt(s.current_min_buy_amount)),
    successRow(BigInt(s.current_max_buy_amount)),
    successRow([BigInt(s.current_charm_bounds_min_wad), BigInt(s.current_charm_bounds_max_wad)]),
    successRow(BigInt(s.current_price_per_charm_wad)),
    successRow(addr(s.charm_price)),
    successRow(addr(s.accepted_asset)),
    successRow(addr(s.referral_registry)),
    successRow(BigInt(s.initial_min_buy)),
    successRow(BigInt(s.growth_rate_wad)),
    successRow(BigInt(s.timer_extension_sec)),
    successRow(BigInt(s.initial_timer_sec)),
    successRow(BigInt(s.timer_cap_sec)),
    successRow(BigInt(s.total_tokens_for_sale)),
    successRow(addr(s.launched_token)),
    successRow(s.prizes_distributed),
    successRow(s.buy_fee_routing_enabled),
    successRow(addr(s.fee_router)),
    successRow(addr(s.podium_pool)),
    successRow(BigInt(s.total_charm_weight)),
    successRow(BigInt(s.buy_cooldown_sec)),
    successRow(addr(s.time_curve_buy_router)),
    successRow(s.reserve_podium_payouts_enabled),
    successRow(addr(s.owner)),
  ];
}

/** Maps `fee_router_sinks` to wagmi `sinks(i)` multicall rows (5). */
export function feeRouterSinkRowsFromSaleState(s: ArenaSaleState): readonly ContractReadRow[] {
  const addr = (v: string) => v as `0x${string}`;
  return s.fee_router_sinks.map((sink) =>
    successRow([addr(sink.destination), sink.weight_bps] as const),
  );
}

/**
 * Merges sale-state WarBow flag fields with supplement RPC policy rows (9 calls:
 * ladder podium, burn constants, max steals, revenge window/burn, finalized).
 */
export function arenaWarbowPolicyRowsFromSaleState(
  s: ArenaSaleState,
  rpcRows: readonly ContractReadRow[],
): readonly ContractReadRow[] {
  const addr = (v: string) => v as `0x${string}`;
  const pending: ContractReadRow = { status: "failure" };
  const [
    ladder,
    stealBurn,
    guardBurn,
    bypassBurn,
    maxSteals,
    secondsPerDay,
    revengeWindow,
    revengeBurn,
    finalized,
  ] = rpcRows;
  return [
    successRow(addr(s.warbow_pending_flag_owner)),
    successRow(BigInt(s.warbow_pending_flag_plant_at)),
    ladder ?? pending,
    stealBurn ?? pending,
    guardBurn ?? pending,
    bypassBurn ?? pending,
    successRow(BigInt(s.warbow_flag_silence_sec)),
    successRow(BigInt(s.warbow_flag_claim_bp)),
    maxSteals ?? pending,
    secondsPerDay ?? pending,
    revengeWindow ?? pending,
    revengeBurn ?? pending,
    finalized ?? pending,
  ];
}

export function useArenaSaleStateQuery(
  tc: `0x${string}` | undefined,
  options?: { enabled?: boolean },
) {
  const indexerOn = Boolean(indexerBaseUrl());
  const extraEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ARENA_SALE_STATE_QUERY_KEY,
    queryFn: async () => {
      const body = await fetchLegacyArenaSaleState();
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    enabled: indexerOn && Boolean(tc) && extraEnabled,
    staleTime: 0,
    refetchInterval: () => getIndexerBackoffPollMs(2000),
    placeholderData: (previous) => previous,
  });
}

/** Indexer head poll shared by hero timer, timer chips, and Arena v2 sale session ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
export function useArenaTimersQuery(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());
  return useQuery({
    queryKey: ARENA_TIMERS_QUERY_KEY,
    queryFn: async () => {
      const body = await fetchArenaTimers();
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    enabled: indexerOn && Boolean(tc),
    staleTime: 0,
    refetchInterval: () => getIndexerBackoffPollMs(2000),
    placeholderData: (previous) => previous,
  });
}

/** Indexed TWAP USD-notional per 1 DOUB from `GET /v1/arena/timers` ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)). */
export function useDoubUsdWad(tc: `0x${string}` | undefined): bigint | undefined {
  const { data } = useArenaTimersQuery(tc);
  return useMemo(() => parseDoubUsdWad(data?.doub_usd_wad), [data?.doub_usd_wad]);
}
