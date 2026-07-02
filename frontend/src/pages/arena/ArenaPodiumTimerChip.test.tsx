// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaPodiumTimerChip, type ArenaPodiumTimerChipProps } from "./ArenaPodiumTimerChip";

const mockWalletStats = vi.fn();

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => mockWalletStats(),
}));

const OTHER = "0x1111111111111111111111111111111111111111" as const;

const baseProps: Omit<ArenaPodiumTimerChipProps, "address"> = {
  podiumName: "Defended Streak",
  contractIndex: 2,
  categoryIndex: 2,
  feature: "defended_streak",
  playerLevel: 1,
  decimals: 18,
  podiumRow: {
    winners: [OTHER, OTHER, OTHER],
    values: ["0", "0", "0"],
    epoch: "0",
  },
  recentBuys: null,
  podiumRows: [{ winners: [OTHER, OTHER, OTHER], values: ["0", "0", "0"], epoch: "0" }],
};

describe("ArenaPodiumTimerChip side-rail locks", () => {
  it("locks all chips when wallet is disconnected", () => {
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, { ...baseProps, address: undefined }),
    );
    expect(html).toContain('data-testid="arena-timer-chip-lock-2"');
    expect(html).toContain("LEVEL 3");
    expect(html).not.toContain("Buy CHARM to activate this mechanic.");
  });

  it("locks streak and warbow chips when wallet connected but has not bought", () => {
    mockWalletStats.mockReturnValue({
      data: { buy_count: 0, first_buy_at: null },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        address: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
      }),
    );
    expect(html).toContain('data-testid="arena-timer-chip-lock-2"');
    expect(html).toContain("LEVEL 3");
  });

  it("locks Last Buy side-rail chip without buy-hint copy when wallet connected but has not bought", () => {
    mockWalletStats.mockReturnValue({
      data: { buy_count: 0, first_buy_at: null },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        feature: "last_buy",
        contractIndex: 0,
        categoryIndex: 0,
        podiumName: "Last Buy",
        address: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
      }),
    );
    expect(html).toContain('data-testid="arena-timer-chip-lock-0"');
    expect(html).toContain("LEVEL 1");
    expect(html).not.toContain("Buy CHARM to unlock your Last Buy score on this panel.");
  });

  it("locks Last Buy side-rail chip when wallet is disconnected", () => {
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        feature: "last_buy",
        contractIndex: 0,
        categoryIndex: 0,
        podiumName: "Last Buy",
        address: undefined,
      }),
    );
    expect(html).toContain('data-testid="arena-timer-chip-lock-0"');
    expect(html).toContain("Connect wallet");
  });

  it("locks Last Buy side-rail chip while wallet stats load", () => {
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        feature: "last_buy",
        contractIndex: 0,
        categoryIndex: 0,
        podiumName: "Last Buy",
        address: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
      }),
    );
    expect(html).toContain('data-testid="arena-timer-chip-lock-0"');
    expect(html).toContain("LEVEL 1");
  });

  it("unlocks Last Buy side-rail chip after wallet buy", () => {
    mockWalletStats.mockReturnValue({
      data: { buy_count: 1, first_buy_at: "1700000000" },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        feature: "last_buy",
        contractIndex: 0,
        categoryIndex: 0,
        podiumName: "Last Buy",
        address: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
      }),
    );
    expect(html).not.toContain('data-testid="arena-timer-chip-lock-0"');
    expect(html).toContain("EPOCH 0");
  });

  it("shows each feature unlock tier on side-rail pre-buy locks", () => {
    mockWalletStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    const chips = [
      { feature: "last_buy" as const, contractIndex: 0, podiumName: "Last Buy", level: 1 },
      { feature: "time_booster" as const, contractIndex: 1, podiumName: "Time Booster", level: 2 },
      {
        feature: "defended_streak" as const,
        contractIndex: 2,
        podiumName: "Defended Streak",
        level: 3,
      },
      { feature: "warbow" as const, contractIndex: 3, podiumName: "WarBow", level: 4 },
    ];
    for (const chip of chips) {
      const html = renderToStaticMarkup(
        createElement(ArenaPodiumTimerChip, {
          ...baseProps,
          feature: chip.feature,
          contractIndex: chip.contractIndex,
          podiumName: chip.podiumName,
          categoryIndex: chip.contractIndex,
          address: undefined,
        }),
      );
      expect(html).toContain(`data-testid="arena-timer-chip-lock-${chip.contractIndex}"`);
      if (chip.feature === "last_buy") {
        expect(html).toContain("Connect wallet");
      } else {
        expect(html).toContain(`LEVEL ${chip.level}`);
      }
    }
  });

  it("shows only the next progression lock after wallet buy unlocks side rail", () => {
    mockWalletStats.mockReturnValue({
      data: { buy_count: 1, first_buy_at: "1700000000" },
      isLoading: false,
      isFetching: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaPodiumTimerChip, {
        ...baseProps,
        address: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
      }),
    );
    expect(html).not.toContain('data-testid="arena-timer-chip-lock-2"');
    expect(html).toContain("EPOCH 0");
  });
});
