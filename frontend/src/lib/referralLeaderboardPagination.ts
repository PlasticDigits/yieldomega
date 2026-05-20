// SPDX-License-Identifier: AGPL-3.0-only

/** Default page size for `/referrals` Guide leaderboard ([GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225)). */
export const REFERRAL_LEADERBOARD_PAGE_SIZE = 20;

export function referralLeaderboardPageIndex(offset: number, limit: number): number {
  if (limit <= 0) {
    return 1;
  }
  return Math.floor(offset / limit) + 1;
}

export function referralLeaderboardOffsetForPage(page: number, limit: number): number {
  const safePage = Math.max(1, page);
  return (safePage - 1) * limit;
}

/**
 * Numbered page controls: always includes first/last when omitted from the window,
 * with ellipsis markers represented as `null`.
 */
export function referralLeaderboardVisiblePages(
  currentPage: number,
  totalPages: number,
  windowRadius = 2,
): Array<number | null> {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }
  const cur = Math.min(Math.max(1, currentPage), totalPages);
  const pages = new Set<number>([1, totalPages]);
  for (let p = cur - windowRadius; p <= cur + windowRadius; p += 1) {
    if (p >= 1 && p <= totalPages) {
      pages.add(p);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    if (i > 0 && p - sorted[i - 1]! > 1) {
      out.push(null);
    }
    out.push(p);
  }
  return out;
}

export function referralLeaderboardTotalPages(totalReferrers: number, limit: number): number {
  if (totalReferrers <= 0 || limit <= 0) {
    return 0;
  }
  return Math.ceil(totalReferrers / limit);
}
