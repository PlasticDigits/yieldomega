// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `expected ${selector} in index.css`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

describe("home product card grid CSS (GitLab #198)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");

  it("stretches desktop product cards to consistent grid-row height", () => {
    expect(cssBlock(css, ".home-cta-grid")).toContain("align-items: stretch;");

    const desktopGridBlock = css.match(
      /@media \(min-width: 721px\) \{[\s\S]*?\.home-cta-grid \{[\s\S]*?\n  \}\n\}/,
    );
    expect(desktopGridBlock).not.toBeNull();
    expect(desktopGridBlock![0]).toContain("grid-auto-rows: 1fr;");

    expect(cssBlock(css, ".home-cta-grid__item")).toContain("display: flex;");
    expect(cssBlock(css, ".home-cta-card")).toContain("height: 100%;");
    expect(cssBlock(css, ".home-cta-card")).toContain("min-width: 0;");
    expect(cssBlock(css, ".home-cta-card__blurb")).toContain("overflow-wrap: anywhere;");
  });

  it("keeps referral overview cards aligned inside their responsive grid", () => {
    expect(cssBlock(css, ".referrals-overview-grid")).toContain("align-items: stretch;");
    expect(cssBlock(css, ".referrals-overview-card")).toContain("height: 100%;");
    expect(cssBlock(css, ".referrals-overview-card")).toContain("box-sizing: border-box;");
    expect(cssBlock(css, ".referrals-overview-card")).toContain("min-width: 0;");
    expect(cssBlock(css, ".referrals-overview-card p")).toContain("overflow-wrap: anywhere;");
  });
});
