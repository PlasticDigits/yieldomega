// SPDX-License-Identifier: AGPL-3.0-only

const WAD = 10n ** 18n;

/** Parse `doub_usd_wad` from `GET /v1/arena/doub-spot-price`. */
export function parseDoubUsdWad(raw: string | undefined | null): bigint | undefined {
  if (raw == null || raw === "" || raw === "0") {
    return undefined;
  }
  try {
    const v = BigInt(raw);
    return v > 0n ? v : undefined;
  } catch {
    return undefined;
  }
}

/** USD-notional wad for a DOUB wei amount (`usdWad = doubWei * doubUsdWad / WAD`). */
export function doubWeiToUsdNotionalWad(doubWei: bigint, doubUsdWad: bigint): bigint {
  return (doubWei * doubUsdWad) / WAD;
}

/** Podium “≈ $… USD” wei when indexer supplied a DOUB/USD wad; otherwise omit. */
export function podiumPrizeUsdWeiForDisplay(
  prizeDoubWei: bigint,
  doubUsdWad: bigint | undefined,
): bigint | undefined {
  if (prizeDoubWei <= 0n || doubUsdWad === undefined || doubUsdWad <= 0n) {
    return undefined;
  }
  return doubWeiToUsdNotionalWad(prizeDoubWei, doubUsdWad);
}
