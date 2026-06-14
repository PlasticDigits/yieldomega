// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaWarbowHeroPanel, type WarbowTarget } from "./ArenaWarbowHeroPanel";

const mockWarbowHero = vi.fn();

vi.mock("./useArenaWarbowHero", () => ({
  useArenaWarbowHero: () => mockWarbowHero(),
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
  viewerBattlePoints: "100",
  stealDoubWad: "1000000000000000000000",
  guardDoubWad: "10000000000000000000000",
  bypassDoubWad: "500000000000000000000",
  revengeDoubWad: "2000000000000000000000",
  maxStealsPerDay: 3,
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

describe("ArenaWarbowHeroPanel (GitLab #321)", () => {
  it("renders steal target listbox with roving tabindex on the first option", () => {
    mockWarbowHero.mockReturnValue(baseHook);
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
    const html = renderToStaticMarkup(
      createElement(ArenaWarbowHeroPanel, {
        phase: "saleActive",
        playerLevel: 5,
        warbowTargets,
      }),
    );
    expect(html).toContain("Time Arena is paused onchain");
  });
});
