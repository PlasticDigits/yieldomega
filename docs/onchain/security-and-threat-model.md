# Security and threat model (high level)

## Scope

This document lists **classes of risk** for a MegaETH-native, fully onchain gamefi stack. It is not a substitute for **professional audits** or formal verification.

## Chain and execution

- **Reorgs** — With **1s** block times, reorg depth assumptions should be **explicit** in the indexer ([../indexer/design.md](../indexer/design.md)). UI should warn when showing **recent** blocks.
- **Multidimensional gas** — MegaEVM separates **compute** and **storage** gas ([../research/megaeth.md](../research/megaeth.md)). Contracts that look “cheap” on Ethereum L1 models may be **storage-heavy**; test under MegaETH RPC.
- **Contract size** — Larger limits than Ethereum mainnet may encourage bigger modules; still prefer **modular boundaries** for auditability.

## TimeCurve-specific

- **MEV and ordering** — Last-buyer and timer races are sensitive to **transaction ordering**. Design should assume **same-slot competition**; tie-break rules must be **deterministic** ([../product/primitives.md](../product/primitives.md)).
- **Griefing** — Small buys that extend timers could be used to delay endings; mitigations may include **minimum extension contribution**, **fee burn**, or **decay** (design choices).
- **Parameter changes mid-sale** — Governance updates during an active sale can cause disputes; prefer **timelocks**, **sale-bound locks**, or **two-step** updates.

## Rabbit Treasury-specific

- **Bank run dynamics** — Even with gradual repricing, extreme outflows can stress reserves. **Withdrawal queues**, **epoch limits**, or **transparent fee drains** may be required (TBD at implementation).
- **Oracle manipulation** — If reserve health uses external prices, define **sources**, **staleness checks**, and **fallbacks**. Prefer **pure onchain** accounting where possible.
- **Accounting bugs** — Internal units vs reserves mismatch is catastrophic; require **invariant tests** and **formalized accounting spec** before mainnet.

## NFT-specific

- **Metadata drift** — If URIs are upgradeable, document **who** can change them and **how** holders are protected.
- **Faction gaming** — Sybil deposits across factions; mitigations may include **identity costs** (NFT gates), **rate limits**, or **statistical normalization** (onchain rules only).

## Offchain components

- **Indexer compromise** — Should not **move funds**, but could **mislead users**. Mitigate with **client-side verification** for critical actions and **checksum addresses**.
- **Frontend supply chain** — Static hosting reduces runtime risk; still protect **build pipelines** and **dependency pinning**.

## Audit and bug bounty (intent)

- Engage **independent audits** before mainnet deployments of financial modules.
- Maintain a **disclosure channel** and (when ready) a **bug bounty** scoped to contracts and critical indexer bugs.

## Testing mapping

Align mitigations with [../testing/strategy.md](../testing/strategy.md):

- **Unit** — invariants, edge timers, tie-breaks, repricing math.
- **Devnet integration** — indexer reorg replay, end-to-end buys and deposits.
- **Testnet** — soak tests, MEV-style ordering simulations where feasible.

---

**Agent phase:** [Phase 10 — Security and threat model](../agent-phases.md#phase-10)
