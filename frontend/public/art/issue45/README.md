# GitLab issue #45 — approved art pack

**Status:** Promoted from `pending_manual_review/` after QA. Use these paths for the issue #44 design pass and production wiring.

- **Issue #45 (generation brief):** [gitlab.com/PlasticDigits/yieldomega/-/issues/45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45)
- **Design integration:** [gitlab.com/PlasticDigits/yieldomega/-/issues/44](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44)

Icons are **PNG raster** drafts—trace to SVG per export spec where required.

**Generation settings:** **openai/gpt-image-2**, `quality=high`, `moderation=low`, `number_of_images=1`, reference `../style.png` + `../token-logo.png` (+ `../sir-card.png` for Sir strip). Post-process: longest side capped (**≤1920**, typically **≤1536** for wide scenes; cutouts **≤1024**; icons **≤256**; portrait mobile fits **768×1024** box without upscaling). Transparent catalog jobs used flat **#FF00FF** chroma + local keying per `scripts/replicate-art/generate_assets.py`.

## 1) Scenes & wide compositions

- [x] **Home / hub: wide hero (desktop)** — [`issue45-scene-home-hero-desktop.jpg`](./issue45-scene-home-hero-desktop.jpg)
- [x] **Home / hub: mobile crop variant** — [`issue45-scene-home-hero-mobile.jpg`](./issue45-scene-home-hero-mobile.jpg)
- [x] **TimeCurve Simple: timer + fair launch calm energy** — [`issue45-scene-timecurve-simple.jpg`](./issue45-scene-timecurve-simple.jpg)
- [x] **TimeCurve Arena: PvP / podium tension** — [`issue45-scene-timecurve-arena.jpg`](./issue45-scene-timecurve-arena.jpg)
- [x] **TimeCurve Protocol: operator / audit neutral backdrop** — [`issue45-scene-timecurve-protocol.jpg`](./issue45-scene-timecurve-protocol.jpg)
- [x] **Rabbit Treasury: reserve / burrow / chart-adjacent** — [`issue45-scene-rabbit-treasury.jpg`](./issue45-scene-rabbit-treasury.jpg)
- [x] **Collection: gallery-forward (shelves / vault / grid)** — [`issue45-scene-collection-gallery.jpg`](./issue45-scene-collection-gallery.jpg)
- [x] **Referrals: network / invitation threads motif** — [`issue45-scene-referrals-network.jpg`](./issue45-scene-referrals-network.jpg)
- [x] **Kumbaya: branded scene strip for embedded DEX** — [`issue45-scene-kumbaya-strip.jpg`](./issue45-scene-kumbaya-strip.jpg)
- [x] **Sir: branded scene strip for embedded DEX** — [`issue45-scene-sir-strip.jpg`](./issue45-scene-sir-strip.jpg)
- [x] **Launch countdown key art (OG/social ratio)** — [`issue45-scene-launch-countdown.jpg`](./issue45-scene-launch-countdown.jpg)
- [x] **Error / empty: indexer degraded illustration** — [`issue45-scene-error-indexer-down.jpg`](./issue45-scene-error-indexer-down.jpg)
- [x] **Error / empty: wrong network illustration** — [`issue45-scene-error-wrong-network.jpg`](./issue45-scene-error-wrong-network.jpg)

## 2) Cutouts & characters

- [x] **Mascot pose: wave** — [`issue45-cutout-bunny-wave.png`](./issue45-cutout-bunny-wave.png)
- [x] **Mascot pose: jump** — [`issue45-cutout-bunny-jump.png`](./issue45-cutout-bunny-jump.png)
- [x] **Mascot pose: thinking** — [`issue45-cutout-bunny-thinking.png`](./issue45-cutout-bunny-thinking.png)
- [x] **Mascot pose: podium win** — [`issue45-cutout-bunny-podium-win.png`](./issue45-cutout-bunny-podium-win.png)
- [x] **Mascot pose: guarding** — [`issue45-cutout-bunny-guarding.png`](./issue45-cutout-bunny-guarding.png)
- [x] **Mascot pose: sneak steal** — [`issue45-cutout-bunny-sneak-steal.png`](./issue45-cutout-bunny-sneak-steal.png)
- [x] **Leprechaun w/ bag vs adult yet playful bunny leprechaun mascot style pairing reference** — [`issue45-cutout-leprechaun-bag-bunny-pair.png`](./issue45-cutout-leprechaun-bag-bunny-pair.png)
- [x] **Trait-adjacent silos (style alignment concept)** — [`issue45-cutout-trait-silos-concept.png`](./issue45-cutout-trait-silos-concept.png)
- [x] **Footer / micro-decoration (indexer / fee hint)** — [`issue45-cutout-footer-micro.png`](./issue45-cutout-footer-micro.png)

## 3) Icons & UI micro-graphics

- [x] **Token / asset icon draft: CL8Y** — [`issue45-icon-token-cl8y.png`](./issue45-icon-token-cl8y.png)
- [x] **Token / asset icon draft: DOUB** — [`issue45-icon-token-doub.png`](./issue45-icon-token-doub.png)
- [x] **Token / asset icon draft: CHARM** — [`issue45-icon-token-charm.png`](./issue45-icon-token-charm.png)
- [x] **Token / asset icon draft: USDM** — [`issue45-icon-token-usdm.png`](./issue45-icon-token-usdm.png)
- [x] **Status icon: status-live** — [`issue45-icon-status-live.png`](./issue45-icon-status-live.png)
- [x] **Status icon: status-ended** — [`issue45-icon-status-ended.png`](./issue45-icon-status-ended.png)
- [x] **Status icon: status-prelanch** — [`issue45-icon-status-prelanch.png`](./issue45-icon-status-prelanch.png)
- [x] **Status icon: status-cooldown** — [`issue45-icon-status-cooldown.png`](./issue45-icon-status-cooldown.png)
- [x] **Status icon: status-net-ok** — [`issue45-icon-status-net-ok.png`](./issue45-icon-status-net-ok.png)
- [x] **Status icon: status-net-warn** — [`issue45-icon-status-net-warn.png`](./issue45-icon-status-net-warn.png)
- [x] **Status icon: status-indexer-ok** — [`issue45-icon-status-indexer-ok.png`](./issue45-icon-status-indexer-ok.png)
- [x] **Status icon: status-indexer-bad** — [`issue45-icon-status-indexer-bad.png`](./issue45-icon-status-indexer-bad.png)
- [x] **WarBow action icon: warbow-guard** — [`issue45-icon-warbow-guard.png`](./issue45-icon-warbow-guard.png)
- [x] **WarBow action icon: warbow-steal** — [`issue45-icon-warbow-steal.png`](./issue45-icon-warbow-steal.png)
- [x] **WarBow action icon: warbow-revenge** — [`issue45-icon-warbow-revenge.png`](./issue45-icon-warbow-revenge.png)
- [x] **WarBow action icon: warbow-flag** — [`issue45-icon-warbow-flag.png`](./issue45-icon-warbow-flag.png)
- [x] **TimeCurve subnav pictogram: nav-simple** — [`issue45-icon-nav-simple.png`](./issue45-icon-nav-simple.png)
- [x] **TimeCurve subnav pictogram: nav-arena** — [`issue45-icon-nav-arena.png`](./issue45-icon-nav-arena.png)
- [x] **TimeCurve subnav pictogram: nav-protocol** — [`issue45-icon-nav-protocol.png`](./issue45-icon-nav-protocol.png)
- [x] **Charts: color-blind safe pair swatch concept** — [`issue45-icon-chart-accessibility.png`](./issue45-icon-chart-accessibility.png)

## 4) Mouse cursors & pointer affordances

- [x] **Primary CTA cursor / pointer draft (hotspot top-left)** — [`issue45-cursor-primary-cta.png`](./issue45-cursor-primary-cta.png)
- [x] **Danger / PvP hover treatment glyph** — [`issue45-cursor-danger-pvp.png`](./issue45-cursor-danger-pvp.png)
- [x] **Slider / buy control grab hand draft** — [`issue45-cursor-slider-grab.png`](./issue45-cursor-slider-grab.png)

## 5) Social / meta & app chrome

- [x] **Open Graph wide image draft** — [`issue45-social-og-wide.jpg`](./issue45-social-og-wide.jpg)
- [x] **Twitter / square 1:1 share variant** — [`issue45-social-og-square.jpg`](./issue45-social-og-square.jpg)
- [x] **Favicon / maskable PWA source from mascot geometry** — [`issue45-social-favicon-source.png`](./issue45-social-favicon-source.png)
- [x] **Wallet modal surrounding chrome (page background)** — [`issue45-social-wallet-modal-chrome.jpg`](./issue45-social-wallet-modal-chrome.jpg)

## 6) Motion & VFX

- [x] **Route transition VFX concept still** — [`issue45-motion-route-transition.jpg`](./issue45-motion-route-transition.jpg)
- [x] **Countdown tick / flip motif concept** — [`issue45-motion-countdown-tick.png`](./issue45-motion-countdown-tick.png)
- [x] **Victory / podium confetti motif** — [`issue45-motion-victory-podium.jpg`](./issue45-motion-victory-podium.jpg)

## 7) Audio

- [ ] **UI sounds (optional scope)** — *No raster deliverable; see issue #45 text (off by default, opt-in).*

## Deliverable notes (from issue)

- Link export specs: format (SVG vs PNG@2x), max file size for IPFS, license—align with maintainers before ship.
