// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  DEV_DEFAULT_ANCHOR_WAD,
  warbowGuardDoubFromAnchor,
  warbowRevengeDoubFromAnchor,
  warbowStealDoubFromAnchor,
} from "./arenaWarbowConstants";

describe("anchor-priced WarBow costs", () => {
  it("derives steal, guard, and revenge from the epoch anchor", () => {
    const anchor = 1_000n * 10n ** 18n;

    expect(warbowStealDoubFromAnchor(anchor)).toBe(200n * 10n ** 18n);
    expect(warbowGuardDoubFromAnchor(anchor)).toBe(500n * 10n ** 18n);
    expect(warbowRevengeDoubFromAnchor(anchor)).toBe(200n * 10n ** 18n);
    expect(DEV_DEFAULT_ANCHOR_WAD).toBe(anchor);
  });
});
