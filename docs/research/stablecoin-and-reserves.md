# Research notes: USDm and reserve assets

## USDm (MegaUSD)

MegaETH promotes **USDm** (also referred to as **MegaUSD**) as a native stable asset designed for ecosystem use, with public documentation on issuance and fee-subsidy mechanics. For **this** project:

- Use the canonical name **USDm** in all documentation ([../glossary.md](../glossary.md)).
- **Contract address** and **interfaces** must be taken from **official MegaETH sources** or onchain registries at implementation time (do not hardcode unverified addresses in this doc).

Public background (verify with primary sources):

- MegaETH announcement and FAQ pages describing **USDm** and ecosystem integration.

## Rabbit Treasury reserves

Rabbit Treasury ([../product/rabbit-treasury.md](../product/rabbit-treasury.md)) should start with a **small, explicit basket** of **onchain-auditable** assets (for example USDm only on v1 testnet) unless governance expands the list.

### v1 testnet reserve policy

Default **accepted reserves**: **testnet USDm only**—the single vault token for deposits and withdrawals. Resolve its **contract address** from **official MegaETH testnet artifacts** or an **onchain registry** at deploy time; do not add informal mints or unaudited stand-ins unless documented as an approved test double with the **same ERC-20 surface** intended for production USDm.

**Deferred** until governance defines **onchain** eligibility, caps, and (if needed) conversion rules: additional stablecoins, LP positions, rebasing tokens, and bridged or wrapped assets that need **oracle** marks to value fairly. Keeping one ERC-20 reserve on testnet avoids cross-asset pricing and shrinks **oracle attack surface** while reserve balances and **`Burrow*`** events remain the sole chart authority ([../product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events](../product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events)).

## “Fully onchain” alignment

- **Balances** and **movements** of reserves must be **visible onchain**.
- If **external attestations** or **oracles** influence repricing, document **trust assumptions** explicitly; minimize reliance to reduce **oracle attack surface** ([../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md)).

## Open questions for stewards

- Legal and disclosure requirements for **yield-linked** narratives (even if mechanics are game-like).
- Whether **multiple stables** (for example USDT0, cUSD per MegaETH docs) are in scope for deposits and how **conversion** is handled **onchain**.

---

**Agent phase:** [Phase 17 — Research: USDm and reserves](../agent-phases.md#phase-17)
