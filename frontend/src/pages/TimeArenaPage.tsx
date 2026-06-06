// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState } from "react";
import { ArenaSimplePage } from "@/pages/arena/ArenaSimplePage";
import { WalletProfileModal } from "@/components/WalletProfileModal";

/** Unified Time Arena command console (#291) — one production Arena surface plus wallet profile modal. */
export function TimeArenaPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);

  return (
    <>
      <span className="visually-hidden" data-testid="time-arena-page-mounted" />
      <ArenaSimplePage mountAsArenaV2 onOpenWalletProfile={onOpenWalletProfile} />
      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
    </>
  );
}
