# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Authoritative rules live onchain**; the indexer and frontend are derived read models ([architecture/overview.md](../architecture/overview.md)).

---

## ~75% (Stage 2) verification

Per [agent-implementation-phases.md](../agent-implementation-phases.md), **~75%** means the **Stage 2 exit checklist** in [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration) is satisfied.

| Gate | Evidence |
|------|----------|
| Stage 1 automated tests green | Run commands below; CI: [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml). |
| Devnet integration recorded | [operations/stage2-run-log.md](../operations/stage2-run-log.md) (deploy, fresh DB, smoke txs, lag, API/DB consistency). |
| Reorg / rollback path | `indexer/tests/integration_stage2.rs` + CI Postgres + `YIELDOMEGA_PG_TEST_URL`. Optional live drill: [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md). |

---

## How to run the full automated matrix

From repository root:

```bash
# Contracts (CI profile: optimizer + defined runs for fuzz). Install forge libs per contracts/README.md first.
cd contracts && FOUNDRY_PROFILE=ci forge test -vv

# Optional fork smoke (`TimeCurveFork.t.sol`): set RPC URL or tests no-op — [contract-fork-smoke.md](contract-fork-smoke.md)
# export FORK_URL=https://carrot.megaeth.com/rpc
# cd contracts && FOUNDRY_PROFILE=ci forge test --match-contract TimeCurveForkTest -vv

# Indexer — see "Postgres integration test behavior" below
cd indexer && cargo test

# Frontend unit tests
cd frontend && npm ci && npm test

# Python simulations (Burrow / epoch invariants vs reference math)
cd simulations && PYTHONPATH=. python3 -m unittest discover -s tests -v
```

Forge dependencies for CI are listed in [contracts/README.md](../../contracts/README.md).

### Postgres integration test behavior (`indexer/tests/integration_stage2.rs`)

GitHub Actions sets `YIELDOMEGA_PG_TEST_URL` against a **service container** so `postgres_stage2_persist_all_events_and_rollback_after` connects, runs migrations, inserts every `DecodedEvent` variant, checks idempotency, and calls `rollback_after` ([ci.md](ci.md)).

If the variable is **unset or empty** locally, that test **returns immediately** and still reports **passed** — it does **not** prove Postgres behavior. Export a URL to the same database you use for manual indexer runs when you need local parity with CI.

---

## Business logic (what the code is supposed to enforce)

| Area | Intent (short) | Product / onchain spec |
|------|----------------|-------------------------|
| **TimeCurve** | Sale lifecycle: **exponential CHARM band** (0.99–10 CHARM × envelope), **linear per-CHARM price** (`ICharmPrice`), timer extension with cap, fees to router, sale end, CHARM-weighted redemption, prize podiums. | [product/primitives.md](../product/primitives.md), [TimeCurve.sol](../../contracts/src/TimeCurve.sol), [LinearCharmPrice.sol](../../contracts/src/pricing/LinearCharmPrice.sol) |
| **Rabbit Treasury (Burrow)** | Deposits → **redeemable** backing + DOUB mint; `receiveFee` → burn + **protocol-owned** backing (no DOUB mint); withdraw from redeemable only (pro-rata, health efficiency, fees → protocol); epoch repricing via **total** backing + BurrowMath; canonical Burrow* events. | [product/rabbit-treasury.md](../product/rabbit-treasury.md), [RabbitTreasury.sol](../../contracts/src/RabbitTreasury.sol) |
| **Fee routing** | TimeCurve pulls sale asset from buyer, forwards to `FeeRouter`; splits per bps to sinks; weights sum to 10_000; remainder to last sink. | [onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md), [FeeRouter.sol](../../contracts/src/FeeRouter.sol) |
| **DOUB presale vesting** | Immutable `EnumerableSet` of beneficiaries + allocations; constructor enforces `sum(amounts) == requiredTotal`; **30%** vested at `vestingStart`, **70%** linear over `vestingDuration`; `startVesting` once when `token.balanceOf(this) >= totalAllocated`. | [DoubPresaleVesting.sol](../../contracts/src/vesting/DoubPresaleVesting.sol), [PARAMETERS.md](../../contracts/PARAMETERS.md) |
| **NFT** | Series supply cap, authorized mint, traits onchain. | [LeprechaunNFT.sol](../../contracts/src/LeprechaunNFT.sol), [schemas/README.md](../schemas/README.md) |
| **Indexer** | Decode canonical logs, idempotent persist, chain pointer + reorg rollback of indexed rows. | [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md), [indexer/src/persist.rs](../../indexer/src/persist.rs) |
| **Frontend** | Env-driven chain, addresses, indexer URL normalization for read paths. | [frontend/.env.example](../../frontend/.env.example), [frontend/src/lib/addresses.ts](../../frontend/src/lib/addresses.ts) |
| **Dev stack** | Same wiring as [DeployDev.s.sol](../../contracts/script/DeployDev.s.sol): epoch open + sale start; deposit + buy with correct ERC20 approvals. | [DevStackIntegration.t.sol](../../contracts/test/DevStackIntegration.t.sol) |

### Business rules (narrative, for reviewers)

- **TimeCurve + TimeMath + `ICharmPrice`:** **CHARM quantity** per buy is bounded by an **exponential daily envelope** (same `TimeMath.currentMinBuy` factor on a reference WAD): onchain **min CHARM** = `0.99e18 × scale` and **max CHARM** = `10e18 × scale` (ratio **10 / 0.99** always). **Per-CHARM price** in the accepted asset is **decoupled** and comes from **`ICharmPrice`** (default **`LinearCharmPrice`**: `base + dailyIncrement × elapsed / 1 day`). **Gross spend** = `charmWad × priceWad / 1e18`. Buys extend the deadline (or apply the **under-13m → 15m remaining** hard reset) up to **`timerCapSec`**. When the sale ends, participants **`redeemCharms`** once for a pro-rata share of launched tokens using **`totalCharmWeight`** in the denominator; **reserve** podium slots (**last buy, time booster, defended streak**) and **WarBow Battle Points** (separate PvP layer) update per [`docs/product/primitives.md`](../product/primitives.md). Each buy routes the **full gross** accepted asset through **`FeeRouter`** (five sinks — see fee doc). Referral incentives add **CHARM weight** (as a fraction of **`charmWad`**) without reserve rebates. **`acceptedAsset` must be a standard ERC20** (no fee-on-transfer / rebasing): accounting uses the computed `amount`, not balance deltas. **`distributePrizes`** is permissionless after `endSale` and pays the **podium pool** in the reserve asset (see [security threat model — implementation notes](../onchain/security-and-threat-model.md#implementation-notes-contract-hardening)).
- **RabbitTreasury + BurrowMath:** Users deposit the reserve asset during an **open** epoch and receive DOUB (credited to **redeemable** backing). **`receiveFee`** increases **total** backing but splits gross inflows into **burn** (sink transfer) and **protocol-owned** backing—no DOUB is minted. **Withdraw** burns DOUB and pays users from **redeemable** backing using `min(nominal, pro-rata)` on that bucket, a **health-linked efficiency** curve, an optional **epoch cooldown**, and a **withdrawal fee** that recycles into protocol-owned backing. **Epoch finalization** uses **total** backing (redeemable + protocol) inside `BurrowMath.coverageWad` so treasury strength reflects accumulated CL8Y. Math is fuzzed and cross-checked against Python reference and simulations where applicable.
- **FeeRouter + FeeMath:** Sink weights are validated to sum to 10_000 bps; distribution uses integer division with **remainder assigned to the last sink** so no dust remains in the router. Governance roles control sink updates.
- **DoubPresaleVesting:** Beneficiary list and per-address allocations are **immutable** after deploy. The constructor rejects **duplicate or zero addresses**, **zero individual allocations**, **length mismatches**, **`vestingDuration == 0`**, and **`requiredTotalAllocation != sum(amounts)`**. Only **`Ownable` owner** may call **`startVesting` once**, after **`DOUB.balanceOf(vesting) >= totalAllocated`**. Vesting math: **`cliff = allocation × 3000 / 10000`**, **`linearCap = allocation - cliff`**, **`linearReleased = linearCap × min(elapsed, duration) / duration`** for **`elapsed = t - vestingStart`**; **`vested = min(allocation, cliff + linearReleased)`** once **`t >= vestingStart`**. **`claim`** is **nonReentrant** and cannot exceed **`vested - claimed`**. Enumeration via **`beneficiaryCount` / `beneficiaryAt` / `isBeneficiary`** wraps OpenZeppelin **`EnumerableSet.AddressSet`**.
- **LeprechaunNFT:** Series are created with a max supply; only the minter role can mint; trait structs are stored onchain for indexer/UI derivation.
- **Indexer:** Log decoding must match Solidity event layouts; persistence must survive duplicate delivery (`ON CONFLICT`); on reorg, rows strictly after the common ancestor block are removed and the chain pointer is reset ([REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md)).
- **Frontend helpers:** User-supplied addresses and indexer base URLs are normalized so RPC and HTTP clients see stable values.

---

## Invariants and where they are tested

### TimeMath (library)

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Min buy at start | Baseline min buy before elapsed time | `test_minBuy_zero_elapsed` |
| ~20% daily growth shape | Documented approximate step (one day ≈ 1.2×, two days compound) | `test_minBuy_one_day_approx_120pct`, `test_minBuy_two_days` |
| Min buy monotonic in time | Non-decreasing over elapsed seconds | `test_minBuy_monotonic_fuzz` |
| Timer extension | Deadline moves forward on buy, capped by timer max | `test_extendDeadline_basic`, `test_extendDeadline_caps_at_timerMax`, `test_extendDeadline_past_deadline_uses_now` |

### TimeCurve (contract)

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Sale start | `startSale` transitions once | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): `test_startSale`, `test_startSale_reverts_twice`, `test_startSale_insufficient_launched_tokens_reverts` |
| Happy-path buy | Valid buy updates CHARM weight and `totalRaised` | `test_buy_basic` |
| Per-wallet buy cooldown | Second buy before `nextBuyAllowedAt` reverts **`"TimeCurve: buy cooldown"`**; boundary at `nextBuyAllowedAt` succeeds; wallets independent | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): cooldown / boundary / two-wallet tests; handler respects cooldown in [`TimeCurveInvariant.t.sol`](../../contracts/test/TimeCurveInvariant.t.sol) |
| Min / max gross spend monotonic | `currentMinBuyAmount` / `currentMaxBuyAmount` increase with time (envelope × price) | `test_minBuy_grows_over_time` |
| CHARM bounds ratio | `10 × minCharm` and `0.99 × maxCharm` match within **floor-division slack** (shared envelope factor) | `test_charmBounds_ratio_10_over_099_fuzz` |
| CHARM bounds exponential scale | Min/max CHARM ~20%/day with canonical `growthRateWad` | `test_charmBounds_scale_approx_20_percent_per_day` |
| Purchase bounds (CHARM WAD) | Each buy in `[currentCharmBoundsWad.min, .max]` | `test_buy_below_minBuy_reverts`, `test_buy_above_cap_reverts`, `test_buy_charmWad_in_bounds_fuzz` |
| Spend formula | `amount = charmWad × pricePerCharmWad / WAD`; `totalRaised` += `amount` | `test_buy_charmWad_in_bounds_fuzz`, `test_linear_price_per_charm_independent_of_envelope` |
| Linear price schedule | `LinearCharmPrice.priceWad` matches `base + daily×elapsed/86400`; monotone in `elapsed` | [`LinearCharmPrice.t.sol`](../../contracts/test/LinearCharmPrice.t.sol): `test_priceWad_linear_matches_formula_fuzz`, `test_priceWad_monotonic_in_elapsed_fuzz`, `test_constructor_zero_base_reverts` |
| Price decoupled from envelope | With `growthRateWad = 0`, CHARM bounds flat while `currentPricePerCharmWad` still ramps linearly | `test_linear_price_per_charm_independent_of_envelope` |
| Timer extension capped | Extended deadline respects `timerCapSec` | `test_timer_extends_on_buy`, `test_timer_cap_fuzz` |
| Sale state machine | No buy before start / after end / after timer expiry | `test_buy_not_started_reverts`, `test_buy_after_end_reverts`, `test_buy_after_timer_expires_reverts` |
| `endSale` gating | Not before start; not twice | `test_endSale_not_started_reverts`, `test_endSale_already_ended_reverts` |
| End + redemption | Sale can end; user redeems once | `test_endSale_and_claim`, `test_redeemCharms_reverts_before_end`, `test_double_redeem_reverts` |
| Redemption rounding | Integer redeem can be zero (tiny sale supply vs raised) | `test_redeemCharms_nothing_to_redeem_reverts` |
| Fees to router | Buy path pulls from buyer and routes via `FeeRouter` | `test_fees_routed_on_buy` |
| Same-block call order | Last-buyer podium reflects sequential buy order (Foundry single-tx context; aligns with tx-index ordering) | `test_sameBlock_buyOrder_lastBuyerReflectsSecondCall` |
| Podium payout liveness | Empty **podium pool** does **not** set `prizesDistributed`; funded pool can pay later | `test_distributePrizes_empty_vault_is_retryable`, `test_distributePrizes_dust_pool_is_retryable` |
| Podium payout happy path | Podium pool balance decreases after distribution; flag set | `test_distributePrizes_reduces_vault_and_sets_flag` |
| Constructor sanity | Non-zero asset, router, `launchedToken`, `podiumPool`, **`ICharmPrice`** | `test_constructor_zero_acceptedAsset_reverts`, `test_constructor_zero_feeRouter_reverts`, `test_constructor_zero_launchedToken_reverts`, `test_constructor_zero_podiumPool_reverts`, `test_constructor_zero_charmPrice_reverts` |
| Referral CHARM | Full gross to router; referee + referrer CHARM from `charmWad` | [`TimeCurveReferral.t.sol`](../../contracts/test/TimeCurveReferral.t.sol): `test_buy_with_referral_charms_and_full_gross_to_fee_router`, `test_buy_self_referral_reverts`, `test_buy_invalid_code_reverts` |
| Stateful raised + CHARM (invariant fuzz) | Ghost **asset** volume matches `totalRaised`; ghost **CHARM** volume matches `totalCharmWeight` | [`TimeCurveInvariant.t.sol`](../../contracts/test/TimeCurveInvariant.t.sol): `invariant_timeCurve_totalRaisedMatchesGhostBuys`, `invariant_timeCurve_totalCharmWeightMatchesGhostBuys` |

#### TimeCurve reserve podium + WarBow — required test coverage

Canonical definitions: [product/primitives.md](../product/primitives.md). Implementation: [`TimeCurve.sol`](../../contracts/src/TimeCurve.sol). Tests live in [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol).

**Last buy** — *Compete to be the last person to buy.*

- Verify the category tracks the final buyer correctly — `test_last_buyers_podium`, `test_last_buy_three_most_recent_rank_values`
- Verify leaderboard / ranking logic — `test_sameBlock_buyOrder_lastBuyerReflectsSecondCall`, `test_last_buy_three_most_recent_rank_values`
- Verify podium resolution — `test_last_buy_distribute_prizes_pays_first_place`, `test_round_settlement_four_categories_podium_payouts_smoke`

**Time booster** — *Tracks the most actual time added to the timer.*

- Score equals actual time added — `test_time_booster_score_matches_sum_of_deadline_deltas`, `test_time_booster_tracks_effective_seconds_not_nominal_when_clipped`
- Clipped time beyond cap does not count — `test_time_booster_zero_when_already_at_cap`
- Resets in / near the under-15-minute zone use actual timer increase — `test_time_booster_under_15m_window_uses_actual_seconds_added`
- Leaderboard ordering — `test_time_booster_leaderboard_orders_by_total_effective_seconds`

**WarBow Ladder (Battle Points)** — *PvP scoring; top-3 also receives the WarBow reserve slice in `distributePrizes`; steals use standalone txs.*

- Base BP flat per buy — `test_warbow_base_bp_flat_per_buy_independent_of_charm_wad`
- BP top-3 snapshot ordering — `test_warbow_ladder_podium_orders_by_battle_points`
- Timer hard reset + ambush stacking — `test_timer_hard_reset_below_13m_and_ambush_bonus`
- Steal path — `test_warbow_steal_drains_ten_percent_and_burns_one_reserve`, `test_warbow_steal_revert_2x_rule`, `test_warbow_steal_burn_is_one_cl8y_wad`
- Revenge — `test_warbow_revenge_once`

**Defended streak** — *Tracks how many times the same wallet resets the timer while it is under 15 minutes. The streak ends and is recorded when a second player buys under 15 minutes.*

- Active increments on same-wallet reset under 15m — `test_defended_streak_same_wallet_two_resets_under_15m_window`, `test_defended_streak_same_wallet_three_resets_under_15m`
- Continues across multiple under-15m resets — `test_defended_streak_same_wallet_three_resets_under_15m`
- Ends when a second player buys under 15m — `test_defended_streak_second_player_under_window_ends_first_active`
- Ended streak recorded on leaderboard (`bestDefendedStreak`) — `test_defended_streak_second_player_under_window_ends_first_active`, `test_defended_streak_podium_orders_by_best_streak`
- Active vs best behavior — `test_defended_streak_leaving_window_clears_active`, `test_defended_streak_no_increment_outside_15m_window`
- No progress from buys with ≥15 minutes remaining — `test_defended_streak_no_increment_outside_15m_window`
- Leaderboard ordering by recorded best — `test_defended_streak_podium_orders_by_best_streak`

**Integration / regression**

- Four-category settlement — `test_round_settlement_four_categories_podium_payouts_smoke`
- Podium ranking + payout resolution — `test_round_settlement_four_categories_podium_payouts_smoke`, `test_last_buy_distribute_prizes_pays_first_place`, `test_distributePrizes_reduces_vault_and_sets_flag`
- Indexer / API: `Buy` event fields and `idx_timecurve_buy` migration — [`indexer/tests/integration_stage2.rs`](../../indexer/tests/integration_stage2.rs), [`decoder` roundtrip_buy](../../indexer/src/decoder.rs)
- Core round flow unchanged — existing sale lifecycle, `endSale`, `redeemCharms`, fee routing tests in `TimeCurve.t.sol` / `TimeCurveReferral.t.sol` / `TimeCurveInvariant.t.sol`

### Non-standard ERC-20 (intentionally unsupported assets)

| Area | Tests | Notes |
|------|--------|--------|
| Fee-on-transfer | [`NonStandardERC20.t.sol`](../../contracts/test/NonStandardERC20.t.sol) `test_feeOnTransfer_timeCurve_buyReverts_distributeExpectsFullAmount` | `buy` reverts once `FeeRouter` cannot push full `amount`. |
| Reverting transfer | `test_alwaysRevert_feeRouter_distributeReverts`, `test_alwaysRevert_rabbitTreasury_depositReverts` | Griefing / bad token. |
| Blocked recipient | `test_blockedSink_feeRouter_distributeReverts` | Token reverts when paying a chosen sink. |
| Rebasing (stub) | `test_rebasing_treasury_balanceCanDesyncFromTotalReserves` | Balance can diverge from `totalReserves`. |

Mitigations and product stance: [security-and-threat-model.md — Implementation notes](../onchain/security-and-threat-model.md#implementation-notes-contract-hardening).

### RabbitTreasury and BurrowMath

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Epoch lifecycle | First epoch can be opened only once | `test_openFirstEpoch`, `test_openFirstEpoch_reverts_twice` |
| Epoch gating | Deposits require an open epoch | `test_deposit_no_epoch_reverts` |
| Deposit / withdraw | Non-zero deposit; withdraw bounded by balance | `test_deposit_basic`, `test_deposit_zero_reverts`, `test_withdraw_basic`, `test_withdraw_more_than_balance_reverts` |
| Mint/burn accounting (fuzz) | Random deposit/withdraw fractions preserve accounting | `test_deposit_withdraw_fuzz` |
| Stateful reserves + DOUB (fuzz) | `redeemableBacking + protocolOwnedBacking` equals ERC20 balance; `totalSupply` matches mint/burn ghost under mixed ops + fees + `finalizeEpoch` | [RabbitTreasuryInvariant.t.sol](../../contracts/test/RabbitTreasuryInvariant.t.sol): `invariant_rabbitTreasury_reservesMatchTokenBalance`, `invariant_rabbitTreasury_doubSupplyMatchesGhostMintBurn` |
| Fee split + redeemable isolation | `receiveFee` does not mint DOUB or add to redeemable; burn + protocol bucket accounting | `test_receiveFee`, `test_receiveFee_doesNotMintDoub_andDoesNotIncreaseRedeemable`, `test_burn_share_zero_sends_all_to_protocol_bucket` |
| Anti-leak (protocol bucket) | Users cannot redeem against protocol-owned CL8Y as if it were deposited | `test_protocolOwned_notExtracted_viaOrdinaryWithdraw`, `test_stress_manyUsersExit_protocolBucketUntouched` |
| Stress repricing vs exit | After bullish `e`, full redemption can be below nominal (pro-rata + efficiency) | `test_repricingRaisesLiability_redemptionBelowNominal` |
| Redemption cooldown | Optional epochs between withdrawals per address | `test_redemptionCooldown_blocks_consecutive_withdraws` |
| Finalize timing | Cannot finalize before `epochEnd` | `test_finalizeEpoch_too_early_reverts` |
| Repricing path | Finalize applies BurrowMath step; empty supply edge case | `test_finalizeEpoch_repricing`, `test_finalizeEpoch_no_supply` |
| Chained epochs | Finalize advances `epochId` and can run again next window | `test_finalizeEpoch_can_run_twice_advances_epoch` |
| Fee receiver role | Only fee router can push fees | `test_receiveFee`, `test_receiveFee_unauthorized_reverts`, `test_receiveFee_zero_reverts` |
| Pause | Paused state blocks deposit; unpause restores | `test_pause_blocks_deposit`, `test_unpause_allows_deposit` |
| Parameter governance | Burrow params update emits event; unauthorized reverts | `test_params_update_emits_event`, `test_params_update_unauthorized_reverts`, `test_setMBounds_invalid_reverts` |
| Coverage / multiplier bounds | `C` clipped; `m ∈ [m_min, m_max]` | `BurrowMath.t.sol`: `test_coverage_clips_high`, `test_multiplier_bounds_fuzz`, `test_epoch_invariants_fuzz` |
| Numeric parity with sims | One epoch matches Python reference | `test_matches_python_reference_epoch` |

### FeeMath and FeeRouter

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Stateful accounting (fuzz) | Router balance and sink totals match funded vs distributed under random `fund`/`distribute` sequences | [FeeRouterInvariant.t.sol](../../contracts/test/FeeRouterInvariant.t.sol): `invariant_feeRouter_routerBalanceMatchesGhost`, `invariant_feeRouter_sinksSumEqualsDistributed` |
| Weights sum to 10_000 | Library + router reject bad sums | `FeeMath.t.sol`: `test_validateWeights_canonical_split`, `test_validateWeights_reverts_wrong_sum`, `test_validateWeights_reverts_single_overflow`; `FeeRouter.t.sol`: `test_updateSinks_invalid_sum_reverts`, `test_weights_sum_invariant` |
| BPS share basics | Integer division and rounding-down behavior | `test_bpsShare_basic`, `test_bpsShare_rounding_down` |
| BPS split no overallocation | Sum of shares ≤ amount (fuzz) | `test_bpsShare_no_overallocation_fuzz` |
| Non-zero distribution | Zero total amount reverts | `test_distributeFees_zero_reverts` |
| Sufficient balance | Cannot distribute more than router holds | `test_distributeFees_insufficient_balance_reverts` |
| Remainder to last sink | No dust stuck in router | `test_distributeFees_remainder_to_last_sink`, `test_no_dust_fuzz` |
| Canonical 25/35/20/0/20 split | Matches governance doc | `test_distributeFees_canonical_split` |
| Governance on sinks | `updateSinks` happy path + auth + zero address | `test_updateSinks`, `test_updateSinks_unauthorized_reverts`, `test_updateSinks_zero_address_reverts` |

Align fee expectations with [post-update invariants](../onchain/fee-routing-and-governance.md#post-update-invariants).

### DoubPresaleVesting

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Total matches constructor | `sum(amounts) == requiredTotalAllocation` | `test_constructor_reverts_totalMismatch`, `test_canonical_presale_total_accepted` |
| Unique non-zero beneficiaries | Duplicate or `address(0)` reverts | `test_constructor_reverts_duplicateBeneficiary`, `test_constructor_reverts_zeroBeneficiary` |
| Positive allocations & duration | Zero amount or `vestingDuration == 0` reverts | `test_constructor_reverts_zeroAllocation`, `test_constructor_reverts_zeroDuration` |
| Array sanity | `beneficiaries.length == amounts.length`; zero token reverts | `test_constructor_reverts_lengthMismatch`, `test_constructor_reverts_zeroToken` |
| Single funded start | `startVesting` requires balance ≥ `totalAllocated`; no second start | `test_startVesting_underfunded_reverts`, `test_startVesting_twice_reverts` |
| Cliff + linear schedule | **30%** at `vestingStart`; **70%** linear by `mulDiv` over `vestingDuration`; full at end | `test_vestedAt_cliff_is_30_percent`, `test_vestedAt_mid_linear`, `test_vestedAt_end_is_full_allocation` |
| Claims | Non-beneficiary / before start / zero claim revert; lifecycle drains contract | `test_claim_nonBeneficiary_reverts`, `test_claim_beforeStart_reverts`, `test_claim_nothing_reverts`, `test_claim_full_lifecycle` |
| Enumerable set | `beneficiaryCount`, `isBeneficiary`, distinct `beneficiaryAt` | `test_enumeration_contains_all` |
| Vested monotone in time (fuzz) | `t1 ≤ t2 ⇒ vested(t1) ≤ vested(t2)` | `test_fuzz_vested_monotonic` |
| Vested ≤ allocation (fuzz) | For all `t`, `vested ≤ allocation` | `test_fuzz_vested_lte_allocation` |
| Token conservation (fuzz) | `balance(vesting) + sum(claimed) == totalAllocated` after claims | `test_fuzz_multi_claim_bounded` |

### FeeSink and PodiumPool

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Sink withdraw | Only `WITHDRAWER_ROLE`; `to != address(0)` | `FeeSinks.t.sol`: `test_feeSink_withdraw_happy_path`, `test_feeSink_withdraw_unauthorized_reverts`, `test_feeSink_withdraw_zero_to_reverts` |
| Podium payout | Only `DISTRIBUTOR_ROLE`; `winner != address(0)` | `test_podiumPool_payPodiumPayout_happy_path`, `test_podiumPool_payPodiumPayout_unauthorized_reverts`, `test_podiumPool_payPodiumPayout_zero_winner_reverts` |

### LeprechaunNFT

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Mint path | Authorized mint stores owner + traits | `test_mint_basic`, `test_traits_stored_onchain` |
| Supply cap | Mint count ≤ series max | `test_series_max_supply_enforced`, `test_series_mint_count_fuzz` |
| Series validity | Zero-supply series rejected; mint only for active series | `test_createSeries_zero_supply_reverts`, `test_inactive_series_reverts` |
| Access control | Only minter role mints | `test_mint_unauthorized_reverts` |
| Metadata admin | Base URI can be set by role | `test_setBaseURI` |

### Cross-contract dev wiring (~75% smoke)

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Epoch + sale ready after deploy | `currentEpochId == 1`, `saleStart > 0`, sane deadline | `DevStackIntegration.t.sol`: `test_devStack_epochAndSaleActive` |
| End-user flows | Deposit + TimeCurve buy succeed with correct token approvals (buyer approves **TimeCurve** on sale asset) | `test_devStack_depositAndBuy` |

### Indexer (Rust)

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Decode round-trip | Canonical Solidity events → internal `DecodedEvent` (TimeCurve **`Buy`** includes `charmWad`, `pricePerCharmWad`) | `decoder::tests`: `roundtrip_sale_started`, `roundtrip_buy`, `roundtrip_health_epoch_finalized`, `roundtrip_reserve_balance_negative_delta`, `roundtrip_minted` |
| Chain pointer JSON | Serialize / parse block hash hex | `reorg::tests`: `parse_b256_hex_accepts_prefixed_hash`, `parse_b256_hex_rejects_garbage`, `pointer_json_roundtrip` |
| Ingestion cursor | Next block after genesis / tip | `ingestion::ingestion_tests`: `next_block_genesis_sentinel_uses_effective_start`, `next_block_after_indexed_tip_is_plus_one` |
| Persist coverage + idempotency | Every `DecodedEvent` variant inserts; `ON CONFLICT DO NOTHING` | `tests/integration_stage2.rs` (`postgres_stage2_persist_all_events_and_rollback_after`, with `YIELDOMEGA_PG_TEST_URL` set) |
| Reorg rollback | Rows with `block_number > ancestor` removed; pointer reset | Same integration test (`rollback_after` path) |
| HTTP API | `/healthz`, `/v1/status`, list routes, `user` query validation (`400` when malformed), `x-schema-version` header | Same file, `api_http_smoke` after persist/reorg (requires Postgres URL) |

### Frontend (Playwright)

| Behavior | Tests (`frontend/e2e/*.spec.ts`) |
|----------|-----------------------------------|
| Shell + routes | Home heading, primary nav links, `/timecurve`, `/rabbit-treasury`, `/collection` render `main.app-main` |
| Navigation | Primary nav clicks reach expected URLs |

CI: `playwright-e2e` job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) (`workers` up to **20** when `CI=true`; Playwright may use fewer workers if the suite has fewer tests). Local: `npm run build && npm run test:e2e` after `npx playwright install --with-deps` (Linux) or `npx playwright install chromium` (minimal).

### Frontend (Vitest)

| Behavior | Tests |
|----------|--------|
| Valid `0x` + 40 hex; trim whitespace | `addresses.test.ts`: `accepts valid 0x + 40 hex`, `trims whitespace` |
| Reject bad input | `rejects wrong length, missing prefix, and non-hex` |
| Indexer URL normalization | `strips trailing slash and empty` |
| Chain id / RPC defaults | `chain.test.ts`: finite positive id, bad env falls back, default RPC |
| Rabbit deposits API path | `indexerApi.test.ts`: `encodeURIComponent` on `user` query |

### Python simulations (Stage 1 scope)

| Module | What it checks | Test names |
|--------|----------------|------------|
| `test_model.py` | Clip, coverage bounds, epoch step invariants, multiplier saturation, NaN freedom | `test_clip`, `test_coverage_bounds`, `test_epoch_step_invariants`, `test_multiplier_saturates`, `test_no_nan_after_many_steps` |
| `test_scenarios.py` | Bundled scenario expectations | `test_all_scenarios_pass` |
| `test_timecurve.py` | Legacy **sim** min-buy curve (exponential daily); does **not** yet model split **linear price × CHARM envelope** (track as sim gap vs [product/primitives.md](../product/primitives.md)) | `test_min_buy_monotone`, `test_daily_growth_20_percent`, `test_next_sale_end_cap`, `test_clamp_spend_continuous` |
| `test_comeback.py` | Comeback scoring caps and baseline | `test_comeback_caps_trailing`, `test_leader_stays_high_baseline` |

See [simulations/README.md](../../simulations/README.md) for run commands and pass/fail criteria. The **`simulations-test`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) runs this suite on every push/PR.

---

## Contract test suite inventory

Every `contracts/test/*.t.sol` test function maps to the invariant tables above. Quick index by file:

| File | Count | Focus |
|------|------:|--------|
| [TimeMath.t.sol](../../contracts/test/TimeMath.t.sol) | 7 | Pure math: exponential envelope factor (`currentMinBuy`), deadline cap |
| [LinearCharmPrice.t.sol](../../contracts/test/LinearCharmPrice.t.sol) | 3 | Linear `priceWad` formula + monotonicity **fuzz**, zero-base revert |
| [TimeCurve.t.sol](../../contracts/test/TimeCurve.t.sol) | — | Sale lifecycle, **CHARM bounds + linear price**, buys, fees, podiums, redemption, **same-block ordering**, constructor / griefing paths |
| [TimeCurveInvariant.t.sol](../../contracts/test/TimeCurveInvariant.t.sol) | 2 | Foundry **invariant** handlers: `totalRaised` ghost, `totalCharmWeight` ghost |
| [TimeCurveFork.t.sol](../../contracts/test/TimeCurveFork.t.sol) | 1 | Optional `FORK_URL` fork smoke (no-op if unset) |
| [BurrowMath.t.sol](../../contracts/test/BurrowMath.t.sol) | 4 | Coverage clip, multiplier/epoch fuzz, Python parity |
| [RabbitTreasury.t.sol](../../contracts/test/RabbitTreasury.t.sol) | 29 | Epochs, deposit/withdraw, finalize, pause, fee split/burn, bucket anti-leak, cooldown, stress exits, repricing vs redemption |
| [RabbitTreasuryInvariant.t.sol](../../contracts/test/RabbitTreasuryInvariant.t.sol) | 2 | Foundry **invariant** handlers: reserves vs balance, DOUB supply vs mint/burn |
| [FeeMath.t.sol](../../contracts/test/FeeMath.t.sol) | 6 | Weight validation, BPS shares |
| [FeeRouter.t.sol](../../contracts/test/FeeRouter.t.sol) | 10 | Distribution, dust, **insufficient balance**, governance |
| [FeeRouterInvariant.t.sol](../../contracts/test/FeeRouterInvariant.t.sol) | 2 | Foundry **invariant** handlers: router ledger + sink totals |
| [FeeSinks.t.sol](../../contracts/test/FeeSinks.t.sol) | 6 | `FeeSink` withdraw access + zero `to`; `PodiumPool.payPodiumPayout` auth + zero winner |
| [NonStandardERC20.t.sol](../../contracts/test/NonStandardERC20.t.sol) | 5 | Fee-on-transfer, revert-all, blocked sink, rebasing stub vs treasury |
| [LeprechaunNFT.t.sol](../../contracts/test/LeprechaunNFT.t.sol) | 8 | Series, mint, supply cap, URI |
| [DevStackIntegration.t.sol](../../contracts/test/DevStackIntegration.t.sol) | 2 | Deploy script wiring + buy/deposit |
| [DoubPresaleVesting.t.sol](../../contracts/test/DoubPresaleVesting.t.sol) | 21 | Presale DOUB vesting: constructor validation, cliff + linear schedule, claims, enumeration, **fuzz** (monotone, cap, multi-claim conservation) |

Run `cd contracts && forge test --list` for the authoritative list including fuzz parametrization (recent full run: **126** tests with `FOUNDRY_PROFILE=ci` before `DoubPresaleVesting`; re-count after adding new suites). **Invariant** runs and depth are configured in [`contracts/foundry.toml`](../../contracts/foundry.toml) (`[invariant]`). **Local Anvil ordering drill:** [anvil-same-block-drill.md](anvil-same-block-drill.md).

---

## Gaps and non-goals (explicit)

- **Stage 2 wallet-signed txs** remain manual + run log per [stage2-run-log.md](../operations/stage2-run-log.md); **Playwright** in CI covers static UI smoke only (no wallet signing).
- **Live Anvil reorg** against a running indexer is optional; DB rollback is covered in integration tests.
- **~90% / 100%** (testnet verification, soak, mainnet, audit) are **operator gates** outside automated CI; see [stage3-mainnet-operator-runbook.md](../operations/stage3-mainnet-operator-runbook.md).
- **Foundry invariant tests** ([`FeeRouterInvariant.t.sol`](../../contracts/test/FeeRouterInvariant.t.sol), [`RabbitTreasuryInvariant.t.sol`](../../contracts/test/RabbitTreasuryInvariant.t.sol), [`TimeCurveInvariant.t.sol`](../../contracts/test/TimeCurveInvariant.t.sol)) complement unit/fuzz tests; they do **not** replace multi-tx builder simulation on a live chain.
- **Same-block ordering / MEV** on podiums and timer: **accepted by design** (deterministic ordering). Unit coverage: `test_sameBlock_buyOrder_lastBuyerReflectsSecondCall`; **local multi-tx drill:** [anvil-same-block-drill.md](anvil-same-block-drill.md). True builder-bundle semantics differ; see [security threat model — TimeCurve](../onchain/security-and-threat-model.md#timecurve-specific).
- **Fork smoke** ([`TimeCurveFork.t.sol`](../../contracts/test/TimeCurveFork.t.sol)): optional with `FORK_URL`; default CI does not set it (test no-ops). Policy and optional **`contract-fork-smoke`** workflow: [contract-fork-smoke.md](contract-fork-smoke.md).
- **Fee-on-transfer / rebasing / malicious transfer** behavior and mitigations: [security threat model — Implementation notes](../onchain/security-and-threat-model.md#implementation-notes-contract-hardening); mocks in [`contracts/test/mocks/`](../../contracts/test/mocks/) and [`NonStandardERC20.t.sol`](../../contracts/test/NonStandardERC20.t.sol).

---

**Related:** [testing strategy](strategy.md) · [CI mapping](ci.md) · [agent implementation phases](../agent-implementation-phases.md)
