// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  BLOCKIE_HILLS_PLAYLIST,
  manifestToPlaylist,
  type BlockieHillsManifest,
} from "./albumPlaylist";

describe("BLOCKIE_HILLS_PLAYLIST", () => {
  it("has sixteen Blockie Hills tracks from manifest", () => {
    expect(BLOCKIE_HILLS_PLAYLIST).toHaveLength(16);
    expect(BLOCKIE_HILLS_PLAYLIST[0].src).toContain("/music/albums/blockie_hills/01-hills-dawn.mp3");
    expect(BLOCKIE_HILLS_PLAYLIST[7].title).toBe("Kumbaya Campfire");
    expect(BLOCKIE_HILLS_PLAYLIST[8].src).toContain("09-emerald-gate.mp3");
    expect(BLOCKIE_HILLS_PLAYLIST[15].src).toContain("16-logging-off-lullaby.mp3");
  });
});

describe("manifestToPlaylist", () => {
  it("joins publicBasePath and file", () => {
    const m: BlockieHillsManifest = {
      albumId: "x",
      albumTitle: "X",
      publicBasePath: "/music/albums/blockie_hills/",
      tracks: [
        { index: 1, file: "a.mp3", title: "A", durationSec: 1 },
        { index: 2, file: "b.mp3", title: "B", durationSec: 2 },
      ],
    };
    const pl = manifestToPlaylist(m);
    expect(pl[0]).toEqual({ src: "/music/albums/blockie_hills/a.mp3", title: "A" });
    expect(pl[1]).toEqual({ src: "/music/albums/blockie_hills/b.mp3", title: "B" });
  });
});
