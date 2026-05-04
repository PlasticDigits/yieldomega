// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WarbowHeroActions, type WarbowStealCandidate } from "./WarbowHeroActions";

const candidates: WarbowStealCandidate[] = [
  {
    address: "0x1111111111111111111111111111111111111111",
    battlePoints: "1200",
    rank: 1,
    source: "contract",
  },
  {
    address: "0x2222222222222222222222222222222222222222",
    battlePoints: "900",
    rank: 2,
    source: "indexer",
  },
];

function renderHero(overrides: Partial<Parameters<typeof WarbowHeroActions>[0]> = {}) {
  const props: Parameters<typeof WarbowHeroActions>[0] = {
    saleActive: true,
    saleEnded: false,
    isConnected: true,
    address: "0x9999999999999999999999999999999999999999",
    formatWallet: (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—"),
    viewerBattlePoints: "400",
    stealCandidates: candidates,
    stealVictim: candidates[0].address,
    setStealVictimInput: () => {},
    victimStealsToday: "1",
    victimBattlePoints: "1200",
    warbowMaxSteals: 3,
    stealBypass: false,
    setStealBypass: () => {},
    stealPreflight: {
      tone: "success",
      title: "Steal eligible",
      detail: "Victim has at least 2x your BP.",
    },
    warbowPreflightIssue: null,
    runWarBowSteal: async () => {},
    runWarBowGuard: async () => {},
    runWarBowRevenge: async (_stealer?: `0x${string}`) => {},
    guardedActive: false,
    guardUntilSec: "0",
    hasRevengeOpen: true,
    pendingRevengeTargets: [
      {
        stealer: "0x3333333333333333333333333333333333333333",
        expiry_exclusive: "1893456000",
        steal_seq: "1",
        window_block_number: "1",
        window_log_index: 0,
      },
    ],
    revengeIndexerConfigured: true,
    revengeDeadlineSec: "1893456000",
    warbowGuardBurnWad: "10000000000000000000",
    warbowBypassBurnWad: "50000000000000000000",
    buyFeeRoutingEnabled: true,
    isWriting: false,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(WarbowHeroActions, props));
}

describe("WarbowHeroActions", () => {
  it("puts steal, guard, and revenge actions in the hero cluster", () => {
    const html = renderHero();
    expect(html).toContain("WarBow hero actions");
    expect(html).toContain("Attempt steal");
    expect(html).toContain("Activate guard");
    expect(html).toContain("Take revenge");
  });

  it("renders selectable indexed steal candidates before manual fallback", () => {
    const html = renderHero();
    expect(html).toContain("Suggested WarBow steal targets");
    expect(html).toContain("podium read");
    expect(html).toContain("indexed ladder");
    expect(html).toContain("Steals today");
  });

  it("shows an explicit empty state when no candidate is available", () => {
    const html = renderHero({ stealCandidates: [], stealVictim: undefined });
    expect(html).toContain("No indexed 2x BP steal target yet");
  });
});
