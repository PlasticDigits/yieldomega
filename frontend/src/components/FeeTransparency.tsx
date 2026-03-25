// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import { TxHash } from "@/components/TxHash";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { feeRouterReadAbi } from "@/lib/abis";
import {
  fetchFeeRouterFeesDistributed,
  fetchFeeRouterSinksUpdates,
  type FeeRouterFeesDistributedItem,
  type FeeRouterSinksUpdateItem,
} from "@/lib/indexerApi";

const LABELS = ["DOUB LP", "Rabbit Treasury", "Prizes", "CL8Y buy-and-burn"];

export function FeeTransparency() {
  const fr = addresses.feeRouter;
  const [sinksHistory, setSinksHistory] = useState<FeeRouterSinksUpdateItem[] | null>(null);
  const [feesDistributed, setFeesDistributed] = useState<FeeRouterFeesDistributedItem[] | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);

  const { data, isPending, isError } = useReadContracts({
    contracts: fr
      ? ([0, 1, 2, 3] as const).map((i) => ({
          address: fr,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)],
        }))
      : [],
    query: { enabled: Boolean(fr) },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!indexerBaseUrl()) {
        setHistoryNote(null);
        setSinksHistory(null);
        setFeesDistributed(null);
        return;
      }
      const [res, fd] = await Promise.all([
        fetchFeeRouterSinksUpdates(8, 0),
        fetchFeeRouterFeesDistributed(8, 0),
      ]);
      if (cancelled) {
        return;
      }
      if (!res) {
        setHistoryNote("Indexer unreachable for history.");
        setSinksHistory([]);
        setFeesDistributed(fd?.items ?? []);
        return;
      }
      setHistoryNote(null);
      setSinksHistory(res.items);
      setFeesDistributed(fd?.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fr) {
    return (
      <p className="muted">
        Fee router: set <code>VITE_FEE_ROUTER_ADDRESS</code> to show sink destinations.
      </p>
    );
  }

  if (isPending) {
    return <p className="muted">Loading fee router…</p>;
  }
  if (isError || !data) {
    return <p className="muted">Could not read fee router.</p>;
  }

  return (
    <div className="fee-transparency">
      <p className="muted">
        <strong>Current onchain sinks</strong> (canonical for balances and routing)
      </p>
      <ul className="fee-sink-list">
        {data.map((row, i) => {
          if (row.status !== "success" || row.result === undefined) {
            return null;
          }
          const [dest, bps] = row.result as readonly [`0x${string}`, number];
          return (
            <li key={i}>
              <strong>{LABELS[i] ?? `Sink ${i}`}</strong>: {bps} bps →{" "}
              <span className="mono">{dest}</span>
            </li>
          );
        })}
      </ul>
      {sinksHistory && sinksHistory.length > 0 && (
        <>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            <strong>Recent SinksUpdated events</strong> (indexer mirror)
          </p>
          <ul className="fee-sink-list fee-sink-list--compact">
            {sinksHistory.map((row) => (
              <li key={`${row.tx_hash}-${row.log_index}`}>
                block {row.block_number} — actor <span className="mono">{row.actor.slice(0, 10)}…</span> —{" "}
                new weights {summarizeSinksJson(row.new_sinks_json)} — tx <TxHash hash={row.tx_hash} />
              </li>
            ))}
          </ul>
        </>
      )}
      {feesDistributed && feesDistributed.length > 0 && (
        <>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            <strong>Recent fee distributions</strong> (indexer mirror)
          </p>
          <ul className="fee-sink-list fee-sink-list--compact">
            {feesDistributed.map((row) => (
              <li key={`${row.tx_hash}-${row.log_index}`}>
                block {row.block_number} — token <span className="mono">{row.token.slice(0, 10)}…</span> —{" "}
                amount {row.amount} — {summarizeSharesJson(row.shares_json)} — tx <TxHash hash={row.tx_hash} />
              </li>
            ))}
          </ul>
        </>
      )}
      {historyNote && <p className="muted">{historyNote}</p>}
      {!indexerBaseUrl() && (
        <p className="muted">Set <code>VITE_INDEXER_URL</code> for historical sink updates.</p>
      )}
    </div>
  );
}

function summarizeSinksJson(json: string): string {
  try {
    const p = JSON.parse(json) as { weights?: number[] };
    if (Array.isArray(p.weights)) {
      return p.weights.join(", ");
    }
  } catch {
    /* ignore */
  }
  return json.length > 40 ? `${json.slice(0, 40)}…` : json;
}

function summarizeSharesJson(json: string): string {
  return json.length > 48 ? `${json.slice(0, 48)}…` : json;
}
