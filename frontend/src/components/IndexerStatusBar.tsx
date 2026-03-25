// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchIndexerStatus } from "@/lib/indexerApi";

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
      const block =
        typeof s.max_indexed_block === "number" || typeof s.max_indexed_block === "string"
          ? String(s.max_indexed_block)
          : "?";
      setLine(`Indexer v${ver} · max block ${block}`);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="indexer-status">{line}</p>;
}
