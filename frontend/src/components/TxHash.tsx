// SPDX-License-Identifier: AGPL-3.0-only

import { explorerTxUrl } from "@/lib/explorer";

export function TxHash({ hash }: { hash: string }) {
  const url = explorerTxUrl(hash);
  const short = `${hash.slice(0, 10)}…`;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className="mono cursor-external-link">
        {short}
      </a>
    );
  }
  return <span className="mono">{short}</span>;
}
