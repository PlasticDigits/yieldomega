// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { erc20Abi, timeCurveReadAbi, timeCurveWriteAbi } from "@/lib/abis";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchTimecurveAllocationClaims,
  fetchTimecurveBuys,
  type AllocationClaimItem,
  type BuyItem,
} from "@/lib/indexerApi";

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

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

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

  const { data, isPending, isError, refetch } = useReadContracts({
    contracts: tc
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" },
          { address: tc, abi: timeCurveReadAbi, functionName: "deadline" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" },
          { address: tc, abi: timeCurveReadAbi, functionName: "ended" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" },
          { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
        ]
      : [],
    query: { enabled: Boolean(tc) },
  });

  const [saleStart, deadline, totalRaised, ended, minBuy, acceptedAsset] = data ?? [];

  const tokenAddr =
    acceptedAsset?.status === "success" ? (acceptedAsset.result as `0x${string}`) : undefined;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

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

  async function handleBuy() {
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
      const buyHash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "buy",
        args: [amount],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      void refetch();
    } catch (e) {
      setBuyErr(e instanceof Error ? e.message : String(e));
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
      <p className="lede">Live reads from RPC + recent buys from the indexer.</p>

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
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Buy (wallet)</h2>
        <p>
          Approves the sale asset for <strong>TimeCurve</strong> (the contract calls{" "}
          <code>transferFrom</code> to move funds to the fee router), then calls{" "}
          <code>buy(amount)</code>. Use a funded wallet on the configured chain (mock USDM on dev
          deploy).
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
    </section>
  );
}
