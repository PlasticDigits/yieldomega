// SPDX-License-Identifier: AGPL-3.0-only

/** Which short tick to play for the hero countdown (issue #68). */
export type ArenaHeroCountdownSecondKind = "calm" | "urgent";

/**
 * When the sale countdown drops to a new second, choose a one-shot tick only
 * while **below 2 minutes** (`remaining < 120`). Final band **≤30s** uses the
 * urgent cue; **31–119s** uses the calm cue.
 */
export function resolveArenaHeroCountdownSecondSfx(args: {
  prevRemainingSec: number | undefined;
  nextRemainingSec: number | undefined;
  saleActive: boolean;
  reduceMotion: boolean;
}): ArenaHeroCountdownSecondKind | null {
  if (!args.saleActive || args.reduceMotion) return null;
  const r = args.nextRemainingSec;
  if (r === undefined || r <= 0) return null;
  const p = args.prevRemainingSec;
  if (p === undefined) return null;
  if (r >= p) return null;
  if (r >= 120) return null;
  if (r <= 30) return "urgent";
  return "calm";
}
