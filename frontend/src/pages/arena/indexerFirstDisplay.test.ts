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
    expect(src).toContain("polled_at_ms");
  });

  it("useArenaSaleSession disables core display multicall when indexer is on", () => {
    const src = readArena("useArenaSaleSession.ts");
    expect(src).not.toMatch(/indexerOn\s*=\s*Boolean\(indexerBaseUrl\(\)\)\s*&&\s*!isArenaV2/);
    expect(src).toContain("enabled: Boolean(tc) && !indexerOn");
    expect(src).toContain("coreReadRowsFromArenaTimers");
  });

  it("useArenaSaleSession supplements warbow flag reads when timers omit flag fields (#362)", () => {
    const src = readArena("useArenaSaleSession.ts");
    expect(src).toContain("arenaV2WarbowFlagSupplementContracts");
    expect(src).toContain("mapArenaV2WarbowFlagSupplementRows");
    expect(src).toMatch(/enabled:\s*Boolean\(tc && indexerOn && isArenaV2\)/);
  });

  it("useArenaSaleSession disables Buy contract-event watch when indexer is on", () => {
    const src = readArena("useArenaSaleSession.ts");
    expect(src).toMatch(/useWatchContractEvent\([\s\S]*enabled:\s*Boolean\(tc\)\s*&&\s*!indexerOn/);
  });

  it("useWarbowBpMovingEventWatch disables contract event subscriptions", () => {
    const src = readArena("usePodiumReads.ts");
    expect(src).toContain("const rpcEventsEnabled = false");
  });

  it("useArenaWarbowHero skips recurring viewer BP RPC when indexer is configured", () => {
    const src = readArena("useArenaWarbowHero.ts");
    expect(src).toContain("indexerBaseUrl");
    expect(src).toMatch(/enabled:\s*Boolean\(tc && address && !indexerOn\)/);
    expect(src).toMatch(/functionName:\s*"warbowGuardUntil"[\s\S]*enabled:\s*Boolean\(tc && address && !indexerOn\)/);
    expect(src).toContain("WARBOW_STEAL_DOUB_WAD");
    expect(src).toContain("readWarbowStealCapDisplay");
  });

  it("useArenaWarbowHero uses one-shot steal-cap reads when indexer is on (#361 · #301)", () => {
    const src = readArena("useArenaWarbowHero.ts");
    expect(src).toContain("readWarbowStealCapDisplay");
    expect(src).toMatch(
      /stealsCommittedByAttackerOnDay[\s\S]*?enabled:\s*Boolean\(tc && address && !indexerOn\)/,
    );
    expect(src).toContain("warbowUtcDayResetSec");
  });

  it("useArenaPendingRevengeTargets uses indexer pending-revenge HTTP only (#135)", () => {
    const src = readFileSync(
      resolve(arenaDir, "../../hooks/useArenaPendingRevengeTargets.ts"),
      "utf8",
    );
    expect(src).toContain("fetchWarbowPendingRevenge");
    expect(src).not.toContain("useReadContracts");
    expect(src).not.toContain("fetchArenaActivity");
    expect(src).not.toContain("chainNowSec");
  });

  it("ArenaSimplePage resolves WarBow card display from indexer when RPC is inactive", () => {
    const src = readArena("ArenaSimplePage.tsx");
    expect(src).toContain("walletWarbowBattlePoints: playerWalletStats?.warbow_battle_points");
    expect(src).toContain("resolveIndexerViewerWarbowBattlePoints");
    expect(src).toContain("warbow_guard_until");
    expect(src).toContain("indexerWarbowHead");
    expect(src).toContain("fetchArenaWarbowLatestBp");
  });

  it("ArenaXpHero reads level and XP from indexer wallet stats", () => {
    const src = readFileSync(resolve(__dirname, "../../components/ArenaXpHero.tsx"), "utf8");
    expect(src).not.toContain("useReadContracts");
    expect(src).toContain("useArenaPlayerLevel");
    expect(src).toContain("xp_toward_next");
    expect(src).not.toContain("arena-xp-hero__tiers");
  });

  it("ArenaSimplePage gates progression from indexer player level (#301)", () => {
    const src = readArena("ArenaSimplePage.tsx");
    expect(src).toContain("useArenaPlayerLevel");
    expect(src).not.toMatch(/useReadContract\([\s\S]*functionName:\s*"level"/);
  });

  it("ArenaCharmCredCard reads CHARM and CRED from indexer wallet stats", () => {
    const src = readArena("ArenaCharmCredCard.tsx");
    expect(src).not.toMatch(/useReadContract\(/);
    expect(src).toContain("useWalletStats");
    expect(src).toContain("epoch_charm_wad");
    expect(src).toContain("pending_cred_accrual");
    expect(src).toContain("cred_balance_wad");
  });

  it("play-route timers share chainNowSec skew (#343)", () => {
    const chips = readArena("ArenaTimerChips.tsx");
    const slideMeta = readArena("useTimerPodiumSlideMeta.ts");
    const simple = readArena("ArenaSimplePage.tsx");
    expect(chips).toContain("chainNowSec");
    expect(chips).not.toContain("block_timestamp_sec");
    expect(slideMeta).toContain("chainNowSec");
    expect(slideMeta).not.toMatch(/Number\(timerData\.block_timestamp_sec\)/);
    expect(simple).toContain("chainNowSec: session.chainNowSec");
    expect(readArena("arenaTransitionState.ts")).toContain("derivePodiumTransitionState");
    expect(readArena("useArenaHeroTimer.ts")).toContain("arenaChainNow");
  });

  it("ArenaProtocolDataContext is indexer-first with no display RPC multicall (#301)", () => {
    const src = readArena("ArenaProtocolDataContext.tsx");
    expect(src).toContain("indexerConfigured");
    expect(src).toContain("mapArenaV2AdvancedCoreRowsFromArenaTimers");
    expect(src).toContain("useArenaTimersQuery");
    expect(src).toContain("useWalletStats");
    expect(src).not.toContain("useReadContracts");
    expect(src).not.toContain("useReadContract");
    expect(src).not.toContain("useRpcBackedReadQueryOptions");
  });

  it("useArenaProtocolPodiumAudit has no browser RPC timer mirror", () => {
    const src = readArena("useArenaProtocolPodiumAudit.ts");
    expect(src).not.toContain("useReadContracts");
    expect(src).toContain("useArenaTimersQuery");
  });

  it("ArenaProtocolPage avoids useLatestBlock for phase ledger (#301)", () => {
    const page = readArena("ArenaProtocolPage.tsx");
    const raw = readArena("useArenaProtocolRawAccordion.ts");
    expect(page).not.toContain("useLatestBlock");
    expect(page).toContain("heroChainNowSec");
    expect(raw).not.toContain("useLatestBlock");
  });

  it("useArenaProtocolDonatePools avoids recurring balanceOf polls (#301)", () => {
    const src = readArena("useArenaProtocolDonatePools.ts");
    expect(src).not.toContain("useReadContract");
    expect(src).not.toContain("useReadContracts");
    expect(src).not.toContain("refetchInterval");
    expect(src).toContain("readContract");
    expect(src).not.toContain("useReadContract");
  });
});
