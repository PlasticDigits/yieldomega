// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useArenaPlayerLevel } from "@/hooks/useArenaPlayerLevel";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { MAX_PLAYER_LEVEL } from "@/lib/arenaProgression";
import { normalizeXpProgress, xpToAdvance } from "@/lib/arenaXpMath";

export function ArenaXpHero() {
  const { address, isConnected } = useAccount();
  const { level, stats, isLoading, indexerOn } = useArenaPlayerLevel(address);

  const { progressPct, xpLabel } = useMemo(() => {
    if (!indexerOn) {
      return { progressPct: 0, xpLabel: "Indexer unavailable" };
    }
    if (!stats) {
      return { progressPct: 0, xpLabel: isLoading ? "Loading XP…" : "—" };
    }
    if (level >= Number(MAX_PLAYER_LEVEL)) {
      return {
        progressPct: 100,
        xpLabel: "Max level",
      };
    }
    const indexedLevel = BigInt(stats.level || String(level));
    const indexedToward = BigInt(stats.xp_toward_next ?? "0");
    const { level: displayLevel, xpTowardNext: toward } = normalizeXpProgress(
      indexedLevel,
      indexedToward,
    );
    const need = xpToAdvance(displayLevel);
    const pct = need > 0n ? Number((toward * 100n) / need) : 0;
    return {
      progressPct: Math.min(100, Math.max(0, pct)),
      xpLabel: `${formatLocaleInteger(toward.toString())} / ${formatLocaleInteger(need.toString())} XP`,
    };
  }, [indexerOn, stats, isLoading, level]);

  if (!isConnected) return null;

  return (
    <section
      className="arena-xp-hero"
      aria-label="Player level and XP"
      data-testid="arena-xp-hero"
    >
      <div className="arena-xp-hero__badge" data-testid="arena-xp-hero-level">
        Lv {level}
        {level >= Number(MAX_PLAYER_LEVEL) ? " · MAX" : null}
      </div>
      <div className="arena-xp-hero__bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="arena-xp-hero__bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <span className="arena-xp-hero__xp muted" data-testid="arena-xp-hero-progress">
        {xpLabel}
      </span>
    </section>
  );
}
