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

### TimeCurve — top design threats and mitigations

| # | Threat (design level) | Mitigation (design level) |
|---|------------------------|---------------------------|
| 1 | **MEV / builder ordering on timer and buys** — In the same block, transaction order decides who is “last buyer,” who extends the timer, and podium ties; searchers can **sandwich** or **reorder** around user txs. | Specify **deterministic tie-breaks** (e.g. tx index, log index, address) for all podiums; treat **proposer ordering as part of the game** in docs/UX; keep **minimum buy growth** and **per-tx cap** fully onchain so no offchain ambiguity; optional **economic** mitigations (higher fees to protocol, decay) if griefing dominates. |
| 2 | **Timer griefing / extension spam** — Small qualifying buys repeatedly **extend** the sale or dilute meaningful competition. | **Minimum extension contribution**, **maximum remaining timer cap**, **decay** of extension value over time, and/or **fee burn** on extensions so spam pays the system. |
| 3 | **Governance or config change mid-sale** — Parameter updates during an active round create **disputes** (effective price curve, caps, fee splits). | **Timelocks**, **sale-scoped parameter snapshots** at sale start, or **two-step** updates with **explicit sale-bound locks**; emit **old/new** values on any change ([fee-routing invariants](fee-routing-and-governance.md#post-update-invariants)). |
| 4 | **Rounding / time-base errors** — Minimum buy growth, allocation, and timer math can **drift** from documented intent (per-second vs per-block, rounding direction). | **Single canonical time base** (e.g. block timestamp rules) in spec; **documented rounding** (floor/ceil) in NatSpec; **WAD** or fixed-point discipline; avoid silent offchain computation as source of truth. |
| 5 | **Indexer reorg confusion (leaderboards, “last buyer,” timer UI)** — Fast blocks + reorgs can make the indexer **temporarily show** a winner or order that **differs** from the final chain; agents/UI may act on **stale** head. | **Indexer is not authority** ([../indexer/design.md](../indexer/design.md)); **confirmations / finalized depth** policy for “official” UI badges; **watermarks** (block height / cursor) on API; **client-side verification** before irreversible actions; label **recent** state clearly. |

### TimeCurve — test plan (threat → validation stage)

Maps each numbered threat above to **unit** (Stage 1), **integration** (Stage 2 devnet + indexer), and **testnet** (Stage 3). See [../testing/strategy.md](../testing/strategy.md).

| Threat # | Unit (Stage 1) | Integration (Stage 2) | Testnet (Stage 3) |
|----------|------------------|-------------------------|---------------------|
| 1 | Fuzz/property tests for **tie-break ordering**; pure **timer + buy** state machine; fork tests for **same-block** tx order. | Devnet **multi-tx same block** (or tight sequence) with indexer decoding **tx index**; API returns ordering fields for audit. | **Soak** with bursty traffic; manual or scripted **ordering** checks against explorer; optional **MEV-style** bundle ordering **where tooling allows** (document gaps). |
| 2 | Unit tests for **extension floors/caps/decay**; edge cases at **timer ceiling**. | E2E **many small buys** vs few large buys; indexer **timer** projection matches contract events. | Long-run **spam** scenarios; monitor **gas** and UX; confirm economics still match design. |
| 3 | Unit tests that **sale snapshot** freezes params; governance change tests **blocked** or **delayed** per design. | Integration: start sale → attempt param change → assert **onchain + indexer** reflect policy. | Governance ops on **staging** with human checklist; no **surprise** mid-sale behavior. |
| 4 | **Invariant** tests on growth formula, caps, allocation; fuzz **rounding**. | Compare **contract-emitted** amounts to indexer-stored rows for sampled txs. | Fuzz-like **random buy sequences** on public RPC; spot-check vs simulation. |
| 5 | Indexer **unit tests**: rollback/reapply **reorg** fixture; decoder idempotency. | **Reorg simulation** in CI or manual: alternate head → rollback → verify **leaderboard** rows and APIs; UI shows **pending vs confirmed** if implemented. | Testnet **natural reorgs** (if any); monitor **head lag** and incorrect “winner” incidents = **0** for confirmed tier. |

## Rabbit Treasury-specific

- **Bank run dynamics** — Even with gradual repricing, extreme outflows can stress reserves. **Withdrawal queues**, **epoch limits**, or **transparent fee drains** may be required (TBD at implementation).
- **Oracle manipulation** — If reserve health uses external prices, define **sources**, **staleness checks**, and **fallbacks**. Prefer **pure onchain** accounting where possible.
- **Accounting bugs** — Internal units vs reserves mismatch is catastrophic; require **invariant tests** and **formalized accounting spec** before mainnet.

### Rabbit Treasury (Burrow) — top design threats and mitigations

| # | Threat (design level) | Mitigation (design level) |
|---|------------------------|---------------------------|
| 1 | **Bank run / liquidity stress** — Concurrent **withdrawals** can force sharp **repricing** or insolvency perception even if math is sound. | **Withdrawal queues**, **per-epoch caps**, **transparent repricing** rules; clear UX that DOUB is **game accounting**, not a bank deposit ([../product/rabbit-treasury.md](../product/rabbit-treasury.md)); optional **fee retention** to slow drains. |
| 2 | **Oracle / external price manipulation** — If health or repricing uses **offchain** feeds, attackers can move marks. | **Prefer onchain reserves and emitted snapshots**; any oracle: **multiple sources**, **staleness bounds**, **TWAP or bounded updates**, **circuit breakers**; document fallbacks in [../research/stablecoin-and-reserves.md](../research/stablecoin-and-reserves.md). |
| 3 | **Accounting / unit mismatch** — **DOUB**, reserves, and **internal price** diverge due to a bug (classic catastrophic loss). | **Formal accounting spec**; **BurrowMath**-style single module; **invariant tests** (reserves, supply, backing); epoch-close **BurrowHealthEpochFinalized** as chart anchor ([rabbit-treasury events](../product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events)). |
| 4 | **Indexer reorg confusion (epochs, repricing, faction stats)** — Reorgs can **reorder** deposits/withdrawals across **epoch boundaries** or duplicate/miss events briefly; dashboards may show **wrong epoch** or **stale** reserve ratio. | **Canonical `epochId` + `finalizedAt`** in events; indexer **rollback to common ancestor**; APIs expose **confirmations**; **do not** treat indexed balance as sole authority for **redemptions**—users verify via RPC when needed; align with [../indexer/design.md](../indexer/design.md). |
| 5 | **Faction / sybil pressure on deposits** — Users split across identities to **game** leaderboards or rewards tied to **faction** flows. | **Onchain rules** only; **rate limits** or **costly** gates (e.g. NFT); **normalization** or caps per faction if policy requires; document tradeoffs in product specs. |

### Rabbit Treasury — test plan (threat → validation stage)

| Threat # | Unit (Stage 1) | Integration (Stage 2) | Testnet (Stage 3) |
|----------|----------------|-------------------------|---------------------|
| 1 | Unit tests for **queue/epoch limits** and **repricing** under extreme **withdraw** sequences. | Devnet: **burst withdrawals** + indexer **epoch** rows; UI/API match **finalized** events. | Soak with **uneven** deposit/withdraw; monitor **reserve ratio** charts vs onchain **BurrowHealthEpochFinalized**. |
| 2 | Mock oracle **staleness**, **deviation**, **fallback** branches in contract math (if present). | Integration with **oracle mock** on devnet; indexer stores **same** values as emitted. | Testnet: if live oracle, **spot-check** against sources; document **failure modes**. |
| 3 | **Invariant** and fuzz tests on **deposit/withdraw/fee**; **BurrowMath** vs reference simulator ([../simulations/README.md](../simulations/README.md)). | Compare **every** `Burrow*` emission to DB rows; reconciliation job for **totals**. | Periodic **reconciliation** on testnet; **supply** vs **backing** sanity alerts. |
| 4 | Indexer **reorg** fixtures for **epoch** ordering; property: **epochId** monotonicity after heal. | **Reorg** test: events at epoch boundary **rollback** and **reapply**; faction aggregates **match** chain replay. | Testnet: monitor for **duplicate** epoch closes or **orphan** rows; **head lag** SLO. |
| 5 | Unit tests for **faction** accounting rules and **caps**. | Multi-wallet flows; indexer **faction** leaderboards match **onchain** sums. | Soak with **many** small accounts; watch for **unexpected** faction skew. |

## NFT-specific

- **Metadata drift** — If URIs are upgradeable, document **who** can change them and **how** holders are protected.
- **Faction gaming** — Sybil deposits across factions; mitigations may include **identity costs** (NFT gates), **rate limits**, or **statistical normalization** (onchain rules only).

## Offchain components

- **Indexer compromise** — Should not **move funds**, but could **mislead users**. Mitigate with **client-side verification** for critical actions and **checksum addresses**.
- **Frontend supply chain** — Static hosting reduces runtime risk; still protect **build pipelines** and **dependency pinning**.

## Audit and bug bounty (intent)

- Engage **independent audits** before mainnet deployments of financial modules.
- Maintain a **disclosure channel** and (when ready) a **bug bounty** scoped to contracts and critical indexer bugs.

## Fee routing checks

Documented plain-language **post-update invariants** for fee splits and destinations (weights sum to 100%, events, no hidden paths, etc.) live in [fee-routing-and-governance.md — Post-update invariants](fee-routing-and-governance.md#post-update-invariants), alongside [who may change](fee-routing-and-governance.md#governance-actors) each parameter class.

## Testing mapping

Align mitigations with [../testing/strategy.md](../testing/strategy.md):

- **Unit** — invariants, edge timers, tie-breaks, repricing math.
- **Devnet integration** — indexer reorg replay, end-to-end buys and deposits.
- **Testnet** — soak tests, MEV-style ordering simulations where feasible.

**Per-component matrices:** Under [TimeCurve-specific](#timecurve-specific) and [Rabbit Treasury-specific](#rabbit-treasury-specific), each numbered threat maps to **unit / integration / testnet** rows in the test plan tables.

---

**Agent phase:** [Phase 10 — Security and threat model](../agent-phases.md#phase-10)
