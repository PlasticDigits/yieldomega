// SPDX-License-Identifier: AGPL-3.0-only

/** Filenames under `frontend/public/sound-effects/` (issue #68). */
export const SFX_FILES = {
  ui_button_click: "/sound-effects/ui_button_click.wav",
  coin_hit_shallow: "/sound-effects/coin_hit_shallow.wav",
  charmed_confirm: "/sound-effects/charmed_confirm.wav",
  peer_buy_distant: "/sound-effects/peer_buy_distant.wav",
  timer_heartbeat_calm: "/sound-effects/timer_heartbeat_calm.wav",
  timer_heartbeat_urgent: "/sound-effects/timer_heartbeat_urgent.wav",
  warbow_twang: "/sound-effects/warbow_twang.wav",
  kumbaya_whoosh: "/sound-effects/kumbaya_whoosh.wav",
} as const;

export type SfxId = keyof typeof SFX_FILES;
