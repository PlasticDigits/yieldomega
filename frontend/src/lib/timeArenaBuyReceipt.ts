// SPDX-License-Identifier: AGPL-3.0-only
//
// Buy receipts: viem resolves `waitForTransactionReceipt` even when `status` is reverted.

/** User-visible copy when a submitted Time Arena buy mines as failed (no extra RPC). */
export const BUY_TRANSACTION_REVERTED_MESSAGE =
  "Your wallet broadcast this purchase, but it reverted onchain. The CL8Y cost follows the live curve at inclusion—wait a moment and try again.";

/** Throws when the receipt indicates an onchain revert so buys do not run success-only side effects. */
export function assertSuccessfulBuyReceipt(receipt: {
  status?: "success" | "reverted" | null;
}): void {
  if (receipt.status === "reverted") {
    throw new Error(BUY_TRANSACTION_REVERTED_MESSAGE);
  }
}
