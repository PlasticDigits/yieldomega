// SPDX-License-Identifier: AGPL-3.0-only

import type { QueryClient } from "@tanstack/react-query";
import type { Abi, Address, TransactionReceipt } from "viem";
import type { Config } from "wagmi";

/** Ended Last Buy epoch with claimable CRED, if any (`epoch < lastBuyEpoch`). */
export function claimableCredEpoch(lastBuyEpoch: bigint | undefined): bigint | undefined {
  if (lastBuyEpoch === undefined || lastBuyEpoch === 0n) {
    return undefined;
  }
  return lastBuyEpoch - 1n;
}

export function canClaimCred(params: {
  address: string | undefined;
  claimEpoch: bigint | undefined;
  claimPending: bigint | undefined;
}): boolean {
  return Boolean(
    params.address &&
      params.claimEpoch !== undefined &&
      params.claimPending !== undefined &&
      params.claimPending > 0n,
  );
}

export type ExecuteClaimCredParams = {
  arena: Address;
  claimEpoch: bigint;
  abi: Abi;
  writeContractAsync: (args: {
    address: Address;
    abi: Abi;
    functionName: "claimCred";
    args: [bigint];
  }) => Promise<`0x${string}`>;
  wagmiConfig: Config;
  queryClient: QueryClient;
  waitForWriteReceipt: (
    config: Config,
    params: { hash: `0x${string}` },
  ) => Promise<TransactionReceipt>;
  invalidateArenaWalletStatsQueries: (queryClient: QueryClient) => void;
};

/** Submit `claimCred`, wait for receipt, then invalidate indexer wallet stats ([#347](https://gitlab.com/PlasticDigits/yieldomega/-/issues/347)). */
export async function executeClaimCred(params: ExecuteClaimCredParams): Promise<void> {
  const hash = await params.writeContractAsync({
    address: params.arena,
    abi: params.abi,
    functionName: "claimCred",
    args: [params.claimEpoch],
  });
  const receipt = await params.waitForWriteReceipt(params.wagmiConfig, { hash });
  if (receipt.status === "reverted") {
    throw new Error("Claim CRED reverted onchain.");
  }
  params.invalidateArenaWalletStatsQueries(params.queryClient);
}
