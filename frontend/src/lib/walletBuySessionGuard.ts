// SPDX-License-Identifier: AGPL-3.0-only
//
// Multi-step `submitBuy` uses several awaits; wagmi may switch account or chain
// between steps ([GitLab #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144)).

import type { Config } from "wagmi";
import { getAccount } from "wagmi/actions";

/** User-visible copy when account or chain drifted mid-flow (must stay stable for tests/docs). */
export const WALLET_BUY_SESSION_DRIFT_MESSAGE =
  "Wallet or network changed during purchase — please retry from the beginning." as const;

export type WalletBuySessionSnapshot = {
  address: `0x${string}`;
  chainId: number;
};

export type WalletBuySessionAccountSlice = {
  status: string;
  address: `0x${string}` | undefined;
  chainId: number | undefined;
};

/** Exported for Vitest — compares live connector snapshot to the purchase latch. */
export function walletBuySessionDriftFromState(
  current: WalletBuySessionAccountSlice,
  snapshot: WalletBuySessionSnapshot,
): string | null {
  if (current.status !== "connected") return WALLET_BUY_SESSION_DRIFT_MESSAGE;
  if (!current.address || current.chainId === undefined) return WALLET_BUY_SESSION_DRIFT_MESSAGE;
  if (current.address.toLowerCase() !== snapshot.address.toLowerCase()) {
    return WALLET_BUY_SESSION_DRIFT_MESSAGE;
  }
  if (current.chainId !== snapshot.chainId) return WALLET_BUY_SESSION_DRIFT_MESSAGE;
  return null;
}

/** `null` when wagmi is not in a stable connected session (caller should abort the buy). */
export function captureWalletBuySession(config: Config): WalletBuySessionSnapshot | null {
  const a = getAccount(config);
  if (a.status !== "connected") return null;
  return { address: a.address, chainId: a.chainId };
}

export function walletBuySessionDriftMessage(
  config: Config,
  snapshot: WalletBuySessionSnapshot,
): string | null {
  const a = getAccount(config);
  return walletBuySessionDriftFromState(
    { status: a.status, address: a.address, chainId: a.chainId },
    snapshot,
  );
}

/** Throws with {@link WALLET_BUY_SESSION_DRIFT_MESSAGE} when the session drifted. */
export function assertWalletBuySessionUnchanged(
  config: Config,
  snapshot: WalletBuySessionSnapshot,
): void {
  const d = walletBuySessionDriftMessage(config, snapshot);
  if (d) throw new Error(d);
}
