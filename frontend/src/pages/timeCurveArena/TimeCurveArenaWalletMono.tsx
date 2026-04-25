// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from "react";
import type { WalletFormatShort } from "@/lib/addressFormat";

export function TimeCurveArenaWalletMono(props: {
  addr: string | undefined;
  formatWallet: WalletFormatShort;
}): ReactElement {
  const { addr, formatWallet } = props;
  if (!addr) {
    return <span className="mono">—</span>;
  }
  return (
    <span className="mono" title={addr}>
      {formatWallet(addr, "—")}
    </span>
  );
}
