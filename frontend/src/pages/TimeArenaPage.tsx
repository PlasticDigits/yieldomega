// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { ArenaCharmCredCard } from "@/pages/arena/ArenaCharmCredCard";
import { ArenaTimerChips } from "@/pages/arena/ArenaTimerChips";
import { ArenaSimplePage } from "@/pages/arena/ArenaSimplePage";
import { WalletProfileModal } from "@/components/WalletProfileModal";

/** Unified Time Arena surface (#256) — wraps legacy Simple layout with v2 CRED + multi-timer chips. */
export function TimeArenaPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);

  return (
    <>
      <span className="visually-hidden" data-testid="time-arena-page-mounted" />
      <ArenaTimerChips />
      <ArenaCharmCredCard />
      <ArenaSimplePage mountAsArenaV2 />
      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
      {/* Profile modal opened via future AddressInline `onOpenProfile` wiring (#258). */}
    </>
  );
}
