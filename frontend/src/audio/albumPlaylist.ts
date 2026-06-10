// SPDX-License-Identifier: AGPL-3.0-only

// Keep `glass_arena.manifest.json` in sync with `public/music/albums/glass_arena/manifest.json` (autodiscovery / tooling).
import glassArenaManifest from "./glass_arena.manifest.json";

export type AlbumTrack = {
  src: string;
  title: string;
  /** Stable within manifest (`albumId` + `/` + file); used for BGM resume ([issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)). */
  id: string;
  /** From manifest; used to clamp persisted `positionSec` on hydrate. */
  durationSec: number;
};

export type GlassArenaManifestTrack = {
  index: number;
  file: string;
  title: string;
  durationSec: number;
};

export type GlassArenaManifest = {
  albumId: string;
  albumTitle: string;
  publicBasePath: string;
  tracks: GlassArenaManifestTrack[];
};

export function manifestToPlaylist(m: GlassArenaManifest): readonly AlbumTrack[] {
  const raw = m.publicBasePath.replace(/\/$/, "");
  return m.tracks.map((t) => ({
    src: `${raw}/${t.file}`,
    title: t.title,
    id: `${m.albumId}/${t.file}`,
    durationSec: t.durationSec,
  }));
}

/** Full **Glass Arena** BGM album (16 tracks). */
export const GLASS_ARENA_PLAYLIST: readonly AlbumTrack[] = manifestToPlaylist(
  glassArenaManifest as GlassArenaManifest,
);
