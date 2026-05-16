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

    const tabletGridBlock = css.match(
      /@media \(min-width: 721px\) \{[\s\S]*?\.home-cta-grid \{[\s\S]*?\n {2}\}\n\}/,
    );
    expect(tabletGridBlock).not.toBeNull();
    expect(tabletGridBlock![0]).toContain("grid-template-columns: repeat(2, minmax(0, 22rem));");
    expect(tabletGridBlock![0]).toContain("grid-auto-rows: 1fr;");

    const desktopGridBlock = css.match(
      /@media \(min-width: 960px\) \{[\s\S]*?\.home-cta-grid \{[\s\S]*?\n {2}\}\n\}/,
    );
    expect(desktopGridBlock).not.toBeNull();
    expect(desktopGridBlock![0]).toContain("grid-template-columns: repeat(3, minmax(0, 22rem));");

    expect(cssBlock(css, ".home-cta-grid__item")).toContain("display: flex;");
    expect(cssBlock(css, ".home-cta-card")).toContain("height: 100%;");
    expect(cssBlock(css, ".home-cta-card")).toContain("min-width: 0;");
    expect(cssBlock(css, ".home-cta-card__blurb")).toContain("overflow-wrap: anywhere;");
  });
});
