// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Album 1 — first eight tracks only (GitLab #68 acceptance table).
 * Additional MP3s may exist under `public/music/album_1/` for future seasons;
 * the in-app player intentionally loops this ordered subset.
 */
export type AlbumTrack = { src: string; title: string };

export const ALBUM_1_PLAYLIST: readonly AlbumTrack[] = [
  { src: "/music/album_1/01-hills-dawn.mp3", title: "Hills at Dawn" },
  { src: "/music/album_1/02-coin-path.mp3", title: "Coin Path" },
  { src: "/music/album_1/03-rainbow-switchback.mp3", title: "Rainbow Switchback" },
  { src: "/music/album_1/04-moss-and-brass.mp3", title: "Moss and Brass" },
  { src: "/music/album_1/05-jig-generator.mp3", title: "Jig Generator" },
  { src: "/music/album_1/06-starline-overworld.mp3", title: "Starline Overworld" },
  { src: "/music/album_1/07-lucky-run.mp3", title: "Lucky Run" },
  { src: "/music/album_1/08-kumbaya-campfire.mp3", title: "Kumbaya Campfire" },
] as const;
