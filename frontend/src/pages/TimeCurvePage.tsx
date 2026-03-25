// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { erc20Abi, timeCurveReadAbi, timeCurveWriteAbi } from "@/lib/abis";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertMessage } from "@/lib/revertMessage";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchTimecurveAllocationClaims,
  fetchTimecurveBuys,
  fetchTimecurvePrizeDistributions,
  fetchTimecurvePrizePayouts,
  fetchReferralApplied,
  type AllocationClaimItem,
  type BuyItem,
  type PrizeDistributionItem,
  type PrizePayoutItem,
  type ReferralAppliedItem,
} from "@/lib/indexerApi";

const PODIUM_LABELS = [
  "Last buyers",
  "Most buys",
  "Biggest buy",
  "Opening window",
  "Closing window",
  "Highest cumulative spend",
];

export function TimeCurvePage() {
  const { address, isConnected } = useAccount();
  const tc = addresses.timeCurve;
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [claims, setClaims] = useState<AllocationClaimItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [claimsNote, setClaimsNote] = useState<string | null>(null);
  const [buyStr, setBuyStr] = useState("");
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const minBuyInitialized = useRef(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [useReferral, setUseReferral] = useState(true);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [prizePayouts, setPrizePayouts] = useState<PrizePayoutItem[] | null>(null);
  const [prizeDist, setPrizeDist] = useState<PrizeDistributionItem[] | null>(null);
  const [refApplied, setRefApplied] = useState<ReferralAppliedItem[] | null>(null);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  useEffect(() => {
    setPendingRef(getPendingReferralCode());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveBuys(25);
      if (cancelled) {
        return;
      }
      if (!data) {
        setIndexerNote("Set VITE_INDEXER_URL to load recent buys from the indexer.");
        setBuys([]);
        return;
      }
      setBuys(data.items);
      setIndexerNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveAllocationClaims(15);
      if (cancelled) {
        return;
      }
      if (!data) {
        setClaimsNote("Set VITE_INDEXER_URL to load allocation claims.");
        setClaims([]);
        return;
      }
      setClaims(data.items);
      setClaimsNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [pp, pd, ra] = await Promise.all([
        fetchTimecurvePrizePayouts(20),
        fetchTimecurvePrizeDistributions(10),
        fetchReferralApplied(address, 15),
      ]);
      if (cancelled) {
        return;
      }
      setPrizePayouts(pp?.items ?? null);
      setPrizeDist(pd?.items ?? null);
      setRefApplied(ra?.items ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const { data, isPending, isError, refetch } = useReadContracts({
    contracts: tc
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" },
          { address: tc, abi: timeCurveReadAbi, functionName: "deadline" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" },
          { address: tc, abi: timeCurveReadAbi, functionName: "ended" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" },
          { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
          { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" },
        ]
      : [],
    query: { enabled: Boolean(tc) },
  });

  const [saleStart, deadline, totalRaised, ended, minBuy, acceptedAsset, refRegAddr] = data ?? [];

  const tokenAddr =
    acceptedAsset?.status === "success" ? (acceptedAsset.result as `0x${string}`) : undefined;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

  const referralRegistryOn =
    refRegAddr?.status === "success" &&
    (refRegAddr.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000";

  const podiumReads = usePodiumReads(tc);

  useEffect(() => {
    if (minBuy?.status !== "success" || minBuyInitialized.current) {
      return;
    }
    if (tokenAddr && tokenDecimals === undefined) {
      return;
    }
    const dec = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;
    minBuyInitialized.current = true;
    setBuyStr(formatUnits(minBuy.result as bigint, dec));
  }, [minBuy, tokenAddr, tokenDecimals]);

  const saleActive =
    !isPending &&
    saleStart?.status === "success" &&
    (saleStart.result as bigint) > 0n &&
    ended?.status === "success" &&
    ended.result === false;

  const deadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;
  const remaining =
    deadlineSec !== undefined ? Math.max(0, deadlineSec - now) : undefined;

  const handleBuy = useCallback(async () => {
    setBuyErr(null);
    if (!address || !tc || !tokenAddr) {
      setBuyErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(buyStr.trim() || "0", decimals);
    } catch {
      setBuyErr(`Invalid amount (use a decimal number, ${decimals} decimals).`);
      return;
    }
    if (amount <= 0n) {
      setBuyErr("Amount must be positive.");
      return;
    }

    let codeHash: `0x${string}` | undefined;
    if (useReferral && referralRegistryOn && pendingRef) {
      try {
        codeHash = hashReferralCode(pendingRef);
      } catch (e) {
        setBuyErr(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    try {
      const allow = await readContract(wagmiConfig, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, tc],
      });
      if (allow < amount) {
        const approveHash = await writeContractAsync({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [tc, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      if (codeHash) {
        const buyHash = await writeContractAsync({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: [amount, codeHash],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
        clearPendingReferralCode();
        setPendingRef(null);
      } else {
        const buyHash = await writeContractAsync({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: [amount],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      }
      void refetch();
    } catch (e) {
      setBuyErr(friendlyRevertMessage(e instanceof Error ? e.message : String(e)));
    }
  }, [
    address,
    tc,
    tokenAddr,
    buyStr,
    decimals,
    useReferral,
    referralRegistryOn,
    pendingRef,
    writeContractAsync,
    refetch,
  ]);

  async function runVoid(fn: "endSale" | "claimAllocation" | "distributePrizes") {
    setBuyErr(null);
    if (!tc) {
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: fn,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      void refetch();
    } catch (e) {
      setBuyErr(friendlyRevertMessage(e instanceof Error ? e.message : String(e)));
    }
  }

  if (!tc) {
    return (
      <section className="page">
        <h1>TimeCurve</h1>
        <p className="placeholder">
          Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see{" "}
          <code>.env.example</code>) to read onchain sale state.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>TimeCurve</h1>
      <p className="lede">Live reads from RPC + indexer feeds; post-sale actions below.</p>

      <div className="data-panel">
        <h2>Onchain (contract)</h2>
        {isPending && <p>Loading contract reads…</p>}
        {isError && <p className="error-text">Could not read contract (check RPC / network).</p>}
        {data && (
          <dl className="kv">
            <dt>saleStart</dt>
            <dd>
              {saleStart?.status === "success" ? (
                <UnixTimestampDisplay raw={saleStart.result as bigint} />
              ) : (
                "—"
              )}
            </dd>
            <dt>deadline</dt>
            <dd>
              {deadline?.status === "success" ? (
                <UnixTimestampDisplay raw={deadline.result as bigint} />
              ) : (
                "—"
              )}
            </dd>
            <dt>time remaining</dt>
            <dd>
              {remaining !== undefined ? `${remaining}s` : "—"}
            </dd>
            <dt>totalRaised</dt>
            <dd>
              {totalRaised?.status === "success" ? (
                <AmountDisplay raw={totalRaised.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>ended</dt>
            <dd>{ended?.status === "success" ? String(ended.result) : "—"}</dd>
            <dt>currentMinBuyAmount</dt>
            <dd>
              {minBuy?.status === "success" ? (
                <AmountDisplay raw={minBuy.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>referralRegistry</dt>
            <dd className="mono">
              {refRegAddr?.status === "success" ? String(refRegAddr.result) : "—"}
            </dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Buy (wallet)</h2>
        <p>
          Approves the sale asset for <strong>TimeCurve</strong>, then calls{" "}
          <code>buy(amount)</code> or <code>buy(amount, codeHash)</code> when a referral code is
          active. Use a funded wallet on the configured chain.
        </p>
        {!isConnected && <p className="placeholder">Connect a wallet to buy.</p>}
        {isConnected && isPending && <p className="placeholder">Loading contract…</p>}
        {isConnected && !saleActive && !isPending && (
          <p className="placeholder">Sale is not active (not started or already ended).</p>
        )}
        {isConnected && saleActive && (
          <>
            <label className="form-label">
              Amount (token units, {decimals} decimals)
              <input
                type="text"
                className="form-input"
                value={buyStr}
                onChange={(e) => setBuyStr(e.target.value)}
                spellCheck={false}
              />
            </label>
            {referralRegistryOn && pendingRef && (
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={useReferral}
                  onChange={(e) => setUseReferral(e.target.checked)}
                />{" "}
                Apply referral <code>{normalizeReferralCode(pendingRef)}</code> (from{" "}
                <code>?ref=</code>)
              </label>
            )}
            {referralRegistryOn && !pendingRef && (
              <p className="muted">Open a referral link with ?ref=CODE to enable referral bonuses.</p>
            )}
            <p>
              <button type="button" className="btn-primary" disabled={isWriting} onClick={handleBuy}>
                {isWriting ? "Confirm in wallet…" : "Approve (if needed) & buy"}
              </button>
            </p>
          </>
        )}
        {buyErr && <p className="error-text">{buyErr}</p>}
      </div>

      <div className="data-panel">
        <h2>After sale</h2>
        <p>
          <button type="button" className="btn-secondary" disabled={isWriting} onClick={() => runVoid("endSale")}>
            endSale (timer expired)
          </button>{" "}
          <button
            type="button"
            className="btn-secondary"
            disabled={isWriting}
            onClick={() => runVoid("claimAllocation")}
          >
            claimAllocation
          </button>{" "}
          <button
            type="button"
            className="btn-secondary"
            disabled={isWriting}
            onClick={() => runVoid("distributePrizes")}
          >
            distributePrizes
          </button>
        </p>
      </div>

      <div className="data-panel">
        <h2>Podiums (onchain)</h2>
        {podiumReads.isLoading && <p>Loading podiums…</p>}
        {podiumReads.data?.map((row, i) => (
          <div key={i} className="podium-block">
            <h3>{PODIUM_LABELS[i] ?? `Category ${i}`}</h3>
            <ol className="podium-list">
              {row.winners.map((w, j) => (
                <li key={j}>
                  <span className="mono">{w.slice(0, 10)}…</span> — value{" "}
                  {row.values[j]?.toString() ?? "—"}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="data-panel">
        <h2>Recent buys (indexer)</h2>
        {indexerNote && <p className="placeholder">{indexerNote}</p>}
        {buys && buys.length === 0 && !indexerNote && <p>No buys indexed yet.</p>}
        {buys && buys.length > 0 && (
          <ul className="event-list">
            {buys.map((b) => (
              <li key={`${b.tx_hash}-${b.log_index}`}>
                <span className="mono">{b.buyer.slice(0, 10)}…</span> — amount{" "}
                <AmountDisplay raw={b.amount} decimals={decimals} /> — block {b.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Allocation claims (indexer)</h2>
        {claimsNote && <p className="placeholder">{claimsNote}</p>}
        {claims && claims.length === 0 && !claimsNote && <p>No allocation claims indexed yet.</p>}
        {claims && claims.length > 0 && (
          <ul className="event-list">
            {claims.map((c) => (
              <li key={`${c.tx_hash}-${c.log_index}`}>
                <span className="mono">{c.buyer.slice(0, 10)}…</span> — tokens{" "}
                <AmountDisplay raw={c.token_amount} decimals={18} /> — block {c.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Prize distributions (indexer)</h2>
        {prizeDist && prizeDist.length === 0 && <p>No prize batch runs indexed yet.</p>}
        {prizeDist && prizeDist.length > 0 && (
          <ul className="event-list">
            {prizeDist.map((p) => (
              <li key={`${p.tx_hash}-${p.log_index}`}>
                PrizesDistributed — block {p.block_number} — tx {p.tx_hash.slice(0, 10)}…
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Prize payouts (indexer)</h2>
        {prizePayouts && prizePayouts.length === 0 && <p>No PrizePaid rows indexed yet.</p>}
        {prizePayouts && prizePayouts.length > 0 && (
          <ul className="event-list">
            {prizePayouts.map((p) => (
              <li key={`${p.tx_hash}-${p.log_index}`}>
                winner <span className="mono">{p.winner.slice(0, 10)}…</span> — cat {p.category} place{" "}
                {p.placement} — <AmountDisplay raw={BigInt(p.amount)} decimals={decimals} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Referral buys (indexer, your wallet as referrer)</h2>
        {!address && <p className="placeholder">Connect a wallet.</p>}
        {address && refApplied && refApplied.length === 0 && <p>No rows indexed.</p>}
        {address && refApplied && refApplied.length > 0 && (
          <ul className="event-list">
            {refApplied.map((r) => (
              <li key={`${r.tx_hash}-${r.log_index}`}>
                buyer <span className="mono">{r.buyer.slice(0, 10)}…</span> — referrer reward{" "}
                <AmountDisplay raw={BigInt(r.referrer_amount)} decimals={18} /> — block {r.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function usePodiumReads(tc: `0x${string}` | undefined) {
  const cats = [0, 1, 2, 3, 4, 5] as const;
  const contracts = tc
    ? cats.map((c) => ({
        address: tc,
        abi: timeCurveReadAbi,
        functionName: "podium" as const,
        args: [c],
      }))
    : [];
  const { data, isPending } = useReadContracts({
    contracts,
    query: { enabled: Boolean(tc) },
  });

  const rows =
    data?.map((r) => {
      if (r.status !== "success") {
        return { winners: ["0x0", "0x0", "0x0"] as const, values: [0n, 0n, 0n] as const };
      }
      const result = r.result as readonly [readonly `0x${string}`[], readonly bigint[]];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const values = result[1] as [bigint, bigint, bigint];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [values[0], values[1], values[2]],
      };
    }) ?? [];

  return { data: rows, isLoading: isPending };
}
