// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("@/lib/addresses", () => ({
  addresses: { timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
  indexerBaseUrl: () => undefined,
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
    spendSliderPermille: 500,
    charmWadSelected: 1n * 10n ** 18n,
    estimatedSpendWei: 1000n * 10n ** 18n,
    buyCheckoutCharmWeightWad: 1n * 10n ** 18n,
    buyCharmBonusPreviewLines: [],
    preStartCountdownSec: undefined,
    saleCountdownSec: 120,
    chainNowSec: 1_700_000_000,
    timerExtensionPreviewSec: 60,
    buyPreviewPolicy: undefined,
    activeDefendedStreak: 0n,
    warbowPendingFlagOwner: undefined,
    warbowPendingFlagPlantAt: 0n,
    walletCooldownRemainingSec: 0,
    buySubmitBusy: false,
    totalRaisedWei: 0n,
    pricePerCharmWad: 1000n * 10n ** 18n,
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
    payWith: "cl8y",
    setPayWith: () => {},
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
    expect(html).toContain('aria-label="Buy CHARM with DOUB"');
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
  });
});
