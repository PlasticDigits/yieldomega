// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { applyXpGainToWalletStats, emptyArenaWalletStats } from "./arenaWalletXpOptimistic";

describe("applyXpGainToWalletStats", () => {
  const wallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("starts from level 1 when no prior stats exist", () => {
    const next = applyXpGainToWalletStats(undefined, wallet, 10n);
    expect(next.level).toBe("2");
    expect(next.xp_toward_next).toBe("0");
    expect(next.xp).toBe("10");
  });

  it("levels up from lv4 1/25 after +10 xp buy", () => {
    const prev = {
      ...emptyArenaWalletStats(wallet),
      level: "4",
      xp_toward_next: "1",
      xp: "46",
    };
    const next = applyXpGainToWalletStats(prev, wallet, 10n);
    expect(next.level).toBe("4");
    expect(next.xp_toward_next).toBe("11");
    expect(next.xp).toBe("56");
  });

  it("reconciles stale level before applying xp gain (lv3 24/20 -> lv4 after +0)", () => {
    const prev = {
      ...emptyArenaWalletStats(wallet),
      level: "3",
      xp_toward_next: "24",
      xp: "49",
    };
    const next = applyXpGainToWalletStats(prev, wallet, 0n);
    expect(next.level).toBe("4");
    expect(next.xp_toward_next).toBe("4");
    expect(next.xp).toBe("49");
  });

  it("levels up from drifted lv3 24/20 after +10 xp buy", () => {
    const prev = {
      ...emptyArenaWalletStats(wallet),
      level: "3",
      xp_toward_next: "24",
      xp: "49",
    };
    const next = applyXpGainToWalletStats(prev, wallet, 10n);
    expect(next.level).toBe("4");
    expect(next.xp_toward_next).toBe("14");
    expect(next.xp).toBe("59");
  });
});
