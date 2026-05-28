import { describe, expect, it } from "vitest";
import { levelFromXp, xpForCharm, xpToNextLevel } from "./arenaXpMath";

describe("arenaXpMath", () => {
  it("maps charm band to 1–10 XP", () => {
    expect(xpForCharm(99n * 10n ** 16n)).toBe(1n);
    expect(xpForCharm(10n * 10n ** 18n)).toBe(10n);
  });

  it("level 2 at 20 XP", () => {
    expect(levelFromXp(20n)).toBe(2n);
    expect(xpToNextLevel(0n)).toBe(20n);
  });
});
