// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { PageSection } from "@/components/ui/PageSection";
import { timeArenaReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { canClaimCred, claimableCredEpoch } from "@/lib/arenaCharmCredClaim";
import type { SerializableContractRead } from "@/lib/serializeContractRead";
import { statFromContractRead } from "@/lib/statDisplayFromContractRead";

function wadStat(
  read: SerializableContractRead | undefined,
  ctx: { isPending: boolean; isConnected: boolean },
  options: { requireWallet?: boolean; labels?: { loading?: string; missing?: string; connect?: string } },
): ReactNode {
  return statFromContractRead(read, ctx, {
    requireWallet: options.requireWallet,
    labels: options.labels,
    mapSuccess: (raw) => <AmountDisplay raw={raw} decimals={18} />,
  });
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

  const epochRead: SerializableContractRead | undefined =
    currentEpoch !== undefined ? { status: "success", result: currentEpoch.toString() } : undefined;

  const charmRead: SerializableContractRead | undefined =
    charm !== undefined ? { status: "success", result: charm.toString() } : undefined;

  const accruingRead: SerializableContractRead | undefined =
    accruingPending !== undefined ? { status: "success", result: accruingPending.toString() } : undefined;

  const claimableRead: SerializableContractRead | undefined =
    claimPending !== undefined && claimPending > 0n
      ? { status: "success", result: claimPending.toString() }
      : undefined;

  const claimReady = canClaimCred({
    address,
    claimEpoch,
    claimPending,
  });

  if (!arena) {
    return (
      <PageSection
        title="Epoch CHARM/CRED"
        dataTestId="arena-charm-cred-card"
        className="arena-charm-cred-card"
      >
        <p className="muted">Time Arena address is not configured (VITE_TIME_ARENA_ADDRESS).</p>
      </PageSection>
    );
  }

  return (
    <PageSection
      title="Epoch CHARM/CRED"
      dataTestId="arena-charm-cred-card"
      className="arena-charm-cred-card"
    >
      <p title="CHARM/CRED accrual follows Last Buy epochs; claim only after an epoch ends.">
        Epoch:{" "}
        <strong data-testid="arena-charm-cred-epoch">
          {statFromContractRead(epochRead, readCtx, {
            mapSuccess: (raw) => raw,
            labels: { loading: "Loading epoch…", missing: "No epoch yet" },
          })}
        </strong>
      </p>
      <p title="Your current Last Buy epoch CHARM weight; this is claim weight, not a leaderboard.">
        CHARM weight:{" "}
        <strong data-testid="arena-charm-cred-charm">
          {wadStat(charmRead, readCtx, {
            requireWallet: true,
            labels: {
              loading: "Loading CHARM…",
              missing: "No CHARM this epoch yet",
              connect: "Connect a wallet to see epoch CHARM.",
            },
          })}
        </strong>
      </p>
      <p title="Current active-epoch CRED preview from DOUB buys.">
        Accruing CRED:{" "}
        <strong data-testid="arena-charm-cred-pending">
          {wadStat(accruingRead, readCtx, {
            requireWallet: true,
            labels: {
              loading: "Loading pending CRED…",
              missing: "No pending CRED this epoch yet",
              connect: "Connect a wallet to see pending CRED.",
            },
          })}
        </strong>
      </p>
      {claimEpoch !== undefined ? (
        <p>
          Claimable CRED:{" "}
          <strong data-testid="arena-charm-cred-claimable">
            {wadStat(claimableRead, readCtx, {
              requireWallet: true,
              labels: {
                loading: "Loading claimable CRED…",
                missing: "Nothing to claim from last epoch",
                connect: "Connect a wallet to see claimable CRED.",
              },
            })}
          </strong>
        </p>
      ) : null}
      <ChainMismatchWriteBarrier>
        <button
          type="button"
          className="btn btn--primary"
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
