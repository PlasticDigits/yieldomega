// SPDX-License-Identifier: AGPL-3.0-only

// Keep `blockie_hills.manifest.json` in sync with `public/music/albums/blockie_hills/manifest.json` (autodiscovery / tooling).
import blockieHillsManifest from "./blockie_hills.manifest.json";

export type AlbumTrack = {
  src: string;
  title: string;
  /** Stable within manifest (`albumId` + `/` + file); used for BGM resume ([issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)). */
  id: string;
  /** From manifest; used to clamp persisted `positionSec` on hydrate. */
  durationSec: number;
};

export type BlockieHillsManifestTrack = {
  index: number;
  file: string;
  title: string;
  durationSec: number;
};

export type BlockieHillsManifest = {
  albumId: string;
  albumTitle: string;
  publicBasePath: string;
  tracks: BlockieHillsManifestTrack[];
};

export function manifestToPlaylist(m: BlockieHillsManifest): readonly AlbumTrack[] {
  const raw = m.publicBasePath.replace(/\/$/, "");
  return m.tracks.map((t) => ({
    src: `${raw}/${t.file}`,
    title: t.title,
    id: `${m.albumId}/${t.file}`,
    durationSec: t.durationSec,
  }));
}

/** Full **Blockie Hills** album (16 tracks); canonical metadata in `blockie_hills.manifest.json` (also under `public/music/albums/blockie_hills/`). */
export const BLOCKIE_HILLS_PLAYLIST: readonly AlbumTrack[] = manifestToPlaylist(
  blockieHillsManifest as BlockieHillsManifest,
);
