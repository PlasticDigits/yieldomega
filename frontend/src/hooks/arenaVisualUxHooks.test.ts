// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useWhileYouWereAway wiring (#338)", () => {
  const src = readFileSync(resolve(__dirname, "useWhileYouWereAway.ts"), "utf8");

  it("skips fetch when indexer base URL is unset (indexer-off sad path)", () => {
    expect(src).toContain("indexerBaseUrl()");
    expect(src).toContain("if (!base) return");
  });

  it("skips modal when session summary has no activity", () => {
    expect(src).toContain("hasWywaSummaryActivity");
  });
});

describe("useArenaLevelUpCelebration wiring (#335)", () => {
  const src = readFileSync(resolve(__dirname, "useArenaLevelUpCelebration.ts"), "utf8");

  it("detects unseen L2+ unlocks via detectUnseenLevelUpFeature", () => {
    expect(src).toContain("detectUnseenLevelUpFeature");
    expect(src).toContain("setCelebrationFeature");
  });
});

describe("useArenaBuyEffectToasts wiring (#337)", () => {
  const src = readFileSync(resolve(__dirname, "../pages/arena/useArenaBuyEffectToasts.ts"), "utf8");

  it("pushes preview toasts on buy success and upgrades from indexer head buy", () => {
    expect(src).toContain("onBuySuccess");
    expect(src).toContain("pushToastLines");
    expect(src).toContain("findViewerBuyAtHead");
    expect(src).toContain("replaceToastBatch");
  });
});
