// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  doubPerCharmAtLaunchWad,
  kumbayaBandLowerWad,
  LAUNCH_LIQUIDITY_ANCHOR_DEN,
  LAUNCH_LIQUIDITY_ANCHOR_NUM,
  launchLiquidityAnchorWad,
  participantLaunchValueCl8yWei,
  podiumCategorySlices,
  podiumPlacementShares,
  RESERVE_FEE_ROUTING_BPS,
} from "./timeCurvePodiumMath";

const WAD = 10n ** 18n;

describe("timeCurvePodiumMath", () => {
  it("fee bps sum to 10_000", () => {
    const s =
      RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity +
      RESERVE_FEE_ROUTING_BPS.cl8yBurned +
      RESERVE_FEE_ROUTING_BPS.podiumPool +
      RESERVE_FEE_ROUTING_BPS.team +
      RESERVE_FEE_ROUTING_BPS.rabbitTreasury;
    expect(s).toBe(10_000);
  });

  it("472 split on slice=7 yields 4,2,1", () => {
    expect(podiumPlacementShares(7n)).toEqual([4n, 2n, 1n]);
  });

  it("category slices partition pool (Last, WarBow, Defended, Time order)", () => {
    const [last, war, def, time] = podiumCategorySlices(100n);
    expect(last + war + def + time).toBe(100n);
    expect(last).toBe(40n);
    expect(war).toBe(25n);
    expect(def).toBe(20n);
    expect(time).toBe(15n);
  });
});

describe("launch-anchor invariant: launch price = final per-CHARM price × 1.275", () => {
  // The locked-liquidity sink (`DoubLPIncentives`) seeds DOUB/CL8Y at 1.275× the
  // clearing anchor ([GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158)).
  // Both `launchLiquidityAnchorWad` (operator/protocol math)
  // and `participantLaunchValueCl8yWei` (per-wallet UX) must obey the same
  // `LAUNCH_LIQUIDITY_ANCHOR_NUM / DEN` ratio — pin both to the spec example so any future drift is
  // caught immediately.

  it("launchLiquidityAnchorWad multiplies by exactly NUM/DEN (1275/1000)", () => {
    expect(launchLiquidityAnchorWad(WAD)).toBe((WAD * LAUNCH_LIQUIDITY_ANCHOR_NUM) / LAUNCH_LIQUIDITY_ANCHOR_DEN);
    expect(launchLiquidityAnchorWad(0n)).toBe(0n);
    // 5 reserve-per-DOUB clearing → 5 × 1.275 = 6.375 launch anchor.
    expect(launchLiquidityAnchorWad(5n * WAD)).toBe((5n * WAD * LAUNCH_LIQUIDITY_ANCHOR_NUM) / LAUNCH_LIQUIDITY_ANCHOR_DEN);
  });

  it("kumbayaBandLowerWad is 0.8× the launch anchor", () => {
    const launch = (5n * WAD * LAUNCH_LIQUIDITY_ANCHOR_NUM) / LAUNCH_LIQUIDITY_ANCHOR_DEN;
    expect(kumbayaBandLowerWad(launch)).toBe((launch * 8n) / 10n);
  });

  it("spec example: 1 CHARM at 2 CL8Y/CHARM final price ⇒ 2.55 CL8Y at launch", () => {
    // From the brief: "if the final user pays 2 cl8y for 1 charm and 1 charm
    // post launch is 100 doub, then 100 doub would be 2.55 cl8y worth."
    const oneCharm = WAD;
    const twoCl8yPerCharm = 2n * WAD;
    const expected = 255n * 10n ** 16n; // 2.55 CL8Y in 18-decimal wei
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: oneCharm, pricePerCharmWad: twoCl8yPerCharm }),
    ).toBe(expected);
  });

  it("scales linearly in CHARM (10 CHARM → 25.5 CL8Y at launch)", () => {
    const tenCharm = 10n * WAD;
    const twoCl8yPerCharm = 2n * WAD;
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: tenCharm, pricePerCharmWad: twoCl8yPerCharm }),
    ).toBe(255n * 10n ** 17n);
  });

  it("returns undefined when an input is missing (unloaded reads)", () => {
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: undefined, pricePerCharmWad: WAD }),
    ).toBeUndefined();
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: WAD, pricePerCharmWad: undefined }),
    ).toBeUndefined();
  });

  it("returns 0 when charm or price is 0 (so UI shows a clean zero, not '—')", () => {
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: 0n, pricePerCharmWad: 2n * WAD }),
    ).toBe(0n);
    expect(
      participantLaunchValueCl8yWei({ charmWeightWad: WAD, pricePerCharmWad: 0n }),
    ).toBe(0n);
  });

  it("non-decreasing as the per-CHARM price grows (LinearCharmPrice invariant)", () => {
    // Mirrors the contract-side "implied CL8Y per DOUB only increases" invariant
    // documented in docs/product/primitives.md and PARAMETERS.md row 42.
    const charm = 5n * WAD;
    let prev = -1n;
    for (let p = 1; p <= 50; p++) {
      const v = participantLaunchValueCl8yWei({
        charmWeightWad: charm,
        pricePerCharmWad: BigInt(p) * 10n ** 17n, // 0.1 CL8Y, 0.2 CL8Y, … per CHARM
      });
      expect(v).toBeDefined();
      expect((v as bigint) >= prev).toBe(true);
      prev = v as bigint;
    }
  });

  it("doubPerCharmAtLaunchWad: 200M DOUB / 2M total CHARM ⇒ 100 DOUB per CHARM", () => {
    const total = 200_000_000n * WAD;
    const charm = 2_000_000n * WAD;
    expect(doubPerCharmAtLaunchWad({ totalTokensForSaleWad: total, totalCharmWeightWad: charm }))
      .toBe(100n * WAD);
  });

  it("doubPerCharmAtLaunchWad: returns undefined before any CHARM minted (avoids div-by-zero)", () => {
    expect(
      doubPerCharmAtLaunchWad({
        totalTokensForSaleWad: 200_000_000n * WAD,
        totalCharmWeightWad: 0n,
      }),
    ).toBeUndefined();
    expect(
      doubPerCharmAtLaunchWad({ totalTokensForSaleWad: undefined, totalCharmWeightWad: WAD }),
    ).toBeUndefined();
  });

  it("doubPerCharmAtLaunchWad: monotonically NON-INCREASING as totalCharmWeight grows", () => {
    // The redemption-rate side of the invariant — `DOUB per CHARM` falls as
    // more CHARM mints, while CL8Y-per-CHARM rises (`participantLaunchValueCl8yWei`).
    const total = 200_000_000n * WAD;
    let prev = (1n << 256n) - 1n; // sentinel: max possible bigint
    for (let charmMillions = 1; charmMillions <= 50; charmMillions++) {
      const got = doubPerCharmAtLaunchWad({
        totalTokensForSaleWad: total,
        totalCharmWeightWad: BigInt(charmMillions) * 1_000_000n * WAD,
      })!;
      expect(got).toBeDefined();
      expect(got <= prev).toBe(true);
      prev = got;
    }
  });

  it("is consistent with launchLiquidityAnchorWad for a single CHARM", () => {
    // The two helpers are different framings of the same anchor: per-DOUB at the
    // protocol level, per-CHARM at the participant level. Confirm they agree
    // when the `DOUB per CHARM` ratio is 1 (i.e. clearing == per-CHARM price).
    const pricePerCharm = 7n * WAD;
    const protocolAnchor = launchLiquidityAnchorWad(pricePerCharm);
    const participant = participantLaunchValueCl8yWei({
      charmWeightWad: WAD,
      pricePerCharmWad: pricePerCharm,
    });
    expect(participant).toBe(protocolAnchor);
  });
});
