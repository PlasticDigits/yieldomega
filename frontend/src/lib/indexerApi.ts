// SPDX-License-Identifier: AGPL-3.0-only

import { indexerBaseUrl } from "./addresses";

/** Builds `/v1/rabbit/deposits` query path; encodes `user` for safe query embedding. */
export function rabbitDepositsApiPath(user: string | undefined, limit: number): string {
  return user
    ? `/v1/rabbit/deposits?limit=${limit}&user=${encodeURIComponent(user)}`
    : `/v1/rabbit/deposits?limit=${limit}`;
}

export type BuyItem = {
  block_number: string;
  /** Present when the indexer serves the extended buy row (v2+). */
  block_hash?: string;
  contract_address?: string;
  tx_hash: string;
  log_index: number;
  /** Unix seconds when the RPC log included block time; omitted on legacy rows. */
  block_timestamp?: string | null;
  buyer: string;
  amount: string;
  charm_wad: string;
  price_per_charm_wad: string;
  new_deadline: string;
  total_raised_after: string;
  buy_index: string;
  /** Effective seconds added to the deadline this tx (post cap); omitted on legacy indexer rows. */
  actual_seconds_added?: string;
  timer_hard_reset?: boolean;
  battle_points_after?: string;
  bp_base_buy?: string;
  bp_timer_reset_bonus?: string;
  bp_clutch_bonus?: string;
  bp_streak_break_bonus?: string;
  bp_ambush_bonus?: string;
  bp_flag_penalty?: string;
  /** Mirrors `Buy.flagPlanted` in logs — **`true` when that buy opted into planting** the WarBow pending flag ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)); holder state is still authoritative from chain `warbowPendingFlag*` ([issue #51](https://gitlab.com/PlasticDigits/yieldomega/-/issues/51)). */
  flag_planted?: boolean;
  buyer_total_effective_timer_sec?: string;
  buyer_active_defended_streak?: string;
  buyer_best_defended_streak?: string;
};

export type DepositItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  user_address: string;
  reserve_asset: string;
  amount: string;
  doub_out: string;
  epoch_id: string;
  faction_id: string;
};

export type MintItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  token_id: string;
  series_id: string;
  to_address: string;
};

export type HealthEpochItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  epoch_id: string;
  finalized_at: string;
  reserve_ratio_wad: string;
  doub_total_supply: string;
  repricing_factor_wad: string;
  backing_per_doubloon_wad: string;
  internal_state_e_wad: string;
};

export type CharmRedemptionItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  buyer: string;
  token_amount: string;
};

async function getJson<T>(path: string): Promise<T | null> {
  const base = indexerBaseUrl();
  if (!base) {
    return null;
  }
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    console.warn("[indexer]", res.status, path);
    return null;
  }
  return res.json() as Promise<T>;
}

export type PaginatedItems<T> = {
  items: T[];
  limit: number;
  offset: number;
  next_offset: number | null;
};

/** Buys list includes total row count for the indexer table (schema ≥ 1.6.0). */
export type TimecurveBuysPage = PaginatedItems<BuyItem> & { total?: number };

export async function fetchTimecurveBuys(limit = 20, offset = 0) {
  return getJson<TimecurveBuysPage>(`/v1/timecurve/buys?limit=${limit}&offset=${offset}`);
}

/** Indexer-polled head snapshot for hero timer (schema ≥ 1.7.0). */
export type TimecurveChainTimer = {
  deadline_sec: string;
  block_timestamp_sec: string;
  timer_cap_sec: string;
  read_block_number: string;
  polled_at_ms: number;
};

/**
 * Latest `deadline` / `timerCapSec` / head `block.timestamp` from indexer RPC poll (~1s).
 * Returns null if indexer is unset, unreachable, or chain-timer is not configured (503).
 */
export async function fetchTimecurveChainTimer(): Promise<TimecurveChainTimer | null> {
  const base = indexerBaseUrl();
  if (!base) {
    return null;
  }
  const res = await fetch(`${base}/v1/timecurve/chain-timer`);
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<TimecurveChainTimer>;
}

export type WarbowLeaderboardItem = {
  buyer: string;
  battle_points_after: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
};

export async function fetchTimecurveWarbowLeaderboard(limit = 20, offset = 0) {
  return getJson<PaginatedItems<WarbowLeaderboardItem>>(
    `/v1/timecurve/warbow/leaderboard?limit=${limit}&offset=${offset}`,
  );
}

export type WarbowBattleFeedItem = {
  kind: string;
  block_number: string;
  log_index: number;
  tx_hash: string;
  block_timestamp: string | null;
  detail: Record<string, unknown>;
};

export async function fetchTimecurveWarbowBattleFeed(limit = 25, offset = 0) {
  return getJson<PaginatedItems<WarbowBattleFeedItem>>(
    `/v1/timecurve/warbow/battle-feed?limit=${limit}&offset=${offset}`,
  );
}

export type TimecurveBuyerStats = {
  buyer: string;
  indexed_charm_weight: string;
  indexed_buy_count: string;
};

export function timecurveBuyerStatsApiPath(buyer: string): string {
  return `/v1/timecurve/buyer-stats?buyer=${encodeURIComponent(buyer)}`;
}

export async function fetchTimecurveBuyerStats(buyer: string) {
  return getJson<TimecurveBuyerStats>(timecurveBuyerStatsApiPath(buyer));
}

export async function fetchRabbitDeposits(user: string | undefined, limit = 20) {
  return getJson<{ items: DepositItem[] }>(rabbitDepositsApiPath(user, limit));
}

/** Response header for indexer API schema; present on v1 JSON routes. */
const INDEXER_SCHEMA_HEADER = "x-schema-version";

/**
 * `GET /v1/status` (best — includes DB pointer and max block).
 * If that is unset or not OK, falls back to the same v1 read the footer uses
 * (`/v1/fee-router/fees-distributed`, limit 1). That avoids a misleading
 * "unreachable" banner when only `/v1/status` is blocked (e.g. some privacy
 * filters match the path) or fails while the rest of the indexer is healthy.
 */
export async function fetchIndexerStatus() {
  const direct = await getJson<Record<string, unknown>>("/v1/status");
  if (direct) {
    return direct;
  }

  const base = indexerBaseUrl();
  if (!base) {
    return null;
  }
  let res: Response;
  try {
    res = await fetch(
      `${base}/v1/fee-router/fees-distributed?limit=1&offset=0`,
    );
  } catch {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  const ver = (res.headers.get(INDEXER_SCHEMA_HEADER) ?? "").trim() || "?";
  type FeesBody = { items?: Array<{ block_number: string }> };
  let data: FeesBody;
  try {
    data = (await res.json()) as FeesBody;
  } catch {
    return null;
  }
  const block0 = data.items?.[0]?.block_number;
  return {
    schema_version: ver,
    max_indexed_block: block0 !== undefined ? block0 : null,
  } as Record<string, unknown>;
}

export async function fetchLeprechaunMints(limit = 20) {
  return getJson<{ items: MintItem[] }>(`/v1/leprechauns/mints?limit=${limit}`);
}

export async function fetchRabbitHealthEpochs(limit = 10) {
  return getJson<{ items: HealthEpochItem[] }>(`/v1/rabbit/health-epochs?limit=${limit}`);
}

export async function fetchTimecurveCharmRedemptions(limit = 20) {
  return getJson<{ items: CharmRedemptionItem[] }>(
    `/v1/timecurve/charm-redemptions?limit=${limit}`,
  );
}

/** `/v1/timecurve/prize-distributions` with limit/offset for safe query embedding. */
export function timecurvePrizeDistributionsApiPath(limit: number, offset = 0): string {
  return `/v1/timecurve/prize-distributions?limit=${limit}&offset=${offset}`;
}

/** `/v1/timecurve/prize-payouts` with limit/offset for safe query embedding. */
export function timecurvePrizePayoutsApiPath(limit: number, offset = 0): string {
  return `/v1/timecurve/prize-payouts?limit=${limit}&offset=${offset}`;
}

/** `/v1/referrals/registrations` with limit/offset for safe query embedding. */
export function referralRegistrationsApiPath(limit: number, offset = 0): string {
  return `/v1/referrals/registrations?limit=${limit}&offset=${offset}`;
}

/** `/v1/referrals/applied` — encodes `referrer` when set. */
export function referralAppliedApiPath(referrer: string | undefined, limit: number): string {
  return referrer
    ? `/v1/referrals/applied?limit=${limit}&referrer=${encodeURIComponent(referrer)}`
    : `/v1/referrals/applied?limit=${limit}`;
}

export type WithdrawalItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  user_address: string;
  reserve_asset: string;
  amount: string;
  doub_in: string;
  epoch_id: string;
  faction_id: string;
};

export async function fetchRabbitWithdrawals(user: string | undefined, limit = 20) {
  const q =
    user !== undefined
      ? `/v1/rabbit/withdrawals?limit=${limit}&user=${encodeURIComponent(user)}`
      : `/v1/rabbit/withdrawals?limit=${limit}`;
  return getJson<{ items: WithdrawalItem[] }>(q);
}

export type PrizePayoutItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  winner: string;
  token: string;
  amount: string;
  category: number;
  placement: number;
};

export async function fetchTimecurvePrizePayouts(limit = 30, offset = 0) {
  return getJson<{ items: PrizePayoutItem[] }>(timecurvePrizePayoutsApiPath(limit, offset));
}

export type PrizeDistributionItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
};

export async function fetchTimecurvePrizeDistributions(limit = 20, offset = 0) {
  return getJson<{ items: PrizeDistributionItem[] }>(
    timecurvePrizeDistributionsApiPath(limit, offset),
  );
}

export type ReferralRegistrationItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  owner_address: string;
  code_hash: string;
  normalized_code: string;
};

export async function fetchReferralRegistrations(limit = 30, offset = 0) {
  return getJson<{ items: ReferralRegistrationItem[] }>(
    referralRegistrationsApiPath(limit, offset),
  );
}

export type ReferralAppliedItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  buyer: string;
  referrer: string;
  code_hash: string;
  referrer_amount: string;
  referee_amount: string;
  amount_to_fee_router: string;
};

export async function fetchReferralApplied(referrer: string | undefined, limit = 30) {
  return getJson<{ items: ReferralAppliedItem[] }>(referralAppliedApiPath(referrer, limit));
}

export type FeeRouterSinksUpdateItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
  actor: string;
  old_sinks_json: string;
  new_sinks_json: string;
};

export type FeeRouterFeesDistributedItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
  token: string;
  amount: string;
  shares_json: string;
};

export async function fetchFeeRouterSinksUpdates(limit = 20, offset = 0) {
  return getJson<PaginatedItems<FeeRouterSinksUpdateItem>>(
    `/v1/fee-router/sinks-updates?limit=${limit}&offset=${offset}`,
  );
}

export async function fetchFeeRouterFeesDistributed(limit = 20, offset = 0) {
  return getJson<PaginatedItems<FeeRouterFeesDistributedItem>>(
    `/v1/fee-router/fees-distributed?limit=${limit}&offset=${offset}`,
  );
}

export type FactionStatItem = {
  faction_id: string;
  net_deposits: string;
  deposit_count: string;
  withdrawal_count: string;
};

export async function fetchRabbitFactionStats() {
  return getJson<{ items: FactionStatItem[] }>("/v1/rabbit/faction-stats");
}
