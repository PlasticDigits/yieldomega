// SPDX-License-Identifier: AGPL-3.0-only

const K = "yieldomega:audio:v1:" as const;

export type AudioPrefsV1 = {
  /** BGM fader 0–1000 (default 250 = 25% of full scale, issue #68). */
  bgmPermille: number;
  /** SFX fader 0–1000 (default 1000). */
  sfxPermille: number;
  masterMuted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
  /**
   * When true, BGM should play whenever the engine can (after unlock / load).
   * Persisted so returning visitors resume album playback; default false = dock starts paused.
   */
  bgmUserWantsPlaying: boolean;
};

const defaults: AudioPrefsV1 = {
  bgmPermille: 250,
  sfxPermille: 1000,
  masterMuted: false,
  bgmMuted: false,
  sfxMuted: false,
  bgmUserWantsPlaying: false,
};

function clampPermille(n: number): number {
  if (!Number.isFinite(n)) return defaults.bgmPermille;
  return Math.max(0, Math.min(1000, Math.round(n)));
}

export function loadAudioPrefs(): AudioPrefsV1 {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = window.localStorage.getItem(K + "prefs");
    if (!raw) return { ...defaults };
    const o = JSON.parse(raw) as Partial<AudioPrefsV1>;
    return {
      bgmPermille: clampPermille(o.bgmPermille ?? defaults.bgmPermille),
      sfxPermille: clampPermille(o.sfxPermille ?? defaults.sfxPermille),
      masterMuted: Boolean(o.masterMuted),
      bgmMuted: Boolean(o.bgmMuted),
      sfxMuted: Boolean(o.sfxMuted),
      bgmUserWantsPlaying: o.bgmUserWantsPlaying === true,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAudioPrefs(p: AudioPrefsV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      K + "prefs",
      JSON.stringify({
        bgmPermille: clampPermille(p.bgmPermille),
        sfxPermille: clampPermille(p.sfxPermille),
        masterMuted: p.masterMuted,
        bgmMuted: p.bgmMuted,
        sfxMuted: p.sfxMuted,
        bgmUserWantsPlaying: p.bgmUserWantsPlaying,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Linear BGM gain 0..1 from permille (1000 = full). */
export function bgmLinearGainFromPermille(permille: number): number {
  return clampPermille(permille) / 1000;
}

/**
 * Perceived volume: square law so mid-slider moves feel natural (issue #68).
 * Input 0–1000 → roughly 0..1.
 */
export function sfxCurveGainFromPermille(permille: number): number {
  const t = clampPermille(permille) / 1000;
  return t * t;
}
