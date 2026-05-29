// SPDX-License-Identifier: AGPL-3.0-only

import { formatCountdown } from "@/pages/timecurve/formatTimer";

export function warbowClaimFlagSilenceRemainingSec(
  ledgerNowSec: number,
  flagSilenceEndSec: bigint,
): number {
  const nowFloor = BigInt(Math.floor(ledgerNowSec));
  if (nowFloor >= flagSilenceEndSec) {
    return 0;
  }
  return Number(flagSilenceEndSec - nowFloor);
}

export function warbowClaimFlagButtonLabel(opts: {
  canClaimWarBowFlag: boolean;
  silenceRemainingSec: number;
}): string {
  if (opts.canClaimWarBowFlag) {
    return "Claim flag";
  }
  return `Claim flag ${formatCountdown(opts.silenceRemainingSec)}`;
}

export function warbowClaimFlagCanPress(opts: {
  isConnected: boolean;
  saleActive: boolean;
  /** Legacy TimeCurve fee-routing flag; prefer {@link arenaPaused} on Arena v2 (#264). */
  buyFeeRoutingEnabled?: boolean | undefined;
  /** When true, operator pause blocks WarBow writes (Arena v2). */
  arenaPaused?: boolean | undefined;
  isWriting: boolean;
  canClaimWarBowFlag: boolean;
}): boolean {
  const writesPaused =
    opts.arenaPaused === true || opts.buyFeeRoutingEnabled === false;
  return (
    opts.isConnected &&
    opts.saleActive &&
    !writesPaused &&
    !opts.isWriting &&
    opts.canClaimWarBowFlag
  );
}

export function deriveWarbowClaimFlagFields(opts: {
  saleActive: boolean;
  walletAddress: string | undefined;
  warbowPendingFlagOwner: string | undefined;
  warbowPendingFlagPlantAt: bigint;
  warbowFlagSilenceSec: bigint;
  phaseLedgerSecInt: number;
}): {
  iHoldPlantFlag: boolean;
  flagSilenceEndSec: bigint;
  canClaimWarBowFlag: boolean;
  showClaimFlagControl: boolean;
} {
  const iHoldPlantFlag = Boolean(
    opts.walletAddress &&
      opts.warbowPendingFlagOwner &&
      opts.walletAddress.toLowerCase() === opts.warbowPendingFlagOwner.toLowerCase(),
  );
  const flagSilenceEndSec = opts.warbowPendingFlagPlantAt + opts.warbowFlagSilenceSec;
  const canClaimWarBowFlag =
    opts.saleActive &&
    iHoldPlantFlag &&
    opts.warbowPendingFlagPlantAt > 0n &&
    BigInt(opts.phaseLedgerSecInt) >= flagSilenceEndSec;
  const showClaimFlagControl =
    opts.saleActive && iHoldPlantFlag && opts.warbowPendingFlagPlantAt > 0n;
  return { iHoldPlantFlag, flagSilenceEndSec, canClaimWarBowFlag, showClaimFlagControl };
}
