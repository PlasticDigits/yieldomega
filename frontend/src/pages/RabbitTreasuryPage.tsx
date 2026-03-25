// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { maxUint256, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { erc20Abi, rabbitTreasuryReadAbi, rabbitTreasuryWriteAbi } from "@/lib/abis";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchRabbitDeposits,
  fetchRabbitHealthEpochs,
  type DepositItem,
  type HealthEpochItem,
} from "@/lib/indexerApi";

export function RabbitTreasuryPage() {
  const { address, isConnected } = useAccount();
  const rt = addresses.rabbitTreasury;
  const [deposits, setDeposits] = useState<DepositItem[] | null>(null);
  const [healthEpochs, setHealthEpochs] = useState<HealthEpochItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [healthNote, setHealthNote] = useState<string | null>(null);
  const [depositStr, setDepositStr] = useState("10");
  const [depositErr, setDepositErr] = useState<string | null>(null);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchRabbitDeposits(address, 30);
      if (cancelled) {
        return;
      }
      if (!data) {
        setNote("Set VITE_INDEXER_URL to load deposit history.");
        setDeposits([]);
        return;
      }
      setDeposits(data.items);
      setNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchRabbitHealthEpochs(5);
      if (cancelled) {
        return;
      }
      if (!data) {
        setHealthNote("Set VITE_INDEXER_URL to load BurrowHealthEpochFinalized rows.");
        setHealthEpochs([]);
        return;
      }
      setHealthEpochs(data.items);
      setHealthNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isPending, isError, refetch } = useReadContracts({
    contracts: rt
      ? [
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "currentEpochId" },
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "epochEnd" },
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "totalReserves" },
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "eWad" },
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "reserveAsset" },
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "paused" },
        ]
      : [],
    query: { enabled: Boolean(rt) },
  });

  const [epochId, epochEnd, totalReserves, eWad, reserveAsset, paused] = data ?? [];

  const reserveAddr =
    reserveAsset?.status === "success" ? (reserveAsset.result as `0x${string}`) : undefined;

  const { data: reserveDecimals } = useReadContract({
    address: reserveAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(reserveAddr) },
  });

  const reserveTokenDecimals = reserveDecimals !== undefined ? Number(reserveDecimals) : 18;
  const canDeposit =
    !isPending &&
    epochId?.status === "success" &&
    (epochId.result as bigint) > 0n &&
    paused?.status === "success" &&
    paused.result === false;

  async function handleDeposit() {
    setDepositErr(null);
    if (!address || !rt || !reserveAddr) {
      setDepositErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(depositStr.trim() || "0", reserveTokenDecimals);
    } catch {
      setDepositErr(`Invalid amount (use a decimal number, ${reserveTokenDecimals} decimals).`);
      return;
    }
    if (amount <= 0n) {
      setDepositErr("Amount must be positive.");
      return;
    }
    try {
      const allow = await readContract(wagmiConfig, {
        address: reserveAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, rt],
      });
      if (allow < amount) {
        const approveHash = await writeContractAsync({
          address: reserveAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [rt, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const depHash = await writeContractAsync({
        address: rt,
        abi: rabbitTreasuryWriteAbi,
        functionName: "deposit",
        args: [amount, 0n],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: depHash });
      void refetch();
    } catch (e) {
      setDepositErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (!rt) {
    return (
      <section className="page">
        <h1>Rabbit Treasury</h1>
        <p className="placeholder">
          Set <code>VITE_RABBIT_TREASURY_ADDRESS</code> in <code>.env</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Rabbit Treasury</h1>
      <p className="lede">Treasury metrics from RPC; deposits from indexer (filtered by wallet when connected).</p>

      <div className="data-panel">
        <h2>Onchain</h2>
        {isPending && <p>Loading…</p>}
        {isError && <p className="error-text">Could not read treasury (check RPC / network).</p>}
        {data && (
          <dl className="kv">
            <dt>currentEpochId</dt>
            <dd>
              {epochId?.status === "success" ? (
                <AmountDisplay raw={epochId.result as bigint} decimals={0} />
              ) : (
                "—"
              )}
            </dd>
            <dt>epochEnd</dt>
            <dd>
              {epochEnd?.status === "success" ? (
                <UnixTimestampDisplay raw={epochEnd.result as bigint} />
              ) : (
                "—"
              )}
            </dd>
            <dt>totalReserves</dt>
            <dd>
              {totalReserves?.status === "success" ? (
                <AmountDisplay raw={totalReserves.result as bigint} decimals={reserveTokenDecimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>eWad</dt>
            <dd>
              {eWad?.status === "success" ? (
                <AmountDisplay raw={eWad.result as bigint} decimals={18} />
              ) : (
                "—"
              )}
            </dd>
            <dt>paused</dt>
            <dd>{paused?.status === "success" ? String(paused.result) : "—"}</dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Deposit (wallet)</h2>
        <p>
          Approves the reserve asset for <strong>RabbitTreasury</strong>, then calls{" "}
          <code>deposit(amount, 0)</code> (faction id 0).
        </p>
        {!isConnected && <p className="placeholder">Connect a wallet to deposit.</p>}
        {isConnected && isPending && <p className="placeholder">Loading contract…</p>}
        {isConnected && !canDeposit && !isPending && (
          <p className="placeholder">Deposits disabled (no open epoch or contract is paused).</p>
        )}
        {isConnected && canDeposit && (
          <>
            <label className="form-label">
              Amount (reserve token, {reserveTokenDecimals} decimals)
              <input
                type="text"
                className="form-input"
                value={depositStr}
                onChange={(e) => setDepositStr(e.target.value)}
                spellCheck={false}
              />
            </label>
            <p>
              <button type="button" className="btn-primary" disabled={isWriting} onClick={handleDeposit}>
                {isWriting ? "Confirm in wallet…" : "Approve (if needed) & deposit"}
              </button>
            </p>
          </>
        )}
        {depositErr && <p className="error-text">{depositErr}</p>}
      </div>

      <div className="data-panel">
        <h2>Health epochs (indexer)</h2>
        <p>
          Latest <code>BurrowHealthEpochFinalized</code> rows: reserve ratio, repricing factor, backing per
          DOUB.
        </p>
        {healthNote && <p className="placeholder">{healthNote}</p>}
        {healthEpochs && healthEpochs.length === 0 && !healthNote && (
          <p>No finalized health epochs indexed yet.</p>
        )}
        {healthEpochs && healthEpochs.length > 0 && (
          <ul className="event-list">
            {healthEpochs.map((h) => (
              <li key={`${h.tx_hash}-${h.log_index}`}>
                <span className="mono">epoch {h.epoch_id}</span> — repricing{" "}
                <AmountDisplay raw={h.repricing_factor_wad} decimals={18} /> — backing/DOUB{" "}
                <AmountDisplay raw={h.backing_per_doubloon_wad} decimals={18} /> — block {h.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Deposits {address ? `(wallet ${address.slice(0, 8)}…)` : "(all recent)"}</h2>
        {note && <p className="placeholder">{note}</p>}
        {deposits && deposits.length === 0 && !note && <p>No matching deposits.</p>}
        {deposits && deposits.length > 0 && (
          <ul className="event-list">
            {deposits.map((d) => (
              <li key={`${d.tx_hash}-${d.log_index}`}>
                <span className="mono">{d.user_address.slice(0, 10)}…</span> — amount{" "}
                <AmountDisplay raw={d.amount} decimals={reserveTokenDecimals} /> — doubOut{" "}
                <AmountDisplay raw={d.doub_out} decimals={18} /> — block {d.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
