// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_V2_ADVANCED_CORE_ROW_INDICES,
  mapArenaV2AdvancedCoreRows,
} from "./arenaV2AdvancedSessionBridge";

const DOUB = "0x" + "a".repeat(40);
const REF = "0x" + "b".repeat(40);
const BUY_ROUTER = "0x" + "c".repeat(40);
const OWNER = "0x" + "d".repeat(40);

describe("mapArenaV2AdvancedCoreRows", () => {
  it("places Last Buy timer reads at protocol accordion indices", () => {
    const priceWad = 1000n * 10n ** 18n;
    const raw = [
      { status: "success", result: 1n },
      { status: "success", result: 2n },
      { status: "success", result: 3n },
      { status: "success", result: false },
      { status: "success", result: priceWad },
      { status: "success", result: DOUB },
      { status: "success", result: REF },
      { status: "success", result: 120n },
      { status: "success", result: 345_600n },
      { status: "success", result: 300n },
      { status: "success", result: BUY_ROUTER },
      { status: "success", result: OWNER },
    ] as const;

    const rows = mapArenaV2AdvancedCoreRows(raw);
    expect(rows).toBeDefined();
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.charmPriceWad]?.result).toBe(priceWad);
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.doub]?.result).toBe(DOUB);
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.timerExtensionSec]?.result).toBe(120n);
    expect(rows![ARENA_V2_ADVANCED_CORE_ROW_INDICES.timerCapSec]?.result).toBe(345_600n);
  });
});
