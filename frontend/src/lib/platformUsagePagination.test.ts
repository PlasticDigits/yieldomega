// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  PLATFORM_USAGE_WALLET_PAGE_SIZE,
  platformUsageOffsetForPage,
  platformUsagePageIndex,
  platformUsageTotalPages,
  platformUsageVisiblePages,
} from "./platformUsagePagination";

describe("platformUsagePagination", () => {
  it("uses page size 50", () => {
    expect(PLATFORM_USAGE_WALLET_PAGE_SIZE).toBe(50);
  });

  it("maps offset to page index", () => {
    expect(platformUsagePageIndex(0, 50)).toBe(1);
    expect(platformUsagePageIndex(50, 50)).toBe(2);
  });

  it("maps page to offset", () => {
    expect(platformUsageOffsetForPage(2, 50)).toBe(50);
  });

  it("computes total pages", () => {
    expect(platformUsageTotalPages(0, 50)).toBe(0);
    expect(platformUsageTotalPages(51, 50)).toBe(2);
  });

  it("builds visible page window with ellipsis", () => {
    expect(platformUsageVisiblePages(5, 10, 1)).toEqual([1, null, 4, 5, 6, null, 10]);
  });
});
