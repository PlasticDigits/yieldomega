// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchIndexerStatus } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";

export function IndexerStatusBar() {
  const [line, setLine] = useState<string>("Indexer: not configured");

  useEffect(() => {
    let cancelled = false;
    const base = indexerBaseUrl();
    if (!base) {
      setLine("Indexer: set VITE_INDEXER_URL");
      return;
    }
    void (async () => {
      const s = await fetchIndexerStatus();
      if (cancelled) {
        return;
      }
      if (!s) {
        setLine(`Indexer: unreachable (${base})`);
        return;
      }
      const ver = typeof s.schema_version === "string" ? s.schema_version : "?";
      const blockRaw = s.max_indexed_block;
      const block =
        typeof blockRaw === "number" || typeof blockRaw === "string" ? formatLocaleInteger(blockRaw) : "?";
      setLine(`Indexer v${ver} · max block ${block}`);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="indexer-status">{line}</p>;
}
