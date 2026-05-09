// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import {
  WARBOW_REFRESH_CANDIDATES_MAX_PAGES,
  WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT,
  accumulateWarbowRefreshCandidatePages,
} from "@/lib/warbowRefreshCandidatesPagination";
import type { WarbowRefreshCandidatesResponse } from "@/lib/indexerApi";

function chunk(
  candidates: string[],
  offset: number,
  next: number | null,
  total = 99,
  podiumHint = 0,
): WarbowRefreshCandidatesResponse {
  return {
    candidates,
    limit: WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT,
    offset,
    total,
    next_offset: next,
    podium_warbow_hint_count: podiumHint,
    sale_ended: false,
  };
}

describe("accumulateWarbowRefreshCandidatePages", () => {
  it("returns truncatedByGuard false when API ends with next_offset null", async () => {
    const fetchChunk = vi
      .fn()
      .mockResolvedValueOnce(chunk(["0x1111111111111111111111111111111111111111"], 0, null));

    const r = await accumulateWarbowRefreshCandidatePages(fetchChunk);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.truncatedByGuard).toBe(false);
    expect(r.pages).toHaveLength(1);
    expect(fetchChunk).toHaveBeenCalledTimes(1);
  });

  it("returns null_response when fetch returns null", async () => {
    const fetchChunk = vi.fn().mockResolvedValue(null);
    const r = await accumulateWarbowRefreshCandidatePages(fetchChunk);
    expect(r).toEqual({ ok: false, reason: "null_response" });
  });

  it("sets truncatedByGuard when max pages consumed with a non-null final next_offset", async () => {
    const fetchChunk = vi.fn().mockImplementation((_lim: number, off: number) => {
      const wallet = `0x${String(off).padStart(40, "a")}`;
      return Promise.resolve(chunk([wallet], off, off + 1));
    });

    const r = await accumulateWarbowRefreshCandidatePages(fetchChunk);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.truncatedByGuard).toBe(true);
    expect(fetchChunk).toHaveBeenCalledTimes(WARBOW_REFRESH_CANDIDATES_MAX_PAGES);
    expect(r.pages).toHaveLength(WARBOW_REFRESH_CANDIDATES_MAX_PAGES);
  });
});
