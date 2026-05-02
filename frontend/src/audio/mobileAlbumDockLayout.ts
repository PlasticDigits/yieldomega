// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Mobile layout tokens for the Blockie Hills dock (`.album-player-dock`) vs the
 * bordered `.app-header` card ([GitLab #103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103)).
 *
 * **Invariant (`INV-AUDIO-103`):** On viewports `≤720px`, `.app-header` uses a
 * `margin-top` of `max(0.75rem, calc(env(safe-area-inset-top, 0px) + N))`
 * where **N** is {@link MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM}. The
 * fixed dock stays at `top: max(0.45rem, env(safe-area-inset-top, 0px))`; the
 * larger header offset clears the dock bubble above the nav chrome without
 * changing tablet/desktop (`min-width: 721px`) rhythms.
 *
 * Keep this file aligned with the `@media (max-width: 720px)` `.app-header`
 * rule in `frontend/src/index.css`. Vitest
 * [`mobileAlbumDockLayout.test.ts`](./mobileAlbumDockLayout.test.ts) asserts
 * bidirectional parity ([GitLab #107](https://gitlab.com/PlasticDigits/yieldomega/-/issues/107)).
 */
export const MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM = 4.5 as const;
