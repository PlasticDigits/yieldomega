// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const arenaDir = resolve(__dirname);

function readArena(name: string): string {
  return readFileSync(resolve(arenaDir, name), "utf8");
}

describe("indexer-first display reads (#301)", () => {
  it("usePodiumReads has no browser RPC podium mirror", () => {
    const src = readArena("usePodiumReads.ts");
    expect(src).not.toContain("useReadContracts");
    expect(src).toContain('source: "unavailable"');
  });

  it("useArenaHeroTimer has no publicClient RPC backfill", () => {
    const src = readArena("useArenaHeroTimer.ts");
    expect(src).not.toContain("usePublicClient");
    expect(src).not.toContain("readContract");
  });

  it("useArenaSaleSession disables core display multicall", () => {
    const src = readArena("useArenaSaleSession.ts");
    expect(src).not.toMatch(/indexerOn\s*=\s*Boolean\(indexerBaseUrl\(\)\)\s*&&\s*!isArenaV2/);
    expect(src).toContain("enabled: false");
    expect(src).toContain("coreReadRowsFromArenaTimers");
  });

  it("useWarbowBpMovingEventWatch disables contract event subscriptions", () => {
    const src = readArena("usePodiumReads.ts");
    expect(src).toContain("const rpcEventsEnabled = false");
  });
});
