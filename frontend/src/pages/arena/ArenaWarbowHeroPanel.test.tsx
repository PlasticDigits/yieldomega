// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArenaWarbowHeroPanel, type WarbowTarget } from "./ArenaWarbowHeroPanel";

const VICTIM_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const VICTIM_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const mockSetStealVictimInput = vi.fn();

const baseWarbowHero = {
  ready: true,
  saleActive: true,
  isConnected: true,
  canPress: true,
  stealVictim: undefined,
  guardedActive: false,
  guardUntilSec: "0",
  chainNowSec: 1_700_000_000,
  viewerBattlePoints: "1000",
  stealDoubWad: "1000000000000000000",
  guardDoubWad: "2000000000000000000",
  bypassDoubWad: "3000000000000000000",
  revengeDoubWad: "4000000000000000000",
  maxStealsPerDay: "3",
  stealVictimInput: "",
  setStealVictimInput: mockSetStealVictimInput,
  stealVictimFormatError: null as string | null,
  stealBypass: false,
  setStealBypass: vi.fn(),
  pvpErr: null as string | null,
  clearPvpErr: vi.fn(),
  runWarBowSteal: vi.fn(),
  runWarBowGuard: vi.fn(),
  runWarBowRevenge: vi.fn(),
  isWriting: false,
  arenaPaused: false,
};

vi.mock("./useArenaWarbowHero", () => ({
  useArenaWarbowHero: () => baseWarbowHero,
}));

vi.mock("@/components/ChainMismatchWriteBarrier", () => ({
  ChainMismatchWriteBarrier: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/WalletConnectButton", () => ({
  WalletConnectButton: () => null,
}));

vi.mock("@/components/ArenaLevelGate", () => ({
  ArenaLevelGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/arena", () => ({
  PlayerIdentity: ({ address }: { address: string }) => address,
}));

const warbowTargets: WarbowTarget[] = [
  { address: VICTIM_A, battlePoints: "5000", source: "podium", rank: 1 },
  { address: VICTIM_B, battlePoints: "2500", source: "recent" },
];

function renderWarbowPanel(overrides: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(ArenaWarbowHeroPanel, {
      phase: "saleActive",
      playerLevel: 10,
      warbowTargets,
      indexerViewerBattlePoints: 1000n,
      ...overrides,
    }),
  );
}

describe("ArenaWarbowHeroPanel (GitLab #321)", () => {
  beforeEach(() => {
    mockSetStealVictimInput.mockReset();
    baseWarbowHero.pvpErr = null;
    baseWarbowHero.stealVictimInput = "";
    baseWarbowHero.stealVictimFormatError = null;
  });

  it("renders keyboard-accessible WarBow target listbox with roving tabindex", () => {
    const html = renderWarbowPanel();
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="WarBow steal targets"');
    expect(html).toContain('data-warbow-target-index="0"');
    expect(html).toContain(`data-testid="warbow-target-${VICTIM_A.toLowerCase()}"`);
    expect(html).toContain(`data-testid="warbow-target-${VICTIM_B.toLowerCase()}"`);
  });

  it("surfaces WarBow PvP errors with dismiss control", () => {
    baseWarbowHero.pvpErr = "WarBow steal reverted";
    const html = renderWarbowPanel();
    expect(html).toContain("WarBow steal reverted");
    expect(html).toContain("dismiss");
  });

  it("wires arrow-key list navigation on the target listbox", () => {
    const src = readFileSync(resolve(__dirname, "ArenaWarbowHeroPanel.tsx"), "utf8");
    expect(src).toContain("onTargetListKeyDown");
    expect(src).toContain('event.key === "ArrowDown"');
    expect(src).toContain('event.key === "ArrowUp"');
    expect(src).toContain("tabIndex={index === focusedTargetIndex ? 0 : -1}");
  });
});
