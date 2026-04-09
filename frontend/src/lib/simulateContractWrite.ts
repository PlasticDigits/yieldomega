// SPDX-License-Identifier: AGPL-3.0-only

import type { Abi } from "viem";
import { getPublicClient } from "wagmi/actions";
import { simulateContract } from "viem/actions";
import { wagmiConfig } from "@/wagmi-config";

type SimParams = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account: `0x${string}`;
  chainId?: number;
};

/** Best-effort write simulation; throws on revert and returns false when no client is available. */
export async function simulateWriteContract(params: SimParams): Promise<boolean> {
  const client =
    params.chainId !== undefined
      ? getPublicClient(wagmiConfig, { chainId: params.chainId })
      : getPublicClient(wagmiConfig);
  if (!client) {
    return false;
  }
  await simulateContract(client, {
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    account: params.account,
  });
  return true;
}
