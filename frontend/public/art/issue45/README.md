# GitLab issue #45 — approved art pack (now promoted)

**Status:** Promoted from `pending_manual_review/` after QA, then **migrated into purpose-named folders** as part of issue #44 (commit on branch `feat/issues-44-45-design-pass`).

This file is preserved as a **historic catalog** of the issue #45 raster pack. All approved binaries now live under purpose-named subfolders of [`frontend/public/art/`](../README.md):

| Issue #45 grouping              | New location                                 | Naming change                                  |
|----------------------------------|----------------------------------------------|------------------------------------------------|
| `issue45-scene-*.jpg`            | [`scenes/`](../scenes/)                      | dropped `issue45-scene-` prefix                |
| `issue45-cutout-*.png`           | [`cutouts/`](../cutouts/)                    | dropped `issue45-cutout-` prefix               |
| `issue45-icon-*.png`             | [`icons/`](../icons/)                        | dropped `issue45-icon-` prefix                 |
| `issue45-cursor-*.png`           | [`cursors/`](../cursors/)                    | dropped `issue45-cursor-` prefix               |
| `issue45-social-*.{jpg,png}`     | [`social/`](../social/)                      | dropped `issue45-social-` prefix               |
| `issue45-motion-*.{jpg,png}`     | [`motion/`](../motion/)                      | dropped `issue45-motion-` prefix               |

For example: `issue45/issue45-icon-status-live.png` → [`icons/status-live.png`](../icons/status-live.png).

- **Issue #45 (generation brief):** [gitlab.com/PlasticDigits/yieldomega/-/issues/45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45)
- **Design integration:** [gitlab.com/PlasticDigits/yieldomega/-/issues/44](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44)
- **Asset directory map:** [`frontend/public/art/README.md`](../README.md)

**Generation settings** (recorded for reproducibility): **openai/gpt-image-2**, `quality=high`, `moderation=low`, `number_of_images=1`, reference `style.png` + `token-logo.png` (+ `frontend/public/sir.png` for Sir strip per `generate_assets.DEFAULT_SIR_CARD_REF`). Post-process: longest side capped (**≤1920**, typically **≤1536** for wide scenes; cutouts **≤1024**; icons **≤256**; portrait mobile fits **768×1024** box without upscaling). Transparent catalog jobs used flat **#FF00FF** chroma + local keying per `scripts/replicate-art/generate_assets.py`.

Icons are **PNG raster** drafts—trace to SVG per export spec where required.

## 1) Scenes & wide compositions → `scenes/`

- **Home / hub: wide hero (desktop)** — [`scenes/home-hero-desktop.jpg`](../scenes/home-hero-desktop.jpg)
- **Home / hub: mobile crop variant** — [`scenes/home-hero-mobile.jpg`](../scenes/home-hero-mobile.jpg)
- **TimeCurve Simple: timer + fair launch calm energy** — [`scenes/timecurve-simple.jpg`](../scenes/timecurve-simple.jpg)
- **TimeCurve Arena: PvP / podium tension** — [`scenes/timecurve-arena.jpg`](../scenes/timecurve-arena.jpg)
- **TimeCurve Protocol: operator / audit neutral backdrop** — [`scenes/timecurve-protocol.jpg`](../scenes/timecurve-protocol.jpg)
- **Rabbit Treasury: reserve / burrow / chart-adjacent** — [`scenes/rabbit-treasury.jpg`](../scenes/rabbit-treasury.jpg)
- **Collection: gallery-forward (shelves / vault / grid)** — [`scenes/collection-gallery.jpg`](../scenes/collection-gallery.jpg)
- **Referrals: network / invitation threads motif** — [`scenes/referrals-network.jpg`](../scenes/referrals-network.jpg)
- **Kumbaya: branded scene strip for embedded DEX** — [`scenes/kumbaya-strip.jpg`](../scenes/kumbaya-strip.jpg)
- **Sir: branded scene strip for embedded DEX** — [`scenes/sir-strip.jpg`](../scenes/sir-strip.jpg)
- **Launch countdown key art (OG/social ratio)** — [`scenes/launch-countdown.jpg`](../scenes/launch-countdown.jpg)
- **Error / empty: indexer degraded illustration** — [`scenes/error-indexer-down.jpg`](../scenes/error-indexer-down.jpg)
- **Error / empty: wrong network illustration** — [`scenes/error-wrong-network.jpg`](../scenes/error-wrong-network.jpg)

## 2) Cutouts & characters → `cutouts/`

- **Mascot pose: wave** — [`cutouts/bunny-wave.png`](../cutouts/bunny-wave.png)
- **Mascot pose: jump** — [`cutouts/bunny-jump.png`](../cutouts/bunny-jump.png)
- **Mascot pose: thinking** — [`cutouts/bunny-thinking.png`](../cutouts/bunny-thinking.png)
- **Mascot pose: podium win** — [`cutouts/bunny-podium-win.png`](../cutouts/bunny-podium-win.png)
- **Mascot pose: guarding** — [`cutouts/bunny-guarding.png`](../cutouts/bunny-guarding.png)
- **Mascot pose: sneak steal** — [`cutouts/bunny-sneak-steal.png`](../cutouts/bunny-sneak-steal.png)
- **Leprechaun w/ bag pair** — [`cutouts/leprechaun-bag-bunny-pair.png`](../cutouts/leprechaun-bag-bunny-pair.png)
- **Trait-adjacent silos (style alignment concept)** — [`cutouts/trait-silos-concept.png`](../cutouts/trait-silos-concept.png)
- **Footer / micro-decoration (indexer / fee hint)** — [`cutouts/footer-micro.png`](../cutouts/footer-micro.png)

## 3) Icons & UI micro-graphics → `icons/`

- **Token / asset:** [`icons/token-cl8y.png`](../icons/token-cl8y.png), [`icons/token-doub.png`](../icons/token-doub.png), [`icons/token-charm.png`](../icons/token-charm.png), [`icons/token-usdm.png`](../icons/token-usdm.png).
- **Status:** [`icons/status-live.png`](../icons/status-live.png), [`icons/status-ended.png`](../icons/status-ended.png), [`icons/status-prelanch.png`](../icons/status-prelanch.png) (sic — pre-launch alias documented in `frontend/src/components/ui/PageBadge.tsx`), [`icons/status-cooldown.png`](../icons/status-cooldown.png), [`icons/status-net-ok.png`](../icons/status-net-ok.png), [`icons/status-net-warn.png`](../icons/status-net-warn.png), [`icons/status-indexer-ok.png`](../icons/status-indexer-ok.png), [`icons/status-indexer-bad.png`](../icons/status-indexer-bad.png).
- **WarBow actions:** [`icons/warbow-guard.png`](../icons/warbow-guard.png), [`icons/warbow-steal.png`](../icons/warbow-steal.png), [`icons/warbow-revenge.png`](../icons/warbow-revenge.png), [`icons/warbow-flag.png`](../icons/warbow-flag.png).
- **TimeCurve sub-nav pictograms:** [`icons/nav-simple.png`](../icons/nav-simple.png), [`icons/nav-arena.png`](../icons/nav-arena.png), [`icons/nav-protocol.png`](../icons/nav-protocol.png).
- **Charts accessibility swatch:** [`icons/chart-accessibility.png`](../icons/chart-accessibility.png).

## 4) Mouse cursors & pointer affordances → `cursors/`

- **Primary CTA cursor (hotspot top-left)** — [`cursors/primary-cta.png`](../cursors/primary-cta.png)
- **Danger / PvP hover treatment glyph** — [`cursors/danger-pvp.png`](../cursors/danger-pvp.png)
- **Slider / buy control grab hand** — [`cursors/slider-grab.png`](../cursors/slider-grab.png)

## 5) Social / meta & app chrome → `social/`

- **Open Graph wide image** — [`social/og-wide.jpg`](../social/og-wide.jpg)
- **Twitter / square 1:1 share variant** — [`social/og-square.jpg`](../social/og-square.jpg)
- **Favicon / maskable PWA source** — [`social/favicon-source.png`](../social/favicon-source.png)
- **Wallet modal surrounding chrome** — [`social/wallet-modal-chrome.jpg`](../social/wallet-modal-chrome.jpg)

## 6) Motion & VFX → `motion/`

- **Route transition VFX concept still** — [`motion/route-transition.jpg`](../motion/route-transition.jpg)
- **Countdown tick / flip motif** — [`motion/countdown-tick.png`](../motion/countdown-tick.png)
- **Victory / podium confetti motif** — [`motion/victory-podium.jpg`](../motion/victory-podium.jpg)

## 7) Audio (out of scope this milestone)

UI sounds remain optional and off by default — see issue #45 text.

## Followups (not delivered by issue #45 generation)

Tracked separately so additional batches can be generated through the same `scripts/replicate-art/issue45_batch.py` pipeline:

- **`docs/frontend/missing-art-assets.md`** — what is still missing after this design pass (cursor SVG specs, status icon coverage, etc.). Linked from [`docs/frontend/design.md`](../../../../docs/frontend/design.md) and used as the seed brief for the follow-up generation issue.
