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

export type DoubTimeArenaApprovePlan = {
  readonly approveAmt: bigint;
  readonly required: boolean;
};

/**
 * Pure guard: skip approve when allowance covers this buy (+ 50 bps headroom);
 * when approving, size to `unlimitedPreferred` (default maxUint256).
 */
export function planDoubTimeArenaApprove(
  allow: bigint,
  needWei: bigint,
  unlimitedPreferred: boolean,
): DoubTimeArenaApprovePlan {
  if (needWei <= 0n) {
    return { approveAmt: 0n, required: false };
  }
  const sizedSufficiency = arenaDoubApprovalAmountWei(needWei, false);
  const approveAmt = arenaDoubApprovalAmountWei(needWei, unlimitedPreferred);
  return { approveAmt, required: allow < sizedSufficiency };
}

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
  const plan = planDoubTimeArenaApprove(allow, needWei, unlimitedPreferred);
  if (!plan.required) {
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
    args: [timeArenaAddress, plan.approveAmt],
  });
  await waitForWriteReceipt(wagmiConfig, { hash: approveHash });
}
