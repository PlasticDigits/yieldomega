// SPDX-License-Identifier: AGPL-3.0-only

import type { PayWithAsset } from "@/lib/kumbayaRoutes";

/**
 * Static display-only CL8Y→pay-token rates when Kumbaya quoter/routing is
 * unavailable (product default; not an onchain price).
 *
 * - 1 CL8Y ≈ 0.98 USDM
 * - 1 CL8Y ≈ 0.000419 ETH
 *
 * Used for **USD-shaped** podium hints on Simple; see `docs/testing/invariants-and-business-logic.md`
 * (**INV-FRONTEND-192**, [GitLab #192](https://gitlab.com/PlasticDigits/yieldomega/-/issues/192)).
 */
export function fallbackPayTokenWeiForCl8y(cl8yWei: bigint, payWith: "eth" | "usdm"): bigint {
  if (payWith === "usdm") {
    return (cl8yWei * 98n) / 100n;
  }
  return (cl8yWei * 419n) / 1_000_000n;
}

export function fallbackPayTokenWeiForCl8yPayWith(
  cl8yWei: bigint,
  payWith: PayWithAsset,
): bigint | undefined {
  if (payWith === "cl8y") return undefined;
  return fallbackPayTokenWeiForCl8y(cl8yWei, payWith);
}
