// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

describe("header layout CSS (GitLab #171)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");

  it("reserves desktop header space for the decorative mascot", () => {
    expect(cssBlock(css, ".app-header")).toContain(
      "--app-header-mascot-clearance: clamp(3.65rem, 7vw, 4.75rem);",
    );
    expect(cssBlock(css, ".app-header__brand")).toContain(
      "padding-inline-end: var(--app-header-mascot-clearance);",
    );
    expect(cssBlock(css, ".app-header__mascot")).toContain("right: 0;");
  });

  it("keeps the mascot decorative and out of the nav hit area", () => {
    expect(cssBlock(css, ".app-header__mascot")).toContain("pointer-events: none;");
  });

  it("removes the reserved gutter when the mascot is hidden on mobile", () => {
    const mobileBlock = css.match(/@media \(max-width: 720px\) \{[\s\S]*?\.app-nav \{/);
    expect(mobileBlock).not.toBeNull();
    expect(mobileBlock![0]).toContain("--app-header-mascot-clearance: 0rem;");
    expect(mobileBlock![0]).toContain("padding-inline-end: 0;");
  });
});
