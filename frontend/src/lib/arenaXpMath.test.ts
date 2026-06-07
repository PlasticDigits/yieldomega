import { describe, expect, it } from "vitest";
import {
  applyXpGain,
  levelFromXp,
  xpForCharm,
  xpToAdvance,
  xpToNextLevel,
} from "./arenaXpMath";

describe("arenaXpMath", () => {
  it("maps charm band to 1–10 XP", () => {
    expect(xpForCharm(99n * 10n ** 16n)).toBe(1n);
    expect(xpForCharm(10n * 10n ** 18n)).toBe(10n);
  });

  it("level 2 at 20 XP", () => {
    expect(levelFromXp(20n)).toBe(2n);
    expect(xpToNextLevel(0n)).toBe(20n);
  });

  it("applyXpGain matches levelFromXp across random steps (#265)", () => {
    const gains = [3n, 7n, 10n, 1n, 10n, 5n, 10n, 4n];
    let lifetime = 0n;
    let state = { level: 1n, xpTowardNext: 0n };
    for (const g of gains) {
      lifetime += g;
      state = applyXpGain(state.level, state.xpTowardNext, g);
      const capped = levelFromXp(lifetime) > 5n ? 5n : levelFromXp(lifetime);
      expect(state.level).toBe(capped);
    }
  });

  it("caps player level at five (#299)", () => {
    const state = applyXpGain(1n, 0n, 200n);
    expect(state.level).toBe(5n);
    expect(state.level).toBeLessThan(levelFromXp(200n));
    const caughtUp = applyXpGain(state.level, state.xpTowardNext, 50n);
    expect(caughtUp.level).toBe(5n);
  });

  it("table-test level thresholds L1–L10 (GitLab #250)", () => {
    const steps = [20n, 25n, 30n, 35n, 40n, 45n, 50n, 55n, 60n, 65n];
    for (let i = 0; i < steps.length; i++) {
      expect(xpToAdvance(BigInt(i + 1))).toBe(steps[i]!);
    }
    let cumulative = 0n;
    for (let level = 1; level <= 10; level++) {
      cumulative += xpToAdvance(BigInt(level));
      expect(levelFromXp(cumulative)).toBe(BigInt(level + 1));
      expect(xpToNextLevel(cumulative)).toBe(xpToAdvance(BigInt(level + 1)));
    }
  });

  it("level 50+ uses flat 100 XP/level (GitLab #250)", () => {
    expect(xpToAdvance(16n)).toBe(95n);
    expect(xpToAdvance(17n)).toBe(100n);
    expect(xpToAdvance(50n)).toBe(100n);
    let cumulative = 0n;
    for (let level = 1; level < 50; level++) {
      cumulative += xpToAdvance(BigInt(level));
    }
    expect(levelFromXp(cumulative)).toBe(50n);
    expect(xpToNextLevel(cumulative)).toBe(100n);
    cumulative += 100n;
    expect(levelFromXp(cumulative)).toBe(51n);
  });
});
