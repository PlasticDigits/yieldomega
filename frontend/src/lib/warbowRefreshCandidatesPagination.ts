// SPDX-License-Identifier: AGPL-3.0-only

import type { WarbowRefreshCandidatesResponse } from "@/lib/indexerApi";

/** Matches `fetchTimecurveWarbowRefreshCandidates` clamp (indexer page size). */
export const WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT = 500;

/** Frontend safety ceiling: `page_limit × max_pages` rows before we stop paging. */
export const WARBOW_REFRESH_CANDIDATES_MAX_PAGES = 50;

export type AccumulateWarbowRefreshCandidatesOk = {
  ok: true;
  pages: string[];
  apiTotal: number;
  podiumWarbowHintCount: number;
  /** True when paging stopped because `max_pages` was reached while `next_offset` stayed set ([GitLab #174](https://gitlab.com/PlasticDigits/yieldomega/-/issues/174)). */
  truncatedByGuard: boolean;
};

export type AccumulateWarbowRefreshCandidatesErr = {
  ok: false;
  reason: "null_response";
};

/**
 * Fetches all refresh-candidate wallet strings the UI is willing to load (paginated).
 * Surfaces guard exhaustion via `truncatedByGuard` so operators know the list may be incomplete.
 */
export async function accumulateWarbowRefreshCandidatePages(
  fetchChunk: (
    limit: number,
    offset: number,
  ) => Promise<WarbowRefreshCandidatesResponse | null>,
): Promise<AccumulateWarbowRefreshCandidatesOk | AccumulateWarbowRefreshCandidatesErr> {
  const pages: string[] = [];
  let off = 0;
  let guard = 0;
  let apiTotal = 0;
  let podiumWarbowHintCount = 0;

  while (guard < WARBOW_REFRESH_CANDIDATES_MAX_PAGES) {
    guard += 1;
    const chunk = await fetchChunk(WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT, off);
    if (!chunk) {
      return { ok: false, reason: "null_response" };
    }
    if (off === 0) {
      apiTotal = chunk.total;
      podiumWarbowHintCount = chunk.podium_warbow_hint_count;
    }
    if (Array.isArray(chunk.candidates)) {
      for (const c of chunk.candidates) {
        pages.push(c);
      }
    }
    const next = chunk.next_offset ?? null;
    if (next === null) {
      return {
        ok: true,
        pages,
        apiTotal,
        podiumWarbowHintCount,
        truncatedByGuard: false,
      };
    }
    off = next;
  }

  return {
    ok: true,
    pages,
    apiTotal,
    podiumWarbowHintCount,
    truncatedByGuard: true,
  };
}
