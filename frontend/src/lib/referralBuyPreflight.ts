// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import { readContract } from "wagmi/actions";
import { referralRegistryReadAbi } from "@/lib/abis";
import { isReferralCodeBlockedRaw } from "@/lib/referralBlockedCodes";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";

export type ReferralBuyPreflightResult = { ok: true } | { ok: false; message: string };

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Onchain checks before attaching `codeHash` to `buy` / `buyViaKumbaya`.
 * Fails closed when the code is unregistered or would self-refer.
 */
export async function assertReferralReadyForBuy(params: {
  wagmiConfig: Config;
  referralRegistry: `0x${string}`;
  buyer: `0x${string}`;
  pendingCode: string;
}): Promise<ReferralBuyPreflightResult> {
  let codeHash: `0x${string}`;
  let normalized: string;
  try {
    normalized = normalizeReferralCode(params.pendingCode);
    codeHash = hashReferralCode(params.pendingCode);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  const owner = (await readContract(params.wagmiConfig, {
    address: params.referralRegistry,
    abi: referralRegistryReadAbi,
    functionName: "ownerOfCode",
    args: [codeHash],
  })) as `0x${string}`;

  if (!owner || owner.toLowerCase() === ZERO) {
    return {
      ok: false,
      message: `Referral code “${normalized}” is not registered onchain. Uncheck “Apply pending referral” or register it on /referrals.`,
    };
  }

  if (owner.toLowerCase() === params.buyer.toLowerCase()) {
    return {
      ok: false,
      message: "You cannot use your own referral code on this wallet.",
    };
  }

  return { ok: true };
}

/**
 * Returns a `codeHash` only when the pending slug is registered for a third-party referrer.
 * Blocked, malformed, unregistered, and self-referral codes are dropped so buys proceed
 * without referral attachment; {@link params.clearPendingReferral} runs when the slug is
 * unusable.
 */
export async function resolveReferralCodeHashForBuy(params: {
  wagmiConfig: Config;
  referralRegistry: `0x${string}` | undefined;
  buyer: `0x${string}`;
  pendingCode: string;
  clearPendingReferral: () => void;
}): Promise<`0x${string}` | undefined> {
  const clear = params.clearPendingReferral;

  if (isReferralCodeBlockedRaw(params.pendingCode)) {
    clear();
    return undefined;
  }

  let codeHash: `0x${string}`;
  try {
    codeHash = hashReferralCode(params.pendingCode);
  } catch {
    clear();
    return undefined;
  }

  if (!params.referralRegistry) {
    return undefined;
  }

  const owner = (await readContract(params.wagmiConfig, {
    address: params.referralRegistry,
    abi: referralRegistryReadAbi,
    functionName: "ownerOfCode",
    args: [codeHash],
  })) as `0x${string}`;

  if (
    !owner ||
    owner.toLowerCase() === ZERO ||
    owner.toLowerCase() === params.buyer.toLowerCase()
  ) {
    clear();
    return undefined;
  }

  return codeHash;
}
