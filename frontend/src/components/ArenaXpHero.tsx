// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { addresses } from "@/lib/addresses";
import { timeArenaReadAbi } from "@/lib/abis";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  clampPlayerLevel,
  MAX_PLAYER_LEVEL,
} from "@/lib/arenaProgression";
import { xpToAdvance } from "@/lib/arenaXpMath";

export function ArenaXpHero() {
  const { address, isConnected } = useAccount();
  const arena = addresses.timeArena;

  const { data: rows } = useReadContracts({
    contracts:
      arena && address
        ? [
            { address: arena, abi: timeArenaReadAbi, functionName: "level", args: [address] },
            {
              address: arena,
              abi: timeArenaReadAbi,
              functionName: "xpTowardNext",
              args: [address],
            },
          ]
        : [],
    query: { enabled: Boolean(arena && address) },
  });

  const { level, progressPct, xpLabel } = useMemo(() => {
    if (!rows?.[0] || rows[0].status !== "success") {
      return { level: 1, progressPct: 0, xpLabel: "—" };
    }
    const lvl = clampPlayerLevel(rows[0].result as bigint);
    const toward =
      rows[1]?.status === "success" ? (rows[1].result as bigint) : 0n;
    if (lvl >= Number(MAX_PLAYER_LEVEL)) {
      return {
        level: lvl,
        progressPct: 100,
        xpLabel: `${formatLocaleInteger(toward.toString())} XP banked`,
      };
    }
    const need = xpToAdvance(BigInt(lvl));
    const pct = need > 0n ? Number((toward * 100n) / need) : 0;
    return {
      level: lvl,
      progressPct: Math.min(100, Math.max(0, pct)),
      xpLabel: `${formatLocaleInteger(toward.toString())} / ${formatLocaleInteger(need.toString())} XP`,
    };
  }, [rows]);

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
