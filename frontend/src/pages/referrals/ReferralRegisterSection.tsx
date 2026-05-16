// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  erc20Abi,
  referralRegistryReadAbi,
  referralRegistryWriteAbi,
  timeCurveReadAbi,
} from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatAmountTriple, parseBigIntString } from "@/lib/formatAmount";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import { buyTokenOnKumbayaUrl } from "@/lib/kumbayaSwapUrl";
import { normalizeReferralCode } from "@/lib/referralCode";
import { validateCodeClientSide } from "@/lib/referralCodeValidation";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";
import { tryAutoRecoverReferralCodeFromIndexer } from "@/lib/referralIndexerAutoRecover";
import {
  getStoredMyReferralCodeForWallet,
  setStoredMyReferralCodeForWallet,
  subscribeMyReferralCodeCache,
} from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import {
  writeContractWithGasBuffer,
  asWriteContractAsyncFn,
} from "@/lib/writeContractWithGasBuffer";
import {
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
  assertWalletBuySessionUnchanged,
  captureWalletBuySession,
} from "@/lib/walletBuySessionGuard";
import { CL8Y_USD_PRICE_PLACEHOLDER } from "@/pages/timeCurveArena/arenaPageHelpers";
import { wagmiConfig } from "@/wagmi-config";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import {
  REFERRAL_COPY_BANNER_MS,
  REFERRAL_COPY_ERROR_REJECTED,
  REFERRAL_COPY_ERROR_UNSUPPORTED,
  REFERRAL_COPY_SUCCESS_BANNER,
} from "@/pages/referrals/referralShareCopyFeedback";
import { formatOwnerCodeHash } from "@/pages/referrals/referralAddressDisplay";

function isNonZeroBytes32(
  v: `0x${string}` | bigint | undefined,
): v is `0x${string}` | bigint {
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
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryErr, setRecoveryErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyBanner, setCopyBanner] = useState<{
    variant: "success" | "error";
    text: string;
  } | null>(null);
  const copyBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setRecoveryInput("");
    setRecoveryErr(null);
  }, [address]);

  const showCopyBanner = useCallback(
    (variant: "success" | "error", text: string) => {
      if (copyBannerTimeoutRef.current) {
        clearTimeout(copyBannerTimeoutRef.current);
        copyBannerTimeoutRef.current = null;
      }
      setCopyBanner({ variant, text });
      copyBannerTimeoutRef.current = setTimeout(() => {
        setCopyBanner(null);
        copyBannerTimeoutRef.current = null;
      }, REFERRAL_COPY_BANNER_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (copyBannerTimeoutRef.current) {
        clearTimeout(copyBannerTimeoutRef.current);
      }
    };
  }, []);

  const tc = addresses.timeCurve;
  const { data: pricePerCharmWad } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "currentPricePerCharmWad",
    query: { enabled: Boolean(tc), refetchInterval: 20_000 },
  });
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
    if (
      regFromTimeCurve &&
      regFromTimeCurve !== "0x0000000000000000000000000000000000000000"
    ) {
      return regFromTimeCurve as `0x${string}`;
    }
    return undefined;
  }, [regFromTimeCurve]);

  const { data: bundle } = useReadContracts({
    contracts: registry
      ? [
          {
            address: registry,
            abi: referralRegistryReadAbi,
            functionName: "cl8yToken",
          },
          {
            address: registry,
            abi: referralRegistryReadAbi,
            functionName: "registrationBurnAmount",
          },
        ]
      : [],
    query: { enabled: Boolean(registry), refetchInterval: 20_000 },
  });

  const cl8yToken =
    bundle?.[0]?.status === "success"
      ? (bundle[0].result as `0x${string}`)
      : undefined;
  const burnWad =
    bundle?.[1]?.status === "success"
      ? (bundle[1].result as bigint)
      : undefined;

  const registerCostUsdHint = useMemo((): {
    text: string;
    title: string;
  } | null => {
    if (burnWad === undefined) return null;
    const raw = pricePerCharmWad;
    const p = raw == null ? undefined : BigInt(raw);
    const hasSaleCl8yPrice = p !== undefined && p > 0n;
    if (hasSaleCl8yPrice) {
      const usdmWei = fallbackPayTokenWeiForCl8y(burnWad, "usdm");
      const compact = formatCompactFromRaw(usdmWei.toString(), 18, {
        sigfigs: 3,
      });
      return {
        text: `≈ $${compact} USD`,
        title: SIMPLE_PODIUM_USD_EQUIV_TITLE,
      };
    }
    const human = Number(
      formatAmountTriple(parseBigIntString(burnWad.toString()), 18).decimal,
    );
    const usd = (human * CL8Y_USD_PRICE_PLACEHOLDER).toFixed(2);
    return {
      text: `≈ $${usd} USD`,
      title:
        "USD shows 1 CL8Y = 1 USD when the TimeCurve sale price (`currentPricePerCharmWad`) is unavailable; not a live oracle. The CL8Y line above is the onchain registration burn.",
    };
  }, [burnWad, pricePerCharmWad]);

  const { data: ownerCodeHash, refetch: refetchOwner } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "ownerCode",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(registry && address) },
  });

  const hasRegistered = isNonZeroBytes32(
    ownerCodeHash as `0x${string}` | bigint | undefined,
  );

  const storedCode = useSyncExternalStore(
    subscribeMyReferralCodeCache,
    () => getStoredMyReferralCodeForWallet(address),
    () => getStoredMyReferralCodeForWallet(address),
  );

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
    (hashForStored as string).toLowerCase() ===
      (ownerCodeHash as string).toLowerCase(),
  );

  useEffect(() => {
    if (
      !address ||
      !registry ||
      !hasRegistered ||
      chainMismatchForWrites ||
      ownerCodeHash === undefined ||
      storedMatchesOnchain
    ) {
      return;
    }
    void tryAutoRecoverReferralCodeFromIndexer({
      wallet: address,
      registry,
      ownerCodeHash: ownerCodeHash as `0x${string}` | bigint,
    });
  }, [
    address,
    registry,
    hasRegistered,
    chainMismatchForWrites,
    ownerCodeHash,
    storedMatchesOnchain,
  ]);

  // Pre-submit code availability check (GitLab #208).
  // Debounce the typed input so we don't spam the RPC on every keystroke; only after the user
  // pauses do we hash the code and look up codeOwner onchain to surface "available" / "taken"
  // before they spend gas on a doomed registerCode.
  const [debouncedCodeInput, setDebouncedCodeInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCodeInput(codeInput), 300);
    return () => clearTimeout(t);
  }, [codeInput]);
  const clientValidation = useMemo(
    () => validateCodeClientSide(debouncedCodeInput),
    [debouncedCodeInput],
  );
  const { data: hashForTyped } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "hashCode",
    args:
      clientValidation.kind === "ok"
        ? [clientValidation.normalized]
        : undefined,
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
    if (codeInput.trim().toLowerCase() !== clientValidation.normalized)
      return { kind: "checking" };
    if (!hashForTyped || ownerOfTyped === undefined)
      return { kind: "checking" };
    if (isCheckingOwner) return { kind: "checking" };
    const ownerStr = (ownerOfTyped as string)?.toLowerCase() ?? "";
    if (ownerStr === "0x0000000000000000000000000000000000000000")
      return { kind: "available" };
    return { kind: "taken" };
  }, [
    clientValidation,
    codeInput,
    hashForTyped,
    ownerOfTyped,
    isCheckingOwner,
  ]);

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
      const guardSession = () =>
        assertWalletBuySessionUnchanged(wagmiConfig, sessionSnapshot);

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
  }, [
    address,
    burnWad,
    chainId,
    cl8yToken,
    codeInput,
    refetchOwner,
    registry,
    writeContractAsync,
  ]);

  const onRecoverCode = useCallback(async () => {
    setRecoveryErr(null);
    if (!registry || !address || ownerCodeHash === undefined) {
      setRecoveryErr("Referral registry is not available.");
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeReferralCode(recoveryInput);
    } catch (e) {
      setRecoveryErr(e instanceof Error ? e.message : "Invalid referral code.");
      return;
    }
    if (isReferralSlugReservedForRouting(normalized)) {
      setRecoveryErr(
        "That string is reserved for app routes (for example arena or protocol paths) and cannot be a referral code.",
      );
      return;
    }
    try {
      const h = await readContract(wagmiConfig, {
        address: registry,
        abi: referralRegistryReadAbi,
        functionName: "hashCode",
        args: [normalized],
      });
      const onChain = formatOwnerCodeHash(
        ownerCodeHash as `0x${string}` | bigint,
      );
      const derived = (h as string).toLowerCase();
      if (derived !== onChain.toLowerCase()) {
        setRecoveryErr(
          "That code does not match this wallet’s on-chain registration.",
        );
        return;
      }
      setStoredMyReferralCodeForWallet(address as `0x${string}`, normalized);
      setRecoveryInput("");
    } catch (e) {
      setRecoveryErr(friendlyRevertFromUnknown(e));
    }
  }, [address, ownerCodeHash, recoveryInput, registry]);

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
          <strong>No registry address.</strong> The app cannot read{" "}
          <code>ReferralRegistry</code> until deployment env is wired.
        </StatusMessage>
      </PageSection>
    );
  }

  return (
    <div className={className ?? ""}>
      <ChainMismatchWriteBarrier testId="referrals-register-chain-write-gate">
        <PageSection
          title={
            isConnected && hasRegistered
              ? "Your guide code claimed!"
              : "Claim your guide code"
          }
          lede={
            isConnected && hasRegistered
              ? undefined
              : "Choose the name people will see in your share link. Codes use 3–16 letters or digits and are stored as lowercase."
          }
        >
          {!isConnected && (
            <StatusMessage variant="placeholder">
              <strong>Connect a wallet.</strong> Code registration and ownership
              reads require a connected address.
            </StatusMessage>
          )}

          {isConnected && hasRegistered && (
            <div
              className="referrals-claimed-code-block"
              style={{ marginTop: "0.5rem" }}
            >
              {displayCode ? (
                <p style={{ marginBottom: "0.75rem" }}>
                  <span className="muted">Your code: </span>
                  <code
                    className="code-inline"
                    data-testid="referrals-claimed-code"
                  >
                    {displayCode}
                  </code>
                </p>
              ) : (
                <>
                  <p style={{ marginBottom: "0.5rem" }}>
                    <span className="muted">On-chain code hash: </span>
                    <code
                      className="code-inline"
                      data-testid="referrals-claimed-hash"
                      style={{ wordBreak: "break-all" }}
                    >
                      {ownerCodeHash !== undefined
                        ? formatOwnerCodeHash(
                            ownerCodeHash as `0x${string}` | bigint,
                          )
                        : "—"}
                    </code>
                  </p>
                  <div
                    className="form-row"
                    style={{ marginTop: "0.75rem", flexWrap: "wrap" }}
                  >
                    <div className="form-label" style={{ flex: "1 1 200px" }}>
                      <span>Recover your link</span>
                      <input
                        className="form-input"
                        value={recoveryInput}
                        onChange={(e) => {
                          setRecoveryInput(e.target.value);
                          setRecoveryErr(null);
                        }}
                        placeholder="Enter your registered code"
                        autoComplete="off"
                        aria-label="Recover referral code"
                        data-testid="referrals-recover-code-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => void onRecoverCode()}
                      disabled={!recoveryInput.trim()}
                      data-testid="referrals-recover-code-submit"
                    >
                      Verify & save
                    </button>
                  </div>
                  {recoveryErr ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <StatusMessage variant="error">
                        {recoveryErr}
                      </StatusMessage>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {isConnected && hasRegistered && displayCode && referLinks && (
            <div
              className="data-panel data-panel--stack referrals-share-links-panel"
              style={{ marginTop: "1rem" }}
            >
              <h4 className="h-panel">Your share links</h4>
              <div
                aria-live="polite"
                aria-atomic="true"
                data-testid="referrals-copy-feedback-region"
              >
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
                  <div
                    data-testid="referrals-copy-feedback"
                    style={{ marginTop: "0.65rem" }}
                  >
                    <StatusMessage variant="error">
                      {copyBanner.text}
                    </StatusMessage>
                  </div>
                ) : null}
              </div>
              <p
                className="muted"
                style={{ marginTop: copyBanner ? "0.5rem" : 0 }}
              >
                These routes also store the code as a pending referral for new
                visitors. When a visitor uses your link, it locks the code into
                their browser.
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

          {isConnected && !hasRegistered && (
            <div className="referrals-register-write-stack">
              {burnWad !== undefined && cl8yToken && (
                <div
                  className="referrals-register-cost"
                  aria-label="Referral registration cost"
                >
                  <span>Claim cost</span>
                  <strong data-testid="referrals-register-cost-amount">
                    {
                      formatAmountTriple(
                        parseBigIntString(burnWad.toString()),
                        18,
                      ).decimal
                    }{" "}
                    CL8Y
                  </strong>
                  {registerCostUsdHint ? (
                    <small
                      className="muted"
                      title={registerCostUsdHint.title}
                      data-testid="referrals-register-cost-usd"
                    >
                      {registerCostUsdHint.text}
                    </small>
                  ) : null}
                  <small>Burned only once on success</small>

                  <a
                    href={buyTokenOnKumbayaUrl(cl8yToken)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="external-text-link cursor-external-link"
                    data-testid="referrals-register-buy-cl8y-link"
                    aria-label="Buy CL8Y on Kumbaya (opens in new tab)"
                  >
                    <span className="external-text-link__label">
                      Buy CL8Y on Kumbaya
                    </span>
                    <svg
                      className="external-text-link__icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                      />
                    </svg>
                  </a>
                </div>
              )}
              <div className="form-row">
                <div className="form-label">
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
                  {isWritePending
                    ? "Confirm in wallet…"
                    : "Register & burn CL8Y"}
                </button>
              </div>
              {/* Pre-submit availability indicator — GitLab #208 */}
              {codeInput.trim() && codeAvailability.kind === "checking" && (
                <small
                  className="muted"
                  data-testid="referrals-code-status-checking"
                >
                  Checking availability…
                </small>
              )}
              {codeAvailability.kind === "available" && (
                <small
                  style={{ color: "var(--color-success, #2e7d32)" }}
                  data-testid="referrals-code-status-available"
                >
                  Code is available.
                </small>
              )}
              {codeAvailability.kind === "taken" && (
                <small
                  style={{ color: "var(--color-warning, #b58400)" }}
                  data-testid="referrals-code-status-taken"
                >
                  That code is already registered — pick another.
                </small>
              )}
              {codeAvailability.kind === "invalid-length" && (
                <small
                  style={{ color: "var(--color-warning, #b58400)" }}
                  data-testid="referrals-code-status-invalid-length"
                >
                  Code must be 3–16 characters.
                </small>
              )}
              {codeAvailability.kind === "invalid-charset" && (
                <small
                  style={{ color: "var(--color-warning, #b58400)" }}
                  data-testid="referrals-code-status-invalid-charset"
                >
                  Code may only use letters (a–z) and digits (0–9).
                </small>
              )}
              {formErr && (
                <StatusMessage variant="error">
                  Could not register: {formErr}
                </StatusMessage>
              )}
            </div>
          )}
        </PageSection>
      </ChainMismatchWriteBarrier>
    </div>
  );
}
