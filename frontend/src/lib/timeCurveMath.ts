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

/** Onchain `CHARM_MIN_BASE_WAD` (0.99e18). */
export const CHARM_MIN_BASE_WAD = 99n * 10n ** 16n;
/** Onchain `CHARM_MAX_BASE_WAD` (10e18). */
export const CHARM_MAX_BASE_WAD = 10n * WAD;

export function minCharmWadAt(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  elapsed: bigint,
): bigint {
  const scale = currentMinBuyAt(charmEnvelopeRefWad, growthRateWad, elapsed);
  return (CHARM_MIN_BASE_WAD * scale) / charmEnvelopeRefWad;
}

export function maxCharmWadAt(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  elapsed: bigint,
): bigint {
  const scale = currentMinBuyAt(charmEnvelopeRefWad, growthRateWad, elapsed);
  return (CHARM_MAX_BASE_WAD * scale) / charmEnvelopeRefWad;
}

/** Matches `LinearCharmPrice.priceWad`. */
export function linearPriceWad(basePriceWad: bigint, dailyIncrementWad: bigint, elapsed: bigint): bigint {
  return basePriceWad + (dailyIncrementWad * elapsed) / SECONDS_PER_DAY;
}

/**
 * Same exponent as `TimeMath.currentMinBuy` but with fractional elapsed seconds (live UI).
 * `growthRateWad * elapsed / SECONDS_PER_DAY` with microsecond granularity.
 */
export function growthExponentWadFromElapsedFloat(growthRateWad: bigint, elapsedSec: number): bigint {
  if (elapsedSec <= 0) return 0n;
  const us = BigInt(Math.round(elapsedSec * 1_000_000));
  return (growthRateWad * us) / (86400n * 1_000_000n);
}

/** `TimeMath.currentMinBuy` with fractional elapsed (centisecond-friendly live display). */
export function currentMinBuyAtFloat(
  initialMinBuy: bigint,
  growthRateWad: bigint,
  elapsedSec: number,
): bigint {
  if (elapsedSec <= 0) return initialMinBuy;
  const exponentWad = growthExponentWadFromElapsedFloat(growthRateWad, elapsedSec);
  const factorFloat = Math.exp(Number(exponentWad) / Number(WAD));
  if (!Number.isFinite(factorFloat) || factorFloat <= 0) {
    return initialMinBuy;
  }
  const factorWad = BigInt(Math.round(factorFloat * Number(WAD)));
  return (initialMinBuy * factorWad) / WAD;
}

/** `LinearCharmPrice.priceWad` with fractional elapsed. */
export function linearPriceWadFloat(
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsedSec: number,
): bigint {
  const us = BigInt(Math.round(Math.max(0, elapsedSec) * 1_000_000));
  return basePriceWad + (dailyIncrementWad * us) / (86400n * 1_000_000n);
}

export function minCharmWadAtFloat(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  elapsedSec: number,
): bigint {
  const scale = currentMinBuyAtFloat(charmEnvelopeRefWad, growthRateWad, elapsedSec);
  return (CHARM_MIN_BASE_WAD * scale) / charmEnvelopeRefWad;
}

export function maxCharmWadAtFloat(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  elapsedSec: number,
): bigint {
  const scale = currentMinBuyAtFloat(charmEnvelopeRefWad, growthRateWad, elapsedSec);
  return (CHARM_MAX_BASE_WAD * scale) / charmEnvelopeRefWad;
}

export function minGrossSpendAtFloat(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsedSec: number,
): bigint {
  const c = minCharmWadAtFloat(charmEnvelopeRefWad, growthRateWad, elapsedSec);
  const p = linearPriceWadFloat(basePriceWad, dailyIncrementWad, elapsedSec);
  return (c * p) / WAD;
}

/**
 * Gross min from `minGrossSpendAt*` uses the on-chain minimum CHARM weight `CHARM_MIN_BASE_WAD` (0.99e18)
 * as a revert buffer. **UI / charts** use nominal min spend = on-chain min × WAD ÷ `CHARM_MIN_BASE_WAD` so the
 * band reads as **1 : 10** (min : max) in CL8Y. Call sites that compare to **tx amounts** should keep contract mins.
 */
export function displayMinGrossSpendWad(contractMinGrossWad: bigint): bigint {
  if (contractMinGrossWad <= 0n) {
    return 0n;
  }
  return (contractMinGrossWad * WAD) / CHARM_MIN_BASE_WAD;
}

/** Contract `minGrossSpendAtFloat`, then {@link displayMinGrossSpendWad} for user-facing gross min CL8Y. */
export function displayMinGrossSpendAtFloat(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsedSec: number,
): bigint {
  const m = minGrossSpendAtFloat(
    charmEnvelopeRefWad,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    elapsedSec,
  );
  return displayMinGrossSpendWad(m);
}

/** Maximum gross reserve spend at elapsed (max CHARM × linear price). */
export function maxGrossSpendAt(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsed: bigint,
): bigint {
  const c = maxCharmWadAt(charmEnvelopeRefWad, growthRateWad, elapsed);
  const p = linearPriceWad(basePriceWad, dailyIncrementWad, elapsed);
  return (c * p) / WAD;
}

export function maxGrossSpendAtFloat(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsedSec: number,
): bigint {
  const c = maxCharmWadAtFloat(charmEnvelopeRefWad, growthRateWad, elapsedSec);
  const p = linearPriceWadFloat(basePriceWad, dailyIncrementWad, elapsedSec);
  return (c * p) / WAD;
}

/** Minimum gross asset for a buy at `elapsed` (min CHARM × linear price). */
export function minGrossSpendAt(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsed: bigint,
): bigint {
  const c = minCharmWadAt(charmEnvelopeRefWad, growthRateWad, elapsed);
  const p = linearPriceWad(basePriceWad, dailyIncrementWad, elapsed);
  return (c * p) / WAD;
}

/** Illustrative curve: min gross spend vs elapsed (envelope × linear price). */
export function sampleMinSpendCurve(
  charmEnvelopeRefWad: bigint,
  growthRateWad: bigint,
  basePriceWad: bigint,
  dailyIncrementWad: bigint,
  elapsedMax: bigint,
  points: number,
): { elapsed: bigint; minSpend: bigint }[] {
  if (points < 2 || elapsedMax <= 0n) {
    return [
      {
        elapsed: 0n,
        minSpend: displayMinGrossSpendWad(
          minGrossSpendAt(
            charmEnvelopeRefWad,
            growthRateWad,
            basePriceWad,
            dailyIncrementWad,
            0n,
          ),
        ),
      },
    ];
  }
  const out: { elapsed: bigint; minSpend: bigint }[] = [];
  for (let i = 0; i < points; i += 1) {
    const elapsed = (elapsedMax * BigInt(i)) / BigInt(points - 1);
    out.push({
      elapsed,
      minSpend: displayMinGrossSpendWad(
        minGrossSpendAt(
          charmEnvelopeRefWad,
          growthRateWad,
          basePriceWad,
          dailyIncrementWad,
          elapsed,
        ),
      ),
    });
  }
  return out;
}
