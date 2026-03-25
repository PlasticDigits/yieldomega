// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { maxUint256, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { TxHash } from "@/components/TxHash";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { erc20Abi, rabbitTreasuryReadAbi, rabbitTreasuryWriteAbi } from "@/lib/abis";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchRabbitDeposits,
  fetchRabbitFactionStats,
  fetchRabbitHealthEpochs,
  fetchRabbitWithdrawals,
  type DepositItem,
  type FactionStatItem,
  type HealthEpochItem,
  type WithdrawalItem,
} from "@/lib/indexerApi";

export function RabbitTreasuryPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const rt = addresses.rabbitTreasury;
  const [deposits, setDeposits] = useState<DepositItem[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[] | null>(null);
  const [healthEpochs, setHealthEpochs] = useState<HealthEpochItem[] | null>(null);
  const [factionStats, setFactionStats] = useState<FactionStatItem[] | null>(null);
  const [factionNote, setFactionNote] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wNote, setWNote] = useState<string | null>(null);
  const [healthNote, setHealthNote] = useState<string | null>(null);
  const [depositStr, setDepositStr] = useState("10");
  const [withdrawStr, setWithdrawStr] = useState("1");
  const [factionStr, setFactionStr] = useState("0");
  const [depositErr, setDepositErr] = useState<string | null>(null);
  const [gasDeposit, setGasDeposit] = useState<bigint | undefined>(undefined);
  const [gasWithdraw, setGasWithdraw] = useState<bigint | undefined>(undefined);

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
      const data = await fetchRabbitWithdrawals(address, 30);
      if (cancelled) {
        return;
      }
      if (!data) {
        setWNote("Set VITE_INDEXER_URL to load withdrawals.");
        setWithdrawals([]);
        return;
      }
      setWithdrawals(data.items);
      setWNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchRabbitHealthEpochs(20);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchRabbitFactionStats();
      if (cancelled) {
        return;
      }
      if (!data) {
        setFactionNote("Set VITE_INDEXER_URL for faction standings.");
        setFactionStats([]);
        return;
      }
      setFactionStats(data.items);
      setFactionNote(null);
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
          { address: rt, abi: rabbitTreasuryReadAbi, functionName: "doub" },
        ]
      : [],
    query: { enabled: Boolean(rt) },
  });

  const [epochId, epochEnd, totalReserves, eWad, reserveAsset, paused, doubAddr] = data ?? [];

  const reserveAddr =
    reserveAsset?.status === "success" ? (reserveAsset.result as `0x${string}`) : undefined;
  const doubToken =
    doubAddr?.status === "success" ? (doubAddr.result as `0x${string}`) : undefined;

  const { data: reserveDecimals } = useReadContract({
    address: reserveAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(reserveAddr) },
  });

  const { data: doubDecimals } = useReadContract({
    address: doubToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(doubToken) },
  });

  const { data: doubBal } = useReadContract({
    address: doubToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(doubToken && address) },
  });

  const reserveTokenDecimals = reserveDecimals !== undefined ? Number(reserveDecimals) : 18;
  const doubTokenDecimals = doubDecimals !== undefined ? Number(doubDecimals) : 18;

  const canDeposit =
    !isPending &&
    epochId?.status === "success" &&
    (epochId.result as bigint) > 0n &&
    paused?.status === "success" &&
    paused.result === false;

  useEffect(() => {
    if (!address || !rt || !canDeposit) {
      setGasDeposit(undefined);
      return;
    }
    let amount: bigint;
    let factionId: bigint;
    try {
      amount = parseUnits(depositStr.trim() || "0", reserveTokenDecimals);
      factionId = BigInt(factionStr.trim() || "0");
    } catch {
      setGasDeposit(undefined);
      return;
    }
    if (amount <= 0n) {
      setGasDeposit(undefined);
      return;
    }
    const t = setTimeout(() => {
      void estimateGasUnits({
        address: rt,
        abi: rabbitTreasuryWriteAbi,
        functionName: "deposit",
        args: [amount, factionId],
        account: address,
        chainId,
      }).then(setGasDeposit);
    }, 400);
    return () => clearTimeout(t);
  }, [address, rt, canDeposit, depositStr, factionStr, reserveTokenDecimals, chainId]);

  useEffect(() => {
    if (!address || !rt || !doubToken) {
      setGasWithdraw(undefined);
      return;
    }
    let doubAmount: bigint;
    let factionId: bigint;
    try {
      doubAmount = parseUnits(withdrawStr.trim() || "0", doubTokenDecimals);
      factionId = BigInt(factionStr.trim() || "0");
    } catch {
      setGasWithdraw(undefined);
      return;
    }
    if (doubAmount <= 0n) {
      setGasWithdraw(undefined);
      return;
    }
    const t = setTimeout(() => {
      void estimateGasUnits({
        address: rt,
        abi: rabbitTreasuryWriteAbi,
        functionName: "withdraw",
        args: [doubAmount, factionId],
        account: address,
        chainId,
      }).then(setGasWithdraw);
    }, 400);
    return () => clearTimeout(t);
  }, [address, rt, doubToken, withdrawStr, factionStr, doubTokenDecimals, chainId]);

  const chartPoints = useMemo(() => {
    if (!healthEpochs || healthEpochs.length === 0) {
      return [];
    }
    const sorted = [...healthEpochs].sort((a, b) => Number(a.epoch_id) - Number(b.epoch_id));
    return sorted.map((h) => ({
      epoch: h.epoch_id,
      ratio: Number(h.reserve_ratio_wad) / 1e18,
    }));
  }, [healthEpochs]);

  const backingChartPoints = useMemo(() => {
    if (!healthEpochs || healthEpochs.length === 0) {
      return [];
    }
    const sorted = [...healthEpochs].sort((a, b) => Number(a.epoch_id) - Number(b.epoch_id));
    return sorted.map((h) => ({
      epoch: h.epoch_id,
      backing: Number(h.backing_per_doubloon_wad) / 1e18,
      repricing: Number(h.repricing_factor_wad) / 1e18,
    }));
  }, [healthEpochs]);

  async function handleDeposit() {
    setDepositErr(null);
    if (!address || !rt || !reserveAddr) {
      setDepositErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    let amount: bigint;
    let factionId: bigint;
    try {
      amount = parseUnits(depositStr.trim() || "0", reserveTokenDecimals);
      factionId = BigInt(factionStr.trim() || "0");
    } catch {
      setDepositErr("Invalid amount or faction.");
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
        args: [amount, factionId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: depHash });
      void refetch();
    } catch (e) {
      setDepositErr(friendlyRevertFromUnknown(e));
    }
  }

  async function handleWithdraw() {
    setDepositErr(null);
    if (!address || !rt || !doubToken) {
      setDepositErr("Connect a wallet and ensure DOUB token address loaded.");
      return;
    }
    let doubAmount: bigint;
    let factionId: bigint;
    try {
      doubAmount = parseUnits(withdrawStr.trim() || "0", doubTokenDecimals);
      factionId = BigInt(factionStr.trim() || "0");
    } catch {
      setDepositErr("Invalid withdraw amount or faction.");
      return;
    }
    if (doubAmount <= 0n) {
      setDepositErr("Withdraw amount must be positive.");
      return;
    }
    try {
      const allow = await readContract(wagmiConfig, {
        address: doubToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, rt],
      });
      if (allow < doubAmount) {
        const approveHash = await writeContractAsync({
          address: doubToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [rt, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const wHash = await writeContractAsync({
        address: rt,
        abi: rabbitTreasuryWriteAbi,
        functionName: "withdraw",
        args: [doubAmount, factionId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: wHash });
      void refetch();
    } catch (e) {
      setDepositErr(friendlyRevertFromUnknown(e));
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
      <p className="lede">Burrow metrics from RPC; history from indexer.</p>

      <div className="data-panel">
        <h2>Understanding Rabbit Treasury</h2>
        <p>
          This is a <strong>reserve-linked treasury game</strong>: DOUB is internal accounting, not a
          bank deposit. Returns are not guaranteed; sustainability depends on fees, activity, and
          reserve health. The protocol may reprice when metrics weaken—see onchain events and docs.
        </p>
        <p className="muted">
          <strong>Faction id</strong> is a numeric game parameter for this Burrow. Onchain Leprechaun
          metadata does not expose a faction id for auto-selection in this release—enter the faction
          your team or rules specify (see product docs for Burrow ↔ NFT interplay).
        </p>
      </div>

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
            <dt>your DOUB</dt>
            <dd>
              {doubBal !== undefined ? (
                <AmountDisplay raw={doubBal as bigint} decimals={doubTokenDecimals} />
              ) : (
                "—"
              )}
            </dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Reserve ratio by epoch (indexer)</h2>
        {healthNote && <p className="placeholder">{healthNote}</p>}
        {chartPoints.length > 1 && (
          <svg className="epoch-chart" viewBox="0 0 400 120" role="img" aria-label="Reserve ratio trend">
            <polyline
              fill="none"
              stroke="var(--line)"
              strokeWidth="3"
              points={chartPoints
                .map((p, i) => {
                  const x = (i / (chartPoints.length - 1)) * 380 + 10;
                  const y = 110 - Math.min(100, p.ratio * 50);
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        )}
        {chartPoints.length > 0 && chartPoints.length <= 1 && (
          <p className="muted">Need multiple epochs for a line chart.</p>
        )}
      </div>

      <div className="data-panel">
        <h2>Backing per DOUB and repricing (indexer)</h2>
        {healthNote && <p className="placeholder">{healthNote}</p>}
        {backingChartPoints.length > 1 && (
          <svg
            className="epoch-chart"
            viewBox="0 0 400 120"
            role="img"
            aria-label="Backing and repricing by epoch"
          >
            {(() => {
              const backs = backingChartPoints.map((p) => p.backing);
              const reprs = backingChartPoints.map((p) => p.repricing);
              const vmin = Math.min(...backs, ...reprs);
              const vmax = Math.max(...backs, ...reprs);
              const span = Math.max(vmax - vmin, 1e-9);
              const line = (vals: number[]) =>
                vals
                  .map((v, i) => {
                    const x = (i / (vals.length - 1)) * 380 + 10;
                    const y = 110 - ((v - vmin) / span) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ");
              return (
                <>
                  <polyline fill="none" stroke="var(--line)" strokeWidth="3" points={line(backs)} />
                  <polyline
                    fill="none"
                    stroke="var(--accent, #8fa)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    points={line(reprs)}
                  />
                </>
              );
            })()}
          </svg>
        )}
        {backingChartPoints.length > 0 && backingChartPoints.length <= 1 && (
          <p className="muted">Need multiple epochs for dual-series chart.</p>
        )}
        <p className="muted">
          Solid: backing per DOUB (WAD scale in chart as float). Dashed: repricing factor.
        </p>
      </div>

      <div className="data-panel">
        <h2>Faction standings (indexer)</h2>
        {factionNote && <p className="placeholder">{factionNote}</p>}
        {factionStats && factionStats.length === 0 && !factionNote && (
          <p>No faction deposit data indexed yet.</p>
        )}
        {factionStats && factionStats.length > 0 && (
          <ul className="event-list">
            {factionStats.map((f) => (
              <li key={f.faction_id}>
                faction <span className="mono">{f.faction_id}</span> — net reserves{" "}
                <AmountDisplay raw={BigInt(f.net_deposits)} decimals={reserveTokenDecimals} /> —{" "}
                deposits {f.deposit_count} / withdrawals {f.withdrawal_count}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Deposit / withdraw (wallet)</h2>
        <p>
          <label className="form-label">
            Faction id
            <input
              type="text"
              className="form-input"
              value={factionStr}
              onChange={(e) => setFactionStr(e.target.value)}
              spellCheck={false}
            />
          </label>
        </p>
        {!isConnected && <p className="placeholder">Connect a wallet.</p>}
        {isConnected && isPending && <p className="placeholder">Loading contract…</p>}
        {isConnected && !canDeposit && !isPending && (
          <p className="placeholder">Deposits disabled (no open epoch or contract is paused).</p>
        )}
        {isConnected && canDeposit && (
          <>
            <label className="form-label">
              Deposit amount (reserve token, {reserveTokenDecimals} decimals)
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
                {isWriting ? "Confirm…" : "Approve (if needed) & deposit"}
              </button>
            </p>
            {gasDeposit !== undefined && (
              <p className="muted">Est. gas (deposit): ~{gasDeposit.toString()} units</p>
            )}
          </>
        )}
        {isConnected && (
          <>
            <label className="form-label">
              Withdraw DOUB amount ({doubTokenDecimals} decimals)
              <input
                type="text"
                className="form-input"
                value={withdrawStr}
                onChange={(e) => setWithdrawStr(e.target.value)}
                spellCheck={false}
              />
            </label>
            <p>
              <button type="button" className="btn-secondary" disabled={isWriting} onClick={handleWithdraw}>
                {isWriting ? "Confirm…" : "Approve DOUB (if needed) & withdraw"}
              </button>
            </p>
            {gasWithdraw !== undefined && (
              <p className="muted">Est. gas (withdraw): ~{gasWithdraw.toString()} units</p>
            )}
          </>
        )}
        {depositErr && <p className="error-text">{depositErr}</p>}
      </div>

      <div className="data-panel">
        <h2>Health epochs (indexer)</h2>
        {healthEpochs && healthEpochs.length > 0 && (
          <ul className="event-list">
            {healthEpochs.map((h) => (
              <li key={`${h.tx_hash}-${h.log_index}`}>
                <span className="mono">epoch {h.epoch_id}</span> — repricing{" "}
                <AmountDisplay raw={h.repricing_factor_wad} decimals={18} /> — backing/DOUB{" "}
                <AmountDisplay raw={h.backing_per_doubloon_wad} decimals={18} /> — block {h.block_number} — tx{" "}
                <TxHash hash={h.tx_hash} />
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
                <AmountDisplay raw={d.doub_out} decimals={18} /> — faction {d.faction_id} — asset{" "}
                <span className="mono">{d.reserve_asset.slice(0, 10)}…</span> — block {d.block_number} — tx{" "}
                <TxHash hash={d.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Withdrawals {address ? `(wallet)` : ""}</h2>
        {wNote && <p className="placeholder">{wNote}</p>}
        {withdrawals && withdrawals.length === 0 && !wNote && <p>No matching withdrawals.</p>}
        {withdrawals && withdrawals.length > 0 && (
          <ul className="event-list">
            {withdrawals.map((w) => (
              <li key={`${w.tx_hash}-${w.log_index}`}>
                <span className="mono">{w.user_address.slice(0, 10)}…</span> — reserve out{" "}
                <AmountDisplay raw={w.amount} decimals={reserveTokenDecimals} /> — doubIn{" "}
                <AmountDisplay raw={w.doub_in} decimals={18} /> — faction {w.faction_id} — asset{" "}
                <span className="mono">{w.reserve_asset.slice(0, 10)}…</span> — block {w.block_number} — tx{" "}
                <TxHash hash={w.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
