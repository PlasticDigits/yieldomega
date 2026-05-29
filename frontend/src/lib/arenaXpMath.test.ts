import { describe, expect, it } from "vitest";
import {
  applyXpGain,
  levelFromXp,
  xpForCharm,
  xpRemainingToNextLevel,
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
      expect(state.level).toBe(levelFromXp(lifetime));
      expect(xpRemainingToNextLevel(state.level, state.xpTowardNext)).toBe(
        xpToNextLevel(lifetime),
      );
    }
  });

  it("caps five level-ups per buy", () => {
    const state = applyXpGain(1n, 0n, 200n);
    expect(state.level).toBe(6n);
    expect(state.level).toBeLessThan(levelFromXp(200n));
    const caughtUp = applyXpGain(state.level, state.xpTowardNext, 50n);
    expect(caughtUp.level).toBe(levelFromXp(250n));
  });
});
