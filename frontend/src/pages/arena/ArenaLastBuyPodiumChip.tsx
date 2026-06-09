// SPDX-License-Identifier: AGPL-3.0-only

import type { BuyItem } from "@/lib/indexerApi";
import { ArenaPodiumTimerChip } from "@/pages/arena/ArenaPodiumTimerChip";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";

type Props = {
  address?: string;
  decimals: number;
  podiumRow: PodiumReadRow | undefined;
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly BuyItem[] | null;
  activeDefendedStreak?: bigint;
  podiumNowUnixSec?: number;
  onOpenWalletProfile?: (address: string) => void;
};

/** Last Buy leaders beside the primary timer bay — same compact rows as the side-rail chips. */
export function ArenaLastBuyPodiumChip({
  address,
  decimals,
  podiumRow,
  podiumPayoutPreview,
  recentBuys = null,
  activeDefendedStreak,
  podiumNowUnixSec,
  onOpenWalletProfile,
}: Props) {
  return (
    <div
      className="arena-timer-chips arena-simple__last-buy-chip"
      data-testid="arena-last-buy-chip"
      aria-label="Last Buy leaders"
    >
      <ArenaPodiumTimerChip
        podiumName="Last Buy"
        contractIndex={0}
        categoryIndex={0}
        address={address}
        decimals={decimals}
        podiumRow={podiumRow}
        podiumPayoutPreview={podiumPayoutPreview}
        recentBuys={recentBuys}
        activeDefendedStreak={activeDefendedStreak}
        podiumNowUnixSec={podiumNowUnixSec}
        onOpenWalletProfile={onOpenWalletProfile}
        showCountdown={false}
      />
    </div>
  );
}
