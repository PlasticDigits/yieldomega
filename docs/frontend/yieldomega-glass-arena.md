# YieldOmega Glass Arena

Developer-facing style guide for the **Yield Omega Glass Arena** visual system — a cyberminimalist PvP command console with restrained glassmorphism, deep navy architecture, emerald/teal live states, and warm gold for DOUB / YΩ rewards. Purple is reserved for opponent accents.

## Routing

| Route | Surface |
|-------|---------|
| `/` | **Play-first** Time Arena (`ArenaSimplePage`) — gameplay above the fold |
| `/arena` | Canonical Time Arena (same console) |
| `/home` | Brand / info hub (`HomePage`) |
| `/arena/protocol` | AUDIT (protocol reads) |

Launch countdown still gates the entire shell when `VITE_LAUNCH_TIMESTAMP` is in the future.

## Tokens

Semantic tokens live in [`frontend/src/styles/yieldomega-glass-arena.css`](../../frontend/src/styles/yieldomega-glass-arena.css) (`--yga-*`) and bridge legacy arena console variables:

| Token | Role |
|-------|------|
| `--yga-navy` | Base shell / void |
| `--yga-emerald` | Live / active / primary actions |
| `--yga-teal-live` | Focus / countdown emphasis |
| `--yga-gold` | DOUB prizes, YΩ, rewards |
| `--yga-purple` | Opponent accents (sparingly) |
| `--yga-glass-*` | Surface fill, border, blur, inset highlight |

Global `--yo-*` aliases in [`frontend/src/index.css`](../../frontend/src/index.css) remain for incremental migration.

## React primitives

| Component | Path | Use |
|-----------|------|-----|
| `ArenaShell` | `components/glass/ArenaShell.tsx` | Page frame; `playFirst` for `/` |
| `GlassConsole` | `components/glass/GlassConsole.tsx` | Primary console surface |
| `GlassDeck` / `GlassRail` | `components/glass/` | Primary vs secondary columns |
| `GlassPanel` / `GlassStatus` | `components/glass/` | Cards and chips |
| `EpochStatus` | `components/arena/EpochStatus.tsx` | Epoch strip |
| `CountdownDisplay` | `components/arena/CountdownDisplay.tsx` | Timer bay wrapper |
| `PlayerIdentity` | `components/arena/PlayerIdentity.tsx` | Blockie + tail hex |
| `PodiumPrize` | `components/arena/PodiumPrize.tsx` | DOUB prize emphasis |
| `ActivePlayerIndicator` | `components/arena/ActivePlayerIndicator.tsx` | Live buy / extension chip |
| `ArenaActionButton` | `components/arena/ArenaActionButton.tsx` | Buy / claim actions |

Secondary marketing and AUDIT routes add `yga-secondary-page` on the page root for shared glass panel treatment.

## Product copy

- User-facing brand: **Yield Omega**
- Gameplay terms: **Epoch**, **Podium**, **DOUB**, **CHARM**, **CRED**, **WarBow** — not “matches”
- DOUB buys route **100%** to podium prizes (not legacy 40/30/30 admin splits)

## Art pipeline

One-time Glass Arena batch: [`scripts/replicate-art/glass_arena_batch.py`](../../scripts/replicate-art/glass_arena_batch.py)

```bash
cd scripts/replicate-art
.venv/bin/python glass_arena_batch.py --dry-run
.venv/bin/python glass_arena_batch.py --max-workers 10
```

Outputs land in `frontend/public/art/pending_manual_review/` with ledger `glass_arena_batch.ledger.json`. Promote reviewed assets into purpose folders and update [`frontend/public/art/README.md`](../../frontend/public/art/README.md).

## Verification

```bash
cd frontend && npm run typecheck && npm run lint && npm test
bash scripts/check-arena-naming.sh
cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/arena.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts
```

See also [`docs/frontend/arena-views.md`](arena-views.md) and [`docs/frontend/design.md`](design.md).
