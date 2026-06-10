// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { ArenaXpHero } from "@/components/ArenaXpHero";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { PageSection } from "@/components/ui/PageSection";
import { useArenaPlayCred } from "@/hooks/useArenaPlayCred";
import { timeArenaReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { canClaimCred, claimableCredEpoch } from "@/lib/arenaCharmCredClaim";
import type { SerializableContractRead } from "@/lib/serializeContractRead";
import { statFromContractRead } from "@/lib/statDisplayFromContractRead";

const ARENA_CHARM_CRED_STAT_SIGFIGS = 3;

function wadStat(
  read: SerializableContractRead | undefined,
  ctx: { isPending: boolean; isConnected: boolean },
  options: { requireWallet?: boolean; labels?: { loading?: string; missing?: string; connect?: string } },
): ReactNode {
  return statFromContractRead(read, ctx, {
    requireWallet: options.requireWallet,
    labels: options.labels,
    mapSuccess: (raw) => (
      <AmountDisplay raw={raw} decimals={18} sigfigs={ARENA_CHARM_CRED_STAT_SIGFIGS} />
    ),
  });
}

type CharmCredRowProps = {
  label: string;
  title?: string;
  testId: string;
  children: ReactNode;
};

function CharmCredRow({ label, title, testId, children }: CharmCredRowProps) {
  return (
    <div className="arena-charm-cred-card__row" title={title}>
      <span className="arena-charm-cred-card__label">{label}</span>
      <span className="arena-charm-cred-card__value" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}

export function ArenaCharmCredCard() {
  const { address, isConnected } = useAccount();
  const arena = addresses.timeArena;

  const {
    data: currentEpoch,
    isPending: epochPending,
    isFetching: epochFetching,
  } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "lastBuyEpoch",
    query: { enabled: Boolean(arena) },
  });

  const claimEpoch = claimableCredEpoch(currentEpoch);

  const charmReadEnabled = Boolean(arena && address && currentEpoch !== undefined);
  const {
    data: charm,
    isPending: charmPending,
    isFetching: charmFetching,
  } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "epochCharmWad",
    args: currentEpoch !== undefined && address ? [currentEpoch, address] : undefined,
    query: { enabled: charmReadEnabled },
  });

  const accruingReadEnabled = Boolean(arena && address && currentEpoch !== undefined);
  const {
    data: accruingPending,
    isPending: accruingPendingLoading,
    isFetching: accruingFetching,
  } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "pendingCred",
    args: currentEpoch !== undefined && address ? [address, currentEpoch] : undefined,
    query: { enabled: accruingReadEnabled },
  });

  const claimReadEnabled = Boolean(arena && address && claimEpoch !== undefined);
  const {
    data: claimPending,
    isPending: claimPendingLoading,
    isFetching: claimPendingFetching,
  } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "pendingCred",
    args: claimEpoch !== undefined && address ? [address, claimEpoch] : undefined,
    query: { enabled: claimReadEnabled },
  });

  const { credBalanceWei, playCredConfigured } = useArenaPlayCred({
    arenaAddress: arena,
    charmWad: charm,
    enabled: Boolean(arena),
  });

  const { writeContractAsync, isPending: claimWritePending } = useWriteContract();

  const readCtx = {
    isPending:
      epochPending ||
      epochFetching ||
      charmPending ||
      charmFetching ||
      accruingPendingLoading ||
      accruingFetching ||
      claimPendingLoading ||
      claimPendingFetching,
    isConnected,
  };

  const charmRead: SerializableContractRead | undefined =
    charm !== undefined ? { status: "success", result: charm.toString() } : undefined;

  const accruingRead: SerializableContractRead | undefined =
    accruingPending !== undefined ? { status: "success", result: accruingPending.toString() } : undefined;

  const balanceRead: SerializableContractRead | undefined =
    credBalanceWei !== undefined ? { status: "success", result: credBalanceWei.toString() } : undefined;

  const balanceCtx = {
    ...readCtx,
    isPending: readCtx.isPending || (isConnected && playCredConfigured && credBalanceWei === undefined),
  };

  const claimReady = canClaimCred({
    address,
    claimEpoch,
    claimPending,
  });

  if (!arena) {
    return (
      <PageSection
        title="YOUR WALLET"
        dataTestId="arena-charm-cred-card"
        className="arena-charm-cred-card"
      >
        <p className="muted">Time Arena address is not configured (VITE_TIME_ARENA_ADDRESS).</p>
      </PageSection>
    );
  }

  return (
    <PageSection
      title="YOUR WALLET"
      dataTestId="arena-charm-cred-card"
      className="arena-charm-cred-card"
    >
      <ArenaXpHero />
      <div className="arena-charm-cred-card__stats">
        <CharmCredRow
          label={
            currentEpoch !== undefined ? `CHARM Epoch ${currentEpoch.toString()}` : "CHARM Epoch —"
          }
          title="Your current Last Buy epoch CHARM weight; this is claim weight, not a leaderboard."
          testId="arena-charm-cred-charm"
        >
          {wadStat(charmRead, readCtx, {
            requireWallet: true,
            labels: {
              loading: "Loading CHARM…",
              missing: "No CHARM this epoch yet",
            },
          })}
        </CharmCredRow>
        <CharmCredRow
          label="CRED Accrual"
          title="Current active-epoch CRED preview from DOUB buys."
          testId="arena-charm-cred-pending"
        >
          {wadStat(accruingRead, readCtx, {
            requireWallet: true,
            labels: {
              loading: "Loading pending CRED…",
              missing: "No pending CRED this epoch yet",
            },
          })}
        </CharmCredRow>
        <CharmCredRow
          label="CRED Balance"
          title="Play CRED token balance in your connected wallet."
          testId="arena-charm-cred-balance"
        >
          {isConnected && !playCredConfigured ? (
            <EmptyDataPlaceholder>CRED unavailable</EmptyDataPlaceholder>
          ) : (
            wadStat(balanceRead, balanceCtx, {
              requireWallet: true,
              labels: {
                loading: "Loading CRED…",
                missing: "No CRED yet",
              },
            })
          )}
        </CharmCredRow>
      </div>
      <ChainMismatchWriteBarrier>
        <button
          type="button"
          className="btn-primary arena-charm-cred-card__claim"
          data-testid="arena-charm-cred-claim"
          disabled={!claimReady || claimWritePending || !address}
          title={
            claimReady
              ? undefined
              : claimEpoch === undefined
                ? "Claim opens after the first Last Buy epoch ends."
                : "Nothing to claim from the last ended epoch."
          }
          onClick={() => {
            if (claimEpoch === undefined) return;
            void writeContractAsync({
              address: arena,
              abi: timeArenaReadAbi,
              functionName: "claimCred",
              args: [claimEpoch],
            });
          }}
        >
          Claim CRED
        </button>
      </ChainMismatchWriteBarrier>
      {!claimReady && isConnected && claimEpoch !== undefined ? (
        <p
          className="muted arena-charm-cred-card__claim-hint"
          title={`Claim checks ended epoch ${claimEpoch.toString()}; active-epoch CRED stays locked until a Last Buy hard reset.`}
        >
          Claim after epoch end.
        </p>
      ) : null}
    </PageSection>
  );
}
