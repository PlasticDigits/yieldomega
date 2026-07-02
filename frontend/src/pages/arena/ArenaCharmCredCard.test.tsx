// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { executeClaimCred } from "@/lib/arenaCharmCredClaim";
import { ArenaCharmCredCard } from "./ArenaCharmCredCard";

const mockWalletStats = vi.fn();

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => mockWalletStats(),
  invalidateArenaWalletStatsQueries: vi.fn(),
}));

const mockUseAccount = vi.fn();
const mockWriteContractAsync = vi.fn();
const mockUseConfig = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useConfig: () => mockUseConfig(),
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock("@/lib/realtimeTransaction", () => ({
  waitForWriteReceipt: vi.fn(),
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

  it("shows lock overlay while wallet stats are loading", () => {
    mockUseAccount.mockReturnValue({
      address: "0xdddddddddddddddddddddddddddddddddddddddd",
      isConnected: true,
    });
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });
    const html = renderToStaticMarkup(createElement(ArenaCharmCredCard));
    expect(html).toContain('data-testid="arena-charm-cred-lock"');
    expect(html).toContain("Loading CHARM");
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

  it("wires claim through executeClaimCred with receipt wait and stats invalidation (#347)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaCharmCredCard.tsx"), "utf8");
    expect(src).toContain("executeClaimCred");
    expect(src).toContain("waitForWriteReceipt");
    expect(src).toContain("invalidateArenaWalletStatsQueries");
    expect(src).toContain("claimSubmitting");
    expect(src).toContain("friendlyRevertFromUnknown");
  });

  it("executeClaimCred waits for receipt then invalidates wallet stats (#347)", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xabc");
    const waitForWriteReceipt = vi.fn().mockResolvedValue({ status: "success" });
    const invalidateArenaWalletStatsQueries = vi.fn();
    const queryClient = { invalidateQueries: vi.fn() };
    const wagmiConfig = { chains: [] };

    await executeClaimCred({
      arena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
      claimEpoch: 4n,
      abi: [],
      writeContractAsync,
      wagmiConfig: wagmiConfig as never,
      queryClient: queryClient as never,
      waitForWriteReceipt,
      invalidateArenaWalletStatsQueries,
    });

    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "claimCred",
        args: [4n],
      }),
    );
    expect(waitForWriteReceipt).toHaveBeenCalledWith(wagmiConfig, { hash: "0xabc" });
    expect(invalidateArenaWalletStatsQueries).toHaveBeenCalledWith(queryClient);
  });

  it("executeClaimCred does not invalidate on reverted receipt (#347)", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xdef");
    const waitForWriteReceipt = vi.fn().mockResolvedValue({ status: "reverted" });
    const invalidateArenaWalletStatsQueries = vi.fn();

    await expect(
      executeClaimCred({
        arena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
        claimEpoch: 2n,
        abi: [],
        writeContractAsync,
        wagmiConfig: { chains: [] } as never,
        queryClient: { invalidateQueries: vi.fn() } as never,
        waitForWriteReceipt,
        invalidateArenaWalletStatsQueries,
      }),
    ).rejects.toThrow(/reverted/i);

    expect(invalidateArenaWalletStatsQueries).not.toHaveBeenCalled();
  });
});
