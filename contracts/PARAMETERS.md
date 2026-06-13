# Contract parameters — testnet defaults and TODOs

Checklist of parameters requiring human-fixed values before mainnet.
Conservative testnet defaults are provided where safe; security-critical
fields without confirmed values carry explicit TODOs with bounds.

Sources: [product/primitives.md](../docs/product/primitives.md),
[product/retired-v1-reserve.md](../docs/product/retired-v1-reserve.md),
[product/referrals.md](../docs/product/referrals.md),
[onchain/fee-routing-and-governance.md](../docs/onchain/fee-routing-and-governance.md),
[research/stablecoin-and-reserves.md](../docs/research/stablecoin-and-reserves.md).

## TimeArena (Arena v2 — canonical DOUB routing)

Replaces legacy **FeeRouter** five-sink CL8Y table ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). Invariant: **`INV-TIME-ARENA-ROUTE-SPLIT`**.

| Destination | Bps (of gross DOUB in) | Share |
|-------------|------------------------|-------|
| Each of 4 podium categories | 2500 | **25%** each (remainder → Last Buy) |
| Per category → current epoch (`activePools`) | 7000 of category share | **70%** |
| Per category → next epoch (`seedPools`) | 2000 of category share | **20%** |
| Per category → epoch+2 (`futurePools`) | remainder of category share | **10%** |
| **`AdminSellVault`** on **`buy`** | 0 | **0%** ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)) |

Implementation: [`ArenaBuyRouting.sol`](src/arena/libraries/ArenaBuyRouting.sol). Forge: `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_buy_routes_doub_split`, `test_buy_routes_epoch_tranches_worked_example` ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)). Manual top-up (`topUpPodiumPools`): legacy 10:7.5 active:seed per category, **0%** admin — [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261).

| Parameter | Default | Notes |
|-----------|---------|-------|
| `charmPriceWad` / `effectiveCharmPriceWad()` | **Epoch 0:** Kumbaya TWAP init ~**$1/CHARM** ([#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)); grows **+10%/day** until Last Buy hard reset re-anchors ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)); **DeployDev:** `1000e18` anchor | DOUB per 1e18 CHARM for `buy` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)) |
| `doubOwedForBuy(charmWad)` | **`view`** — same gross DOUB as immediate `buy` / `buyFor` ([#315](https://gitlab.com/PlasticDigits/yieldomega/-/issues/315)) | When Last Buy **remaining &lt; 780s** (cat 0 hard-reset band), samples TWAP/spot anchor **without** state write; else `charmWad × effectiveCharmPriceWad() / 1e18`. **`TimeArenaBuyRouter`** and integrators should use this for `exactOutput` sizing, not `effectiveCharmPriceWad()` alone. |
| CHARM band | `99e16` – `10e18` | Fixed envelope; not bonding curve ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)) |
| Parameter | Cat 0 Last Buy | Cat 1 Time Booster | Cat 2 Defended Streak | Cat 3 WarBow | Notes |
|-----------|----------------|--------------------|-----------------------|--------------|-------|
| `podiumTimerExtensionSec` | `120` | `60` | `90` | `300` | Per buy when not in hard-reset band ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) |
| `podiumInitialTimerSec` | `86_400` (24 h) | `43_200` (12 h) | `64_800` (18 h) | `172_800` (48 h) | After `startArena` / `rollPodiumEpoch(cat)` |
| `podiumTimerCapSec` | `345_600` (96 h) | `172_800` (48 h) | `259_200` (72 h) | `691_200` (192 h) | `4 × initialTimerSec[cat]` |
| Hard-reset band | `< 780s` → `900s` | `< 240s` → `300s` | `< 510s` → `600s` | `< 3300s` → `3600s` | `podiumResetBelowRemainingSec` / `podiumResetToRemainingSec` |
| Legacy shims | `timerExtensionSec` / `initialTimerSec` / `timerCapSec` mirror cat 0 | — | — | — | ABI compat |

Canonical table: [`ArenaPodiumTimerConfig.sol`](src/arena/libraries/ArenaPodiumTimerConfig.sol). **Scoring** (Time Booster totals, Defended Streak, WarBow BP clutch/reset) uses **Last Buy (cat 0)** timer only; per-category timers govern **prize settlement** deadlines ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271) comment).
| `buyCooldownSec` | `300` (5 min prod; Anvil may shorten) | Rolling from last buy |
| `CRED_PER_CHARM_WAD` | `100e18` | `buyWithCred` burn ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) |
| XP per buy (CHARM-scaled) | `1` at `CHARM_MIN_WAD` → `10` at `CHARM_MAX_WAD` | `ArenaXp.xpForCharm(charmWad)`; DOUB and CRED paths ([#304](https://gitlab.com/PlasticDigits/yieldomega/-/issues/304) · **`INV-TIME-ARENA-XP-CHARM-SCALE`**) |
| First-buy CRED bonus | `150e18` scheduled for `lastBuyEpoch + 1` | One wallet lifetime ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) |

### WarBow DOUB costs ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252))

| Constant | Value | Notes |
|----------|-------|-------|
| `WARBOW_STEAL_DOUB` | `1000e18` | Per steal |
| `WARBOW_GUARD_DOUB` | `10_000e18` | 6h guard |
| `WARBOW_STEAL_LIMIT_BYPASS_DOUB` | `50_000e18` | Extra when daily steal cap exceeded |
| `WARBOW_REVENGE_DOUB` | `1000e18` | Revenge window 24h |
| Flag claim | `0` | +1000 BP after 300s silence |

All WarBow DOUB spends (**steal / guard / revenge**, including steal-limit bypass) route **100%** to podium vaults via the same **`_routeDoubPrizeSplit`** as **`buy`** and increment **`totalDoubRaised`** ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)); no DOUB stranded on **`TimeArena`**.

Buy-path WarBow BP includes **streak-break** (`activeDefendedStreak × WARBOW_STREAK_BREAK_MULT_BP` when a different buyer buys under **`DEFENDED_STREAK_WINDOW_SEC`**) and **ambush** (+`WARBOW_AMBUSH_BONUS_BP` on hard reset + streak break), matching [`warbow_buy_bp_delta`](../../simulations/timecurve_sim/model.py).

Forge: `TimeArena.t.sol::test_warbow_*`, `test_finalize_warbow_podium_pays_after_roll`. Epoch roll clears BP via `warbowBpGeneration`; admin `finalizeWarbowPodium` pays (roll skips auto 4∶2∶1).

## TimeCurve (retired v1 — historical)

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
| WarBow ambush bonus BP | **200** | With hard reset + streak break under window — wired in `_applyBuyWarBowBp` ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) | Fixed |
| WarBow flag claim BP | **1000** | `WARBOW_FLAG_CLAIM_BP`; silence **300s** | Fixed |
| WarBow steal / revenge spend | **1000e18** each | `WARBOW_STEAL_DOUB`, `WARBOW_REVENGE_DOUB`; routed like **`buy`** via `_routeDoubPrizeSplit`; **`totalDoubRaised +=` gross** ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) | Fixed |
| WarBow steal limit bypass spend | **50_000e18** | When daily steal cap exceeded (`WARBOW_STEAL_LIMIT_BYPASS_DOUB`); same routing as steal | Fixed |
| WarBow guard spend / duration | **10_000e18** / **6h** | `WARBOW_GUARD_DOUB`, `WARBOW_GUARD_DURATION_SEC`; same routing as **`buy`** ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) | Fixed |
| WarBow steal drain BPS | **1000** (10%) normal, **100** (1%) guarded | `WARBOW_STEAL_DRAIN_BPS`, `WARBOW_STEAL_DRAIN_GUARDED_BPS` | Fixed |
| WarBow steal BP bracket | **2×–10×** attacker BP | `warbowSteal`: **`victimBP ≥ 2 × attackerBP`** and **`victimBP ≤ 10 × attackerBP`** (reverts **`TimeCurve: steal 2x rule`** / **`TimeCurve: steal 10x cap`**) — [GitLab #211](https://gitlab.com/PlasticDigits/yieldomega/-/issues/211) | Fixed |
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

## TimeCurve fee split (retired v1 — [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244))

**Not used in Arena v2.** Canonical routing is **TimeArena** 100% podium DOUB ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)) above. Historical **FeeRouter** five-sink table (30/40/20/0/10 CL8Y) for archaeology only:

| Sink | Testnet default (bps) | Bounds |
|------|-----------------------|--------|
| DOUB / CL8Y locked liquidity — `DoubLPIncentives` | 3 000 | ≥ 0 |
| CL8Y burned — burn sink (`0x…dEaD` in `DeployDev`) | 4 000 | ≥ 0 |
| Podium pool — `PodiumPool` | 2 000 | ≥ 0 |
| Team — `EcosystemTreasury` (or ops multisig) | 0 | ≥ 0 |
| retired v1 player reserve | 1 000 | ≥ 0 |

**FeeRouter** used **five** sinks (last sink received rounding remainder). **Podium** internals in `TimeCurve`: **last buy** 40% · **WarBow** 25% · **defended streak** 20% · **time booster** 15% of pool; placements **4∶2∶1** per category.

## DOUB genesis allocation (policy — 250M total)

| Bucket | Amount (whole DOUB) | Notes |
|--------|---------------------|--------|
| TimeCurve sale | **200M** | Must match `totalTokensForSale` at deploy |
| Presale CHARM +15% | — | Five canonical boost wallets; first participant’s **10M** DOUB vests to **`0x0965…`** while they keep **`isBeneficiary`** on the registry as **`0xA5F4…`** ([`deployment-guide`](../docs/operations/deployment-guide.md)). Wired via **`TimeCurve.doubPresaleVesting`**: [`PresaleCharmBeneficiaryRegistry`](src/vesting/PresaleCharmBeneficiaryRegistry.sol) when deployed, else [`DoubPresaleVesting`](src/vesting/DoubPresaleVesting.sol) |
| Presale DOUB vesting (optional) | **21.5M** total (**10M / 4M / 5M / 2M / 0.5M** example split) | **30%** at vesting start · **70%** linear over **180 days** (six months) — [`DoubPresaleVesting`](src/vesting/DoubPresaleVesting.sol): fund then `startVesting()`; **`setClaimsEnabled(true)`** when operational signoff allows DOUB claims ([issue #55](../docs/operations/final-signoff-and-value-movement.md)); deploy only when `PRESALE_BENEFICIARIES` is set; rare: **`reduceAllocationsUniformBps` → `burnDoubExcessAboveOutstanding`** to shrink rows uniformly and burn freed DOUB (owner, **Doubloon** burnable) |
| V3 liquidity seed | **28.5M** | Pair with pool strategy (`DoubLPIncentives` / Kumbaya docs) |

## retired v1 player reserve (v1 reserve)

On-chain **`PARAMS_ROLE`** updates must stay inside the envelopes below (enforced in `RetiredV1Treasury` setters + `initialize`; see [GitLab #119](https://gitlab.com/PlasticDigits/yieldomega/-/issues/119)). **`c_max`** is fixed at deploy (no setter).

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

## Retired: collectible NFT layer (Arena v2)

Removed in [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241). Historical schema: [`schemas/archive/`](../schemas/archive/).
