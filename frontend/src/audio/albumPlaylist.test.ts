// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  GLASS_ARENA_PLAYLIST,
  manifestToPlaylist,
  type GlassArenaManifest,
} from "./albumPlaylist";

describe("GLASS_ARENA_PLAYLIST", () => {
  it("has sixteen Glass Arena tracks from manifest", () => {
    expect(GLASS_ARENA_PLAYLIST).toHaveLength(16);
    expect(GLASS_ARENA_PLAYLIST[0].id).toBe("glass_arena/01-console-boot.mp3");
    expect(GLASS_ARENA_PLAYLIST[0].src).toContain("/music/albums/glass_arena/01-console-boot.mp3");
    expect(GLASS_ARENA_PLAYLIST[5].title).toBe("Last Buy");
    expect(GLASS_ARENA_PLAYLIST[8].src).toContain("09-arena-gate.mp3");
    expect(GLASS_ARENA_PLAYLIST[15].src).toContain("16-logout-lullaby.mp3");
  });
});

describe("manifestToPlaylist", () => {
  it("joins publicBasePath and file", () => {
    const m: GlassArenaManifest = {
      albumId: "glass_arena",
      albumTitle: "Glass Arena",
      publicBasePath: "/music/albums/glass_arena/",
      tracks: [
        { index: 1, file: "a.mp3", title: "A", durationSec: 1 },
        { index: 2, file: "b.mp3", title: "B", durationSec: 2 },
      ],
    };
    const pl = manifestToPlaylist(m);
    expect(pl[0]).toEqual({
      src: "/music/albums/glass_arena/a.mp3",
      title: "A",
      id: "glass_arena/a.mp3",
      durationSec: 1,
    });
    expect(pl[1]).toEqual({
      src: "/music/albums/glass_arena/b.mp3",
      title: "B",
      id: "glass_arena/b.mp3",
      durationSec: 2,
    });
  });
});
