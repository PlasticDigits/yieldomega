// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { getAddress, isAddress, type Hex, zeroAddress } from "viem";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { MegaScannerAddressLink } from "@/components/MegaScannerAddressLink";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { timeCurveWriteAbi } from "@/lib/abis";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import type { HexAddress } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { fetchTimecurveWarbowLeaderboard, fetchTimecurveWarbowRefreshCandidates } from "@/lib/indexerApi";
import {
  parseWarbowLeaderboardTop,
  warbowFinalizeSlotsFromLeaderboard,
  WARBOW_PROTOCOL_TOP_DISPLAY,
  type WarbowLeaderboardRankedRow,
} from "@/lib/warbowLeaderboardFinalizeAutofill";
import {
  WARBOW_REFRESH_CANDIDATES_MAX_PAGES,
  WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT,
  accumulateWarbowRefreshCandidatePages,
} from "@/lib/warbowRefreshCandidatesPagination";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { PROTOCOL_READING_INDICES, useTimeCurveProtocolData } from "@/pages/timecurve/TimeCurveProtocolDataContext";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import { wagmiConfig } from "@/wagmi-config";

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
  const [topByBp, setTopByBp] = useState<WarbowLeaderboardRankedRow[]>([]);
  const [idxExtras, setIdxExtras] = useState<{
    apiTotal: number;
    podium_warbow_hint_count: number;
  } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(false);
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");

  const { protocolReading } = useTimeCurveProtocolData();

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  useEffect(() => {
    if (!chainMismatchWriteMessage(chainId)) {
      setTxErr(null);
    }
  }, [chainId]);

  const loadFromIndexer = async () => {
    setLoadErr(null);
    setLoadWarning(null);
    setTopByBp([]);
    setLoadingIdx(true);
    try {
      const [acc, lbPage] = await Promise.all([
        accumulateWarbowRefreshCandidatePages(fetchTimecurveWarbowRefreshCandidates),
        fetchTimecurveWarbowLeaderboard(WARBOW_PROTOCOL_TOP_DISPLAY, 0),
      ]);
      if (!acc.ok) {
        setLoadErr(
          "Indexer returned nothing — check VITE_INDEXER_URL and that the stack exposes GET /v1/timecurve/warbow/refresh-candidates (schema ≥ 1.18.0).",
        );
        setLoadedCandidates([]);
        setIdxExtras(null);
        return;
      }
      const warnings: string[] = [];
      if (acc.truncatedByGuard) {
        warnings.push(
          `Reference wallet list was truncated at the UI paging ceiling (${WARBOW_REFRESH_CANDIDATES_MAX_PAGES} pages × ${WARBOW_REFRESH_CANDIDATES_PAGE_LIMIT} rows per request). More candidates may exist on the indexer — continue with GET /v1/timecurve/warbow/refresh-candidates using higher offsets, or raise the client page limit in code before relying on this set for finalizeWarbowPodium. https://gitlab.com/PlasticDigits/yieldomega/-/issues/174`,
        );
      }
      if (!lbPage) {
        warnings.push(
          "Could not load WarBow leaderboard for BP ordering — check GET /v1/timecurve/warbow/leaderboard.",
        );
      }
      setLoadWarning(warnings.length ? warnings.join(" ") : null);

      const checksumPage = checksumCandidates(acc.pages);
      setLoadedCandidates(checksumPage);
      setIdxExtras({
        apiTotal: acc.apiTotal,
        podium_warbow_hint_count: acc.podiumWarbowHintCount,
      });

      const ranked = lbPage ? parseWarbowLeaderboardTop(lbPage.items) : [];
      setTopByBp(ranked);
      const [first, second, third] = warbowFinalizeSlotsFromLeaderboard(ranked);
      setSlot1(first);
      setSlot2(second);
      setSlot3(third);
    } catch (e) {
      setLoadErr(friendlyRevertFromUnknown(e));
      setLoadedCandidates([]);
      setIdxExtras(null);
      setTopByBp([]);
      setLoadWarning(null);
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
      await waitForWriteReceipt(wagmiConfig, { hash });
      void refetchParentReads();
    } catch (e) {
      setTxErr(friendlyRevertFromUnknown(e));
    }
  };

  const IX = PROTOCOL_READING_INDICES;
  const warbowPodiumFinalizedRow = protocolReading[IX.warbowPodiumFinalized];
  const endedRow = protocolReading[2];
  const prizesDistributedRow = protocolReading[21];
  const ownerRow = protocolReading[IX.owner];

  const warbowPodiumFinalized =
    warbowPodiumFinalizedRow?.status === "success"
      ? (warbowPodiumFinalizedRow.result as boolean)
      : undefined;
  const onchainEnded =
    endedRow?.status === "success" ? (endedRow.result as boolean) : undefined;
  const prizesDistributed =
    prizesDistributedRow?.status === "success" ? (prizesDistributedRow.result as boolean) : undefined;
  const tcOwner =
    ownerRow?.status === "success" ? (ownerRow.result as `0x${string}`) : undefined;
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
      {loadWarning && <StatusMessage variant="warning">{loadWarning}</StatusMessage>}
      {loadErr && <StatusMessage variant="error">{loadErr}</StatusMessage>}
      {txErr && <StatusMessage variant="error">{txErr}</StatusMessage>}
      <ChainMismatchWriteBarrier testId="timecurve-protocol-warbow-refresh-chain-gate">
        <div className="cluster-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="yo-btn-secondary" disabled={loadingIdx} onClick={() => void loadFromIndexer()}>
            {loadingIdx ? "Loading…" : "Load reference candidates"}
          </button>
        </div>
        {topByBp.length > 0 && (
          <div style={{ marginTop: "1rem" }} data-testid="warbow-protocol-top-bp">
            <h4 className="text-muted" style={{ marginTop: 0 }}>
              Top {topByBp.length} by Battle Points (indexer)
            </h4>
            <ol className="event-list" style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {topByBp.map((row) => (
                <li key={row.address}>
                  <strong>#{row.rank}</strong>{" "}
                  <MegaScannerAddressLink address={row.address as HexAddress} /> ·{" "}
                  <strong>{formatLocaleInteger(row.battlePoints)} BP</strong>
                </li>
              ))}
            </ol>
            <p className="text-muted" style={{ marginBottom: 0, fontSize: "0.9rem" }}>
              First, second, and third finalize slots were filled from this ordering. Verify onchain{" "}
              <span className="mono">battlePoints</span> before submitting.
            </p>
          </div>
        )}
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
