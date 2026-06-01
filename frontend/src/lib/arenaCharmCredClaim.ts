// SPDX-License-Identifier: AGPL-3.0-only

/** Ended Last Buy epoch with claimable CRED, if any (`epoch < lastBuyEpoch`). */
export function claimableCredEpoch(lastBuyEpoch: bigint | undefined): bigint | undefined {
  if (lastBuyEpoch === undefined || lastBuyEpoch === 0n) {
    return undefined;
  }
  return lastBuyEpoch - 1n;
}

export function canClaimCred(params: {
  address: string | undefined;
  claimEpoch: bigint | undefined;
  claimPending: bigint | undefined;
}): boolean {
  return Boolean(
    params.address &&
      params.claimEpoch !== undefined &&
      params.claimPending !== undefined &&
      params.claimPending > 0n,
  );
}
