// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { maxUint256 } from "viem";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { erc20Abi, referralRegistryReadAbi, referralRegistryWriteAbi, timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { formatBpsAsPercent } from "@/lib/formatAmount";
import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";
import {
  getStoredMyReferralCodeForWallet,
  setStoredMyReferralCodeForWallet,
} from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { wagmiConfig } from "@/wagmi-config";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import {
  REFERRAL_COPY_BANNER_MS,
  REFERRAL_COPY_ERROR_REJECTED,
  REFERRAL_COPY_ERROR_UNSUPPORTED,
  REFERRAL_COPY_SUCCESS_BANNER,
} from "@/pages/referrals/referralShareCopyFeedback";

function isNonZeroBytes32(v: `0x${string}` | bigint | undefined): v is `0x${string}` | bigint {
  if (v === undefined) {
    return false;
  }
  if (typeof v === "bigint") {
    return v !== 0n;
  }
  return BigInt(v) !== 0n;
}

type Props = { className?: string };

export function ReferralRegisterSection({ className }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { mismatch: chainMismatchForWrites } = useWalletTargetChainMismatch();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [codeInput, setCodeInput] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyBanner, setCopyBanner] = useState<{ variant: "success" | "error"; text: string } | null>(
    null,
  );
  const copyBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyBanner = useCallback((variant: "success" | "error", text: string) => {
    if (copyBannerTimeoutRef.current) {
      clearTimeout(copyBannerTimeoutRef.current);
      copyBannerTimeoutRef.current = null;
    }
    setCopyBanner({ variant, text });
    copyBannerTimeoutRef.current = setTimeout(() => {
      setCopyBanner(null);
      copyBannerTimeoutRef.current = null;
    }, REFERRAL_COPY_BANNER_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (copyBannerTimeoutRef.current) {
        clearTimeout(copyBannerTimeoutRef.current);
      }
    };
  }, []);

  const tc = addresses.timeCurve;
  const { data: regFromTimeCurve } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "referralRegistry",
    query: { enabled: Boolean(tc) },
  });

  const registry = useMemo((): `0x${string}` | undefined => {
    const a = addresses.referralRegistry;
    if (a) {
      return a;
    }
    if (regFromTimeCurve && regFromTimeCurve !== "0x0000000000000000000000000000000000000000") {
      return regFromTimeCurve as `0x${string}`;
    }
    return undefined;
  }, [regFromTimeCurve]);

  const { data: refEachBps } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "REFERRAL_EACH_BPS",
    query: { enabled: Boolean(tc) },
  });

  const { data: bundle } = useReadContracts({
    contracts: registry
      ? [
          { address: registry, abi: referralRegistryReadAbi, functionName: "cl8yToken" },
          { address: registry, abi: referralRegistryReadAbi, functionName: "registrationBurnAmount" },
        ]
      : [],
    query: { enabled: Boolean(registry), refetchInterval: 20_000 },
  });

  const cl8yToken =
    bundle?.[0]?.status === "success" ? (bundle[0].result as `0x${string}`) : undefined;
  const burnWad = bundle?.[1]?.status === "success" ? (bundle[1].result as bigint) : undefined;

  const { data: ownerCodeHash, refetch: refetchOwner } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "ownerCode",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(registry && address) },
  });

  const hasRegistered = isNonZeroBytes32(ownerCodeHash as `0x${string}` | bigint | undefined);

  const storedCode = getStoredMyReferralCodeForWallet(address);

  const { data: hashForStored } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "hashCode",
    args: storedCode ? [storedCode] : undefined,
    query: { enabled: Boolean(registry && storedCode) },
  });

  const storedMatchesOnchain = Boolean(
    hasRegistered &&
      storedCode &&
      hashForStored &&
      ownerCodeHash &&
      (hashForStored as string).toLowerCase() === (ownerCodeHash as string).toLowerCase(),
  );

  const displayCode = storedMatchesOnchain && storedCode ? storedCode : null;

  useEffect(() => {
    setOrigin(typeof window === "undefined" ? "" : window.location.origin);
  }, []);

  const referLinks = useMemo(() => {
    if (!displayCode) {
      return null;
    }
    const b = (path: string) => `${origin}${path}`;
    return {
      timecurve: b(`/timecurve/${displayCode}`),
      query: b(`/?ref=${encodeURIComponent(displayCode)}`),
    };
  }, [displayCode, origin]);

  const copy = useCallback(
    (label: string, text: string) => {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        showCopyBanner("error", REFERRAL_COPY_ERROR_UNSUPPORTED);
        return;
      }
      void navigator.clipboard.writeText(text).then(
        () => {
          setCopied(label);
          setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
          showCopyBanner("success", REFERRAL_COPY_SUCCESS_BANNER);
        },
        () => {
          showCopyBanner("error", REFERRAL_COPY_ERROR_REJECTED);
        },
      );
    },
    [showCopyBanner],
  );

  const onRegister = useCallback(async () => {
    setFormErr(null);
    const netErr = chainMismatchWriteMessage(chainId);
    if (netErr) {
      setFormErr(netErr);
      return;
    }
    if (!registry || !address || !cl8yToken || !burnWad) {
      setFormErr("Referral registry is not available on this build.");
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeReferralCode(codeInput);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Invalid referral code.");
      return;
    }
    if (isReferralSlugReservedForRouting(normalized)) {
      setFormErr(
        "That code is reserved for app routes (for example arena, protocol, or a top-level path name) and cannot be registered.",
      );
      return;
    }
    try {
      const need = burnWad;
      const allow = await readContract(wagmiConfig, {
        address: cl8yToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, registry],
      });
      if (allow < need) {
        const approveHash = await writeContractAsync({
          address: cl8yToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [registry, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const regHash = await writeContractAsync({
        address: registry,
        abi: referralRegistryWriteAbi,
        functionName: "registerCode",
        args: [normalized],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: regHash });
      setStoredMyReferralCodeForWallet(address, normalized);
      setCodeInput("");
      await refetchOwner();
    } catch (e) {
      setFormErr(friendlyRevertFromUnknown(e));
    }
  }, [address, burnWad, chainId, cl8yToken, codeInput, refetchOwner, registry, writeContractAsync]);

  if (!registry) {
    return (
      <PageSection
        className={className}
        title="Registry"
        badgeLabel="Unconfigured"
        badgeTone="warning"
        lede="Set `VITE_REFERRAL_REGISTRY_ADDRESS` or point `VITE_TIMECURVE_ADDRESS` at a TimeCurve with a non-zero `referralRegistry`."
      >
        <StatusMessage variant="placeholder">
          <strong>No registry address.</strong> The app cannot read <code>ReferralRegistry</code> until deployment env is wired.
        </StatusMessage>
      </PageSection>
    );
  }

  return (
    <div className={className ?? ""}>
      <PageSection
        title="Reward parameters"
        badgeLabel="On-chain"
        badgeTone="live"
        lede="Referral incentives are CHARM weight (not a reserve send). Values below are read from TimeCurve when an address is configured."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {tc && refEachBps !== undefined ? (
            <>
              Per-side referral bonus: <strong>{formatBpsAsPercent(Number(refEachBps))}</strong> of <code>charmWad</code> to
              the buyer and the same to the referrer (canonical: <code>docs/product/referrals.md</code>).
            </>
          ) : (
            <>Set `VITE_TIMECURVE_ADDRESS` to show live `REFERRAL_EACH_BPS`.</>
          )}
        </p>
      </PageSection>

      <ChainMismatchWriteBarrier testId="referrals-register-chain-write-gate">
      <PageSection
        title="Register a code"
        badgeLabel="CL8Y burn"
        badgeTone="warning"
        lede="Registering a code burns CL8Y on-chain. Use 3–16 characters, letters and digits only (canonical: lowercase a–z, 0–9)."
      >
        {!isConnected && (
          <StatusMessage variant="placeholder">
            <strong>Connect a wallet.</strong> Code registration and ownership reads require a connected address.
          </StatusMessage>
        )}

        {isConnected && hasRegistered && (
          <StatusMessage variant="muted">
            <strong>This wallet has a code.</strong> The contract stores a hash, not the plaintext. This page saves your
            string in local storage when you register here so you can copy links; the chain cannot return the string later.
          </StatusMessage>
        )}

        {isConnected && hasRegistered && displayCode && referLinks && (
          <div className="data-panel data-panel--stack" style={{ marginTop: "1rem" }}>
            <h4 className="h-panel">Your share links</h4>
            <div aria-live="polite" aria-atomic="true" data-testid="referrals-copy-feedback-region">
              {copyBanner?.variant === "success" ? (
                <p
                  role="status"
                  data-testid="referrals-copy-feedback"
                  className="status-pill status-pill--success"
                  style={{ marginTop: "0.65rem", marginBottom: 0 }}
                >
                  {copyBanner.text}
                </p>
              ) : copyBanner?.variant === "error" ? (
                <div data-testid="referrals-copy-feedback" style={{ marginTop: "0.65rem" }}>
                  <StatusMessage variant="error">{copyBanner.text}</StatusMessage>
                </div>
              ) : null}
            </div>
            <p className="muted" style={{ marginTop: copyBanner ? "0.5rem" : 0 }}>
              These routes also store the code as a pending referral for new visitors.
            </p>
            {(
              [
                ["TimeCurve path", referLinks.timecurve],
                ["Query string", referLinks.query],
              ] as const
            ).map(([label, url]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <code className="code-inline" style={{ flex: "1 1 220px" }}>
                  {url}
                </code>
                <button
                  type="button"
                  className="btn-ghost cursor-copy"
                  onClick={() => copy(label, url)}
                  disabled={!origin}
                >
                  {copied === label ? "Copied!" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        )}

        {isConnected && hasRegistered && !displayCode && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            This wallet owns a code on-chain, but the plaintext is not in this browser. If you know the string, you can
            still share <code>…/?ref=yourcode</code> — the TimeCurve buy flow hashes it the same way as the registry.
          </p>
        )}

        {isConnected && !hasRegistered && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {burnWad !== undefined && cl8yToken && (
              <p className="muted" style={{ marginTop: 0 }}>
                Burn per registration:{" "}
                <strong>
                  <AmountDisplay raw={burnWad.toString()} decimals={18} />
                </strong>{" "}
                CL8Y
              </p>
            )}
            <p
              className="muted"
              style={{ marginTop: burnWad !== undefined ? "0.5rem" : 0 }}
              data-testid="referrals-register-ordering-disclosure"
            >
              Desirable codes are not “held” while your transaction waits: whoever gets the{" "}
              <strong>first successful on-chain registration</strong> wins the slug. Codes are visible in public
              mempool calldata, so others may compete for inclusion order. Submitting confirms you accept{" "}
              <strong>on-chain ordering</strong> and this{" "}
              <strong>{burnWad !== undefined ? "published burn" : "CL8Y burn"}</strong>.
            </p>
            <div className="form-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="form-label" style={{ flex: "1 1 200px" }} htmlFor="ref-register-code">
                New code
                <input
                  id="ref-register-code"
                  className="form-input"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="e.g. luck777"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                onClick={onRegister}
                disabled={chainMismatchForWrites || isWritePending || !codeInput.trim()}
              >
                {isWritePending ? "Confirm in wallet…" : "Register & burn CL8Y"}
              </button>
            </div>
            {formErr && <StatusMessage variant="error">Could not register: {formErr}</StatusMessage>}
          </div>
        )}
      </PageSection>
      </ChainMismatchWriteBarrier>
    </div>
  );
}
