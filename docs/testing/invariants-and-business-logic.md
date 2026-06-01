# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Player vs contributor aids:** Root [`skills/`](../../skills/) holds **play** skills (participation). Maintainer **manual QA** lives in [manual-qa-checklists.md](manual-qa-checklists.md).

**Authoritative rules live onchain**; the indexer and frontend are derived read models ([architecture/overview.md](../architecture/overview.md)).

**Arena v2 product spec:** [`docs/product/arena-v2.md`](../product/arena-v2.md) · Epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Retired v1 launchpad, treasury, NFT, and CL8Y fee-split stacks — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). Bulk removal of legacy invariant sections: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263). Satellite doc cleanup (operator/QA/agent paths): [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274) · verify links: `bash scripts/check-doc-anchors.sh` · retired v1 term gate: `bash scripts/check-doc-retired-terms.sh`.

<a id="arena-v2-play-skills-gitlab-245"></a>

## Arena v2 play skills & bot paths (GitLab [#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-245-PLAY-SKILLS`** | Root [`skills/README.md`](../../skills/README.md) indexes **`play-active-time-arena`**, **`play-time-arena-doub`**, **`play-time-arena-warbow`**, **`script-with-timearena-local`** only (legacy `play-timecurve-*` removed) | `skills/play-*-time-arena*/SKILL.md`, grep absence of `play-timecurve-doubloon` |
| **`INV-DOCS-245-GUARDRAILS`** | [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) references Arena v2 onchain authority + [`skills/README.md`](../../skills/README.md) play index | manual review |
| **`INV-DOCS-245-PHASE20`** | [`docs/agent-phases.md`](../agent-phases.md) Phase 20 prompt names Time Arena play skills + [`docs/product/time-arena.md`](../product/time-arena.md) | `grep play-time-arena agent-phases.md` |
| **`INV-BOTS-245-TIMEARENA`** | Bot package at [`bots/timearena/`](../../bots/timearena/README.md); env **`YIELDOMEGA_TIME_ARENA_ADDRESS`**; `inspect` reads **`TimeArena.doub()`** / **`arenaStart`** / **`paused`** (not legacy `saleStart` / `acceptedAsset`) | `bots/timearena/tests/`, `bash scripts/sync-bot-env-from-frontend.sh` |
| **`INV-BOTS-245-ENV-SYNC`** | `scripts/sync-bot-env-from-frontend.sh` maps **`VITE_TIME_ARENA_ADDRESS`** → bot env (no Rabbit/Leprechaun required) | script + `frontend/.env.example` |

<a id="satellite-docs-gitlab-274"></a>

## Satellite docs — retired v1 terms (GitLab [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-274-RETIRED-TERMS`** | Operator/agent paths (`docs/qa/`, `docs/agent-phases.md`, `docs/agent-implementation-phases.md`, `docs/testing/qa-local-full-stack.md`) contain **no** `VITE_FEE_ROUTER`, `FeeRouter.distributeFees`, `TimeCurve.endSale`, `redeemCharms`, or `idx_timecurve` | `bash scripts/check-doc-retired-terms.sh` (CI **`scripts-smoke`** job) |
| **`INV-DOCS-274-QA-ONBOARDING`** | [`docs/qa/QA-onboarding-gitlab-issue-body.md`](../qa/QA-onboarding-gitlab-issue-body.md) describes **`/arena`**, `bots/timearena`, **`VITE_TIME_ARENA_ADDRESS`** — not TimeCurve page / FeeRouter panel | manual review |
| **`INV-DOCS-274-INDEXER-DESIGN`** | [`docs/indexer/design.md`](../indexer/design.md) documents **`idx_arena_*`** + **`GET /v1/arena/*`** only; no active **`GET /v1/timecurve/*`** | grep + [`decoder.rs`](../../indexer/src/decoder.rs) |

Cross-links: [`docs/testing/strategy.md`](strategy.md) · [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) · [`skills/README.md`](../../skills/README.md).

Cross-links: [`bots/timearena/README.md`](../../bots/timearena/README.md) · [`skills/script-with-timearena-local/SKILL.md`](../../skills/script-with-timearena-local/SKILL.md) (local stack env hygiene).


## ~75% (Stage 2) verification

Per [agent-implementation-phases.md](../agent-implementation-phases.md), **~75%** means the **Stage 2 exit checklist** in [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration) is satisfied.

| Gate | Evidence |
|------|----------|
| Stage 1 automated tests green | Run commands below; CI: [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml). |
| Devnet integration recorded | [operations/stage2-run-log.md](../operations/stage2-run-log.md). |
| Reorg / rollback path | `indexer/tests/integration_stage2.rs` + CI Postgres + `YIELDOMEGA_PG_TEST_URL`. |

---

<a id="timearena-v2-gitlab-260"></a>

## TimeArena v2 (GitLab [#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260))

Authoritative product rules: [`docs/product/time-arena.md`](../product/time-arena.md) · [`docs/product/arena-v2.md`](../product/arena-v2.md). Parent epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). **Manual QA:** [Arena v2 QA checklist](manual-qa-checklists.md#manual-qa-issue-260) · [XP gas §265](manual-qa-checklists.md#manual-qa-issue-265) · [CRED buy §268](manual-qa-checklists.md#manual-qa-issue-268) · **Anvil E2E:** [e2e-anvil.md](e2e-anvil.md).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-ROUTE-SPLIT`** | 40% active + 30% seed + 30% admin per DOUB buy; **no** retired v1 five-sink CL8Y burn/LP routing ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)); rounding remainder → admin ([#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249)) | [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol), `TimeArena.t.sol::test_buy_routes_doub_split` · [fee-routing](../onchain/fee-routing-and-governance.md) |
| **`INV-ADMIN-SELL-VAULT-249`** | `sellDoubToUsdm(minOut)` is **`onlyOwner`**; swaps full DOUB balance via configured router; USDM to **`adminAccount`** | [`AdminSellVault.t.sol`](../../contracts/test/AdminSellVault.t.sol) (mock `exactInputSingle` + [`AnvilMockUSDM`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol)) · [#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249) |
| **`INV-TIME-ARENA-TIMER-EXTEND`** | Qualifying buy adds **+120s** when not in hard-reset band | `test_timer_extension_without_hard_reset`, `TimeMath.t.sol::testFuzz_extendDeadlineOrReset_arenaProfile` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)) |
| **`INV-TIME-ARENA-TIMER-HARD-RESET`** | Under **13m** remaining → **900s** reset; **`lastBuyEpoch`** increments; emits **`LastBuyEpochStarted`** | `test_timer_hard_reset_increments_epoch`, `test_emits_LastBuyEpochStarted_on_hard_reset`, `TimeMath.t.sol::test_extendDeadlineOrReset_*` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)) |
| **`INV-TIME-ARENA-TIMER-MULTI`** | One buy extends **all four** `podiumDeadline[i]` by **category-specific** extension (+120 / +60 / +90 / +300) | `test_multi_podium_deadline_extend` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) |
| **`INV-TIME-ARENA-PODIUM-TIMER-PARAMS`** | Per-category `podiumTimerExtensionSec`, `podiumInitialTimerSec`, cap, hard-reset bands match product table; `startArena` seeds distinct deadlines | `test_start_arena_initial_deadlines_differ_by_category`, `test_time_booster_hard_reset_band_240_to_300` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) · [detail §271](#timearena-podium-timers-gitlab-271) · `bash scripts/verify-podium-timers-anvil.sh` |
| **`INV-TIME-ARENA-SCORING-LAST-BUY-TIMER`** | Time Booster / Defended Streak / WarBow BP scoring uses **Last Buy (cat 0)** timer only, not other podium bands | `test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer`, `test_defended_streak_uses_last_buy_timer_not_other_podium` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) · [detail §271](#timearena-podium-timers-gitlab-271) |
| **`INV-TIME-ARENA-PODIUM-ROLL`** | `rollPodiumEpoch(cat)` after expiry; epoch bump; pays winners; clears scores | `test_roll_podium_after_expiry`, `test_roll_podium_settlement_pays_and_clears_scores` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-PODIUM-DIVERGE`** | Per-category rolls reset one `podiumDeadline[cat]`; timers diverge across Streak / Booster / WarBow / Last Buy | `test_podium_timers_diverge_after_single_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-PODIUM-EPOCH-INDEP`** | `podiumEpoch[cat]` counters advance independently | `test_podium_epochs_independent_after_skewed_rolls` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-LAST-BUY-EPOCH`** | `lastBuyEpoch` bumps on Last Buy **hard reset** only (CHARM/CRED), not on other podium rolls | `test_timer_hard_reset_increments_epoch`, `test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-CRED-ACCRUE`** | DOUB buy adds **35 CRED** (18 dec) to epoch pool | `test_cred_accrue_on_doub_buy` |
| **`INV-TIME-ARENA-CRED-CLAIM`** | `claimCred(epoch)` pro-rata by `epochCharmWad`; zeros weight; no double-claim | `test_cred_pro_rata_claim`, `test_cred_pro_rata_exact_1_2_split`, `test_claimCred_cannot_double_claim` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |
| **`INV-TIME-ARENA-CRED-BURN-BUY`** | `buyWithCred` burns **100 CRED** per 1e18 CHARM (`CRED_PER_CHARM_WAD`); same CHARM min/max band | `test_buy_with_cred`, `test_buyWithCred_10charm_burns_1000_cred`, `test_buyWithCred_min_charm_burns_scaled`, `test_buyWithCred_reverts_charm_bounds` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248), [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) · [detail §268](#timearena-cred-buy-gitlab-268) · `bash scripts/verify-cred-buy-anvil.sh` |
| **`INV-PLAY-CRED-NON-TRANSFER`** | `PlayCred` mint/burn only; wallet transfer reverts | [`PlayCred.t.sol`](../../contracts/test/PlayCred.t.sol) ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |
| **`INV-TIME-ARENA-FIRST-BUY-CRED-BONUS`** | First `_finishBuy` per wallet schedules **150 CRED** for **`lastBuyEpoch + 1`** (post-reset); not repeated; survives epoch roll | `test_first_buy_doub_schedules_bonus`, `test_first_buy_cred_schedules_bonus_once`, `test_claim_cred_bonus_only_no_charm`, `test_first_buy_hard_reset_targets_post_epoch`, `test_first_buy_flag_survives_epoch_roll` ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) · [detail §268](#timearena-cred-buy-gitlab-268) |
| **`INV-TIME-ARENA-XP`** | XP 1–10 linear in CHARM band; level steps per `ArenaXp`; uncapped level; `XpGained` event | `ArenaXp.t.sol::test_level_thresholds_*`, `test_xpForCharm_*`, `TimeArena.t.sol::test_xp_levels`, `test_xp_emits_XpGained` ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250)) |
| **`INV-TIME-ARENA-XP-GAS`** | Cached **`level`** + **`xpTowardNext`**; ≤5 level-ups/buy; no reset on epoch; O(1) views; matches `levelFromXp` after each buy | `ArenaXp.t.sol`, `TimeArena.t.sol::test_xp_*` ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)) · [manual QA §265](manual-qa-checklists.md#manual-qa-issue-265) · [detail §265](#timearena-xp-gas-gitlab-265) |
| **`INV-TIME-ARENA-WARBOW-DOUB`** | WarBow spends are DOUB pulls (steal 1000 / guard 10000 / override 50000 / revenge 1000; flag claim 0) | `test_warbow_steal_pulls_doub`, `test_warbow_guard_pulls_doub`, `test_warbow_revenge_pulls_doub`, `test_warbow_steal_limit_override_pulls_doub`, `test_warbow_flag_claim_zero_doub` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)) |
| **`INV-TIME-ARENA-WARBOW-EPOCH-RESET`** | WarBow `rollPodiumEpoch` clears live BP (`warbowBpGeneration` bump) and podium; does **not** auto-pay (admin `finalizeWarbowPodium(epoch, …)` pays retained pool) | `test_warbow_epoch_roll_clears_battle_points`, `test_finalize_warbow_podium_pays_after_roll` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)) |
| **`INV-TIME-ARENA-ALWAYS-LIVE`** | No sale-end or charm-redemption gates; only `paused` | `TimeArena.sol` + negative grep in arena contracts |
| **`INV-REMOVAL-243-NO-LAUNCHPAD-LIFECYCLE`** | No retired v1 launchpad cores (`TimeCurve`, `LinearCharmPrice`), sale-end / charm-redemption / prize-distribution gates, or `/vesting` route; **`DoubPresaleVesting`** may deploy but is not wired through a sale lifecycle | `rg` clean in `contracts/src`; no `PresaleVestingPage`; `LaunchGate.tsx` routes; [`surfaceContent.ts`](../../frontend/src/lib/surfaceContent.ts) → `/arena` ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)) |
| **`INV-FRONTEND-256-UNIFIED-ARENA`** | Unified **`/arena`**: Last Buy hero + 3 secondary timer chips; DOUB-primary pay toggles (DOUB/ETH/USDM/CRED); four podium cards with epoch + rankings; WarBow hero with onchain DOUB cost labels; BUY/AUDIT sub-nav only ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)) | `ArenaTimerChips.test.tsx`, [`arenaPayTokenOptions.ts`](../../frontend/src/lib/arenaPayTokenOptions.ts) (DOUB-primary labels), `e2e/anvil-arena-01-mount.spec.ts`, `e2e/anvil-arena-*.spec.ts` · [arena-views § unified](../frontend/arena-views.md#unified-arena-page-gitlab-256) |
| **`INV-FRONTEND-260-ARENA-MOUNT`** | `/arena` mounts timer chips + CRED card + WarBow hero + podiums | `e2e/anvil-arena-01-mount.spec.ts` |
| **`INV-FRONTEND-269-CRED-BUY`** | Arena buy picker includes CRED when `playCred` set; burn preview from onchain constants; submit `buyWithCred` | `arenaCredBurn.test.ts`, `e2e/anvil-arena-04-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| **`INV-FRONTEND-257-CHARM-CRED-CARD`** | **`ArenaCharmCredCard`**: shows **`lastBuyEpoch`**, current-epoch **`epochCharmWad`**, accruing **`pendingCred`**; **Claim CRED** calls **`claimCred(lastBuyEpoch - 1)`** when ended epoch has pending (not active epoch — requires **`epoch < lastBuyEpoch`**); empty states per [#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200) | `arenaCharmCredClaim.test.ts`, `e2e/anvil-arena-02-onchain-reads.spec.ts` ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)) · [arena-views § charm-cred](../frontend/arena-views.md#charm-cred-card-gitlab-257) |
| **`INV-INDEXER-260-ARENA-TIMERS`** | `GET /v1/arena/timers` (+ buys) | `integration_stage2.rs::api_http_smoke` |
| **`INV-INDEXER-255-WALLET-STATS`** | `GET /v1/arena/wallet/{address}/stats` — full participant profile aggregates (no stub zeros); schema **≥ 2.4.0** | `arena_wallet_stats.rs`, `integration_stage2.rs::arena_wallet_stats_two_epochs_and_bonus_fields` ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)) |
| **`INV-INDEXER-260-NO-TIMECURVE-DECODE`** | No legacy sale `DecodedEvent` variants; Arena + referral registry only | `decoder.rs`, `integration_stage2.rs::postgres_stage2_persist_all_events_and_rollback_after` |
| **`INV-INDEXER-254-ARENA-SCHEMA`** | Fresh DB: `idx_arena_buy`, `idx_arena_podium_epoch`, view `idx_arena_podium_snapshot`, `idx_play_cred_claim`, `idx_player_xp`, `idx_warbow_epoch_score`; no TimeCurve-only buy tables; `GET /v1/arena/{timers,podiums,buys}`; WarBow BP snapshots on BP-affecting logs; schema **≥ 2.5.0** | `20240601000000_arena_v2.up.sql`, `integration_stage2.rs` ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)) |
| **`INV-INDEXER-PODIUM-PREDICT-LIVE`** | `GET /v1/arena/podiums`: UX order; head epochs; live top-3 from `idx_arena_podium_live` + WarBow scores; `podium_prediction` true only when DB-derived; ingest snapshots on Buy/WarBow/epoch events; reorg clears live table; **`chain_timer`** uses `podiumDeadline(uint256)` / `podiumEpoch(uint256)` array getters (not `uint8`) | `arena_podium_live.rs`, `chain_timer.rs`, `integration_stage2.rs::arena_podiums_live_predictions_smoke`, `bash scripts/verify-podium-live-anvil.sh` ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) · [design § podiums](../indexer/design.md#timecurve-podiums-http) · [detail §273](#indexer-live-podium-predictions-gitlab-273) |
| **`INV-TIME-ARENA-PODIUM-TOPUP`** | `topUpPodiumPools` sends 100% of DOUB to eight prize vaults (10:7.5 active:seed per category); **no** admin take; **no** `totalDoubRaised` bump | `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*` |
| **`INV-INDEXER-262-DONATE-POOLS`** | `PodiumPoolsToppedUp` → `idx_arena_podium_pool_top_up`; `GET /v1/arena/podium-pool-donations` | `integration_stage2.rs` |
| **`INV-FRONTEND-262-DONATE-POOLS`** | AUDIT card disclosure + indexer empty/offline placeholders + write gate | `ArenaProtocolDonatePoolsSection.test.tsx`, `e2e/arena.spec.ts` |
| **`INV-FRONTEND-258-WALLET-PROFILE`** | Participant **`AddressInline`** on live buy rows + podium winners opens profile modal (`onOpenProfile`); explorer link only inside modal; modal renders all stats sections from **`GET /v1/arena/wallet/{address}/stats`** | `LiveBuyRow.test.tsx`, `ArenaLiveBuysActivitySection.test.tsx`, `ArenaSimplePodiumSection.test.tsx`, `WalletProfileModalSections.test.tsx` ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)) · [arena-views § wallet-profile](../frontend/arena-views.md#wallet-profile-modal-gitlab-258) |
| **`INV-INDEXER-267-VAULT-FUNDING`** | `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` → `idx_arena_vault_funding`; sum per `tx_hash` = `doub_paid` for DOUB buys; CRED buys have zero funding rows | `integration_stage2.rs` (`api_vault_funding_smoke`) |
| **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** | Arena routes gate writes on **`TimeArena.paused`** only (not `buyFeeRoutingEnabled`); DOUB direct **`buy`** + ETH/USDM **`TimeArenaBuyRouter.buyViaKumbaya`** when router set; env router mismatch fail-closed ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)) | `kumbayaRoutes.test.ts`, `arenaV2SaleSessionBridge.test.ts`, `e2e/anvil-arena-03-wallet-writes.spec.ts` (DOUB + ETH when Kumbaya env set) · see [§264](#arena-frontend-pay-pause-gitlab-264) |
| **`INV-FRONTEND-266-ARENA-ROUTES`** | Canonical play at `/arena`, AUDIT at `/arena/protocol`; `/arena/*` redirects; env requires `VITE_TIME_ARENA_ADDRESS` only | `LaunchGate.tsx`, `scripts/check-frontend-vite-env.sh`, `e2e/navigation.spec.ts` |
| **`INV-FRONTEND-266-ARENA-INDEXER`** | Browser reads use **`/v1/arena/*`** only; no **`/v1/timecurve/*`** or legacy WarBow HTTP | `indexerApi.test.ts` (#266 retirement), `indexer/src/api_arena.rs` |

<a id="timearena-cred-buy-gitlab-268"></a>

### TimeArena CRED buy + first-buy bonus (GitLab [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268))

Parent: [#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248) (Play CRED). Onchain: [`TimeArena._buyCred`](../../contracts/src/arena/TimeArena.sol), [`TimeArena._finishBuy`](../../contracts/src/arena/TimeArena.sol). Product: [arena-v2 § CRED buy](../product/arena-v2.md) · [time-arena](../product/time-arena.md). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Manual QA: [§268](manual-qa-checklists.md#manual-qa-issue-268). Anvil smoke: `bash scripts/verify-cred-buy-anvil.sh`.

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-CRED-BURN-SCALE`** | `credBurn = mulDiv(charmWad, CRED_PER_CHARM_WAD, WAD)`; reverts on zero burn / insufficient balance | `test_buy_with_cred`, `test_buyWithCred_10charm_burns_1000_cred`, `test_buyWithCred_min_charm_burns_scaled`, `test_buyWithCred_reverts_insufficient_cred` |
| **`INV-TIME-ARENA-CRED-BURN-BOUNDS`** | Same **0.99–10** CHARM band as DOUB buys | `test_buyWithCred_reverts_charm_bounds` |
| **`INV-TIME-ARENA-CRED-NO-POOL`** | CRED path accrues epoch CHARM weight only; **no** `epochCredPool` / DOUB routing | `test_buy_with_cred`, `test_cred_accrue_on_doub_buy` (contrast) |
| **`INV-TIME-ARENA-FIRST-BUY-SCHEDULE`** | `buyCount == 0` before increment → `epochFixedCredBonus[lastBuyEpoch+1] += 150e18`; emits **`FirstBuyCredScheduled`** | `test_first_buy_doub_schedules_bonus`, `test_first_buy_cred_schedules_bonus_once`, `test_second_buy_no_additional_bonus` |
| **`INV-TIME-ARENA-FIRST-BUY-EPOCH`** | Hard-reset in same tx uses **post-reset** `lastBuyEpoch + 1`; flag not reset on epoch roll | `test_first_buy_hard_reset_targets_post_epoch`, `test_first_buy_flag_survives_epoch_roll` |
| **`INV-TIME-ARENA-FIRST-BUY-CLAIM`** | `pendingCred` / `claimCred` include bonus; bonus-only claim without CHARM weight; clears bonus on claim | `test_claim_cred_bonus_only_no_charm`, `test_claim_cred_pro_rata_plus_bonus`, `test_claimCred_reverts_active_epoch` |

Frontend mirror: [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts) · `arenaCredBurn.test.ts`. UI pay path: [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269).

<a id="timearena-podium-timers-gitlab-271"></a>

### TimeArena per-podium timer params (GitLab [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271))

Parent: [#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247) (independent `podiumDeadline[4]`). Onchain: [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol). Product: [time-arena § timers](../product/time-arena.md) · [arena-v2 § timers](../product/arena-v2.md#timers-last-buy--four-podiums). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Manual QA: [§271](manual-qa-checklists.md#manual-qa-issue-271). Anvil smoke: `bash scripts/verify-podium-timers-anvil.sh`.

**Scoring vs settlement (authoritative comment on #271):** Time Booster totals, Defended Streak window, and WarBow BP clutch/reset bonuses use **Last Buy (cat 0)** timer deltas / remaining / hard-reset. Per-category timer arrays govern **prize epoch deadlines** only (`podiumDeadline[cat]`, `rollPodiumEpoch`).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-PODIUM-TIMER-TABLE`** | `podiumTimerExtensionSec`, `podiumInitialTimerSec`, `podiumTimerCapSec`, reset bands match product table (+120/+60/+90/+300; 24h/12h/18h/48h initial; caps = 4× initial) | `ArenaPodiumTimerConfig.sol`, `test_start_arena_initial_deadlines_differ_by_category`, `verify-podium-timers-anvil.sh` |
| **`INV-TIME-ARENA-PODIUM-BUY-EXTEND`** | One buy extends all four deadlines by **category-specific** extension / hard-reset rules | `test_multi_podium_deadline_extend`, `test_time_booster_hard_reset_band_240_to_300` |
| **`INV-TIME-ARENA-PODIUM-ROLL-INIT`** | `rollPodiumEpoch(cat)` resets deadline to that category's `podiumInitialTimerSec[cat]` | `test_roll_podium_after_expiry`, `test_podium_timers_diverge_after_single_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-SCORING-LAST-BUY-TIMER-DETAIL`** | WarBow BP reset bonus requires Last Buy hard reset, not WarBow timer band alone; defended streak uses Last Buy remaining | `test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer`, `test_defended_streak_uses_last_buy_timer_not_other_podium` |
| **`INV-TIME-ARENA-LAST-BUY-EPOCH-UNCHANGED`** | `lastBuyEpoch` still increments only on Last Buy (cat 0) hard reset | `test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll`, `test_timer_hard_reset_increments_epoch` |

Derived UI: [`ArenaTimerChips.tsx`](../../frontend/src/pages/arena/ArenaTimerChips.tsx) reads four `podiumDeadline` values; buy checkout preview (`timeArenaBuyPreview.ts`) models **Last Buy** timer for scoring pills — all four settlement deadlines still extend onchain per buy.

<a id="indexer-live-podium-predictions-gitlab-273"></a>

### Indexer live podium predictions (GitLab [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273))

Parent: [#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254) (Arena HTTP baseline). Ingest: [`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs) · HTTP: [`api_arena.rs`](../../indexer/src/api_arena.rs) · head poller: [`chain_timer.rs`](../../indexer/src/chain_timer.rs). Product: [arena-v2 § podiums](../product/arena-v2.md) · [design § live podiums](../indexer/design.md#timecurve-podiums-http). Play skill: [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md). Manual QA: [§273](manual-qa-checklists.md#manual-qa-issue-273).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-INDEXER-PODIUM-LIVE-TABLE`** | `idx_arena_podium_live` in `ARENA_INDEX_TABLES`; top-3 per `(category, epoch)`; reorg rollback clears rows | migration `20260601140000_idx_arena_podium_live_gl273`, `reorg.rs`, `integration_stage2.rs` |
| **`INV-INDEXER-PODIUM-LIVE-INGEST`** | Block-tagged `podium()` snapshots on `Buy`, WarBow BP logs, `LastBuyEpochStarted`, `PodiumEpochRolled`; WarBow rollup from `idx_warbow_epoch_score` | `arena_podium_live.rs`, `ingestion.rs` |
| **`INV-INDEXER-PODIUM-LIVE-HTTP`** | UX order (Last Buy · WarBow · Defended · Time Booster); per-row `epoch` from head `lastBuyEpoch` / `podiumEpoch[cat]`; `podium_prediction: true` only when Postgres supplies entrants | `api_arena.rs`, `integration_stage2.rs::arena_podiums_live_predictions_smoke` |
| **`INV-INDEXER-273-CHAIN-TIMER-SELECTORS`** | `chain_timer` + ingest epoch reads call **`podiumDeadline(uint256)`** / **`podiumEpoch(uint256)`** (Solidity public-array getters), not `uint8` overloads that revert | `chain_timer.rs`, `warbow_score.rs`, `bash scripts/verify-podium-live-anvil.sh` |

<a id="timearena-xp-gas-gitlab-265"></a>

### TimeArena XP buy-path gas (GitLab [#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265))

Parent: [#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250) (XP/level math). Onchain: [`ArenaXp.applyXpGain`](../../contracts/src/arena/libraries/ArenaXp.sol), [`TimeArena._finishBuy`](../../contracts/src/arena/TimeArena.sol). Product: [arena-v2 § XP](../product/arena-v2.md#xp). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Manual QA: [§265](manual-qa-checklists.md#manual-qa-issue-265).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-XP-GAS-CACHED`** | `_cachedLevel` + `xpTowardNext` updated in `_finishBuy`; **`levelFromXp` not called** on buy path | `test_xp_incremental_matches_reference_many_buys`, `test_xp_high_level_buy_gas_bounded_no_level_up` |
| **`INV-TIME-ARENA-XP-GAS-CAP`** | At most **5** level-ups per buy; surplus XP retained in `xpTowardNext` | `ArenaXp.t.sol::test_applyXpGain_caps_five_level_ups_per_step`, `test_applyXpGain_eight_levels_two_steps` |
| **`INV-TIME-ARENA-XP-GAS-EPOCH`** | Timer hard-reset / `lastBuyEpoch` roll does **not** reset level or in-level progress | `test_xp_survives_timer_hard_reset` |
| **`INV-TIME-ARENA-XP-GAS-VIEWS`** | `level()` and `xpToNextLevel()` are O(1) from cached storage | `test_xp_max_charm_first_buy`, `test_xp_incremental_matches_reference_many_buys` |
| **`INV-TIME-ARENA-XP-GAS-CRED`** | `buyWithCred` uses same `_finishBuy` XP helper as DOUB | `test_xp_buy_with_cred_same_as_doub` |

<a id="timearena-core-gitlab-246"></a>

### TimeArena core — buys, timer, CHARM price (GitLab [#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246))

Parent epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Onchain: [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) · timer math: [`TimeMath.sol`](../../contracts/src/libraries/TimeMath.sol). Product: [time-arena § buy & timer](../product/time-arena.md) · [arena-v2](../product/arena-v2.md). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-DOUB-PRICE`** | `buy(charmWad)` pulls **DOUB** = `charmWad × charmPriceWad / 1e18`; default **`1000e18`** per 1e18 CHARM | `test_buy_routes_doub_split`, `testFuzz_buy_charmInBand_doubPullParity`, `testFuzz_setCharmPriceWad_doubOwed` |
| **`INV-TIME-ARENA-SET-PRICE`** | Governance **`setCharmPriceWad`** (mutable, > 0) | `test_setCharmPriceWad_changes_doub_owed` |
| **`INV-TIME-ARENA-CHARM-BAND`** | Fixed **0.99–10** CHARM (WAD) envelope | `test_buy_reverts_charm_*`, `testFuzz_buy_charmBelowMin_reverts`, `testFuzz_buy_charmAboveMax_reverts` |
| **`INV-TIME-ARENA-COOLDOWN`** | Rolling per-wallet **`buyCooldownSec`** | `test_buy_reverts_on_cooldown` |
| **`INV-TIME-ARENA-EPOCH-EVENT`** | **`LastBuyEpochStarted`** on hard reset | `test_emits_LastBuyEpochStarted_on_hard_reset` |

Fuzz parity (DOUB pull + charm bounds): `TimeArena.t.sol::testFuzz_*` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)). ERC-20 ingress: **`INV-ERC20-123`** below · `test_feeOnTransfer_buy_reverts_erc20Parity`.

**Pay-mode E2E:** `arena-paywith-{cl8y,cred,eth,usdm}` on [`ArenaSimplePage.tsx`](../../frontend/src/pages/ArenaSimplePage.tsx) (`/arena`). **DOUB** direct `buy`; **CRED** `buyWithCred` — `e2e/anvil-arena-04-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)); **ETH/USDM** use `TimeArenaBuyRouter.buyViaKumbaya` when `timeArenaBuyRouter` is set ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), frontend [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Env: `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` must match onchain when set (legacy alias `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`). **Pause:** `TimeArena.paused` only — **`INV-FRONTEND-264-ARENA-PAY-PAUSE`**.

<a id="arena-frontend-pay-pause-gitlab-264"></a>

### Arena buy pay modes + pause (GitLab [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264))

Frontend: [arena-views § unified](../frontend/arena-views.md#unified-arena-page-gitlab-256) · Kumbaya: [integrations/kumbaya.md](../integrations/kumbaya.md) · play skill: [`play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** | No `buyFeeRoutingEnabled` on Arena routes; writes gated by **`TimeArena.paused`**; DOUB **`buy`** + ETH/USDM **`buyViaKumbaya`** when router set; env router mismatch fail-closed | `kumbayaRoutes.test.ts`, `arenaV2SaleSessionBridge.test.ts`, `e2e/anvil-arena-03-wallet-writes.spec.ts` (ETH when `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` set); onchain ETH/USDM/CL8Y: `VerifyTimeArenaBuyRouterAnvil.t.sol`, `TimeArenaBuyRouter.t.sol` ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270) tracks Playwright quote flake) |

<a id="arena-podium-pool-topup-gitlab-261"></a>

### Manual podium pool top-up (GitLab [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

Onchain: **`TimeArena.topUpPodiumPools`** · routing: **`ArenaBuyRouting.splitPrizeTopUpAmount`** · **`INV-TIME-ARENA-PODIUM-TOPUP`**. Product: [arena-v2 § manual top-up](../product/arena-v2.md#manual-podium-pool-top-up-gitlab-261) · onchain: [fee-routing § top-up](../onchain/fee-routing-and-governance.md#manual-podium-pool-top-up-gitlab-261). Forge: `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*`.

<a id="dev-kumbaya-anvil-deploy-gitlab-270"></a>

### Dev Kumbaya deploy + ETH E2E (GitLab #270)

| ID | Rule | Enforcement |
|----|------|-------------|
| **`INV-DEV-KUMBAYA-270-DEPLOY`** | `DeployKumbayaAnvilFixtures` calls `DevOnlyChainGuard`; seeds DOUB↔WETH and USDM↔WETH↔DOUB pools; `setTimeArenaBuyRouter` matches logged router | `DeployKumbayaAnvilFixtures.s.sol`, `scripts/lib/anvil_deploy_dev.sh` cast check |
| **`INV-DEV-KUMBAYA-270-E2E`** | Default `bash scripts/e2e-anvil.sh` sets `YIELDOMEGA_DEPLOY_KUMBAYA=1` and exports `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | `scripts/e2e-anvil.sh`, `e2e/anvil-arena-03-wallet-writes.spec.ts` ETH case |
| **`INV-TIME-ARENA-BUY-ROUTER`** | `buyViaKumbaya` ETH/USDM/CL8Y happy paths; DOUB direct `buy`; stable ingress parity; charm bounds; paused arena; swap deadline; router-only `buyFor` | `TimeArenaBuyRouter.t.sol`, `VerifyTimeArenaBuyRouterAnvil.t.sol` |
| **`INV-TIME-ARENA-BUYFOR-PULL`** | `buyFor` pulls DOUB from `timeArenaBuyRouter`, not the participant wallet | `TimeArena.sol` `_buyDoub`; `TimeArenaBuyRouter.t.sol` |

<a id="arena-podium-pool-donations-gitlab-262"></a>

### Arena podium pool donations (GitLab [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

Indexer HTTP: **`GET /v1/arena/podium-pool-donations`** (ingests **`PodiumPoolsToppedUp`** from [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)). Frontend: protocol AUDIT card — [arena-views § donate-pools](../frontend/arena-views.md#protocol-donate-pools-gitlab-262). Play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

<a id="wallet-profile-modal-gitlab-258"></a>

### Wallet profile modal (GitLab [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258))

Participant wallet addresses on live buy feeds and podium rankings open **`WalletProfileModal`** (indexer **`GET /v1/arena/wallet/{address}/stats`**); explorer links remain inside the modal only. Sections: Overview, Podium wins, Spending, XP/Level, WarBow, Referrals, Fun facts. Frontend: [arena-views § wallet-profile](../frontend/arena-views.md#wallet-profile-modal-gitlab-258) · **`INV-FRONTEND-258-WALLET-PROFILE`** · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

<a id="arena-vault-funding-gitlab-267"></a>

### Arena buy vault funding (GitLab [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267))

Onchain notifications: **`PodiumFunded`**, **`SeedFunded`** on **`PodiumVaults`**; **`AdminVaultFunded`** on **`AdminSellVault`** — emitted on each DOUB **`buy`** (not CRED burn, not **`topUpPodiumPools`**). Indexer table: **`idx_arena_vault_funding`** (`kind`: `podium_active` | `podium_seed` | `admin`). HTTP: **`GET /v1/arena/vault-funding/recent`**, **`…/by-tx/{tx_hash}`**, **`…/totals`**. Reconciliation: for each **`idx_arena_buy`** row with **`paid_with_cred = false`**, **`SUM(amount_doub_wad)`** over funding rows sharing **`tx_hash`** must equal **`doub_paid`**. Distinct from donate-pools ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)). Design: [indexer design §267](../indexer/design.md#arena-vault-funding-http-gitlab-267) · onchain: [fee-routing § events](../onchain/fee-routing-and-governance.md#events) · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

---

## How to run the full automated matrix

From repository root:

```bash
# Contracts (CI profile). Install forge libs per contracts/README.md first.
cd contracts && FOUNDRY_PROFILE=ci forge test -vv

# Indexer — see Postgres integration below
cd indexer && cargo test

# Frontend unit tests
cd frontend && npm ci && npm test

# Python simulations (bounded repricing / eco scenarios — not v1 TimeCurve sale authority)
cd simulations && PYTHONPATH=. python3 -m unittest discover -s tests -v
```

Forge dependencies: [contracts/README.md](../../contracts/README.md).

### Postgres integration test behavior (`indexer/tests/integration_stage2.rs`)

CI sets `YIELDOMEGA_PG_TEST_URL` so `postgres_stage2_persist_all_events_and_rollback_after` runs migrations, inserts **every non-Unknown Arena v2** [`DecodedEvent`](../../indexer/src/decoder.rs) variant, checks idempotency, calls `rollback_after`, then HTTP smoke for **`GET /v1/arena/*`** and **`GET /v1/referrals/*`**. **`arena_wallet_stats_two_epochs_and_bonus_fields`** ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)) asserts two Last Buy epochs + bonus fields on **`GET /v1/arena/wallet/{address}/stats`**.

Tests share one Postgres URL and serialize on a process-wide mutex (`PG_INTEGRATION_MUTEX`) so parallel `cargo test` does not cross-delete fixture rows.

If the variable is **unset** locally, that test **returns immediately** (passes without proving Postgres).

<a id="indexer-emitted-event-coverage-gitlab-112"></a>

### Indexer emitted-event coverage (GitLab [#112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112))

**INV-INDEXER-112:** Solidity `event`s emitted by **deployed Arena v2** contracts in [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs) must each map to a **`DecodedEvent` variant**, a Postgres **`idx_*` table**, and **`persist_decoded_log_conn`** / **`rollback_after`** coverage in [`reorg.rs`](../../indexer/src/reorg.rs). **ReferralRegistry** and **DoubPresaleVesting** events remain first-class when deployed.

<a id="indexer-transactional-block-ingestion-gitlab-140"></a>

### Indexer transactional per-block ingestion (GitLab [#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140))

**INV-INDEXER-140:** For each ingested block, decoded inserts, **`indexed_blocks`**, and **`chain_pointer`** commit in **one** Postgres transaction ([`ingestion.rs`](../../indexer/src/ingestion.rs)). Single-event test/tool paths use **`persist_decoded_log_autocommit`** ([§ #148](#post-138-hygiene-naming-gitlab-148)).

<a id="post-138-hygiene-naming-gitlab-148"></a>

### Post-#138 naming hygiene (GitLab [#148](https://gitlab.com/PlasticDigits/yieldomega/-/issues/148))

| ID | Check |
|----|--------|
| **`INV-INDEXER-148-AUTOCOMMIT`** | **`persist_decoded_log_autocommit`** is one transaction per call — OK for single-row tests; multi-event batches must use an outer transaction + **`persist_decoded_log_conn`** ([`INV-INDEXER-140`](#indexer-transactional-block-ingestion-gitlab-140)). |

---

## Business logic (Arena v2 and shared stack)

| Area | Intent (short) | Spec |
|------|----------------|------|
| **TimeArena** | DOUB/CRED buys, four podium timers, 40/30/30 routing, epoch CRED, XP, DOUB WarBow, always-live (`paused` only) | [arena-v2.md](../product/arena-v2.md), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) |
| **PodiumVaults / AdminSellVault** | Active/seed pools, admin vault, `rollPodiumEpoch`, manual top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)) | [arena-v2.md](../product/arena-v2.md) |
| **ReferralRegistry** | Code registration; referred-buy **flat 5 CRED per side** on DOUB buys ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272); baseline [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)) | [referrals.md](../product/referrals.md) |
| **DoubPresaleVesting** | Presale DOUB vesting schedule + claims gate | [`DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol) |
| **Indexer** | Arena + referral decode; per-block tx ([#140](#indexer-transactional-block-ingestion-gitlab-140)); reorg rollback | [`REORG_STRATEGY.md`](../../indexer/REORG_STRATEGY.md), [indexer design](../indexer/design.md) |
| **Frontend `/arena`** | Env-driven addresses, indexer reads, wallet gating | [arena-views.md](../frontend/arena-views.md), [wallet-connection.md](../frontend/wallet-connection.md) |

---

## Cross-cutting invariants (still apply)

<a id="anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87"></a>

### Anvil E2E Playwright (GitLab [#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))

**INV-ANVIL-E2E-87:** With **`ANVIL_E2E=1`**, Playwright uses **`workers: 1`**. Pay mode on **`/arena`**: **`getByTestId("arena-paywith-eth")`** (and **`…-cl8y`**, **`…-usdm`**). Doc: [e2e-anvil.md](e2e-anvil.md).

<a id="frontend-single-chain-wagmi-issue-81"></a>

### Frontend single-chain wagmi (GitLab [#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81))

**INV-FRONTEND-81:** Wagmi **`chains`** = [`configuredChain()`](../../frontend/src/lib/chain.ts) only (default **31337** + local RPC).

<a id="frontend-wallet-chain-write-gating-issue-95"></a>

### Frontend wallet chain write gate (GitLab [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95))

**INV-FRONTEND-95:** When **`useChainId() !== configuredTargetChainId()`**, in-app writes on **`/arena`**, **`/referrals`** are blocked via **`chainMismatchWriteMessage`**, overlays, and **`SwitchToTargetChainButton`**.

<a id="arena-buy-charm-wrong-chain-visual-gitlab-194"></a>

### Arena buy CTA wrong-chain visual (GitLab [#194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194))

**INV-FRONTEND-194-ARENA-BUY-CHAIN:** On **`/arena`**, mismatched chain adds **`arena-simple__cta--wrong-network`**, native **`title`**, no Framer lift, raised **`ChainMismatchWriteBarrier`**.

<a id="timecurve-buy-wallet-session-drift-gitlab-144"></a>

### Buy wallet session drift mid-flow (GitLab [#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144))

**INV-BUY-SESSION-144:** **`captureWalletBuySession`** + **`assertWalletBuySessionUnchanged`** after every **`await`** in multi-step **`/arena`** buys ([`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts)).

<a id="referral-registration-wallet-session-drift-gitlab-155"></a>

### Referral registration session drift (GitLab [#155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155))

**INV-REFERRAL-SESSION-155:** Same guard pattern on **`/referrals`** **`registerCode`**.

<a id="erc20-balance-delta-ingress-gitlab-123"></a>

### ERC-20 balance-delta ingress (GitLab [#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123))

**INV-ERC20-123:** DOUB (and other) pulls on **`TimeArena`** use balance-delta parity — credited amount equals declared spend. Forge: `TimeArena.t.sol::test_feeOnTransfer_buy_reverts_erc20Parity`, `testFuzz_buy_charmInBand_doubPullParity` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)).

<a id="indexer-offline-ux-and-backoff-gitlab-96"></a>

### Indexer offline UX and backoff (GitLab [#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96))

**INV-FRONTEND-96:** **`reportIndexerFetchAttempt`**: offline after **3** failures; pollers back off **5s → 15s → 30s**; **`IndexerStatusBar`** shows retry state.

<a id="keyboard-focus-visible-wcag-247-gitlab-97"></a>

### Keyboard focus visible — WCAG 2.4.7 (GitLab [#97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97))

**INV-FRONTEND-97:** **`:focus-visible`** via **`--yo-focus-ring`**; duplicated under **`[data-rk]`** for RainbowKit.

<a id="indexer-public-api-500-error-redaction-gitlab-157"></a>

### Indexer public API 500 redaction (GitLab [#157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157))

**INV-INDEXER-157:** JSON **`500`** bodies use stable **`{ "error": "internal server error" }`** — no raw SQL in responses.

<a id="indexer-ingestion-liveness-and-rpc-timeouts-gitlab-168"></a>

### Indexer ingestion liveness + RPC timeouts (GitLab [#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168))

**INV-INDEXER-168:** Supervised ingestion retry; **`INDEXER_RPC_REQUEST_TIMEOUT_SEC`**; **`GET /v1/status`** **`ingestion_alive`** + **`last_indexed_at_ms`**.

<a id="indexer-production-database-url-placeholders-gitlab-142"></a>

### Indexer production `DATABASE_URL` (GitLab [#142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142))

**INV-INDEXER-142:** **`INDEXER_PRODUCTION`** rejects placeholder substrings in **`DATABASE_URL`**.

<a id="indexer-production-address-registry-fail-closed-gitlab-156"></a>

### Indexer production registry (GitLab [#156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156))

**INV-INDEXER-156:** With **`INDEXER_PRODUCTION`**, registry must include **`TimeArena`**, **`PodiumVaults`**, **`AdminSellVault`**, **`ReferralRegistry`**, valid **`chain_id`**, and **`deploy_block > 0`** (except Anvil **31337**).

<a id="retired-v1-reserve-removal-gitlab-242"></a>

### Retired v1 player reserve removal (GitLab [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242))

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-242-RABBIT-REMOVED`** | No v1 player-reserve contracts in **`DeployDev`** / **`DeployProduction`**; **`Doubloon.MINTER_ROLE`** to governance/deployer only | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol), [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) |
| **`INV-242-INDEXER-NO-HTTP`** | Legacy **`GET /v1/rabbit/*`** routes absent (404) | [`integration_stage2.rs`](../../indexer/tests/integration_stage2.rs) `api_legacy_player_reserve_routes_return_404` |
| **`INV-242-SOURCE-GREP`** | Active-source grep hygiene: no legacy player-reserve identifiers in contracts, indexer, frontend, docs, skills — **`Doubloon.sol`** token notice exception per [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242) | Manual + CI hygiene; see [treasury-contracts](../onchain/treasury-contracts.md) |

Product: [arena-v2 § retired surfaces](../product/arena-v2.md#retired-surfaces) · Play skills: [skills/README.md](../../skills/README.md) · Guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md)

<a id="arena-v2-deploy-gitlab-259"></a>

### Arena v2 deploy wiring (GitLab [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259))

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-DEPLOY-259-DEV-WIRE`** | DeployDev: vaults → arena, PlayCred minter, arena live | [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) |
| **`INV-DEPLOY-259-DEV-SEED`** | DeployDev seeds DOUB/CL8Y/CRED for E2E mock wallet | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) |
| **`INV-DEPLOY-259-PROD-CLEAN`** | DeployProduction: no Leprechaun/Rabbit/Presale/TimeCurve | [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol) |
| **`INV-DEPLOY-259-REGISTRY`** | Registry JSON: TimeArena, PodiumVaults, AdminSellVault, PlayCred | [`scripts/lib/arena_v2_registry_from_broadcast.sh`](../../scripts/lib/arena_v2_registry_from_broadcast.sh) |

Ops: [`deployment-guide` §259](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) · E2E: [`e2e-anvil.md`](e2e-anvil.md).

---

<a id="qa-local-full-stack-orchestrator-gitlab-104"></a>

### QA local full stack (GitLab [#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104))

**INV-QA-FULLSTACK-104:** [`start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) delegates only to [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh). Playwright stays in [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh).

<a id="launchgate-home-route--no-env-parity-gitlab-199"></a>

### LaunchGate `/home` route (GitLab [#199](https://gitlab.com/PlasticDigits/yieldomega/-/issues/199))

**INV-FRONTEND-199-HOME-ROUTE:** No-env builds register **`/home`** → **`HomePage`** so the shell outlet is not empty.

<a id="branded-404-catch-all-gitlab-223"></a>

### Branded 404 (GitLab [#223](https://gitlab.com/PlasticDigits/yieldomega/-/issues/223))

**INV-FRONTEND-223-NOT-FOUND:** **`path="*"`** → **`NotFoundPage`**; **`/arena`**, **`/referrals`** unchanged. **`/vesting`** removed ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

<a id="referral-flat-cred-gitlab-272"></a>

**INV-REFERRAL-272-FLAT-CRED:** On referred **`TimeArena`** **DOUB** buy with valid **`codeHash`**, **`ReferralCredApplied`** mints **`REFERRAL_CRED_FLAT_WAD`** (**5e18**) to **referrer** and **buyer** each; amount is **independent** of **`CRED_PER_BUY`** epoch pool; **`charmWeight`** gains **only** purchased **`charmWad`**; self-referral reverts; **`buyWithCred`** has no referral path. Supersedes BPS basis ([#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)). Indexer persists **`idx_arena_referral_cred`**; HTTP **`/v1/referrals/*`** exposes **`referrer_cred` / `buyer_cred` / `total_referrer_cred_wad`** (schema **≥ 2.3.0**). **`/referrals`** and **`/arena`** preview show **flat 5 CRED**, not **5%** or **1.75**. Forge: **`test_referred_buy_mints_cred_not_charm`**, **`test_self_referral_reverts`**. Anvil smoke: `bash scripts/verify-referral-flat-cred-anvil.sh`. Spec: [referrals.md § Arena v2](../product/referrals.md).

<a id="referral-cred-split-gitlab-253"></a>

### Referral CRED split (GitLab [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253) · flat amount [#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272))

**INV-REFERRAL-253-CRED:** Alias of **`INV-REFERRAL-272-FLAT-CRED`** — kept for cross-links from [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253) QA; do not document **5% of 35 CRED** or **`REFERRAL_CRED_BPS`** on live Arena v2 paths.

---

## Contract test suite inventory (Arena v2 focus)

| File | Focus |
|------|--------|
| [`TimeArena.t.sol`](../../contracts/test/TimeArena.t.sol) | Timers, buys, CRED, XP, WarBow DOUB, routing, referral CRED ([#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)) |
| [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol) | 40/30/30 split math |
| [`DoubPresaleVesting.t.sol`](../../contracts/test/DoubPresaleVesting.t.sol) | Vesting schedule + claims |
| [`ReferralRegistry.t.sol`](../../contracts/test/ReferralRegistry.t.sol) | Referral burns + registration |
| [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) | DeployDev wiring |
| [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) | Optional RPC fork smoke ([#275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275)); **`INV-CONTRACTS-275-FORK-SMOKE`** |

Run `cd contracts && forge test --list` for the authoritative list. Pre–Arena v1 contract tests may remain in-tree but are **not** mapped here.

---

## Gaps and non-goals

- **Stage 2 wallet-signed txs:** [stage2-run-log.md](../operations/stage2-run-log.md); CI Playwright is UI smoke only unless **`ANVIL_E2E=1`**.
- **~90% / 100%:** [stage3-mainnet-operator-runbook.md](../operations/stage3-mainnet-operator-runbook.md).
- **Fork smoke:** optional; see [contract-fork-smoke.md](contract-fork-smoke.md) and **`INV-CONTRACTS-275-FORK-SMOKE`** below.

---

## Contract fork smoke (optional) (GitLab #275)

<a id="contract-fork-smoke-optional-gitlab-275"></a>

**`INV-CONTRACTS-275-FORK-SMOKE`:** [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) (`TimeArenaForkTest`) is the only CI-matched fork smoke contract. With **`FORK_URL` unset**, both tests **no-op** (pass) so default **`unit-tests`** stays deterministic. With **`FORK_URL` set**, `test_fork_smoke_chainIdAndBlock` forks and asserts positive `chainid` / `block.number`. Optional `test_fork_smoke_timeArenaHeadState` reads `TimeArena.paused()` and `deadline()` when **`TIME_ARENA_FORK_ADDRESS`** points at deployed bytecode; skips on zero placeholder or empty code. **`contract-fork-smoke`** workflow uses `--match-contract TimeArenaForkTest` ([`contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml)). Runbook: [contract-fork-smoke.md](contract-fork-smoke.md). Replaces retired `TimeCurveForkTest` ([#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274) doc follow-up).

---

**Related:** [testing strategy](strategy.md) · [CI mapping](ci.md) · [manual QA](manual-qa-checklists.md) · [arena-views](../frontend/arena-views.md)
