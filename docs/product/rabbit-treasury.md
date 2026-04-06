# Rabbit Treasury (design goals)

## Positioning

Rabbit Treasury is the **treasury game layer** that receives ecosystem value and **retains users over time**. It should **not** be marketed as a simple ROI dapp. It is best understood as a **reserve-linked treasury game** with **internal accounting**: users deposit **reserve assets** (**CL8Y** at launch) and receive **Doubloons (DOUB)** on the **Burrow** whose effective value can **float** according to **reserve health**, especially over **rolling windows** (for example 24 hours).

## Reserve buckets (CL8Y accumulator)

Rabbit holds the reserve asset in **two onchain buckets**:

| Bucket | Meaning | Typical sources |
|--------|---------|-----------------|
| **Redeemable backing** | Backs ordinary DOUB redemptions | User deposits |
| **Protocol-owned backing** | **Non-redeemable** exit path for normal DOUB holders | `receiveFee` share (after burn), withdrawal fees |

**Total backing** = redeemable + protocol-owned. **`BurrowMath` coverage at epoch close** uses **total backing** so protocol inflows improve **system health** without minting DOUB.

**Protocol revenue** (`receiveFee`): a configurable **WAD** fraction of each gross inflow is **burned** (transferred to an immutable burn sink, default `0x000…dEaD`); the remainder credits **protocol-owned backing**. Deploy defaults target about **25% burn / 75% protocol** (tunable toward the **20–40% burn / 60–80% protocol** range).

**Withdrawals** only draw from **redeemable backing** for the user’s claim. A configurable **withdrawal fee** (WAD) stays in the vault and is credited to **protocol-owned backing**.

### Deposit (mint) formula

- `redeemableBacking += amount`
- `doubOut = amount * WAD / eWad`

Minting is keyed off **redeemable deposits**, not total CL8Y in the contract.

### Withdraw (redeem) formula

Let `S` = DOUB `totalSupply`, `R` = `redeemableBacking`, `e` = `eWad`, `L = S * e / WAD`.

1. `nominalOut = doubAmount * e / WAD`
2. `proRataCap = doubAmount * R / S` (fair share of redeemable if under-covered on the redeemable bucket)
3. `baseOut = min(nominalOut, proRataCap)`
4. `H = min(R * WAD / (L + eps), WAD)` — redemption health (1.0 = fully covered on redeemable vs nominal liability)
5. `effWad = minRedemptionEfficiencyWad + (WAD - minRedemptionEfficiencyWad) * H / WAD`
6. `grossFromRedeemable = baseOut * effWad / WAD` (debited from `redeemableBacking`)
7. `fee = grossFromRedeemable * withdrawFeeWad / WAD` → `protocolOwnedBacking`; user receives `grossFromRedeemable - fee`

Governance may set **redemption cooldown** (minimum epochs between withdrawals per address).

### Onchain transparency

In addition to legacy getters, the contract exposes **`redeemableBacking`**, **`protocolOwnedBacking`**, **`totalReserves()` / `totalBacking()`**, **`cumulativeBurned`**, **`cumulativeWithdrawFees`**, **`redemptionHealthWad()`**, **`redemptionLiabilityWad()`**, **`previewWithdraw`**, and **`previewWithdrawFor(address user, …)`**. **`previewWithdraw`** applies **redemption cooldown** using **`msg.sender`** (fine for wallet `eth_call`s); **`previewWithdrawFor`** is for quoting a **specific user** (indexers, tests, or backend sims). New events: **`BurrowReserveBuckets`**, **`BurrowProtocolRevenueSplit`**, **`BurrowWithdrawalFeeAccrued`**. Indexers may treat these as a **strict superset** of the canonical table below (schema bump when persisting new fields).

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
- **`reserveAsset`** is the **vault token address** (for example **CL8Y**). Multi-asset treasuries emit one **`BurrowEpochReserveSnapshot`** per asset per epoch close.
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
| **Redeemable vs protocol buckets** | `BurrowReserveBuckets` | `epochId`, `redeemableBacking`, `protocolOwnedBacking`, `totalBacking` | Emitted on deposits, withdrawals, fee splits, and epoch finalize for charting. |
| **Protocol revenue burn vs protocol bucket** | `BurrowProtocolRevenueSplit` | `epochId`, `grossAmount`, `toProtocolBucket`, `burnedAmount` | Ties `receiveFee` gross to burn and non-redeemable backing. |
| **Withdrawal fee recycling** | `BurrowWithdrawalFeeAccrued` | `asset`, `feeAmount`, `cumulativeWithdrawFees` | Fee stays in vault; moves redeemable → protocol bucket internally. |
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
- `BurrowReserveBuckets(uint256 indexed epochId, uint256 redeemableBacking, uint256 protocolOwnedBacking, uint256 totalBacking)`
- `BurrowProtocolRevenueSplit(uint256 indexed epochId, uint256 grossAmount, uint256 toProtocolBucket, uint256 burnedAmount)`
- `BurrowWithdrawalFeeAccrued(address indexed asset, uint256 feeAmount, uint256 cumulativeWithdrawFees)`
- `BurrowRepricingApplied(uint256 indexed epochId, uint256 repricingFactorWad, uint256 priorInternalPriceWad, uint256 newInternalPriceWad)`

**`BurrowReserveBalanceUpdated.reasonCode` (v1):** `1` = deposit, `2` = withdraw (user payout), `3` = fee router inflow (`delta` = net change to vault balance after burn transfer).

## Open design questions

- Exact **claim token** model (ERC20 receipt, ERC1155, soulbound receipt, or pure internal ledger in contract storage).
- **Oracle** needs: prefer **minimal** reliance; any external feed must be documented under [../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md) and [../research/stablecoin-and-reserves.md](../research/stablecoin-and-reserves.md).

---

**Agent phase:** [Phase 7 — Rabbit Treasury design goals](../agent-phases.md#phase-7)
