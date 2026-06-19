// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArenaSimplePage } from "@/pages/arena/ArenaSimplePage";
import { WalletProfileModal } from "@/components/WalletProfileModal";
import { WhileYouWereAwayModal } from "@/components/WhileYouWereAwayModal";
import { useWhileYouWereAway } from "@/hooks/useWhileYouWereAway";
import { useAccount } from "wagmi";

/** Unified Time Arena command console (#291) — one production Arena surface plus wallet profile modal. */
export function TimeArenaPage() {
  const location = useLocation();
  const { address } = useAccount();
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);
  const playFirst = location.pathname === "/";
  const { state: wywaState, dismiss: dismissWywa } = useWhileYouWereAway();

  return (
    <>
      <span className="visually-hidden" data-testid="time-arena-page-mounted" />
      <ArenaSimplePage
        mountAsArenaV2
        playFirst={playFirst}
        onOpenWalletProfile={onOpenWalletProfile}
      />
      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
      {wywaState ? (
        <WhileYouWereAwayModal
          summary={wywaState.summary}
          connectedWallet={address}
          onDismiss={dismissWywa}
        />
      ) : null}
    </>
  );
}
