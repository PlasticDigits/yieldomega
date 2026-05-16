// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cssBlock(css: string, selector: string): string {
  const match = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`).exec(css);
  const start = match?.index === undefined ? -1 : match.index + (match[1] ? 1 : 0);
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

  it("sizes dense header icons larger and shimmers them on a 3.5s cadence", () => {
    expect(cssBlock(css, ".app-header")).toContain("--app-header-icon-size: 1.8125rem;");
    expect(css).toContain("--app-header-icon-size: 2.71875rem;");
    expect(cssBlock(css, ".app-header__icon-wrap::after")).toContain(
      "animation: app-header-icon-shimmer 3.5s ease-in-out infinite;",
    );
    expect(css).toContain("animation: mobile-header-shimmer 3.5s ease-in-out infinite;");
  });

  it("underlines the dense header primary nav active target in green", () => {
    const active = cssBlock(css, ".app-header--dense .app-nav--dense .nav-link--dense.nav-link--active");
    expect(active).toContain("border-bottom-color: var(--arcade-green-700);");
    expect(active).toContain("background: transparent;");
  });

  it("shows dense header nav + network text labels only from tablet/desktop (header on top)", () => {
    expect(css).toContain(".app-header__nav-label,");
    expect(css).toContain(".app-header__network-label");
    expect(css).toMatch(/@media \(min-width: 721px\)[\s\S]*\.app-header--dense \.app-nav--dense \.nav-link--dense \.app-header__nav-label/);
    expect(css).toMatch(/@media \(min-width: 721px\)[\s\S]*\.app-header--dense \.header-network-btn \.app-header__network-label/);
  });

  it("fixes the shell header to the viewport from tablet/desktop without affecting the mobile dock block", () => {
    expect(css).toMatch(
      /@media \(min-width: 721px\) \{[\s\S]*?\.app-shell \{[^}]*--app-shell-fixed-header-stack: 5\.5rem;[^}]*padding-top: calc\(max\(1rem, env\(safe-area-inset-top, 0px\)\) \+ var\(--app-shell-fixed-header-stack\)\);/,
    );
    expect(css).toMatch(
      /@media \(min-width: 721px\) \{[\s\S]*?\.app-header \{[^}]*position: fixed;[^}]*z-index: 1100;/,
    );
    expect(css).toMatch(/@media \(max-width: 720px\) \{[\s\S]*?\.app-header \{[^}]*position: fixed;/);
  });
});
