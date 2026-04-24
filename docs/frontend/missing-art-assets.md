# Missing / follow-up art assets

This file listed gaps found during the [issue #44 design
pass](https://gitlab.com/PlasticDigits/yieldomega/-/issues/44) after the [issue
#45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45) raster pack landed.

**High-priority slots from that pass are implemented on
[issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57)** via
`scripts/replicate-art/issue57_batch.py` and `scripts/replicate-art/issue57/prompts.json`
(derivatives, Open Graph copies, and Replicate jobs with heuristic fallbacks when
no API token is present). See [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
for the live consumer map.

When you add a **new** gap:

1. Describe it here (path, consumer, notes).
2. Extend `issue57/prompts.json` (or a new issue-scoped manifest) and the batch driver.
3. Run the batch script, then update the art README and remove the row from this file.

---

## Lower priority / nice-to-have

- **Cursor polish** — [issue #60](https://gitlab.com/PlasticDigits/yieldomega/-/issues/60) ships the expanded pack + wiring; optional Replicate refresh via `scripts/replicate-art/issue60_batch.py` when `REPLICATE_API_TOKEN` is set.
- **Route transition motion sprite** — `motion/route-transition-fade.webp`
  could replace the current still `motion/route-transition.jpg` if/when we
  add an animated transition; respect `prefers-reduced-motion` per
  `docs/frontend/design.md`.
- **Victory podium burst** — a transparent PNG variant of
  `motion/victory-podium.jpg` would let us layer it over the Arena podium
  card without requiring a full background swap.
- **WarBow action icons wired inline** — `icons/warbow-*-20.png` now exist as
  tight crops; Arena rows could opt into them beside addresses instead of
  text-only labels.
- **Maskable PWA icons** (`art/app-icon-192.png`, `app-icon-512.png`) +
  `manifest.webmanifest` — only if we decide to ship installable PWA scope
  (issue #44 called this optional).

---

## Cross-links

- [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
- [`scripts/replicate-art/issue57_batch.py`](../../scripts/replicate-art/issue57_batch.py)
- [`docs/frontend/design.md`](./design.md)
