// SPDX-License-Identifier: AGPL-3.0-only

import { readContract } from "wagmi/actions";
import { referralRegistryReadAbi } from "@/lib/abis";
import { fetchReferralRegistrations } from "@/lib/indexerApi";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";
import { setStoredMyReferralCodeForWallet } from "@/lib/referralStorage";
import { wagmiConfig } from "@/wagmi-config";

function ownerCodeHashHex(ownerCodeHash: `0x${string}` | bigint): string {
  if (typeof ownerCodeHash === "bigint") {
    return `0x${ownerCodeHash.toString(16).padStart(64, "0")}`;
  }
  return ownerCodeHash;
}

/**
 * When the wallet has registered on-chain but the plaintext code is missing from `localStorage`,
 * load the indexed `ReferralCodeRegistered.normalizedCode` and — only if `hashCode` matches the
 * live `ownerCode` hash — persist it for share-link UX. Indexer data is not trusted without the RPC check.
 */
export async function tryAutoRecoverReferralCodeFromIndexer(params: {
  wallet: `0x${string}`;
  registry: `0x${string}`;
  ownerCodeHash: `0x${string}` | bigint;
}): Promise<boolean> {
  const { wallet, registry, ownerCodeHash } = params;
  const expected = ownerCodeHashHex(ownerCodeHash).toLowerCase();

  const page = await fetchReferralRegistrations(5, 0, wallet);
  if (!page?.items?.length) {
    return false;
  }

  for (const row of page.items) {
    if (row.owner_address?.toLowerCase() !== wallet.toLowerCase()) {
      continue;
    }
    const code = row.normalized_code?.trim();
    if (!code) {
      continue;
    }
    if (isReferralSlugReservedForRouting(code)) {
      continue;
    }
    let h: unknown;
    try {
      h = await readContract(wagmiConfig, {
        address: registry,
        abi: referralRegistryReadAbi,
        functionName: "hashCode",
        args: [code],
      });
    } catch {
      continue;
    }
    const hs = typeof h === "string" ? h.toLowerCase() : "";
    if (hs && hs === expected) {
      setStoredMyReferralCodeForWallet(wallet, code);
      return true;
    }
  }
  return false;
}
