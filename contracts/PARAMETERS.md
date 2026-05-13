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
| Per-wallet buy cooldown | 300 seconds (5 minutes) | Immutable **`buyCooldownSec`**; **&gt; 0** required at deploy; rolling from last successful buy’s **`block.timestamp`**. **Anvil QA only ([issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)):** [`DeployDev.s.sol`](script/DeployDev.s.sol) reads [`DeployDevBuyCooldown.sol`](script/DeployDevBuyCooldown.sol) — **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** (default **1** s) or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`**; default stack unchanged when unset. | Default (dev deploy) |
| Initial sale countdown | 86 400 seconds (24 h) | First `deadline` is **`min(start + initialTimerSec, start + MAX_SALE_ELAPSED_SEC + 1)`** ([GitLab #124](https://gitlab.com/PlasticDigits/yieldomega/-/issues/124)); must be > 0; **≤** `timerCapSec`; **`initialTimerSec`** and **`timerCapSec`** must be **≤** **`MAX_SALE_ELAPSED_SEC`** (**300 × 86400**) at `initialize` | Default |
| Maximum remaining timer | 345 600 seconds (96 h) | Ceiling on remaining time after each buy (`now + cap`); must be ≥ extension and ≥ initial; **≤** **`MAX_SALE_ELAPSED_SEC`** ([GitLab #124](https://gitlab.com/PlasticDigits/yieldomega/-/issues/124)) | Default (dev deploy) |
| Sale wall-clock cap (pricing + buys + WarBow CL8Y) | **`MAX_SALE_ELAPSED_SEC = 300 × 86400`** | Strong cap: **`buy` / `buyFor`** and **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** revert **`"TimeCurve: sale max elapsed exceeded"`** when **`block.timestamp > saleStart + MAX_SALE_ELAPSED_SEC`** (onchain check is **`<=`** — inclusive last second when **`deadline`** still allows **`block.timestamp < deadline()`**, typically after **`deadline`** clamps to **`saleStart + MAX + 1`**). CHARM + linear pricing elapsed capped; see [`invariants §124`](../docs/testing/invariants-and-business-logic.md#timecurve-max-sale-elapsed-gitlab-124). | Canonical ([GitLab #124](https://gitlab.com/PlasticDigits/yieldomega/-/issues/124)) |
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
| Referral CHARM | `5%` referrer + `5%` referee as **`charmWeight`**; **100%** gross to `FeeRouter` | `REFERRAL_EACH_BPS` (500) in `TimeCurve` | Default |
| Redemption density (no referral) | **DOUB per CHARM** falls as `totalCharmWeight` grows; **implied CL8Y per DOUB** (`totalRaised / totalTokensForSale`) rises each buy; **excluding referral**, **CL8Y value of DOUB per CHARM** is **non-decreasing** | [`docs/product/primitives.md`](../docs/product/primitives.md#timecurve-redemption-cl8y-density-no-referral) | Canonical |
| **Launch anchor (DOUB/CL8Y LP)** | `DoubLPIncentives` seeds the **locked** DOUB/CL8Y pair at **1.275× the per-CHARM clearing price** → a participant's CHARM is worth **`charmWeight × pricePerCharm × 1275 / (1000 × 1e18)`** CL8Y at launch (e.g. `1 CHARM × 2 CL8Y final price × 1.275 = 2.55 CL8Y` regardless of how many DOUB it redeems for); **Kumbaya v3** band is **0.8×–∞** around this launch anchor | [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md#timecurve-launch-anchor-gitlab-158) (**Launch-anchor 1.275× rule**, [GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158)), [`docs/onchain/fee-routing-and-governance.md`](../docs/onchain/fee-routing-and-governance.md), [`frontend/src/lib/timeCurvePodiumMath.ts`](../frontend/src/lib/timeCurvePodiumMath.ts) | Canonical |
| **Value movement gates (issue #55)** | `buyFeeRoutingEnabled` default **true** (gates `buy` + WarBow CL8Y: steal / revenge / guard); `charmRedemptionEnabled` / `reservePodiumPayoutsEnabled` default **false** (owner setters) | [final-signoff runbook](../docs/operations/final-signoff-and-value-movement.md), [`TimeCurve.sol`](src/TimeCurve.sol) | Operator checklist at mainnet |
| **Unredeemed DOUB allocation sweep ([issue #128](https://gitlab.com/PlasticDigits/yieldomega/-/issues/128))** | **`UNREDEEMED_LAUNCHED_TOKEN_GRACE_SEC = 7 days`**; **`onlyOwner` `sweepUnredeemedLaunchedToken`**; **`setUnredeemedLaunchedTokenRecipient`**; **`saleEndedAt`** from **`endSale`**; optional **`repairSaleEndedAt`** for upgraded proxies | [primitives](../docs/product/primitives.md#unredeemed-launch-allocation-sweep-gitlab-128), [invariants §128](../docs/testing/invariants-and-business-logic.md#timecurve-unredeemed-launch-allocation-sweep-gitlab-128) | Canonical |

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
| Presale CHARM +15% | — | Five canonical boost wallets; first participant’s **10M** DOUB vests to **`0x0965…`** while they keep **`isBeneficiary`** on the registry as **`0xA5F4…`** ([`deployment-guide`](../docs/operations/deployment-guide.md)). Wired via **`TimeCurve.doubPresaleVesting`**: [`PresaleCharmBeneficiaryRegistry`](src/vesting/PresaleCharmBeneficiaryRegistry.sol) when deployed, else [`DoubPresaleVesting`](src/vesting/DoubPresaleVesting.sol) |
| Presale DOUB vesting (optional) | **21.5M** total (**10M / 4M / 5M / 2M / 0.5M** example split) | **30%** at vesting start · **70%** linear over **180 days** (six months) — [`DoubPresaleVesting`](src/vesting/DoubPresaleVesting.sol): fund then `startVesting()`; **`setClaimsEnabled(true)`** when operational signoff allows DOUB claims ([issue #55](../docs/operations/final-signoff-and-value-movement.md)); deploy only when `PRESALE_BENEFICIARIES` is set; rare: **`reduceAllocationsUniformBps` → `burnDoubExcessAboveOutstanding`** to shrink rows uniformly and burn freed DOUB (owner, **Doubloon** burnable) |
| V3 liquidity seed | **28.5M** | Pair with pool strategy (`DoubLPIncentives` / Kumbaya docs) |

## Rabbit Treasury (Burrow)

On-chain **`PARAMS_ROLE`** updates must stay inside the envelopes below (enforced in `RabbitTreasury` setters + `initialize`; see [GitLab #119](https://gitlab.com/PlasticDigits/yieldomega/-/issues/119)). **`c_max`** is fixed at deploy (no setter).

| Parameter | Testnet default | On-chain bounds (WAD) | Status |
|-----------|-----------------|----------------------|--------|
| Reserve asset | Testnet **CL8Y** | Same as TimeCurve accepted asset | **TODO** — address |
| Epoch duration | 86 400 seconds (24 h) | > 0 | Default |
| `c_max` | `2e18` (2.0) | Immutable after deploy | Default |
| `c_star` | `1.05e18` (1.05) | `(0, c_max]` | Default |
| `alpha` | `2e16` (0.02) | `[0, 1)` i.e. `alphaWad < 1e18` | Default |
| `beta` | `2e18` (2.0) | `(0, 10 * WAD]` | Default |
| `m_min` | `98e16` (0.98) | `setMBoundsWad`: `m_min < m_max` | Default |
| `m_max` | `102e16` (1.02) | (paired with `m_min`) | Default |
| `lambda` | `5e17` (0.5) | `(0, WAD]` | Default |
| `delta_max_frac` | `2e16` (0.02) | `(0, 20 * 1e16]` (max **20%** per-step cap on **|Δe|/e**) | Default |
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
| `baseURI` / `tokenURI` prefix | Set at deploy; updatable via `setBaseURI` | **`DEFAULT_ADMIN_ROLE`** may change offchain JSON root intentionally ([product disclosure](../docs/product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json), [GitLab #125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125)); onchain `tokenTraits` stay authoritative for gameplay fields |

See [product/leprechaun-nfts.md — Metadata URI trust model](../docs/product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json) and contract NatSpec on `LeprechaunNFT`.
