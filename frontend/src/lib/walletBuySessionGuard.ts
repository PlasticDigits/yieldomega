// SPDX-License-Identifier: AGPL-3.0-only
//
// Multi-step `submitBuy` and **`/referrals`** `registerCode` (allowance / approve / register)
// use several awaits; wagmi may switch account or chain between steps
// ([GitLab #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144),
// [GitLab #155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155)).

import type { Config, Connector } from "wagmi";
import { getAccount } from "wagmi/actions";

/** User-visible copy when account or chain drifted mid-flow (must stay stable for tests/docs). */
export const WALLET_BUY_SESSION_DRIFT_MESSAGE =
  "Wallet or network changed during purchase — please retry from the beginning." as const;

/** User-visible copy when wagmi is reconnecting and the connector is not ready for writes yet. */
export const WALLET_WRITE_NOT_READY_MESSAGE =
  "Wallet session is still starting — wait a moment and retry." as const;

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

function connectorCanWrite(connector: Connector | undefined): boolean {
  return Boolean(connector && typeof connector.getChainId === "function");
}

/** Prefer the registered connector instance (uid/id) over a stale connection snapshot. */
function resolveLiveConnectorInstance(
  config: Config,
  candidate: Connector | undefined,
): Connector | undefined {
  if (!candidate) return undefined;
  if (connectorCanWrite(candidate)) return candidate;
  const byUid = config.connectors.find((c) => c.uid === candidate.uid);
  if (connectorCanWrite(byUid)) return byUid;
  const byId = config.connectors.find((c) => c.id === candidate.id);
  if (connectorCanWrite(byId)) return byId;
  return undefined;
}

/**
 * Wagmi can briefly store a stale connector snapshot (missing `getChainId`) while reconnecting
 * after reload or Vite HMR. Resolve the live connector instance from config when possible.
 */
export function resolveLiveWriteConnector(config: Config): Connector | undefined {
  const account = getAccount(config);
  if (account.status !== "connected") return undefined;

  const fromAccount = resolveLiveConnectorInstance(config, account.connector);
  if (fromAccount) return fromAccount;

  const currentUid = config.state.current;
  if (currentUid) {
    const connection = config.state.connections.get(currentUid);
    const fromConnection = resolveLiveConnectorInstance(config, connection?.connector);
    if (fromConnection) return fromConnection;
  }

  return undefined;
}

/** Throws when wagmi is not in a stable connected write session. */
export function assertWalletWriteSessionReady(config: Config): void {
  const account = getAccount(config);
  if (account.status !== "connected") {
    throw new Error(WALLET_WRITE_NOT_READY_MESSAGE);
  }
  if (!resolveLiveWriteConnector(config)) {
    throw new Error(WALLET_WRITE_NOT_READY_MESSAGE);
  }
}
