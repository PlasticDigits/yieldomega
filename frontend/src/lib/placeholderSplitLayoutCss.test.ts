import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Parity guard for INV-FRONTEND-163 — placeholder hero figures in `.split-layout`
 * must not stretch to the sibling column height (see `index.css` comment).
 */
describe("placeholder split-layout CSS (GitLab #163)", () => {
  it("keeps .split-layout > .placeholder-figure shrink-wrapped with align-self: start", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
    const needle = ".split-layout > .placeholder-figure";
    const idx = css.indexOf(needle);
    expect(idx, `expected ${needle} in index.css`).toBeGreaterThanOrEqual(0);
    const block = css.slice(idx, idx + 600);
    expect(block).toContain("align-self: start");
    expect(block).toContain("max-width: min(42rem, 100%)");
    expect(block).toContain("min-width: 0");
  });
});
