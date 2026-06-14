// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "ArenaSimplePage.tsx"), "utf8");

describe("ArenaSimplePage smoke regions (GitLab #321)", () => {
  it("exposes contextual aria-label on the primary buy CTA", () => {
    expect(src).toContain('data-testid="arena-simple-buy-charm"');
    expect(src).toContain("aria-label={");
    expect(src).toContain("Buy CHARM with ${paySpendSuffix}");
    expect(src).toContain("Processing CHARM buy transaction");
  });

  it("keeps indexer-first WarBow display wiring (#301)", () => {
    expect(src).toContain("indexerWarbowHead");
    expect(src).toContain("resolveIndexerViewerWarbowBattlePoints");
    expect(src).toContain("ArenaWarbowHeroPanel");
  });

  it("renders timer, podium carousel, and spend controls test ids", () => {
    expect(src).toContain('data-testid="arena-simple-amount-pay-token"');
    expect(src).toContain("ArenaTimerPodiumCarousel");
    expect(src).toContain("ArenaTimerChips");
    expect(src).toContain("ArenaCharmCredCard");
  });
});
