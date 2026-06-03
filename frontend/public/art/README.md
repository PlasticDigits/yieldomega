# `frontend/public/art/` — purpose-named asset directory

This is the **single map of all production raster art** referenced from the Vite static frontend at runtime. Files in this tree are served as `/art/...` (no bundler hashing), so **renaming or moving anything here is a code change** — every consumer is listed below so future agents can update them in lock-step.

The layout was reorganized as part of [`docs/agent-phases.md` Phase 13 — Frontend design](../../../docs/agent-phases.md#phase-13) and [issue #44 — design pass](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44) so each subfolder maps to one **purpose** and one **shape constraint** (cutouts are transparent PNGs, scenes are wide JPGs, icons are 256-square PNGs, etc.).

**v1 TimeCurve pages retired ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)):** consumer links below point at **`TimeArenaPage`** and **`pages/arena/*`** only — not deleted `TimeCurve*.tsx` / `timeCurveArena/*` files. Confirm wiring with `rg "/art/" frontend/src` (source of truth). Automated gate: **`INV-FRONTEND-286-ART-README`**, `bash scripts/check-art-readme-consumers.sh` ([#286](https://gitlab.com/PlasticDigits/yieldomega/-/issues/286)).

---

## Top-level conventions

- **Path stability:** treat `/art/<purpose>/<name>.<ext>` as a public ABI for the frontend. If you rename, run `rg "/art/" frontend/` and update every consumer plus this README.
- **AGPL artwork:** new generated drops default to AGPL-3.0 alongside the rest of the repo (see [`LICENSE`](../../../LICENSE) and [`docs/licensing.md`](../../../docs/licensing.md)). Reference inputs that originate from upstream packs keep their upstream license — check `scripts/replicate-art/` history.
- **Generation:** see [`scripts/replicate-art/`](../../../scripts/replicate-art/), [`issue45_batch.py`](../../../scripts/replicate-art/issue45_batch.py) (historic pack), [`issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py) ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)), [`issue60_batch.py`](../../../scripts/replicate-art/issue60_batch.py) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60) cursor pack), [`sniper_shark_cutouts.py`](../../../scripts/replicate-art/sniper_shark_cutouts.py) (sniper-shark `cutouts/`), [`cursor_batch.py`](../../../scripts/replicate-art/cursor_batch.py) (CSS cursor-name pack with MDN reference inputs), and [`posts_batch.py`](../../../scripts/replicate-art/posts_batch.py) (numbered **`posts/`** stills for social). Issue #45 drops used `pending_manual_review/` for QA; later batches promote into `cursors/` with optional `pending_manual_review/issue*-gen/` scratch (gitignored).
- **`/art/` in code:** all current consumers live in `frontend/src/`, `frontend/index.html`, and `frontend/vite.config.ts`. Search with `rg "/art/" frontend/`.
- **`/tokens/` in code:** canonical ticker + MegaETH mark URLs from [`tokenMedia.ts`](../../src/lib/tokenMedia.ts). Search with `rg "tokenMedia|/tokens/" frontend/src`.

---

## Purpose folders

### `cutouts/`

Transparent-background PNG mascots, stickers, and small character art. Imported via the [`CutoutDecoration`](../../src/components/CutoutDecoration.tsx) helper or directly in pages that decorate a hero panel.

| File                                                | Used by                                                                 | Notes                                                                                  |
|-----------------------------------------------------|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| [`bunny-cutout.png`](./cutouts/bunny-cutout.png)    | _staged_                                                                | Reserved for a future Collection placeholder.                                          |
| [`cutout-bunny-girl-full.png`](./cutouts/cutout-bunny-girl-full.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Primary heroine cutout for the home / launch countdown art column. |
| [`cutout-bunny-girl-head.png`](./cutouts/cutout-bunny-girl-head.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts), [`ReferralsPage.tsx`](../../src/pages/ReferralsPage.tsx) (via `PLACEHOLDER_CUTOUTS_BY_SLUG`) | Compact head bust used as `peek` decoration on Home and referral placeholders. |
| [`cutout-bunny-girl-playful.png`](./cutouts/cutout-bunny-girl-playful.png) | _unused (reserved for upcoming Collection)_                          | Style reference for the next Collection iteration.                                     |
| [`greenhat.png`](./cutouts/greenhat.png)            | _legacy_                                                                | Replaced in product UI by `hat-coin-*.png` art at the repo root.                       |
| [`loading-mascot-circle.png`](./cutouts/loading-mascot-circle.png) | [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) (placeholder + third-party cutout layers) | Tertiary/footer cutout in referral and third-party placeholder surfaces. |
| [`mascot-bunny-girl-jump-cutout.png`](./cutouts/mascot-bunny-girl-jump-cutout.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Action pose for hero strips. |
| [`mascot-bunny-girl-wave-cutout.png`](./cutouts/mascot-bunny-girl-wave-cutout.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`ArenaSections.tsx`](../../src/pages/arena/ArenaSections.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts), [`ReferralsPage.tsx`](../../src/pages/ReferralsPage.tsx) | Friendly wave pose; wired into referral placeholders too. |
| [`mascot-with-bag-cutout.png`](./cutouts/mascot-with-bag-cutout.png) | _staged_                                                                | Old-money leprechaun (legacy reserve art; not wired post-#266). |
| [`token-logo.png`](./cutouts/token-logo.png)        | _legacy duplicate of `../token-logo.png`_                                | Kept for the issue #45 reference pipeline; do not introduce new consumers.             |
| **issue #45 additions**                             |                                                                         | All new cutouts came from [issue #45](./issue45/README.md) and use the `bunny-*` and `*-concept` naming prefix below. |
| [`bunny-wave.png`](./cutouts/bunny-wave.png)        | _staged_                                                                | Mascot wave alt — earmarked for `RootLayout` micro-decoration.                         |
| [`bunny-jump.png`](./cutouts/bunny-jump.png)        | [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx)    | Mascot jump alt on the launch countdown surface.                                       |
| [`bunny-thinking.png`](./cutouts/bunny-thinking.png) | _staged_                                                                | "Thinking" mascot for in-queue placeholders. |
| [`bunny-podium-win.png`](./cutouts/bunny-podium-win.png) | [`ArenaSimplePodiumSection.tsx`](../../src/pages/arena/ArenaSimplePodiumSection.tsx) | Victory pose for the podium summary card.                                            |
| [`bunny-guarding.png`](./cutouts/bunny-guarding.png) | [`ArenaLiveBuysActivitySection.tsx`](../../src/pages/arena/ArenaLiveBuysActivitySection.tsx) (live-buy legend) | Guard stance — paired with `icons/warbow-guard.png` when WarBow rows wire full pictograms. |
| [`bunny-sneak-steal.png`](./cutouts/bunny-sneak-steal.png) | _staged_ | Steal stance — paired with `icons/warbow-steal.png` when wired.                          |
| [`mascot-bag-bunny-pair.png`](./cutouts/mascot-bag-bunny-pair.png) | [`ArenaSimplePage.tsx`](../../src/pages/arena/ArenaSimplePage.tsx) (timer panel mascot) | Pair scene used as the calm "fair launch" sidekick on the Simple view. |
| [`trait-silos-concept.png`](./cutouts/trait-silos-concept.png) | _staged_ (Collection page reference)                                | Concept art for the future Collection trait silos.                                     |
| [`footer-micro.png`](./cutouts/footer-micro.png)    | _staged_                                                                | Subtle micro-decoration candidate for the fee transparency block.                      |
| [`indexer-down-mascot.png`](./cutouts/indexer-down-mascot.png) | [`TimerHeroLiveBuys.tsx`](../../src/pages/arena/TimerHeroLiveBuys.tsx) | Soft illustration when recent buys cannot load from the indexer ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| [`sniper-shark-peek-scope.png`](./cutouts/sniper-shark-peek-scope.png) | _staged_ | Sparse issue #80 "predator in the pool" accent for the competitive buy surface; decorative (`alt=""`, `aria-hidden`) through `CutoutDecoration`. |
| [`sniper-shark-coin-bandolier.png`](./cutouts/sniper-shark-coin-bandolier.png) | [`ArenaLiveBuysActivitySection.tsx`](../../src/pages/arena/ArenaLiveBuysActivitySection.tsx) | Live-buy legend accent. |
| [`sniper-shark-*.png`](./cutouts/) (remaining six files) | _staged_ | Sniper-shark mascots: ghillie prone, tactical kneel, cool suit + headset, diver harpoon, spotter, victory medal. [`sniper_shark_cutouts.py`](../../../scripts/replicate-art/sniper_shark_cutouts.py) |

### `scenes/`

Wide JPG scenes used as page hero backplates or feature art. **JPG only** — alpha is provided by the page composition, not by the asset.

| File                                                  | Used by                                              | Notes                                              |
|-------------------------------------------------------|------------------------------------------------------|----------------------------------------------------|
| [`home-hero-desktop.jpg`](./scenes/home-hero-desktop.jpg) | [`HomePage.tsx`](../../src/pages/HomePage.tsx)       | Desktop wide hero; replaces the legacy `../hero-home-wide.jpg` for HD viewports. |
| [`home-hero-mobile.jpg`](./scenes/home-hero-mobile.jpg) | [`HomePage.tsx`](../../src/pages/HomePage.tsx)       | Mobile crop variant served via `<picture>` `media`. |
| [`arena-simple.jpg`](./scenes/arena-simple.jpg) | [`ArenaTimerHero.tsx`](../../src/pages/arena/ArenaTimerHero.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts), [`index.css`](../../src/index.css) | Calm fair-launch backplate for the Time Arena timer hero. |
| [`arena-arena.jpg`](./scenes/arena-arena.jpg) | [`index.css`](../../src/index.css) (buy panel background) | PvP / podium tension backplate.                |
| [`arena-protocol.jpg`](./scenes/arena-protocol.jpg) | [`ArenaProtocolPage.tsx`](../../src/pages/arena/ArenaProtocolPage.tsx) | Neutral operator backdrop for the Protocol read-only view. |
| [`collection-gallery.jpg`](./scenes/collection-gallery.jpg) | _staged_ | Gallery shelves backplate — Collection route not shipped.                                                |
| [`referrals-network.jpg`](./scenes/referrals-network.jpg) | [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) (Home card) | Home grid card art; same motif family as `referrals-hero.jpg`.        |
| [`referrals-hero.jpg`](./scenes/referrals-hero.jpg) | _reference_ | 1600×900 hero variant ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)); live Referrals surface uses cutout placeholders. |
| [`launch-countdown.jpg`](./scenes/launch-countdown.jpg) | [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx) | Launch countdown key art.                                                 |
| [`error-indexer-down.jpg`](./scenes/error-indexer-down.jpg) | _staged_ | Empty/error illustration for indexer down (issue #44 wiring).                |
| [`error-wrong-network.jpg`](./scenes/error-wrong-network.jpg) | _staged_ | Wrong-network scene art; live shell uses `icons/header-wrong-network.png` in [`RootLayout.tsx`](../../src/layout/RootLayout.tsx).       |
| [`error-wrong-network-portrait.jpg`](./scenes/error-wrong-network-portrait.jpg) | _reserved_ (future full-screen wrong-network overlay) | Tall portrait crop from the landscape error art ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |

**Third-party venue cards (art root, not under `scenes/`):** partner-approved key art for home CTAs and third-party DEX pages. Strips in `scenes/*-strip.jpg` are legacy; production uses:

| File | Used by | Notes |
|------|---------|-------|
| [`kumbaya-card.jpg`](./kumbaya-card.jpg) | [`HomePage.tsx`](../../src/pages/HomePage.tsx) (`surfaceContent`), [`KumbayaPage.tsx`](../../src/pages/KumbayaPage.tsx) | Replaces `scenes/kumbaya-strip.jpg`. |
| [`sir-card.png`](./sir-card.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx) (`surfaceContent`), [`SirPage.tsx`](../../src/pages/SirPage.tsx) | Replaces `scenes/sir-strip.jpg` (PNG). |

### Canonical token marks (`frontend/public/tokens/`)

On-chain ticker art for **CHARM**, **CL8Y**, **DOUB**, **ETH**, **USDM**, plus a **MegaETH** ecosystem mark, lives **outside** `art/` so token SVG/PNG can evolve without overloading the issue #45 icon pack. Files are served as **`/tokens/<filename>`** (Vite `public/` root). TypeScript should import URL constants from **[`tokenMedia.ts`](../../src/lib/tokenMedia.ts)** rather than hard-coding strings. Short folder README: [`tokens/README.md`](../tokens/README.md).

| File | Used by (via `tokenMedia.ts`) |
|------|-------------------------------|
| [`tokens/charm.png`](../tokens/charm.png) | [`ArenaSimplePage.tsx`](../../src/pages/arena/ArenaSimplePage.tsx), [`ArenaLiveBuysActivitySection.tsx`](../../src/pages/arena/ArenaLiveBuysActivitySection.tsx) (via [`tokenMedia.ts`](../../src/lib/tokenMedia.ts)) |
| [`tokens/cl8y.svg`](../tokens/cl8y.svg) | [`arenaPayTokenOptions.ts`](../../src/lib/arenaPayTokenOptions.ts), [`ArenaLiveBuysActivitySection.tsx`](../../src/pages/arena/ArenaLiveBuysActivitySection.tsx), [`ArenaProtocolPage.tsx`](../../src/pages/arena/ArenaProtocolPage.tsx) |
| [`tokens/doub.png`](../tokens/doub.png) | [`ArenaProtocolPage.tsx`](../../src/pages/arena/ArenaProtocolPage.tsx) (`PageHero` `coinSrc` via [`tokenMedia.ts`](../../src/lib/tokenMedia.ts)) |
| [`tokens/eth.svg`](../tokens/eth.svg) | [`ArenaSimplePage.tsx`](../../src/pages/arena/ArenaSimplePage.tsx) (via [`arenaPayTokenOptions.ts`](../../src/lib/arenaPayTokenOptions.ts)) |
| [`tokens/usdm.svg`](../tokens/usdm.svg) | [`ArenaSimplePage.tsx`](../../src/pages/arena/ArenaSimplePage.tsx) (via [`arenaPayTokenOptions.ts`](../../src/lib/arenaPayTokenOptions.ts)) |
| [`tokens/mega.svg`](../tokens/mega.svg) | [`RootLayout.tsx`](../../src/layout/RootLayout.tsx) — network pill when `chainId` is in `MEGAETH_CHAIN_IDS` (MegaETH mainnet / testnet; aligned with [`kumbayaRoutes.ts`](../../src/lib/kumbayaRoutes.ts) defaults) |

### `icons/`

Square 256px PNG icons. Tone is consistent with the arcade palette (greens, golds, hard outlines). When a vector trace is required (per issue #45 export spec), keep the PNG here as the source-of-truth raster and add the SVG alongside with the same stem.

| Slug                              | Used by                                                                    | Notes                                                                |
|-----------------------------------|----------------------------------------------------------------------------|----------------------------------------------------------------------|
| `token-cl8y.png` / `token-doub.png` / `token-charm.png` / `token-usdm.png` | [`scripts/replicate-art/issue45_batch.py`](../../../scripts/replicate-art/issue45_batch.py), [`issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py) resampling | **Legacy / pipeline rasters.** Product UI for these tickers uses **`/tokens/`** + [`tokenMedia.ts`](../../src/lib/tokenMedia.ts) (see **Canonical token marks** above). Do not add new `/art/icons/token-*.png` consumers for those glyphs. |
| `status-live.png`                 | [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `live`           | Phase badge (Sale live).                                            |
| `status-ended.png`                | [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `info` (ended)   | Phase badge (Sale ended).                                          |
| `status-prelaunch.png`            | [`phaseBadge`](../../src/pages/arena/arenaSimplePhase.ts) `saleStartPending` → [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `soon` | Pre-launch pictogram ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `status-prelanch.png`             | _legacy duplicate_                                                        | Same pixels as `status-prelaunch.png` (issue #45 typo filename kept for catalog history). |
| `status-cooldown.png`             | [`StatusMessage`](../../src/components/ui/StatusMessage.tsx) muted variant | Cooldown clock glyph.                                              |
| `status-net-ok.png`               | [`RootLayout`](../../src/layout/RootLayout.tsx) chain pill `ok`            | Wallet/network ok glyph.                                           |
| `status-net-warn.png`             | [`RootLayout`](../../src/layout/RootLayout.tsx) chain pill `warn`          | Wrong-network glyph.                                              |
| `status-indexer-ok.png`           | [`IndexerStatusBar`](../../src/components/IndexerStatusBar.tsx) ok         | Indexer ok glyph.                                                 |
| `status-indexer-bad.png`          | [`IndexerStatusBar`](../../src/components/IndexerStatusBar.tsx) bad        | Indexer degraded glyph.                                           |
| `warbow-guard.png`                | _staged_                                                                 | Guard action pictogram.                                                     |
| `warbow-steal.png`                | _staged_                                                                 | Steal action pictogram.                                                     |
| `warbow-revenge.png`              | _staged_                                                                 | Revenge action pictogram.                                                   |
| `warbow-flag.png`                 | [`ArenaLiveBuysActivitySection.tsx`](../../src/pages/arena/ArenaLiveBuysActivitySection.tsx) | Silence flag in live-buy legend.                                             |
| `nav-simple.png`                  | [`ArenaSubnav.tsx`](../../src/pages/arena/ArenaSubnav.tsx)     | Sub-nav pictogram (BUY).                                      |
| `nav-arena.png`                   | _staged_ (#266: unified `/arena` — sub-nav is BUY + AUDIT only) | Legacy Arena tab pictogram.                                       |
| `nav-protocol.png`                | [`ArenaSubnav.tsx`](../../src/pages/arena/ArenaSubnav.tsx)     | Sub-nav pictogram (AUDIT).                                    |
| `chart-accessibility.png`         | _staged_ for charts in retired v1 player reserve                                    | Color-blind safe pair swatch reference.                          |
| `loading-mascot-ring.png`         | [`LaunchGate.tsx`](../../src/app/LaunchGate.tsx), [`ArenaBranchPage.tsx`](../../src/pages/ArenaBranchPage.tsx), [`StatusMessage.tsx`](../../src/components/ui/StatusMessage.tsx) | Square loading glyph ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `token-cl8y-24.png` / `token-doub-24.png` / `token-charm-24.png` / `token-usdm-24.png` | _staged_ (dense rows, charts), [`issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py) | 24×24 crops of the 256² token icons ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). Time Arena **CL8Y** micro-glyphs now use **`/tokens/cl8y.svg`** at 24×24 instead of `token-cl8y-24.png`. |
| `fee-burn.png` / `fee-treasury.png` / `fee-referral.png` | _legacy_ (pre–Arena v2 FeeRouter sinks) | Fee sink pictograms from issue #57; [`FeeTransparency.tsx`](../../src/components/FeeTransparency.tsx) now shows vault addresses only. |
| `ui-conversion-arrow.png` | [`ConversionArrow.tsx`](../../src/components/ui/ConversionArrow.tsx), [`footerSiteLinks.ts`](../../src/lib/footerSiteLinks.ts) | Arcade “A → B” arrow between pay rails / sinks; regenerate via [`ui_conversion_arrow_batch.py`](../../../scripts/replicate-art/ui_conversion_arrow_batch.py) or `--fetch-prediction-id`. |
| `warbow-flag-20.png` / `warbow-guard-20.png` / `warbow-revenge-20.png` / `warbow-steal-20.png` | [`ArenaBuyProjectedEffects.tsx`](../../src/pages/arena/ArenaBuyProjectedEffects.tsx) (`warbow-flag-20.png` only; others _staged_) | 20×20 crops of `warbow-*.png` ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `arena-podium-last-buy.png` / `arena-podium-warbow.png` / `arena-podium-defended-streak.png` / `arena-podium-time-booster.png` | [`ArenaSimplePodiumSection.tsx`](../../src/pages/arena/ArenaSimplePodiumSection.tsx) | 140×140 small-slot reserve podium icons generated once for the 70px Simple card art wells. |
| `arena-podium-rank-first.png` / `arena-podium-rank-second.png` / `arena-podium-rank-third.png` | [`PodiumRankingList`](../../src/pages/arena/arenaUi.tsx) | 96×96 trophy rank icons displayed at ~40px in Simple podium rows. |

### `cursors/`

Custom mouse pointers wired through CSS (`cursor: url('/art/cursors/<name>.png') <hotspot-x> <hotspot-y>, <fallback>;`). This folder intentionally contains only the canonical cursor names below; do not add legacy aliases or experimental variants here.

| Slug                | Hotspot       | Used in                                                    | Fallback when blocked / on mobile |
|---------------------|---------------|------------------------------------------------------------|-----------------------------------|
| `default.png`       | (4, 4) | Idle/default cursor and `.cursor-default` in [`index.css`](../../src/index.css) | `auto` |
| `pointer.png`       | (10, 2) | Links, buttons, primary CTA, external/cancel/copy utilities, and generic clickable states in [`index.css`](../../src/index.css) | `pointer` |
| `grab.png`          | center (16, 16) | `input[type=range]`, `.cursor-grab`, legacy `.cursor-slider-grab` utility in [`index.css`](../../src/index.css) | `grab` |
| `grabbing.png`      | center (16, 16) | Active range sliders, `.cursor-grabbing`, active grab utilities in [`index.css`](../../src/index.css) | `grabbing` |
| `wait.png`          | center (16, 16) | Blocking wait states: `.loading-state`, `.cursor-wait` in [`index.css`](../../src/index.css) | `wait` |
| `context-menu.png`  | (6, 5) | `.cursor-context-menu` utility in [`index.css`](../../src/index.css) | `context-menu` |
| `help.png`          | center (16, 16) | `.cursor-help` utility in [`index.css`](../../src/index.css) | `help` |
| `progress.png`      | (6, 5) | `[aria-busy=true]`, deadline refresh text, `.cursor-progress`, `.cursor-loading` in [`index.css`](../../src/index.css) | `progress` |
| `text.png`          | center (16, 16) | Text controls and `.cursor-text` in [`index.css`](../../src/index.css) | `text` |
| `not-allowed.png`   | center (16, 16) | Disabled controls and `.cursor-not-allowed` in [`index.css`](../../src/index.css) | `not-allowed` |

### `posts/`

Numbered **social post** stills (`001.jpg` …) for X / Farcaster / Telegram — generated via [`posts_batch.py`](../../../scripts/replicate-art/posts_batch.py). Not wired into app routes by default; reference as `/art/posts/<id>.jpg`. See [`posts/README.md`](./posts/README.md) for **variety** expectations (infographic vs narrative) and how to run the script.

### `post-worldbuilding-may14/`

Sparse-text worldbuilding stills for the May 14 social posts. Generated via [`post_worldbuilding_may14_batch.py`](../../../scripts/replicate-art/post_worldbuilding_may14_batch.py) with one Replicate create attempt per image. Not wired into app routes by default; reference as `/art/post-worldbuilding-may14/arena-seat-gate.png` and `/art/post-worldbuilding-may14/transparent-tidepath.png`.

### `social/`

Social and meta-image variants. Wired through `frontend/index.html` (favicon, OpenGraph) and `frontend/vite.config.ts` (`imagePath`).

| Slug                          | Wired in                                              |
|-------------------------------|-------------------------------------------------------|
| `og-wide.jpg`                 | Canonical wide OG master; copied to top-level `opengraph.jpg` for stable `vite.config.ts` `imagePath` ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `og-square.jpg`               | Canonical square master; copied to top-level `opengraph-square.jpg` for the Twitter/X `summary` card in `vite.config.ts` ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `favicon-source.png`          | Source raster for `index.html` `<link rel="icon">`. The HTML still serves [`/art/app-icon.png`](./app-icon.png); regenerating the favicon is tracked in [`docs/frontend/missing-art-assets.md`](../../../docs/frontend/missing-art-assets.md). |
| `wallet-modal-chrome.jpg`     | RainbowKit modal page background (long-tail, kept in `social/`). |

### `motion/`

Concept stills for motion / VFX. These are illustration references, **not** runtime motion assets — animation is implemented in code (`motion/react`) per the design doc.

| Slug                          | Used as a reference for                                                |
|-------------------------------|------------------------------------------------------------------------|
| `route-transition.jpg`        | `RootLayout.tsx` page transition styling.                              |
| `countdown-tick.png`          | `LaunchCountdownPage.tsx` tick visual reference.                       |
| `victory-podium.jpg`          | Time Arena podium "post-end" celebration block.                   |

### `podium_prizes/`

Legacy single-illustration prize art kept for the Arena view. Not in the issue #45 catalog — these are pre-existing assets. The Simple podium summary now uses compact 140×140 pictograms in `icons/arena-podium-*.png` so the 70px card art wells stay readable without blank space ([#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280)).

| Slug                 | Used by                                                  |
|----------------------|----------------------------------------------------------|
| `lastbuy.png`        | Time Arena "Last buy" podium card. |
| `WARBOW_LADDER.png`  | Time Arena WarBow ladder block. |
| `DEFENDEDSTREAK.png` | Time Arena "Defended streak" podium card. |
| `TIMEBOOSTER.png`    | Time Arena "Time booster" podium card. |
| `podium prizes.png`  | Composite legacy art (kept for reference).               |

### `pending_manual_review/`

**Gitignored** drop zone for new generations from `scripts/replicate-art/`. Once reviewed, files are promoted into one of the purpose folders above and added to this README. The only tracked file is the catalog pointer ([`pending_manual_review/ISSUE_45_CHECKLIST.md`](./pending_manual_review/ISSUE_45_CHECKLIST.md)).

### Loose top-level files

Some assets are still at the top level either because they are **shared by many surfaces** (e.g. the loading mascot, the token logo, hat-coin variants) or because they pre-date the purpose-folder reorg and would require coordinated renames across many product files. These are intentionally **kept** to minimize diff churn:

| File                                  | Used by                                                                              |
|---------------------------------------|--------------------------------------------------------------------------------------|
| `app-icon.png`                        | `index.html` `<link rel="icon">`.                                                    |
| `token-logo.png`                      | `RootLayout`, `PageHero` (default coin), `LaunchCountdownPage`.                      |
| `loading-mascot.png`                  | _legacy_ (superseded by `icons/loading-mascot-ring.png`) | [`LaunchGate.tsx`](../../src/app/LaunchGate.tsx) and [`StatusMessage.tsx`](../../src/components/ui/StatusMessage.tsx) use the ring variant. |
| `hat-coin-front.png` / `-rain.png` / `-stack.png` | `HomePage`, `LaunchCountdownPage`, placeholders.                                      |
| `hero-home.jpg` / `hero-home-wide.jpg`| `HomePage`, `surfaceContent.ts`. Will gradually be replaced by `scenes/home-hero-*.jpg`. |
| `mascot-*.jpg`                        | Reference renders / cards (legacy).                                                  |
| `*-card.jpg` / `sir-card.png`         | `surfaceContent.ts` (HomePage card grid, third-party page hero images).             |
| `bg-*.jpg`                            | Decorative backgrounds (CSS-referenced).                                              |
| `opengraph.jpg` / `opengraph-square.jpg` | `vite.config.ts` — Open Graph wide preview + Twitter/X square `summary` card ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `opengraph-src.png`             | _legacy / reference_                                                    |                                                                                      |
| `style.png`, `style2.png`             | Reference inputs for `scripts/replicate-art/`.                                       |
| `timecurve-doubloon-launch.jpg`       | Legacy share image (kept as reference).                                              |
| `photo_2026-04-14_21-00-48.jpg`       | Original photo input for early generation passes.                                    |

---

## How to add a new asset

1. Generate the image via `scripts/replicate-art/issue45_batch.py`, `issue57_batch.py`, or `issue60_batch.py` (same Replicate stack; see `issue57/prompts.json`, `issue60/prompts.json`).
2. Drop the raw image into [`pending_manual_review/`](./pending_manual_review/) (gitignored).
3. Promote into the matching **purpose** folder above (move with `git mv`, do **not** copy: history must follow).
4. Update **this README** (the table for that folder + the consumer column).
5. Wire the asset into the relevant component (and update the component's `width`/`height`/`alt` so it stays accessible).
6. If the asset is intended to replace a legacy top-level file, leave the top-level file in place until **all** consumers have been moved over (search with `rg "/art/<old-filename>" frontend/`), then remove it in a follow-up commit.

---

## Cross-links

- **Issue #44 — Design pass:** [gitlab.com/PlasticDigits/yieldomega/-/issues/44](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44)
- **Issue #286 — Art README consumer links:** [gitlab.com/PlasticDigits/yieldomega/-/issues/286](https://gitlab.com/PlasticDigits/yieldomega/-/issues/286) · **`INV-FRONTEND-286-ART-README`** · `bash scripts/check-art-readme-consumers.sh`
- **Issue #266 — TimeCurve page retirement:** [gitlab.com/PlasticDigits/yieldomega/-/issues/266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) · [invariants §260](../../../docs/testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
- **Issue #45 — Asset backlog:** [gitlab.com/PlasticDigits/yieldomega/-/issues/45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45)
- **Issue #45 catalog (historic):** [`issue45/README.md`](./issue45/README.md)
- **Generation pipeline:** [`scripts/replicate-art/issue45_batch.py`](../../../scripts/replicate-art/issue45_batch.py), [`scripts/replicate-art/issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py), [`scripts/replicate-art/issue60_batch.py`](../../../scripts/replicate-art/issue60_batch.py), [`scripts/replicate-art/cursor_batch.py`](../../../scripts/replicate-art/cursor_batch.py)
- **Frontend design doc:** [`docs/frontend/design.md`](../../../docs/frontend/design.md)
- **Arena UI:** [`docs/frontend/arena-views.md`](../../../docs/frontend/arena-views.md)
- **Missing assets brief:** [`docs/frontend/missing-art-assets.md`](../../../docs/frontend/missing-art-assets.md)
- **Repo guardrails:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../../.cursor/skills/yieldomega-guardrails/SKILL.md)
- **Phase guide:** [`docs/agent-phases.md` Phase 13](../../../docs/agent-phases.md#phase-13)
