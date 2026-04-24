# `frontend/public/art/` — purpose-named asset directory

This is the **single map of all production raster art** referenced from the Vite static frontend at runtime. Files in this tree are served as `/art/...` (no bundler hashing), so **renaming or moving anything here is a code change** — every consumer is listed below so future agents can update them in lock-step.

The layout was reorganized as part of [`docs/agent-phases.md` Phase 13 — Frontend design](../../../docs/agent-phases.md#phase-13) and [issue #44 — design pass](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44) so each subfolder maps to one **purpose** and one **shape constraint** (cutouts are transparent PNGs, scenes are wide JPGs, icons are 256-square PNGs, etc.).

---

## Top-level conventions

- **Path stability:** treat `/art/<purpose>/<name>.<ext>` as a public ABI for the frontend. If you rename, run `rg "/art/" frontend/` and update every consumer plus this README.
- **AGPL artwork:** new generated drops default to AGPL-3.0 alongside the rest of the repo (see [`LICENSE`](../../../LICENSE) and [`docs/licensing.md`](../../../docs/licensing.md)). Reference inputs that originate from upstream packs keep their upstream license — check `scripts/replicate-art/` history.
- **Generation:** see [`scripts/replicate-art/`](../../../scripts/replicate-art/), [`issue45_batch.py`](../../../scripts/replicate-art/issue45_batch.py) (historic pack), [`issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py) ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)), and [`issue60_batch.py`](../../../scripts/replicate-art/issue60_batch.py) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60) cursor pack). Issue #45 drops used `pending_manual_review/` for QA; later batches promote into `cursors/` with optional `pending_manual_review/issue*-gen/` scratch (gitignored).
- **`/art/` in code:** all current consumers live in `frontend/src/`, `frontend/index.html`, and `frontend/vite.config.ts`. Search with `rg "/art/" frontend/`.

---

## Purpose folders

### `cutouts/`

Transparent-background PNG mascots, stickers, and small character art. Imported via the [`CutoutDecoration`](../../src/components/CutoutDecoration.tsx) helper or directly in pages that decorate a hero panel.

| File                                                | Used by                                                                 | Notes                                                                                  |
|-----------------------------------------------------|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| [`bunny-cutout.png`](./cutouts/bunny-cutout.png)    | [`surfaceContent.ts`](../../src/lib/surfaceContent.ts)                  | Tertiary cutout for the Collection placeholder.                                        |
| [`cutout-bunnyleprechaungirl-full.png`](./cutouts/cutout-bunnyleprechaungirl-full.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Primary heroine cutout for the home / launch countdown art column. |
| [`cutout-bunnyleprechaungirl-head.png`](./cutouts/cutout-bunnyleprechaungirl-head.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Compact head bust used as `peek` decoration on Home and TimeCurve Arena. |
| [`cutout-bunnyleprechaungirl-playful.png`](./cutouts/cutout-bunnyleprechaungirl-playful.png) | _unused (reserved for upcoming Collection)_                          | Style reference for the next Collection iteration.                                     |
| [`greenhat.png`](./cutouts/greenhat.png)            | _legacy_                                                                | Replaced in product UI by `hat-coin-*.png` art at the repo root.                       |
| [`loading-mascot-circle.png`](./cutouts/loading-mascot-circle.png) | [`RootLayout.tsx`](../../src/layout/RootLayout.tsx), [`TimeCurveSections.tsx`](../../src/pages/timecurve/TimeCurveSections.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Header mascot + tertiary cutout in placeholders / TimeCurve. |
| [`mascot-bunnyleprechaungirl-jump-cutout.png`](./cutouts/mascot-bunnyleprechaungirl-jump-cutout.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx), [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Action pose for hero strips. |
| [`mascot-bunnyleprechaungirl-wave-cutout.png`](./cutouts/mascot-bunnyleprechaungirl-wave-cutout.png) | [`HomePage.tsx`](../../src/pages/HomePage.tsx), [`TimeCurveSections.tsx`](../../src/pages/timecurve/TimeCurveSections.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Friendly wave pose; wired into the Referrals/Kumbaya placeholders too. |
| [`mascot-leprechaun-with-bag-cutout.png`](./cutouts/mascot-leprechaun-with-bag-cutout.png) | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx), [`surfaceContent.ts`](../../src/lib/surfaceContent.ts) | Old-money leprechaun (Rabbit Treasury / Arena ambient art). |
| [`token-logo.png`](./cutouts/token-logo.png)        | _legacy duplicate of `../token-logo.png`_                                | Kept for the issue #45 reference pipeline; do not introduce new consumers.             |
| **issue #45 additions**                             |                                                                         | All new cutouts came from [issue #45](./issue45/README.md) and use the `bunny-*` and `*-concept` naming prefix below. |
| [`bunny-wave.png`](./cutouts/bunny-wave.png)        | _staged_                                                                | Mascot wave alt — earmarked for `RootLayout` micro-decoration.                         |
| [`bunny-jump.png`](./cutouts/bunny-jump.png)        | _staged_                                                                | Mascot jump alt — earmarked for HomePage cutout strip.                                 |
| [`bunny-thinking.png`](./cutouts/bunny-thinking.png) | [`UnderConstruction.tsx`](../../src/pages/UnderConstruction.tsx) (placeholders surface — see below) | "Thinking" mascot for in-queue placeholders. |
| [`bunny-podium-win.png`](./cutouts/bunny-podium-win.png) | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) (Arena podium row) | Victory pose for the podium summary card.                                            |
| [`bunny-guarding.png`](./cutouts/bunny-guarding.png) | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) (Arena WarBow strip) | Guard stance — paired with `icons/warbow-guard.png`.                            |
| [`bunny-sneak-steal.png`](./cutouts/bunny-sneak-steal.png) | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) (Arena WarBow strip) | Steal stance — paired with `icons/warbow-steal.png`.                          |
| [`leprechaun-bag-bunny-pair.png`](./cutouts/leprechaun-bag-bunny-pair.png) | [`TimeCurveSimplePage.tsx`](../../src/pages/TimeCurveSimplePage.tsx) (timer panel mascot) | Pair scene used as the calm "fair launch" sidekick on the Simple view. |
| [`trait-silos-concept.png`](./cutouts/trait-silos-concept.png) | _staged_ (Collection page reference)                                | Concept art for the future Collection trait silos.                                     |
| [`footer-micro.png`](./cutouts/footer-micro.png)    | [`RootLayout.tsx`](../../src/layout/RootLayout.tsx) (footer fee panel) | Subtle micro-decoration for the fee transparency block.                              |
| [`indexer-down-mascot.png`](./cutouts/indexer-down-mascot.png) | [`TimerHeroLiveBuys.tsx`](../../src/pages/timecurve/TimerHeroLiveBuys.tsx) | Soft illustration when recent buys cannot load from the indexer ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |

### `scenes/`

Wide JPG scenes used as page hero backplates or feature art. **JPG only** — alpha is provided by the page composition, not by the asset.

| File                                                  | Used by                                              | Notes                                              |
|-------------------------------------------------------|------------------------------------------------------|----------------------------------------------------|
| [`home-hero-desktop.jpg`](./scenes/home-hero-desktop.jpg) | [`HomePage.tsx`](../../src/pages/HomePage.tsx)       | Desktop wide hero; replaces the legacy `../hero-home-wide.jpg` for HD viewports. |
| [`home-hero-mobile.jpg`](./scenes/home-hero-mobile.jpg) | [`HomePage.tsx`](../../src/pages/HomePage.tsx)       | Mobile crop variant served via `<picture>` `media`. |
| [`timecurve-simple.jpg`](./scenes/timecurve-simple.jpg) | [`TimeCurveSimplePage.tsx`](../../src/pages/TimeCurveSimplePage.tsx) | Calm fair-launch backplate for the Simple view. |
| [`timecurve-arena.jpg`](./scenes/timecurve-arena.jpg) | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) (Arena) | PvP / podium tension backplate.                |
| [`timecurve-protocol.jpg`](./scenes/timecurve-protocol.jpg) | [`TimeCurveProtocolPage.tsx`](../../src/pages/TimeCurveProtocolPage.tsx) | Neutral operator backdrop for the Protocol read-only view. |
| [`rabbit-treasury.jpg`](./scenes/rabbit-treasury.jpg) | [`RabbitTreasuryPage.tsx`](../../src/pages/RabbitTreasuryPage.tsx) | Reserve / burrow backplate (replaces the legacy card).               |
| [`collection-gallery.jpg`](./scenes/collection-gallery.jpg) | [`CollectionPage.tsx`](../../src/pages/CollectionPage.tsx) | Gallery shelves backplate.                                                |
| [`referrals-network.jpg`](./scenes/referrals-network.jpg) | _reference / alternate_ | Same motif as `referrals-hero.jpg`; not wired as the hero backplate.        |
| [`referrals-hero.jpg`](./scenes/referrals-hero.jpg) | [`ReferralsPage.tsx`](../../src/pages/ReferralsPage.tsx) `PageHero` `sceneSrc` | 1600×900 hero backplate ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| [`kumbaya-strip.jpg`](./scenes/kumbaya-strip.jpg)    | [`KumbayaPage.tsx`](../../src/pages/KumbayaPage.tsx) | Branded scene strip for the embedded Kumbaya DEX.                          |
| [`sir-strip.jpg`](./scenes/sir-strip.jpg)            | [`SirPage.tsx`](../../src/pages/SirPage.tsx)        | Branded scene strip for the embedded Sir leverage venue.                  |
| [`launch-countdown.jpg`](./scenes/launch-countdown.jpg) | [`LaunchCountdownPage.tsx`](../../src/pages/LaunchCountdownPage.tsx) | Launch countdown key art.                                                 |
| [`error-indexer-down.jpg`](./scenes/error-indexer-down.jpg) | [`StatusMessage.tsx`](../../src/components/ui/StatusMessage.tsx) error variant (issue #44 wiring) | Empty/error illustration for indexer down.                |
| [`error-wrong-network.jpg`](./scenes/error-wrong-network.jpg) | [`RootLayout.tsx`](../../src/layout/RootLayout.tsx) chain pill warning state                  | Empty/error illustration for wrong-network warnings.       |
| [`error-wrong-network-portrait.jpg`](./scenes/error-wrong-network-portrait.jpg) | _reserved_ (future full-screen wrong-network overlay) | Tall portrait crop from the landscape error art ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |

### `icons/`

Square 256px PNG icons. Tone is consistent with the arcade palette (greens, golds, hard outlines). When a vector trace is required (per issue #45 export spec), keep the PNG here as the source-of-truth raster and add the SVG alongside with the same stem.

| Slug                              | Used by                                                                    | Notes                                                                |
|-----------------------------------|----------------------------------------------------------------------------|----------------------------------------------------------------------|
| `token-cl8y.png`                  | [`PageBadge`](../../src/components/ui/PageBadge.tsx) `tone="info"` derivatives, Protocol view | Asset glyph for CL8Y reserve.                                |
| `token-doub.png`                  | [`PageHero`](../../src/components/ui/PageHero.tsx) `coinSrc` (TimeCurve)   | DOUB token logo (replaces `/art/token-logo.png` on TimeCurve heroes). |
| `token-charm.png`                 | [`TimeCurveSimplePage.tsx`](../../src/pages/TimeCurveSimplePage.tsx) preview | CHARM weight glyph.                                              |
| `token-usdm.png`                  | [`TimeCurveSimplePage.tsx`](../../src/pages/TimeCurveSimplePage.tsx) USDM pay-with row | Optional USDM glyph for the pay-with picker.                |
| `status-live.png`                 | [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `live`           | Phase badge (Sale live).                                            |
| `status-ended.png`                | [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `info` (ended)   | Phase badge (Sale ended).                                          |
| `status-prelaunch.png`            | [`phaseBadge`](../../src/pages/timecurve/timeCurveSimplePhase.ts) `saleStartPending` → [`PageBadge`](../../src/components/ui/PageBadge.tsx) tone `soon` | Pre-launch pictogram ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `status-prelanch.png`             | _legacy duplicate_                                                        | Same pixels as `status-prelaunch.png` (issue #45 typo filename kept for catalog history). |
| `status-cooldown.png`             | [`StatusMessage`](../../src/components/ui/StatusMessage.tsx) muted variant | Cooldown clock glyph.                                              |
| `status-net-ok.png`               | [`RootLayout`](../../src/layout/RootLayout.tsx) chain pill `ok`            | Wallet/network ok glyph.                                           |
| `status-net-warn.png`             | [`RootLayout`](../../src/layout/RootLayout.tsx) chain pill `warn`          | Wrong-network glyph.                                              |
| `status-indexer-ok.png`           | [`IndexerStatusBar`](../../src/components/IndexerStatusBar.tsx) ok         | Indexer ok glyph.                                                 |
| `status-indexer-bad.png`          | [`IndexerStatusBar`](../../src/components/IndexerStatusBar.tsx) bad        | Indexer degraded glyph.                                           |
| `warbow-guard.png`                | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) WarBow row        | Guard action.                                                     |
| `warbow-steal.png`                | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) WarBow row        | Steal action.                                                     |
| `warbow-revenge.png`              | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) WarBow row        | Revenge action.                                                   |
| `warbow-flag.png`                 | [`TimeCurvePage.tsx`](../../src/pages/TimeCurvePage.tsx) WarBow row        | Silence flag action.                                             |
| `nav-simple.png`                  | [`TimeCurveSubnav.tsx`](../../src/pages/timecurve/TimeCurveSubnav.tsx)     | Sub-nav pictogram (Simple).                                      |
| `nav-arena.png`                   | [`TimeCurveSubnav.tsx`](../../src/pages/timecurve/TimeCurveSubnav.tsx)     | Sub-nav pictogram (Arena).                                       |
| `nav-protocol.png`                | [`TimeCurveSubnav.tsx`](../../src/pages/timecurve/TimeCurveSubnav.tsx)     | Sub-nav pictogram (Protocol).                                    |
| `chart-accessibility.png`         | _staged_ for charts in Rabbit Treasury                                    | Color-blind safe pair swatch reference.                          |
| `loading-mascot-ring.png`         | [`LaunchGate.tsx`](../../src/app/LaunchGate.tsx), [`TimeCurveBranchPage.tsx`](../../src/pages/TimeCurveBranchPage.tsx), [`StatusMessage.tsx`](../../src/components/ui/StatusMessage.tsx) | Square loading glyph ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `token-cl8y-24.png` / `token-doub-24.png` / `token-charm-24.png` / `token-usdm-24.png` | _staged_ (dense rows, charts) | 24×24 crops of the 256² token icons ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `fee-burn.png` / `fee-treasury.png` / `fee-referral.png` | [`FeeTransparency.tsx`](../../src/components/FeeTransparency.tsx) | Fee sink pictograms beside canonical onchain sink labels ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |
| `warbow-flag-20.png` / `warbow-guard-20.png` / `warbow-revenge-20.png` / `warbow-steal-20.png` | _staged_ (inline WarBow rows) | 20×20 crops of `warbow-*.png` ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)). |

### `cursors/`

Custom mouse pointers that are wired through CSS (`cursor: url('/art/cursors/<name>.png') <hotspot-x> <hotspot-y>, <fallback>;`). Hotspots are documented per asset to avoid sub-pixel drift between cursor frames.

| Slug                | Hotspot       | Used in                                                    | Fallback when blocked / on mobile |
|---------------------|---------------|------------------------------------------------------------|-----------------------------------|
| `primary-cta.png`   | top-left (0, 0) | `.btn-primary--priority` in [`index.css`](../../src/index.css) (HomePage CTA, TimeCurve Buy CHARM) | `pointer` |
| `danger-pvp.png`    | center (16, 16) | WarBow steal/flag controls in [`index.css`](../../src/index.css) (`.timecurve-warbow-card--danger`) | `pointer` (no prank cursors on irreversible actions) |
| `slider-grab.png`   | center (16, 16) | TimeCurve Simple slider thumb (`.timecurve-simple__slider`) — desktop only via `@media (hover: hover)` | `grab` / `grabbing` |
| `default-pointer.png` | (4, 4) | `body` idle cursor in [`index.css`](../../src/index.css) | `auto` |
| `text-caret.png`    | (8, 12) | Text-ish controls: `input[type=text|search|number]`, `textarea` in [`index.css`](../../src/index.css) | `text` |
| `disabled.png`      | (4, 4) | `.btn-primary:disabled` in [`index.css`](../../src/index.css) | `not-allowed` |
| `external-link.png` | (4, 2) | `.ui-badge--external`, `.cursor-external-link` in [`index.css`](../../src/index.css); [`ThirdPartyDexPage.tsx`](../../src/components/ThirdPartyDexPage.tsx); outbound [`TxHash.tsx`](../../src/components/TxHash.tsx) | `pointer` |
| `link-pointer.png`  | ~(6, 4) | Nav, brand, secondary buttons, wallet chrome, accordions, live-buy rows, etc. in [`index.css`](../../src/index.css) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60)) | `pointer` |
| `loading.png`       | (12, 12) | `.loading-state`, `.modal-bc-more__btn:disabled`, `[aria-busy="true"]` deadline read in [`index.css`](../../src/index.css) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60)) | `wait` |
| `cancel.png`        | (12, 12) | `.modal-panel__close` in [`index.css`](../../src/index.css) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60)) | `pointer` |
| `copy.png`          | ~(8, 8) | `.cursor-copy` (e.g. [`ReferralRegisterSection.tsx`](../../src/pages/referrals/ReferralRegisterSection.tsx)) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60)) | `copy` |
| `help.png`          | (12, 12) | `.cursor-help` utility in [`index.css`](../../src/index.css) ([issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60)) | `help` |

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
| `victory-podium.jpg`          | TimeCurve Arena podium "post-end" celebration block.                   |

### `podium_prizes/`

Legacy single-illustration prize art kept for the Arena view. Not in the issue #45 catalog — these are pre-existing assets.

| Slug                 | Used by                                                  |
|----------------------|----------------------------------------------------------|
| `lastbuy.png`        | TimeCurve Arena "Last buy" podium card.                  |
| `WARBOW_LADDER.png`  | TimeCurve Arena WarBow ladder block.                     |
| `DEFENDEDSTREAK.png` | TimeCurve Arena "Defended streak" podium card.           |
| `TIMEBOOSTER.png`    | TimeCurve Arena "Time booster" podium card.              |
| `podium prizes.png`  | Composite legacy art (kept for reference).               |

### `pending_manual_review/`

**Gitignored** drop zone for new generations from `scripts/replicate-art/`. Once reviewed, files are promoted into one of the purpose folders above and added to this README. The only tracked file is the catalog pointer ([`pending_manual_review/ISSUE_45_CHECKLIST.md`](./pending_manual_review/ISSUE_45_CHECKLIST.md)).

### Loose top-level files

Some assets are still at the top level either because they are **shared by many surfaces** (e.g. the loading mascot, the token logo, hat-coin variants) or because they pre-date the purpose-folder reorg and would require coordinated renames across many product files. These are intentionally **kept** to minimize diff churn:

| File                                  | Used by                                                                              |
|---------------------------------------|--------------------------------------------------------------------------------------|
| `app-icon.png`                        | `index.html` `<link rel="icon">`.                                                    |
| `token-logo.png`                      | `RootLayout`, `PageHero` (default coin), `LaunchCountdownPage`.                      |
| `loading-mascot.png`                  | `LaunchGate`, `TimeCurveBranchPage`, `StatusMessage`.                                |
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
- **Issue #45 — Asset backlog:** [gitlab.com/PlasticDigits/yieldomega/-/issues/45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45)
- **Issue #45 catalog (historic):** [`issue45/README.md`](./issue45/README.md)
- **Generation pipeline:** [`scripts/replicate-art/issue45_batch.py`](../../../scripts/replicate-art/issue45_batch.py), [`scripts/replicate-art/issue57_batch.py`](../../../scripts/replicate-art/issue57_batch.py), [`scripts/replicate-art/issue60_batch.py`](../../../scripts/replicate-art/issue60_batch.py)
- **Frontend design doc:** [`docs/frontend/design.md`](../../../docs/frontend/design.md)
- **TimeCurve view contract:** [`docs/frontend/timecurve-views.md`](../../../docs/frontend/timecurve-views.md)
- **Missing assets brief:** [`docs/frontend/missing-art-assets.md`](../../../docs/frontend/missing-art-assets.md)
- **Repo guardrails:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../../.cursor/skills/yieldomega-guardrails/SKILL.md)
- **Phase guide:** [`docs/agent-phases.md` Phase 13](../../../docs/agent-phases.md#phase-13)
