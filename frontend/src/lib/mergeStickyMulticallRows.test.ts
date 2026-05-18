// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { mergeStickyMulticallRows } from "@/lib/mergeStickyMulticallRows";

describe("mergeStickyMulticallRows", () => {
  it("falls back to the previous successful row when the live row fails", () => {
    const prev = [{ status: "success" as const, result: 1n }] as const;
    const live = [{ status: "failure" as const }] as const;
    expect(mergeStickyMulticallRows(live, prev)[0]).toEqual({
      status: "success",
      result: 1n,
    });
  });

  it("prefers a fresh success over stale sticky rows", () => {
    const prev = [{ status: "success" as const, result: 1n }] as const;
    const live = [{ status: "success" as const, result: 2n }] as const;
    expect(mergeStickyMulticallRows(live, prev)[0]).toEqual({
      status: "success",
      result: 2n,
    });
  });
});
