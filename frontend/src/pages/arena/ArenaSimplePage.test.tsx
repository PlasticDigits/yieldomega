// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { UseArenaSaleSession } from "./useArenaSaleSession";

const mockSession = vi.fn();

vi.mock("./useArenaSaleSession", () => ({
  useArenaSaleSession: () => mockSession(),
}));

vi.mock("@/hooks/useWalletTargetChainMismatch", () => ({
  useWalletTargetChainMismatch: () => ({ mismatch: false }),
}));

vi.mock("motion/react", () => ({
  motion: {
    button: ({ children, ...props }: { children: ReactNode }) =>
      createElement("button", props, children),
  },
  useReducedMotion: () => true,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: () => {} }),
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
}));

vi.mock("@/hooks/useArenaPlayerLevel", () => ({
  useArenaPlayerLevel: () => ({ levelBigint: 5n, stats: undefined }),
}));

vi.mock("./usePodiumReads", () => ({
  usePodiumReads: () => ({
    podiumRows: [
      { winners: ["0x1111111111111111111111111111111111111111"], values: ["1"], epoch: "1" },
      { winners: ["0x2222222222222222222222222222222222222222"], values: ["2"], epoch: "2" },
      { winners: ["0x3333333333333333333333333333333333333333"], values: ["3"], epoch: "3" },
      { winners: ["0x4444444444444444444444444444444444444444"], values: ["4"], epoch: "4" },
    ],
    podiumPayoutPreview: [
      { places: ["1", "2", "3"] },
      { places: ["1", "2", "3"] },
      { places: ["1", "2", "3"] },
      { places: ["1", "2", "3"] },
    ],
    podiumLoading: false,
  }),
  useWarbowPodiumLiveInvalidation: () => {},
}));

vi.mock("./useTimerPodiumSlideMeta", () => ({
  useTimerPodiumSlideMeta: () => ({
    title: "Last Buy",
    countdownSec: 120,
    slot: { categoryIndex: 0, requiredLevel: 1 },
    lockedForConnection: false,
  }),
}));

vi.mock("./useArenaSimplePageSfx", () => ({
  useArenaSimplePageSfx: () => {},
}));

vi.mock("./useArenaBuyResultSharePopover", () => ({
  useArenaBuyResultSharePopover: () => ({
    card: null,
    cardId: null,
    dismissCard: () => {},
    onBuySuccess: () => {},
  }),
}));

let mockIndexerBaseUrl: string | undefined;

const mockIndexerConnectivity = vi.fn(() => ({
  failureStreak: 0,
  isOffline: false,
  lastOkBanner: null,
  reportAttempt: vi.fn(),
  backoffPollMs: (fastIntervalMs: number) => fastIntervalMs,
}));

vi.mock("@/hooks/useIndexerConnectivity", () => ({
  useIndexerConnectivity: () => mockIndexerConnectivity(),
}));

vi.mock("@/lib/addresses", () => ({
  addresses: { timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
  indexerBaseUrl: () => mockIndexerBaseUrl,
  kumbayaDexUrl: () => "https://kumbaya.example/swap",
}));

vi.mock("@/components/glass", () => ({
  ArenaShell: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./ArenaTimerHero", () => ({
  ArenaTimerHero: () => createElement("div", { "data-testid": "arena-timer-hero-stub" }),
}));

vi.mock("./ArenaCharmCredCard", () => ({
  ArenaCharmCredCard: () => createElement("div", { "data-testid": "arena-charm-cred-card-stub" }),
}));

vi.mock("./ArenaWarbowHeroPanel", () => ({
  ArenaWarbowHeroPanel: () => createElement("div", { "data-testid": "arena-warbow-hero-stub" }),
}));

vi.mock("./ArenaTimerPodiumCarousel", () => ({
  ArenaTimerPodiumCarousel: () =>
    createElement("div", { "data-testid": "arena-timer-podium-carousel-stub" }),
}));

vi.mock("./ArenaTimerChips", () => ({
  ArenaTimerChips: () => createElement("div", { "data-testid": "arena-timer-chips-stub" }),
}));

vi.mock("@/components/WalletConnectButton", () => ({
  WalletConnectButton: () => createElement("button", { type: "button" }, "Connect wallet"),
}));

import { ArenaSimplePage } from "./ArenaSimplePage";

function baseSession(overrides: Partial<UseArenaSaleSession> = {}): UseArenaSaleSession {
  return {
    ready: true,
    phase: "saleActive",
    isPending: false,
    isError: false,
    saleStartSec: 1,
    deadlineSec: 9_999_999,
    ended: false,
    decimals: 18,
    acceptedAsset: "0x1111111111111111111111111111111111111111",
    podiumPoolAddress: undefined,
    launchedDec: 18,
    walletConnected: true,
    walletAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
    walletBalanceWei: 10n ** 21n,
    refetchWalletBalance: () => {},
    walletBalanceRefreshing: false,
    cl8ySpendBounds: { minS: 1n, maxS: 10n ** 21n },
    cl8yCheckoutBoundsGate: { kind: "ready" },
    spendWei: 1000n * 10n ** 18n,
    spendInputStr: "1000",
    spendInputDecimals: 18,
    setSpendFromInput: () => {},
    setSpendFromInputFocus: () => {},
    setSpendFromInputBlur: async () => {},
    setSpendFromSliderPermille: () => {},
    setSpendSliderInteracting: () => {},
    spendSliderPermille: 500,
    charmWadSelected: 1n * 10n ** 18n,
    estimatedSpendWei: 1000n * 10n ** 18n,
    buyCheckoutCharmWeightWad: 1n * 10n ** 18n,
    buyCharmBonusPreviewLines: [],
    preStartCountdownSec: undefined,
    saleCountdownSec: 120,
    lastBuyTimerArmed: true,
    heroCountdownPlaceholder: undefined,
    chainNowSec: 1_700_000_000,
    timerExtensionPreviewSec: 60,
    buyPreviewPolicy: undefined,
    activeDefendedStreak: 0n,
    warbowPendingFlagOwner: undefined,
    warbowPendingFlagPlantAt: 0n,
    walletCooldownRemainingSec: 0,
    walletBuyCharges: 5,
    walletMaxBuyCharges: 5,
    walletNextBuyChargeAtSec: 0,
    buySubmitBusy: false,
    totalRaisedWei: 0n,
    pricePerCharmWad: 1000n * 10n ** 18n,
    epochCharmAnchorWad: 1000n * 10n ** 18n,
    buyEnvelopeParams: null,
    referralRegistryOn: false,
    pendingReferralCode: null,
    useReferral: false,
    setUseReferral: () => {},
    plantWarBowFlag: false,
    setPlantWarBowFlag: () => {},
    warbowFlagClaimBp: undefined,
    warbowFlagSilenceSec: undefined,
    showWarbowClaimFlagButton: false,
    canClaimWarBowFlag: false,
    warbowFlagSilenceEndSec: 0n,
    submitClaimWarBowFlag: async () => {},
    isWriting: false,
    buyError: null,
    clearBuyError: () => {},
    payWith: "doub",
    setPayWith: () => {},
    paySpendBandReady: true,
    isArenaV2: true,
    playCredAddress: undefined,
    credBalanceWei: undefined,
    requiredCredBurnWei: undefined,
    credCheckoutBoundsGate: { kind: "ready" },
    kumbayaRoutingBlocker: null,
    quotedPayInWei: undefined,
    payTokenDecimals: 18,
    swapQuoteLoading: false,
    swapQuoteDisplayLoading: false,
    swapQuoteFailed: false,
    quotedPerCharmPayInWei: undefined,
    perCharmPayQuoteLoading: false,
    perCharmPayQuoteFailed: false,
    quotedBandMinPayInWei: undefined,
    quotedBandMaxPayInWei: undefined,
    bandBoundaryQuotesLoading: false,
    payWalletBalance: { raw: 10n ** 21n, decimals: 18, symbol: "DOUB" },
    charmWalletBalanceWad: 0n,
    refetchCharmWalletBalance: () => {},
    charmWalletBalanceRefreshing: false,
    submitBuy: async () => {},
    arenaPaused: false,
    onchainTimeArenaBuyRouter: undefined,
    refresh: () => {},
    ...overrides,
  };
}

function renderPage(): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ["/arena"] }, createElement(ArenaSimplePage)),
  );
}

describe("ArenaSimplePage (GitLab #321)", () => {
  it("renders command console primary buy and secondary warbow regions", () => {
    mockSession.mockReturnValue(baseSession());
    const html = renderPage();
    expect(html).toContain('data-testid="arena-command-console"');
    expect(html).toContain('data-testid="arena-command-console-primary"');
    expect(html).toContain('data-testid="arena-command-console-warbow"');
    expect(html).toContain('data-testid="arena-simple-buy-charm"');
    expect(html).toContain('aria-label="Buy CHARM — 5 of 5 moves available"');
    expect(html).toContain('data-testid="arena-warbow-hero-stub"');
    expect(html).toContain('data-testid="arena-charm-cred-card-stub"');
  });

  it("surfaces wallet-connect prompt when disconnected during an active sale", () => {
    mockSession.mockReturnValue(
      baseSession({
        walletConnected: false,
        walletAddress: undefined,
      }),
    );
    const html = renderPage();
    expect(html).toContain('class="arena-simple__connect"');
    expect(html).toContain("Connect wallet");
    expect(html).toContain('data-testid="arena-simple-buy-pay"');
    expect(html).toContain('data-testid="arena-simple-buy-receive"');
    expect(html).toContain("You pay");
    expect(html).not.toMatch(/arena-simple__amount-token-combobox[^>]*disabled/);
    expect(html).not.toMatch(/arena-simple__amount-field[^>]*disabled/);
    expect(html).not.toMatch(/arena-simple__pay-slider[^>]*disabled/);
  });

  it("keeps YOU PAY visible when wallet balance cannot cover live bounds", () => {
    mockSession.mockReturnValue(
      baseSession({
        cl8ySpendBounds: null,
        cl8yCheckoutBoundsGate: {
          kind: "insufficient_cl8y",
          minSpendWei: 30_020_000_000_000_000_000_000n,
          walletBalanceWei: 0n,
        },
        walletBalanceWei: 0n,
        payWalletBalance: { raw: 0n, decimals: 18, symbol: "DOUB" },
      }),
    );
    const html = renderPage();
    const payPos = html.indexOf('data-testid="arena-simple-buy-pay"');
    const receivePos = html.indexOf('data-testid="arena-simple-buy-receive"');
    expect(payPos).toBeGreaterThan(0);
    expect(receivePos).toBeGreaterThan(payPos);
    expect(html).toContain("Insufficient DOUB");
  });

  it("keeps routed slippage footnote below buy and drops verbose quote errors", () => {
    mockSession.mockReturnValue(
      baseSession({
        payWith: "eth",
        swapQuoteFailed: true,
      }),
    );
    const html = renderPage();
    const footnotePos = html.indexOf("arena-simple__routed-buy-footnote");
    const swapPos = html.indexOf("arena-simple__swap-stack");
    expect(footnotePos).toBeGreaterThan(swapPos);
    expect(html).toContain("Routed buys use a fixed");
    expect(html).not.toContain("Could not quote this route");
  });

  it("shows +5 Guide CRED in buy preview pills when a referral bonus applies", () => {
    mockSession.mockReturnValue(
      baseSession({
        referralRegistryOn: true,
        pendingReferralCode: "luck777",
        useReferral: true,
        buyCharmBonusPreviewLines: ["+5 Guide CRED"],
      }),
    );
    const html = renderPage();
    expect(html).toContain('data-testid="arena-simple-buy-preview"');
    expect(html).toContain("+5 Guide CRED");
    expect(html).toContain("Last Buyer");
    expect(html).not.toContain('data-testid="arena-simple-buy-preview-bonuses"');
  });
});

describe("ArenaSimplePage smoke regions (GitLab #321)", () => {
  const src = readFileSync(resolve(__dirname, "ArenaSimplePage.tsx"), "utf8");

  it("exposes contextual aria-label on the primary buy CTA", () => {
    expect(src).toContain('data-testid="arena-simple-buy-charm"');
    expect(src).toContain("aria-label={");
    expect(src).toContain("Buy CHARM with ${paySpendSuffix}");
    expect(src).toContain("Buy CHARM — processing transaction");
  });

  it("keeps indexer-first WarBow display wiring (#301)", () => {
    expect(src).toContain("indexerWarbowHead");
    expect(src).toContain("resolveIndexerViewerWarbowBattlePoints");
    expect(src).toContain("ArenaWarbowHeroPanel");
  });

  it("renders timer, podium carousel, and spend controls test ids", () => {
    expect(src).toContain('data-testid="arena-simple-amount-pay-token"');
    expect(src).toContain("payTokenSelectDisabled");
    expect(src).toContain("spendControlsDisabled");
    expect(src).toContain("Preview-only: amount + slider stay editable");
    expect(src).toContain("ArenaTimerPodiumCarousel");
    expect(src).toContain("ArenaTimerChips");
    expect(src).toContain("ArenaCharmCredCard");
  });
});

describe("ArenaSimplePage indexer offline banner (GitLab #354)", () => {
  const src = readFileSync(resolve(__dirname, "ArenaSimplePage.tsx"), "utf8");

  it("mounts IndexerStatusBar on the play surface", () => {
    expect(src).toContain("IndexerStatusBar");
    expect(src).toContain('data-testid="arena-simple-indexer-status"');
  });

  it("shows offline retrying copy when connectivity hook reports offline", () => {
    mockIndexerBaseUrl = "http://127.0.0.1:3100";
    mockIndexerConnectivity.mockReturnValue({
      failureStreak: 3,
      isOffline: true,
      lastOkBanner: null,
      reportAttempt: vi.fn(),
      backoffPollMs: (fastIntervalMs: number) => fastIntervalMs,
    });
    mockSession.mockReturnValue(baseSession());
    const html = renderPage();
    const footerPos = html.indexOf('data-testid="footer-site-links-card"');
    const indexerPos = html.indexOf('data-testid="arena-simple-indexer-status"');
    expect(footerPos).toBeGreaterThan(0);
    expect(indexerPos).toBeGreaterThan(footerPos);
    expect(html).toContain("INDEXER · offline · retrying");
    expect(html).not.toContain("INDEXER · v");
    expect(html).not.toContain("· live");
  });
});

describe("ArenaSimplePage #331 visual feature wiring", () => {
  const src = readFileSync(resolve(__dirname, "ArenaSimplePage.tsx"), "utf8");

  it("wires next-level lock overlays via LockedUntilLevel (#334)", () => {
    expect(src).toContain("LockedUntilLevel");
    expect(src).toContain("FEATURE_UNLOCK_LEVEL");
  });

  it("wires level-up celebration popover for L2+ unlocks (#335)", () => {
    expect(src).toContain("useArenaLevelUpCelebration");
    expect(src).toContain("LevelUpCelebrationPopover");
  });

  it("wires post-buy result share popover on successful buys (#365)", () => {
    expect(src).toContain("useArenaBuyResultSharePopover");
    expect(src).toContain("ArenaBuyResultSharePopover");
    expect(src).toContain("onBuyResultShareSuccess");
    expect(src).toContain("celebrationActive");
  });
});
