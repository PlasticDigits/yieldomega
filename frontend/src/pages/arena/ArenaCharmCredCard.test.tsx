// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ArenaCharmCredCard } from "./ArenaCharmCredCard";

const mockWriteContractAsync = vi.fn();
const mockWalletStats = vi.hoisted(() => ({
  data: {
    epoch_charm_wad: "5000000000000000000",
    pending_cred_accrual: "150000000000000000000",
    cred_balance_wad: "200000000000000000000",
    claimable_cred: "0",
    claimable_cred_epoch: "0",
    last_buy_epoch: "12",
  } as Record<string, string> | undefined,
  isLoading: false,
  isFetching: false,
}));

vi.mock("@/lib/addresses", () => ({
  addresses: { timeArena: "0x1111111111111111111111111111111111111111" as const },
  indexerBaseUrl: () => "http://127.0.0.1:3100",
}));

vi.mock("@/components/ArenaXpHero", () => ({
  ArenaXpHero: () => null,
}));

vi.mock("@/components/ArenaWalletHelpModal", () => ({
  ArenaWalletHelpModal: () => null,
}));

vi.mock("@/components/ChainMismatchWriteBarrier", () => ({
  ChainMismatchWriteBarrier: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/LockedUntilLevel", () => ({
  LockedUntilLevel: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0xcccccccccccccccccccccccccccccccccccccccc",
    isConnected: true,
  }),
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => mockWalletStats,
}));

describe("ArenaCharmCredCard (GitLab #321)", () => {
  it("renders indexer-sourced CHARM and CRED stats for a connected wallet", () => {
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain('data-testid="arena-charm-cred-charm"');
    expect(html).toContain('data-testid="arena-charm-cred-pending"');
    expect(html).toContain('data-testid="arena-charm-cred-balance"');
    expect(html).toContain("CHARM Epoch 12");
    expect(html).toContain('data-testid="arena-charm-cred-claim"');
  });

  it("shows CRED unavailable when wallet stats omit CRED fields", () => {
    mockWalletStats.data = { epoch_charm_wad: "0", last_buy_epoch: "1" };
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain("CRED unavailable");
    mockWalletStats.data = {
      epoch_charm_wad: "5000000000000000000",
      pending_cred_accrual: "150000000000000000000",
      cred_balance_wad: "200000000000000000000",
      claimable_cred: "0",
      claimable_cred_epoch: "0",
      last_buy_epoch: "12",
    };
  });

  it("reads wallet stats from indexer instead of onchain RPC (#301)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaCharmCredCard.tsx"), "utf8");
    expect(src).not.toMatch(/useReadContract\(/);
    expect(src).toContain("useWalletStats");
  });
});
