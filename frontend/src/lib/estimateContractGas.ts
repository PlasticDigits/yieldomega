// SPDX-License-Identifier: AGPL-3.0-only

import { estimateContractGas } from "viem/actions";
import { getPublicClient } from "wagmi/actions";
import type { Abi } from "viem";
import { wagmiConfig } from "@/wagmi-config";

type EstParams = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account: `0x${string}`;
  /** Pass `useChainId()` when the wallet targets a specific chain. */
  chainId?: number;
};

/** Best-effort gas units; returns undefined on RPC/wallet errors. */
export async function estimateGasUnits(params: EstParams): Promise<bigint | undefined> {
  try {
    const client =
      params.chainId !== undefined
        ? getPublicClient(wagmiConfig, { chainId: params.chainId })
        : getPublicClient(wagmiConfig);
    if (!client) {
      return undefined;
    }
    return await estimateContractGas(client, {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      account: params.account,
    });
  } catch {
    return undefined;
  }
}
