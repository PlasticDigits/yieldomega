// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Mobile layout tokens for the Blockie Hills dock (`.album-player-dock`) vs the
 * fixed bottom `.app-header` card ([GitLab #103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103)).
 *
 * **Invariant (`INV-AUDIO-103`):** On viewports `≤720px`, `.album-player-dock`
 * uses a bottom offset of `calc(max(0.4rem, env(safe-area-inset-bottom, 0px)) + Nrem)`
 * where **N** is {@link MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM}. The
 * fixed bottom header stays below the dock so the music controls open above the
 * icon without covering the nav chrome.
 *
 * Keep this file aligned with the `@media (max-width: 720px)` `.album-player-dock`
 * rule in `frontend/src/index.css`. Vitest
 * [`mobileAlbumDockLayout.test.ts`](./mobileAlbumDockLayout.test.ts) asserts
 * bidirectional parity ([GitLab #107](https://gitlab.com/PlasticDigits/yieldomega/-/issues/107)).
 */
export const MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM = 3.95 as const;
