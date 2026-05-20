// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchReferralReferrerLeaderboard,
  type ReferralReferrerLeaderboardItem,
  type ReferralReferrerLeaderboardPage,
} from "@/lib/indexerApi";

export type ReferralLeaderboardGlobalTotals = {
  totalCodesRegistered: bigint;
  totalBuys: bigint;
  totalCharmWad: bigint;
  totalReferrers: number;
};

/** True when the indexer serves schema ≥ 1.25.0 network-wide summary fields ([GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225)). */
export function referralLeaderboardPageHasGlobalTotals(page: ReferralReferrerLeaderboardPage): boolean {
  return (
    page.total !== undefined &&
    page.total_codes_registered !== undefined &&
    page.total_referred_buys !== undefined &&
    page.total_referrer_charm_wad !== undefined
  );
}

export function parseReferralLeaderboardGlobalTotals(
  page: ReferralReferrerLeaderboardPage,
): ReferralLeaderboardGlobalTotals | null {
  if (!referralLeaderboardPageHasGlobalTotals(page)) {
    return null;
  }
  return {
    totalCodesRegistered: BigInt(page.total_codes_registered!),
    totalBuys: BigInt(page.total_referred_buys!),
    totalCharmWad: BigInt(page.total_referrer_charm_wad!),
    totalReferrers: page.total!,
  };
}

export function aggregateReferralLeaderboardGlobalTotalsFromItems(
  items: ReferralReferrerLeaderboardItem[],
): ReferralLeaderboardGlobalTotals {
  let totalCodesRegistered = 0n;
  let totalBuys = 0n;
  let totalCharmWad = 0n;
  for (const it of items) {
    totalCodesRegistered += BigInt(it.codes_registered_count ?? "0");
    totalBuys += BigInt(it.referred_buy_count);
    totalCharmWad += BigInt(it.total_referrer_charm_wad);
  }
  return {
    totalCodesRegistered,
    totalBuys,
    totalCharmWad,
    totalReferrers: items.length,
  };
}

const LEGACY_GLOBALS_PAGE_SIZE = 100;
const LEGACY_GLOBALS_MAX_PAGES = 50;

/** Paginate the leaderboard until `next_offset` is absent (legacy schema < 1.25.0 fallback). */
export async function fetchReferralReferrerLeaderboardAllItems(): Promise<
  ReferralReferrerLeaderboardItem[] | null
> {
  const all: ReferralReferrerLeaderboardItem[] = [];
  let offset = 0;
  for (let page = 0; page < LEGACY_GLOBALS_MAX_PAGES; page += 1) {
    const chunk = await fetchReferralReferrerLeaderboard(LEGACY_GLOBALS_PAGE_SIZE, offset);
    if (!chunk) {
      return null;
    }
    all.push(...chunk.items);
    if (chunk.next_offset == null) {
      return all;
    }
    offset = chunk.next_offset;
  }
  return null;
}
