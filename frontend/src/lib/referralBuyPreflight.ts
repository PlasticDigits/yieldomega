// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import { readContract } from "wagmi/actions";
import { referralRegistryReadAbi } from "@/lib/abis";
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
