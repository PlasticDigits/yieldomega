// SPDX-License-Identifier: AGPL-3.0-only

/** Wall clock minus chain head time (seconds), captured once per anchor; subtract 1 so we assume the round ends one second sooner. */
export function conservativeSkewWallMinusChainSec(
  fetchedAtSec: number,
  blockTimestampSec: number,
): number {
  return fetchedAtSec - blockTimestampSec - 1;
}

/** Effective chain `block.timestamp` from a fixed skew anchor and wall clock ([#343](https://gitlab.com/PlasticDigits/yieldomega/-/issues/343)). */
export function chainNowSecFromSkew(
  skewWallMinusChainSec: number,
  wallSec: number = Math.floor(Date.now() / 1000),
): number {
  return wallSec - skewWallMinusChainSec;
}
