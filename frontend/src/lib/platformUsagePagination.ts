// SPDX-License-Identifier: AGPL-3.0-only

/** Default page size for protocol platform-usage wallet table ([GitLab #231](https://gitlab.com/PlasticDigits/yieldomega/-/issues/231)). */
export const PLATFORM_USAGE_WALLET_PAGE_SIZE = 50;

export function platformUsagePageIndex(offset: number, limit: number): number {
  if (limit <= 0) {
    return 1;
  }
  return Math.floor(offset / limit) + 1;
}

export function platformUsageOffsetForPage(page: number, limit: number): number {
  const safePage = Math.max(1, page);
  return (safePage - 1) * limit;
}

export function platformUsageVisiblePages(
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

export function platformUsageTotalPages(totalWallets: number, limit: number): number {
  if (totalWallets <= 0 || limit <= 0) {
    return 0;
  }
  return Math.ceil(totalWallets / limit);
}
