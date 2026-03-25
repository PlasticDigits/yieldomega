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
  amount: string;
  doub_out: string;
  epoch_id: string;
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

export type AllocationClaimItem = {
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

export async function fetchTimecurveBuys(limit = 20) {
  return getJson<{ items: BuyItem[] }>(`/v1/timecurve/buys?limit=${limit}`);
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

export async function fetchTimecurveAllocationClaims(limit = 20) {
  return getJson<{ items: AllocationClaimItem[] }>(
    `/v1/timecurve/allocation-claims?limit=${limit}`,
  );
}
