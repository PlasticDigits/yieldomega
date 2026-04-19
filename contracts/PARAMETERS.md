# Contract parameters — testnet defaults and TODOs

Checklist of parameters requiring human-fixed values before mainnet.
Conservative testnet defaults are provided where safe; security-critical
fields without confirmed values carry explicit TODOs with bounds.

Sources: [product/primitives.md](../docs/product/primitives.md),
[product/rabbit-treasury.md](../docs/product/rabbit-treasury.md),
[product/referrals.md](../docs/product/referrals.md),
[onchain/fee-routing-and-governance.md](../docs/onchain/fee-routing-and-governance.md),
[research/stablecoin-and-reserves.md](../docs/research/stablecoin-and-reserves.md).

## TimeCurve

| Parameter | Testnet default | Bounds / notes | Status |
|-----------|-----------------|----------------|--------|
| Accepted asset | Testnet **CL8Y** (ERC-20) | **Standard ERC-20 only** (no fee-on-transfer / rebasing for TimeCurve `buy` accounting). Single asset for v1; resolve address from official artifacts at deploy | **TODO** — address |
| Initial minimum buy | 1 CL8Y (`1e18` in asset decimals) | > 0 | Default |
| Daily growth fraction | 20 % (`0.20`) → `growthRateWad = ln(1.2) ≈ 182_321_556_793_954_592` | Must be > 0; governance-set | Default |
| Purchase cap multiple | 10× current min buy | Must be ≥ 2 | Default |
| Timer extension per buy | 120 seconds (2 minutes) | Must be > 0 | Default |
| Initial sale countdown | 86 400 seconds (24 h) | First `deadline` is `start + initialTimerSec`; must be > 0; **≤** `timerCapSec` | Default |
| Maximum remaining timer | 345 600 seconds (96 h) | Ceiling on remaining time after each buy (`now + cap`); must be ≥ extension and ≥ initial | Default (dev deploy) |
| Reserve podium categories | **4** fixed in `TimeCurve` | **Last buy** · **WarBow** (top BP) · **Defended streak** · **Time booster** — see [primitives](../docs/product/primitives.md) | Canonical |
| WarBow base BP per buy | **250** | `WARBOW_BASE_BUY_BP` | Fixed |
| WarBow timer-reset bonus BP | **500** | `WARBOW_TIMER_RESET_BONUS_BP` (when remaining &lt; 13m before buy) | Fixed |
| WarBow clutch bonus BP | **150** | `WARBOW_CLUTCH_BONUS_BP` (remaining &lt; 30s before buy) | Fixed |
| WarBow streak-break mult | **100** BP per prior active streak count | `WARBOW_STREAK_BREAK_MULT_BP` | Fixed |
| WarBow ambush bonus BP | **200** | With hard reset + streak break under window | Fixed |
| WarBow flag claim BP | **1000** | `WARBOW_FLAG_CLAIM_BP`; silence **300s** | Fixed |
| WarBow steal / revenge burn | **1e18** each | `WARBOW_STEAL_BURN_WAD`, `WARBOW_REVENGE_BURN_WAD` | Fixed |
| WarBow steal limit bypass burn | **50e18** | When victim already hit 3 steals that UTC day | Fixed |
| WarBow guard burn / duration | **10e18** / **6h** | `WARBOW_GUARD_BURN_WAD`, `WARBOW_GUARD_DURATION_SEC` | Fixed |
| WarBow steal drain BPS | **1000** (10%) normal, **100** (1%) guarded | `WARBOW_STEAL_DRAIN_BPS`, `WARBOW_STEAL_DRAIN_GUARDED_BPS` | Fixed |
| Defended streak window | **900** seconds | `DEFENDED_STREAK_WINDOW_SEC` — remaining time **below** this before buy counts as “under 15 minutes” | Fixed |
| Total tokens for sale | **Production target:** **200M DOUB** on TimeCurve (`totalTokensForSale`); dev mocks may use smaller values | > 0 | **TODO** — confirm at deploy |
| Launched token address | **TODO** — deploy or use existing ERC-20 | Must be valid ERC-20 | **TODO** |
| Tie-break rule | Transaction-index ordering (earlier tx wins ties) | Deterministic onchain | Default |
| Referral registry | `ReferralRegistry` address (or `0` to disable) | Optional; see [product/referrals.md](../docs/product/referrals.md) | **TODO** — address |
| Referral CHARM | `10%` referrer + `10%` referee as **`charmWeight`**; **100%** gross to `FeeRouter` | Fixed in `TimeCurve` bps constants | Default |

## Referral registry

| Parameter | Testnet default | Notes |
|-----------|-----------------|--------|
| CL8Y token (ERC-20) | Mock deploy or env address | **Not** `CL8YProtocolTreasury` — see [product/referrals.md](../docs/product/referrals.md) |
| Registration burn | `1e18` (1 token, 18 decimals) | Must match token decimals on mainnet |

## TimeCurve fee split (basis points, must sum to 10 000)

| Sink | Testnet default (bps) | Bounds |
|------|-----------------------|--------|
| DOUB / CL8Y locked liquidity — `DoubLPIncentives` | 3 000 | ≥ 0 |
| CL8Y burned — burn sink (`0x…dEaD` in `DeployDev`) | 4 000 | ≥ 0 |
| Podium pool — `PodiumPool` | 2 000 | ≥ 0 |
| Team — `EcosystemTreasury` (or ops multisig) | 0 | ≥ 0 |
| Rabbit Treasury | 1 000 | ≥ 0 |

**FeeRouter** uses **five** sinks (last sink receives rounding remainder). **Podium** internals are fixed in `TimeCurve`: **last buy** 40% · **WarBow** 25% · **defended streak** 20% · **time booster** 15% of pool (**8%** · **5%** · **4%** · **3%** of gross raise); placements **4∶2∶1** per category.

## DOUB genesis allocation (policy — 250M total)

| Bucket | Amount (whole DOUB) | Notes |
|--------|---------------------|--------|
| TimeCurve sale | **200M** | Must match `totalTokensForSale` at deploy |
| Presale | **21.5M** | **30%** immediate · **70%** linear vest **6 months** — implement via vesting contract or ops process; document actual addresses at deploy |
| V3 liquidity seed | **28.5M** | Pair with pool strategy (`DoubLPIncentives` / Kumbaya docs) |

## Rabbit Treasury (Burrow)

| Parameter | Testnet default | Bounds / notes | Status |
|-----------|-----------------|----------------|--------|
| Reserve asset | Testnet **CL8Y** | Same as TimeCurve accepted asset | **TODO** — address |
| Epoch duration | 86 400 seconds (24 h) | > 0 | Default |
| `c_max` | `2e18` (2.0) | Per simulations | Default |
| `c_star` | `1.05e18` (1.05) | Per simulations | Default |
| `alpha` | `2e16` (0.02) | Per simulations | Default |
| `beta` | `2e18` (2.0) | Per simulations | Default |
| `m_min` | `98e16` (0.98) | Per simulations | Default |
| `m_max` | `102e16` (1.02) | Per simulations | Default |
| `lambda` | `5e17` (0.5) | Per simulations | Default |
| `delta_max_frac` | `2e16` (0.02) | Per simulations | Default |
| `eps` (coverage denominator floor) | `1` | > 0 | Default |
| Initial `e` (exchange rate) | `1e18` (1.0) | > 0 | Default |
| `protocolRevenueBurnShareWad` | `25e16` (25% of `receiveFee` gross burned) | `< 1e18` | `PARAMS_ROLE` |
| `withdrawFeeWad` | `1e16` (1% of gross redemption after efficiency) | `< 1e18` | `PARAMS_ROLE` |
| `minRedemptionEfficiencyWad` | `5e17` (50% floor when redemption health is 0) | `(0, 1e18]` | `PARAMS_ROLE` |
| `redemptionCooldownEpochs` | `0` (off) | ≥ 0 | `PARAMS_ROLE` |
| `burnSink` | `address(0)` → `DEFAULT_BURN_SINK` (`0x…dEaD`) | Immutable at deploy | Constructor |

## Governance addresses

| Role | Testnet default | Status |
|------|-----------------|--------|
| `DEFAULT_ADMIN_ROLE` holder | Deployer EOA | **TODO** — multisig before mainnet |
| `FEE_ROUTER` role | FeeRouter contract address | Wired at deploy |
| `PARAMS` role | Deployer EOA | **TODO** — timelock before mainnet |
| `PAUSER` role | Deployer EOA | **TODO** — narrow multisig before mainnet |
| NFT `MINTER_ROLE` | Deployer EOA | **TODO** — authorized minter contract |

## Reserve asset allowlist (v1)

Testnet: **CL8Y only** (single ERC-20).
Multi-asset basket deferred until governance defines eligibility, caps, and
conversion rules per [research/stablecoin-and-reserves.md](../docs/research/stablecoin-and-reserves.md).

## Leprechaun NFTs

| Parameter | Testnet default | Status |
|-----------|-----------------|--------|
| Max supply per series | **TODO** — define per series | **TODO** |
| Schema version | `1.0.0` | Default |
| Series IDs | Sequential uint256 | Default |
