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

  it("keeps tablet WarBow cards from overflowing squeezed tracks", () => {
    const tabletBlock = cssBlock(css, "@media (max-width: 960px)", 700);
    expect(tabletBlock).toContain(".page--timecurve .data-panel--spotlight");
    expect(tabletBlock).toContain("padding-right: 1.15rem");
    expect(tabletBlock).toContain(".page--timecurve .warbow-hero-actions__grid");
    expect(tabletBlock).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))");
    expect(tabletBlock).toContain(".page--timecurve .warbow-hero-card--steal");
    expect(tabletBlock).toContain("grid-column: 1 / -1");

    const headBlock = cssBlock(css, ".warbow-hero-card__head", 500);
    expect(headBlock).toContain("flex-wrap: wrap");
    expect(headBlock).toContain("min-width: 0");

    const revengeListBlock = cssBlock(css, ".warbow-hero-revenge-list", 800);
    expect(revengeListBlock).toContain("list-style: none");
    expect(revengeListBlock).toContain("min-width: 0");
    expect(revengeListBlock).toContain("flex-wrap: wrap");
  });

  it("reflows the homepage card grid before iPad Mini width can overflow", () => {
    const tabletHomeBlock = cssBlock(css, "@media (min-width: 721px)", 550);
    expect(tabletHomeBlock).toContain("grid-template-columns: repeat(2, minmax(0, 22rem))");

    const desktopHomeBlock = cssBlock(css, "@media (min-width: 960px)", 300);
    expect(desktopHomeBlock).toContain("grid-template-columns: repeat(3, minmax(0, 22rem))");
  });

  it("keeps mobile Arena content clear of the fixed audio dock and wraps long values", () => {
    expect(rootLayout).toContain("app-shell--timecurve");
    expect(rootLayout).toContain("app-main--timecurve");

    const phoneBlock = cssBlock(css, "@media (max-width: 720px)", 3_000);
    expect(phoneBlock).toContain(".app-main--timecurve");
    expect(phoneBlock).toContain("env(safe-area-inset-top, 0px) + 4.85rem");

    const totalRaiseBlock = cssBlock(css, ".timer-hero__total-raise", 300);
    expect(totalRaiseBlock).toContain("overflow-wrap: anywhere");

    const rateValueBlock = cssBlock(css, ".timecurve-simple__rate-value {", 400);
    expect(rateValueBlock).toContain("max-width: 100%");
    expect(rateValueBlock).toContain("overflow-wrap: anywhere");
  });
});
