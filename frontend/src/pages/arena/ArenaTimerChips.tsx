// SPDX-License-Identifier: AGPL-3.0-only

import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { addresses } from "@/lib/addresses";
import {
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  type ArenaFeatureKey,
} from "@/lib/arenaProgression";
import { formatMmSsCountdown } from "@/pages/arena/formatTimer";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";

/** Secondary podium timers beside the Last Buy hero (#256). Contract category indices per arena-v2.md. */
const SECONDARY_PODIUM_CHIPS = [
  { label: "Time Booster", contractIndex: 1, feature: "time_booster" as ArenaFeatureKey },
  { label: "Defended Streak", contractIndex: 2, feature: "defended_streak" as ArenaFeatureKey },
  { label: "WarBow", contractIndex: 3, feature: "warbow" as ArenaFeatureKey },
] as const;

type Props = {
  playerLevel?: bigint | number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
};

export function ArenaTimerChips({ playerLevel, onFeatureHelp }: Props) {
  const arena = addresses.timeArena;

  const { data: indexerData } = useArenaTimersQuery(arena ?? undefined);

  const data = indexerData ?? null;
  const now = data ? Number(data.block_timestamp_sec) : Math.floor(Date.now() / 1000);
  const deadlines = data?.podium_deadlines_sec ?? [];

  return (
    <div className="arena-timer-chips" data-testid="arena-timer-chips" aria-label="Podium timers">
      {SECONDARY_PODIUM_CHIPS.map((chip) => {
        const idx = chip.contractIndex;
        const dl = data ? Number(deadlines[idx] ?? 0) : undefined;
        const rem = dl !== undefined ? Math.max(0, dl - now) : undefined;
        const unlocked = playerLevel !== undefined && isFeatureUnlocked(playerLevel, chip.feature);
        const requiredLevel = FEATURE_UNLOCK_LEVEL[chip.feature];
        const helpButton = onFeatureHelp ? (
          <button
            type="button"
            className="arena-timer-chips__help"
            aria-label={`Open ${chip.label} tutorial`}
            onClick={() => onFeatureHelp(chip.feature)}
          >
            ?
          </button>
        ) : null;
        const chipContents = (
          <>
            <span className="arena-timer-chips__chip" data-testid={`arena-timer-chip-${chip.contractIndex}`}>
              <span className="arena-timer-chips__label">{chip.label}</span>
              <span className="arena-timer-chips__value">{rem !== undefined ? formatMmSsCountdown(rem) : "—"}</span>
            </span>
            <span className="arena-timer-chips__lock">{unlocked ? "LIVE" : `L${requiredLevel}`}</span>
            {unlocked ? helpButton : null}
          </>
        );
        if (!unlocked) {
          return (
            <LockedUntilLevel
              key={chip.label}
              requiredLevel={requiredLevel}
              variant="compact"
              className="arena-timer-chips__gate arena-timer-chips__gate--locked"
              testId={`arena-timer-chip-gate-${chip.contractIndex}`}
              overlayTestId={`arena-timer-chip-lock-${chip.contractIndex}`}
              action={helpButton}
            >
              {chipContents}
            </LockedUntilLevel>
          );
        }
        return (
          <div
            key={chip.label}
            className="arena-timer-chips__gate arena-timer-chips__gate--unlocked"
            data-testid={`arena-timer-chip-gate-${chip.contractIndex}`}
          >
            {chipContents}
          </div>
        );
      })}
    </div>
  );
}
