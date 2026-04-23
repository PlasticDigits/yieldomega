# GitLab issue #45 — generated art pack (pending manual review)

Source checklist: [https://gitlab.com/PlasticDigits/yieldomega/-/issues/45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45)

All files below are **drafts** for human QA before promoting into production paths. Icons are **PNG raster** drafts—trace to SVG per export spec where required.

Generation settings: **openai/gpt-image-2**, `quality=high`, `moderation=low`, `number_of_images=1`, reference `style.png` + `token-logo.png` (+ `sir.png` for Sir strip). Post-process: longest side capped (**≤1920**, typically **≤1536** for wide scenes; cutouts **≤1024**; icons **≤256**; portrait mobile fits **768×1024** box without upscaling). API calls use short `Prefer: wait` and client-side polling for completion.

## 1) Scenes & wide compositions

- [ ] **Home / hub: wide hero (desktop)** — [`issue45-scene-home-hero-desktop.jpg`](./issue45-scene-home-hero-desktop.jpg)
- [ ] **Home / hub: mobile crop variant** — [`issue45-scene-home-hero-mobile.jpg`](./issue45-scene-home-hero-mobile.jpg)
- [ ] **TimeCurve Simple: timer + fair launch calm energy** — [`issue45-scene-timecurve-simple.jpg`](./issue45-scene-timecurve-simple.jpg)
- [ ] **TimeCurve Arena: PvP / podium tension** — [`issue45-scene-timecurve-arena.jpg`](./issue45-scene-timecurve-arena.jpg)
- [ ] **TimeCurve Protocol: operator / audit neutral backdrop** — [`issue45-scene-timecurve-protocol.jpg`](./issue45-scene-timecurve-protocol.jpg)
- [ ] **Rabbit Treasury: reserve / burrow / chart-adjacent** — [`issue45-scene-rabbit-treasury.jpg`](./issue45-scene-rabbit-treasury.jpg)
- [ ] **Collection: gallery-forward (shelves / vault / grid)** — [`issue45-scene-collection-gallery.jpg`](./issue45-scene-collection-gallery.jpg)
- [ ] **Referrals: network / invitation threads motif** — [`issue45-scene-referrals-network.jpg`](./issue45-scene-referrals-network.jpg)
- [ ] **Kumbaya: branded scene strip for embedded DEX** — [`issue45-scene-kumbaya-strip.jpg`](./issue45-scene-kumbaya-strip.jpg)
- [ ] **Sir: branded scene strip for embedded DEX** — [`issue45-scene-sir-strip.jpg`](./issue45-scene-sir-strip.jpg)
- [ ] **Launch countdown key art (OG/social ratio)** — [`issue45-scene-launch-countdown.jpg`](./issue45-scene-launch-countdown.jpg)
- [ ] **Error / empty: indexer degraded illustration** — [`issue45-scene-error-indexer-down.jpg`](./issue45-scene-error-indexer-down.jpg)
- [ ] **Error / empty: wrong network illustration** — [`issue45-scene-error-wrong-network.jpg`](./issue45-scene-error-wrong-network.jpg)

## 2) Cutouts & characters

- [ ] **Mascot pose: wave** — [`issue45-cutout-bunny-wave.png`](./issue45-cutout-bunny-wave.png)
- [ ] **Mascot pose: jump** — [`issue45-cutout-bunny-jump.png`](./issue45-cutout-bunny-jump.png)
- [ ] **Mascot pose: thinking** — [`issue45-cutout-bunny-thinking.png`](./issue45-cutout-bunny-thinking.png)
- [ ] **Mascot pose: podium win** — [`issue45-cutout-bunny-podium-win.png`](./issue45-cutout-bunny-podium-win.png)
- [ ] **Mascot pose: guarding** — [`issue45-cutout-bunny-guarding.png`](./issue45-cutout-bunny-guarding.png)
- [ ] **Mascot pose: sneak steal** — [`issue45-cutout-bunny-sneak-steal.png`](./issue45-cutout-bunny-sneak-steal.png)
- [ ] **Leprechaun w/ bag vs adult yet playful bunny leprechaun mascot style pairing reference** — [`issue45-cutout-leprechaun-bag-bunny-pair.png`](./issue45-cutout-leprechaun-bag-bunny-pair.png)
- [ ] **Trait-adjacent silos (style alignment concept)** — [`issue45-cutout-trait-silos-concept.png`](./issue45-cutout-trait-silos-concept.png)
- [ ] **Footer / micro-decoration (indexer / fee hint)** — [`issue45-cutout-footer-micro.png`](./issue45-cutout-footer-micro.png)

## 3) Icons & UI micro-graphics

- [ ] **Token / asset icon draft: CL8Y** — [`issue45-icon-token-cl8y.png`](./issue45-icon-token-cl8y.png)
- [ ] **Token / asset icon draft: DOUB** — [`issue45-icon-token-doub.png`](./issue45-icon-token-doub.png)
- [ ] **Token / asset icon draft: CHARM** — [`issue45-icon-token-charm.png`](./issue45-icon-token-charm.png)
- [ ] **Token / asset icon draft: USDM** — [`issue45-icon-token-usdm.png`](./issue45-icon-token-usdm.png)
- [ ] **Status icon: status-live** — [`issue45-icon-status-live.png`](./issue45-icon-status-live.png)
- [ ] **Status icon: status-ended** — [`issue45-icon-status-ended.png`](./issue45-icon-status-ended.png)
- [ ] **Status icon: status-prelanch** — [`issue45-icon-status-prelanch.png`](./issue45-icon-status-prelanch.png)
- [ ] **Status icon: status-cooldown** — [`issue45-icon-status-cooldown.png`](./issue45-icon-status-cooldown.png)
- [ ] **Status icon: status-net-ok** — [`issue45-icon-status-net-ok.png`](./issue45-icon-status-net-ok.png)
- [ ] **Status icon: status-net-warn** — [`issue45-icon-status-net-warn.png`](./issue45-icon-status-net-warn.png)
- [ ] **Status icon: status-indexer-ok** — [`issue45-icon-status-indexer-ok.png`](./issue45-icon-status-indexer-ok.png)
- [ ] **Status icon: status-indexer-bad** — [`issue45-icon-status-indexer-bad.png`](./issue45-icon-status-indexer-bad.png)
- [ ] **WarBow action icon: warbow-guard** — [`issue45-icon-warbow-guard.png`](./issue45-icon-warbow-guard.png)
- [ ] **WarBow action icon: warbow-steal** — [`issue45-icon-warbow-steal.png`](./issue45-icon-warbow-steal.png)
- [ ] **WarBow action icon: warbow-revenge** — [`issue45-icon-warbow-revenge.png`](./issue45-icon-warbow-revenge.png)
- [ ] **WarBow action icon: warbow-flag** — [`issue45-icon-warbow-flag.png`](./issue45-icon-warbow-flag.png)
- [ ] **TimeCurve subnav pictogram: nav-simple** — [`issue45-icon-nav-simple.png`](./issue45-icon-nav-simple.png)
- [ ] **TimeCurve subnav pictogram: nav-arena** — [`issue45-icon-nav-arena.png`](./issue45-icon-nav-arena.png)
- [ ] **TimeCurve subnav pictogram: nav-protocol** — [`issue45-icon-nav-protocol.png`](./issue45-icon-nav-protocol.png)
- [ ] **Charts: color-blind safe pair swatch concept** — [`issue45-icon-chart-accessibility.png`](./issue45-icon-chart-accessibility.png)

## 4) Mouse cursors & pointer affordances

- [ ] **Primary CTA cursor / pointer draft (hotspot top-left)** — [`issue45-cursor-primary-cta.png`](./issue45-cursor-primary-cta.png)
- [ ] **Danger / PvP hover treatment glyph** — [`issue45-cursor-danger-pvp.png`](./issue45-cursor-danger-pvp.png)
- [ ] **Slider / buy control grab hand draft** — [`issue45-cursor-slider-grab.png`](./issue45-cursor-slider-grab.png)

## 5) Social / meta & app chrome

- [ ] **Open Graph wide image draft** — [`issue45-social-og-wide.jpg`](./issue45-social-og-wide.jpg)
- [ ] **Twitter / square 1:1 share variant** — [`issue45-social-og-square.jpg`](./issue45-social-og-square.jpg)
- [ ] **Favicon / maskable PWA source from mascot geometry** — [`issue45-social-favicon-source.png`](./issue45-social-favicon-source.png)
- [ ] **Wallet modal surrounding chrome (page background)** — [`issue45-social-wallet-modal-chrome.jpg`](./issue45-social-wallet-modal-chrome.jpg)

## 6) Motion & VFX

- [ ] **Route transition VFX concept still** — [`issue45-motion-route-transition.jpg`](./issue45-motion-route-transition.jpg)
- [ ] **Countdown tick / flip motif concept** — [`issue45-motion-countdown-tick.png`](./issue45-motion-countdown-tick.png)
- [ ] **Victory / podium confetti motif** — [`issue45-motion-victory-podium.jpg`](./issue45-motion-victory-podium.jpg)

## 7) Audio

- [ ] **UI sounds (optional scope)** — *No raster deliverable; see issue text (off by default, opt-in).*

## Deliverable notes (from issue)

- Link export specs: format (SVG vs PNG@2x), max file size for IPFS, license—align with maintainers before ship.
