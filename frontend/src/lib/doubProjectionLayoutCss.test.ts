// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function cssBlock(css: string, selector: string, window = 900): string {
  const idx = css.indexOf(selector);
  expect(idx, `expected ${selector} in index.css`).toBeGreaterThanOrEqual(0);
  return css.slice(idx, idx + window);
}

describe("DOUB projection layout CSS (GitLab #235)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const component = fs.readFileSync(
    path.resolve(__dirname, "../pages/timecurve/TimeCurveProtocolDoubProjectionSection.tsx"),
    "utf8",
  );

  it("keeps the projection cards grouped by their economic role", () => {
    expect(component).toContain("Supply and redemption");
    expect(component).toContain("Price anchors");
    expect(component).toContain("Market and wallet lens");
    expect(component).toContain("doub-projection-groups");
  });

  it("uses grouped desktop columns and phone-safe card tracks", () => {
    const base = cssBlock(css, ".doub-projection-group {", 900);
    expect(base).toContain("border-top: 2px dashed");
    expect(base).toContain(".stats-grid--doub-projection");
    expect(base).toContain("minmax(min(100%, 12.5rem), 1fr)");
    expect(base).toContain("overflow-wrap: anywhere");

    const desktop = cssBlock(css, "@media (min-width: 961px) {\n  .doub-projection-group", 520);
    expect(desktop).toContain("grid-template-columns: minmax(10rem, 0.8fr) minmax(0, 3fr)");
    expect(desktop).toContain("position: sticky");
  });
});
