// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { useReadContracts } from "wagmi";
import { TxHash } from "@/components/TxHash";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { formatBpsAsPercent, formatLocaleInteger } from "@/lib/formatAmount";
import { feeRouterReadAbi } from "@/lib/abis";
import {
  fetchFeeRouterFeesDistributed,
  fetchFeeRouterSinksUpdates,
  type FeeRouterFeesDistributedItem,
  type FeeRouterSinksUpdateItem,
} from "@/lib/indexerApi";

/** Matches `FeeRouter` sink order: DOUB/CL8Y LP · CL8Y burned · podium · team · Rabbit. */
const FEE_SINK_LABELS = [
  "DOUB/CL8Y LP (locked)",
  "CL8Y burned (sale proceeds)",
  "Podium pool",
  "Team / reserved (0% default)",
  "Rabbit Treasury",
] as const;

export function FeeTransparency() {
  const fr = addresses.feeRouter;
  const [sinksHistory, setSinksHistory] = useState<FeeRouterSinksUpdateItem[] | null>(null);
  const [feesDistributed, setFeesDistributed] = useState<FeeRouterFeesDistributedItem[] | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);

  const { data, isPending, isError } = useReadContracts({
    contracts: fr
      ? ([0, 1, 2, 3, 4] as const).map((i) => ({
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
      <StatusMessage variant="muted">
        Fee router: set <code>VITE_FEE_ROUTER_ADDRESS</code> to show sink destinations.
      </StatusMessage>
    );
  }

  if (isPending) {
    return <StatusMessage variant="loading">Loading fee router...</StatusMessage>;
  }
  if (isError || !data) {
    return <StatusMessage variant="error">Could not read fee router.</StatusMessage>;
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
              <strong>{FEE_SINK_LABELS[i] ?? `Sink ${i}`}</strong>: {formatBpsAsPercent(bps)} →{" "}
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
                block {formatLocaleInteger(row.block_number)} — actor{" "}
                <span className="mono">{row.actor.slice(0, 10)}…</span> —{" "}
                new routing {formatSinksJsonForDisplay(row.new_sinks_json)} — tx{" "}
                <TxHash hash={row.tx_hash} />
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
            {/* `amount` is uint256 from indexer; format as 18 dp — matches dominant WAD/ERC-20 paths; adjust if API adds per-token decimals. */}
            {feesDistributed.map((row) => (
              <li key={`${row.tx_hash}-${row.log_index}`}>
                block {formatLocaleInteger(row.block_number)} — token{" "}
                <span className="mono">{row.token.slice(0, 10)}…</span> — amount{" "}
                <span className="mono">
                  {formatCompactFromRaw(rawToBigIntForFormat(row.amount), 18)}
                </span>{" "}
                — per sink {formatFeeSharesJsonForDisplay(row.shares_json)} — tx{" "}
                <TxHash hash={row.tx_hash} />
              </li>
            ))}
          </ul>
        </>
      )}
      {historyNote && <StatusMessage variant="muted">{historyNote}</StatusMessage>}
      {!indexerBaseUrl() && (
        <StatusMessage variant="muted">
          Set <code>VITE_INDEXER_URL</code> for historical sink updates.
        </StatusMessage>
      )}
    </div>
  );
}

function formatSinksJsonForDisplay(json: string): string {
  try {
    const p = JSON.parse(json) as { weights?: unknown };
    const w = p.weights;
    if (!Array.isArray(w)) {
      return "—";
    }
    const parts: string[] = [];
    for (let i = 0; i < w.length; i++) {
      const bps = Number(w[i]);
      if (!Number.isFinite(bps)) {
        continue;
      }
      const label = FEE_SINK_LABELS[i] ?? `Sink ${i}`;
      parts.push(`${label} ${formatBpsAsPercent(bps)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  } catch {
    return "—";
  }
}

/** `shares` from indexer are per-sink token amounts (wei); 18 dp assumed (see amount row). */
function formatFeeSharesJsonForDisplay(json: string): string {
  try {
    const p = JSON.parse(json) as { shares?: unknown };
    const s = p.shares;
    if (!Array.isArray(s)) {
      return "—";
    }
    const parts: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const label = FEE_SINK_LABELS[i] ?? `Sink ${i}`;
      const amt = formatCompactFromRaw(rawToBigIntForFormat(String(s[i])), 18);
      parts.push(`${label} ${amt}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  } catch {
    return "—";
  }
}
