# Yieldomega documentation

This folder defines **architecture, product, and process** for a MegaETH-native, fully onchain gamefi monorepo. It intentionally contains **no application code**; packages (`contracts/`, `frontend/`, `indexer/`) are described here and implemented in later work.

## How to read this set

1. Start with [product/vision.md](product/vision.md) for mission and boundaries.
2. Read [architecture/overview.md](architecture/overview.md) for trust model and data flow.
3. Use [glossary.md](glossary.md) for shared vocabulary (CL8Y, TimeCurve, Rabbit Treasury, USDm, agents).
4. Follow [agent-phases.md](agent-phases.md) if you are an **AI or human agent** executing the roadmap: each phase maps to one doc section and includes a **copy-paste prompt**.

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
| Rabbit Treasury | [product/rabbit-treasury.md](product/rabbit-treasury.md) |
| Rabbit NFTs | [product/rabbit-nfts.md](product/rabbit-nfts.md) |
| Fee routing and governance | [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md) |
| Security and threat model | [onchain/security-and-threat-model.md](onchain/security-and-threat-model.md) |
| Foundry and MegaETH | [contracts/foundry-and-megaeth.md](contracts/foundry-and-megaeth.md) |
| Indexer (Rust + Postgres) | [indexer/design.md](indexer/design.md) |
| Frontend (Vite static) | [frontend/design.md](frontend/design.md) |
| Testing strategy (3 stages) | [testing/strategy.md](testing/strategy.md) |
| Deployment stages | [operations/deployment-stages.md](operations/deployment-stages.md) |
| Research: MegaETH | [research/megaeth.md](research/megaeth.md) |
| Research: USDm and reserves | [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md) |
| Agents: metadata and skills | [agents/metadata-and-skills.md](agents/metadata-and-skills.md) |

## Principles (short)

- **Fully onchain logic:** game rules, fund flows, and authoritative state live in smart contracts on MegaEVM.
- **Offchain is read model and UX:** indexer and static frontend display and automate against chain state; they are not the source of truth.
- **AGPL-3.0:** default license for original work in this repository; see [licensing.md](licensing.md).
- **Agent-friendly:** onchain metadata and repo conventions support humans and AI agents building and operating the system safely.

**Agent phase:** after onboarding here, use [Phase 1 in agent-phases.md](agent-phases.md#phase-1) onward in order, or jump to the phase that matches your task.
