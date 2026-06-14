// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ArenaCharmCredCard } from "./ArenaCharmCredCard";

const mockWalletStats = vi.fn();

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => mockWalletStats(),
}));

const mockUseAccount = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useWriteContract: () => ({ writeContractAsync: async () => {}, isPending: false }),
}));

vi.mock("@/components/ArenaXpHero", () => ({
  ArenaXpHero: () => createElement("div", { "data-testid": "arena-xp-hero" }),
}));

vi.mock("@/components/ChainMismatchWriteBarrier", () => ({
  ChainMismatchWriteBarrier: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/lib/addresses", () => ({
  addresses: { timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
  indexerBaseUrl: () => "http://127.0.0.1:3100",
}));

describe("ArenaCharmCredCard (GitLab #321)", () => {
  it("renders wallet stats placeholders when disconnected", () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain('data-testid="arena-charm-cred-card"');
    expect(html).toContain("Connect wallet");
    expect(html).toContain('data-testid="arena-charm-cred-claim"');
  });

  it("renders claimable CRED when wallet stats are ready", () => {
    mockUseAccount.mockReturnValue({
      address: "0xdddddddddddddddddddddddddddddddddddddddd",
      isConnected: true,
    });
    mockWalletStats.mockReturnValue({
      data: {
        epoch_charm_wad: "5000000000000000000",
        pending_cred_accrual: "150000000000000000000",
        cred_balance_wad: "250000000000000000000",
        claimable_cred_epoch: "4",
        claimable_cred: "150000000000000000000",
        last_buy_epoch: "5",
        buy_count: 1,
      },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain('data-testid="arena-charm-cred-charm"');
    expect(html).toContain('data-testid="arena-charm-cred-pending"');
    expect(html).toContain('data-testid="arena-charm-cred-balance"');
    expect(html).not.toContain("Connect wallet");
  });

  it("shows CRED unavailable when wallet stats omit CRED fields", () => {
    mockUseAccount.mockReturnValue({
      address: "0xdddddddddddddddddddddddddddddddddddddddd",
      isConnected: true,
    });
    mockWalletStats.mockReturnValue({
      data: { epoch_charm_wad: "0", last_buy_epoch: "1" },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain("CRED unavailable");
  });

  it("shows indexer-unavailable copy when indexer URL is unset", async () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    vi.resetModules();
    vi.doMock("@/lib/addresses", () => ({
      addresses: { timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
      indexerBaseUrl: () => undefined,
    }));
    const { ArenaCharmCredCard: Card } = await import("./ArenaCharmCredCard");
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(createElement(Card));
    expect(html).toContain("Indexer URL is not configured");
    vi.resetModules();
  });

  it("reads wallet stats from indexer instead of onchain RPC (#301)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaCharmCredCard.tsx"), "utf8");
    expect(src).not.toMatch(/useReadContract\(/);
    expect(src).toContain("useWalletStats");
  });
});
