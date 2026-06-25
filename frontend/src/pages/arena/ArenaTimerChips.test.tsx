// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ArenaTimerChips", () => {
  it("renders all four podium chips from one shared config", () => {
    const src = readFileSync(resolve(__dirname, "ArenaTimerChips.tsx"), "utf8");
    expect(src).toContain("podiumName: \"Last Buy\"");
    expect(src).toContain("podiumName: \"Time Booster\"");
    expect(src).toContain("podiumName: \"Defended Streak\"");
    expect(src).toContain("podiumName: \"WarBow\"");
    expect(src).toContain("ArenaPodiumTimerChip");
    expect(src).toContain("feature: \"last_buy\"");
    expect(src).toContain("contractIndex: 0");
    expect(src).toContain("contractIndex: 1");
    expect(src).toContain("contractIndex: 2");
    expect(src).toContain("contractIndex: 3");
    expect(src).toContain("testId: \"arena-last-buy-chip\"");
    expect(src).toContain("onFeatureHelp={onFeatureHelp}");
  });

  it("does not fall back to wagmi podiumDeadline reads (indexer-first #301)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaTimerChips.tsx"), "utf8");
    expect(src).not.toContain("useReadContracts");
    expect(src).toContain("useArenaTimersQuery");
    expect(src).toContain("buildPodiumTransitionMeta");
    expect(src).toContain("chainNowSec");
    expect(src).not.toContain("block_timestamp_sec");
  });
});

describe("ArenaPodiumTimerChip", () => {
  it("renders compact leader rows with score, prize, and wallet identity", () => {
    const src = readFileSync(resolve(__dirname, "ArenaPodiumTimerChip.tsx"), "utf8");
    expect(src).toContain("Your score:");
    expect(src).toContain("arena-timer-chips__title");
    expect(src).toContain("EPOCH ${podiumRow.epoch}");
    expect(src).toContain("arena-timer-chips__places");
    expect(src).toContain("compactPodiumPrizeNode");
    expect(src).toContain("compactPodiumScoreNode");
    expect(src).toContain("arena-timer-chips__place-rank");
    expect(src).toContain("arena-timer-chips__place-identity");
    const placeRowBlock = src.slice(src.indexOf("arena-timer-chips__place-rank"));
    const identityIdx = placeRowBlock.indexOf("arena-timer-chips__place-identity");
    const prizeIdx = placeRowBlock.indexOf("compactPodiumPrizeNode");
    const scoreIdx = placeRowBlock.indexOf("compactPodiumScoreNode");
    expect(prizeIdx).toBeGreaterThan(0);
    expect(scoreIdx).toBeGreaterThan(prizeIdx);
    expect(identityIdx).toBeGreaterThan(scoreIdx);
    expect(src).toContain("arena-timer-chips__aside");
    expect(src).toContain("chipVisuallyUnlocked ? helpButton : null");
    expect(src).not.toMatch(/LockedUntilLevel[\s\S]*?action=\{helpButton\}/);
  });
});
