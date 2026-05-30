// SPDX-License-Identifier: AGPL-3.0-only

import { indexerBaseUrl } from "./addresses";
import { reportIndexerRateLimited } from "./indexerConnectivity";

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

export type CharmRedemptionItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  buyer: string;
  token_amount: string;
};

/** Dedupes repeated HTTP status logs when rate limits spam the same route ([issue #96]). */
let lastIndexerWarnKey = "";
let lastIndexerWarnAtMs = 0;

function warnIndexerHttpOnce(status: number, path: string): void {
  const key = `${status}:${path}`;
  const now = Date.now();
  if (key === lastIndexerWarnKey && now - lastIndexerWarnAtMs < 5000) {
    return;
  }
  lastIndexerWarnKey = key;
  lastIndexerWarnAtMs = now;
  console.warn("[indexer]", status, path);
}

async function getJson<T>(path: string): Promise<T | null> {
  const base = indexerBaseUrl();
  if (!base) {
    return null;
  }
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) {
      if (res.status === 429) {
        reportIndexerRateLimited();
      }
      warnIndexerHttpOnce(res.status, path);
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type PaginatedItems<T> = {
  items: T[];
  limit: number;
  offset: number;
  next_offset: number | null;
};

/** Buys list includes total row count for the indexer table (schema ≥ 1.6.0). */
export type TimecurveBuysPage = PaginatedItems<BuyItem> & { total?: number };

function mapArenaBuyToBuyItem(item: ArenaBuyItem): BuyItem {
  return {
    block_number: String(item.block_number),
    tx_hash: item.tx_hash,
    log_index: 0,
    buyer: item.buyer,
    amount: item.doub_paid,
    charm_wad: item.charm_wad,
    price_per_charm_wad: "0",
    new_deadline: "0",
    total_raised_after: "0",
    buy_index: "0",
    timer_hard_reset: item.timer_hard_reset,
  };
}

/** @deprecated Use `fetchArenaBuys` — maps arena rows for legacy callers (#266). */
export async function fetchTimecurveBuys(limit = 20, offset = 0) {
  const page = await fetchArenaBuys(limit, offset);
  if (!page) {
    return null;
  }
  return {
    items: page.items.map(mapArenaBuyToBuyItem),
    limit: page.limit,
    offset: page.offset,
    next_offset: null,
  } satisfies TimecurveBuysPage;
}

/** Indexer-polled head snapshot for hero timer (schema ≥ 1.11.0 adds `sale_start_sec`). */
export type TimecurveChainTimer = {
  /** `TimeCurve.saleStart()` at `read_block_number` (`"0"` when unscheduled); omitted on pre-1.11.0 indexers. */
  sale_start_sec?: string;
  deadline_sec: string;
  block_timestamp_sec: string;
  timer_cap_sec: string;
  read_block_number: string;
  polled_at_ms: number;
};

/**
 * Latest `deadline` / `timerCapSec` / head `block.timestamp` from indexer RPC poll (~1s).
 * Returns null if indexer is unset, unreachable, chain-timer is not configured (503), or the body is not valid JSON ([issue #111](https://gitlab.com/PlasticDigits/yieldomega/-/issues/111)).
 */
export type FeeRouterSinkSnapshot = {
  destination: string;
  weight_bps: number;
};

/** Head RPC sale views at `read_block_number` (schema ≥ 1.24.0, [GitLab #216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)). */
export type TimecurveSaleState = {
  read_block_number: string;
  block_timestamp_sec: string;
  polled_at_ms: number;
  sale_start_sec: string;
  deadline_sec: string;
  ended: boolean;
  timer_extension_sec: string;
  timer_cap_sec: string;
  buy_cooldown_sec: string;
  current_min_buy_amount: string;
  current_max_buy_amount: string;
  current_charm_bounds_min_wad: string;
  current_charm_bounds_max_wad: string;
  current_price_per_charm_wad: string;
  charm_price: string;
  total_raised: string;
  total_charm_weight: string;
  total_tokens_for_sale: string;
  initial_min_buy: string;
  growth_rate_wad: string;
  accepted_asset: string;
  referral_registry: string;
  launched_token: string;
  buy_fee_routing_enabled: boolean;
  charm_redemption_enabled: boolean;
  reserve_podium_payouts_enabled: boolean;
  time_curve_buy_router: string;
  podium_pool: string;
  doub_presale_vesting: string;
  referral_each_bps: string;
  presale_charm_weight_bps: string;
  warbow_pending_flag_owner: string;
  warbow_pending_flag_plant_at: string;
  warbow_flag_claim_bp: string;
  warbow_flag_silence_sec: string;
  initial_timer_sec: string;
  prizes_distributed: boolean;
  fee_router: string;
  owner: string;
  linear_charm_base_price_wad: string;
  linear_charm_daily_increment_wad: string;
  fee_router_sinks: readonly FeeRouterSinkSnapshot[];
  note?: string;
};

const ZERO_DEC = "0";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Builds legacy sale-state shape from `GET /v1/arena/timers` for RPC row mappers (#266). */
export async function fetchTimecurveSaleState(): Promise<TimecurveSaleState | null> {
  const t = await fetchArenaTimers();
  if (!t) {
    return null;
  }
  return {
    read_block_number: t.read_block_number,
    block_timestamp_sec: t.block_timestamp_sec,
    polled_at_ms: Date.now(),
    sale_start_sec: t.arena_start_sec,
    deadline_sec: t.last_buy_deadline_sec,
    ended: false,
    timer_extension_sec: ZERO_DEC,
    timer_cap_sec: t.timer_cap_sec,
    buy_cooldown_sec: ZERO_DEC,
    current_min_buy_amount: ZERO_DEC,
    current_max_buy_amount: ZERO_DEC,
    current_charm_bounds_min_wad: ZERO_DEC,
    current_charm_bounds_max_wad: ZERO_DEC,
    current_price_per_charm_wad: ZERO_DEC,
    charm_price: ZERO_ADDR,
    total_raised: t.total_doub_raised,
    total_charm_weight: ZERO_DEC,
    total_tokens_for_sale: ZERO_DEC,
    initial_min_buy: ZERO_DEC,
    growth_rate_wad: ZERO_DEC,
    accepted_asset: ZERO_ADDR,
    referral_registry: ZERO_ADDR,
    launched_token: ZERO_ADDR,
    buy_fee_routing_enabled: !t.paused,
    charm_redemption_enabled: false,
    reserve_podium_payouts_enabled: false,
    time_curve_buy_router: ZERO_ADDR,
    podium_pool: ZERO_ADDR,
    doub_presale_vesting: ZERO_ADDR,
    referral_each_bps: ZERO_DEC,
    presale_charm_weight_bps: ZERO_DEC,
    warbow_pending_flag_owner: ZERO_ADDR,
    warbow_pending_flag_plant_at: ZERO_DEC,
    warbow_flag_claim_bp: ZERO_DEC,
    warbow_flag_silence_sec: ZERO_DEC,
    initial_timer_sec: ZERO_DEC,
    prizes_distributed: false,
    fee_router: ZERO_ADDR,
    owner: ZERO_ADDR,
    linear_charm_base_price_wad: ZERO_DEC,
    linear_charm_daily_increment_wad: ZERO_DEC,
    fee_router_sinks: [],
    note: "arena_v2_timers",
  };
}

export type WarbowStealsByVictimDayItem = {
  utc_day: string;
  steal_count: string;
};

export type WarbowStealsByVictimDayResponse = {
  victim: string;
  items: WarbowStealsByVictimDayItem[];
};

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchWarbowStealsByVictimDay(_victim: string) {
  return null;
}

export type WarbowGuardLatestResponse = {
  player: string;
  latest_guard_activation: {
    player: string;
    guard_until_ts: string;
    burn_paid_wad: string;
    block_number: string;
    tx_hash: string;
    log_index: number;
    block_timestamp: string | null;
  } | null;
};

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchWarbowGuardLatest(_player: string) {
  return null;
}

export async function fetchTimecurveChainTimer(): Promise<TimecurveChainTimer | null> {
  const t = await fetchArenaTimers();
  if (!t) {
    return null;
  }
  return {
    sale_start_sec: t.arena_start_sec,
    deadline_sec: t.last_buy_deadline_sec,
    block_timestamp_sec: t.block_timestamp_sec,
    timer_cap_sec: t.timer_cap_sec,
    read_block_number: t.read_block_number,
    polled_at_ms: Date.now(),
  };
}

/** `GET /v1/arena/podiums` — UX-ordered rows (Last Buy · WarBow · Defended · Time Booster). Schema ≥ 1.10.0. While `sale_ended` is false, rows are indexer DB predictions (`podium_prediction: true`); after sale end, rows mirror head `podium()` at `read_block_number` (schema ≥ 1.20.0). */
export type TimecurvePodiumApiRow = {
  winners: string[];
  values: string[];
  /** True when the row is derived from indexed events (live sale); false when mirroring head `podium()` RPC (schema ≥ 1.20.0). */
  podium_prediction?: boolean;
  /** Last Buy row only: same sale-window semantics as `podium_prediction` (legacy field; schema ≥ 1.10.0). */
  last_buy_prediction?: boolean;
};

export type TimecurvePodiumsResponse = {
  sale_ended: boolean;
  read_block_number: string;
  polled_at_ms: number;
  rows: TimecurvePodiumApiRow[];
};

export async function fetchTimecurvePodiums(): Promise<TimecurvePodiumsResponse | null> {
  const arena = await fetchArenaPodiums();
  if (!arena) {
    return null;
  }
  return {
    sale_ended: false,
    read_block_number: arena.read_block_number,
    polled_at_ms: Date.now(),
    rows: (arena.rows as TimecurvePodiumApiRow[]) ?? [],
  };
}

export type WarbowLeaderboardItem = {
  buyer: string;
  battle_points_after: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
};

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurveWarbowLeaderboard(_limit = 20, _offset = 0) {
  return null;
}

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurveWarbowLeaderboardAll(): Promise<WarbowLeaderboardItem[] | null> {
  return null;
}

export type WarbowBattleFeedItem = {
  kind: string;
  block_number: string;
  log_index: number;
  tx_hash: string;
  block_timestamp: string | null;
  detail: Record<string, unknown>;
};

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurveWarbowBattleFeed(_limit = 25, _offset = 0) {
  return null;
}

/** `GET /v1/arena/warbow/refresh-candidates` — schema ≥ 1.15.1 ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160), [GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170)); DISTINCT list unbounded from 1.18.0 ([GitLab #172](https://gitlab.com/PlasticDigits/yieldomega/-/issues/172)). */
export type WarbowRefreshCandidatesResponse = {
  candidates: string[];
  limit: number;
  offset: number;
  total: number;
  next_offset: number | null;
  podium_warbow_hint_count: number;
  /** Head chain-timer reports sale ended — indexer omits WarBow podium hints ([GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170)). */
  sale_ended: boolean;
  note?: string;
};

/**
 * Deduped wallet list for operator tooling: indexer WarBow tables + buys with `battle_points_after > 0`, optionally
 * merged with head WarBow podium hints while `!sale_ended` ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160), [GitLab #172](https://gitlab.com/PlasticDigits/yieldomega/-/issues/172)).
 * Paginate with `offset` when `next_offset` is set. Uses `VITE_INDEXER_URL`.
 */
/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurveWarbowRefreshCandidates(
  _limit = 200,
  _offset = 0,
): Promise<WarbowRefreshCandidatesResponse | null> {
  return null;
}

export type WarbowPendingRevengeItem = {
  stealer: string;
  expiry_exclusive: string;
  steal_seq: string;
  window_block_number: string;
  window_log_index: number;
};

export type WarbowPendingRevengeResponse = {
  victim: string;
  now_sec: number;
  items: WarbowPendingRevengeItem[];
  note?: string;
};

/** GitLab #135: open (victim, stealer) windows reconciled from `WarBowRevengeWindowOpened` + `WarBowRevenge`. */
/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchWarbowPendingRevenge(_victim: string, _nowSec: number) {
  return null;
}

export type TimecurveBuyerStats = {
  buyer: string;
  indexed_charm_weight: string;
  indexed_buy_count: string;
};

export function timecurveBuyerStatsApiPath(buyer: string): string {
  return arenaWalletStatsPath(buyer);
}

export async function fetchTimecurveBuyerStats(buyer: string) {
  const stats = await fetchArenaWalletStats(buyer);
  if (!stats) {
    return null;
  }
  return {
    buyer: stats.address,
    indexed_charm_weight: stats.xp,
    indexed_buy_count: String(stats.buy_count),
  } satisfies TimecurveBuyerStats;
}

export type PlatformUsageWarbowAction = {
  count: string;
  cl8y_spent_wei: string;
};

export type PlatformUsageVelocity = {
  window: "1h" | "24h";
  anchor_timestamp_sec: string;
  buy_count: string;
  avg_buys_per_hour: string;
};

export type PlatformUsageWalletItem = {
  wallet: string;
  buy_count: string;
  cl8y_spent_wei: string;
};

/** `GET /v1/arena/platform-usage` — network-wide sale + WarBow usage ([GitLab #231](https://gitlab.com/PlasticDigits/yieldomega/-/issues/231)). */
export type TimecurvePlatformUsage = {
  unique_wallets: string;
  total_buys: string;
  unique_buyers: string;
  mean_buys_per_wallet: string;
  median_buys_per_wallet: string;
  warbow: {
    steals: PlatformUsageWarbowAction;
    steal_overrides: PlatformUsageWarbowAction;
    revenges: PlatformUsageWarbowAction;
    guards: PlatformUsageWarbowAction;
  };
  velocity: PlatformUsageVelocity;
  wallets: {
    total: string;
    items: PlatformUsageWalletItem[];
    limit: number;
    offset: number;
    next_offset: number | null;
  };
};

export type PlatformUsageVelocityWindow = "1h" | "24h" | "sale";

export function timecurvePlatformUsageApiPath(
  _limit: number,
  _offset = 0,
  _velocityWindow: PlatformUsageVelocityWindow = "1h",
): string {
  return "/v1/arena/timers";
}

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurvePlatformUsage(
  _limit = 20,
  _offset = 0,
  _velocityWindow: PlatformUsageVelocityWindow = "1h",
) {
  return null;
}

export type ArenaPodiumPoolDonationRecent = {
  donor: string;
  amount_doub_wad: string;
  block_timestamp: string | null;
  tx_hash: string;
};

export type ArenaPodiumPoolDonationsDonorSummary = {
  total_donated_doub_wad: string;
  donation_count: string;
};

/** `GET /v1/arena/podium-pool-donations` — protocol donate-pools card ([GitLab #262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)). */
export type ArenaPodiumPoolDonations = {
  total_donated_doub_wad: string;
  unique_donors_count: string;
  recent: ArenaPodiumPoolDonationRecent[];
  donor_summary?: ArenaPodiumPoolDonationsDonorSummary;
};

export function arenaPodiumPoolDonationsApiPath(
  limit = 10,
  donor?: string,
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (donor) {
    params.set("donor", donor);
  }
  return `/v1/arena/podium-pool-donations?${params.toString()}`;
}

export async function fetchArenaPodiumPoolDonations(limit = 10, donor?: string) {
  return getJson<ArenaPodiumPoolDonations>(arenaPodiumPoolDonationsApiPath(limit, donor));
}

/**
 * `GET /v1/status` (best — includes DB pointer and max block).
 * If that is unset or not OK, falls back to the same v1 read the footer uses
 * (`/v1/fee-router/fees-distributed`, limit 1). That avoids a misleading
 * "unreachable" banner when only `/v1/status` is blocked (e.g. some privacy
 * filters match the path) or fails while the rest of the indexer is healthy.
 */
export async function fetchIndexerStatus() {
  return getJson<Record<string, unknown>>("/v1/status");
}

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurveCharmRedemptions(_limit = 20) {
  return null;
}

/** `/v1/arena/prize-distributions` with limit/offset for safe query embedding. */
export function timecurvePrizeDistributionsApiPath(limit: number, offset = 0): string {
  return `/v1/arena/prize-distributions?limit=${limit}&offset=${offset}`;
}

/** `/v1/arena/prize-payouts` with limit/offset for safe query embedding. */
export function timecurvePrizePayoutsApiPath(limit: number, offset = 0): string {
  return `/v1/arena/prize-payouts?limit=${limit}&offset=${offset}`;
}

/** `/v1/referrals/registrations` with limit/offset and optional `owner` wallet filter (schema ≥ 1.22.0). */
export function referralRegistrationsApiPath(limit: number, offset = 0, owner?: string): string {
  const base = `/v1/referrals/registrations?limit=${limit}&offset=${offset}`;
  if (owner === undefined || owner === "") {
    return base;
  }
  return `${base}&owner=${encodeURIComponent(owner)}`;
}

/** `/v1/referrals/applied` — encodes `referrer` when set. */
export function referralAppliedApiPath(referrer: string | undefined, limit: number): string {
  return referrer
    ? `/v1/referrals/applied?limit=${limit}&referrer=${encodeURIComponent(referrer)}`
    : `/v1/referrals/applied?limit=${limit}`;
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

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurvePrizePayouts(_limit = 30, _offset = 0) {
  return null;
}

export type PrizeDistributionItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
  /** Absent on pre-1.14.0 indexer responses; treated as `"distributed"`. */
  kind?: "distributed" | "settled_empty_podium_pool";
  /** Set when `kind === "settled_empty_podium_pool"` (PodiumPool address from the event). */
  podium_pool?: string | null;
};

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchTimecurvePrizeDistributions(_limit = 20, _offset = 0) {
  return null;
}

export type ReferralRegistrationItem = {
  block_number: string;
  tx_hash: string;
  log_index: number;
  owner_address: string;
  code_hash: string;
  normalized_code: string;
};

export async function fetchReferralRegistrations(limit = 30, offset = 0, owner?: string) {
  return getJson<{ items: ReferralRegistrationItem[] }>(
    referralRegistrationsApiPath(limit, offset, owner),
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

/** `/v1/referrals/referrer-leaderboard` — Σ indexed `ReferralApplied.referrerCharmAdded` per referrer plus **`ReferralCodeRegistered`** union ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94), [GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204)). */
export function referralReferrerLeaderboardApiPath(limit: number, offset = 0): string {
  return `/v1/referrals/referrer-leaderboard?limit=${limit}&offset=${offset}`;
}

export type ReferralReferrerLeaderboardItem = {
  rank: number;
  referrer: string;
  total_referrer_charm_wad: string;
  referred_buy_count: string;
  /** Indexed `ReferralCodeRegistered` rows for this owner (schema ≥ 1.19.0). */
  codes_registered_count: string;
};

/** Guide leaderboard page + network-wide summary aggregates (schema ≥ 1.25.0, [GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225)). */
export type ReferralReferrerLeaderboardPage = PaginatedItems<ReferralReferrerLeaderboardItem> & {
  total?: number;
  total_codes_registered?: string;
  total_referred_buys?: string;
  total_referrer_charm_wad?: string;
};

export async function fetchReferralReferrerLeaderboard(limit = 25, offset = 0) {
  return getJson<ReferralReferrerLeaderboardPage>(
    referralReferrerLeaderboardApiPath(limit, offset),
  );
}

/** `/v1/referrals/wallet-charm-summary` — sums indexed `referrerCharmAdded` / `refereeCharmAdded` for one wallet. */
export function referralWalletCharmSummaryApiPath(wallet: string): string {
  return `/v1/referrals/wallet-charm-summary?wallet=${encodeURIComponent(wallet)}`;
}

export type ReferralWalletCharmSummary = {
  wallet: string;
  referrer_charm_wad: string;
  referee_charm_wad: string;
  referred_buy_count: string;
  referee_buy_count: string;
};

export async function fetchReferralWalletCharmSummary(wallet: string) {
  return getJson<ReferralWalletCharmSummary>(referralWalletCharmSummaryApiPath(wallet));
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

export type ArenaBuyItem = {
  buyer: string;
  charm_wad: string;
  doub_paid: string;
  block_number: number;
  tx_hash: string;
  timer_hard_reset: boolean;
  paid_with_cred: boolean;
};

export type ArenaTimersResponse = {
  read_block_number: string;
  block_timestamp_sec: string;
  last_buy_deadline_sec: string;
  timer_cap_sec: string;
  arena_start_sec: string;
  paused: boolean;
  total_doub_raised: string;
  podium_deadlines_sec: string[];
};

export type ArenaWalletStats = {
  address: string;
  epochs_participated: number;
  buy_count: number;
  total_spent_doub: string;
  average_buy_doub: string;
  max_single_buy_doub: string;
  first_buy_at: string | null;
  xp: string;
  level: string;
  prizes_won: unknown[];
  total_won_doub: string;
  highest_scores: unknown[];
  warbow_steals: number;
  cred_claimed: string;
  referral_cred_earned: string;
};

export async function fetchArenaBuys(limit = 20, offset = 0) {
  return getJson<{ items: ArenaBuyItem[]; limit: number; offset: number }>(
    `/v1/arena/buys?limit=${limit}&offset=${offset}`,
  );
}

export async function fetchArenaTimers() {
  return getJson<ArenaTimersResponse>("/v1/arena/timers");
}

export async function fetchArenaPodiums() {
  return getJson<{ rows: unknown[]; read_block_number: string }>("/v1/arena/podiums");
}

export function arenaWalletStatsPath(address: string) {
  const w = address.trim().toLowerCase();
  return `/v1/arena/wallet/${w}/stats`;
}

export async function fetchArenaWalletStats(address: string) {
  return getJson<ArenaWalletStats>(arenaWalletStatsPath(address));
}

