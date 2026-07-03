// SPDX-License-Identifier: AGPL-3.0-only

import { indexerBaseUrl } from "./addresses";
import { reportIndexerFetchAttempt, reportIndexerRateLimited } from "./indexerConnectivity";

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
      reportIndexerFetchAttempt(false);
      warnIndexerHttpOnce(res.status, path);
      return null;
    }
    const json = (await res.json()) as T;
    reportIndexerFetchAttempt(true);
    return json;
  } catch {
    reportIndexerFetchAttempt(false);
    return null;
  }
}

export type PaginatedItems<T> = {
  items: T[];
  limit: number;
  offset: number;
  next_offset: number | null;
  /** `(block_number, log_index)` watermark when the indexer supports cursor paging ([#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)). */
  next_cursor?: string | null;
};

/** Buys list includes total row count for the indexer table (schema ≥ 1.6.0). */
export type ArenaBuysPageLegacy = PaginatedItems<BuyItem> & { total?: number };

export type ArenaActivityKind =
  | "buy"
  | "steal"
  | "guard"
  | "revenge"
  | "level_up"
  | "cred_claim"
  | "podium_epoch"
  | "epoch_started"
  | "feature_unlocked";

export type ArenaActivityItem = {
  kind: ArenaActivityKind;
  actor: string;
  target?: string | null;
  charm_wad?: string | null;
  amount_doub_wad?: string | null;
  seconds_delta?: string | null;
  bp_delta?: string | null;
  guard_until?: string | null;
  timer_hard_reset?: boolean | null;
  paid_with_cred?: boolean | null;
  limit_bypass?: boolean | null;
  block_number: number;
  tx_hash: string;
  log_index: number;
  block_timestamp?: string | null;
};

function mapArenaBuyToBuyItem(item: ArenaBuyItem): BuyItem {
  return {
    block_number: String(item.block_number),
    tx_hash: item.tx_hash,
    log_index: item.log_index,
    block_timestamp: item.block_timestamp ?? null,
    buyer: item.buyer,
    amount: item.doub_paid,
    charm_wad: item.charm_wad,
    price_per_charm_wad: "0",
    new_deadline: item.new_deadline,
    total_raised_after: "0",
    buy_index: item.buy_index,
    timer_hard_reset: item.timer_hard_reset,
    actual_seconds_added: item.actual_seconds_added,
  };
}

/** @deprecated Use `fetchArenaBuys` — maps arena rows for legacy callers (#266). */
export async function fetchArenaBuysAsBuyItems(limit = 20, offset = 0) {
  const page = await fetchArenaBuys(limit, offset);
  if (!page) {
    return null;
  }
  return {
    items: page.items.map(mapArenaBuyToBuyItem),
    limit: page.limit,
    offset: page.offset,
    next_offset: null,
  } satisfies ArenaBuysPageLegacy;
}

/** Indexer-polled head snapshot for hero timer (schema ≥ 1.11.0 adds `sale_start_sec`). */
export type ArenaChainTimer = {
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
export type ArenaSaleState = {
  read_block_number: string;
  block_timestamp_sec: string;
  polled_at_ms: number;
  sale_start_sec: string;
  deadline_sec: string;
  ended: boolean;
  timer_extension_sec: string;
  timer_cap_sec: string;
  buy_charge_interval_sec: string;
  max_buy_charges: string;
  burst_buy_cooldown_sec: string;
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

/** Prefer indexer poll instant when schema ≥ 2.18.0 exposes it ([#333](https://gitlab.com/PlasticDigits/yieldomega/-/issues/333)). */
function arenaTimersPolledAtMs(t: Pick<ArenaTimersResponse, "polled_at_ms">): number {
  const ms = t.polled_at_ms;
  return typeof ms === "number" && Number.isFinite(ms) ? ms : Date.now();
}

/** Builds legacy sale-state shape from `GET /v1/arena/timers` for RPC row mappers (#266). */
export async function fetchLegacyArenaSaleState(): Promise<ArenaSaleState | null> {
  const t = await fetchArenaTimers();
  if (!t) {
    return null;
  }
  const doub = t.doub ?? ZERO_ADDR;
  const priceWad = t.charm_price_wad ?? ZERO_DEC;
  return {
    read_block_number: t.read_block_number,
    block_timestamp_sec: t.block_timestamp_sec,
    polled_at_ms: arenaTimersPolledAtMs(t),
    sale_start_sec: t.arena_start_sec,
    deadline_sec: t.last_buy_deadline_sec,
    ended: false,
    timer_extension_sec: t.timer_extension_sec ?? ZERO_DEC,
    timer_cap_sec: t.timer_cap_sec,
    buy_charge_interval_sec: t.buy_charge_interval_sec ?? t.buy_cooldown_sec ?? ZERO_DEC,
    max_buy_charges: t.max_buy_charges ?? "1",
    burst_buy_cooldown_sec: t.burst_buy_cooldown_sec ?? t.buy_cooldown_sec ?? ZERO_DEC,
    buy_cooldown_sec: t.buy_cooldown_sec ?? ZERO_DEC,
    current_min_buy_amount: ZERO_DEC,
    current_max_buy_amount: ZERO_DEC,
    current_charm_bounds_min_wad: ZERO_DEC,
    current_charm_bounds_max_wad: ZERO_DEC,
    current_price_per_charm_wad: priceWad,
    charm_price: ZERO_ADDR,
    total_raised: t.total_doub_raised,
    total_charm_weight: ZERO_DEC,
    total_tokens_for_sale: ZERO_DEC,
    initial_min_buy: ZERO_DEC,
    growth_rate_wad: ZERO_DEC,
    accepted_asset: doub,
    referral_registry: t.referral_registry ?? ZERO_ADDR,
    launched_token: doub,
    buy_fee_routing_enabled: !t.paused,
    charm_redemption_enabled: false,
    reserve_podium_payouts_enabled: false,
    time_curve_buy_router: t.time_arena_buy_router ?? ZERO_ADDR,
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

export async function fetchLegacyArenaChainTimer(): Promise<ArenaChainTimer | null> {
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
    polled_at_ms: arenaTimersPolledAtMs(t),
  };
}

/** `GET /v1/arena/podiums` — UX-ordered rows (Last Buy · WarBow · Defended · Time Booster). Schema ≥ 2.5.0 ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)). Live leaders from `idx_arena_podium_live` + WarBow scores when `podium_prediction: true`; RPC fallback when indexer has no row yet. */
export type ArenaPodiumApiRow = {
  category?: string;
  /** Onchain category index (0=Last Buy, 3=WarBow, 2=Defended, 1=Time Booster). Schema ≥ 2.5.0 ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)). */
  category_index?: number;
  /** Head `lastBuyEpoch` (cat 0) or `podiumEpoch[cat]` from chain timer (schema ≥ 2.5.0, [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)). */
  epoch?: string | null;
  winners: string[];
  values: string[];
  /** True when the row is derived from indexed events (live sale); false when mirroring head `podium()` RPC (schema ≥ 1.20.0). */
  podium_prediction?: boolean;
  /** Last Buy row only: same sale-window semantics as `podium_prediction` (legacy field; schema ≥ 1.10.0). */
  last_buy_prediction?: boolean;
  /** Head `PodiumVaults.activePoolBalance(category_index)` wad string (schema ≥ 2.8.0, [#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)). */
  active_pool_balance_doub_wad?: string;
  /** 1st/2nd/3rd DOUB wad preview from active pool × 4∶2∶1 (schema ≥ 2.8.0, [#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)). */
  prize_places_doub_wad?: [string, string, string];
  /** Last Buy row only: unix sec when each placement's buy landed (newest-first in epoch; schema ≥ 2.9.0). */
  winner_buy_sec?: [string | null, string | null, string | null];
  /** Head `PodiumVaults.seedPoolBalance(category_index)` wad string (schema ≥ 2.15.0). */
  seed_pool_balance_doub_wad?: string;
  /** 1st/2nd/3rd DOUB wad preview from seed pool × 4∶2∶1 (schema ≥ 2.15.0). */
  seed_prize_places_doub_wad?: [string, string, string];
  /** Head `PodiumVaults.futurePoolBalance(category_index)` wad string (schema ≥ 2.15.0). */
  future_pool_balance_doub_wad?: string;
  /** 1st/2nd/3rd DOUB wad preview from future pool × 4∶2∶1 (schema ≥ 2.15.0). */
  future_prize_places_doub_wad?: [string, string, string];
  /** Distinct wallets with meaningful participation in this category (schema ≥ 2.15.0). */
  participant_count?: number;
};

/** Aggregated head buy routing on `GET /v1/arena/podiums` (schema ≥ 2.16.0, [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)). */
export type ArenaBuyRoutingTranche = {
  slot: "current" | "next" | "future" | string;
  tranche_bps: number;
  pool_total_doub_wad: string;
  prize_places_doub_wad: [string, string, string];
};

export type ArenaBuyRoutingSummary = {
  podium_category_share_bps: number;
  admin_share_bps: number;
  epoch_tranches: ArenaBuyRoutingTranche[];
};

export type ArenaPodiumsResponse = {
  sale_ended?: boolean;
  read_block_number: string;
  /** Latest block fully ingested (`chain_pointer`; schema ≥ 2.19.0 · [#344](https://gitlab.com/PlasticDigits/yieldomega/-/issues/344)). */
  indexed_through_block?: string;
  polled_at_ms?: number;
  rows: ArenaPodiumApiRow[];
  buy_routing?: ArenaBuyRoutingSummary;
};

export async function fetchLegacyArenaPodiums(): Promise<ArenaPodiumsResponse | null> {
  const arena = await fetchArenaPodiums();
  if (!arena) {
    return null;
  }
  return {
    sale_ended: false,
    read_block_number: arena.read_block_number,
    polled_at_ms: Date.now(),
    rows: (arena.rows as ArenaPodiumApiRow[]) ?? [],
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
export async function fetchArenaWarbowLeaderboard(_limit = 20, _offset = 0) {
  return null;
}

/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchArenaWarbowLeaderboardAll(): Promise<WarbowLeaderboardItem[] | null> {
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
export async function fetchArenaWarbowBattleFeed(_limit = 25, _offset = 0) {
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
  /** Legacy field name: head timer expired / settlement pending, so the indexer omits WarBow podium hints ([GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170)). */
  sale_ended: boolean;
  note?: string;
};

/**
 * Deduped wallet list for operator tooling: indexer WarBow tables + buys with `battle_points_after > 0`, optionally
 * merged with head WarBow podium hints while the legacy `sale_ended` field is false ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160), [GitLab #172](https://gitlab.com/PlasticDigits/yieldomega/-/issues/172)).
 * Paginate with `offset` when `next_offset` is set. Uses `VITE_INDEXER_URL`.
 */
/** Retired with TimeCurve v1 indexer HTTP (#266). */
export async function fetchArenaWarbowRefreshCandidates(
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
  revenge_window_sec?: number;
  note?: string;
};

/** GitLab #135: open windows reconciled from indexed steals minus consumed revenges. */
export function arenaWarbowPendingRevengePath(victim: string, nowSec?: number): string {
  const w = victim.trim().toLowerCase();
  if (nowSec !== undefined && Number.isFinite(nowSec)) {
    return `/v1/arena/warbow/pending-revenge/${w}?now_sec=${Math.floor(nowSec)}`;
  }
  return `/v1/arena/warbow/pending-revenge/${w}`;
}

/** Victim-scoped open revenge windows; omits `now_sec` so the indexer uses head chain time (#135, #301). */
export async function fetchWarbowPendingRevenge(victim: string) {
  return getJson<WarbowPendingRevengeResponse>(arenaWarbowPendingRevengePath(victim));
}

export type ArenaBuyerStats = {
  buyer: string;
  /** Current Last Buy epoch CHARM weight from the indexer wallet stats API. */
  indexed_epoch_charm_wad: string;
  indexed_buy_count: string;
  indexed_longest_defended_streak: string;
};

export function arenaBuyerStatsApiPath(buyer: string): string {
  return arenaWalletStatsPath(buyer);
}

export async function fetchArenaBuyerStats(buyer: string) {
  const stats = await fetchArenaWalletStats(buyer);
  if (!stats) {
    return null;
  }
  return {
    buyer: stats.address,
    indexed_epoch_charm_wad: stats.epoch_charm_wad ?? "0",
    indexed_buy_count: String(stats.buy_count),
    indexed_longest_defended_streak: stats.longest_defended_streak,
  } satisfies ArenaBuyerStats;
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
export type ArenaPlatformUsage = {
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

export function arenaPlatformUsageApiPath(
  limit = 20,
  offset = 0,
  velocityWindow: PlatformUsageVelocityWindow = "1h",
): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    velocity_window: velocityWindow,
  });
  return `/v1/arena/platform-usage?${params.toString()}`;
}

export async function fetchArenaPlatformUsage(
  limit = 20,
  offset = 0,
  velocityWindow: PlatformUsageVelocityWindow = "1h",
) {
  return getJson<ArenaPlatformUsage>(
    arenaPlatformUsageApiPath(limit, offset, velocityWindow),
  );
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
export async function fetchArenaCharmRedemptions(_limit = 20) {
  return null;
}

/** `/v1/arena/prize-distributions` with limit/offset for safe query embedding. */
export function arenaPrizeDistributionsApiPath(limit: number, offset = 0): string {
  return `/v1/arena/prize-distributions?limit=${limit}&offset=${offset}`;
}

/** `/v1/arena/prize-payouts` with limit/offset for safe query embedding. */
export function arenaPrizePayoutsApiPath(limit: number, offset = 0): string {
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
export async function fetchArenaPrizePayouts(_limit = 30, _offset = 0) {
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
export async function fetchArenaPrizeDistributions(_limit = 20, _offset = 0) {
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
  referrer_cred: string;
  buyer_cred: string;
};

export async function fetchReferralApplied(referrer: string | undefined, limit = 30) {
  return getJson<{ items: ReferralAppliedItem[] }>(referralAppliedApiPath(referrer, limit));
}

/** `/v1/referrals/referrer-leaderboard` — Σ indexed `ReferralCredApplied.referrerCred` per referrer plus **`ReferralCodeRegistered`** union ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94), [GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204), [GitLab #253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)). */
export function referralReferrerLeaderboardApiPath(limit: number, offset = 0): string {
  return `/v1/referrals/referrer-leaderboard?limit=${limit}&offset=${offset}`;
}

export type ReferralReferrerLeaderboardItem = {
  rank: number;
  referrer: string;
  total_referrer_cred_wad: string;
  referred_buy_count: string;
  /** Indexed `ReferralCodeRegistered` rows for this owner (schema ≥ 1.19.0). */
  codes_registered_count: string;
};

/** Guide leaderboard page + network-wide summary aggregates (schema ≥ 1.25.0, [GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225)). */
export type ReferralReferrerLeaderboardPage = PaginatedItems<ReferralReferrerLeaderboardItem> & {
  total?: number;
  total_codes_registered?: string;
  total_referred_buys?: string;
  total_referrer_cred_wad?: string;
};

export async function fetchReferralReferrerLeaderboard(limit = 25, offset = 0) {
  return getJson<ReferralReferrerLeaderboardPage>(
    referralReferrerLeaderboardApiPath(limit, offset),
  );
}

/** `/v1/referrals/wallet-cred-summary` — sums indexed `ReferralCredApplied` referrer/buyer CRED for one wallet ([GitLab #253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)). */
export function referralWalletCredSummaryApiPath(wallet: string): string {
  return `/v1/referrals/wallet-cred-summary?wallet=${encodeURIComponent(wallet)}`;
}

export type ReferralWalletCredSummary = {
  wallet: string;
  referrer_cred_wad: string;
  buyer_cred_wad: string;
  referred_buy_count: string;
  referee_buy_count: string;
};

export async function fetchReferralWalletCredSummary(wallet: string) {
  return getJson<ReferralWalletCredSummary>(referralWalletCredSummaryApiPath(wallet));
}

/** @deprecated Use `fetchReferralWalletCredSummary` — alias hits the same route. */
export function referralWalletCharmSummaryApiPath(wallet: string): string {
  return referralWalletCredSummaryApiPath(wallet);
}

/** @deprecated Use `ReferralWalletCredSummary`. */
export type ReferralWalletCharmSummary = ReferralWalletCredSummary;

/** @deprecated Use `fetchReferralWalletCredSummary`. */
export async function fetchReferralWalletCharmSummary(wallet: string) {
  return fetchReferralWalletCredSummary(wallet);
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
  /** Kumbaya pay asset when routed via `TimeArenaBuyRouter` (0 ETH, 1 stable, 2 CL8Y); null for direct DOUB/CRED. */
  pay_kind?: number | null;
  /** Effective seconds added to the Last Buy deadline this tx (post cap); from `idx_arena_buy`. */
  actual_seconds_added?: string;
  /** Last Buy deadline after this buy (unix sec string from onchain `Buy` log). */
  new_deadline: string;
  /** Monotonic buy counter from onchain `Buy` log. */
  buy_index: string;
  /** Receipt log index; PK component with `tx_hash`. */
  log_index: number;
  /** RPC block time at ingest (unix sec string); null when unavailable. */
  block_timestamp?: string | null;
};

export type ArenaTimersResponse = {
  read_block_number: string;
  /** Latest block fully ingested (`chain_pointer`; schema ≥ 2.19.0 · [#344](https://gitlab.com/PlasticDigits/yieldomega/-/issues/344)). */
  indexed_through_block?: string;
  block_timestamp_sec: string;
  /** Unix millis when the head poller last refreshed this snapshot (schema ≥ 2.18.0 · [#333](https://gitlab.com/PlasticDigits/yieldomega/-/issues/333)). */
  polled_at_ms?: number;
  last_buy_deadline_sec: string;
  timer_cap_sec: string;
  arena_start_sec: string;
  paused: boolean;
  total_doub_raised: string;
  podium_deadlines_sec: string[];
  /** Per-category settlement timer armed at head ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330); schema ≥ 2.17.0). */
  podium_timer_armed?: boolean[];
  /** Arena v2 buy-hub head fields (schema ≥ 2.6.0 · [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
  /** Effective DOUB/CHARM at head (`effectiveCharmPriceWad()` · [#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)). */
  charm_price_wad?: string;
  epoch_charm_anchor_wad?: string;
  epoch_anchor_timestamp_sec?: string;
  doub?: string;
  referral_registry?: string;
  buy_charge_interval_sec?: string;
  max_buy_charges?: string;
  burst_buy_cooldown_sec?: string;
  buy_cooldown_sec?: string;
  timer_extension_sec?: string;
  time_arena_buy_router?: string;
  referral_cred_flat_wad?: string;
};

export type ArenaWalletLevelHistoryEntry = {
  level: string;
  /** UTC ISO-8601 milestone time; `null` when not yet reached (schema ≥ 2.18.0, #336). */
  reached_at: string | null;
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
  /** Progress toward next level; mirrors onchain `xpTowardNext` (#301). */
  xp_toward_next?: string;
  /** Capped progression tier (#299); mirrors onchain `unlockedLevel`. */
  unlocked_level?: string;
  /** Global Last Buy epoch head (schema ≥ 2.10.0). */
  last_buy_epoch?: string;
  /** Wallet CHARM weight in `last_buy_epoch` (schema ≥ 2.10.0). */
  epoch_charm_wad?: string;
  /** Global CHARM total in `last_buy_epoch` (schema ≥ 2.10.0). */
  epoch_charm_total_wad?: string;
  /** Buy count in `last_buy_epoch` (DOUB + CRED; schema ≥ 2.10.0). */
  epoch_buy_count?: string;
  /** @deprecated Use `epoch_buy_count` — same value, kept for older clients. */
  epoch_doub_buy_count?: string;
  /** Active-epoch CRED preview — mirrors `pendingCred(wallet, lastBuyEpoch)` (schema ≥ 2.10.0). */
  pending_cred_accrual?: string;
  /** Ended epoch with claimable CRED, if any (schema ≥ 2.10.0). */
  claimable_cred_epoch?: string | null;
  /** Claimable CRED in `claimable_cred_epoch` (schema ≥ 2.10.0). */
  claimable_cred?: string;
  /** Derived Play CRED balance from referral mints, claims, and CRED buys (schema ≥ 2.10.0). */
  cred_balance_wad?: string;
  prizes_won: ArenaWalletPrizeWon[];
  total_won_doub: string;
  highest_scores: ArenaWalletHighestScore[];
  /** Per-podium scores in the active epoch head (schema ≥ 2.20.0). */
  current_scores?: ArenaWalletHighestScore[];
  /** Current WarBow BP — latest indexed snapshot or simulated timeline (#301). */
  warbow_battle_points?: string;
  /** Latest indexed `warbowGuardUntil` unix sec, when the wallet activated guard (#301). */
  warbow_guard_until?: string;
  warbow_steals: number;
  warbow_guards: number;
  cred_claimed: string;
  referral_cred_earned: string;
  longest_defended_streak: string;
  podium_win_rate: string;
  rank_distribution: Record<"1" | "2" | "3", string>;
  /** Progression milestone timestamps — levels 1–5 (#336, schema ≥ 2.18.0). */
  level_history?: ArenaWalletLevelHistoryEntry[];
};

export type ArenaWalletPrizeWon = {
  podium: string;
  epoch: string;
  rank: number;
  amount_doub: string;
};

export type ArenaWalletHighestScore = {
  podium: string;
  epoch: string;
  score: string;
  rank: number | null;
};

export async function fetchArenaBuys(limit = 20, offset = 0, cursor?: string | null) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return getJson<PaginatedItems<ArenaBuyItem>>(`/v1/arena/buys?${params.toString()}`);
}

export function arenaActivityApiPath(
  limit = 25,
  offset = 0,
  cursor?: string | null,
): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/v1/arena/activity?${params.toString()}`;
}

export async function fetchArenaActivity(limit = 25, offset = 0, cursor?: string | null) {
  return getJson<PaginatedItems<ArenaActivityItem>>(arenaActivityApiPath(limit, offset, cursor));
}

export async function fetchArenaTimers() {
  return getJson<ArenaTimersResponse>("/v1/arena/timers");
}

export type ArenaDoubSpotPriceResponse = {
  /** USDM wei (18 decimals on MegaETH) to buy 1 DOUB on Kumbaya. */
  usdm_per_doub_wad: string;
  /** 18-decimal USD-notional wad per 1 DOUB for prize USD display. */
  doub_usd_wad: string;
  polled_at_ms: number;
  read_block_number: string;
};

export async function fetchArenaDoubSpotPrice() {
  return getJson<ArenaDoubSpotPriceResponse>("/v1/arena/doub-spot-price");
}

export async function fetchArenaPodiums() {
  return getJson<ArenaPodiumsResponse>("/v1/arena/podiums");
}

export function arenaWalletStatsPath(address: string) {
  const w = address.trim().toLowerCase();
  return `/v1/arena/wallet/${w}/stats`;
}

export async function fetchArenaWalletStats(address: string) {
  return getJson<ArenaWalletStats>(arenaWalletStatsPath(address));
}

export type ArenaSessionSummaryWinner = {
  rank: number;
  address: string | null;
  prize_doub_wad: string;
};

export type ArenaSessionSummaryPodiumEpoch = {
  podium: string;
  category: number;
  epoch: string;
  winners: ArenaSessionSummaryWinner[];
  pool_paid_doub_wad: string;
};

export type ArenaSessionSummaryWallet = {
  address: string;
  buy_count: string;
  wins: string;
  rank_at_since: string | null;
  rank_now: string | null;
  rank_delta: string | null;
};

export type ArenaSessionSummary = {
  since_ms: string;
  elapsed_ms: string;
  total_buys: string;
  unique_players: string;
  podium_updates: string;
  podium_epochs_ended: ArenaSessionSummaryPodiumEpoch[];
  wallet_summary: ArenaSessionSummaryWallet | null;
};

export function arenaSessionSummaryApiPath(sinceMs: number, wallet?: string) {
  const params = new URLSearchParams({ since_ms: String(Math.floor(sinceMs)) });
  if (wallet?.trim()) {
    params.set("wallet", wallet.trim().toLowerCase());
  }
  return `/v1/arena/session-summary?${params.toString()}`;
}

/** Absent-session arena summary since browser last close ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)). */
export async function fetchArenaSessionSummary(sinceMs: number, wallet?: string) {
  return getJson<ArenaSessionSummary>(arenaSessionSummaryApiPath(sinceMs, wallet));
}

export type ArenaWarbowLatestBpItem = {
  player: string;
  battle_points: string;
};

/** Latest indexed WarBow BP per player (`GET /v1/arena/warbow/latest-bp`, #301). */
export async function fetchArenaWarbowLatestBp(players: readonly string[]) {
  const unique = [
    ...new Set(
      players
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.startsWith("0x") && p.length === 42),
    ),
  ].slice(0, 32);
  if (unique.length === 0) {
    return { items: [] as ArenaWarbowLatestBpItem[] };
  }
  const body = await getJson<{ items: ArenaWarbowLatestBpItem[] }>(
    `/v1/arena/warbow/latest-bp?players=${encodeURIComponent(unique.join(","))}`,
  );
  return body ?? { items: [] as ArenaWarbowLatestBpItem[] };
}
