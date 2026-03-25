// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { maxUint256 } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { erc20Abi, referralRegistryReadAbi, referralRegistryWriteAbi } from "@/lib/abis";
import { normalizeReferralCode } from "@/lib/referralCode";
import { friendlyRevertMessage } from "@/lib/revertMessage";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchReferralApplied,
  fetchReferralRegistrations,
  type ReferralAppliedItem,
  type ReferralRegistrationItem,
} from "@/lib/indexerApi";

export function ReferralsPage() {
  const { address, isConnected } = useAccount();
  const reg = addresses.referralRegistry;
  const [codeInput, setCodeInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [regs, setRegs] = useState<ReferralRegistrationItem[] | null>(null);
  const [applied, setApplied] = useState<ReferralAppliedItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);

  const { data: cl8yAddr } = useReadContract({
    address: reg,
    abi: referralRegistryReadAbi,
    functionName: "cl8yToken",
    query: { enabled: Boolean(reg) },
  });

  const { data: burnAmt } = useReadContract({
    address: reg,
    abi: referralRegistryReadAbi,
    functionName: "registrationBurnAmount",
    query: { enabled: Boolean(reg) },
  });

  const { data: cl8yDecimals } = useReadContract({
    address: cl8yAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(cl8yAddr) },
  });

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const base = typeof window !== "undefined" ? window.location.origin : "";
  let sharePreview = `${base}/?ref=yourcode`;
  try {
    if (codeInput.trim()) {
      sharePreview = `${base}/?ref=${encodeURIComponent(normalizeReferralCode(codeInput))}`;
    }
  } catch {
    /* invalid while typing */
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!indexerBaseUrl()) {
        if (!cancelled) {
          setIndexerNote("Set VITE_INDEXER_URL for referral activity.");
          setRegs([]);
          setApplied([]);
        }
        return;
      }
      const [r, a] = await Promise.all([
        fetchReferralRegistrations(25),
        fetchReferralApplied(address, 25),
      ]);
      if (cancelled) {
        return;
      }
      setIndexerNote(null);
      setRegs(r?.items ?? []);
      setApplied(a?.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function handleRegister() {
    setErr(null);
    if (!address || !reg || !cl8yAddr || burnAmt === undefined) {
      setErr("Connect a wallet and ensure referral registry is configured.");
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeReferralCode(codeInput);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    try {
      const allow = await readContract(wagmiConfig, {
        address: cl8yAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, reg],
      });
      if (allow < burnAmt) {
        const h = await writeContractAsync({
          address: cl8yAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [reg, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: h });
      }
      const tx = await writeContractAsync({
        address: reg,
        abi: referralRegistryWriteAbi,
        functionName: "registerCode",
        args: [normalized],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: tx });
    } catch (e) {
      setErr(friendlyRevertMessage(e instanceof Error ? e.message : String(e)));
    }
  }

  function copyShareLink() {
    try {
      let normalized: string;
      try {
        normalized = normalizeReferralCode(codeInput);
      } catch {
        setErr("Enter a valid code first.");
        return;
      }
      const link = `${base}/?ref=${encodeURIComponent(normalized)}`;
      void navigator.clipboard.writeText(link);
    } catch {
      setErr("Could not copy to clipboard.");
    }
  }

  if (!reg) {
    return (
      <section className="page">
        <h1>Referrals</h1>
        <p className="placeholder">
          Set <code>VITE_REFERRAL_REGISTRY_ADDRESS</code> in <code>.env</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Referrals</h1>
      <p className="lede">
        Register a short code (burns CL8Y onchain). Share links use <code>?ref=</code> — stored in
        session + local storage until you buy on TimeCurve with referral enabled.
      </p>

      <div className="data-panel">
        <h2>Register a code</h2>
        {!isConnected && <p className="placeholder">Connect a wallet.</p>}
        {isConnected && (
          <>
            <label className="form-label">
              Code (3–16 letters/digits)
              <input
                type="text"
                className="form-input"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                spellCheck={false}
              />
            </label>
            <p>
              <button type="button" className="btn-primary" disabled={isWriting} onClick={handleRegister}>
                {isWriting ? "Confirm in wallet…" : "Approve CL8Y (if needed) & register"}
              </button>
            </p>
            {burnAmt !== undefined && cl8yDecimals !== undefined && (
              <p className="muted">
                Burn:{" "}
                <AmountDisplay raw={burnAmt} decimals={Number(cl8yDecimals)} /> CL8Y
              </p>
            )}
            <p>
              <button type="button" className="btn-secondary" onClick={copyShareLink}>
                Copy share link
              </button>{" "}
              <span className="mono muted">{sharePreview}</span>
            </p>
          </>
        )}
        {err && <p className="error-text">{err}</p>}
      </div>

      <div className="data-panel">
        <h2>Recent registrations (indexer)</h2>
        {indexerNote && <p className="placeholder">{indexerNote}</p>}
        {regs && regs.length === 0 && !indexerNote && <p>No registrations indexed yet.</p>}
        {regs && regs.length > 0 && (
          <ul className="event-list">
            {regs.map((r) => (
              <li key={`${r.tx_hash}-${r.log_index}`}>
                <span className="mono">{r.normalized_code}</span> —{" "}
                <span className="mono">{r.owner_address.slice(0, 10)}…</span> — block {r.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Your referral volume (indexer)</h2>
        {!address && <p className="placeholder">Connect a wallet to filter by referrer.</p>}
        {address && indexerNote && <p className="placeholder">{indexerNote}</p>}
        {address && applied && applied.length === 0 && !indexerNote && (
          <p>No indexed referral buys for this wallet as referrer.</p>
        )}
        {address && applied && applied.length > 0 && (
          <ul className="event-list">
            {applied.map((x) => (
              <li key={`${x.tx_hash}-${x.log_index}`}>
                buyer <span className="mono">{x.buyer.slice(0, 10)}…</span> — referrer reward{" "}
                <AmountDisplay raw={BigInt(x.referrer_amount)} decimals={18} /> — block {x.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
