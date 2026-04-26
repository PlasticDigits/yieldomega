// SPDX-License-Identifier: AGPL-3.0-only

import type { AlbumTrack } from "./albumPlaylist";

const STORAGE_PREFIX = "yieldomega:audio:v1:" as const;

export const AUDIO_PLAYBACK_STATE_KEY = `${STORAGE_PREFIX}playbackState` as const;

/** Snapshots older than this use **track** resume but **positionSec = 0** ([issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)). */
export const AUDIO_PLAYBACK_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum interval between `timeupdate`-driven persistence writes while playing. */
export const AUDIO_PLAYBACK_PERIODIC_SAVE_MS = 4000;

export type AudioPlaybackStateV1 = {
  /** Index into playlist at save time; reconciled with `trackId` on load. */
  trackIndex: number;
  /** Seconds into the current track (clamped on read). */
  positionSec: number;
  /** ms since epoch when this snapshot was written. */
  savedAt: number;
  /** Stable id of the track at save time (`AlbumTrack.id`). */
  trackId: string;
};

export type HydratedAlbumPlayback = {
  trackIndex: number;
  positionSec: number;
  trackId: string;
};

function clampIndex(i: number, len: number): number {
  if (!Number.isFinite(i) || len <= 0) return 0;
  return Math.max(0, Math.min(len - 1, Math.floor(i)));
}

function clampFiniteNonNegativeSec(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function findIndexByTrackId(playlist: readonly AlbumTrack[], id: string): number {
  const idx = playlist.findIndex((t) => t.id === id);
  return idx >= 0 ? idx : -1;
}

/**
 * Resolve stored JSON into a safe playback snapshot for the current playlist.
 * Exported for unit tests and for React initial `trackIndex` (dock title).
 */
export function normalizePlaybackState(
  raw: unknown,
  playlist: readonly AlbumTrack[],
  nowMs: number = Date.now(),
): HydratedAlbumPlayback {
  const len = playlist.length;
  if (len === 0) {
    return { trackIndex: 0, positionSec: 0, trackId: "" };
  }

  if (!raw || typeof raw !== "object") {
    return { trackIndex: 0, positionSec: 0, trackId: playlist[0]?.id ?? "" };
  }

  const o = raw as Partial<AudioPlaybackStateV1>;
  const savedAt = Number.isFinite(o.savedAt) ? (o.savedAt as number) : 0;
  const stale = nowMs - savedAt > AUDIO_PLAYBACK_STALE_MS;

  let trackIndex = clampIndex(Number(o.trackIndex), len);
  const trackId = typeof o.trackId === "string" ? o.trackId : "";
  const byId = trackId ? findIndexByTrackId(playlist, trackId) : -1;
  if (byId >= 0) {
    trackIndex = byId;
  } else if (trackId) {
    /* playlist changed: numeric index is best-effort */
    trackIndex = clampIndex(trackIndex, len);
  } else {
    trackIndex = clampIndex(trackIndex, len);
  }

  let positionSec = clampFiniteNonNegativeSec(Number(o.positionSec));
  if (stale) {
    positionSec = 0;
  }

  const track = playlist[trackIndex] ?? playlist[0];
  const dur = track.durationSec;
  if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
    const maxT = Math.max(0, dur - 0.25);
    positionSec = Math.min(positionSec, maxT);
  }

  return {
    trackIndex,
    positionSec,
    trackId: track.id,
  };
}

export function loadAudioPlaybackState(
  playlist: readonly AlbumTrack[],
): HydratedAlbumPlayback {
  if (typeof window === "undefined") {
    return { trackIndex: 0, positionSec: 0, trackId: playlist[0]?.id ?? "" };
  }
  try {
    const s = window.localStorage.getItem(AUDIO_PLAYBACK_STATE_KEY);
    if (!s) {
      return { trackIndex: 0, positionSec: 0, trackId: playlist[0]?.id ?? "" };
    }
    const parsed: unknown = JSON.parse(s);
    return normalizePlaybackState(parsed, playlist);
  } catch {
    return { trackIndex: 0, positionSec: 0, trackId: playlist[0]?.id ?? "" };
  }
}

export function saveAudioPlaybackState(state: AudioPlaybackStateV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUDIO_PLAYBACK_STATE_KEY,
      JSON.stringify({
        trackIndex: Math.max(0, Math.floor(state.trackIndex)),
        positionSec: clampFiniteNonNegativeSec(state.positionSec),
        savedAt: Number.isFinite(state.savedAt) ? state.savedAt : Date.now(),
        trackId: String(state.trackId),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function buildPlaybackSnapshot(
  playlist: readonly AlbumTrack[],
  trackIndex: number,
  positionSec: number,
): AudioPlaybackStateV1 | null {
  const len = playlist.length;
  if (len === 0) return null;
  const idx = clampIndex(trackIndex, len);
  const track = playlist[idx];
  if (!track) return null;
  let pos = clampFiniteNonNegativeSec(positionSec);
  const dur = track.durationSec;
  if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
    pos = Math.min(pos, Math.max(0, dur - 0.25));
  }
  return {
    trackIndex: idx,
    positionSec: pos,
    savedAt: Date.now(),
    trackId: track.id,
  };
}

/**
 * Throttle: returns true when `fn` should run (and updates internal clock).
 * For tests and `timeupdate` coalescing.
 */
export function createMinIntervalGate(intervalMs: number) {
  let lastFire = -Infinity;
  return (nowMs: number): boolean => {
    if (nowMs - lastFire >= intervalMs) {
      lastFire = nowMs;
      return true;
    }
    return false;
  };
}
