// SPDX-License-Identifier: AGPL-3.0-only

import { useAccount, useChainId, useWriteContract } from "wagmi";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { timeArenaWriteAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
} from "@/lib/writeContractWithGasBuffer";

type Props = {
  contractIndex: number;
  disabled?: boolean;
};

/** Permissionless `rollPodiumEpoch` when a podium timer is expired and armed ([#343](https://gitlab.com/PlasticDigits/yieldomega/-/issues/343)). */
export function ArenaPodiumRollCta({ contractIndex, disabled }: Props) {
  const arena = addresses.timeArena;
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();

  return (
    <ChainMismatchWriteBarrier testId="arena-podium-roll-chain-gate">
      <button
        type="button"
        className="btn-secondary arena-podium-roll-cta"
        data-testid="arena-podium-roll-cta"
        disabled={disabled || !arena || !address || isPending}
        onClick={() => {
          if (!arena || !address) {
            return;
          }
          void writeContractWithGasBuffer({
            writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
            account: address,
            chainId,
            address: arena,
            abi: timeArenaWriteAbi,
            functionName: "rollPodiumEpoch",
            args: [contractIndex],
          });
        }}
      >
        {isPending ? "Rolling…" : "Roll epoch"}
      </button>
    </ChainMismatchWriteBarrier>
  );
}
