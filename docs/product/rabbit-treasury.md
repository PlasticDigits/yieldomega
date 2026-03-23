# Rabbit Treasury (design goals)

## Positioning

Rabbit Treasury is the **treasury game layer** that receives ecosystem value and **retains users over time**. It should **not** be marketed as a simple ROI dapp. It is best understood as a **reserve-linked treasury game** with **internal accounting**: users deposit **reserve assets** (for example **USDm**) and receive **Doubloons (DOUB)** on the **Burrow** whose effective value can **float** according to **reserve health**, especially over **rolling windows** (for example 24 hours).

## Honest sustainability

Sustainability depends on **actual fee generation**, **game activity**, and **ecosystem usage**—not on guaranteed offchain yield narratives. Documentation and UX should **not** promise fixed returns; they should explain **mechanisms** and **risks** in plain language.

## Reserve health and repricing

### When reserves are healthy

- Internal pricing can remain **stable** or appreciate within rules, so participation feels predictable enough for game loops.

### When reserves weaken

- The internal unit can **devalue gradually** so the system **reprices** instead of **hard-crashing** in a single opaque step.
- The goal is to reduce **brittle ponzi-like collapse dynamics** while staying **transparent** that the module is still a **game economy**, not a bank deposit.

### Rolling windows

- Metrics for health and repricing should use **defined epochs** (for example rolling 24h, or epoch-based snapshots) that are **visible onchain** or derivable from onchain events so indexers and agents agree on state.

## Separation from CL8Y treasury

- Rabbit Treasury is **player-facing** and **game-layer** capital.
- **CL8Y treasury** remains the **ecosystem governance and allocation** layer ([vision.md](vision.md)). Rabbit Treasury must not silently subsume CL8Y mandates.

## Integration with NFTs and factions

- Deposits, team scores, and **comeback mechanics** may interact with **Leprechaun NFT** sets and factions ([leprechaun-nfts.md](leprechaun-nfts.md)). Rules should remain **onchain** and **auditable**.

## Indexer-facing transparency

Emit **events and snapshots** suitable for:

- Charts of reserve ratio, epoch outcomes, and repricing factors.
- Leaderboards for factions without offchain secret scoring.

### Reserve health metrics and canonical events

The table below is the **canonical naming spec** for **`RabbitTreasury` (Burrow)** logs. Implementations should emit these events (or a strict superset with backward-compatible additions) so **indexers decode a stable ABI**; breaking changes require a **new contract major version** and an **indexer schema version** bump ([`docs/indexer/design.md`](../indexer/design.md)).

**Conventions**

- All names are **Solidity `event` identifiers** (PascalCase after `Burrow`).
- **`reasonCode`** on balance updates is an onchain enum (deposit, withdraw, fee, governance transfer, etc.); document numeric values in the contract NatSpec when frozen.
- **WAD** means **1e18 fixed-point** unless the implementation fixes another decimals convention in NatSpec.
- **`reserveAsset`** is the **vault token address** (for example USDm). Multi-asset treasuries emit one **`BurrowEpochReserveSnapshot`** per asset per epoch close.
- **DOUB** supply may also be tracked via standard **ERC-20 `Transfer`** on the Doubloon token; the epoch events below are the **authoritative snapshot** for charts aligned with repricing.

| Chart metric (indexer / UX) | Canonical event(s) | Payload fields used (implementer fills exact types in ABI) | Notes |
|----------------------------|-------------------|-------------------------------------------------------------|--------|
| **Reserve ratio** | `BurrowHealthEpochFinalized` | `reserveRatioWad` | Single source at epoch finalization; do not recompute offchain unless cross-checking. |
| **Total reserve balance** (live) | `BurrowReserveBalanceUpdated` | `reserveAsset`, `balanceAfter`, `delta`, `reasonCode` | Point-in-time series per asset. |
| **Total reserve balance** (epoch close) | `BurrowEpochReserveSnapshot` | `epochId`, `reserveAsset`, `balance` | One row per asset per epoch for historical charts. |
| **DOUB supply** | `BurrowHealthEpochFinalized` | `doubTotalSupply` | Epoch-aligned supply; optional cross-check against ERC-20 `totalSupply` at `finalizedAt` block. |
| **Reserves per DOUB** | `BurrowHealthEpochFinalized` | `backingPerDoubloonWad` | Emitted explicitly; may equal `f(reserves, supply)` from onchain math but must match contract state at finalization. |
| **Epoch identifier** | `BurrowEpochOpened`, `BurrowHealthEpochFinalized`, `BurrowEpochReserveSnapshot`, `BurrowFeeAccrued`, `BurrowDeposited`, `BurrowWithdrawn` | `epochId` (indexed where marked below) | Same `epochId` domain across all Burrow events in a deployment. |
| **Epoch boundary timestamp** | `BurrowEpochOpened` | `startTimestamp`, `endTimestamp` | Defines the window for rolling charts. |
| **Epoch finalization instant** | `BurrowHealthEpochFinalized` | `finalizedAt` | Block time of snapshot; use for ordering repricing vs. reserve snapshots in the same transaction. |
| **Reserves at epoch end** | `BurrowEpochReserveSnapshot` | per-asset `balance` at `epochId` | Join on `epochId` with `BurrowHealthEpochFinalized`. |
| **DOUB supply at epoch end** | `BurrowHealthEpochFinalized` | `doubTotalSupply` | Same row as reserve ratio / repricing for dashboard consistency. |
| **Repricing factor** | `BurrowHealthEpochFinalized`, `BurrowRepricingApplied` | `repricingFactorWad`; on repricing steps also `priorInternalPriceWad`, `newInternalPriceWad` | Use **`BurrowRepricingApplied`** for every discrete repricing step; **`BurrowHealthEpochFinalized`** carries the epoch’s **summary** factor if the protocol defines one. |
| **Internal epoch state (Burrow math)** | `BurrowHealthEpochFinalized` | `internalStateEWad` | Aligns with `BurrowMath` / simulations; name in ABI may be `eWad`—document alias in NatSpec. |
| **Cumulative fees to treasury** | `BurrowFeeAccrued` | `asset`, `amount`, `cumulativeInAsset`, `epochId` | Sum of `amount` per window if `cumulativeInAsset` is not relied on; prefer emitted cumulative for exact chain truth. |
| **Net reserve flow** (deposits minus withdrawals) | `BurrowDeposited`, `BurrowWithdrawn` | `reserveAsset`, `amount`, `epochId`, `user`, `factionId` | Aggregate per `epochId` or rolling window from both events; **faction** supports leaderboards without secret scoring. |
| **Repricing / devaluation event count** | `BurrowRepricingApplied` | count per rolling window | If repricing only runs at epoch close, count may match epoch count; otherwise count steps. |

**Suggested full event shapes** (exact ordering and `indexed` keywords are finalized in Solidity; indexers key on **keccak256 topic0**):

- `BurrowEpochOpened(uint256 indexed epochId, uint256 startTimestamp, uint256 endTimestamp)`
- `BurrowHealthEpochFinalized(uint256 indexed epochId, uint256 finalizedAt, uint256 reserveRatioWad, uint256 doubTotalSupply, uint256 repricingFactorWad, uint256 backingPerDoubloonWad, uint256 internalStateEWad)`
- `BurrowEpochReserveSnapshot(uint256 indexed epochId, address indexed reserveAsset, uint256 balance)`
- `BurrowReserveBalanceUpdated(address indexed reserveAsset, uint256 balanceAfter, int256 delta, uint8 reasonCode)`
- `BurrowDeposited(address indexed user, address indexed reserveAsset, uint256 amount, uint256 doubOut, uint256 indexed epochId, uint256 factionId)`
- `BurrowWithdrawn(address indexed user, address indexed reserveAsset, uint256 amount, uint256 doubIn, uint256 indexed epochId, uint256 factionId)`
- `BurrowFeeAccrued(address indexed asset, uint256 amount, uint256 cumulativeInAsset, uint256 indexed epochId)`
- `BurrowRepricingApplied(uint256 indexed epochId, uint256 repricingFactorWad, uint256 priorInternalPriceWad, uint256 newInternalPriceWad)`

## Open design questions

- Exact **claim token** model (ERC20 receipt, ERC1155, soulbound receipt, or pure internal ledger in contract storage).
- **Oracle** needs: prefer **minimal** reliance; any external feed must be documented under [../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md) and [../research/stablecoin-and-reserves.md](../research/stablecoin-and-reserves.md).

---

**Agent phase:** [Phase 7 — Rabbit Treasury design goals](../agent-phases.md#phase-7)
