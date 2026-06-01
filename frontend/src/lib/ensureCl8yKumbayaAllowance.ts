// SPDX-License-Identifier: AGPL-3.0-only
//
// Shared CL8Y → TimeArena allowance gate (GitLab #224 / #143 / #277).

import { erc20Abi } from "viem";
import { readContract } from "wagmi/actions";
import type { Config } from "wagmi";
import {
  arenaDoubApprovalAmountWei,
  readArenaDoubUnlimitedApproval,
} from "@/lib/arenaDoubApprovalPreference";
import { kumbayaBuyDebugLog } from "@/lib/kumbayaBuyDebug";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
  type WriteContractAsyncFn,
} from "@/lib/writeContractWithGasBuffer";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";

export type Cl8yKumbayaApprovePlan = {
  readonly approveAmt: bigint;
  readonly required: boolean;
};

/** Pure guard: submit `approve` only when on-chain allowance is below the sized target ([#224](https://gitlab.com/PlasticDigits/yieldomega/-/issues/224)). */
export function planCl8yKumbayaApprove(
  allow: bigint,
  needWei: bigint,
  unlimitedPreferred: boolean,
): Cl8yKumbayaApprovePlan {
  if (needWei <= 0n) {
    return { approveAmt: 0n, required: false };
  }
  const approveAmt = arenaDoubApprovalAmountWei(needWei, unlimitedPreferred);
  return { approveAmt, required: allow < approveAmt };
}

export type EnsureCl8yArenaAllowanceParams = {
  wagmiConfig: Config;
  writeContractAsync: WriteContractAsyncFn;
  account: `0x${string}`;
  chainId: number;
  tokenAddress: `0x${string}`;
  timeArenaAddress: `0x${string}`;
  needWei: bigint;
  /** Optional debug label (e.g. `arena:buy`, `arena:warbow-steal`). */
  debugContext?: string;
  unlimitedPreferred?: boolean;
};

/** @deprecated Use `EnsureCl8yArenaAllowanceParams` — retained for imports from pre-#277 rename. */
export type EnsureCl8yTimeCurveAllowanceParams = EnsureCl8yArenaAllowanceParams;

/**
 * Read CL8Y allowance for `TimeArena` and approve only when `allow < approveAmt`
 * (`approveAmt` from [#143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143) sizing).
 */
export async function ensureCl8yKumbayaAllowance({
  wagmiConfig,
  writeContractAsync,
  account,
  chainId,
  tokenAddress,
  timeArenaAddress,
  needWei,
  debugContext,
  unlimitedPreferred = readArenaDoubUnlimitedApproval(),
}: EnsureCl8yArenaAllowanceParams): Promise<void> {
  if (needWei <= 0n) {
    return;
  }

  const allow = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, timeArenaAddress],
  });
  const plan = planCl8yKumbayaApprove(allow, needWei, unlimitedPreferred);
  const debugPayload = {
    context: debugContext,
    spender: timeArenaAddress,
    allow: allow.toString(),
    needWei: needWei.toString(),
    approveAmt: plan.approveAmt.toString(),
    unlimitedPref: unlimitedPreferred,
  };
  if (!plan.required) {
    kumbayaBuyDebugLog("cl8y-arena-approve:skip", debugPayload);
    return;
  }
  kumbayaBuyDebugLog("cl8y-arena-approve:submit", debugPayload);
  const { hash: approveHash } = await writeContractWithGasBuffer({
    wagmiConfig,
    writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
    account,
    chainId,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [timeArenaAddress, plan.approveAmt],
  });
  await waitForWriteReceipt(wagmiConfig, { hash: approveHash });
}
