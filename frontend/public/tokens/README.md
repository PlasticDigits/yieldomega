# `frontend/public/tokens/` — canonical ticker art

Static files here are served by Vite as **`/tokens/<filename>`** (no bundler hash).

- **Code:** import URL constants from [`src/lib/tokenMedia.ts`](../../src/lib/tokenMedia.ts); do not duplicate string literals across pages.
- **Catalog:** consumer map and migration notes for legacy `art/icons/token-*.png` rasters live under **[`public/art/README.md`](../art/README.md)** → section **Canonical token marks**.

| File | Role |
|------|------|
| `cl8y.svg` | CL8Y |
| `doub.png` | DOUB |
| `eth.svg` | ETH (pay-with glyph) |
| `usdm.svg` | USDM (pay-with glyph) |
| `mega.svg` | MegaETH ecosystem mark (header network pill on MegaETH chains) |

CHARM is rendered by the inline `CharmTokenIcon` SVG component rather than a static token image.
Play CRED is rendered by the inline `CredTokenIcon` SVG component rather than a static token image.
