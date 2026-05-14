// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { buyTokenOnKumbayaUrl } from "@/lib/kumbayaSwapUrl";
import { CL8Y_USD_PRICE_PLACEHOLDER } from "@/pages/timeCurveArena/arenaPageHelpers";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { erc20Abi, referralRegistryReadAbi, referralRegistryWriteAbi, timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { formatAmountTriple, formatBpsAsPercent, parseBigIntString } from "@/lib/formatAmount";
import { normalizeReferralCode } from "@/lib/referralCode";
import { validateCodeClientSide } from "@/lib/referralCodeValidation";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";
import {
  getStoredMyReferralCodeForWallet,
  setStoredMyReferralCodeForWallet,
} from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import {
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
  assertWalletBuySessionUnchanged,
  captureWalletBuySession,
} from "@/lib/walletBuySessionGuard";
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

  // Pre-submit code availability check (GitLab #208).
  // Debounce the typed input so we don't spam the RPC on every keystroke; only after the user
  // pauses do we hash the code and look up codeOwner onchain to surface "available" / "taken"
  // before they spend gas on a doomed registerCode.
  const [debouncedCodeInput, setDebouncedCodeInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCodeInput(codeInput), 300);
    return () => clearTimeout(t);
  }, [codeInput]);
  const clientValidation = useMemo(() => validateCodeClientSide(debouncedCodeInput), [debouncedCodeInput]);
  const { data: hashForTyped } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "hashCode",
    args: clientValidation.kind === "ok" ? [clientValidation.normalized] : undefined,
    query: { enabled: Boolean(registry && clientValidation.kind === "ok") },
  });
  const { data: ownerOfTyped, isFetching: isCheckingOwner } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "ownerOfCode",
    args: hashForTyped ? [hashForTyped as `0x${string}`] : undefined,
    query: { enabled: Boolean(registry && hashForTyped) },
  });
  type CodeAvailability =
    | { kind: "empty" }
    | { kind: "invalid-length" }
    | { kind: "invalid-charset" }
    | { kind: "checking" }
    | { kind: "available" }
    | { kind: "taken" };
  const codeAvailability = useMemo<CodeAvailability>(() => {
    if (clientValidation.kind !== "ok") return { kind: clientValidation.kind };
    if (codeInput.trim().toLowerCase() !== clientValidation.normalized) return { kind: "checking" };
    if (!hashForTyped || ownerOfTyped === undefined) return { kind: "checking" };
    if (isCheckingOwner) return { kind: "checking" };
    const ownerStr = (ownerOfTyped as string)?.toLowerCase() ?? "";
    if (ownerStr === "0x0000000000000000000000000000000000000000") return { kind: "available" };
    return { kind: "taken" };
  }, [clientValidation, codeInput, hashForTyped, ownerOfTyped, isCheckingOwner]);

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
      const sessionSnapshot = captureWalletBuySession(wagmiConfig);
      if (
        !sessionSnapshot ||
        sessionSnapshot.address.toLowerCase() !== address.toLowerCase() ||
        sessionSnapshot.chainId !== chainId
      ) {
        setFormErr(WALLET_BUY_SESSION_DRIFT_MESSAGE);
        return;
      }
      const guardSession = () => assertWalletBuySessionUnchanged(wagmiConfig, sessionSnapshot);

      const need = burnWad;
      const allow = await readContract(wagmiConfig, {
        address: cl8yToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [sessionSnapshot.address, registry],
      });
      guardSession();
      if (allow < need) {
        const { hash: approveHash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
          address: cl8yToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [registry, need],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        guardSession();
      }
      guardSession();
      const { hash: regHash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: registry,
        abi: referralRegistryWriteAbi,
        functionName: "registerCode",
        args: [normalized],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: regHash });
      guardSession();
      setStoredMyReferralCodeForWallet(sessionSnapshot.address, normalized);
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
        title="How the bonus works"
        badgeLabel="On-chain"
        badgeTone="live"
        lede="A referred TimeCurve buy gives extra CHARM weight to both people. It is not a wallet payout, and the contract math is the source of truth."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {tc && refEachBps !== undefined ? (
            <>
              Current per-side bonus: <strong>{formatBpsAsPercent(Number(refEachBps))}</strong> extra CHARM weight
              for the buyer and <strong>{formatBpsAsPercent(Number(refEachBps))}</strong> extra CHARM weight for the
              referrer.
            </>
          ) : (
            <>Connect this build to TimeCurve to show the live referral bonus.</>
          )}
        </p>
      </PageSection>

      <ChainMismatchWriteBarrier testId="referrals-register-chain-write-gate">
      <PageSection
        title="Claim your guide code"
        badgeLabel="CL8Y burn"
        badgeTone="warning"
        lede="Choose the name people will see in your share link. Codes use 3–16 letters or digits and are stored as lowercase."
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
              <div className="referrals-register-cost" aria-label="Referral registration cost">
                <span>Claim cost</span>
                <strong data-testid="referrals-register-cost-amount">
                  {formatAmountTriple(parseBigIntString(burnWad.toString()), 18).decimal} CL8Y
                </strong>
                {/*
                  USD figure uses the existing illustrative placeholder pattern
                  (CL8Y_USD_PRICE_PLACEHOLDER = 1, same as Arena hero "TOTAL USD"),
                  not a live oracle. See GitLab #192 disclosure pattern. Tooltip
                  clarifies it is not live FX.
                */}
                <small
                  className="muted"
                  title="USD shape uses a fixed illustrative placeholder (1 CL8Y = 1 USD), not a live oracle. CL8Y amount is the onchain figure."
                  data-testid="referrals-register-cost-usd"
                >
                  &asymp; ${(Number(formatAmountTriple(parseBigIntString(burnWad.toString()), 18).decimal) * CL8Y_USD_PRICE_PLACEHOLDER).toFixed(2)} USD &middot; illustrative
                </small>
                <small>Burned only if the registration succeeds.</small>
                
                <a href={buyTokenOnKumbayaUrl(cl8yToken)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="footer-link-pill"
                  data-testid="referrals-register-buy-cl8y-link"
                  style={{ marginTop: "0.25rem", alignSelf: "flex-start" }}
                >
                  Buy CL8Y on Kumbaya
                </a>
              </div>
            )}
            <p
              className="muted referrals-register-disclosure"
              style={{ marginTop: burnWad !== undefined ? "0.5rem" : 0 }}
              data-testid="referrals-register-ordering-disclosure"
            >
              Code claims are public and competitive. Desirable codes are not held while your transaction waits:
              whoever gets the{" "}
              <strong>first successful on-chain registration</strong> wins the slug. Codes are visible in public
              mempool calldata, so others may compete for inclusion order.
            </p>
            <div className="form-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-label" style={{ flex: "1 1 200px" }}>
                <span>New code</span>
                <input
                  className="form-input"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="e.g. luck777"
                  autoComplete="off"
                  aria-label="New code"
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={onRegister}
                disabled={
                  chainMismatchForWrites ||
                  isWritePending ||
                  !codeInput.trim() ||
                  codeAvailability.kind === "taken" ||
                  codeAvailability.kind === "invalid-length" ||
                  codeAvailability.kind === "invalid-charset"
                }
              >
                {isWritePending ? "Confirm in wallet…" : "Register & burn CL8Y"}
              </button>
            </div>
            {/* Pre-submit availability indicator — GitLab #208 */}
            {codeInput.trim() && codeAvailability.kind === "checking" && (
              <small className="muted" data-testid="referrals-code-status-checking">
                Checking availability…
              </small>
            )}
            {codeAvailability.kind === "available" && (
              <small style={{ color: "var(--color-success, #2e7d32)" }} data-testid="referrals-code-status-available">
                Code is available.
              </small>
            )}
            {codeAvailability.kind === "taken" && (
              <small style={{ color: "var(--color-warning, #b58400)" }} data-testid="referrals-code-status-taken">
                That code is already registered — pick another.
              </small>
            )}
            {codeAvailability.kind === "invalid-length" && (
              <small style={{ color: "var(--color-warning, #b58400)" }} data-testid="referrals-code-status-invalid-length">
                Code must be 3–16 characters.
              </small>
            )}
            {codeAvailability.kind === "invalid-charset" && (
              <small style={{ color: "var(--color-warning, #b58400)" }} data-testid="referrals-code-status-invalid-charset">
                Code may only use letters (a–z) and digits (0–9).
              </small>
            )}
            {formErr && <StatusMessage variant="error">Could not register: {formErr}</StatusMessage>}
          </div>
        )}
      </PageSection>
      </ChainMismatchWriteBarrier>
    </div>
  );
}
