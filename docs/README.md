# Yieldomega documentation

This folder holds **architecture, product, and process** specs for the Yieldomega monorepo. The project is **early**: these docs describe the target system; application code under **`contracts/`**, **`indexer/`**, and **`frontend/`** is still catching up (roles and boundaries: [architecture/repository-layout.md](architecture/repository-layout.md)). **`simulations/`** is optional Python experimentation and is not onchain authority.

**License:** original work in the repository defaults to **AGPL-3.0** — [licensing.md](licensing.md) and [../LICENSE](../LICENSE).

**Roadmap (humans and agents):** numbered phases and copy-paste prompts — [agent-phases.md](agent-phases.md).

## How to read this set

1. Start with [product/vision.md](product/vision.md) for mission and boundaries.
2. Read [architecture/overview.md](architecture/overview.md) for trust model and data flow.
3. Use [glossary.md](glossary.md) for shared vocabulary (CL8Y, TimeCurve, Rabbit Treasury, Doubloons / DOUB, USDm, agents).
4. Use [agent-phases.md](agent-phases.md) when executing the roadmap in order or by task: each phase links one doc section and includes a **copy-paste prompt**.
5. For **Leprechaun NFT onchain metadata** (JSON Schema drafts, semver, changelog), see [schemas/README.md](schemas/README.md) and [schemas/CHANGELOG.md](schemas/CHANGELOG.md).
6. For project-specific Cursor skills, see [../.cursor/skills/README.md](../.cursor/skills/README.md).

## Document map

| Topic | Path |
|--------|------|
| **Agent phases and prompts** | [agent-phases.md](agent-phases.md) |
| Glossary | [glossary.md](glossary.md) |
| Licensing (AGPL-3.0) | [licensing.md](licensing.md) |
| Architecture overview | [architecture/overview.md](architecture/overview.md) |
| Repository layout | [architecture/repository-layout.md](architecture/repository-layout.md) |
| Product vision | [product/vision.md](product/vision.md) |
| TimeCurve primitive | [product/primitives.md](product/primitives.md) |
| Rabbit Treasury (incl. **`Burrow*`** indexer events) | [product/rabbit-treasury.md](product/rabbit-treasury.md) |
| Leprechaun NFTs | [product/leprechaun-nfts.md](product/leprechaun-nfts.md) |
| JSON schemas (metadata drafts, changelog) | [schemas/README.md](schemas/README.md) · [schemas/CHANGELOG.md](schemas/CHANGELOG.md) |
| Fee routing and governance | [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md) ([sinks](onchain/fee-routing-and-governance.md#fee-sinks), [governance](onchain/fee-routing-and-governance.md#governance-actors), [invariants](onchain/fee-routing-and-governance.md#post-update-invariants)) |
| Treasury contracts (separation, roles) | [onchain/treasury-contracts.md](onchain/treasury-contracts.md) |
| Security and threat model | [onchain/security-and-threat-model.md](onchain/security-and-threat-model.md) |
| Foundry and MegaETH | [contracts/foundry-and-megaeth.md](contracts/foundry-and-megaeth.md) |
| Indexer (Rust + Postgres) | [indexer/design.md](indexer/design.md) |
| Frontend (Vite static) | [frontend/design.md](frontend/design.md) |
| Testing strategy (3 stages) | [testing/strategy.md](testing/strategy.md) |
| CI (workflows vs stages) | [testing/ci.md](testing/ci.md) |
| Deployment stages | [operations/deployment-stages.md](operations/deployment-stages.md) |
| Research: MegaETH | [research/megaeth.md](research/megaeth.md) |
| Research: USDm and reserves | [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md) |
| Agents: metadata and skills | [agents/metadata-and-skills.md](agents/metadata-and-skills.md) |
| Cursor skills folder | [../.cursor/skills/README.md](../.cursor/skills/README.md) |

## Principles (short)

- **Authoritative onchain logic:** game rules, fund flows, and canonical state live in **`contracts/`** on MegaEVM.
- **Derived offchain layers:** **`indexer/`** and **`frontend/`** are read model and UX; they are not sources of truth — see [architecture/overview.md](architecture/overview.md).
- **AGPL-3.0:** default for original work; see [licensing.md](licensing.md).
- **Agents:** [agent-phases.md](agent-phases.md) sequences work; onchain metadata and repo conventions support safe human and AI operation — [agents/metadata-and-skills.md](agents/metadata-and-skills.md).

After onboarding here, follow [Phase 1 in agent-phases.md](agent-phases.md#phase-1) in order, or open the phase that matches your task.
