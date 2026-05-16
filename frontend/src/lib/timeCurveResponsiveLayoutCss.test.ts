import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

function cssBlock(css: string, selector: string, window = 900): string {
  const idx = css.indexOf(selector);
  expect(idx, `expected ${selector} in index.css`).toBeGreaterThanOrEqual(0);
  return css.slice(idx, idx + window);
}

describe("TimeCurve responsive layout CSS (GitLab #201)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const rootLayout = fs.readFileSync(path.resolve(__dirname, "../layout/RootLayout.tsx"), "utf8");
  const simplePage = fs.readFileSync(path.resolve(__dirname, "../pages/TimeCurveSimplePage.tsx"), "utf8");

  it("keeps the Simple buy panel free of the former floating coin-stack cutout", () => {
    expect(simplePage).not.toContain("panel-cutout--coin-stack");
    expect(simplePage).not.toContain("/art/hat-coin-stack.png");
    expect(css).not.toContain(".timecurve-simple__buy-panel .chain-write-gate");
  });

  it("collapses the phone-width buy-panel slider layout", () => {
    const block = cssBlock(css, "@container timecurveSimplePage (max-width: 520px)", 1_500);
    expect(block).toContain(".timecurve-simple__slider-row");
    expect(block).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("keeps the Simple hub timer column from stretching when the buy panel grows", () => {
    const block = cssBlock(css, ".timecurve-simple__hub > .timecurve-simple__timer-panel", 220);
    expect(block).toContain("align-self: start");
  });

  it("vertically centers Simple hub timer heading + countdown inside the min-height stage", () => {
    const block = cssBlock(css, ".timecurve-simple__timer-panel.data-panel", 420);
    expect(block).toContain("justify-content: center");
  });

  it("sets a desktop min-height on the Simple hub timer panel (881px+)", () => {
    const anchor =
      "/* Desktop hub: give the arcade timer stage a stable vertical footprint so the";
    const idx = css.indexOf(anchor);
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(idx, idx + 520);
    expect(block).toContain("@container timecurveSimplePage (min-width: 881px)");
    expect(block).toContain(".timecurve-simple__hub > .timecurve-simple__timer-panel");
    expect(block).toContain("min-height: 392px");
    expect(block).toContain("@media (min-width: 881px)");
  });

  it("keeps Simple timer days chip + HH:MM:SS on one row from page width 541px up", () => {
    const cqIdx = css.indexOf("@container timecurveSimplePage (min-width: 541px)");
    expect(cqIdx).toBeGreaterThanOrEqual(0);
    const cqBlock = css.slice(cqIdx, cqIdx + 380);
    expect(cqBlock).toContain(".timecurve-simple__timer-clock");
    expect(cqBlock).toContain("flex-wrap: nowrap");
    expect(cqBlock).toContain("align-items: center");

    const mqIdx = css.indexOf("@media (min-width: 541px)");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 280);
    expect(mqBlock).toContain(".timecurve-simple__timer-clock");
    expect(mqBlock).toContain("flex-wrap: nowrap");
  });

  it("uses a two-column live-buys grid only above the Simple page desktop breakpoint", () => {
    const base = cssBlock(css, ".timecurve-simple__activity-list {", 220);
    expect(base).toContain("display: flex");
    expect(base).toContain("flex-direction: column");

    const cqIdx = css.indexOf("@container timecurveSimplePage (min-width: 881px)");
    expect(cqIdx).toBeGreaterThanOrEqual(0);
    const cqBlock = css.slice(cqIdx, cqIdx + 320);
    expect(cqBlock).toContain(".timecurve-simple__activity-list");
    expect(cqBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");

    const mqIdx = css.indexOf("@media (min-width: 881px)");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 320);
    expect(mqBlock).toContain(".timecurve-simple__activity-list");
    expect(mqBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("stacks Simple buy slider + amount on all breakpoints (no side-by-side on tablet/desktop)", () => {
    const anchor =
      "/* Buy limits moved under ADVANCED; keep a little air before balance + preview margins. */";
    const idx = css.indexOf(anchor);
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(Math.max(0, idx - 220), idx + anchor.length);
    expect(block).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(block).not.toContain("minmax(10rem, 14rem)");
  });

  it("keeps tablet WarBow cards from overflowing squeezed tracks", () => {
    const tabletBlock = cssBlock(css, "@media (max-width: 960px)", 700);
    expect(tabletBlock).toContain(".page--timecurve .data-panel--spotlight");
    expect(tabletBlock).toContain("padding-right: 1.15rem");
    expect(tabletBlock).toContain(".page--timecurve .warbow-hero-actions__grid");
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
    expect(desktopWarbowMq).toContain(".page--timecurve .warbow-hero-actions__grid");
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

  it("tightens TimeCurve shell top padding on tablet/desktop so the subnav sits closer to the pinned header", () => {
    const mqIdx = css.indexOf("@media (min-width: 721px) {\n  /* Pinned shell header on tablet/desktop only");
    expect(mqIdx).toBeGreaterThanOrEqual(0);
    const mqBlock = css.slice(mqIdx, mqIdx + 900);
    expect(mqBlock).toContain(".app-shell.app-shell--timecurve");
    expect(mqBlock).toContain("var(--app-shell-fixed-header-stack) - 30px");
  });

  it("keeps mobile Arena content clear of the fixed audio dock and wraps long values", () => {
    expect(rootLayout).toContain("app-shell--timecurve");
    expect(rootLayout).toContain("app-main--timecurve");

    const phoneBlock = cssBlock(css, "@media (max-width: 720px)", 7_200);
    expect(phoneBlock).toContain(".app-main--timecurve");
    /* Mobile dock clears the fixed header + safe area (GitLab #103 / #68). */
    expect(phoneBlock).toContain("env(safe-area-inset-bottom, 0px)) + 3.95rem");

    const totalRaiseBlock = cssBlock(css, ".timer-hero__total-raise", 300);
    expect(totalRaiseBlock).toContain("overflow-wrap: anywhere");

    const rateValueBlock = cssBlock(css, ".timecurve-simple__rate-value {", 400);
    expect(rateValueBlock).toContain("max-width: 100%");
    expect(rateValueBlock).toContain("overflow-wrap: anywhere");
  });
});
