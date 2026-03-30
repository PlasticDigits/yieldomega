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
| Accepted asset | Testnet USDm (ERC-20) | **Standard ERC-20 only** (no fee-on-transfer / rebasing for TimeCurve `buy` accounting). Single asset for v1; resolve address from MegaETH testnet artifacts at deploy | **TODO** — address |
| Initial minimum buy | 1 USDm (`1e18` in asset decimals) | > 0 | Default |
| Daily growth fraction | 25 % (`0.25`) → `growthRateWad = ln(1.25) ≈ 223_143_551_314_209_700` | Must be > 0; governance-set | Default |
| Purchase cap multiple | 10× current min buy | Must be ≥ 2 | Default |
| Timer extension per buy | 120 seconds (2 minutes) | Must be > 0 | Default |
| Initial sale countdown | 86 400 seconds (24 h) | First `deadline` is `start + initialTimerSec`; must be > 0; **≤** `timerCapSec` | Default |
| Maximum remaining timer | 345 600 seconds (96 h) | Ceiling on remaining time after each buy (`now + cap`); must be ≥ extension and ≥ initial | Default (dev deploy) |
| Opening window duration | 3 600 seconds (1 h) | Must be > 0 | Default |
| Closing window duration | 3 600 seconds (1 h) | Must be > 0 | Default |
| Total tokens for sale | **TODO** — depends on launched token supply | > 0 | **TODO** |
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
| DOUB locked liquidity (SIR / Kumbaya) — `DoubLPIncentives` | 3 000 | ≥ 0 |
| CL8Y buy-and-burn — `CL8YProtocolTreasury` | 1 000 | ≥ 0 |
| Podium pool — `PodiumPool` | 2 000 | ≥ 0 |
| Team — `EcosystemTreasury` (or ops multisig) | 500 | ≥ 0 |
| Rabbit Treasury | 3 500 | ≥ 0 |

**FeeRouter** uses **five** sinks (last sink receives rounding remainder). **Podium** internals are fixed in `TimeCurve`: four categories (50% / 20% / 10% / 20% of pool); placements **4∶2∶1** per category.

## Rabbit Treasury (Burrow)

| Parameter | Testnet default | Bounds / notes | Status |
|-----------|-----------------|----------------|--------|
| Reserve asset | Testnet USDm | Same as TimeCurve accepted asset | **TODO** — address |
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

## Governance addresses

| Role | Testnet default | Status |
|------|-----------------|--------|
| `DEFAULT_ADMIN_ROLE` holder | Deployer EOA | **TODO** — multisig before mainnet |
| `FEE_ROUTER` role | FeeRouter contract address | Wired at deploy |
| `PARAMS` role | Deployer EOA | **TODO** — timelock before mainnet |
| `PAUSER` role | Deployer EOA | **TODO** — narrow multisig before mainnet |
| NFT `MINTER_ROLE` | Deployer EOA | **TODO** — authorized minter contract |

## Reserve asset allowlist (v1)

Testnet: **USDm only** (single ERC-20).
Multi-asset basket deferred until governance defines eligibility, caps, and
conversion rules per [research/stablecoin-and-reserves.md](../docs/research/stablecoin-and-reserves.md).

## Leprechaun NFTs

| Parameter | Testnet default | Status |
|-----------|-----------------|--------|
| Max supply per series | **TODO** — define per series | **TODO** |
| Schema version | `1.0.0` | Default |
| Series IDs | Sequential uint256 | Default |
