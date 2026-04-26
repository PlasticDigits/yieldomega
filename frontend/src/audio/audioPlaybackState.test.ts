// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumTrack } from "./albumPlaylist";
import {
  AUDIO_PLAYBACK_PERIODIC_SAVE_MS,
  AUDIO_PLAYBACK_STALE_MS,
  AUDIO_PLAYBACK_STATE_KEY,
  createMinIntervalGate,
  loadAudioPlaybackState,
  normalizePlaybackState,
  saveAudioPlaybackState,
} from "./audioPlaybackState";

const pl: readonly AlbumTrack[] = [
  {
    src: "/a.mp3",
    title: "A",
    id: "album/a.mp3",
    durationSec: 100,
  },
  {
    src: "/b.mp3",
    title: "B",
    id: "album/b.mp3",
    durationSec: 50,
  },
];

function installWindowLocalStorage(): void {
  const map = new Map<string, string>();
  const ls: Storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("window", { localStorage: ls });
}

describe("audioPlaybackState", () => {
  beforeEach(() => {
    installWindowLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips save → load via localStorage", () => {
    saveAudioPlaybackState({
      trackIndex: 1,
      positionSec: 12.5,
      savedAt: Date.now(),
      trackId: "album/b.mp3",
    });
    const h = loadAudioPlaybackState(pl);
    expect(h.trackIndex).toBe(1);
    expect(h.positionSec).toBeCloseTo(12.5, 5);
    expect(h.trackId).toBe("album/b.mp3");
  });

  it("load returns defaults when storage is empty", () => {
    const h = loadAudioPlaybackState(pl);
    expect(h.trackIndex).toBe(0);
    expect(h.positionSec).toBe(0);
    expect(h.trackId).toBe("album/a.mp3");
  });

  it("load returns defaults on corrupt JSON", () => {
    window.localStorage.setItem(AUDIO_PLAYBACK_STATE_KEY, "{not json");
    const h = loadAudioPlaybackState(pl);
    expect(h.trackIndex).toBe(0);
    expect(h.positionSec).toBe(0);
  });

  it("normalize clamps position to duration and rejects negative", () => {
    const now = 1_700_000_000_000;
    const raw = {
      trackIndex: 0,
      positionSec: 9999,
      savedAt: now,
      trackId: "album/a.mp3",
    };
    const h = normalizePlaybackState(raw, pl, now);
    expect(h.positionSec).toBeLessThanOrEqual(99.75);
    expect(h.trackIndex).toBe(0);

    const h2 = normalizePlaybackState(
      { ...raw, positionSec: -3, savedAt: now },
      pl,
      now,
    );
    expect(h2.positionSec).toBe(0);
  });

  it("normalize resolves by trackId when index drifted", () => {
    const now = 1_700_000_000_000;
    const h = normalizePlaybackState(
      {
        trackIndex: 0,
        positionSec: 1,
        savedAt: now,
        trackId: "album/b.mp3",
      },
      pl,
      now,
    );
    expect(h.trackIndex).toBe(1);
  });

  it("stale snapshot collapses position to 0 but keeps resolved track", () => {
    const now = 1_800_000_000_000;
    const savedAt = now - AUDIO_PLAYBACK_STALE_MS - 60_000;
    const h = normalizePlaybackState(
      {
        trackIndex: 1,
        positionSec: 40,
        savedAt,
        trackId: "album/b.mp3",
      },
      pl,
      now,
    );
    expect(h.trackIndex).toBe(1);
    expect(h.positionSec).toBe(0);
  });

  it("createMinIntervalGate fires at most once per window", () => {
    const gate = createMinIntervalGate(AUDIO_PLAYBACK_PERIODIC_SAVE_MS);
    expect(gate(0)).toBe(true);
    expect(gate(1000)).toBe(false);
    expect(gate(4000)).toBe(true);
    expect(gate(5000)).toBe(false);
    expect(gate(8000)).toBe(true);
  });
});
