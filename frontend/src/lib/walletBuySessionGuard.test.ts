// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
  WALLET_WRITE_NOT_READY_MESSAGE,
  resolveLiveWriteConnector,
  walletBuySessionDriftFromState,
  type WalletBuySessionSnapshot,
} from "@/lib/walletBuySessionGuard";

const SNAP: WalletBuySessionSnapshot = {
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  chainId: 31337,
};

describe("walletBuySessionDriftFromState", () => {
  it("returns null when connected address and chain match", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: SNAP.address, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBeNull();
  });

  it("matches addresses case-insensitively", () => {
    expect(
      walletBuySessionDriftFromState(
        {
          status: "connected",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 31337,
        },
        {
          address: "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa",
          chainId: 31337,
        },
      ),
    ).toBeNull();
  });

  it("flags disconnected status", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "disconnected", address: undefined, chainId: undefined },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags reconnecting status", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "reconnecting", address: SNAP.address, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags account switch", () => {
    expect(
      walletBuySessionDriftFromState(
        {
          status: "connected",
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          chainId: SNAP.chainId,
        },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags chain switch", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: SNAP.address, chainId: 1 },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags missing address while allegedly connected", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: undefined, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });
});

describe("resolveLiveWriteConnector", () => {
  const liveConnector = {
    uid: "live-uid",
    id: "io.metamask",
    getChainId: async () => 31337,
  };

  it("returns the live connector from config.connectors by uid", () => {
    const config = {
      chains: [{ id: SNAP.chainId }],
      connectors: [liveConnector],
      state: {
        status: "connected",
        current: "live-uid",
        connections: new Map([
          [
            "live-uid",
            {
              accounts: [SNAP.address],
              chainId: SNAP.chainId,
              connector: { uid: "live-uid", id: "io.metamask" },
            },
          ],
        ]),
      },
    } as unknown as Parameters<typeof resolveLiveWriteConnector>[0];

    expect(resolveLiveWriteConnector(config)).toBe(liveConnector);
  });

  it("returns undefined while reconnecting", () => {
    const config = {
      chains: [{ id: SNAP.chainId }],
      connectors: [liveConnector],
      state: {
        status: "reconnecting",
        current: "live-uid",
        connections: new Map([
          [
            "live-uid",
            {
              accounts: [SNAP.address],
              chainId: SNAP.chainId,
              connector: { uid: "live-uid", id: "io.metamask" },
            },
          ],
        ]),
      },
    } as unknown as Parameters<typeof resolveLiveWriteConnector>[0];

    expect(resolveLiveWriteConnector(config)).toBeUndefined();
  });

  it("resolves a stale connection snapshot via stable connector id (e.g. after HMR)", () => {
    const config = {
      chains: [{ id: SNAP.chainId }],
      connectors: [liveConnector],
      state: {
        status: "connected",
        current: "stale-uid",
        connections: new Map([
          [
            "stale-uid",
            {
              accounts: [SNAP.address],
              chainId: SNAP.chainId,
              connector: { uid: "stale-uid", id: "io.metamask" },
            },
          ],
        ]),
      },
    } as unknown as Parameters<typeof resolveLiveWriteConnector>[0];

    expect(resolveLiveWriteConnector(config)).toBe(liveConnector);
  });
});

describe("WALLET_WRITE_NOT_READY_MESSAGE", () => {
  it("is stable copy for UI/tests", () => {
    expect(WALLET_WRITE_NOT_READY_MESSAGE).toMatch(/wait a moment and retry/i);
  });
});
