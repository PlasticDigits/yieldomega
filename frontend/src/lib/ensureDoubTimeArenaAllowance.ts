// SPDX-License-Identifier: AGPL-3.0-only
//
// DOUB → TimeArena allowance gate (GitLab #262 / #143).

import { erc20Abi } from "viem";
import { readContract } from "wagmi/actions";
import type { Config } from "wagmi";
import { arenaDoubApprovalAmountWei } from "@/lib/arenaDoubApprovalPreference";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
  type WriteContractAsyncFn,
} from "@/lib/writeContractWithGasBuffer";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";

export type EnsureDoubTimeArenaAllowanceParams = {
  wagmiConfig: Config;
  writeContractAsync: WriteContractAsyncFn;
  account: `0x${string}`;
  chainId: number;
  doubAddress: `0x${string}`;
  timeArenaAddress: `0x${string}`;
  needWei: bigint;
  unlimitedPreferred?: boolean;
};

/** Read DOUB allowance for `TimeArena` and approve only when below sized target ([#143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)). */
export async function ensureDoubTimeArenaAllowance({
  wagmiConfig,
  writeContractAsync,
  account,
  chainId,
  doubAddress,
  timeArenaAddress,
  needWei,
  unlimitedPreferred = true,
}: EnsureDoubTimeArenaAllowanceParams): Promise<void> {
  if (needWei <= 0n) {
    return;
  }

  const allow = await readContract(wagmiConfig, {
    address: doubAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, timeArenaAddress],
  });
  const approveAmt = arenaDoubApprovalAmountWei(needWei, unlimitedPreferred);
  if (allow >= approveAmt) {
    return;
  }

  const { hash: approveHash } = await writeContractWithGasBuffer({
    wagmiConfig,
    writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
    account,
    chainId,
    address: doubAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [timeArenaAddress, approveAmt],
  });
  await waitForWriteReceipt(wagmiConfig, { hash: approveHash });
}
