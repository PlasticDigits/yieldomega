// SPDX-License-Identifier: AGPL-3.0-only
//
// Shared CL8Y → TimeCurve allowance gate (GitLab #224 / #143).

import { erc20Abi } from "viem";
import { readContract } from "wagmi/actions";
import type { Config } from "wagmi";
import {
  cl8yTimeCurveApprovalAmountWei,
  readCl8yTimeCurveUnlimitedApproval,
} from "@/lib/cl8yTimeCurveApprovalPreference";
import { kumbayaBuyDebugLog } from "@/lib/kumbayaBuyDebug";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
  type WriteContractAsyncFn,
} from "@/lib/writeContractWithGasBuffer";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";

export type Cl8yTimeCurveApprovePlan = {
  readonly approveAmt: bigint;
  readonly required: boolean;
};

/** Pure guard: submit `approve` only when on-chain allowance is below the sized target ([#224](https://gitlab.com/PlasticDigits/yieldomega/-/issues/224)). */
export function planCl8yTimeCurveApprove(
  allow: bigint,
  needWei: bigint,
  unlimitedPreferred: boolean,
): Cl8yTimeCurveApprovePlan {
  if (needWei <= 0n) {
    return { approveAmt: 0n, required: false };
  }
  const approveAmt = cl8yTimeCurveApprovalAmountWei(needWei, unlimitedPreferred);
  return { approveAmt, required: allow < approveAmt };
}

export type EnsureCl8yTimeCurveAllowanceParams = {
  wagmiConfig: Config;
  writeContractAsync: WriteContractAsyncFn;
  account: `0x${string}`;
  chainId: number;
  tokenAddress: `0x${string}`;
  timeCurveAddress: `0x${string}`;
  needWei: bigint;
  /** Optional debug label (e.g. `arena:buy`, `arena:warbow-steal`). */
  debugContext?: string;
  unlimitedPreferred?: boolean;
};

/**
 * Read CL8Y allowance for `TimeCurve` and approve only when `allow < approveAmt`
 * (`approveAmt` from [#143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143) sizing).
 */
export async function ensureCl8yTimeCurveAllowance({
  wagmiConfig,
  writeContractAsync,
  account,
  chainId,
  tokenAddress,
  timeCurveAddress,
  needWei,
  debugContext,
  unlimitedPreferred = readCl8yTimeCurveUnlimitedApproval(),
}: EnsureCl8yTimeCurveAllowanceParams): Promise<void> {
  if (needWei <= 0n) {
    return;
  }

  const allow = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, timeCurveAddress],
  });
  const plan = planCl8yTimeCurveApprove(allow, needWei, unlimitedPreferred);
  const debugPayload = {
    context: debugContext,
    spender: timeCurveAddress,
    allow: allow.toString(),
    needWei: needWei.toString(),
    approveAmt: plan.approveAmt.toString(),
    unlimitedPref: unlimitedPreferred,
  };
  if (!plan.required) {
    kumbayaBuyDebugLog("cl8y-timecurve-approve:skip", debugPayload);
    return;
  }
  kumbayaBuyDebugLog("cl8y-timecurve-approve:submit", debugPayload);
  const { hash: approveHash } = await writeContractWithGasBuffer({
    wagmiConfig,
    writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
    account,
    chainId,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [timeCurveAddress, plan.approveAmt],
  });
  await waitForWriteReceipt(wagmiConfig, { hash: approveHash });
}
