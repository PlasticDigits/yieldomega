# Repository layout

## Target monorepo structure (documentation only)

The following layout is **prescriptive for future implementation**. Paths may be adjusted if tooling demands, but the **separation of concerns** should remain.

```text
yieldomega/
  LICENSE                 # AGPL-3.0 (full text)
  README.md               # Points to docs/; high-level mission
  docs/                   # Architecture and product (this tree)
  simulations/            # Python: bounded repricing + comeback scenario sims (DOUB / Burrow)
  contracts/              # Foundry: TimeCurve, Rabbit Treasury, NFTs, routers
  indexer/                # Rust workspace or crate: sync, decode, API, migrations
  frontend/               # Vite + TypeScript: static deployable site
```

Optional additions (to be decided at implementation time):

- `scripts/` — deployment, verification, codegen
- `.github/workflows/` — CI (unit, integration, lint)
- `docker/` — local dev compose (Postgres + indexer + optional chain)

## Package responsibilities

### `contracts/`

- Solidity sources, tests, deployment config for MegaEVM.
- No business logic that belongs in the indexer or frontend only.

### `indexer/`

- Block ingestion, event decoding, Postgres schema, HTTP or gRPC API (TBD).
- Migrations and versioned schema.

### `frontend/`

- Static build output (for example `dist/`) suitable for IPFS or CDN hosting.
- Wallet connect, reads, transaction construction calling **known contract addresses**.

## Naming conventions (design)

- Use **lowercase hyphenated** or **Rust snake_case** consistently per language norms.
- **Environment-specific** addresses and RPC URLs live in config templates, not hardcoded in shared libraries (exact mechanism TBD).

## Version control exclusions (conceptual)

Build artifacts (`out/`, `target/`, `dist/`, `node_modules/`, local `.env` with secrets) should be gitignored when implementation lands. Documentation and example env files (`.env.example`) should list required variables without secrets.

## Workspace tooling (non-prescriptive)

Reasonable combinations:

- **Rust:** Cargo workspace in `indexer/`.
- **JavaScript:** pnpm or npm workspaces if multiple JS packages appear later.
- **Monorepo orchestration:** Make, just, or task runners to run `forge test`, `cargo test`, and `pnpm test` from the root.

Document the final choice in the root README when code exists.

---

**Agent phase:** [Phase 4 — Repository layout and package boundaries](agent-phases.md#phase-4)
