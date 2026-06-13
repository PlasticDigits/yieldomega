# Security and threat model (high level)

## Scope

This document lists **classes of risk** for a MegaETH-native, fully onchain gamefi stack. It is not a substitute for **professional audits** or formal verification.

## Chain and execution

- **Reorgs** — With **1s** block times, reorg depth assumptions should be **explicit** in the indexer ([../indexer/design.md](../indexer/design.md)). UI should warn when showing **recent** blocks.
- **Multidimensional gas** — MegaEVM separates **compute** and **storage** gas ([../research/megaeth.md](../research/megaeth.md)). Contracts that look “cheap” on Ethereum L1 models may be **storage-heavy**; test under MegaETH RPC.
- **Contract size** — Larger limits than Ethereum mainnet may encourage bigger modules; still prefer **modular boundaries** for auditability.

## TimeArena-specific

- **MEV and ordering** — Last-buyer and timer races are sensitive to **transaction ordering**. Design should assume **same-slot competition**; tie-break rules must be **deterministic** ([../product/primitives.md](../product/primitives.md)).
- **Per-wallet buy pacing** — **`buyCooldownSec`** limits how often the **same** address can successfully buy; it does **not** change same-block ordering rules for distinct wallets.
- **Griefing** — Small buys that extend timers could be used to delay podium rolls; mitigations include **minimum extension contribution**, **hard-reset bands**, and **per-category timer caps** (design choices).
- **Parameter changes mid-arena** — Governance updates during an active arena can cause disputes; prefer **timelocks** or **two-step** updates via **`onlyOwner`**.

### TimeArena — top design threats and mitigations

| # | Threat (design level) | Mitigation (design level) |
|---|------------------------|---------------------------|
| 1 | **MEV / builder ordering on timer and buys** — In the same block, transaction order decides who is “last buyer,” who extends timers, and podium ties; searchers can **sandwich** or **reorder** around user txs. | Specify **deterministic tie-breaks** (e.g. tx index, log index, address) for all podiums; treat **proposer ordering as part of the game** in docs/UX; keep **CHARM band** and **per-tx cooldown** fully onchain; optional **economic** mitigations (DOUB cost on WarBow actions) if griefing dominates. |
| 2 | **Timer griefing / extension spam** — Small qualifying buys repeatedly **extend** podium timers or dilute meaningful competition. | **Hard-reset bands**, **maximum timer cap**, **category-specific extension rates**, and **DOUB-priced** WarBow actions so spam pays the system. |
| 3 | **Governance or config change mid-arena** — Parameter updates during an active round create **disputes** (effective charm price, caps, vault wiring). | **Timelocks** or **two-step** updates with **`onlyOwner`**; emit **old/new** values on any change ([fee-routing invariants](fee-routing-and-governance.md#post-update-invariants)). |
| 4 | **Rounding / split errors** — DOUB buy routing (100% podiums · 25% × 4 · 70/20/10 epoch tranches ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300))) and podium settlement can **drift** from documented intent (rounding direction). | **Single canonical split** in [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol); **documented rounding** (category remainder → Time Booster; within-category remainder → +2 tranche); **WAD** discipline; tests in `ArenaPrizeRouting.t.sol`. |
| 5 | **Indexer reorg confusion (leaderboards, “last buyer,” timer UI)** — Fast blocks + reorgs can make the indexer **temporarily show** a winner or order that **differs** from the final chain; agents/UI may act on **stale** head. | **Indexer is not authority** ([../indexer/design.md](../indexer/design.md)); **confirmations / finalized depth** policy for “official” UI badges; **watermarks** (block height / cursor) on API; **client-side verification** before irreversible actions; label **recent** state clearly. |

### TimeArena — test plan (threat → validation stage)

Maps each numbered threat above to **unit** (Stage 1), **integration** (Stage 2 devnet + indexer), and **testnet** (Stage 3). See [../testing/strategy.md](../testing/strategy.md).

| Threat # | Unit (Stage 1) | Integration (Stage 2) | Testnet (Stage 3) |
|----------|------------------|-------------------------|---------------------|
| 1 | Fuzz/property tests for **tie-break ordering**; pure **timer + buy** state machine; fork tests for **same-block** tx order. | Devnet **multi-tx same block** (or tight sequence) with indexer decoding **tx index**; API returns ordering fields for audit. | **Soak** with bursty traffic; manual or scripted **ordering** checks against explorer; optional **MEV-style** bundle ordering **where tooling allows** (document gaps). |
| 2 | Unit tests for **extension floors/caps/hard-reset**; edge cases at **timer ceiling**. | E2E **many small buys** vs few large buys; indexer **timer** projection matches contract events. | Long-run **spam** scenarios; monitor **gas** and UX; confirm economics still match design. |
| 3 | Unit tests that **`setCharmPriceWad`** and timer params respect owner policy; upgrade tests **blocked** or **delayed** per design. | Integration: start arena → attempt param change → assert **onchain + indexer** reflect policy. | Governance ops on **staging** with human checklist; no **surprise** mid-arena behavior. |
| 4 | **Invariant** tests on **`ArenaBuyRouting.splitBuyAmount`**, podium payouts; fuzz **rounding**. | Compare **contract-emitted** amounts to indexer-stored rows for sampled txs. | Fuzz-like **random buy sequences** on public RPC; spot-check vs simulation. |
| 5 | Indexer **unit tests**: rollback/reapply **reorg** fixture; decoder idempotency. | **Reorg simulation** in CI or manual: alternate head → rollback → verify **leaderboard** rows and APIs; UI shows **pending vs confirmed** if implemented. | Testnet **natural reorgs** (if any); monitor **head lag** and incorrect “winner” incidents = **0** for confirmed tier. |

> **Retired v1:** Launchpad / five-sink CL8Y threat rows — historical; contracts removed [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243) / [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). Hardening rows — git history before [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274).

## retired v1 player reserve-specific

> **Retired:** **`RetiredV1Treasury`** removed from production deploy ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)). Rows below are historical reference only.

- **Bank run dynamics** — Even with gradual repricing, extreme outflows can stress reserves. **Withdrawal queues**, **epoch limits**, or **transparent fee drains** may be required (TBD at implementation).
- **Oracle manipulation** — If reserve health uses external prices, define **sources**, **staleness checks**, and **fallbacks**. Prefer **pure onchain** accounting where possible.
- **Accounting bugs** — Internal units vs reserves mismatch is catastrophic; require **invariant tests** and **formalized accounting spec** before mainnet.

### retired v1 player reserve (v1 reserve) — top design threats and mitigations

| # | Threat (design level) | Mitigation (design level) |
|---|------------------------|---------------------------|
| 1 | **Bank run / liquidity stress** — Concurrent **withdrawals** can force sharp **repricing** or insolvency perception even if math is sound. | **Withdrawal queues**, **per-epoch caps**, **transparent repricing** rules; clear UX that DOUB is **game accounting**, not a bank deposit ([../product/retired-v1-reserve.md](../product/retired-v1-reserve.md)); optional **fee retention** to slow drains. |
| 2 | **Oracle / external price manipulation** — If health or repricing uses **offchain** feeds, attackers can move marks. | **Prefer onchain reserves and emitted snapshots**; any oracle: **multiple sources**, **staleness bounds**, **TWAP or bounded updates**, **circuit breakers**; document fallbacks in [../research/stablecoin-and-reserves.md](../research/stablecoin-and-reserves.md). |
| 3 | **Accounting / unit mismatch** — **DOUB**, reserves, and **internal price** diverge due to a bug (classic catastrophic loss). | **Formal accounting spec**; **RetiredV1ReserveMath**-style single module; **invariant tests** (reserves, supply, backing); epoch-close **RetiredV1HealthEpochFinalized** as chart anchor ([retired-v1-reserve events](../product/retired-v1-reserve.md#reserve-health-metrics-and-canonical-events)). |
| 4 | **Indexer reorg confusion (epochs, repricing, faction stats)** — Reorgs can **reorder** deposits/withdrawals across **epoch boundaries** or duplicate/miss events briefly; dashboards may show **wrong epoch** or **stale** reserve ratio. | **Canonical `epochId` + `finalizedAt`** in events; indexer **rollback to common ancestor**; APIs expose **confirmations**; **do not** treat indexed balance as sole authority for **redemptions**—users verify via RPC when needed; align with [../indexer/design.md](../indexer/design.md). |
| 5 | **Faction / sybil pressure on deposits** — Users split across identities to **game** leaderboards or rewards tied to **faction** flows. | **Onchain rules** only; **rate limits** or **costly** gates (e.g. NFT); **normalization** or caps per faction if policy requires; document tradeoffs in product specs. |

### retired v1 player reserve — test plan (threat → validation stage)

| Threat # | Unit (Stage 1) | Integration (Stage 2) | Testnet (Stage 3) |
|----------|----------------|-------------------------|---------------------|
| 1 | Unit tests for **queue/epoch limits** and **repricing** under extreme **withdraw** sequences. | Devnet: **burst withdrawals** + indexer **epoch** rows; UI/API match **finalized** events. | Soak with **uneven** deposit/withdraw; monitor **reserve ratio** charts vs onchain **RetiredV1HealthEpochFinalized**. |
| 2 | Mock oracle **staleness**, **deviation**, **fallback** branches in contract math (if present). | Integration with **oracle mock** on devnet; indexer stores **same** values as emitted. | Testnet: if live oracle, **spot-check** against sources; document **failure modes**. |
| 3 | **Invariant** and fuzz tests on **deposit/withdraw/fee**; **RetiredV1ReserveMath** vs reference simulator ([../simulations/README.md](../simulations/README.md)). | Compare **every** `RetiredV1*` emission to DB rows; reconciliation job for **totals**. | Periodic **reconciliation** on testnet; **supply** vs **backing** sanity alerts. |
| 4 | Indexer **reorg** fixtures for **epoch** ordering; property: **epochId** monotonicity after heal. | **Reorg** test: events at epoch boundary **rollback** and **reapply**; faction aggregates **match** chain replay. | Testnet: monitor for **duplicate** epoch closes or **orphan** rows; **head lag** SLO. |
| 5 | Unit tests for **faction** accounting rules and **caps**. | Multi-wallet flows; indexer **faction** leaderboards match **onchain** sums. | Soak with **many** small accounts; watch for **unexpected** faction skew. |

## NFT-specific

- **Metadata drift** — If URIs are upgradeable, document **who** can change them and **how** holders are protected.
- **Faction gaming** — Sybil deposits across factions; mitigations may include **identity costs** (NFT gates), **rate limits**, or **statistical normalization** (onchain rules only).

## Offchain components

- **Indexer compromise** — Should not **move funds**, but could **mislead users**. Mitigate with **client-side verification** for critical actions and **checksum addresses**.
- **Frontend supply chain** — Static hosting reduces runtime risk; still protect **build pipelines** and **dependency pinning**.

## Implementation notes (contract hardening)

Internal review items (not a substitute for an **external audit**):

| Area | Issue class | Mitigation in code / tests |
|------|-------------|----------------------------|
| **`TimeArena.buy` / `buyWithCred`** | **Non-standard ERC20 DOUB** — Fee-on-transfer or rebasing DOUB desyncs vault splits from tokens actually moved. | **Balance-delta parity** on DOUB pulls ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)); prefer standard **`Doubloon`**. Tests: `TimeArena.t.sol`, `NonStandardERC20.t.sol`. |
| **`TimeArena` WarBow DOUB spends** | **Insufficient balance / reentrancy** — WarBow actions pull fixed DOUB amounts from caller. | Revert on short balance; CEI pattern; tests in `TimeArena.t.sol` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)). |
| **`ArenaBuyRouting.splitBuyAmount`** | **Rounding residue** — Integer division can leave wei unmatched to documented 100% podium split ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)). | **Shipped:** category remainder → **WarBow (cat 3)**; within-category remainder → **+2 tranche**; fuzz in `ArenaPrizeRouting.t.sol`. **Approved target:** Last Buy (cat 0) — [time-arena §320](../product/time-arena.md#doc-decision-points-gitlab-320). **0%** admin on buys. |
| **`PodiumVaults` payout** | **Double payout / wrong epoch** — Rolling or finalizing the wrong podium epoch pays wrong winners. | Epoch counters per category; tests `test_roll_podium_*`, `test_finalize_warbow_podium_*` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)). |
| **`ReferralRegistry` `registerCode`** | **Fee-on-transfer** burn mismatch | **Burn-address `balanceOf` delta** vs `registrationBurnAmount` (#123). Test: [`test_feeOnTransfer_referralRegistry_register_reverts_erc20Parity`](../../contracts/test/NonStandardERC20.t.sol). |
| **`TimeArenaBuyRouter` `PAY_STABLE`** | **Fee-on-transfer stable** | Stable ingress balance-delta parity before swap (#123). Test: `TimeArenaBuyRouter.t.sol`. |
| **`AdminSellVault.sellDoubToUsdm`** | **Slippage / router misconfig** — Owner-only liquidation; bad `minOut` or router address drains value. | **`onlyOwner`**; immutable router wiring; tests in `AdminSellVault.t.sol` ([#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249)). |
| **`TimeArena.setPaused`** | **Emergency halt scope** — Pause must block participant writes including **`claimWarBowFlag`**. | **`INV-FRONTEND-264-ARENA-PAY-PAUSE`**; all **`_requireLive()`** paths revert when **`paused`** ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)). |
**Still accepted** (by design / governance): MEV and block ordering on podiums and timers; permissionless **`rollPodiumEpoch`** / **`finalizeWarbowPodium`** for liveness; small rounding residue in DOUB prize splits; **`topUpPodiumPools`** as permissionless sponsorship ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)).

## Audit and bug bounty (intent)

- Engage **independent audits** before mainnet deployments of financial modules.
- Maintain a **disclosure channel** and (when ready) a **bug bounty** scoped to contracts and critical indexer bugs.

## Fee routing checks

Documented plain-language **post-update invariants** for DOUB splits and vault destinations live in [fee-routing-and-governance.md](fee-routing-and-governance.md), alongside governance actors for **`TimeArena`**, **`PodiumVaults`**, and **`AdminSellVault`**.

## Testing mapping

Align mitigations with [../testing/strategy.md](../testing/strategy.md):

- **Unit** — invariants, edge timers, tie-breaks, repricing math.
- **Devnet integration** — indexer reorg replay, end-to-end buys and deposits.
- **Testnet** — soak tests, MEV-style ordering simulations where feasible.

**Per-component matrices:** Under [TimeArena-specific](#timearena-specific) and [retired v1 player reserve-specific](#retired-v1-player-reserve-specific), each numbered threat maps to **unit / integration / testnet** rows in the test plan tables.

---

**Agent phase:** [Phase 10 — Security and threat model](../agent-phases.md#phase-10)
