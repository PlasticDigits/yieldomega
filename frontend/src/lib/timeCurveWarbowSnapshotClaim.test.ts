// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { viewerShouldSuggestWarBowPodiumRefresh } from "./timeCurveWarbowSnapshotClaim";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const D = "0xdddddddddddddddddddddddddddddddddddddddd" as const;

describe("viewerShouldSuggestWarBowPodiumRefresh (GitLab #172)", () => {
  it("always false — permissionless refresh removed; governance finalize only post-end", () => {
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 900n,
        podiumWallets: [D, D, D],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: false,
      }),
    ).toBe(false);
    expect(
      viewerShouldSuggestWarBowPodiumRefresh({
        viewer: A,
        viewerBp: 900n,
        podiumWallets: [D, D, D],
        podiumValues: [1000n, 800n, 500n],
        saleEnded: true,
      }),
    ).toBe(false);
  });
});
