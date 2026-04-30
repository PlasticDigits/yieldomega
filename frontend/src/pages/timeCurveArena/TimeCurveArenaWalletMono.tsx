// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from "react";
import { AddressInline } from "@/components/AddressInline";
import type { WalletFormatShort } from "@/lib/addressFormat";

export function TimeCurveArenaWalletMono(props: {
  addr: string | undefined;
  formatWallet: WalletFormatShort;
}): ReactElement {
  const { addr, formatWallet } = props;
  return (
    <AddressInline address={addr} formatWallet={formatWallet} fallback="—" size={18} />
  );
}
