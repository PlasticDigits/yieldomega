// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { viewerShouldSuggestWarBowPodiumRefresh, warBowRefreshCandidateAddresses } from "./timeCurveWarbowSnapshotClaim";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const C = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const D = "0xdddddddddddddddddddddddddddddddddddddddd" as const;
/** Higher `uint160` than `B` — use for off-podium equal-BP tie-break cases */
const E = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
const Z = "0x0000000000000000000000000000000000000000" as const;

describe("viewerShouldSuggestWarBowPodiumRefresh", () => {
  it("flags when viewer beats third place but is not listed", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 900n,
        podiumWallets: [D, C, B],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(true);
  });

  it("silent when viewer is ranked with matching BP snapshot", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 500n,
        podiumWallets: [D, C, A],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(false);
  });

  it("flags value mismatch while listed", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 600n,
        podiumWallets: [D, C, A],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(true);
  });

  it("never after sale end", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 900n,
        podiumWallets: [D, C, B],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: true,
      }),
    ).toBe(false);
  });

  it("handles empty third slot", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 1n,
        podiumWallets: [B, B, Z],
        podiumValues: [1000n, 800n, 0n],
        saleEnded: false,
      }),
    ).toBe(true);
  });

  it("flags equal-BP edge when viewer uint160 is lower than rank-3 holder (onchain tie-break)", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 500n,
        podiumWallets: [D, C, B],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(true);
  });

  it("silent on equal-BP when viewer uint160 is higher than rank-3 holder", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: E,
        viewerBp: 500n,
        podiumWallets: [D, C, B],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(false);
  });
});

describe("warBowRefreshCandidateAddresses", () => {
  it("dedupes and skips zero address", () => {
    expect(
      warBowRefreshCandidateAddresses({
        viewer: A,
        podiumWallets: [Z, B, B],
      }),
    ).toEqual([A, B]);
  });
});
