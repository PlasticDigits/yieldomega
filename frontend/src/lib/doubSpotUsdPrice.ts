// SPDX-License-Identifier: AGPL-3.0-only

import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";

const WAD = 10n ** 18n;

/** Parse indexed `doub_usd_wad` (USDM-notional per 1 DOUB, 18-dec wad) from `GET /v1/arena/timers`. */
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

/** USD-notional wad for a DOUB wei amount using indexed TWAP anchor (USDM treated as ~$1). */
export function doubWeiToUsdNotionalWad(doubWei: bigint, doubUsdWad: bigint): bigint {
  return (doubWei * doubUsdWad) / WAD;
}

/**
 * Podium “≈ $… USD” wei for compact display — prefers indexer `doub_usd_wad`, else static 0.98× fallback.
 */
export function podiumPrizeUsdWeiForDisplay(
  prizeDoubWei: bigint,
  doubUsdWad: bigint | undefined,
): bigint | undefined {
  if (prizeDoubWei <= 0n) {
    return undefined;
  }
  if (doubUsdWad !== undefined && doubUsdWad > 0n) {
    return doubWeiToUsdNotionalWad(prizeDoubWei, doubUsdWad);
  }
  return fallbackPayTokenWeiForCl8y(prizeDoubWei, "usdm");
}
