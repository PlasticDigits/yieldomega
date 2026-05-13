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
});
