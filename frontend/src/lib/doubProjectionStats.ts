// SPDX-License-Identifier: AGPL-3.0-only

import {
  doubPerCharmAtLaunchWad,
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";

/**
 * Policy constant for full DOUB genesis supply (200M sale + 21.5M presale + 28.5M V3 LP + 1M airdrops).
 * Product sign-off [GitLab #229](https://gitlab.com/PlasticDigits/yieldomega/-/issues/229);
 * see [`launchplan-timecurve.md`](../../../launchplan-timecurve.md) §4 (250M table + 1M airdrops footnote).
 */
export const PROJECTED_DOUB_SUPPLY_WHOLE = 251_000_000n;

const WAD = 10n ** 18n;

export const PROJECTED_DOUB_SUPPLY_WAD = PROJECTED_DOUB_SUPPLY_WHOLE * WAD;

export type DoubProjectionOnchainInputs = {
  totalRaisedWei: bigint;
  totalTokensForSaleWei: bigint;
  totalCharmWeightWei: bigint;
  currentPricePerCharmWad: bigint;
};

export type DoubProjectionComputed = {
  clearingCl8yPerDoubWad: bigint;
  launchAnchorCl8yPerDoubWad: bigint;
  kumbayaBandLowerCl8yPerDoubWad: bigint;
  /** `undefined` when no CHARM minted yet (denominator zero). */
  doubPerCharmAtLaunchWad: bigint | undefined;
  /** `projectedSupply × launch anchor` — market cap uses launch anchor per #229. */
  impliedMarketCapCl8yWei: bigint;
};

/**
 * Pure projection snapshot from onchain totals + policy supply constant.
 * Caller supplies reads already parsed to bigint; no RPC here.
 */
export function computeDoubProjectionStats(
  onchain: DoubProjectionOnchainInputs,
  options?: { projectedSupplyWad?: bigint },
): DoubProjectionComputed | null {
  const { totalRaisedWei, totalTokensForSaleWei, totalCharmWeightWei } = onchain;
  const projectedSupplyWad = options?.projectedSupplyWad ?? PROJECTED_DOUB_SUPPLY_WAD;

  const clearing = projectedReservePerDoubWad(totalRaisedWei, totalTokensForSaleWei);
  if (clearing === null) {
    return null;
  }

  const launchAnchor = launchLiquidityAnchorWad(clearing);
  const kLo = kumbayaBandLowerWad(launchAnchor);
  const doubPerCharm = doubPerCharmAtLaunchWad({
    totalTokensForSaleWad: totalTokensForSaleWei,
    totalCharmWeightWad: totalCharmWeightWei,
  });

  const impliedMarketCapCl8yWei = (projectedSupplyWad * launchAnchor) / WAD;

  return {
    clearingCl8yPerDoubWad: clearing,
    launchAnchorCl8yPerDoubWad: launchAnchor,
    kumbayaBandLowerCl8yPerDoubWad: kLo,
    doubPerCharmAtLaunchWad: doubPerCharm,
    impliedMarketCapCl8yWei,
  };
}
