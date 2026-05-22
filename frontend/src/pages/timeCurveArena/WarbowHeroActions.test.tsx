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
    stealerBpByAddress: new Map<string, bigint | undefined>(),
    ledgerNowSec: 1_000_000,
    revengeIndexerConfigured: true,
    warbowGuardBurnWad: "10000000000000000000",
    warbowBypassBurnWad: "50000000000000000000",
    buyFeeRoutingEnabled: true,
    isWriting: false,
    warbowRank: 3,
    viewerStealsToday: 0n,
    warbowMaxStealsPerDay: 3,
    showClaimFlagBlock: false,
    canClaimWarBowFlag: false,
    flagSilenceEndSec: 0n,
    warbowFlagClaimBp: 1000n,
    runWarBowClaimFlag: async () => {},
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

  it("renders BP-too-high prospect rows with disabled STEAL chrome and Too high BP label", () => {
    const max = 3n;
    const viewer = "0x9999999999999999999999999999999999999999" as const;
    const prospectAddr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
    const prospect: WarbowStealHeroRow = {
      candidate: {
        address: prospectAddr,
        battlePoints: "5000",
        rank: 2,
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
          victimBattlePoints: 5000n,
          victimStealsToday: 0n,
          attackerStealsToday: 0n,
          maxStealsPerDay: max,
          bypassSelected: false,
          guardActive: false,
        },
        fmt,
      ),
      bpAboveStealBand: true,
    };
    const html = renderHero({
      stealHeroRows: [...stealHeroRowsFromCandidates(), prospect],
    });
    expect(html).toContain("data-testid=\"warbow-hero-steal-prospect\"");
    expect(html).toContain("Too high BP");
    expect(html).toContain("warbow-hero-candidate-row__bp-too-high");
  });

  it("shows an explicit empty state when no candidate is available", () => {
    const html = renderHero({ stealHeroRows: [] });
    expect(html).toContain("No indexed in-band steal target yet");
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

  it("hides the claim-flag hero card when the viewer does not hold the pending flag", () => {
    const html = renderHero({ showClaimFlagBlock: false });
    expect(html).not.toContain("data-testid=\"warbow-hero-claim-flag\"");
  });

  it("shows the claim-flag hero card with silence countdown when the viewer holds the pending flag", () => {
    const html = renderHero({
      showClaimFlagBlock: true,
      canClaimWarBowFlag: false,
      flagSilenceEndSec: 1_000_300n,
      guardChainNowSec: 1_000_000,
    });
    expect(html).toContain("data-testid=\"warbow-hero-claim-flag\"");
    expect(html).toContain("Claim flag 00:05:00");
    expect(html).toContain("+1,000 BP if you claim after the silence window");
  });

  it("enables claim flag CTA after silence when canClaimWarBowFlag is true", () => {
    const html = renderHero({
      showClaimFlagBlock: true,
      canClaimWarBowFlag: true,
      flagSilenceEndSec: 1_000_000n,
      guardChainNowSec: 1_000_400,
    });
    expect(html).toContain("data-testid=\"warbow-hero-claim-flag-submit\"");
    const submitIdx = html.indexOf("data-testid=\"warbow-hero-claim-flag-submit\"");
    expect(html.slice(submitIdx, submitIdx + 120)).not.toMatch(/disabled/);
    expect(html).toContain(">Claim flag<");
  });

  // GitLab #236 — revenge hero card refactor
  it("does not show the redundant 'You have N open counter-hits' summary paragraph (GitLab #236)", () => {
    const html = renderHero();
    expect(html).not.toContain("open counter-hit");
    expect(html).not.toContain("Earliest expiry");
  });

  it("renders per-row Target BP and Gain when stealer BP is loaded (GitLab #236)", () => {
    const stealerAddr = "0x3333333333333333333333333333333333333333";
    const stealerBpByAddress = new Map<string, bigint | undefined>([
      [stealerAddr.toLowerCase(), 12_400n],
    ]);
    const html = renderHero({ stealerBpByAddress });
    expect(html).toContain("Target:");
    expect(html).toContain("12,400 BP");
    expect(html).toContain("Gain:");
    // warbowRevengeDrainBp(12400) = 12400 / 10 = 1240 BP
    expect(html).toContain("+1,240 BP");
    expect(html).toContain("data-testid=\"warbow-hero-revenge-bp\"");
  });

  it("shows a loading hint when stealer BP is still in flight (GitLab #236)", () => {
    // Default stealerBpByAddress is an empty Map -> undefined for every stealer
    const html = renderHero();
    expect(html).toContain("Loading BP…");
    expect(html).toContain("data-testid=\"warbow-hero-revenge-bp\"");
  });

  it("shows 'Revenge zero' hint when drain math floors to 0 (GitLab #236)", () => {
    const stealerAddr = "0x3333333333333333333333333333333333333333";
    // stealerBp=5 -> drain = 5*1000/10000 = 0 (floor)
    const stealerBpByAddress = new Map<string, bigint | undefined>([
      [stealerAddr.toLowerCase(), 5n],
    ]);
    const html = renderHero({ stealerBpByAddress });
    expect(html).toContain("Target:");
    expect(html).toContain("5 BP");
    expect(html).toContain("Revenge zero");
    expect(html).not.toContain("Gain:");
  });

  it("renders a live Valid To countdown that reflects ledgerNowSec (GitLab #236)", () => {
    // expiry_exclusive = 1893456000 (default fixture), use ledgerNowSec values 5 min and 4 min apart.
    const expirySec = 1_893_456_000;
    const fiveMinBefore = expirySec - 300; // remaining = 5 minutes
    const fourMinBefore = expirySec - 240; // remaining = 4 minutes
    const htmlAtFiveMin = renderHero({ ledgerNowSec: fiveMinBefore });
    expect(htmlAtFiveMin).toContain("Valid To:");
    expect(htmlAtFiveMin).toContain("00:05:00");
    const htmlAtFourMin = renderHero({ ledgerNowSec: fourMinBefore });
    expect(htmlAtFourMin).toContain("Valid To:");
    expect(htmlAtFourMin).toContain("00:04:00");
    // Confirm the countdown string actually changed (not a static label)
    expect(htmlAtFiveMin).not.toBe(htmlAtFourMin);
  });

  it("clamps Valid To countdown to 00:00:00 when ledgerNowSec is past expiry (GitLab #236)", () => {
    const expirySec = 1_893_456_000;
    const html = renderHero({ ledgerNowSec: expirySec + 60 });
    expect(html).toContain("Valid To:");
    expect(html).toContain("00:00:00");
  });

  it("does not render UTC UnixTimestampDisplay in revenge rows (GitLab #236)", () => {
    const html = renderHero();
    // UnixTimestampDisplay renders with a UTC suffix or ISO timestamp pattern; ensure neither leaks in
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(html).not.toContain(" UTC");
  });
});
