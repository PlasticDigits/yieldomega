// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";
import { doubPresaleVestingReadAbi, doubPresaleVestingWriteAbi } from "@/lib/abis";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { wagmiConfig } from "@/wagmi-config";
import { dualWallClockLines, formatDoubHuman } from "@/pages/presaleVesting/presaleVestingFormat";
import { usePresaleVestingChainWriteEffects } from "@/pages/presaleVesting/usePresaleVestingChainWriteEffects";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";

export function PresaleVestingPage() {
  const vesting = addresses.doubPresaleVesting;
  const { address: wallet } = useAccount();
  const chainId = useChainId();
  const { mismatch: chainMismatchForWrites } = useWalletTargetChainMismatch();
  const [claimGateError, setClaimGateError] = useState<string | null>(null);

  const qCommon = { address: vesting, abi: doubPresaleVestingReadAbi, query: { enabled: !!vesting } } as const;

  const { data: tokenAddr, refetch: refetchToken } = useReadContract({
    ...qCommon,
    functionName: "token",
  });
  const { data: totalAllocated, refetch: refetchTotal } = useReadContract({
    ...qCommon,
    functionName: "totalAllocated",
  });
  const { data: vestingDuration, refetch: refetchDur } = useReadContract({
    ...qCommon,
    functionName: "vestingDuration",
  });
  const { data: vestingStart, refetch: refetchStart } = useReadContract({
    ...qCommon,
    functionName: "vestingStart",
  });
  const { data: claimsEnabled, refetch: refetchClaimsFlag } = useReadContract({
    ...qCommon,
    functionName: "claimsEnabled",
  });

  const qWallet = { ...qCommon, query: { enabled: !!vesting && !!wallet } } as const;

  const { data: allocation, refetch: refetchAlloc } = useReadContract({
    ...qWallet,
    functionName: "allocationOf",
    args: wallet ? [wallet] : undefined,
  });
  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    ...qWallet,
    functionName: "claimedOf",
    args: wallet ? [wallet] : undefined,
  });
  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    ...qWallet,
    functionName: "claimable",
    args: wallet ? [wallet] : undefined,
  });
  const { data: isBen, refetch: refetchIsBen } = useReadContract({
    ...qWallet,
    functionName: "isBeneficiary",
    args: wallet ? [wallet] : undefined,
  });

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchToken(),
      refetchTotal(),
      refetchDur(),
      refetchStart(),
      refetchClaimsFlag(),
      refetchAlloc(),
      refetchClaimed(),
      refetchClaimable(),
      refetchIsBen(),
    ]);
  }, [
    refetchAlloc,
    refetchClaimable,
    refetchClaimed,
    refetchClaimsFlag,
    refetchDur,
    refetchIsBen,
    refetchStart,
    refetchToken,
    refetchTotal,
  ]);

  const { writeContractAsync, data: claimHash, isPending: claimSubmitting, error: claimError, reset: resetWrite } =
    useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  useEffect(() => {
    if (claimSuccess) {
      setClaimGateError(null);
      void refetchAll();
      resetWrite();
    }
  }, [claimSuccess, refetchAll, resetWrite]);

  usePresaleVestingChainWriteEffects({
    chainId,
    writeContractError: claimError,
    resetWrite,
    setClaimGateError,
  });

  if (!vesting) {
    return (
      <section className="page" data-testid="presale-vesting-surface">
        <PageHero
          title="Presale vesting"
          badgeLabel="DOUB"
          badgeTone="soon"
          coinSrc="/art/token-logo.png"
          sceneSrc="/art/scenes/timecurve-protocol.jpg"
          lede="This route is for presale participants with a deployed DoubPresaleVesting allocation. Set VITE_DOUB_PRESALE_VESTING_ADDRESS at build time (see frontend/.env.example). Local stacks write it from DeployDev via scripts/start-local-anvil-stack.sh."
        />
        <PageSection title="Unconfigured" badgeLabel="Env" badgeTone="info" lede="">
          <StatusMessage variant="error">
            <code>VITE_DOUB_PRESALE_VESTING_ADDRESS</code> is missing. Deploy with{" "}
            <code>forge script script/DeployDev.s.sol</code> or run the local stack script, then point the Vite env at
            the logged <strong>DoubPresaleVesting</strong> proxy.
          </StatusMessage>
        </PageSection>
      </section>
    );
  }

  const vestingEndSec =
    vestingStart !== undefined &&
    vestingDuration !== undefined &&
    vestingStart > 0n &&
    vestingDuration > 0n
      ? vestingStart + vestingDuration
      : undefined;

  const scheduleStarted = vestingStart !== undefined && vestingStart > 0n;

  return (
    <section className="page" data-testid="presale-vesting-surface">
      <PageHero
        title="Presale vesting"
        badgeLabel="DOUB"
        badgeTone="live"
        coinSrc="/art/token-logo.png"
        sceneSrc="/art/scenes/timecurve-protocol.jpg"
        lede="30% vests at the schedule start (TGE); 70% vests linearly over the on-chain vesting duration (canonical production: 180 days / six months). Authority and balances are reads against DoubPresaleVesting; claims require claimsEnabled. This URL is not linked from the main nav — share it directly with presale wallets (GitLab #92)."
      />
      <PageSection
        title="Contract schedule"
        badgeLabel="On-chain"
        badgeTone="info"
        lede="Numbers below are live contract reads. DOUB token address comes from vesting.token()."
      >
        <dl className="kv-deflist">
          <dt>Vesting contract</dt>
          <dd>
            <code>{vesting}</code>
          </dd>
          {tokenAddr !== undefined ? (
            <>
              <dt>DOUB token</dt>
              <dd>
                <code>{tokenAddr}</code>
              </dd>
            </>
          ) : null}
          {totalAllocated !== undefined ? (
            <>
              <dt>Total allocated (all beneficiaries)</dt>
              <dd>
                {formatDoubHuman(totalAllocated)} DOUB
              </dd>
            </>
          ) : null}
          {vestingDuration !== undefined ? (
            <>
              <dt>Linear tranche duration</dt>
              <dd>{vestingDuration.toString()} s (~{(Number(vestingDuration) / 86_400).toFixed(1)} days)</dd>
            </>
          ) : null}
          {claimsEnabled !== undefined ? (
            <>
              <dt>Claims enabled</dt>
              <dd>{claimsEnabled ? "Yes" : "No — claim() reverts until the owner sets claimsEnabled (issue #55)"}</dd>
            </>
          ) : null}
        </dl>
        <p className="muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
          In production, operational sign-off controls <code>setClaimsEnabled</code> separately from the vesting clock —
          see docs/operations/final-signoff-and-value-movement.md.
        </p>
      </PageSection>

      <PageSection
        title="Vesting clock"
        badgeLabel="UTC + local"
        badgeTone="soon"
        lede="Start is vestingStart; full linear unlock is vestingStart + vestingDuration."
      >
        {!scheduleStarted ? (
          <StatusMessage variant="muted">Vesting has not started yet (vestingStart is zero on-chain).</StatusMessage>
        ) : (
          <div className="data-panel data-panel--stack">
            {vestingStart !== undefined ? (
              <>
                <p className="data-panel__label">Schedule start (TGE cliff)</p>
                <p>
                  <strong>Local:</strong> {dualWallClockLines(vestingStart).local}
                </p>
                <p>
                  <strong>UTC:</strong> {dualWallClockLines(vestingStart).utc}
                </p>
              </>
            ) : null}
            {vestingEndSec !== undefined ? (
              <>
                <p className="data-panel__label" style={{ marginTop: "1rem" }}>
                  Full allocation vested by
                </p>
                <p>
                  <strong>Local:</strong> {dualWallClockLines(vestingEndSec).local}
                </p>
                <p>
                  <strong>UTC:</strong> {dualWallClockLines(vestingEndSec).utc}
                </p>
              </>
            ) : null}
          </div>
        )}
      </PageSection>

      <PageSection title="Your wallet" badgeLabel="Connected" badgeTone="live" lede="">
        {!wallet ? (
          <StatusMessage variant="muted">Connect a wallet to see allocation, claimed, and claimable amounts.</StatusMessage>
        ) : isBen === false ? (
          <StatusMessage variant="muted">
            This wallet is not in the vesting beneficiary set for this deployment.
          </StatusMessage>
        ) : (
          <ChainMismatchWriteBarrier testId="presale-vesting-chain-write-gate">
          <div className="data-panel data-panel--stack" data-testid="presale-vesting-wallet-panel">
            {allocation !== undefined && allocation > 0n ? (
              <>
                <p className="data-panel__label">Your allocation</p>
                <p>
                  <strong>{formatDoubHuman(allocation)}</strong> DOUB
                </p>
              </>
            ) : null}
            {claimed !== undefined ? (
              <>
                <p className="data-panel__label">Claimed to date</p>
                <p>{formatDoubHuman(claimed)} DOUB</p>
              </>
            ) : null}
            {claimable !== undefined ? (
              <>
                <p className="data-panel__label">Claimable now</p>
                <p>{formatDoubHuman(claimable)} DOUB</p>
              </>
            ) : null}
            {claimGateError ? <StatusMessage variant="error">{claimGateError}</StatusMessage> : null}
            {claimError ? (
              <StatusMessage variant="error">{friendlyRevertFromUnknown(claimError)}</StatusMessage>
            ) : null}
            <p style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  chainMismatchForWrites ||
                  !claimsEnabled ||
                  claimable === undefined ||
                  claimable === 0n ||
                  claimSubmitting ||
                  claimConfirming
                }
                onClick={async () => {
                  setClaimGateError(null);
                  const netErr = chainMismatchWriteMessage(chainId);
                  if (netErr) {
                    setClaimGateError(netErr);
                    return;
                  }
                  if (!wallet) {
                    setClaimGateError("Connect a wallet to claim.");
                    return;
                  }
                  try {
                    await writeContractWithGasBuffer({
                      wagmiConfig,
                      writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
                      account: wallet,
                      chainId,
                      address: vesting,
                      abi: doubPresaleVestingWriteAbi,
                      functionName: "claim",
                    });
                  } catch (e) {
                    setClaimGateError(friendlyRevertFromUnknown(e));
                  }
                }}
              >
                {claimSubmitting || claimConfirming ? "Confirming…" : "Claim DOUB"}
              </button>
            </p>
            {!claimsEnabled ? (
              <StatusMessage variant="muted">Claims are disabled on-chain for this deployment.</StatusMessage>
            ) : null}
            {claimable === 0n && scheduleStarted && claimsEnabled ? (
              <StatusMessage variant="muted">Nothing to claim right now.</StatusMessage>
            ) : null}
          </div>
          </ChainMismatchWriteBarrier>
        )}
      </PageSection>
    </section>
  );
}
