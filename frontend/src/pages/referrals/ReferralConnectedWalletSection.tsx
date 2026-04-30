// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { referralRegistryReadAbi, timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { getStoredMyReferralCodeForWallet } from "@/lib/referralStorage";
import { truncateHexAddress } from "@/pages/referrals/referralAddressDisplay";

function isNonZeroBytes32(v: `0x${string}` | bigint | undefined): boolean {
  if (v === undefined) {
    return false;
  }
  if (typeof v === "bigint") {
    return v !== 0n;
  }
  return BigInt(v) !== 0n;
}

/**
 * Single **wagmi** connection today — one `address`. Multi-account wallets still
 * surface one active address at a time; switching accounts updates this panel.
 */
export function ReferralConnectedWalletSection() {
  const { address, isConnected } = useAccount();
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

  const { data: ownerCodeHash } = useReadContract({
    address: registry,
    abi: referralRegistryReadAbi,
    functionName: "ownerCode",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(registry && address) },
  });

  const storedCode = getStoredMyReferralCodeForWallet(address);

  const { data: hashBundle } = useReadContracts({
    contracts:
      registry && storedCode
        ? [{ address: registry, abi: referralRegistryReadAbi, functionName: "hashCode", args: [storedCode] }]
        : [],
    query: { enabled: Boolean(registry && storedCode) },
  });

  const hashForStored =
    hashBundle?.[0]?.status === "success" ? (hashBundle[0].result as `0x${string}`) : undefined;

  const hasRegistered = isNonZeroBytes32(ownerCodeHash as `0x${string}` | bigint | undefined);

  const storedMatchesOnchain = Boolean(
    hasRegistered &&
      storedCode &&
      hashForStored &&
      ownerCodeHash &&
      (hashForStored as string).toLowerCase() === (ownerCodeHash as string).toLowerCase(),
  );

  const displayCode = storedMatchesOnchain && storedCode ? storedCode : null;

  return (
    <PageSection
      title="Connected wallet"
      badgeLabel="ReferralRegistry"
      badgeTone="live"
      lede="On-chain `ownerCode` is authoritative; plaintext share strings live in this browser only when you registered here (see storage keys in the section below)."
    >
      {!isConnected || !address ? (
        <StatusMessage variant="placeholder">
          <strong>Connect a wallet</strong> to see registration state for the active address.
        </StatusMessage>
      ) : !registry ? (
        <StatusMessage variant="placeholder">Referral registry is not configured for this build.</StatusMessage>
      ) : (
        <div className="data-panel data-panel--stack" data-testid="referrals-connected-wallet">
          <p className="data-panel__label">Active address</p>
          <p className="mono" title={address}>
            {truncateHexAddress(address, 8, 6)}
          </p>
          <p className="data-panel__label" style={{ marginTop: "1rem" }}>
            Registration
          </p>
          {!hasRegistered ? (
            <StatusMessage variant="muted">
              <strong>Not registered</strong> — use <strong>Register a code</strong> below to burn CL8Y and claim a
              code on-chain.
            </StatusMessage>
          ) : displayCode ? (
            <p style={{ margin: 0 }}>
              <strong>Registered code:</strong> <code className="code-inline">{displayCode}</code>
            </p>
          ) : (
            <StatusMessage variant="muted">
              This wallet has a code on-chain (hash only). Plaintext is unavailable in this browser until you
              re-register from here or paste the known string into share links manually.
            </StatusMessage>
          )}
        </div>
      )}
    </PageSection>
  );
}
