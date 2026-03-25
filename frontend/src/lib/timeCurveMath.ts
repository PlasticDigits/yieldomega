// SPDX-License-Identifier: AGPL-3.0-only

/** 1e18 fixed-point — matches Solidity WAD in TimeMath. */
export const WAD = 10n ** 18n;

const SECONDS_PER_DAY = 86400n;

/**
 * Minimum buy at `elapsed` seconds after sale start — mirrors
 * `TimeMath.currentMinBuy` in contracts (PRB `exp` on WAD exponent).
 * Chart / UI only; onchain `currentMinBuyAmount()` is authoritative.
 */
export function currentMinBuyAt(
  initialMinBuy: bigint,
  growthRateWad: bigint,
  elapsed: bigint,
): bigint {
  if (elapsed <= 0n) {
    return initialMinBuy;
  }
  const exponentWad = (growthRateWad * elapsed) / SECONDS_PER_DAY;
  const factorFloat = Math.exp(Number(exponentWad) / Number(WAD));
  if (!Number.isFinite(factorFloat) || factorFloat <= 0) {
    return initialMinBuy;
  }
  const factorWad = BigInt(Math.round(factorFloat * Number(WAD)));
  return (initialMinBuy * factorWad) / WAD;
}

/** Sample `points` values from elapsed 0 .. `elapsedMax` for SVG paths. */
export function sampleMinBuyCurve(
  initialMinBuy: bigint,
  growthRateWad: bigint,
  elapsedMax: bigint,
  points: number,
): { elapsed: bigint; minBuy: bigint }[] {
  if (points < 2 || elapsedMax <= 0n) {
    return [{ elapsed: 0n, minBuy: currentMinBuyAt(initialMinBuy, growthRateWad, 0n) }];
  }
  const out: { elapsed: bigint; minBuy: bigint }[] = [];
  for (let i = 0; i < points; i += 1) {
    const elapsed = (elapsedMax * BigInt(i)) / BigInt(points - 1);
    out.push({
      elapsed,
      minBuy: currentMinBuyAt(initialMinBuy, growthRateWad, elapsed),
    });
  }
  return out;
}
