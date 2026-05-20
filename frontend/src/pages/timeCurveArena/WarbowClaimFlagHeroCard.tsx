// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { warbowClaimFlagHelperLines } from "@/lib/warbowClaimFlagCopy";
import { formatCountdown } from "@/pages/timecurve/formatTimer";

type Props = {
  /** Viewer holds `warbowPendingFlagOwner` and `warbowPendingFlagPlantAt > 0`. */
  visible: boolean;
  canClaimWarBowFlag: boolean;
  /** Interpolated ledger "now" (sec) — same basis as Arena `effectiveLedgerSec`. */
  ledgerNowSec: number;
  flagSilenceEndSec: bigint;
  warbowFlagClaimBp: bigint;
  saleActive: boolean;
  buyFeeRoutingEnabled: boolean | undefined;
  isConnected: boolean;
  isWriting: boolean;
  runWarBowClaimFlag: () => Promise<void>;
};

export function WarbowClaimFlagHeroCard({
  visible,
  canClaimWarBowFlag,
  ledgerNowSec,
  flagSilenceEndSec,
  warbowFlagClaimBp,
  saleActive,
  buyFeeRoutingEnabled,
  isConnected,
  isWriting,
  runWarBowClaimFlag,
}: Props) {
  const writesPaused = buyFeeRoutingEnabled === false;
  const canPressClaim =
    isConnected && saleActive && !writesPaused && !isWriting && canClaimWarBowFlag;

  const silenceRemainingSec = useMemo(() => {
    const nowFloor = BigInt(Math.floor(ledgerNowSec));
    if (nowFloor >= flagSilenceEndSec) {
      return 0;
    }
    return Number(flagSilenceEndSec - nowFloor);
  }, [ledgerNowSec, flagSilenceEndSec]);

  const claimButtonLabel = useMemo(() => {
    if (canClaimWarBowFlag) {
      return "Claim flag";
    }
    return `Claim flag ${formatCountdown(silenceRemainingSec)}`;
  }, [canClaimWarBowFlag, silenceRemainingSec]);

  const helperLines = useMemo(
    () => warbowClaimFlagHelperLines({ claimBp: warbowFlagClaimBp }),
    [warbowFlagClaimBp],
  );

  if (!visible) {
    return null;
  }

  return (
    <article
      className="warbow-hero-card warbow-hero-card--claim-flag"
      aria-label="Claim WarBow flag"
      data-testid="warbow-hero-claim-flag"
    >
      <div className="warbow-hero-card__head">
        <h3>Claim flag</h3>
      </div>
      <p className="muted">
        You planted the WarBow flag. Wait out the silence window, then claim to bank{" "}
        {formatLocaleInteger(warbowFlagClaimBp)} Battle Points.
      </p>
      <button
        type="button"
        className="btn-secondary btn-secondary--priority warbow-hero-card__claim-flag-cta"
        disabled={!canPressClaim}
        onClick={() => void runWarBowClaimFlag()}
        aria-live={canClaimWarBowFlag ? undefined : "polite"}
        data-testid="warbow-hero-claim-flag-submit"
      >
        <span className="warbow-hero-card__claim-flag-cta-label">{claimButtonLabel}</span>
      </button>
      <div className="warbow-hero-card__claim-flag-help" data-testid="warbow-hero-claim-flag-help">
        <p>{helperLines.rewardLine}</p>
        <p>{helperLines.penaltyLine}</p>
        <p className="muted">{helperLines.earlyInterruptLine}</p>
      </div>
    </article>
  );
}
