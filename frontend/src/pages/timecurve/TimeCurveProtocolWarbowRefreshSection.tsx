// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useReadContracts, useWriteContract } from "wagmi";
import { getAddress, type Hex } from "viem";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { timeCurveReadAbi, timeCurveWriteAbi } from "@/lib/abis";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import type { HexAddress } from "@/lib/addresses";
import { fetchTimecurveWarbowRefreshCandidates } from "@/lib/indexerApi";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { warBowRefreshCandidateAddresses } from "@/lib/timeCurveWarbowSnapshotClaim";
import { wagmiConfig } from "@/wagmi-config";
import { waitForTransactionReceipt } from "wagmi/actions";

function checksumCandidates(lowerOrMixed: readonly string[]): Hex[] {
  const out: Hex[] = [];
  const seen = new Set<string>();
  for (const raw of lowerOrMixed) {
    const t = raw.trim();
    if (!t.startsWith("0x") || t.length !== 42) {
      continue;
    }
    try {
      const cs = getAddress(t as HexAddress);
      const k = cs.toLowerCase();
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      out.push(cs);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

type Props = {
  timeCurve: HexAddress;
  /** From live `ended()` read — refresh is onchain-forbidden after sale end (#149). */
  saleEnded: boolean;
  refetchParentReads: () => unknown;
};

export function TimeCurveProtocolWarbowRefreshSection({
  timeCurve,
  saleEnded,
  refetchParentReads,
}: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [loadedCandidates, setLoadedCandidates] = useState<Hex[]>([]);
  const [idxExtras, setIdxExtras] = useState<{
    apiTotal: number;
    podium_warbow_hint_count: number;
    distinct_sql_cap_hit: boolean;
  } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(false);

  const wbReads = useReadContracts({
    contracts: [
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "warbowLadderPodium",
      },
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "warbowPodiumFinalized",
      },
    ],
    query: { enabled: Boolean(timeCurve) },
  });

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  useEffect(() => {
    if (!chainMismatchWriteMessage(chainId)) {
      setTxErr(null);
    }
  }, [chainId]);

  const refetchWarbowReads = useCallback(() => wbReads.refetch(), [wbReads]);

  const loadFromIndexer = async () => {
    setLoadErr(null);
    setLoadingIdx(true);
    try {
      const pages: string[] = [];
      let off = 0;
      let guard = 0;
      let apiTotal = 0;
      let podiumHintCount = 0;
      let capHit = false;
      while (guard < 50) {
        guard += 1;
        const chunk = await fetchTimecurveWarbowRefreshCandidates(500, off);
        if (!chunk) {
          setLoadErr(
            "Indexer returned nothing — check VITE_INDEXER_URL and that the stack exposes GET /v1/timecurve/warbow/refresh-candidates (schema ≥ 1.15.0).",
          );
          setLoadedCandidates([]);
          setIdxExtras(null);
          return;
        }
        if (off === 0) {
          apiTotal = chunk.total;
          podiumHintCount = chunk.podium_warbow_hint_count;
        }
        capHit = capHit || chunk.distinct_sql_cap_hit;
        for (const c of chunk.candidates) {
          pages.push(c);
        }
        if (chunk.next_offset === null || chunk.next_offset === undefined) {
          break;
        }
        off = chunk.next_offset;
      }
      const checksumPage = checksumCandidates(pages);
      setLoadedCandidates(checksumPage);
      setIdxExtras({
        apiTotal,
        podium_warbow_hint_count: podiumHintCount,
        distinct_sql_cap_hit: capHit,
      });
    } finally {
      setLoadingIdx(false);
    }
  };

  const runRefresh = async () => {
    setTxErr(null);
    if (saleEnded) {
      setTxErr("Sale has ended — `refreshWarbowPodium` reverts onchain (GitLab #149). Use owner `finalizeWarbowPodium` after `endSale`.");
      return;
    }
    if (chainMismatchWriteMessage(chainId)) {
      setTxErr(chainMismatchWriteMessage(chainId) ?? "Wrong network for writes.");
      return;
    }
    if (!address) {
      setTxErr("Connect a wallet to submit the refresh transaction.");
      return;
    }
    const pr = wbReads.data;
    if (!pr || pr[0]?.status !== "success" || pr[0].result === undefined) {
      setTxErr("WarBow ladder snapshot is not loaded yet.");
      return;
    }
    if (loadedCandidates.length === 0) {
      setTxErr("Load candidates from the indexer first.");
      return;
    }
    const [podiumWallets] = pr[0].result as readonly [readonly `0x${string}`[], readonly bigint[]];
    const calldata = warBowRefreshCandidateAddresses({
      viewer: address as `0x${string}`,
      podiumWallets: [...loadedCandidates, ...podiumWallets],
    });
    try {
      const hash = await writeContractAsync({
        address: timeCurve,
        abi: timeCurveWriteAbi,
        functionName: "refreshWarbowPodium",
        args: [calldata],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      void refetchParentReads();
      void refetchWarbowReads();
    } catch (e) {
      setTxErr(friendlyRevertFromUnknown(e));
    }
  };

  const warbowPodiumFinalized =
    wbReads.data?.[1]?.status === "success" ? (wbReads.data[1]!.result as boolean) : undefined;

  return (
    <div className="timecurve-protocol-warbow-refresh" data-testid="timecurve-protocol-warbow-refresh">
      <p className="text-muted" style={{ marginTop: 0 }}>
        While the sale is live, anyone may repair a stale WarBow ladder snapshot with{" "}
        <span className="mono">refreshWarbowPodium</span> (GitLab #129). This panel loads a deduped
        candidate superset from the indexer, merges your connected wallet and the onchain{" "}
        <span className="mono">warbowLadderPodium</span> row, then submits the transaction. After{" "}
        <span className="mono">endSale</span>, this path reverts — use owner{" "}
        <span className="mono">finalizeWarbowPodium</span> instead (#149 / #160).
      </p>
      <dl className="kv" style={{ marginBottom: "1rem" }}>
        <dt>warbowPodiumFinalized (read)</dt>
        <dd>{warbowPodiumFinalized === undefined ? "—" : String(warbowPodiumFinalized)}</dd>
        <dt>Indexer candidates loaded (checksummed)</dt>
        <dd>{loadedCandidates.length ? String(loadedCandidates.length) : "—"}</dd>
        {idxExtras && (
          <>
            <dt>Indexer merged total (API)</dt>
            <dd>{String(idxExtras.apiTotal)}</dd>
            <dt>Head WarBow hints merged</dt>
            <dd>{String(idxExtras.podium_warbow_hint_count)}</dd>
            <dt>SQL DISTINCT cap hit</dt>
            <dd>{String(idxExtras.distinct_sql_cap_hit)}</dd>
          </>
        )}
      </dl>
      {saleEnded && (
        <StatusMessage variant="placeholder">
          Sale ended — permissionless refresh is disabled onchain. Operators finalize WarBow for prize
          distribution via <span className="mono">finalizeWarbowPodium</span>.
        </StatusMessage>
      )}
      {loadErr && <StatusMessage variant="error">{loadErr}</StatusMessage>}
      {txErr && <StatusMessage variant="error">{txErr}</StatusMessage>}
      <ChainMismatchWriteBarrier testId="timecurve-protocol-warbow-refresh-chain-gate">
        <div className="cluster-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="yo-btn-secondary" disabled={loadingIdx} onClick={() => void loadFromIndexer()}>
            {loadingIdx ? "Loading…" : "Load candidates from indexer"}
          </button>
          <button
            type="button"
            className="yo-btn"
            disabled={saleEnded || isWriting || loadedCandidates.length === 0}
            onClick={() => void runRefresh()}
          >
            {isWriting ? "Submitting…" : "Refresh WarBow podium"}
          </button>
        </div>
      </ChainMismatchWriteBarrier>
    </div>
  );
}
