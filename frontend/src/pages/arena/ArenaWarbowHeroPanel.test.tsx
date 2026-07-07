// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaWarbowHeroPanel, type WarbowTarget } from "./ArenaWarbowHeroPanel";

const mockWarbowHero = vi.fn();
const mockPendingRevengeTargets = vi.fn();

vi.mock("./useArenaWarbowHero", () => ({
  useArenaWarbowHero: () => mockWarbowHero(),
}));

vi.mock("@/hooks/useArenaPendingRevengeTargets", () => ({
  useArenaPendingRevengeTargets: () => mockPendingRevengeTargets(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
}));

vi.mock("@/components/WalletConnectButton", () => ({
  WalletConnectButton: () => createElement("button", { type: "button" }, "Connect"),
}));

vi.mock("@/components/ChainMismatchWriteBarrier", () => ({
  ChainMismatchWriteBarrier: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ArenaLevelGate", () => ({
  ArenaLevelGate: ({ children }: { children: ReactNode }) => children,
}));

const TARGET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TARGET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const warbowTargets: WarbowTarget[] = [
  { address: TARGET_A, battlePoints: "400", source: "podium", rank: 1 },
  { address: TARGET_B, battlePoints: "200", source: "recent" },
];

const baseHook = {
  ready: true,
  saleActive: true,
  isConnected: true,
  canPress: true,
  stealVictim: undefined,
  guardedActive: false,
  guardUntilSec: "0",
  chainNowSec: 1_700_000_000,
  utcResetSec: 43_200,
  attackerStealsToday: 1n,
  viewerBattlePoints: "100",
  stealDoubWad: "1000000000000000000000",
  guardDoubWad: "10000000000000000000000",
  bypassDoubWad: "500000000000000000000",
  revengeDoubWad: "2000000000000000000000",
  maxStealsPerDay: 3,
  stealPreflight: {
    tone: "muted" as const,
    title: "Pick a rival",
    detail: "Choose a target from the WarBow list to compare BP, daily cap pressure, and pre-sign steal eligibility.",
  },
  stealVictimInput: "",
  setStealVictimInput: () => {},
  stealVictimFormatError: null,
  stealBypass: false,
  setStealBypass: () => {},
  pvpErr: null,
  clearPvpErr: () => {},
  runWarBowSteal: async () => {},
  runWarBowGuard: async () => {},
  runWarBowRevenge: async () => {},
  arenaPaused: false,
};

const noRevengeMock = {
  pendingRevengeTargets: [],
  hasRevengeOpen: false,
  revengeIndexerConfigured: true,
  pendingRevengeLoadFailed: false,
};

describe("ArenaWarbowHeroPanel (GitLab #321)", () => {
  it("formats revenge window remaining time as HH:MM:SS (#revenge-countdown)", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue({
      pendingRevengeTargets: [
        {
          stealer: TARGET_A,
          steal_seq: "1",
          expiry_exclusive: String(1_700_060_406),
        },
      ],
      hasRevengeOpen: true,
      revengeIndexerConfigured: true,
      pendingRevengeLoadFailed: false,
    });
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 4,
        warbowTargets,
        indexerViewerBattlePoints: 100n,
      }),
    );
    // 60406s remaining → 16:46:46 (not mm:ss "1006:46")
    expect(html).toContain("16:46:46");
    expect(html).not.toContain("1006:46");
  });

  it("renders steal target listbox with roving tabindex on the first option", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        indexerViewerBattlePoints: 100n,
      }),
    );
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="WarBow steal targets"');
    expect(html).toContain(`data-testid="warbow-target-${TARGET_A.toLowerCase()}"`);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('tabindex="-1"');
  });

  it("shows paused copy when arena is paused onchain", () => {
    mockWarbowHero.mockReturnValue({
      ...baseHook,
      canPress: false,
      arenaPaused: true,
    });
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
      }),
    );
    expect(html).toContain("Time Arena is paused onchain");
  });

  it("shows LEVEL 5 lock on WarBow flag at level 4 (#334)", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 4,
        warbowTargets,
        indexerViewerBattlePoints: 100n,
      }),
    );
    expect(html).toContain('data-testid="arena-simple-warbow-flag-lock"');
    expect(html).toContain("LEVEL 5");
  });

  it("shows flag silence copy and countdown when viewer holds planted flag", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        showClaimFlagControl: true,
        canClaimWarBowFlag: false,
        flagSilenceEndSec: 1_700_000_200n,
        ledgerNowSec: 1_700_000_000,
      }),
    );
    expect(html).toContain("Claim after 5 minutes of silence.");
    expect(html).toContain('data-testid="warbow-hero-flag-silence-countdown"');
    expect(html).toContain("03:20");
    expect(html).toContain('data-testid="warbow-hero-claim-flag-submit"');
    expect(html).toContain('data-testid="warbow-hero-viewer-summary-flag"');
    expect(html).toContain("03:20 until claim");
  });

  it("shows viewer-summary flag countdown during silence (#362)", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        showClaimFlagControl: true,
        canClaimWarBowFlag: false,
        flagSilenceEndSec: 1_700_000_200n,
        ledgerNowSec: 1_700_000_000,
      }),
    );
    expect(html).toContain('data-testid="warbow-hero-viewer-summary-flag"');
    expect(html).toContain("FLAG:");
    expect(html).toContain("03:20 until claim");
  });

  it("shows viewer-summary claim-now when silence elapsed (#362)", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        showClaimFlagControl: true,
        canClaimWarBowFlag: true,
        flagSilenceEndSec: 1_700_000_200n,
        ledgerNowSec: 1_700_000_400,
      }),
    );
    expect(html).toContain('data-testid="warbow-hero-viewer-summary-flag"');
    expect(html).toContain("claim now");
  });

  it("omits viewer-summary flag line when no planted flag (#362)", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        showClaimFlagControl: false,
      }),
    );
    expect(html).not.toContain('data-testid="warbow-hero-viewer-summary-flag"');
  });

  it("enables claim flag CTA after silence window", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        showClaimFlagControl: true,
        canClaimWarBowFlag: true,
        flagSilenceEndSec: 1_700_000_200n,
        ledgerNowSec: 1_700_000_400,
      }),
    );
    expect(html).toContain("Silence complete");
    expect(html).toContain('data-testid="warbow-hero-claim-flag-submit"');
    expect(html).toContain(">Claim flag<");
    expect(html).not.toMatch(/warbow-hero-claim-flag-submit[^>]*disabled/);
  });

  it("surfaces WarBow PvP errors with dismiss control", () => {
    mockWarbowHero.mockReturnValue({
      ...baseHook,
      pvpErr: "WarBow steal reverted",
    });
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
      }),
    );
    expect(html).toContain("WarBow steal reverted");
    expect(html).toContain("dismiss");
  });

  it("renders subcard help buttons for steal, guard, revenge, and flag", () => {
    mockWarbowHero.mockReturnValue(baseHook);
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
        indexerViewerBattlePoints: 100n,
      }),
    );
    expect(html).toContain('data-testid="warbow-hero-steal-help"');
    expect(html).toContain('data-testid="warbow-hero-guard-help"');
    expect(html).toContain('data-testid="warbow-hero-revenge-help"');
    expect(html).toContain('data-testid="warbow-hero-flag-help"');
    expect(html).toContain('aria-label="Open Steal help"');
  });

  it("shows steal quota + UTC reset in viewer summary (#361)", () => {
    mockWarbowHero.mockReturnValue({
      ...baseHook,
      attackerStealsToday: 2n,
      utcResetSec: 3661,
    });
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
      }),
    );
    expect(html).toContain('data-testid="warbow-hero-viewer-summary-steal-quota"');
    expect(html).toContain("STEAL QUOTA:");
    expect(html).toContain("2 / 3");
    expect(html).toContain("01:01:01");
  });

  it("shows inline daily-cap warning above Steal when victim is capped (#361)", () => {
    const victim = TARGET_A;
    mockWarbowHero.mockReturnValue({
      ...baseHook,
      stealVictim: victim,
      stealPreflight: {
        tone: "warning" as const,
        title: "Daily steal limit",
        detail: "Victim already hit 3 steals received today. Enable bypass if you still want to spend for the hit.",
      },
    });
    mockPendingRevengeTargets.mockReturnValue(noRevengeMock);
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
      }),
    );
    expect(html).toContain('data-testid="warbow-hero-steal-preflight"');
    expect(html).toContain("Daily steal limit");
    expect(html).toMatch(/warbow-hero-steal-preflight[\s\S]*Steal/);
  });
});
