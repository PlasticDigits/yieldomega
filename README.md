# Yieldomega

MegaETH-native, **fully onchain** gamefi monorepo (design phase): **TimeCurve**, **Rabbit Treasury**, and **Rabbit NFTs** aligned with **CL8Y** governance and treasury mission.

## Status

- **Documentation** lives in [`docs/`](docs/README.md). Contracts, indexer, and frontend package scaffolding may land in later phases; see [`docs/agent-phases.md`](docs/agent-phases.md) for **numbered phases** and **copy-paste agent prompts**.

## Packages (planned)

| Path | Stack | Role |
|------|--------|------|
| `contracts/` | Foundry / Solidity | Authoritative game and treasury logic on MegaEVM |
| `indexer/` | Rust + Postgres | Derived read model and APIs |
| `frontend/` | Vite (static) | Wallet UX against RPC + indexer |

## License

Original work in this repository is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE) and [docs/licensing.md](docs/licensing.md).

## Contributing (intent)

AGPL-3.0 applies to new project source unless stated otherwise. Follow [`docs/testing/strategy.md`](docs/testing/strategy.md) before merging risky changes once code exists.

## Secret scanning (Gitleaks)

This repository uses **[Gitleaks](https://github.com/gitleaks/gitleaks)** so keys and tokens are not committed by mistake.

- **CI:** [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml) runs on every push and pull request.
- **Local hooks:** after `git init`, point Git at the repo hooks and install the `gitleaks` binary (e.g. from [releases](https://github.com/gitleaks/gitleaks/releases) or `brew install gitleaks`):

```bash
git config core.hooksPath .githooks
```

Pre-commit runs `gitleaks protect --staged` using [`.gitleaks.toml`](.gitleaks.toml). Allowlist only **verified** false positives there.

## Git ignore

See [`.gitignore`](.gitignore) for Foundry, Rust, Node/Vite, env files, and other generated paths.

---

**Agent phase:** [Phase 19 — Root README and discoverability](docs/agent-phases.md#phase-19)
