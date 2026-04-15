// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchIndexerStatus } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";

export function IndexerStatusBar() {
  const [tone, setTone] = useState<"info" | "warning" | "success">("info");
  const [line, setLine] = useState<string>("Indexer: not configured");

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const base = indexerBaseUrl();
    if (!base) {
      setTone("warning");
      setLine("Indexer: set VITE_INDEXER_URL");
      return;
    }

    const refreshStatus = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      let s: Record<string, unknown> | null = null;
      try {
        s = await fetchIndexerStatus();
      } catch {
        s = null;
      } finally {
        inFlight = false;
      }
      if (cancelled) {
        return;
      }
      if (!s) {
        setTone("warning");
        setLine(`Indexer: unreachable (${base})`);
        return;
      }
      const ver = typeof s.schema_version === "string" ? s.schema_version : "?";
      const blockRaw = s.max_indexed_block;
      const block =
        typeof blockRaw === "number" || typeof blockRaw === "string" ? formatLocaleInteger(blockRaw) : "?";
      setTone("success");
      setLine(`Indexer v${ver} · latest indexed block ${block} · live`);
    };

    void refreshStatus();
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return <p className={`indexer-status indexer-status--${tone}`}>{line}</p>;
}
