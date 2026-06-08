// SPDX-License-Identifier: AGPL-3.0-only

import { indexerBaseUrl } from "@/lib/addresses";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";

export function IndexerStatusBar() {
  const base = indexerBaseUrl();
  const { isOffline, lastOkBanner } = useIndexerConnectivity();

  let tone: "info" | "warning" | "success" | "error";
  let line: string;

  if (!base) {
    tone = "warning";
    line = "INDEXER · dev-only · set VITE_INDEXER_URL for live Arena data";
  } else if (isOffline) {
    tone = "error";
    line = "INDEXER · offline · retrying";
  } else if (lastOkBanner) {
    tone = "success";
    line = `INDEXER · v${lastOkBanner.schemaVersion} · block ${lastOkBanner.maxIndexedBlockDisplay} · live`;
  } else {
    tone = "info";
    line = "INDEXER · connecting…";
  }

  const iconSrc =
    tone === "success"
      ? "/art/icons/status-indexer-ok.png"
      : "/art/icons/status-indexer-bad.png";
  return (
    <p className={`indexer-status indexer-status--${tone}`}>
      <img
        className="indexer-status__icon"
        src={iconSrc}
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
      <span>{line}</span>
    </p>
  );
}
