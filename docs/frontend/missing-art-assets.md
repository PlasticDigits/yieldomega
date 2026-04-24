# Missing / follow-up art assets

This list captures **art assets the dapp UI calls for but that are not yet
in-repo**, discovered while integrating the [issue #45 raster
pack](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45) into the live
frontend during the [issue #44 design
pass](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44).

The intended workflow is the same one used for issue #45:

1. Add the missing slot to this file (item, intended path, where it is used).
2. Add a prompt entry to `scripts/replicate-art/issue45/prompts.json`
   (or a new sibling `prompts-<issue>.json`) keeping the **arcade /
   leprechaun-bunny** art direction described in
   [`docs/frontend/design.md`](./design.md) and
   [`docs/product/vision.md`](../product/vision.md).
3. Run `python scripts/replicate-art/generate_assets.py` against the new
   manifest. Drops land in `frontend/public/art/pending_manual_review/` for
   human QA.
4. After QA, **promote** approved files into the purpose-named folders
   under [`frontend/public/art/`](../../frontend/public/art/README.md) and
   delete the entry from this file.

The cross-reference for **where each consumer reads from** lives in
[`frontend/public/art/README.md`](../../frontend/public/art/README.md);
add new consumers there in lock-step with the binaries.

---

## High priority — visible gaps after issue #45 integration

### Cursor pack — missing variants

| Slot                           | Intended path                                | Used by                                                                 | Notes                                                                                                                                                |
|--------------------------------|----------------------------------------------|-------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Default arcade pointer         | `cursors/default-pointer.png` (24×24, hot 4 4)| `body` cursor in `frontend/src/index.css`.                              | Today the body falls back to the OS pointer. Ship a low-noise leprechaun green arrow so the entire dapp picks up an on-brand idle cursor.            |
| Text caret                     | `cursors/text-caret.png` (16×24, hot 8 12)   | All `input[type="text"|"number"|"search"]` and `textarea` in `index.css`.| Issue #45 only generated CTA / danger / slider variants. Custom text caret is optional but listed here for completeness; otherwise leave native.     |
| Disabled pointer               | `cursors/disabled.png` (24×24, hot 4 4)      | `:disabled` rule in `index.css` (`.btn-primary:disabled`).              | Currently uses `not-allowed`. A small "no entry" leprechaun shield would reinforce the no-dark-pattern stance from `docs/frontend/design.md`.        |
| Wallet / external link cursor  | `cursors/external-link.png` (24×24, hot 4 2) | `.btn-secondary--external` and `.ui-badge--external`.                   | Helps users distinguish links that leave the dapp (Telegram, X, GitLab docs) from in-app navigation.                                                 |

### Icons — referenced filename quirks

| Slot                           | Intended path                                | Used by                                                                 | Notes                                                                                                                                                |
|--------------------------------|----------------------------------------------|-------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Pre-launch status icon         | `icons/status-prelaunch.png` (corrected)     | `phaseBadge('saleStartPending')` via `PageBadge`.                       | Issue #45 generated `status-prelanch.png` (typo in `prompts.json`). Either rename the asset and rev `phaseBadge.iconSrc`, or fix the manifest typo so future generations land at the corrected path. Tracked here so the path stabilizes. |
| Loading mascot ring (32/64/128)| `icons/loading-mascot-ring.png`              | `frontend/src/app/RouteFallback` (uses `art/loading-mascot.png` today). | A square / circular variant that crops cleanly to a button or status pill. The current oblong loading-mascot looks great as a hero illustration but blows out in 24px contexts.|
| Token glyphs at 24px           | `icons/token-{cl8y,doub,charm,usdm}-24.png` | Anywhere we want token glyphs **inside** rows (Arena podium, future Treasury charts). | Issue #45 token glyphs are 256² and look noisy when rendered at 24×24. A second "tight" pictogram crop is a follow-up.                                |
| Fee transparency icons         | `icons/fee-burn.png`, `icons/fee-treasury.png`, `icons/fee-referral.png` | Fee transparency panel in `RootLayout` footer.                          | Today the panel uses text-only labels; small pictograms next to each sink would match the issue #45 aesthetic without changing semantics.            |

### Cutouts / scenes — story gaps

| Slot                                | Intended path                                   | Used by                                                                                | Notes                                                                                                                                  |
|-------------------------------------|-------------------------------------------------|----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Wrong-network state illustration    | `scenes/error-wrong-network-portrait.jpg`       | Future wrong-network full-screen overlay (today only a `.indexer-status--warning` pill).| Issue #45 shipped a 16:9 landscape variant. Add a tall portrait for the mobile-first wrong-network full takeover.                      |
| Indexer-down empty card             | `cutouts/indexer-down-mascot.png` (transparent) | TimeCurve activity ticker / Arena battle feed when `fetchIndexerStatus` returns null.   | Currently shows a text-only "Indexer offline" line; a sad-leprechaun cutout above the line softens the failure state.                  |
| ReferralsPage hero scene            | `scenes/referrals-hero.jpg` (1600×900)          | `ReferralsPage` (still on `UnderConstruction`).                                         | Issue #45 shipped `referrals-network.jpg` (network/threads motif). Add a hero variant when `ReferralsPage` graduates from placeholder. |

### Social / OG — refresh

| Slot                                   | Intended path                       | Used by                                                                  | Notes                                                                                                                                                                              |
|----------------------------------------|-------------------------------------|--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Replace legacy `opengraph.jpg`         | `art/opengraph.jpg` (overwrite)     | `frontend/vite.config.ts` (`imagePath`).                                 | Issue #45 produced `social/og-wide.jpg`. Either point `vite.config.ts` at the new file or overwrite the legacy `opengraph.jpg` with the issue #45 art so the path stays stable.   |
| Twitter / X 1:1 share card             | `art/opengraph-square.jpg`          | `vite.config.ts` (would need a new injection block).                     | Issue #45 produced `social/og-square.jpg`. Wire-up is a small `vite.config.ts` change; tracked here so the asset and code land together.                                          |
| Maskable PWA icons (192, 512)          | `art/app-icon-192.png`, `app-icon-512.png` + manifest | `index.html` would need a `<link rel="manifest">` and a `manifest.webmanifest`. | We don't ship a PWA today (issue 44 explicitly calls this out as "if PWA is ever added"). Listed here as the natural next step if the maskable ladder is desired.                  |

---

## Lower priority / nice-to-have

- **Route transition motion sprite** — `motion/route-transition-fade.webp`
  could replace the current still `motion/route-transition.jpg` if/when we
  add an animated transition; respect `prefers-reduced-motion` per
  `docs/frontend/design.md`.
- **Victory podium burst** — a transparent PNG variant of
  `motion/victory-podium.jpg` would let us layer it over the Arena podium
  card without requiring a full background swap.
- **WarBow action icons at 16/20px** — Arena rows currently lean on text
  labels for guard / steal / revenge / flag; a 16px crop of the issue #45
  `icons/warbow-*.png` set would let us inline them next to addresses.

---

## Cross-links

- [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
  — purpose-named asset map and usage table.
- [`frontend/public/art/issue45/README.md`](../../frontend/public/art/issue45/README.md)
  — historic catalog of the approved issue #45 pack.
- [`docs/frontend/design.md`](./design.md) — visual / theming baseline.
- [`docs/frontend/timecurve-views.md`](./timecurve-views.md) —
  TimeCurve Simple / Arena / Protocol contract.
- [`docs/product/vision.md`](../product/vision.md) — joy / participation
  framing the art direction must serve.
- [`scripts/replicate-art/`](../../scripts/replicate-art/) — generation
  pipeline used for issue #45; reuse for any new asset on this list.
