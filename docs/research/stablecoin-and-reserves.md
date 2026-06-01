# Research notes: USDm, CL8Y, and reserve assets

**Canonical launch default (this repo):** **CL8Y** is used for **`ReferralRegistry`** registration burns and optional **TimeArenaBuyRouter** swap paths. **Arena v2** primary buy asset is **DOUB** ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)). Retired v1 **TimeCurve** CL8Y sale semantics — [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243). **USDm** remains relevant as MegaETH ecosystem context — see below.

## USDm (MegaUSD)

MegaETH promotes **USDm** (also referred to as **MegaUSD**) as a native stable asset designed for ecosystem use, with public documentation on issuance and fee-subsidy mechanics. For **this** project:

- Use the canonical name **USDm** in all documentation ([../glossary.md](../glossary.md)).
- **Contract address** and **interfaces** must be taken from **official MegaETH sources** or onchain registries at implementation time (do not hardcode unverified addresses in this doc).

Public background (verify with primary sources):

- MegaETH announcement and FAQ pages describing **USDm** and ecosystem integration.

## retired v1 player reserve reserves

retired v1 player reserve ([../product/retired-v1-reserve.md](../product/retired-v1-reserve.md)) uses a **single onchain-auditable** vault token at launch (**CL8Y**) unless governance expands to a basket.

### v1 testnet reserve policy

Default **testnet token** for **ReferralRegistry** burns and router fixtures: resolve **CL8Y** contract address from **official artifacts** or an **onchain registry** at deploy time. **DOUB** is the Arena buy token ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)).

**USDm** may still appear in liquidity plans (for example DOUB/USDm pools) or future multi-asset baskets; document any expansion next to [fee routing](../onchain/fee-routing-and-governance.md) and [PARAMETERS.md](../../contracts/PARAMETERS.md).

**Deferred** until governance defines **onchain** eligibility, caps, and (if needed) conversion rules: additional stablecoins, LP positions, rebasing tokens, and bridged or wrapped assets that need **oracle** marks to value fairly. Keeping one ERC-20 reserve on testnet avoids cross-asset pricing and shrinks **oracle attack surface** while reserve balances and **`RetiredV1*`** events remain the sole chart authority ([../product/retired-v1-reserve.md#reserve-health-metrics-and-canonical-events](../product/retired-v1-reserve.md#reserve-health-metrics-and-canonical-events)).

## “Fully onchain” alignment

- **Balances** and **movements** of reserves must be **visible onchain**.
- If **external attestations** or **oracles** influence repricing, document **trust assumptions** explicitly; minimize reliance to reduce **oracle attack surface** ([../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md)).

## Open questions for stewards

- Legal and disclosure requirements for **yield-linked** narratives (even if mechanics are game-like).
- Whether **multiple stables** (for example USDT0, cUSD per MegaETH docs) are in scope for deposits and how **conversion** is handled **onchain**.

---

**Agent phase:** [Phase 17 — Research: USDm and reserves](../agent-phases.md#phase-17)
