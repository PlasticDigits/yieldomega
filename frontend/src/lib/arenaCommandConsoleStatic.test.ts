import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

describe("Arena command-console production surface (GitLab #291)", () => {
  const timeArenaPage = fs.readFileSync(
    path.resolve(__dirname, "../pages/TimeArenaPage.tsx"),
    "utf8",
  );
  const arenaSimplePage = fs.readFileSync(
    path.resolve(__dirname, "../pages/arena/ArenaSimplePage.tsx"),
    "utf8",
  );
  const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const arenaE2e = fs.readFileSync(path.resolve(__dirname, "../../e2e/arena.spec.ts"), "utf8");

  it("mounts one production command console instead of the concept-plus-legacy stack", () => {
    expect(timeArenaPage).not.toContain("ArenaThemeConcepts");
    expect(timeArenaPage).not.toContain("<ArenaTimerChips />");
    expect(arenaSimplePage).toContain('data-testid="arena-command-console"');
    expect(arenaSimplePage).toContain('data-testid="arena-command-console-primary"');
    expect(arenaE2e).toContain('page.locator(".arena-final-concept")).toHaveCount(0)');
  });

  it("keeps Last Buy and inline CHARM purchase mechanics surfaced", () => {
    expect(arenaSimplePage).toContain('id="arena-command-console-primary-title">Last Buy');
    expect(arenaSimplePage).toContain("commandDecisionRow");
    expect(arenaSimplePage).toContain("CHARM Price");
    expect(arenaSimplePage).toContain("Buy Range");
    expect(arenaSimplePage).toContain("CRED Yield");
    expect(arenaSimplePage).toContain("<ArenaTimerChips />");
    expect(arenaSimplePage).toContain("<ArenaWarbowHeroPanel");
  });

  it("uses the cyberminimalist console CSS and character treatment", () => {
    expect(css).toContain("Arena production command console (GitLab #291)");
    expect(css).toContain(".arena-command-console__grid");
    expect(css).toContain(".arena-command-console .arena-simple__hub");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(arenaSimplePage).toContain("/art/cutouts/sniper-shark-cool-suit-headset.png");
  });
});
