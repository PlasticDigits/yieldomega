// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  computeDoubProjectionStats,
  PROJECTED_DOUB_SUPPLY_WAD,
  PROJECTED_DOUB_SUPPLY_WHOLE,
} from "./doubProjectionStats";
import { LAUNCH_LIQUIDITY_ANCHOR_DEN, LAUNCH_LIQUIDITY_ANCHOR_NUM } from "./timeCurvePodiumMath";

const WAD = 10n ** 18n;
const SALE_BUCKET = 200n * 1_000_000n * WAD;

describe("doubProjectionStats", () => {
  it("exposes 251M whole-token policy supply", () => {
    expect(PROJECTED_DOUB_SUPPLY_WHOLE).toBe(251_000_000n);
    expect(PROJECTED_DOUB_SUPPLY_WAD).toBe(251_000_000n * WAD);
  });

  it("computes CHARM→DOUB, clearing, launch anchor, and launch-anchor market cap", () => {
    const totalRaised = 50n * WAD;
    const totalCharmWeight = 2n * WAD;
    const stats = computeDoubProjectionStats({
      totalRaisedWei: totalRaised,
      totalTokensForSaleWei: SALE_BUCKET,
      totalCharmWeightWei: totalCharmWeight,
      currentPricePerCharmWad: 2n * WAD,
    });
    expect(stats).not.toBeNull();

    const clearing = (totalRaised * WAD) / SALE_BUCKET;
    expect(stats!.clearingCl8yPerDoubWad).toBe(clearing);
    expect(stats!.launchAnchorCl8yPerDoubWad).toBe(
      (clearing * LAUNCH_LIQUIDITY_ANCHOR_NUM) / LAUNCH_LIQUIDITY_ANCHOR_DEN,
    );
    expect(stats!.doubPerCharmAtLaunchWad).toBe((SALE_BUCKET * WAD) / totalCharmWeight);
    expect(stats!.impliedMarketCapCl8yWei).toBe(
      (PROJECTED_DOUB_SUPPLY_WAD * stats!.launchAnchorCl8yPerDoubWad) / WAD,
    );
    expect(stats!.saleBucketMatchesPolicy).toBe(true);
    expect(stats!.saleAllocationBps).toBe((totalCharmWeight * 10_000n) / SALE_BUCKET);
  });

  it("returns undefined doubPerCharm when totalCharmWeight is zero", () => {
    const stats = computeDoubProjectionStats({
      totalRaisedWei: 0n,
      totalTokensForSaleWei: SALE_BUCKET,
      totalCharmWeightWei: 0n,
      currentPricePerCharmWad: WAD,
    });
    expect(stats?.doubPerCharmAtLaunchWad).toBeUndefined();
  });

  it("returns null when totalTokensForSale is zero", () => {
    expect(
      computeDoubProjectionStats({
        totalRaisedWei: WAD,
        totalTokensForSaleWei: 0n,
        totalCharmWeightWei: WAD,
        currentPricePerCharmWad: WAD,
      }),
    ).toBeNull();
  });
});
