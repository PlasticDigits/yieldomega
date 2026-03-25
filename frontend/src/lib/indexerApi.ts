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
  tx_hash: string;
  log_index: number;
  buyer: string;
  amount: string;
  current_min_buy: string;
  new_deadline: string;
  total_raised_after: string;
  buy_index: string;
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

export async function fetchTimecurveBuys(limit = 20, offset = 0) {
  return getJson<PaginatedItems<BuyItem>>(`/v1/timecurve/buys?limit=${limit}&offset=${offset}`);
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

export async function fetchIndexerStatus() {
  return getJson<Record<string, unknown>>("/v1/status");
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

export async function fetchTimecurvePrizePayouts(limit = 30) {
  return getJson<{ items: PrizePayoutItem[] }>(`/v1/timecurve/prize-payouts?limit=${limit}`);
}

export type PrizeDistributionItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
};

export async function fetchTimecurvePrizeDistributions(limit = 20) {
  return getJson<{ items: PrizeDistributionItem[] }>(
    `/v1/timecurve/prize-distributions?limit=${limit}`,
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

export async function fetchReferralRegistrations(limit = 30) {
  return getJson<{ items: ReferralRegistrationItem[] }>(`/v1/referrals/registrations?limit=${limit}`);
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
  const q = referrer
    ? `/v1/referrals/applied?limit=${limit}&referrer=${encodeURIComponent(referrer)}`
    : `/v1/referrals/applied?limit=${limit}`;
  return getJson<{ items: ReferralAppliedItem[] }>(q);
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
