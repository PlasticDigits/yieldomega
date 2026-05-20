// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function cssBlock(css: string, selector: string, window = 600): string {
  const idx = css.indexOf(selector);
  expect(idx, `expected ${selector} in index.css`).toBeGreaterThanOrEqual(0);
  return css.slice(idx, idx + window);
}

describe("wallet blockie CSS (GitLab #226)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");

  it("does not tint live-buy-row blockies with a radial gradient backdrop", () => {
    const block = cssBlock(css, ".live-buy-row .address-inline__blockie");
    expect(block).not.toMatch(/radial-gradient/);
    expect(block).not.toMatch(/background\s*:\s*(?!transparent)/);
  });

  it("keeps pixelated scaling on blockie canvases globally", () => {
    expect(css).toContain(".address-inline__blockie canvas");
    const block = cssBlock(css, ".address-inline__blockie canvas", 200);
    expect(block).toContain("image-rendering: pixelated");
  });
});
