// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { resolveArenaHeroCountdownSecondSfx } from "./arenaHeroCountdownSecondSfx";

describe("resolveArenaHeroCountdownSecondSfx", () => {
  it("returns null on first sample (no prev)", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: undefined,
        nextRemainingSec: 60,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBeNull();
  });

  it("returns null when timer goes up (extension)", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 40,
        nextRemainingSec: 90,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBeNull();
  });

  it("returns null at or above 2 minutes", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 121,
        nextRemainingSec: 120,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBeNull();
  });

  it("returns calm between 31s and 119s", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 120,
        nextRemainingSec: 119,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBe("calm");
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 32,
        nextRemainingSec: 31,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBe("calm");
  });

  it("returns urgent at 30s and below (still positive)", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 31,
        nextRemainingSec: 30,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBe("urgent");
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 2,
        nextRemainingSec: 1,
        saleActive: true,
        reduceMotion: false,
      }),
    ).toBe("urgent");
  });

  it("returns null when sale inactive or reduced motion", () => {
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 40,
        nextRemainingSec: 39,
        saleActive: false,
        reduceMotion: false,
      }),
    ).toBeNull();
    expect(
      resolveArenaHeroCountdownSecondSfx({
        prevRemainingSec: 40,
        nextRemainingSec: 39,
        saleActive: true,
        reduceMotion: true,
      }),
    ).toBeNull();
  });
});
