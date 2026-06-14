import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

describe("Arena command-console production surface (GitLab #291)", () => {
  const timeArenaPage = fs.readFileSync(
    path.resolve(__dirname, "../pages/TimeArenaPage.tsx"),
    "utf8",
  );
  const arenaSimplePage = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaSimplePage.tsx"),
    "utf8",
  );
  const arenaCharmCredCard = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaCharmCredCard.tsx"),
    "utf8",
  );
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const arenaE2e = fs.readFileSync(path.resolve(__dirname, "../../e2e/arena.spec.ts"), "utf8");
  const homePage = fs.readFileSync(path.resolve(__dirname, "../pages/HomePage.tsx"), "utf8");
  const launchCountdownPage = fs.readFileSync(
    path.resolve(__dirname, "../pages/LaunchCountdownPage.tsx"),
    "utf8",
  );
  const arenaTimerHero = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaTimerHero.tsx"),
    "utf8",
  );
  const arenaProtocolPage = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaProtocolPage.tsx"),
    "utf8",
  );
  const surfaceContent = fs.readFileSync(path.resolve(__dirname, "./surfaceContent.ts"), "utf8");
  const webAudioMixer = fs.readFileSync(path.resolve(__dirname, "../audio/WebAudioMixer.ts"), "utf8");

  it("mounts one production command console instead of the concept-plus-legacy stack", () => {
    expect(timeArenaPage).not.toContain("ArenaThemeConcepts");
    expect(timeArenaPage).not.toContain("<ArenaTimerChips />");
    expect(arenaSimplePage).toContain('data-testid="arena-command-console"');
    expect(arenaSimplePage).toContain('data-testid="arena-command-console-primary"');
    expect(arenaE2e).toContain('page.locator(".arena-final-concept")).toHaveCount(0)');
  });

  it("keeps Last Buy and inline CHARM purchase mechanics surfaced", () => {
    expect(arenaSimplePage).toContain('aria-label="Arena podium timers"');
    expect(arenaSimplePage).not.toContain("commandDecisionRow");
    expect(arenaSimplePage).not.toContain("arena-command-console__decision-row");
    expect(arenaSimplePage).toContain("arena-simple__pay-slider-row--pay-");
    expect(arenaSimplePage).toContain('data-testid="arena-simple-buy-receive"');
    expect(arenaSimplePage).toContain("<ArenaTimerHero");
    expect(arenaSimplePage).toContain("<ArenaTimerPodiumCarousel");
    expect(arenaSimplePage).toContain("useTimerPodiumSlideMeta");
    expect(arenaSimplePage).toContain("arena-simple__timer-panel-stack");
    expect(arenaSimplePage).not.toContain("<ArenaLastBuyPodiumChip");
    expect(arenaSimplePage).toContain("<ArenaTimerChips");
    expect(arenaSimplePage).toContain("podiumRows={podiumReads.data}");
    expect(arenaSimplePage).toContain("onOpenWalletProfile={onOpenWalletProfile}");
    expect(arenaCharmCredCard).toContain("<ArenaXpHero />");
    expect(arenaSimplePage).toContain('data-testid="arena-command-console-warbow"');
    expect(arenaSimplePage).toContain("arena-command-console__hub-warbow");
    expect(arenaSimplePage).toContain("arena-simple__warbow-gate");
    expect(arenaSimplePage).toContain("<ArenaWarbowHeroPanel");
    expect(arenaSimplePage).toMatch(/<ArenaWarbowHeroPanel[\s\S]*onOpenWalletProfile=\{onOpenWalletProfile\}/);
  });

  it("uses the cyberminimalist console CSS", () => {
    expect(css).toContain("Arena production command console (GitLab #291)");
    expect(css).toContain("yieldomega-glass-arena.css");
    expect(css).toContain(".arena-command-console__grid");
    expect(css).toContain(".arena-command-console__hub-warbow");
    expect(css).toContain(".arena-command-console__warbow-lane");
    expect(css).toContain("grid-area: console-primary");
    expect(css).toContain(".arena-command-console__primary-column");
    expect(css).toContain("grid-area: console-side");
    expect(css).toContain(".arena-command-console .arena-simple__connect-pitch");
    expect(css).toContain(".arena-command-console .arena-simple__connect .wallet-action--connect");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(arenaSimplePage).toContain("glass-arena-console");
  });

  it("uses cyberminimalist scene backplates instead of arcade JPGs (GitLab #297)", () => {
    const sceneConsumers = [
      homePage,
      launchCountdownPage,
      arenaTimerHero,
      arenaProtocolPage,
      surfaceContent,
      css,
    ].join("\n");

    expect(sceneConsumers).toContain("/art/scenes/home-command-console.svg");
    expect(sceneConsumers).toContain("/art/scenes/launch-countdown-command-console.svg");
    expect(sceneConsumers).toContain("/art/scenes/arena-simple-command-console.svg");
    expect(sceneConsumers).toContain("/art/scenes/arena-arena-command-console.svg");
    expect(sceneConsumers).toContain("/art/scenes/arena-protocol-command-console.svg");
    expect(sceneConsumers).toContain("/art/scenes/referrals-network-command-console.svg");
    expect(sceneConsumers).not.toMatch(
      /\/art\/scenes\/(arena-simple|arena-arena|arena-protocol|home-hero-desktop|home-hero-mobile|launch-countdown|referrals-network)\.jpg/,
    );
  });

  it("keeps motion and audio tactical instead of arcade-dense (GitLab #297)", () => {
    expect(css).toContain("command-console timer bay");
    expect(css).not.toContain("arcade timer stage");
    expect(css).not.toContain("vending machine");
    expect(webAudioMixer).toContain("const PEER_BUY_MIN_GAP_MS = 5_000");
    expect(webAudioMixer).toContain("const TIMER_CALM_MIN_GAP_MS = 75_000");
    expect(webAudioMixer).toContain("const TIMER_URGENT_MIN_GAP_MS = 40_000");
  });
});
