import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

function cssBlock(css: string, selector: string, window = 900): string {
  const idx = css.indexOf(selector);
  expect(idx, `expected ${selector} in index.css`).toBeGreaterThanOrEqual(0);
  return css.slice(idx, idx + window);
}

describe("Time Arena responsive layout CSS (GitLab #201)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const rootLayout = fs.readFileSync(path.resolve(__dirname, "../layout/RootLayout.tsx"), "utf8");
  const simplePage = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaSimplePage.tsx"),
    "utf8",
  );

  it("keeps the Simple buy panel free of the former floating coin-stack cutout", () => {
    expect(simplePage).not.toContain("panel-cutout--coin-stack");
    expect(simplePage).not.toContain("/art/hat-coin-stack.png");
    expect(css).not.toContain(".arena-simple__buy-panel .chain-write-gate");
  });

  it("collapses the phone-width buy-panel slider layout", () => {
    const block = cssBlock(css, "@container arenaSimplePage (max-width: 520px)", 1_500);
    expect(block).toContain(".arena-simple__slider-row");
    expect(block).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("keeps the Simple hub timer column from stretching when the buy panel grows", () => {
    const block = cssBlock(css, ".arena-simple__hub > .arena-simple__timer-panel", 220);
    expect(block).toContain("align-self: start");
  });

  it("stacks Simple hub timer heading + countdown from the top of the panel", () => {
    const block = cssBlock(css, ".arena-simple__timer-panel.data-panel", 420);
    expect(block).toContain("justify-content: flex-start");
  });

  it("reserves bottom padding on the Simple hub timer panel for the extension chip", () => {
    const anchor =
      "/* Reserve the bottom-right of the timer panel so the section heading / digits";
    const idx = css.indexOf(anchor);
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(idx, idx + 280);
    expect(block).toContain("padding-bottom: clamp(2rem, 4.5vw, 2.75rem)");
  });

  it("keeps the command-console timer panel content-height instead of a fixed min-height", () => {
    const anchor = ".arena-command-console .arena-simple__timer-panel.data-panel {\n  min-height: 0;";
    expect(css).toContain(anchor);
    expect(css).not.toContain("min-height: clamp(18rem, 34vw, 24rem)");
  });

  it("stacks and centres the command-console timer heading above the countdown", () => {
    const block = cssBlock(
      css,
      ".arena-command-console .arena-simple__timer-panel.data-panel {\n  min-height: 0;",
      420,
    );
    expect(block).toContain("display: flex");
    expect(block).toContain("flex-direction: column");
    expect(block).toContain("align-items: center");
    expect(block).toContain("padding: clamp(0.55rem, 1.2vw, 0.72rem) clamp(0.38rem, 0.85vw, 0.52rem)");

    const headingBlock = cssBlock(
      css,
      ".arena-command-console .arena-simple__timer-panel .section-heading {",
      180,
    );
    expect(headingBlock).toContain("text-align: center");

    const clockBlock = cssBlock(css, ".arena-command-console .arena-simple__timer-clock {", 180);
    expect(clockBlock).toContain("justify-content: center");
  });

  it("keeps the command-console hub from stretching when the side rail is taller", () => {
    const gridBlock = cssBlock(css, ".arena-command-console__grid {", 420);
    expect(gridBlock).toContain("align-items: start");

    const hubBlock = cssBlock(css, ".arena-command-console .arena-simple__hub {", 280);
    expect(hubBlock).toContain("align-content: start");
    expect(hubBlock).toContain("align-items: start");

    const panelBlock = cssBlock(
      css,
      ".arena-command-console .arena-simple__hub > .data-panel,\n.arena-command-console .arena-simple__hub > .arena-simple__buy-panel {",
      220,
    );
    expect(panelBlock).toContain("align-self: start");
  });

  it("lays out Last Buy leaders beside the command-console timer bay", () => {
    expect(simplePage).toContain("arena-simple__timer-row");
    expect(simplePage).toContain("ArenaLastBuyPodiumChip");

    const rowBlock = cssBlock(css, ".arena-command-console .arena-simple__timer-row {", 320);
    expect(rowBlock).toContain("grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr)");

    const mobileBlock = cssBlock(css, "@media (max-width: 620px)", 420);
    expect(mobileBlock).toContain(".arena-command-console .arena-simple__timer-row");
    expect(mobileBlock).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("stacks timer chips flush under the YOUR WALLET side-rail card when vertical", () => {
    const block = cssBlock(css, ".arena-command-console__side-rail {", 280);
    expect(block).toContain("display: grid");
    expect(block).toContain("gap: 0.35rem");
    expect(block).toContain("align-self: start");
    expect(simplePage).toContain('className="arena-command-console__side-rail"');
  });

  it("keeps Simple timer days chip + HH:MM:SS on one row from page width 541px up", () => {
    const cqIdx = css.indexOf("@container arenaSimplePage (min-width: 541px)");
    expect(cqIdx).toBeGreaterThanOrEqual(0);
    const cqBlock = css.slice(cqIdx, cqIdx + 380);
    expect(cqBlock).toContain(".arena-simple__timer-clock");
    expect(cqBlock).toContain("flex-wrap: nowrap");
    expect(cqBlock).toContain("align-items: center");

    const mqIdx = css.indexOf("@media (min-width: 541px)");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 280);
    expect(mqBlock).toContain(".arena-simple__timer-clock");
    expect(mqBlock).toContain("flex-wrap: nowrap");
  });

  it("lays out wide podium ranking rows inline (prize pill, identity, meta)", () => {
    const cardBlock = cssBlock(css, ".arena-simple__podium-card {", 120);
    expect(cardBlock).toContain("container-type: inline-size");
    expect(cardBlock).toContain("container-name: podiumCard");

    const cqIdx = css.indexOf("@container podiumCard (min-width: 20rem)");
    expect(cqIdx).toBeGreaterThanOrEqual(0);
    const cqBlock = css.slice(cqIdx, cqIdx + 620);
    expect(cqBlock).toContain('grid-template-areas: "prize identity meta"');
    expect(cqBlock).toContain("white-space: nowrap");
  });

  it("uses a two-column live-buys grid only above the Simple page desktop breakpoint", () => {
    const base = cssBlock(css, ".arena-simple__activity-list {", 220);
    expect(base).toContain("display: flex");
    expect(base).toContain("flex-direction: column");

    const cqIdx = css.indexOf("@container arenaSimplePage (min-width: 881px)");
    expect(cqIdx).toBeGreaterThanOrEqual(0);
    const cqBlock = css.slice(cqIdx, cqIdx + 320);
    expect(cqBlock).toContain(".arena-simple__activity-list");
    expect(cqBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");

    const mqIdx = css.indexOf("@media (min-width: 881px)");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 320);
    expect(mqBlock).toContain(".arena-simple__activity-list");
    expect(mqBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("stacks Simple buy slider + amount on all breakpoints (no side-by-side on tablet/desktop)", () => {
    const anchor = "/* Keep a little air before balance + preview margins. */";
    const idx = css.indexOf(anchor);
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(Math.max(0, idx - 220), idx + anchor.length);
    expect(block).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(block).not.toContain("minmax(10rem, 14rem)");
  });

  it("keeps tablet WarBow cards from overflowing squeezed tracks", () => {
    const tabletBlock = cssBlock(css, "@media (max-width: 960px)", 700);
    expect(tabletBlock).toContain(".page--arena .data-panel--spotlight");
    expect(tabletBlock).toContain("padding-right: 1.15rem");
    expect(tabletBlock).toContain(".page--arena .warbow-hero-actions__grid");
    expect(tabletBlock).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))");

    const stealCardIdx = css.indexOf(".warbow-hero-card--steal {\n");
    expect(stealCardIdx).toBeGreaterThanOrEqual(0);
    expect(css.slice(stealCardIdx, stealCardIdx + 140)).toContain("grid-column: 1 / -1");

    const stealTargetsTabletIdx = css.indexOf(
      "@media (min-width: 721px) and (max-width: 960px) {\n  .warbow-hero-candidates.warbow-chasing-pack-scroll",
    );
    expect(stealTargetsTabletIdx).toBeGreaterThanOrEqual(0);
    expect(css.slice(stealTargetsTabletIdx, stealTargetsTabletIdx + 220)).toContain(
      "repeat(2, minmax(0, 1fr))",
    );

    const stealTargetsDesktopIdx = css.indexOf(
      "@media (min-width: 961px) {\n  .warbow-hero-candidates.warbow-chasing-pack-scroll",
    );
    expect(stealTargetsDesktopIdx).toBeGreaterThanOrEqual(0);
    const desktopWarbowMq = css.slice(stealTargetsDesktopIdx, stealTargetsDesktopIdx + 420);
    expect(desktopWarbowMq).toContain("repeat(3, minmax(0, 1fr))");
    expect(desktopWarbowMq).toContain(".page--arena .warbow-hero-actions__grid");
    expect(desktopWarbowMq).toContain("minmax(min(100%, 28rem), 1fr)");

    const headBlock = cssBlock(css, ".warbow-hero-card__head", 500);
    expect(headBlock).toContain("flex-wrap: wrap");
    expect(headBlock).toContain("min-width: 0");

    const revengeListBlock = cssBlock(css, ".warbow-hero-revenge-list", 800);
    expect(revengeListBlock).toContain("list-style: none");
    expect(revengeListBlock).toContain("min-width: 0");
    expect(revengeListBlock).toContain("flex-wrap: wrap");
  });

  it("reflows the homepage card grid before iPad Mini width can overflow", () => {
    const tabletStart = css.indexOf("@media (min-width: 721px) {\n  .home-cta-grid");
    expect(tabletStart).toBeGreaterThanOrEqual(0);
    const tabletHomeBlock = css.slice(tabletStart, tabletStart + 320);
    expect(tabletHomeBlock).toContain("grid-template-columns: repeat(2, minmax(0, 22rem))");

    const desktopStart = css.indexOf("@media (min-width: 960px) {\n  .home-cta-grid");
    expect(desktopStart).toBeGreaterThanOrEqual(0);
    const desktopHomeBlock = css.slice(desktopStart, desktopStart + 220);
    expect(desktopHomeBlock).toContain("grid-template-columns: repeat(3, minmax(0, 22rem))");
  });

  it("tightens Time Arena shell top padding on tablet/desktop so the subnav sits closer to the pinned header", () => {
    const mqIdx = css.indexOf("@media (min-width: 721px) {\n  /* Pinned shell header on tablet/desktop only");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 900);
    expect(mqBlock).toContain(".app-shell.app-shell--arena");
    expect(mqBlock).toContain("var(--app-shell-fixed-header-stack) - 30px");
  });

  it("tightens Referrals shell + main top padding on tablet/desktop for a shorter hero offset", () => {
    const mqIdx = css.indexOf("@media (min-width: 721px) {\n  /* Pinned shell header on tablet/desktop only");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 1200);
    expect(mqBlock).toContain(".app-shell.app-shell--referrals");
    expect(mqBlock).toContain("var(--app-shell-fixed-header-stack) - 60px");

    expect(rootLayout).toContain("app-shell--referrals");
    expect(rootLayout).toContain("app-main--referrals");
    expect(css).toContain(".app-main.app-main--referrals");
  });

  it("keeps mobile Arena content clear of the fixed audio dock and wraps long values", () => {
    expect(rootLayout).toContain("app-shell--arena");
    expect(rootLayout).toContain("app-main--arena");

    const phoneMqAnchor =
      "@media (max-width: 720px) {\n  @keyframes mobile-header-shimmer {";
    const phoneBlock = cssBlock(css, phoneMqAnchor, 7_200);
    expect(phoneBlock).toContain(".app-main--arena");
    /* Mobile dock clears the fixed header + safe area (GitLab #103 / #68). */
    expect(phoneBlock).toContain("env(safe-area-inset-bottom, 0px)) + 3.95rem");

    const totalRaiseBlock = cssBlock(css, ".timer-hero__total-raise", 300);
    expect(totalRaiseBlock).toContain("overflow-wrap: anywhere");

    const rateValueBlock = cssBlock(css, ".arena-simple__rate-value {", 400);
    expect(rateValueBlock).toContain("max-width: 100%");
    expect(rateValueBlock).toContain("overflow-wrap: anywhere");
  });
});
