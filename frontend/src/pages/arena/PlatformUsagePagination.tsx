// SPDX-License-Identifier: AGPL-3.0-only

import { platformUsageVisiblePages } from "@/lib/platformUsagePagination";

type Props = {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function PlatformUsagePagination({
  currentPage,
  totalPages,
  disabled = false,
  onPageChange,
}: Props) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = platformUsageVisiblePages(currentPage, totalPages);

  return (
    <nav
      className="referrals-leaderboard-pagination"
      aria-label="Platform usage wallet pages"
      data-testid="arena-protocol-platform-usage-pagination"
    >
      <button
        type="button"
        className="referrals-leaderboard-pagination__edge"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        Prev
      </button>
      <ol className="referrals-leaderboard-pagination__pages">
        {pages.map((page, idx) =>
          page === null ? (
            <li key={`gap-${idx}`} className="referrals-leaderboard-pagination__gap" aria-hidden>
              …
            </li>
          ) : (
            <li key={page}>
              <button
                type="button"
                className={[
                  "referrals-leaderboard-pagination__page",
                  page === currentPage ? "referrals-leaderboard-pagination__page--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={disabled}
                aria-current={page === currentPage ? "page" : undefined}
                data-testid={`arena-protocol-platform-usage-page-${page}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        className="referrals-leaderboard-pagination__edge"
        disabled={disabled || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}
