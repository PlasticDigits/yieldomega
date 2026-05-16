// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/WalletConnectButton", () => ({
  WalletConnectButton: () =>
    createElement("button", { type: "button", "data-testid": "mock-wallet-connect" }, "Connect"),
}));
import type { WalletFormatShort } from "@/lib/addressFormat";
import { describeStealPreflight } from "@/lib/timeCurveUx";
import {
  WarbowHeroActions,
  type WarbowStealCandidate,
  type WarbowStealHeroRow,
} from "./WarbowHeroActions";

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

const fmt: WalletFormatShort = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—");

function stealHeroRowsFromCandidates(
  victimCapIndices: Set<number> = new Set(),
  opts: {
    stealBypass?: boolean;
    stealBypassByVictim?: Record<string, boolean>;
    victimGuardedIndices?: Set<number>;
  } = {},
): WarbowStealHeroRow[] {
  const max = 3n;
  const viewer = "0x9999999999999999999999999999999999999999" as const;
  const stealBypass = opts.stealBypass ?? false;
  const stealBypassByVictim = opts.stealBypassByVictim ?? {};
  const victimGuardedIndices = opts.victimGuardedIndices ?? new Set<number>();
  return candidates.map((c, i) => {
    const victimSteals = victimCapIndices.has(i) ? 3n : 1n;
    const victimBp = BigInt(c.battlePoints);
    const victimAtDailyCap = victimSteals >= max;
    const key = c.address.toLowerCase();
    const bypassSelected =
      stealBypass || (victimAtDailyCap && (stealBypassByVictim[key] ?? false));
    const victimGuardedActive = victimGuardedIndices.has(i);
    const preflight = describeStealPreflight(
      {
        connected: true,
        saleActive: true,
        saleEnded: false,
        viewer,
        victim: c.address,
        viewerBattlePoints: 400n,
        victimBattlePoints: victimBp,
        victimStealsToday: victimSteals,
        attackerStealsToday: 0n,
        maxStealsPerDay: max,
        bypassSelected,
        guardActive: victimGuardedActive,
      },
      fmt,
    );
    return {
      candidate: c,
      preflight,
      victimAtDailyCap,
      victimStealsReceivedToday: victimSteals,
      maxStealsPerDay: max,
      victimGuardedActive,
    };
  });
}

function renderHero(overrides: Partial<Parameters<typeof WarbowHeroActions>[0]> = {}) {
  const props: Parameters<typeof WarbowHeroActions>[0] = {
    saleActive: true,
    saleEnded: false,
    isConnected: true,
    address: "0x9999999999999999999999999999999999999999",
    formatWallet: fmt,
    viewerBattlePoints: "400",
    stealHeroRows: stealHeroRowsFromCandidates(),
    attackerAtDailyStealCap: false,
    stealBypass: false,
    setStealBypass: () => {},
    stealBypassByVictim: {},
    setStealBypassForVictim: () => {},
    runWarBowSteal: async () => {},
    runWarBowGuard: async () => {},
    runWarBowRevenge: async () => {},
    guardedActive: false,
    guardChainNowSec: 1_000_000,
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
    warbowRank: 3,
    viewerStealsToday: 0n,
    warbowMaxStealsPerDay: 3,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(WarbowHeroActions, props));
}

describe("WarbowHeroActions", () => {
  it("hides the wallet connect CTA when a wallet is connected", () => {
    const html = renderHero();
    expect(html).not.toContain("warbow-hero-actions__wallet");
    expect(html).not.toContain("data-testid=\"mock-wallet-connect\"");
    expect(html).not.toContain("Wallet context");
    expect(html).toContain("data-testid=\"warbow-hero-viewer-summary\"");
    expect(html).toContain("YOUR RANK:");
    expect(html).toContain("#3");
    expect(html).toContain("YOUR BP:");
    expect(html).toContain("400 BP");
    expect(html).toContain("YOUR STEALS TODAY:");
    expect(html).toContain("0/3");
    expect(html).toContain("STEALS REFRESH IN:");
    expect(html).toContain("data-testid=\"warbow-hero-viewer-steals-refresh\"");
  });

  it("shows the wallet connect CTA in the root hero actions when disconnected", () => {
    const html = renderHero({
      isConnected: false,
      address: undefined,
      viewerBattlePoints: undefined,
      stealHeroRows: stealHeroRowsFromCandidates(),
    });
    expect(html).not.toContain("warbow-hero-actions__wallet");
    expect(html).not.toContain("Connect before PvP");
    expect(html).toContain("data-testid=\"mock-wallet-connect\"");
    expect(html).not.toContain("data-testid=\"warbow-hero-viewer-summary\"");
  });

  it("puts steal, guard, and revenge actions in the hero cluster", () => {
    const html = renderHero();
    expect(html).toContain("WarBow hero actions");
    expect(html).toContain("STEAL");
    expect(html).toContain("Activate guard");
    expect(html).toContain("Take revenge");
    expect(html).toContain("reduce incoming steals by 90%");
    expect(html).toContain("for 6 hours");
    expect(html).toContain("INACTIVE");
  });

  it("shows HH:MM:SS guard countdown when guard window is open", () => {
    const html = renderHero({
      guardUntilSec: "1000300",
      guardChainNowSec: 1_000_000,
      guardedActive: true,
    });
    expect(html).toContain("00:05:00");
    expect(html).not.toContain("INACTIVE");
  });

  it("renders suggested steal rows for the hero list", () => {
    const html = renderHero();
    expect(html).toContain("Suggested WarBow steal targets");
    expect(html.match(/data-testid="warbow-hero-steal-candidate"/g)?.length).toBe(2);
    expect(html).toContain("Unguarded");
    expect(html).not.toContain("warbow-hero-candidate-row__guard-status--guarded");
    expect(html).toContain("1/3 steals");
    expect(html).not.toContain("Steal looks eligible");
  });

  it("shows Guarded in red styling when the victim guard read is active", () => {
    const html = renderHero({
      stealHeroRows: stealHeroRowsFromCandidates(new Set(), { victimGuardedIndices: new Set([0]) }),
    });
    expect(html).toContain(">Guarded<");
    expect(html).toContain("warbow-hero-candidate-row__guard-status--guarded");
    expect(html).toContain("Unguarded");
    expect(html).toContain("warbow-hero-candidate-row__guard-status--unguarded");
  });

  it("shows per-victim bypass when that victim hit the UTC-day steal cap", () => {
    const html = renderHero({
      stealHeroRows: stealHeroRowsFromCandidates(new Set([0])),
    });
    expect(html).toContain("Pay ");
    expect(html).toContain("CL8Y");
  });

  it("shows an em dash for rank when the wallet is not on the indexer ladder", () => {
    const html = renderHero({ warbowRank: null });
    expect(html).toContain("YOUR RANK:");
    expect(html).toContain(">—<");
  });

  it("shows an em dash for BP while the onchain read is absent", () => {
    const html = renderHero({ viewerBattlePoints: undefined });
    expect(html).toContain("YOUR BP:");
    expect(html).toContain(">—<");
  });

  it("shows steals refresh countdown aligned to UTC day from chain now", () => {
    const html = renderHero({ guardChainNowSec: 86_400 - 3661 });
    expect(html).toContain("STEALS REFRESH IN:");
    expect(html).toContain(">01:01:01<");
  });

  it("shows em dash steals numerator while the onchain read is loading", () => {
    const html = renderHero({ viewerStealsToday: undefined });
    expect(html).toContain("YOUR STEALS TODAY:");
    expect(html).toContain("—/3");
  });

  it("shows an explicit empty state when no candidate is available", () => {
    const html = renderHero({ stealHeroRows: [] });
    expect(html).toContain("No indexed 2x BP steal target yet");
  });

  it("does not repeat wallet-connect steal preflight under each row when disconnected", () => {
    const viewer = "0x9999999999999999999999999999999999999999" as const;
    const max = 3n;
    const rowsDisconnected: WarbowStealHeroRow[] = candidates.map((c) => ({
      candidate: c,
      victimAtDailyCap: false,
      victimStealsReceivedToday: 0n,
      maxStealsPerDay: max,
      preflight: describeStealPreflight(
        {
          connected: false,
          saleActive: true,
          saleEnded: false,
          viewer,
          victim: c.address,
          viewerBattlePoints: 400n,
          victimBattlePoints: BigInt(c.battlePoints),
          victimStealsToday: 0n,
          attackerStealsToday: 0n,
          maxStealsPerDay: max,
          bypassSelected: false,
          guardActive: false,
        },
        fmt,
      ),
    }));
    const html = renderHero({
      isConnected: false,
      address: undefined,
      viewerBattlePoints: undefined,
      stealHeroRows: rowsDisconnected,
    });
    expect(html).not.toContain("Connect to inspect WarBow");
    expect(html).not.toContain("Live BP reads, victim + attacker UTC-day steal caps");
    expect(html).toContain("Suggested WarBow steal targets");
  });

  it("renders BP-too-low prospect rows with disabled STEAL chrome and Too low BP label", () => {
    const max = 3n;
    const viewer = "0x9999999999999999999999999999999999999999" as const;
    const prospectAddr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const prospect: WarbowStealHeroRow = {
      candidate: {
        address: prospectAddr,
        battlePoints: "500",
        rank: 5,
        source: "indexer",
      },
      victimAtDailyCap: false,
      victimStealsReceivedToday: 0n,
      maxStealsPerDay: max,
      victimGuardedActive: false,
      preflight: describeStealPreflight(
        {
          connected: true,
          saleActive: true,
          saleEnded: false,
          viewer,
          victim: prospectAddr,
          viewerBattlePoints: 400n,
          victimBattlePoints: 500n,
          victimStealsToday: 0n,
          attackerStealsToday: 0n,
          maxStealsPerDay: max,
          bypassSelected: false,
          guardActive: false,
        },
        fmt,
      ),
      bpBelowStealThreshold: true,
    };
    const html = renderHero({
      stealHeroRows: [...stealHeroRowsFromCandidates(), prospect],
    });
    expect(html).toContain("data-testid=\"warbow-hero-steal-prospect\"");
    expect(html).toContain("Too low BP");
    expect(html).toContain("warbow-hero-candidate-row__bp-too-low");
    expect(html).toContain("warbow-hero-candidate-row__steal--prospect");
    const prospectStealIdx = html.indexOf("warbow-hero-candidate-row__steal--prospect");
    expect(prospectStealIdx).toBeGreaterThan(-1);
    expect(html.slice(prospectStealIdx, prospectStealIdx + 160)).toMatch(/disabled/);
  });

  it("shows attacker-cap bypass banner when the wallet hit its daily steal cap", () => {
    const html = renderHero({ attackerAtDailyStealCap: true });
    expect(html).toContain("wallet");
    expect(html).toContain("daily steal cap");
  });
});
