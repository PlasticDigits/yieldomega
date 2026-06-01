// SPDX-License-Identifier: AGPL-3.0-only

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { timeArenaReadAbi } from "@/lib/abis";
import { PageSection } from "@/components/ui/PageSection";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";

export function ArenaCharmCredCard() {
  const { address } = useAccount();
  const arena = addresses.timeArena ?? addresses.timeArena;

  const { data: epoch } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "lastBuyEpoch",
    query: { enabled: Boolean(arena) },
  });

  const { data: charm } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "epochCharmWad",
    args: epoch !== undefined && address ? [epoch, address] : undefined,
    query: { enabled: Boolean(arena && address && epoch !== undefined) },
  });

  const { data: pending } = useReadContract({
    address: arena,
    abi: timeArenaReadAbi,
    functionName: "pendingCred",
    args: epoch !== undefined && address ? [address, epoch] : undefined,
    query: { enabled: Boolean(arena && address && epoch !== undefined) },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  if (!arena) {
    return (
      <PageSection
        title="CHARM & Play CRED"
        dataTestId="arena-charm-cred-card"
        className="arena-charm-cred-card"
      >
        <p className="muted">Time Arena address is not configured (VITE_TIME_ARENA_ADDRESS).</p>
      </PageSection>
    );
  }

  const canClaim = pending != null && pending > 0n && epoch !== undefined;

  return (
    <PageSection
      title="CHARM & Play CRED"
      dataTestId="arena-charm-cred-card"
      className="arena-charm-cred-card"
    >
      <p>
        Last Buy epoch: <strong>{epoch?.toString() ?? "—"}</strong>
      </p>
      <p>
        Your epoch CHARM: <strong>{charm?.toString() ?? "0"}</strong> (WAD)
      </p>
      <p>
        Pending CRED: <strong>{pending?.toString() ?? "0"}</strong>
      </p>
      <ChainMismatchWriteBarrier>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canClaim || isPending || !address}
          onClick={() => {
            if (epoch === undefined) return;
            void writeContractAsync({
              address: arena,
              abi: timeArenaReadAbi,
              functionName: "claimCred",
              args: [epoch],
            });
          }}
        >
          Claim CRED
        </button>
      </ChainMismatchWriteBarrier>
    </PageSection>
  );
}
