# Yieldomega

MegaETH-oriented monorepo for onchain gamefi: **Time Arena** (Arena v2) — **`TimeArena`**, podium vaults, DOUB prize routing, and **Play CRED** (see [`docs/product/arena-v2.md`](docs/product/arena-v2.md) and [`docs/product/vision.md`](docs/product/vision.md)).

**Status:** **Stage 2 complete in-repo** — contracts, indexer, and frontend implement the core stack with Stage 1 CI and a recorded Stage 2 devnet smoke ([`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md)). **~90% / 100%** (public testnet verification, soak, mainnet, audit) are **operator gates**: [`docs/operations/stage3-mainnet-operator-runbook.md`](docs/operations/stage3-mainnet-operator-runbook.md), [`docs/agent-implementation-phases.md`](docs/agent-implementation-phases.md).

**License:** original work is under [**GNU Affero General Public License v3.0 (AGPL-3.0)**](LICENSE); details in [`docs/licensing.md`](docs/licensing.md).

**Agents and phased work:** numbered phases and copy-paste prompts are in [`docs/agent-phases.md`](docs/agent-phases.md). **Contributors** follow phases 1–19 and [`.cursor/skills/`](.cursor/skills/README.md); **players** (agents participating in games and treasuries) follow [Phase 20](docs/agent-phases.md#phase-20) and the root [`skills/`](skills/README.md) play skills.

## MegaETH mainnet production contracts

**Network:** MegaETH mainnet (**chain id 4326**). Arena v2 (**Time Arena**) proxy addresses live in [`indexer/address-registry.megaeth-mainnet.json`](indexer/address-registry.megaeth-mainnet.json). The table below is the **legacy v1** launchpad snapshot. Deploy docs: [`docs/operations/deployment-guide.md#arena-v2-deploy-gitlab-259`](docs/operations/deployment-guide.md#arena-v2-deploy-gitlab-259).

### Arena v2 (Time Arena, chain 4326)

| Contract | Address |
|----------|---------|
| **TimeArena** (proxy) | `0xba39cea0e5ef6808d8cb926c722877480049e0ee` |
| PodiumVaults (proxy) | `0x7abb3c243a938d1b809b07b8b3f1d60044b46698` |
| ReferralRegistry (proxy) | `0xc729ee049b18669e3c4ebfebcac676da7992a246` |
| PlayCred | `0x998fb7989425ed0c14545ce27a5cc3a9d9349ac1` |
| TimeArenaBuyRouter | `0x3151c335224f5bbfde174b15dba9523a0694d582` |
| Doubloon | `0xc3654B4f879937B767aFBB64B7C230FF436d2342` |

**Verified `TimeArena` implementation** (latest deployed logic contract; the **TimeArena proxy** must receive **`upgradeToAndCall`** from **`owner()`** to point EIP-1967 at this address — after upgrading, confirm the live slot with `cast storage 0xba39cea0e5ef6808d8cb926c722877480049e0ee 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url https://mainnet.megaeth.com/rpc`; last 20 bytes should match this address): [`0xaA298FCf0E3d67c7B4b68ed418C2B90F97CE9077`](https://megascan.com/address/0xaa298fcf0e3d67c7b4b68ed418c2b90f97ce9077#code). **Prior upgrade — per-epoch Time Booster / Defended Streak score reset** (2026-07-03): implementation [`0x8Eb1c7619ffE4ca8471177D0A8601E6b341FD557`](https://megascan.com/address/0x8eb1c7619ffe4ca8471177d0a8601e6b341fd557#code), block **20287165**, tx [`0xbdb5e78dcbb777f149b8e526953faa414eeb0a239e2fcb3bd57aa10c18a6435d`](https://megascan.com/tx/0xbdb5e78dcbb777f149b8e526953faa414eeb0a239e2fcb3bd57aa10c18a6435d) — **`migrateEpochPodiumScores()`** reinitializer; [deployment guide § TimeArena UUPS upgrade](docs/operations/deployment-guide.md#timearena-uups-upgrade).

### Legacy v1 (TimeCurve launchpad)

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
| TimeCurveBuyRouter | `0x9F7B0Fd3ed1cA730E37882aC3644b9991cdCaed9` |
| Collectible NFT (v1, retired [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)) | `0x9591bA1347D8f79aF7622d3145F8B6026078C85B` |

UUPS cores are deployed behind **proxies**; use the addresses in this table for RPC and wallet calls. Foundry `run-latest.json` may also list **implementation** deployments for the same logical name—do not treat those as the live protocol surface ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

**Verified `TimeCurve` implementation** (latest deployed logic contract; the **TimeCurve proxy** must receive **`upgradeToAndCall`** from **`owner()`** to point EIP-1967 at this address — after upgrading, confirm the live slot with `cast storage 0x1B68bb6789baEBa4bD28F53C10b52DBe1eF2bF71 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url https://mainnet.megaeth.com/rpc`; last 20 bytes should match this address): [`0xd5c984E59C1482d63629532e8b1ebffaBf47029F`](https://mega.etherscan.io/address/0xd5c984E59C1482d63629532e8b1ebffaBf47029F#code). **WarBow → FeeRouter upgrade** (2026-05-19): block **16409300**, tx [`0x53ac33e67ac5b26e7c0daf27abf12a70175b6d3ede4985b7deae06e76b43128e`](https://mega.etherscan.io/tx/0x53ac33e67ac5b26e7c0daf27abf12a70175b6d3ede4985b7deae06e76b43128e) — [runbook](docs/operations/final-signoff-and-value-movement.md#timecurve-warbow-feerouter-upgrade-2026-05-19).

**Verified `DoubPresaleVesting` implementation** (logic behind the proxy above; upgrades replace this address): [`0xFE4C7A3BadA9790dE52146D8fB05012c735B7247`](https://mega.etherscan.io/address/0xFE4C7A3BadA9790dE52146D8fB05012c735B7247#code).

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
- **`bots/`** — optional Python clients for local/public RPC testing ([`bots/README.md`](bots/README.md)); Arena v2 package: [`bots/timearena/README.md`](bots/timearena/README.md) ([#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245)).
- **Agent skills:** **Contributor** (code): [`.cursor/skills/README.md`](.cursor/skills/README.md), guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md). **Play** (Time Arena): [`skills/README.md`](skills/README.md).
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

Commit-msg strips **body** lines that contain an email address, the keyword `author` (word boundary, case-insensitive), or a `Co-authored-by:` trailer; the **subject** line is rejected instead of rewritten. Skip in an emergency: `YIELDOMEGA_SKIP_COMMIT_MSG_HOOK=1`. Tests: `bash scripts/test-commit-message-sanitize.sh`.

## Git ignore

See [`.gitignore`](.gitignore) for Foundry, Rust, Node/Vite, env files, and other generated paths.

---

**Agent phase:** [Phase 19 — Root README and discoverability](docs/agent-phases.md#phase-19)
