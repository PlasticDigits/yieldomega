// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useReadContracts, useWriteContract } from "wagmi";
import { getAddress, isAddress, type Hex, zeroAddress } from "viem";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { timeCurveReadAbi, timeCurveWriteAbi } from "@/lib/abis";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import type { HexAddress } from "@/lib/addresses";
import { fetchTimecurveWarbowRefreshCandidates } from "@/lib/indexerApi";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
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

function parseSlot(s: string): `0x${string}` {
  const t = s.trim();
  if (!t) {
    return zeroAddress;
  }
  if (!isAddress(t)) {
    throw new Error("Invalid address");
  }
  return getAddress(t as HexAddress);
}

type Props = {
  timeCurve: HexAddress;
  /** From live `ended()` read — finalize is post-sale only. */
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
  } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(false);
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");

  const wbReads = useReadContracts({
    contracts: [
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "warbowPodiumFinalized",
      },
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "ended",
      },
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "prizesDistributed",
      },
      {
        address: timeCurve,
        abi: timeCurveReadAbi,
        functionName: "owner",
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
      while (guard < 50) {
        guard += 1;
        const chunk = await fetchTimecurveWarbowRefreshCandidates(500, off);
        if (!chunk) {
          setLoadErr(
            "Indexer returned nothing — check VITE_INDEXER_URL and that the stack exposes GET /v1/timecurve/warbow/refresh-candidates (schema ≥ 1.18.0).",
          );
          setLoadedCandidates([]);
          setIdxExtras(null);
          return;
        }
        if (off === 0) {
          apiTotal = chunk.total;
          podiumHintCount = chunk.podium_warbow_hint_count;
        }
        if (Array.isArray(chunk.candidates)) {
          for (const c of chunk.candidates) {
            pages.push(c);
          }
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
      });
    } catch (e) {
      setLoadErr(friendlyRevertFromUnknown(e));
      setLoadedCandidates([]);
      setIdxExtras(null);
    } finally {
      setLoadingIdx(false);
    }
  };

  const runFinalize = async () => {
    setTxErr(null);
    const cm = chainMismatchWriteMessage(chainId);
    if (cm) {
      setTxErr(cm);
      return;
    }
    if (!address) {
      setTxErr("Connect the owner wallet to finalize.");
      return;
    }
    if (!saleEnded) {
      setTxErr("Sale must be ended before `finalizeWarbowPodium` is allowed onchain.");
      return;
    }
    let first: `0x${string}`;
    let second: `0x${string}`;
    let third: `0x${string}`;
    try {
      first = parseSlot(slot1);
      second = parseSlot(slot2);
      third = parseSlot(slot3);
    } catch {
      setTxErr("Enter valid 0x addresses (or leave trailing slots blank for zero address).");
      return;
    }
    try {
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: timeCurve,
        abi: timeCurveWriteAbi,
        functionName: "finalizeWarbowPodium",
        args: [first, second, third],
        onEstimateRevert: "rethrow",
        softCapGas: 800_000n,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      void refetchParentReads();
      void refetchWarbowReads();
    } catch (e) {
      setTxErr(friendlyRevertFromUnknown(e));
    }
  };

  const warbowPodiumFinalized =
    wbReads.data?.[0]?.status === "success" ? (wbReads.data[0]!.result as boolean) : undefined;
  const onchainEnded = wbReads.data?.[1]?.status === "success" ? (wbReads.data[1]!.result as boolean) : undefined;
  const prizesDistributed =
    wbReads.data?.[2]?.status === "success" ? (wbReads.data[2]!.result as boolean) : undefined;
  const tcOwner =
    wbReads.data?.[3]?.status === "success" ? (wbReads.data[3]!.result as `0x${string}`) : undefined;
  const isOwner =
    address && tcOwner && address.toLowerCase() === tcOwner.toLowerCase();

  return (
    <div className="timecurve-protocol-warbow-refresh" data-testid="timecurve-protocol-warbow-refresh">
      <p className="text-muted" style={{ marginTop: 0 }}>
        WarBow ladder payouts are no longer maintained automatically onchain. After{" "}
        <span className="mono">endSale</span>, the owner calls{" "}
        <span className="mono">finalizeWarbowPodium(first, second, third)</span> with live{" "}
        <span className="mono">battlePoints</span> strictly decreasing along occupied ranks (GitLab #172). Use the
        indexer list below as a reference set while choosing governance ordering.
      </p>
      <dl className="kv" style={{ marginBottom: "1rem" }}>
        <dt>warbowPodiumFinalized (read)</dt>
        <dd>{warbowPodiumFinalized === undefined ? "—" : String(warbowPodiumFinalized)}</dd>
        <dt>ended / prizesDistributed</dt>
        <dd>
          {onchainEnded === undefined || prizesDistributed === undefined
            ? "—"
            : `${String(onchainEnded)} / ${String(prizesDistributed)}`}
        </dd>
        <dt>Indexer candidates loaded (checksummed)</dt>
        <dd>{loadedCandidates.length ? String(loadedCandidates.length) : "—"}</dd>
        {idxExtras && (
          <>
            <dt>Indexer merged total (API)</dt>
            <dd>{String(idxExtras.apiTotal)}</dd>
            <dt>Head WarBow hints merged</dt>
            <dd>{String(idxExtras.podium_warbow_hint_count)}</dd>
          </>
        )}
      </dl>
      {!isOwner && address && tcOwner && (
        <StatusMessage variant="muted">
          Connected wallet is not <span className="mono">TimeCurve.owner()</span> — finalize requires the owner.
        </StatusMessage>
      )}
      {loadErr && <StatusMessage variant="error">{loadErr}</StatusMessage>}
      {txErr && <StatusMessage variant="error">{txErr}</StatusMessage>}
      <ChainMismatchWriteBarrier testId="timecurve-protocol-warbow-refresh-chain-gate">
        <div className="cluster-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="yo-btn-secondary" disabled={loadingIdx} onClick={() => void loadFromIndexer()}>
            {loadingIdx ? "Loading…" : "Load reference candidates from indexer"}
          </button>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <h4 className="text-muted" style={{ marginTop: 0 }}>
            Owner finalize (post-sale)
          </h4>
          <div className="cluster-col" style={{ gap: "0.5rem", maxWidth: "42rem" }}>
            <label className="text-muted">
              First (highest BP)
              <input
                className="yo-input"
                style={{ width: "100%", marginTop: "0.25rem" }}
                value={slot1}
                onChange={(e) => setSlot1(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
              />
            </label>
            <label className="text-muted">
              Second
              <input
                className="yo-input"
                style={{ width: "100%", marginTop: "0.25rem" }}
                value={slot2}
                onChange={(e) => setSlot2(e.target.value)}
                placeholder="0x… or blank"
                spellCheck={false}
              />
            </label>
            <label className="text-muted">
              Third
              <input
                className="yo-input"
                style={{ width: "100%", marginTop: "0.25rem" }}
                value={slot3}
                onChange={(e) => setSlot3(e.target.value)}
                placeholder="0x… or blank"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="yo-btn"
              disabled={
                !saleEnded || !isOwner || isWriting || prizesDistributed === true || onchainEnded === false
              }
              onClick={() => void runFinalize()}
            >
              {isWriting ? "Submitting…" : "Submit finalizeWarbowPodium"}
            </button>
          </div>
        </div>
      </ChainMismatchWriteBarrier>
    </div>
  );
}
