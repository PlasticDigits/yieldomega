// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState } from "react";
import { ArenaTimerChips } from "@/pages/arena/ArenaTimerChips";
import { ArenaSimplePage } from "@/pages/arena/ArenaSimplePage";
import { ArenaThemeConcepts } from "@/pages/arena/ArenaThemeConcepts";
import { WalletProfileModal } from "@/components/WalletProfileModal";

/** Unified Time Arena surface (#256) — wraps legacy Simple layout with v2 CRED + multi-timer chips. */
export function TimeArenaPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);

  return (
    <>
      <span className="visually-hidden" data-testid="time-arena-page-mounted" />
      <ArenaTimerChips />
      <ArenaThemeConcepts />
      <ArenaSimplePage mountAsArenaV2 onOpenWalletProfile={onOpenWalletProfile} />
      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
    </>
  );
}
