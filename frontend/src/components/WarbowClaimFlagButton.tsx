// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import {
  warbowClaimFlagButtonLabel,
  warbowClaimFlagCanPress,
  warbowClaimFlagSilenceRemainingSec,
} from "@/lib/warbowClaimFlagState";

type Props = {
  canClaimWarBowFlag: boolean;
  /** Interpolated ledger "now" (sec) for countdown display. */
  ledgerNowSec: number;
  flagSilenceEndSec: bigint;
  saleActive: boolean;
  arenaPaused?: boolean | undefined;
  isConnected: boolean;
  isWriting: boolean;
  onClaim: () => void | Promise<void>;
  className?: string;
  testId?: string;
};

export function WarbowClaimFlagButton({
  canClaimWarBowFlag,
  ledgerNowSec,
  flagSilenceEndSec,
  saleActive,
  arenaPaused,
  isConnected,
  isWriting,
  onClaim,
  className = "btn-secondary btn-secondary--priority warbow-hero-card__claim-flag-cta",
  testId = "warbow-claim-flag-submit",
}: Props) {
  const silenceRemainingSec = useMemo(
    () => warbowClaimFlagSilenceRemainingSec(ledgerNowSec, flagSilenceEndSec),
    [ledgerNowSec, flagSilenceEndSec],
  );

  const label = useMemo(
    () => warbowClaimFlagButtonLabel({ canClaimWarBowFlag, silenceRemainingSec }),
    [canClaimWarBowFlag, silenceRemainingSec],
  );

  const disabled = !warbowClaimFlagCanPress({
    isConnected,
    saleActive,
    arenaPaused,
    isWriting,
    canClaimWarBowFlag,
  });

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => void onClaim()}
      aria-live={canClaimWarBowFlag ? undefined : "polite"}
      data-testid={testId}
    >
      <span className="warbow-hero-card__claim-flag-cta-label">{label}</span>
    </button>
  );
}
