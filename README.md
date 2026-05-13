# Yieldomega

MegaETH-oriented monorepo for onchain gamefi: **TimeCurve**, **Rabbit Treasury**, and **Leprechaun NFTs**, with ecosystem expansion governed via **CL8Y** (see [`docs/product/vision.md`](docs/product/vision.md)).

**Status:** **Stage 2 complete in-repo** — contracts, indexer, and frontend implement the core stack with Stage 1 CI and a recorded Stage 2 devnet smoke ([`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md)). **~90% / 100%** (public testnet verification, soak, mainnet, audit) are **operator gates**: [`docs/operations/stage3-mainnet-operator-runbook.md`](docs/operations/stage3-mainnet-operator-runbook.md), [`docs/agent-implementation-phases.md`](docs/agent-implementation-phases.md).

**License:** original work is under [**GNU Affero General Public License v3.0 (AGPL-3.0)**](LICENSE); details in [`docs/licensing.md`](docs/licensing.md).

**Agents and phased work:** numbered phases and copy-paste prompts are in [`docs/agent-phases.md`](docs/agent-phases.md). **Contributors** follow phases 1–19 and [`.cursor/skills/`](.cursor/skills/README.md); **players** (agents participating in games and treasuries) follow [Phase 20](docs/agent-phases.md#phase-20) and the root [`skills/`](skills/README.md) play skills.

## MegaETH mainnet production contracts

**Network:** MegaETH mainnet (**chain id 4326**). **Launched token** for TimeCurve is **Doubloon** (same address as the row below). When wiring indexer or frontend, prefer your deploy **registry JSON** as the source of truth; this table is the public quick reference.

| Contract | Address |
|----------|---------|
| Reserve asset (CL8Y) | `0xfBAa45A537cF07dC768c469FfaC4e88208B0098D` |
| Doubloon | `0xc3654B4f879937B767aFBB64B7C230FF436d2342` |
| PodiumPool | `0x445CD15f508d23F42F79f306dA1Ffd05601Cbd56` |
| Sale CL8Y burn sink | `0x000000000000000000000000000000000000dEaD` |
| DoubLPIncentives | `0x041003433d106898a80aaBa332F94606bE954982` |
| EcosystemTreasury | `0xFB45CFbBA0fdC45a3309E52b8Cab1506B665EfD9` |
| RabbitTreasuryVault | `0x2bf6063F6440e1d0BefB1bC134c547F732e83794` |
| RabbitFeeSink | `0x2bf6063F6440e1d0BefB1bC134c547F732e83794` |
| RabbitTreasury | `0x2D21533f7D27FF22d6Afe50f6e2accd711D209c6` |
| FeeRouter | `0x69269129257225dECBF8340EEfA72d98C1CA3a94` |
| ReferralRegistry | `0xEdEBCed146e85cE4A4B6F6BE11877485766ADAF7` |
| LinearCharmPrice | `0x740b63496D225A4f630D6535c4032257bD15bb77` |
| TimeCurve | `0x1B68bb6789baEBa4bD28F53C10b52DBe1eF2bF71` |
| DoubPresaleVesting | `0xB4128c9f52dC345aD13680973146b23f5383dda0` |
| PresaleCharmBeneficiaryRegistry | `0x6bfe055e767bF777a963157a6AEdE2F1e3eE2107` |
| TimeCurveBuyRouter | `0xB09542acae355C5Ea42345522D403c1742C75B61` |
| LeprechaunNFT | `0x9591bA1347D8f79aF7622d3145F8B6026078C85B` |

UUPS cores are deployed behind **proxies**; use the addresses in this table for RPC and wallet calls. Foundry `run-latest.json` may also list **implementation** deployments for the same logical name—do not treat those as the live protocol surface ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

## Monorepo package directories

Authoritative layout and naming are in [`docs/architecture/repository-layout.md`](docs/architecture/repository-layout.md). The three package roots are:

| Directory | Role |
|-----------|------|
| [`contracts/`](contracts/) | Foundry / Solidity — onchain rules and treasury logic |
| [`indexer/`](indexer/) | Rust + Postgres — derived read model and APIs |
| [`frontend/`](frontend/) | Vite (static) — wallet UX against RPC and indexer |

## Non-goals

What this ecosystem explicitly does **not** optimize for:

- **Speculation-first product** — not passive institutional DeFi or “empty infrastructure”; the thesis is spend-for-joy, identity, status, and participation in a full-cycle onchain consumer economy.
- **Opaque or “risk-free” yield marketing** — no pretending unsustainable returns are safe or legible rules are optional.
- **Offchain authority for outcomes** — no private servers, hidden registries, or indexers-as-source-of-truth that decide winners, balances, or canonical game state.
- **Ecosystem direction via CL8Y** — **governance over how the ecosystem expands** (including fee routing into productive sinks) is anchored in **CL8Y**; this is **not** framed around a separate **TimeCurve-token DAO** as the default governance home.
- **Governance fragmentation** — avoid parallel DAOs that compete with CL8Y for ecosystem direction unless deliberately chosen later with clear rationale.

## Status

- **`docs/`** — architecture, product specs, and process; entry point [`docs/README.md`](docs/README.md). This is the reference for trust boundaries and behavior; implementation in the package directories should follow it.
- **Kumbaya (TimeCurve multi-asset entry):** [`docs/integrations/kumbaya.md`](docs/integrations/kumbaya.md).
- **`contracts/`**, **`indexer/`**, **`frontend/`** — application code and tests; roadmap alignment in [`docs/agent-implementation-phases.md`](docs/agent-implementation-phases.md) and [`docs/agent-phases.md`](docs/agent-phases.md).
- **`simulations/`** — Python notebooks/scripts for treasury math experiments (not authoritative onchain behavior).
- **`bots/`** — optional Python clients for local/public RPC testing ([`bots/README.md`](bots/README.md)); first package: TimeCurve ([`bots/timecurve/README.md`](bots/timecurve/README.md)).
- **Agent skills:** **Contributor** (code): [`.cursor/skills/README.md`](.cursor/skills/README.md), guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md). **Play** (TimeCurve, Rabbit Treasury, Leprechauns): [`skills/README.md`](skills/README.md).
- **Rabbit Treasury (Burrow):** reserve-health metrics map to canonical onchain **`Burrow*`** events in [`docs/product/rabbit-treasury.md`](docs/product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events). Indexers should decode against that spec for stable charts and history.

## License

Same as the note at the top: **AGPL-3.0** — [LICENSE](LICENSE), [docs/licensing.md](docs/licensing.md).

## Contributing

New project source defaults to **AGPL-3.0** unless stated otherwise. Follow [`docs/testing/strategy.md`](docs/testing/strategy.md) before merging risky changes.

## CI

Continuous integration is summarized in [`docs/testing/ci.md`](docs/testing/ci.md): **Stage 1** runs **`forge test`** and **`cargo test`** in [`.github/workflows/unit-tests.yml`](.github/workflows/unit-tests.yml) with **no repository secrets**. Secret scanning uses [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml). Devnet and testnet gates are documented in the testing strategy; they are not fully automated in that minimal workflow.

## Secret scanning (Gitleaks)

This repository uses **[Gitleaks](https://github.com/gitleaks/gitleaks)** so keys and tokens are not committed by mistake.

- **CI:** [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml) runs on every push and pull request.
- **Local hooks:** after `git clone` or `git init`, point Git at the repo hooks and install the `gitleaks` binary (e.g. from [releases](https://github.com/gitleaks/gitleaks/releases) or `brew install gitleaks`):

```bash
git config core.hooksPath .githooks
```

Pre-commit runs `gitleaks protect --staged` using [`.gitleaks.toml`](.gitleaks.toml). Allowlist only **verified** false positives there. If you stage changes under `frontend/`, the hook also runs `npm run typecheck` after `cd frontend && npm ci` (local `tsc` must exist in `frontend/node_modules`).

## Git ignore

See [`.gitignore`](.gitignore) for Foundry, Rust, Node/Vite, env files, and other generated paths.

---

**Agent phase:** [Phase 19 — Root README and discoverability](docs/agent-phases.md#phase-19)
