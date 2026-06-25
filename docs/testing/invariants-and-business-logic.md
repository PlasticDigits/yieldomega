# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Player vs contributor aids:** Root [`skills/`](../../skills/) holds **play** skills (participation). Maintainer **manual QA** lives in [manual-qa-checklists.md](manual-qa-checklists.md).

**Authoritative rules live onchain**; the indexer and frontend are derived read models ([architecture/overview.md](../architecture/overview.md)).

**Arena v2 product spec:** [`docs/product/arena-v2.md`](../product/arena-v2.md) · Epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238) · [epic verification §238](#arena-v2-epic-gitlab-238). Retired v1 launchpad, treasury, NFT, and CL8Y fee-split stacks — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). Bulk removal of legacy invariant sections: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263). Satellite doc cleanup: [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274) (P0 operator paths) · [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276) (residual token trim) · verify: `bash scripts/check-doc-anchors.sh` · `bash scripts/check-doc-retired-terms.sh` · `bash scripts/check-doc-satellite-retired-count.sh` · `bash scripts/check-doc-timecurve-satellite.sh` ([#284](https://gitlab.com/PlasticDigits/yieldomega/-/issues/284)).

## CI vs local verification matrix

Authoritative workflow mapping: [ci.md](ci.md). Quick reference when tracing invariant evidence to commands:

| Layer | CI (`unit-tests` workflow) | Local parity |
|-------|---------------------------|--------------|
| **Contracts** | `forge test` (`FOUNDRY_PROFILE=ci`) + MegaEVM size gate | `bash scripts/check-megaevm-contract-sizes.sh` · `cd contracts && FOUNDRY_PROFILE=ci forge test -vv` |
| **Indexer** | `cargo clippy --all-targets -- -D warnings` + `cargo test` (Postgres service) | `export YIELDOMEGA_PG_TEST_URL=…` then `cd indexer && cargo clippy --all-targets -- -D warnings && cargo test` |
| **Frontend** | `npm test` + Playwright UI smoke (`npm run test:e2e`) | `cd frontend && npm ci && npm test` · optional `npm run build && npm run test:e2e` |
| **Bots** | **`bots-timearena-test`** job — `pytest` in `bots/timearena/` | `cd bots/timearena && pip install -e ".[dev]" && pytest tests -v` |
| **Simulations** | Python `unittest` in `simulations/` | `cd simulations && PYTHONPATH=. python3 -m unittest discover -s tests -v` |
| **Doc gates** | **`scripts-smoke`** job | `bash scripts/check-doc-anchors.sh` · `bash scripts/check-doc-retired-terms.sh` · `bash scripts/check-doc-satellite-retired-count.sh` · `bash scripts/check-doc-timecurve-satellite.sh` · `bash scripts/check-art-readme-consumers.sh` |
| **Anvil E2E** | Not a merge gate; optional **`e2e-anvil`** `workflow_dispatch` | `bash scripts/e2e-anvil.sh` · see [e2e-anvil.md](e2e-anvil.md) |
| **Fork smoke** | Not in default `unit-tests`; optional **`contract-fork-smoke`** workflow | `bash scripts/verify-contract-fork-smoke.sh` with `FORK_URL` · [contract-fork-smoke.md](contract-fork-smoke.md) |

<a id="arena-v2-epic-gitlab-238"></a>

## Arena v2 epic (GitLab [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238))

Umbrella for the full Arena v2 redeploy (TimeArena replaces v1 launchpad; **DOUB** spend asset; **four independent podium timers**). Closes only when all linked children are closed and maintainer accepts mainnet deploy ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-EPIC-238-CHILD-LINKS`** | Core child issues (#240–#260) linked to epic via GitLab **relates_to** | `glab api projects/PlasticDigits%2Fyieldomega/issues/238/links` → 21+ links |
| **`INV-EPIC-238-DECISION-LOG`** | Published decision log: **TimeArena** replaces TimeCurve; **DOUB** spend; four podiums with independent timers | [`docs/product/time-arena.md`](../product/time-arena.md) · [`docs/product/arena-v2.md`](../product/arena-v2.md) · [time-arena § resolved decisions](../product/time-arena.md#resolved-open-decisions-gitlab-240) |
| **`INV-EPIC-238-RETIRED-ADDRESSES`** | Legacy v1 mainnet addresses documented as retired in ops docs | [`README.md`](../../README.md) (legacy table + Arena v2 note) · [deployment-guide § retired v1](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) · [`launchplan-timecurve.md`](../../launchplan-timecurve.md) redirect |
| **`INV-EPIC-238-CHILD-CHECKLIST`** | Epic child checklist tracks open vs closed children (issue body + linked issues) | `glab issue view 238 -R PlasticDigits/yieldomega --comments`; open children at last verify: #254, #255, #258 (implementation done — awaiting close) |
| **`INV-EPIC-238-MAINTAINER-SIGNOFF`** | Maintainer / product sign-off on DeployProduction before epic closes | [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259) QA table in [deployment-guide](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) — epic stays open until accepted |
| **`INV-EPIC-238-QA-GATE`** | Arena v2 invariants, doc gates, DeployDev smoke | [#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260) · `FOUNDRY_PROFILE=ci forge test --match-contract DevStackIntegration` · `bash scripts/check-doc-anchors.sh` · `bash scripts/check-doc-retired-terms.sh` · `bash scripts/check-arena-naming.sh` · [manual QA §260](manual-qa-checklists.md#manual-qa-issue-260) |

**Manual QA (epic scope):** [Arena v2 QA checklist §260](manual-qa-checklists.md#manual-qa-issue-260) · Play skills: [`skills/README.md`](../../skills/README.md).

<a id="arena-v2-play-skills-gitlab-245"></a>

## Arena v2 play skills & bot paths (GitLab [#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-245-PLAY-SKILLS`** | Root [`skills/README.md`](../../skills/README.md) indexes **`play-active-time-arena`**, **`play-time-arena-doub`**, **`play-time-arena-warbow`**, **`script-with-timearena-local`** only (legacy `play-timecurve-*` removed) | `skills/play-*-time-arena*/SKILL.md`, grep absence of `play-timecurve-doubloon` |
| **`INV-DOCS-245-GUARDRAILS`** | [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) references Arena v2 onchain authority + [`skills/README.md`](../../skills/README.md) play index | manual review |
| **`INV-DOCS-245-PHASE20`** | [`docs/agent-phases.md`](../agent-phases.md) Phase 20 prompt names Time Arena play skills + [`docs/product/time-arena.md`](../product/time-arena.md) | `grep play-time-arena agent-phases.md` |
| **`INV-BOTS-245-TIMEARENA`** | Python package **`timearena_bot`** at [`bots/timearena/`](../../bots/timearena/README.md); CLI **`timearena-bot`**; env **`YIELDOMEGA_TIME_ARENA_ADDRESS`**; `inspect` reads **`TimeArena.doub()`** / **`arenaStart`** / **`paused`** (not legacy `saleStart` / `acceptedAsset`) | `cd bots/timearena && pytest` · `bash scripts/sync-bot-env-from-frontend.sh` · `.github/workflows/unit-tests.yml` **`bots-timearena-test`** |
| **`INV-BOTS-245-ENV-SYNC`** | `scripts/sync-bot-env-from-frontend.sh` maps **`VITE_TIME_ARENA_ADDRESS`** → bot env (no Rabbit/Leprechaun required) | script + `frontend/.env.example` |

<a id="satellite-docs-gitlab-274"></a>

## Satellite docs — retired v1 terms (GitLab [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-274-RETIRED-TERMS`** | Operator/agent paths (`docs/qa/`, `docs/agent-phases.md`, `docs/agent-implementation-phases.md`, `docs/testing/qa-local-full-stack.md`) contain **no** retired v1 launchpad operator symbols (denylist enforced by script) | `bash scripts/check-doc-retired-terms.sh` (CI **`scripts-smoke`** job) |
| **`INV-DOCS-274-QA-ONBOARDING`** | [`docs/qa/QA-onboarding-gitlab-issue-body.md`](../qa/QA-onboarding-gitlab-issue-body.md) describes **`/arena`**, `bots/timearena`, **`VITE_TIME_ARENA_ADDRESS`** — not retired v1 launchpad page / five-sink panel | manual review |
| **`INV-DOCS-274-INDEXER-DESIGN`** | [`docs/indexer/design.md`](../indexer/design.md) documents **`idx_arena_*`** + **`GET /v1/arena/*`** only; no active **`GET /v1/timecurve/*`** | grep + [`decoder.rs`](../../indexer/src/decoder.rs) |

Cross-links: [`docs/testing/strategy.md`](strategy.md) · [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) · [`skills/README.md`](../../skills/README.md).

<a id="satellite-docs-gitlab-276"></a>

## Satellite docs — residual v1 token trim (GitLab [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276))

Follow-up to [#274](#satellite-docs-gitlab-274): reduce retired v1 launchpad symbol noise across **`docs/`** while preserving invariant anchor IDs and P0 operator paths.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-276-SATELLITE-COUNT`** | **`docs/`** contains **≤ 15** files and **≤ 25** total retired v1 launchpad symbol tokens (baseline at #276 open: 30 files / 55 mentions) | `bash scripts/check-doc-satellite-retired-count.sh` (CI **`scripts-smoke`**) |
| **`INV-DOCS-276-P0-UNCHANGED`** | P0 operator/agent paths unchanged from [#274](#satellite-docs-gitlab-274) | `bash scripts/check-doc-retired-terms.sh` |

Cross-links: [`docs/testing/strategy.md`](strategy.md) · [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) · [`skills/README.md`](../../skills/README.md) · [`bots/timearena/README.md`](../../bots/timearena/README.md) · [`skills/script-with-timearena-local/SKILL.md`](../../skills/script-with-timearena-local/SKILL.md).

<a id="satellite-docs-gitlab-284"></a>

## Satellite docs — historical `timecurve` trim (GitLab [#284](https://gitlab.com/PlasticDigits/yieldomega/-/issues/284))

Follow-up to [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263) / [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276): satellite **`docs/`** and **`skills/`** use **`/arena`**, **`GET /v1/arena/*`**, and **`idx_arena_*`** as primary vocabulary. Retired **`timecurve`** / **`timecurve_bot`** strings appear only in explicit legacy-alias sentences (env `YIELDOMEGA_TIMECURVE_ADDRESS`, registry `timecurve` key), historical retirement notes, or [`bots/timearena/CHANGELOG.md`](../../bots/timearena/CHANGELOG.md).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-284-TIMECURVE-SATELLITE`** | No stale retired write-gate testids, pre-rename indexer or wallet-session markdown anchors, or `timecurve-` HTML anchor ids under **`docs/`** / **`skills/`** | `bash scripts/check-doc-timecurve-satellite.sh` (CI **`scripts-smoke`**) |
| **`INV-DOCS-284-ANCHORS`** | Cross-links to indexer live podiums use **`#arena-podiums-http`**; buy session drift uses **`#arena-buy-wallet-session-drift-gitlab-144`** | `bash scripts/check-doc-anchors.sh` |

<a id="frontend-cl8y-arena-approval-storage-gitlab-277"></a>

## Frontend — CL8Y unlimited approval storage rename (GitLab [#277](https://gitlab.com/PlasticDigits/yieldomega/-/issues/277))

Follow-up to [#276](#satellite-docs-gitlab-276): finish Arena v2 rename of the opt-in unlimited **CL8Y → TimeArena** `localStorage` preference — canonical key, UI copy, docs, and legacy read/migrate path.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-277-CL8Y-ARENA-STORAGE`** | Active key is **`yieldomega.erc20.cl8yArenaUnlimited.v1`**; `/arena` checkbox label names **Time Arena** | [`arenaDoubApprovalPreference.ts`](../../frontend/src/lib/arenaDoubApprovalPreference.ts) · [`ArenaDoubUnlimitedApprovalFieldset.tsx`](../../frontend/src/components/ArenaDoubUnlimitedApprovalFieldset.tsx) · [wallet-connection §143](../frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143) |
| **`INV-FRONTEND-277-LEGACY-READ-MIGRATE`** | Retired v1 key honored on read; enabling preference writes canonical key and removes legacy key | [`arenaDoubApprovalPreference.test.ts`](../../frontend/src/lib/arenaDoubApprovalPreference.test.ts) |
| **`INV-FRONTEND-277-APPROVAL-UNCHANGED`** | Approval economics unchanged: 50 bps headroom or `maxUint256` when opted in ([#143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143), [#224](https://gitlab.com/PlasticDigits/yieldomega/-/issues/224)) | [`arenaDoubApprovalPreference.test.ts`](../../frontend/src/lib/arenaDoubApprovalPreference.test.ts) · [`ensureCl8yKumbayaAllowance.test.ts`](../../frontend/src/lib/ensureCl8yKumbayaAllowance.test.ts) |
| **`INV-FRONTEND-277-CHAIN-GATE-RABBY`** | Wrong-network overlay blocks writes when wallet `chainId` ≠ `VITE_CHAIN_ID` ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)); mock E2E is partial only | [`rabby-cloud-agent-qa.md`](rabby-cloud-agent-qa.md) · `bash scripts/verify-rabby-chain-mismatch.sh` · [`ChainMismatchWriteBarrier.tsx`](../../frontend/src/components/ChainMismatchWriteBarrier.tsx) |

Cross-links: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) · [`.cursor/skills/rabby-cloud-verification/SKILL.md`](../../.cursor/skills/rabby-cloud-verification/SKILL.md) · [`skills/play-time-arena-doub/SKILL.md`](../../skills/play-time-arena-doub/SKILL.md) · `bash scripts/check-doc-satellite-retired-count.sh`.

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
| **`INV-TIME-ARENA-ROUTE-SPLIT`** | **100%** podium vaults per DOUB buy (**0%** admin); **25%** × 4 categories; **70/20/10** epoch tranches ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)); **no** retired v1 five-sink CL8Y routing ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)) | [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol), `TimeArena.t.sol::test_buy_routes_doub_split`, `test_buy_routes_epoch_tranches_worked_example` · [fee-routing](../onchain/fee-routing-and-governance.md) · [§300](#arena-prize-routing-gitlab-300) |
| **`INV-ADMIN-SELL-VAULT-249`** | **Retired ([#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314))** — `AdminSellVault` removed from arena deploy; historical evidence in git before #314 | [#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249) |
| **`INV-TIME-ARENA-TIMER-EXTEND`** | Qualifying buy adds **+120s** when not in hard-reset band | `test_timer_extension_without_hard_reset`, `TimeMath.t.sol::testFuzz_extendDeadlineOrReset_arenaProfile` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246)) |
| **`INV-TIME-ARENA-EPOCH-CHARM-GROWTH`** | DOUB `buy` uses **`effectiveCharmPriceWad()`** = epoch anchor × exp(ln(1.1)×elapsed/86400); hard-reset buy re-anchors TWAP **before** DOUB pull; **`LastBuyEpochCharmAnchored`** emitted | `TimeArenaEpochCharmPrice.t.sol`, `TimeArena.t.sol` ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)) · [detail §305](#timearena-epoch-charm-price-gitlab-305) |
| **`INV-TIME-ARENA-CRED-FLAT`** | **`buyWithCred`** burns **`CRED_PER_CHARM_WAD`** only; no reads of epoch DOUB price | `TimeArenaEpochCharmPrice.t.sol::test_buyWithCred_ignores_epoch_growth` ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)) |
| **`INV-TIME-ARENA-TIMER-MULTI`** | One buy extends **all four** `podiumDeadline[i]` by **category-specific** extension (+120 / +60 / +90 / +300) | `test_multi_podium_deadline_extend` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) |
| **`INV-TIME-ARENA-PODIUM-TIMER-PARAMS`** | Per-category timer table; `startArena` leaves all categories **unarmed** with `podiumDeadline[cat]=0` | `test_start_arena_timers_unarmed`, `test_time_booster_hard_reset_band_240_to_300` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271), [#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)) · `bash scripts/verify-podium-timers-anvil.sh` |
| **`INV-TIME-ARENA-PODIUM-TIMER-ARM`** | Per-category arm on first qualifying buy; `rollPodiumEpoch` / autoroll skip unarmed epochs; emits **`PodiumTimerArmed`** | `test_per_category_arm_on_first_qualifying_buy`, `test_no_autoroll_before_timer_armed`, `test_roll_podium_reverts_when_unarmed` ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)) |
| **`INV-TIME-ARENA-SCORING-LAST-BUY-TIMER`** | Time Booster / Defended Streak / WarBow BP scoring uses **Last Buy (cat 0)** timer only, not other podium bands | `test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer`, `test_defended_streak_uses_last_buy_timer_not_other_podium` ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)) · [detail §271](#timearena-podium-timers-gitlab-271) |
| **`INV-TIME-ARENA-PODIUM-ROLL`** | `rollPodiumEpoch(cat)` after expiry; epoch bump; pays winners; clears scores | `test_roll_podium_after_expiry`, `test_roll_podium_settlement_pays_and_clears_scores` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-PODIUM-DIVERGE`** | Per-category rolls reset one `podiumDeadline[cat]`; timers diverge across Streak / Booster / WarBow / Last Buy | `test_podium_timers_diverge_after_single_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-PODIUM-EPOCH-INDEP`** | `podiumEpoch[cat]` counters advance independently | `test_podium_epochs_independent_after_skewed_rolls` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-LAST-BUY-EPOCH`** | `lastBuyEpoch` bumps on Last Buy **hard reset** only (CHARM/CRED), not on other podium rolls | `test_timer_hard_reset_increments_epoch`, `test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)) |
| **`INV-TIME-ARENA-CRED-ACCRUE`** | Each buy (DOUB or CRED) adds **35 CRED** (18 dec) to epoch pool | `test_cred_accrue_on_doub_buy`, `test_cred_accrue_on_cred_buy`, `test_buy_with_cred` ([#311](https://gitlab.com/PlasticDigits/yieldomega/-/issues/311)) |
| **`INV-TIME-ARENA-CRED-CLAIM`** | `claimCred(epoch)` pro-rata by `epochCharmWad`; zeros weight; no double-claim | `test_cred_pro_rata_claim`, `test_cred_pro_rata_exact_1_2_split`, `test_claimCred_cannot_double_claim` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |
| **`INV-TIME-ARENA-CRED-BURN-BUY`** | `buyWithCred` burns **100 CRED** per 1e18 CHARM (`CRED_PER_CHARM_WAD`); same CHARM min/max band | `test_buy_with_cred`, `test_buyWithCred_10charm_burns_1000_cred`, `test_buyWithCred_min_charm_burns_scaled`, `test_buyWithCred_reverts_charm_bounds` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248), [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) · [detail §268](#timearena-cred-buy-gitlab-268) · `bash scripts/verify-cred-buy-anvil.sh` |
| **`INV-PLAY-CRED-NON-TRANSFER`** | `PlayCred` mint/burn only; wallet transfer reverts | [`PlayCred.t.sol`](../../contracts/test/PlayCred.t.sol) ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |
| **`INV-TIME-ARENA-FIRST-BUY-CRED-BONUS`** | First `_finishBuy` per wallet schedules **1100 CRED** for **`lastBuyEpoch + 1`** (110% of starter `buyWithCred` burn); not repeated; survives epoch roll | `test_first_buy_*`, `test_onboarding_two_starter_buys_reach_level_two` ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268), [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) · [detail §268](#timearena-cred-buy-gitlab-268) · [detail §299](#arena-player-progression-gitlab-299) · `bash scripts/verify-cred-buy-anvil.sh` |
| **`INV-ARENA-PROGRESSION-LEVEL-CAP`** | `level` / `unlockedLevel` capped at **5**; surplus XP discarded at max | `test_level_cap_at_five`, `ArenaXp.t.sol::test_applyXpGain_discards_xp_at_max_level` ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) · [detail §299](#arena-player-progression-gitlab-299) |
| **`INV-ARENA-PROGRESSION-TIMER-GATES`** | L1 Last Buy only; L2+ Time Booster; L3+ Streak; L4+ WarBow timer/BP | `test_level_1_gates_timers` … `test_level_4_warbow_bp_and_level_5_flag` ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) |
| **`INV-ARENA-PROGRESSION-WARBOW-GATES`** | L&lt;4 cannot steal/guard/revenge; L&lt;5 cannot plant/cancel flags via buy | `test_level_3_warbow_steal_reverts`, `test_level_4_buy_plant_flag_ignored` ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) |
| **`INV-ARENA-PROGRESSION-UX`** | `/arena` XP hero; lock overlays + `Locked until Level N`; **L2+** level-up confetti glass popover on first unlock; `FeatureMechanicModal` for explicit `?` help | `arenaProgression.test.ts`, `arenaLevelUpCelebration.test.ts`, `LevelUpCelebrationPopover.test.ts`, `arenaBuyProjectedEffects.test.ts`, `ArenaXpHero` ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299), [#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)) · [arena-views §299](../frontend/arena-views.md#arena-player-progression-gitlab-299) |
| **`INV-ARENA-PROGRESSION-GRANDFATHER`** | `grandfatherProgression` sets level 5 for wallets with prior `buyCount > 0` | `test_grandfather_progression` ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) |
| **`INV-TIME-ARENA-XP`** | XP 1–10 linear in CHARM band; level steps per `ArenaXp`; capped at 5; `XpGained` / `LevelUp` / `FeatureUnlocked` events | `ArenaXp.t.sol`, `TimeArena.t.sol::test_xp_*` ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250), [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) |
| **`INV-TIME-ARENA-XP-CHARM-SCALE`** | Each buy awards **`ArenaXp.xpForCharm(charmWad)`** (1 at min band → 10 at max); DOUB and CRED paths identical; indexer **`xp_gained`** = event `amount`; frontend preview **`+Xxp`** tracks cleared CHARM weight | `ArenaXp.t.sol::test_xpForCharm_linear_band`, `TimeArena.t.sol::test_xp_emits_XpGained`, `test_xp_buy_with_cred_same_as_doub`, `arenaXpMath.test.ts`, `arenaBuyProjectedEffects.test.ts`, `integration_stage2.rs` ([#304](https://gitlab.com/PlasticDigits/yieldomega/-/issues/304)) · [detail §304](#timearena-xp-charm-scale-gitlab-304) |
| **`INV-TIME-ARENA-XP-GAS`** | Cached **`level`** + **`xpTowardNext`**; ≤5 level-ups/buy; no reset on epoch; O(1) views; matches `levelFromXp` after each buy | `ArenaXp.t.sol`, `TimeArena.t.sol::test_xp_*` ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)) · [manual QA §265](manual-qa-checklists.md#manual-qa-issue-265) · [detail §265](#timearena-xp-gas-gitlab-265) |
| **`INV-TIME-ARENA-WARBOW-DOUB`** | WarBow spends are DOUB pulls (steal 1000 / guard 10000 / override 50000 / revenge 1000; flag claim 0); **100%** routed to podium vaults; **`totalDoubRaised`** incremented; no stranded balance on **`TimeArena`** ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) | `test_warbow_steal_pulls_doub`, `test_warbow_guard_pulls_doub`, `test_warbow_revenge_pulls_doub`, `test_warbow_steal_limit_override_pulls_doub`, `test_warbow_steal_routes_doub_split`, `test_warbow_flag_claim_zero_doub` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252), [#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) |
| **`INV-TIME-ARENA-WARBOW-BP-STREAK-AMBUSH`** | Buy-path WarBow BP includes **streak-break** and **ambush** bonuses per sim (`warbow_buy_bp_delta`) when a different buyer breaks an active defended streak under the window ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) | `test_warbow_streak_break_bp`, `test_warbow_ambush_bp_on_hard_reset_streak_break` |
| **`INV-TIME-ARENA-WARBOW-EPOCH-RESET`** | WarBow `rollPodiumEpoch` / autoroll clears live BP (`warbowBpGeneration` bump), pays on-chain top-3 **4∶2∶1**, emits **`WarbowPodiumFinalized`**; admin `finalizeWarbowPodium` superseded | `test_warbow_epoch_roll_clears_battle_points`, `test_warbow_roll_auto_pays_onchain_winners` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252), [#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)) |
| **`INV-TIME-ARENA-AUTOROLL-312`** | Buys/WarBow autoroll expired podiums when unpaused; no `timer expired` revert on Last Buy deadline | `test_buy_autorolls_after_last_buy_deadline`, `test_warbow_steal_autorolls_after_last_buy_deadline`, `test_autoroll_no_double_payout_same_tx` ([#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)) |
| **`INV-TIME-ARENA-WARBOW-RANK-312`** | WarBow podium top-3 matches brute-force ≤100 players; tie-break lower address; O(1) ≤6-address merge (global + off-podium buffer) — off-podium displacement without reinsert is a gas tradeoff; qualifying buy/BP update with strictly higher BP (or equal BP + better tie-break) must enter the merge set | `test_warbow_ranking_matches_brute_force`, `test_warbow_tie_break_lower_address_wins`, `test_warbow_off_podium_tie_break_promotes_to_global`, `test_warbow_higher_bp_buy_enters_podium` ([#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)) · [benchmark § tradeoff](warbow-ranking-benchmark-312.md#6-address-tracking-tradeoff-gas-vs-accuracy) |
| **`INV-TIME-ARENA-PAUSE-MUTATING`** | `setPaused(true)` blocks `buy`, `buyWithCred`, `warbowSteal` / `warbowActivateGuard` / `warbowRevenge`, and `claimWarBowFlag` via `_requireLive` (`TimeArena: paused`); flag claim does **not** bypass pause | `test_pause_blocks_*` ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) · [detail §316](#timearena-negative-tests-dry-gas-gitlab-316) |
| **`INV-TIME-ARENA-WARBOW-REVERT-MATRIX`** | WarBow ingress reverts: steal band, daily cap (`steal limit`), revenge window, flag holder/silence, double finalize, bad victim/epoch | `test_warbow_*_reverts_*`, `test_finalize_warbow_podium_reverts_*` ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) |
| **`INV-TIME-ARENA-CHARM-BOUNDS-DRY`** | Single `ArenaCharmBounds` library supplies min/max WAD + `validate` for `TimeArena`, `ArenaXp`, `ArenaCharmPriceTwap` | `ArenaCharmBounds.sol`, `TimeArena.t.sol::test_buy_reverts_charm_*` ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) |
| **`INV-TIME-ARENA-BUY-ROUTING-GAS`** | Default `PodiumVaults` (all pool slots → `address(vaults)`) batches buy/top-up DOUB into **one** `safeTransfer` per routing call; per-tranche `PodiumEpochFunded` / `PodiumFunded` events unchanged; economics unchanged ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)) | `TimeArena.sol::_routeDoubPrizeSplit`, `test_buy_routes_doub_split` ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) |
| **`INV-ERC20-123-NONSTANDARD`** | Fee-on-transfer DOUB reverts on buy, WarBow DOUB pulls, and `topUpPodiumPools` (`TimeArena: ERC20 parity`) | `NonStandardERC20.t.sol`, `TimeArena.t.sol::test_feeOnTransfer_buy_reverts_erc20Parity` ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123), [#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) |
| **`INV-TIME-ARENA-ALWAYS-LIVE`** | No sale-end or charm-redemption gates; only `paused` | `TimeArena.sol` + negative grep in arena contracts |
| **`INV-CONTRACTS-329-OWNABLE2STEP`** | **`TimeArena`** + **`ReferralRegistry`** UUPS proxies use **`Ownable2StepUpgradeable`**; ownership transfer requires **`acceptOwnership`**; UUPS **`upgradeTo`** remains **`onlyOwner`** (multisig/timelock out of scope) | `TimeArena.t.sol::test_ownable2step_*`, `ReferralRegistry.t.sol::test_ownable2step_*`, `DevStackIntegration.t.sol` ([#329](https://gitlab.com/PlasticDigits/yieldomega/-/issues/329)) · [security §329](../onchain/security-and-threat-model.md#uups-ownership-upgrades-gitlab-329) |
| **`INV-REMOVAL-243-NO-LAUNCHPAD-LIFECYCLE`** | No retired v1 launchpad cores (`TimeCurve`, `LinearCharmPrice`), sale-end / charm-redemption / prize-distribution gates, or `/vesting` route; **`DoubPresaleVesting`** removed from active **`ADDRESS_REGISTRY`** ([#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)) | `rg` clean in `contracts/src`; no `PresaleVestingPage`; no `DoubPresaleVesting` in [`address-registry.megaeth-mainnet.json`](../../indexer/address-registry.megaeth-mainnet.json); `LaunchGate.tsx` routes; [`surfaceContent.ts`](../../frontend/src/lib/surfaceContent.ts) → `/arena` ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)) |
| **`INV-FRONTEND-256-UNIFIED-ARENA`** | Unified **`/arena`**: single command-console surface; Last Buy hero primary; DOUB-primary pay toggles (DOUB/ETH/USDM/CRED); four podium cards with epoch + rankings; WarBow hero with onchain DOUB cost labels; BUY/AUDIT sub-nav only ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256), [#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291)) | `ArenaTimerChips.test.tsx`, [`arenaPayTokenOptions.ts`](../../frontend/src/lib/arenaPayTokenOptions.ts) (DOUB-primary labels), `arenaCommandConsoleStatic.test.ts`, `e2e/anvil-arena-01-mount.spec.ts`, `e2e/anvil-arena-*.spec.ts` · [arena-views § unified](../frontend/arena-views.md#unified-arena-page-gitlab-256) · [§291](../frontend/arena-views.md#arena-command-console-gitlab-291) |
| **`INV-FRONTEND-260-ARENA-MOUNT`** | `/arena` mounts `arena-command-console`, timer chips, CRED card, WarBow hero, and podiums exactly once | `e2e/anvil-arena-01-mount.spec.ts` |
| **`INV-FRONTEND-269-CRED-BUY`** | Arena buy picker includes CRED when `playCred` set; burn preview from onchain constants; submit `buyWithCred` | `arenaCredBurn.test.ts`, `e2e/anvil-arena-04-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| **`INV-FRONTEND-257-CHARM-CRED-CARD`** | **`ArenaCharmCredCard`**: shows **`lastBuyEpoch`**, current-epoch **`epochCharmWad`**, accruing **`pendingCred`**; **Claim CRED** calls **`claimCred(lastBuyEpoch - 1)`** when ended epoch has pending (not active epoch — requires **`epoch < lastBuyEpoch`**); empty states per [#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200) | `arenaCharmCredClaim.test.ts`, `e2e/anvil-arena-02-onchain-reads.spec.ts` ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)) · [arena-views § charm-cred](../frontend/arena-views.md#charm-cred-card-gitlab-257) |
| **`INV-INDEXER-260-ARENA-TIMERS`** | `GET /v1/arena/timers` (+ buys) | `integration_stage2.rs::api_http_smoke` |
| **`INV-INDEXER-255-WALLET-STATS`** | `GET /v1/arena/wallet/{address}/stats` — full participant profile aggregates (no stub zeros); schema **≥ 2.4.0** | `arena_wallet_stats.rs`, `integration_stage2.rs::arena_wallet_stats_two_epochs_and_bonus_fields` ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)) |
| **`INV-INDEXER-329-ADDRESS-VALIDATE`** | Arena + referral wallet path/query params use shared **`valid_0x_address20`** (`api_validate.rs`); non-hex `0x`+42 → **400** `invalid_address` (not 200 empty stats) | `api_validate.rs`, `api_arena.rs`, `api.rs`, `bash scripts/verify-wallet-profile-anvil.sh` ([#329](https://gitlab.com/PlasticDigits/yieldomega/-/issues/329)) |
| **`INV-INDEXER-260-NO-TIMECURVE-DECODE`** | No legacy sale `DecodedEvent` variants; Arena + referral registry only | `decoder.rs`, `integration_stage2.rs::postgres_stage2_persist_all_events_and_rollback_after` |
| **`INV-INDEXER-254-ARENA-SCHEMA`** | Fresh DB: `idx_arena_buy`, `idx_arena_podium_epoch`, view `idx_arena_podium_snapshot`, `idx_play_cred_claim`, `idx_player_xp`, `idx_warbow_epoch_score`; no legacy-only buy tables; `GET /v1/arena/{timers,podiums,buys}`; WarBow BP snapshots on BP-affecting logs; schema **≥ 2.5.0** | `20240601000000_arena_v2.up.sql`, `integration_stage2.rs` ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)) |
| **`INV-INDEXER-PODIUM-PREDICT-LIVE`** | `GET /v1/arena/podiums`: UX order; head epochs; live top-3 from `idx_arena_podium_live` + WarBow scores; `podium_prediction` true only when DB-derived; ingest snapshots on Buy/WarBow/epoch events; reorg clears live table; **`chain_timer`** uses `podiumDeadline(uint256)` / `podiumEpoch(uint256)` array getters (not `uint8`) | `arena_podium_live.rs`, `chain_timer.rs`, `integration_stage2.rs::arena_podiums_live_predictions_smoke`, `bash scripts/verify-podium-live-anvil.sh` ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) · [design § podiums](../indexer/design.md#arena-podiums-http) · [detail §273](#indexer-live-podium-predictions-gitlab-273) |
| **`INV-INDEXER-PODIUM-PRIZE-PREVIEW`** | `GET /v1/arena/podiums` rows include **`prize_places_doub_wad`** (3 wad strings) + **`active_pool_balance_doub_wad`** from head **`PodiumVaults.activePoolBalance(cat)`** × 4∶2∶1 at **`read_block_number`**; zero pool → `"0"` places (not omitted); schema **≥ 2.8.0** | `arena_podium_prize.rs`, `chain_timer.rs`, `api_arena.rs`, `integration_stage2.rs::arena_podiums_live_predictions_smoke`, `bash scripts/verify-podium-prize-preview-anvil.sh` ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)) · [design § podiums](../indexer/design.md#arena-podiums-http) |
| **`INV-TIME-ARENA-PODIUM-TOPUP`** | `topUpPodiumPools` sends 100% of DOUB to eight prize vaults (10:7.5 active:seed per category); **no** admin take; **no** `totalDoubRaised` bump | `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*` |
| **`INV-INDEXER-262-DONATE-POOLS`** | `PodiumPoolsToppedUp` → `idx_arena_podium_pool_top_up`; `GET /v1/arena/podium-pool-donations` | `integration_stage2.rs` |
| **`INV-FRONTEND-262-DONATE-POOLS`** | AUDIT card disclosure + indexer empty/offline placeholders + write gate | `ArenaProtocolDonatePoolsSection.test.tsx`, `e2e/arena.spec.ts` |
| **`INV-INDEXER-282-ARENA-BUYS-SECONDS`** | `GET /v1/arena/buys` items include **`actual_seconds_added`** (decimal string from `idx_arena_buy`; matches DB for `tx_hash`/`log_index`; not client-recomputed) | `integration_stage2.rs::api_arena_buys_actual_seconds_added_smoke`, `bash scripts/verify-wallet-profile-anvil.sh` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)) |
| **`INV-INDEXER-283-ARENA-BUYS-PARITY`** | `GET /v1/arena/buys` items include **`new_deadline`**, **`buy_index`**, **`log_index`**, **`block_timestamp`** (unix sec string or `null`; matches `idx_arena_buy` for `tx_hash`/`log_index`; not client-recomputed) | `integration_stage2.rs::api_arena_buys_actual_seconds_added_smoke`, `bash scripts/verify-wallet-profile-anvil.sh` ([#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)) |
| **`INV-INDEXER-336-WALLET-LEVEL-HISTORY`** | `GET /v1/arena/wallet/{address}/stats` includes **`level_history`** (levels 1–5; **`reached_at`** UTC ISO-8601 or JSON **`null`**). Level 1 = earliest **`idx_arena_buy`**; levels 2–5 = earliest **`idx_arena_level_up`** per **`new_level`**. Reorg rollback clears rolled-back milestones. | `arena_wallet_stats.rs` unit tests, `integration_stage2.rs::arena_wallet_stats_level_history_and_reorg`, `bash scripts/verify-wallet-profile-anvil.sh` ([#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336)) |
| **`INV-FRONTEND-258-WALLET-PROFILE`** | Participant **`AddressInline`** on live buy rows, podium winners, and WarBow steal-target rows opens profile modal (`onOpenProfile` / `onOpenWalletProfile`); explorer link only inside modal; modal renders all stats sections from **`GET /v1/arena/wallet/{address}/stats`** including **Level history** ([#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336)); timer-extension chip needs **`actual_seconds_added`** on buy rows ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)); buy detail / React keys need full buy-row parity ([#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)) | `LiveBuyRow.test.tsx`, `ArenaLiveBuysActivitySection.test.tsx`, `ArenaSimplePodiumSection.test.tsx`, `arenaSimplePlaySurface.test.ts`, `WalletProfileModalSections.test.tsx`, `indexerApi.test.ts`, `bash scripts/verify-wallet-profile-anvil.sh` ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258), [#318](https://gitlab.com/PlasticDigits/yieldomega/-/issues/318)) · [arena-views § wallet-profile](../frontend/arena-views.md#wallet-profile-modal-gitlab-258) |
| **`INV-FRONTEND-318-PLAY-SURFACE-COPY`** | Play route (`/`) has no user-visible `\bsale\b` framing (pre-launch + live); pre-open copy uses arena-live language from `arenaSimplePhase.ts`; buy/revert guard strings avoid sale wording on TimeArena paths ([#318](https://gitlab.com/PlasticDigits/yieldomega/-/issues/318)) | `arenaSimplePlaySurface.test.ts`, `revertMessage.test.ts`, `cd frontend && npm run typecheck && npm run lint && npm test` · [frontend-content-audit §318](frontend-content-audit.md) |
| **`INV-INDEXER-278-LAST-BUY-EPOCH`** | `LastBuyEpochStarted` → `idx_arena_last_buy_epoch_started`; each `idx_arena_buy.last_buy_epoch` from ordered global head (not per-wallet `timer_hard_reset` window); wallet stats `epochs_participated` uses stored column | `last_buy_epoch_head.rs`, `persist.rs`, `integration_stage2.rs::last_buy_epoch_global_assignment_non_resetting_participant`, `bash scripts/verify-last-buy-epoch-anvil.sh` ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)) |
| **`INV-INDEXER-267-VAULT-FUNDING`** | Buy-sourced **`PodiumEpochFunded`** (+ legacy top-up **`PodiumFunded`/`SeedFunded`**) → `idx_arena_vault_funding`; sum per `tx_hash` = `doub_paid` for DOUB buys; CRED buys have zero funding rows ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)) | `integration_stage2.rs` (`api_vault_funding_smoke`) · `bash scripts/verify-vault-funding-anvil.sh` |
| **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** | Arena routes gate writes on **`TimeArena.paused`** only (not `buyFeeRoutingEnabled`); DOUB direct **`buy`** + ETH/USDM **`TimeArenaBuyRouter.buyViaKumbaya`** when router set; env router mismatch fail-closed ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)) | `kumbayaRoutes.test.ts`, `arenaV2SaleSessionBridge.test.ts`, `e2e/anvil-arena-03-wallet-writes.spec.ts` (DOUB + ETH when Kumbaya env set) · see [§264](#arena-frontend-pay-pause-gitlab-264) |
| **`INV-FRONTEND-266-ARENA-ROUTES`** | Canonical play at `/arena`, AUDIT at `/arena/protocol`; `/arena/*` redirects; env requires `VITE_TIME_ARENA_ADDRESS` only | `LaunchGate.tsx`, `scripts/check-frontend-vite-env.sh`, `e2e/navigation.spec.ts` |
| **`INV-FRONTEND-327-PRODUCTION-MOCK-WALLET`** | Production `npm run build` / `vite build` refuses `VITE_E2E_MOCK_WALLET=1` unless `ANVIL_E2E=1` (Playwright Anvil E2E only); `vite dev` and Anvil auto-mock without the flag unchanged ([#327](https://gitlab.com/PlasticDigits/yieldomega/-/issues/327)) | `viteProductionEnvGuard.test.ts`, `frontend/vite.config.ts`, `bash scripts/check-frontend-vite-env.sh --production`, `unit-tests` **`frontend-test`** job |
| **`INV-FRONTEND-266-ARENA-INDEXER`** | Browser reads use **`/v1/arena/*`** only; no **`/v1/timecurve/*`** or legacy WarBow HTTP | `indexerApi.test.ts` (#266 retirement), `indexer/src/api_arena.rs` |
| **`INV-FRONTEND-280-ARENA-CSS-NAMING`** | No `timecurve-*` CSS classes, `data-testid`s, or `/art/.../timecurve-*` paths under `frontend/src/pages/arena/**`; public art uses `arena-*` filenames; legacy `/timecurve` URL redirects unchanged ([#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280)) | `bash scripts/check-arena-naming.sh`, `ArenaSimplePodiumSection.test.tsx`, `e2e/footer-site-links.spec.ts` · [arena-views §280](../frontend/arena-views.md#arena-css-naming-gitlab-280) · [manual QA §280](manual-qa-checklists.md#manual-qa-issue-280) |
| **`INV-FRONTEND-286-ART-README`** | [`frontend/public/art/README.md`](../../frontend/public/art/README.md) consumer links resolve to existing `frontend/src/**` files; no deleted `TimeCurve*.tsx` / `timeCurveArena/*` targets; `ArenaSimplePage` links use `pages/arena/ArenaSimplePage.tsx` ([#286](https://gitlab.com/PlasticDigits/yieldomega/-/issues/286)) | `bash scripts/check-art-readme-consumers.sh` · [design §286](../frontend/design.md#art-readme-consumer-links-gitlab-286) |
| **`INV-FRONTEND-290-CYBER-GLASS-SHELL`** | Global chrome uses cyberminimalist glass tokens (`--yo-*`), dark RainbowKit wallet theme, compact BUY/AUDIT route decisions, and no visible shell copy that implies retired TimeCurve/PvE/sale-end mechanics ([#290](https://gitlab.com/PlasticDigits/yieldomega/-/issues/290)) | `headerLayoutCss.test.ts`, `AppProviders.test.ts`, `ArenaSubnav.test.tsx`, `surfaceContent.test.ts` · [design §290](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290) · [arena-views § unified](../frontend/arena-views.md#unified-arena-page-gitlab-256) |
| **`INV-FRONTEND-291-ARENA-COMMAND-CONSOLE`** | `/arena` does **not** mount the static concept mock above the live stack; production surface uses `arena-command-console`, Last Buy primary, inline CHARM buy, DOUB price / 0.99–10 CHARM range / CRED yield decision row, secondary timers + WarBow operations rail, and recognizable cyberminimalist character treatment ([#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291)) | `arenaCommandConsoleStatic.test.ts`, `e2e/anvil-arena-01-mount.spec.ts`, `e2e/arena.spec.ts` · [arena-views §291](../frontend/arena-views.md#arena-command-console-gitlab-291) · [manual QA §291](manual-qa-checklists.md#manual-qa-issue-291) |
| **`INV-FRONTEND-292-ARENA-PRODUCTION-COMPONENTS`** | Production Arena components present current mechanics: DOUB podium prizes + USD equivalent, current epoch per podium, blockie + last-six address labels, activity feed from **`GET /v1/arena/activity`** (buy/steal/guard/revenge deltas), epoch CHARM/CRED yield card, and grouped WarBow Steal/Guard/Revenge/Flag actions ([#292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292)) | `ArenaSimplePodiumSection.test.tsx`, `ArenaLiveBuysActivitySection.test.tsx`, `LiveBuyRow.test.tsx`, `indexerApi.test.ts`, `indexer/tests/integration_stage2.rs::postgres_stage2_persist_all_events_and_rollback_after` · [arena-views §292](../frontend/arena-views.md#arena-production-components-gitlab-292) · [manual QA §292](manual-qa-checklists.md#manual-qa-issue-292) |
| **`INV-FRONTEND-293-ARENA-AUDIT-SURFACES`** | `/arena/protocol` renders a compact **AUDIT** console with state/routing/activity priorities, current Arena v2 copy (no legacy TimeCurve sale/redemption/fee-sink framing), donate-pools disclosure + chain gate, wallet-profile participant actions, and blockie + explorer contract/vault addresses ([#293](https://gitlab.com/PlasticDigits/yieldomega/-/issues/293)) | `FeeTransparency.test.tsx`, `ArenaProtocolDonatePoolsSection.test.tsx`, `ArenaLiveBuysActivitySection.test.tsx`, `e2e/arena.spec.ts` · [arena-views §293](../frontend/arena-views.md#arena-audit-protocol-surfaces-gitlab-293) · [manual QA §293](manual-qa-checklists.md#manual-qa-issue-293) |
| **`INV-FRONTEND-294-SHARED-PRIMITIVES`** | Shared modals, wallet profile, address rows, chain gates, status/empty states, amount displays, and indexer status use the cyberminimalist glass system across `/arena`, `/arena/protocol`, `/referrals`, and secondary routes while preserving #95/#258 behavior and frontend formatting policies ([#294](https://gitlab.com/PlasticDigits/yieldomega/-/issues/294)) | `SharedUxPrimitives.test.tsx`, `AmountDisplay.test.ts`, `WalletProfileModalSections.test.tsx`, `LiveBuyRow.test.tsx`, `chainMismatchWriteGuard.test.ts`, `cd frontend && npm run typecheck && npm run lint && npm test`, `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/arena.spec.ts e2e/referrals-surface.spec.ts`; visual/Rabby pass per [manual QA §294](manual-qa-checklists.md#manual-qa-issue-294) · [design §294](../frontend/design.md#shared-frontend-primitives-gitlab-294) · [arena-views §294](../frontend/arena-views.md#shared-frontend-primitives-gitlab-294) |
| **`INV-FRONTEND-295-HOME-COUNTDOWN-BRAND`** | Home and launch countdown entry surfaces use the approved cyberminimalist glass direction, route users toward immediate PvP TimeArena play and AUDIT verification, preserve recognizable Yield Omega characters as tactical accents, and contain no visible TimeCurve/sale/PvE/worldbuilding framing ([#295](https://gitlab.com/PlasticDigits/yieldomega/-/issues/295)) | `surfaceContent.test.ts`, `LaunchCountdownPage.test.tsx`, `e2e/home.spec.ts`, `e2e/launch-countdown.spec.ts`, `cd frontend && npm run typecheck && npm run lint && npm test`; visual/Rabby pass per [manual QA §295](manual-qa-checklists.md#manual-qa-issue-295) · [design §290/#295](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290) |
| **`INV-FRONTEND-296-SECONDARY-SURFACES`** | `/referrals`, Kumbaya/Sir venue pages, 404, and under-construction fallbacks use the approved cyberminimalist glass direction, compact action-first copy, flat referral CRED mechanics (**5 CRED + 5 CRED** on referred DOUB buys), canonical `/arena/{code}` share links, external venue trust boundaries, and no stale TimeCurve/sale/PvE cross-sell framing ([#296](https://gitlab.com/PlasticDigits/yieldomega/-/issues/296)) | `e2e/referrals-surface.spec.ts`, `e2e/navigation.spec.ts`, `e2e/footer-site-links.spec.ts`, `cd frontend && npm run typecheck && npm run lint && npm test`; focused Playwright `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/referrals-surface.spec.ts e2e/navigation.spec.ts e2e/footer-site-links.spec.ts`; Rabby/Chromium visual pass per [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296) · [design §296](../frontend/design.md#secondary-product-surfaces-gitlab-296) · [product referrals](../product/referrals.md#referrals-dashboard-issue-94) |
| **`INV-FRONTEND-297-ART-MOTION-AUDIO`** | Existing bunny/sniper-shark cast remains recognizable across routes, consumed scene backplates use dark cyberminimalist command-console SVGs instead of the older bright arcade JPGs, motion stays subtle, and Arena SFX are sparse enough for active feeds ([#297](https://gitlab.com/PlasticDigits/yieldomega/-/issues/297)) | `arenaCommandConsoleStatic.test.ts`, `bash scripts/check-art-readme-consumers.sh`, `cd frontend && npm run typecheck && npm run lint && npm test`; visual pass of Home, countdown, `/arena`, `/arena/protocol`, and Referrals per [manual QA §297](manual-qa-checklists.md#manual-qa-issue-297) |
| **`INV-FRONTEND-335-LEVEL-UP-CELEBRATION`** | Auto level-up feedback on play **`/`** uses a glass confetti popover (**L2+** only); L1 / wallet connect alone does not celebrate; `prefers-reduced-motion` disables confetti but keeps the popover; full mechanic copy remains on explicit help ([#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)) | `arenaLevelUpCelebration.test.ts`, `LevelUpCelebrationPopover.test.ts`, `cd frontend && npm run typecheck && npm run lint && npm test` · [arena-views §335](../frontend/arena-views.md#level-up-celebration-gitlab-335) |
| **`INV-FRONTEND-298-UX-DOCS-E2E`** | Docs, manual QA, page-by-page content audit, and Playwright E2E reflect the cyberminimalist command-console redesign on every routed surface; **Yield Omega** branding in user-facing expectations; `arena-*` CSS naming preserved; product mechanics described only via canonical TimeArena docs ([#298](https://gitlab.com/PlasticDigits/yieldomega/-/issues/298)) | [frontend-content-audit.md](frontend-content-audit.md), `surfaceContent.test.ts`, `arenaCommandConsoleStatic.test.ts`, `bash scripts/check-arena-naming.sh`, `cd frontend && npm run typecheck && npm run lint && npm test`; focused Playwright `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/arena.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts e2e/referrals-surface.spec.ts e2e/footer-site-links.spec.ts e2e/launch-countdown.spec.ts e2e/surface-shells.spec.ts e2e/referral-path.spec.ts`; visual/Rabby pass per [manual QA §298](manual-qa-checklists.md#manual-qa-issue-298) · [arena-views §298](../frontend/arena-views.md#frontend-ux-docs-e2e-gitlab-298) · [design §298](../frontend/design.md#frontend-ux-docs-e2e-gitlab-298) |
| **`INV-FRONTEND-301-INDEXER-FIRST-DISPLAY`** | With **`VITE_INDEXER_URL`** set, Arena display hooks do **not** run recurring browser **`eth_call`** multicalls or contract-event watches for podiums, podium deadlines, hero timer, or core sale head; indexer outage shows status bar + stale cache only; unset URL shows dev banner without hidden RPC polling ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)) | `indexerFirstDisplay.test.ts`, `ArenaTimerChips.test.tsx`, `arenaV2SaleSessionBridge.test.ts`, `cd frontend && npm run typecheck && npm run lint && npm test` · [arena-views §301](../frontend/arena-views.md#indexer-first-display-gitlab-301) · [manual QA §301](manual-qa-checklists.md#manual-qa-issue-301) |
| **`INV-FRONTEND-337-BUY-EFFECT-TOASTS`** | Successful CHARM buy on **`/`** emits one compact glass toast per buy effect (timer, XP, level, WarBow, flag, Last Buyer); **fixed viewport overlay** (portaled, non-blocking), preview lines on tx success with indexer upgrade when head buy indexes, auto-dismisses (~4s), caps visible stack at 4, and respects **`prefers-reduced-motion`** ([#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337)) | `arenaBuyEffectToastLines.test.ts`, `ArenaEffectToastStack.test.tsx`, `cd frontend && npm run typecheck && npm run lint && npm test`, `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/anvil-arena-03-wallet-writes.spec.ts` · [arena-views §337](../frontend/arena-views.md#post-buy-effect-toasts-gitlab-337) · [manual QA §337](manual-qa-checklists.md#manual-qa-issue-337) |
| **`INV-INDEXER-338-SESSION-SUMMARY`** | `GET /v1/arena/session-summary?since_ms=&wallet=` returns absent-session aggregates; `since_ms` clamped to 30d; future skew >60s → **400**; optional wallet uses **`valid_0x_address20`**; podium finals capped at 20 rows; **`idx_arena_podium_epoch.block_timestamp`** populated on ingest; schema **≥ 2.18.0** ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)) | `arena_session_summary.rs`, `integration_stage2.rs::arena_session_summary_fixture_since_activity` · [design §338](../indexer/design.md#arena-session-summary-http-gitlab-338) |
| **`INV-FRONTEND-338-WYWA-MODAL`** | Play `/` persists **`yieldomega.arena.lastClosedAt.v1`** on tab hide; skips first visit and indexer-offline; fetches session summary indexer-first; glass **`WhileYouWereAwayModal`** shows elapsed time, buy/podium/player aggregates, wallet rank delta, and winner congratulations ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)) | `WhileYouWereAwayModal.test.tsx`, `whileYouWereAwayActivity.test.ts`, `arenaSessionClose.test.ts`, `TimeArenaPage.test.tsx`, `indexerApi.test.ts`, `cd frontend && npm run typecheck && npm run lint && npm test` · [arena-views §338](../frontend/arena-views.md#while-you-were-away-modal-gitlab-338) · screenshots [issue-338](../testing/screenshots/issue-338/README.md) |
| **`INV-FRONTEND-339-UX-UNIT-TESTS`** | Gap-analysis [#331](https://gitlab.com/PlasticDigits/yieldomega/-/issues/331) visual children each have ≥1 focused Vitest file or describe block with happy + sad paths; wiring/render/state transitions only (no duplicate mechanic math); indexer-off / reduced-motion / L1-no-celebration / empty-level-history sad paths covered ([#339](https://gitlab.com/PlasticDigits/yieldomega/-/issues/339)) | Child→test map: [#334](https://gitlab.com/PlasticDigits/yieldomega/-/issues/334) `arenaProgression.test.ts`, `ArenaTimerPodiumCarousel.test.tsx`, `ArenaSimplePodiumSection.test.tsx` · [#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335) `arenaLevelUpCelebration.test.ts`, `LevelUpCelebrationPopover.test.tsx`, `arenaVisualUxHooks.test.ts` · [#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336) `WalletProfileModalSections.test.tsx` · [#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337) `arenaBuyEffectToastLines.test.ts`, `ArenaEffectToastStack.test.tsx`, `mobileBuyEffectToastLayout.test.ts` · [#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338) `WhileYouWereAwayModal.test.tsx`, `whileYouWereAwayActivity.test.ts`, `arenaSessionClose.test.ts`, `TimeArenaPage.test.tsx` · play wiring `ArenaSimplePage.test.tsx` · `cd frontend && npm run typecheck && npm run lint && npm test` · [frontend-content-audit § play](frontend-content-audit.md#-time-arena-play-surface) |
| **`INV-FRONTEND-340-PLAY-FEEL-E2E`** | Gap-analysis [#331](https://gitlab.com/PlasticDigits/yieldomega/-/issues/331) visual children have Anvil play-feel Playwright coverage with stable `data-testid` selectors; happy + sad paths (first-visit WYWA omission, L1-no-celebration, indexer-off skips indexer-first blocks); no live activity strip on `/` ([#340](https://gitlab.com/PlasticDigits/yieldomega/-/issues/340)) | `e2e/anvil-arena-05-play-feel.spec.ts`, `e2e/anvil-arena-03-wallet-writes.spec.ts` ([#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337)); `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/anvil-arena-*.spec.ts` after `bash scripts/e2e-anvil.sh` (indexer-first WYWA + level history: `YIELDOMEGA_E2E_INDEXER=1`); child→spec map in [frontend-content-audit § play](frontend-content-audit.md#-time-arena-play-surface) · [e2e-anvil.md §340](e2e-anvil.md) |

<a id="frontend-post-buy-effect-toasts-gitlab-337"></a>

### Frontend post-buy effect toasts (GitLab [#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-337-BUY-EFFECT-TOASTS`** | (see summary row above) | `arenaBuyEffectToastLines.test.ts`, `ArenaEffectToastStack.test.tsx`; Anvil buy on **`/`** shows ≥1 toast with timer/XP copy · [sound §297](../frontend/sound-effects-recommendations.md) sparse chime on first toast only |

<a id="while-you-were-away-gitlab-338"></a>

### While You Were Away session summary (GitLab [#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-338-SESSION-SUMMARY`** | (see summary row above) | `cd indexer && cargo test` · `YIELDOMEGA_PG_TEST_URL=… cargo test --test integration_stage2 arena_session_summary_fixture_since_activity` |
| **`INV-FRONTEND-338-WYWA-MODAL`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; desktop/tablet/mobile screenshots in [issue-338](../testing/screenshots/issue-338/README.md) |

<a id="frontend-ux-unit-tests-gitlab-339"></a>

### Frontend UX unit tests for #331 visual features (GitLab [#339](https://gitlab.com/PlasticDigits/yieldomega/-/issues/339))

Follow-up to gap analysis [#331](https://gitlab.com/PlasticDigits/yieldomega/-/issues/331): consolidate Vitest regression coverage once visual children land — wiring, render, and state transitions with explicit happy/sad test names; no snapshot-only asserts.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-339-UX-UNIT-TESTS`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test` · child→test mapping in summary row · [frontend-content-audit § play](frontend-content-audit.md#-time-arena-play-surface) |

<a id="frontend-play-feel-e2e-gitlab-340"></a>

### Frontend Anvil play-feel E2E for #331 visual features (GitLab [#340](https://gitlab.com/PlasticDigits/yieldomega/-/issues/340))

Follow-up to gap analysis [#331](https://gitlab.com/PlasticDigits/yieldomega/-/issues/331): Anvil Playwright play-feel coverage once visual children land — stable `data-testid` selectors, happy/sad paths, indexer-first optional blocks per [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-340-PLAY-FEEL-E2E`** | (see summary row above) | `e2e/anvil-arena-05-play-feel.spec.ts` · `bash scripts/e2e-anvil.sh` · `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` · [e2e-anvil.md §340](e2e-anvil.md) · [frontend-content-audit § play](frontend-content-audit.md#-time-arena-play-surface) |

<a id="frontend-indexer-first-display-gitlab-301"></a>

### Frontend indexer-first display (GitLab [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-301-INDEXER-FIRST-DISPLAY`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; manual: `VITE_RPC_DEBUG=1` with indexer on — no recurring podium/deadline/sale-head multicall spam · [arena-views §301](../frontend/arena-views.md#indexer-first-display-gitlab-301) |

<a id="frontend-cyberminimalist-glass-shell-gitlab-290"></a>

### Frontend cyberminimalist glass shell (GitLab [#290](https://gitlab.com/PlasticDigits/yieldomega/-/issues/290))

Follow-up to the Arena v2 route cleanup: shared app chrome, design tokens, wallet
theme, and route labels must reflect the current TimeArena mechanics rather than
legacy arcade / TimeCurve / PvE assumptions.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-290-CYBER-GLASS-SHELL`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test` |

<a id="frontend-arena-command-console-gitlab-291"></a>

### Frontend Arena command console (GitLab [#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291))

Follow-up to the approved cyberminimalist shell: the **`/arena`** route itself must be one command-console production surface, not a mounted static concept plus a separate legacy stack.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-291-ARENA-COMMAND-CONSOLE`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; visual/Rabby pass per [manual QA §291](manual-qa-checklists.md#manual-qa-issue-291) |

<a id="frontend-arena-production-components-gitlab-292"></a>

### Frontend Arena production components (GitLab [#292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292))

Follow-up to the command-console layout: real production components must expose current Arena v2 mechanics without retired sale / leaderboard assumptions.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-292-ARENA-PRODUCTION-COMPONENTS`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; `cd indexer && cargo test postgres_stage2_persist_all_events_and_rollback_after` with `YIELDOMEGA_PG_TEST_URL`; visual/Rabby pass per [manual QA §292](manual-qa-checklists.md#manual-qa-issue-292) |

<a id="frontend-arena-audit-surfaces-gitlab-293"></a>

### Frontend Arena AUDIT surfaces (GitLab [#293](https://gitlab.com/PlasticDigits/yieldomega/-/issues/293))

Follow-up to the production component pass: the **`/arena/protocol`** route must read as the approved AUDIT console, not a reskinned legacy protocol page.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-293-ARENA-AUDIT-SURFACES`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; visual/Rabby pass per [manual QA §293](manual-qa-checklists.md#manual-qa-issue-293) |

<a id="frontend-shared-primitives-gitlab-294"></a>

### Frontend shared UX primitives (GitLab [#294](https://gitlab.com/PlasticDigits/yieldomega/-/issues/294))

Follow-up to the approved cyberminimalist shell and production Arena passes:
shared primitives must look native everywhere they appear, without changing
indexer/API contracts or wallet-write behavior.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-294-SHARED-PRIMITIVES`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; Rabby/Chromium visual pass per [manual QA §294](manual-qa-checklists.md#manual-qa-issue-294) |

<a id="frontend-home-countdown-brand-gitlab-295"></a>

### Frontend Home + countdown brand surfaces (GitLab [#295](https://gitlab.com/PlasticDigits/yieldomega/-/issues/295))

Follow-up to the approved cyberminimalist shell: the Home hub and build-time
launch countdown must act as gameplay-first entry surfaces for current
TimeArena mechanics, not a reskinned legacy launchpad or lore/worldbuilding
page.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-295-HOME-COUNTDOWN-BRAND`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/home.spec.ts e2e/launch-countdown.spec.ts`; Rabby/Chromium visual pass per [manual QA §295](manual-qa-checklists.md#manual-qa-issue-295) |

<a id="frontend-secondary-surfaces-gitlab-296"></a>

### Frontend secondary product surfaces (GitLab [#296](https://gitlab.com/PlasticDigits/yieldomega/-/issues/296))

Follow-up to the shared shell and home/countdown passes: secondary routes must
feel first-party and current without reskinning stale referral, venue, or fallback
copy.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-296-SECONDARY-SURFACES`** | (see summary row above) | `cd frontend && npm run typecheck && npm run lint && npm test`; `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/referrals-surface.spec.ts e2e/navigation.spec.ts e2e/footer-site-links.spec.ts`; Rabby/Chromium visual pass per [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296) |

<a id="frontend-art-motion-audio-gitlab-297"></a>

### Frontend art, motion, and audio treatment (GitLab [#297](https://gitlab.com/PlasticDigits/yieldomega/-/issues/297))

Follow-up to the cyberminimalist shell and route passes: production art and
ambient chrome must reinforce the dark tactical command-console aesthetic
without replacing the established Yield Omega cast.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-297-ART-MOTION-AUDIO`** | (see summary row above) | `bash scripts/check-art-readme-consumers.sh`; `cd frontend && npm run typecheck && npm run lint && npm test`; visual/browser pass of Home, countdown, **`/`**, `/arena/protocol`, and Referrals |

<a id="frontend-level-up-celebration-gitlab-335"></a>

### Frontend level-up celebration (GitLab [#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335))

Follow-up to gap analysis [#331](https://gitlab.com/PlasticDigits/yieldomega/-/issues/331): replace auto-trigger level-up text modal with a glass confetti popover for **L2+** only; preserve `FeatureMechanicModal` for explicit help.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-335-LEVEL-UP-CELEBRATION`** | (see summary row above) | `arenaLevelUpCelebration.test.ts`, `LevelUpCelebrationPopover.test.ts`; `cd frontend && npm run typecheck && npm run lint && npm test` · [arena-views §335](../frontend/arena-views.md#level-up-celebration-gitlab-335) |

<a id="frontend-ux-docs-e2e-gitlab-298"></a>

### Frontend UX docs + E2E redesign gate (GitLab [#298](https://gitlab.com/PlasticDigits/yieldomega/-/issues/298))

Follow-up to the cyberminimalist shell ([#290](https://gitlab.com/PlasticDigits/yieldomega/-/issues/290)) through secondary-surface passes ([#295](https://gitlab.com/PlasticDigits/yieldomega/-/issues/295), [#296](https://gitlab.com/PlasticDigits/yieldomega/-/issues/296)): consolidate layout documentation, a page-by-page content audit checklist, manual QA visual/mechanics smoke, and Playwright selector/branding expectations so third-party agents can verify the redesign without re-deriving scope from epic issues.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-298-UX-DOCS-E2E`** | (see summary row above) | [frontend-content-audit.md](frontend-content-audit.md) · `bash scripts/check-doc-anchors.sh` · `cd frontend && npm run typecheck && npm run lint && npm test` · `bash scripts/check-arena-naming.sh` · `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/arena.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts e2e/referrals-surface.spec.ts e2e/footer-site-links.spec.ts e2e/launch-countdown.spec.ts e2e/surface-shells.spec.ts e2e/referral-path.spec.ts`; Rabby/Chromium visual pass per [manual QA §298](manual-qa-checklists.md#manual-qa-issue-298) |

<a id="docs-product-ui-reconcile-gitlab-320"></a>

### Product / UI / ops doc reconcile (GitLab [#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320))

Follow-up to gap analysis [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309): product specs, content audit, pause ops, indexer design, and play skills agree with shipped `TimeArena` constants, `LaunchGate` routes, and indexer HTTP.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-320-PRODUCT-CONSTANTS`** | `MAX_PLAYER_LEVEL = 5`, `FIRST_BUY_CRED_BONUS = 1100e18`, `effectiveCharmPriceWad()` for DOUB buys documented consistently in [time-arena.md](../product/time-arena.md) and [arena-v2.md](../product/arena-v2.md) | Manual diff vs [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol), [`ArenaXp.sol`](../../contracts/src/arena/libraries/ArenaXp.sol) |
| **`INV-DOCS-320-ROUTE-IA`** | Play **`/`**, AUDIT **`/arena/protocol`**, legacy **`/arena`** / **`/timecurve`** → **`/`**; no removed `ArenaSubnav` / decision row in audit docs | [frontend-content-audit.md](frontend-content-audit.md), [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx), `frontendContentAudit.test.ts`, `e2e/navigation.spec.ts` |
| **`INV-DOCS-320-PAUSE-OPS`** | Ops docs: **`claimWarBowFlag`** gated by **`paused`** via **`_requireLive()`** | [pause-and-final-signoff.md](../operations/pause-and-final-signoff.md), [final-signoff-and-value-movement.md](../operations/final-signoff-and-value-movement.md) |
| **`INV-DOCS-320-INDEXER-ROUTES`** | [design.md](../indexer/design.md) lists **`GET /v1/arena/last-buy-epoch-pricing`**, **`GET /v1/arena/warbow/latest-bp`**, **`limit`/`offset`** pagination, and optional **`cursor`** on **`GET /v1/arena/buys`** / **`GET /v1/arena/activity`** ([#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)) | [`api_arena.rs`](../../indexer/src/api_arena.rs) |

<a id="frontend-arena-css-naming-gitlab-280"></a>

### Frontend Arena CSS & art naming (GitLab [#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280))

Follow-up to [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266): rename lingering **`timecurve-*`** DOM/CSS/public-art identifiers to **`arena-*`** without behavior changes. **Out of scope:** `LaunchGate` `/timecurve` redirects, referral slug segment `timecurve`, onchain revert strings in [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts), historical folders under `frontend/public/art/timecurve-launch-brief/`.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-280-ARENA-CSS-NAMING`** | (see summary row above) | `bash scripts/check-arena-naming.sh` |

<a id="frontend-art-readme-consumer-links-gitlab-286"></a>

### Frontend art README consumer links (GitLab [#286](https://gitlab.com/PlasticDigits/yieldomega/-/issues/286))

Follow-up to [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266): keep [`frontend/public/art/README.md`](../../frontend/public/art/README.md) **“Used by”** columns aligned with live Arena surfaces (`TimeArenaPage`, `pages/arena/*`) — not deleted v1 TimeCurve pages. Source of truth for wiring: `rg "/art/" frontend/src`.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-FRONTEND-286-ART-README`** | (see summary row above) | `bash scripts/check-art-readme-consumers.sh` |

<a id="timearena-cred-buy-gitlab-268"></a>

### TimeArena CRED buy + first-buy bonus (GitLab [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268))

Parent: [#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248) (Play CRED). Onchain: [`TimeArena._buyCred`](../../contracts/src/arena/TimeArena.sol), [`TimeArena._finishBuy`](../../contracts/src/arena/TimeArena.sol). Product: [arena-v2 § CRED buy](../product/arena-v2.md) · [time-arena](../product/time-arena.md). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Manual QA: [§268](manual-qa-checklists.md#manual-qa-issue-268). Anvil smoke: `bash scripts/verify-cred-buy-anvil.sh`.

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-CRED-BURN-SCALE`** | `credBurn = mulDiv(charmWad, CRED_PER_CHARM_WAD, WAD)`; reverts on zero burn / insufficient balance | `test_buy_with_cred`, `test_buyWithCred_10charm_burns_1000_cred`, `test_buyWithCred_min_charm_burns_scaled`, `test_buyWithCred_reverts_insufficient_cred` |
| **`INV-TIME-ARENA-CRED-BURN-BOUNDS`** | Same **0.99–10** CHARM band as DOUB buys | `test_buyWithCred_reverts_charm_bounds` |
| **`INV-TIME-ARENA-CRED-POOL-ACCRUE`** | Each **`buyWithCred`** adds **`CRED_PER_BUY`** (35e18) to `epochCredPool[lastBuyEpoch]`; same CHARM accrual as DOUB buys; **no** DOUB routing | `test_buy_with_cred`, `test_cred_accrue_on_cred_buy`, `test_buyWithCred_accrues_epoch_cred_pool`, `test_buyWithCred_mixed_pro_rata_with_doub`, `test_buyWithCred_epoch_boundary_credits_correct_pool`, `test_buyWithCred_at_epoch_boundary`, `test_cred_accrue_buyWithCred_at_epoch_boundary`, `test_cred_only_buyer_fair_share` ([#311](https://gitlab.com/PlasticDigits/yieldomega/-/issues/311)) · `bash scripts/verify-cred-buy-anvil.sh` |
| **`INV-TIME-ARENA-FIRST-BUY-SCHEDULE`** | `buyCount == 0` before increment → `epochFixedCredBonus[lastBuyEpoch+1] += 1100e18`; emits **`FirstBuyCredScheduled`** | `test_first_buy_doub_schedules_bonus`, `test_first_buy_cred_schedules_bonus_once`, `test_second_buy_no_additional_bonus`, `verify-cred-buy-anvil.sh` |
| **`INV-TIME-ARENA-FIRST-BUY-EPOCH`** | Hard-reset in same tx uses **post-reset** `lastBuyEpoch + 1`; flag not reset on epoch roll | `test_first_buy_hard_reset_targets_post_epoch`, `test_first_buy_flag_survives_epoch_roll` |
| **`INV-TIME-ARENA-FIRST-BUY-CLAIM`** | `pendingCred` / `claimCred` include bonus; bonus-only claim without CHARM weight; clears bonus on claim | `test_claim_cred_bonus_only_no_charm`, `test_claim_cred_pro_rata_plus_bonus`, `test_claimCred_reverts_active_epoch` |

Frontend mirror: [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts) · `arenaCredBurn.test.ts`. UI pay path: [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269). Onboarding progression: [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299) · [detail §299](#arena-player-progression-gitlab-299). CRED pool parity: [#311](https://gitlab.com/PlasticDigits/yieldomega/-/issues/311) · **`INV-TIME-ARENA-CRED-POOL-PARITY`**.

<a id="timearena-cred-pool-parity-gitlab-311"></a>

### TimeArena CRED pool parity (GitLab [#311](https://gitlab.com/PlasticDigits/yieldomega/-/issues/311))

Parent gap analysis: [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309). **`buyWithCred`** mirrors DOUB buys for epoch economics: **`_accrueCharmAndCred`** with `codeHash = 0` (no referral mint). Supersedes **`INV-TIME-ARENA-CRED-NO-POOL`**. Onchain: [`TimeArena._buyCred`](../../contracts/src/arena/TimeArena.sol). Product: [arena-v2 § Play CRED](../product/arena-v2.md#play-cred--epoch-charm) · play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Anvil: `bash scripts/verify-cred-buy-anvil.sh`.

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-CRED-POOL-PARITY`** | Each `buyWithCred` adds **`CRED_PER_BUY`** (35e18) to `epochCredPool[lastBuyEpoch]`; CHARM weight unchanged vs prior CRED path | `test_cred_accrue_on_cred_buy`, `test_buy_with_cred`, `test_buyWithCred_accrues_epoch_cred_pool`, `verify-cred-buy-anvil.sh` |
| **`INV-TIME-ARENA-CRED-PRO-RATA-MIXED`** | Mixed DOUB/CRED buyers in one epoch split pool pro-rata by CHARM; CRED-only buyer cannot over-claim | `test_cred_pro_rata_mixed_doub_and_cred_buyers`, `test_buyWithCred_only_fair_pro_rata_claim` |
| **`INV-TIME-ARENA-CRED-EPOCH-BOUNDARY`** | Hard-reset `buyWithCred` credits **post-reset** epoch pool only; soft epoch roll credits prior epoch | `test_cred_accrue_buyWithCred_at_epoch_boundary`, `test_buyWithCred_epoch_boundary_credits_correct_pool` |

<a id="arena-player-progression-gitlab-299"></a>

### Arena player progression (GitLab [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299))

Parent epic: [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Onchain: [`ArenaXp.MAX_PLAYER_LEVEL`](../../contracts/src/arena/libraries/ArenaXp.sol), [`TimeArena._finishBuy`](../../contracts/src/arena/TimeArena.sol). Product: [arena-v2 § XP](../product/arena-v2.md#xp). Play skills: [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md), [`skills/play-time-arena-warbow`](../../skills/play-time-arena-warbow/SKILL.md). Frontend: [`ArenaXpHero`](../../frontend/src/components/ArenaXpHero.tsx), [`FeatureMechanicModal`](../../frontend/src/components/FeatureMechanicModal.tsx), [`arenaProgression.ts`](../../frontend/src/lib/arenaProgression.ts). Anvil: `bash scripts/verify-cred-buy-anvil.sh` · `bash scripts/verify-wallet-profile-anvil.sh`.

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-ARENA-PROGRESSION-LEVEL-CAP`** | `MAX_PLAYER_LEVEL = 5`; surplus XP discarded at max (`xpTowardNext` = 0) | `test_level_cap_at_five`, `ArenaXp.t.sol::test_applyXpGain_discards_xp_at_max_level` |
| **`INV-ARENA-PROGRESSION-TIMER-GATES`** | Per-level timer/scoring matrix in `_finishBuy` | `test_level_1_gates_timers` … `test_level_4_warbow_bp_and_level_5_flag` |
| **`INV-ARENA-PROGRESSION-WARBOW-GATES`** | WarBow txs require level ≥ 4; flag plant/cancel requires level ≥ 5 | `test_level_3_warbow_steal_reverts`, `test_level_4_buy_plant_flag_ignored` |
| **`INV-ARENA-PROGRESSION-ONBOARDING`** | Two `ONBOARDING_STARTER_CHARM_WAD` buys → level ≥ 2; first-buy CRED 1100e18 | `test_onboarding_two_starter_buys_reach_level_two`, `verify-cred-buy-anvil.sh` |
| **`INV-ARENA-PROGRESSION-GRANDFATHER`** | `grandfatherProgression` for legacy participants | `test_grandfather_progression` |
| **`INV-ARENA-PROGRESSION-UX`** | XP hero on `/arena`; lock copy; buy preview filtered by level; L2+ celebration popover + help modal | `arenaProgression.test.ts`, `arenaLevelUpCelebration.test.ts`, `arenaBuyProjectedEffects.test.ts` ([#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)) |

<a id="timearena-podium-timers-gitlab-271"></a>

### TimeArena per-podium timer params (GitLab [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271))

Parent: [#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247) (independent `podiumDeadline[4]`). Onchain: [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol). Product: [time-arena § timers](../product/time-arena.md) · [arena-v2 § timers](../product/arena-v2.md#timers-last-buy--four-podiums). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md). Manual QA: [§271](manual-qa-checklists.md#manual-qa-issue-271). Anvil smoke: `bash scripts/verify-podium-timers-anvil.sh`.

**Scoring vs settlement (authoritative comment on #271):** Time Booster totals, Defended Streak window, and WarBow BP clutch/reset bonuses use **Last Buy (cat 0)** timer deltas / remaining / hard-reset. Per-category timer arrays govern **prize epoch deadlines** only (`podiumDeadline[cat]`, `rollPodiumEpoch`).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-PODIUM-TIMER-TABLE`** | `podiumTimerExtensionSec`, `podiumInitialTimerSec`, `podiumTimerCapSec`, reset bands match product table (+120/+60/+90/+300; 24h/12h/18h/48h initial; caps = 4× initial) | `ArenaPodiumTimerConfig.sol`, `test_start_arena_initial_deadlines_differ_by_category`, `verify-podium-timers-anvil.sh` |
| **`INV-TIME-ARENA-PODIUM-BUY-EXTEND`** | At **level 5**, one buy extends all four deadlines by category rules; lower levels extend subset ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)) | `test_multi_podium_deadline_extend`, `test_level_*_gates_timers`, `test_time_booster_hard_reset_band_240_to_300` |
| **`INV-TIME-ARENA-PODIUM-ROLL-INIT`** | `rollPodiumEpoch(cat)` disarms timer (`podiumDeadline[cat]=0`) until next qualifying buy arms with `podiumInitialTimerSec[cat]` | `test_roll_podium_after_expiry`, `test_podium_timers_diverge_after_single_roll` ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247), [#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)) |
| **`INV-TIME-ARENA-SCORING-LAST-BUY-TIMER-DETAIL`** | WarBow BP reset bonus requires Last Buy hard reset, not WarBow timer band alone; defended streak uses Last Buy remaining | `test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer`, `test_defended_streak_uses_last_buy_timer_not_other_podium` |
| **`INV-TIME-ARENA-LAST-BUY-EPOCH-UNCHANGED`** | `lastBuyEpoch` still increments only on Last Buy (cat 0) hard reset | `test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll`, `test_timer_hard_reset_increments_epoch` |

Derived UI: [`ArenaTimerChips.tsx`](../../frontend/src/pages/arena/ArenaTimerChips.tsx) reads four `podiumDeadline` values; buy checkout preview (`timeArenaBuyPreview.ts`) models **Last Buy** timer for scoring pills — all four settlement deadlines still extend onchain per buy.

<a id="indexer-live-podium-predictions-gitlab-273"></a>

### Indexer live podium predictions (GitLab [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273))

Parent: [#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254) (Arena HTTP baseline). Ingest: [`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs) · HTTP: [`api_arena.rs`](../../indexer/src/api_arena.rs) · head poller: [`chain_timer.rs`](../../indexer/src/chain_timer.rs). Product: [arena-v2 § podiums](../product/arena-v2.md) · [design § live podiums](../indexer/design.md#arena-podiums-http). Play skill: [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md). Manual QA: [§273](manual-qa-checklists.md#manual-qa-issue-273).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-INDEXER-PODIUM-LIVE-TABLE`** | `idx_arena_podium_live` in `ARENA_INDEX_TABLES`; top-3 per `(category, epoch)`; reorg rollback clears rows | migration `20260601140000_idx_arena_podium_live_gl273`, `reorg.rs`, `integration_stage2.rs` |
| **`INV-INDEXER-PODIUM-LIVE-INGEST`** | Block-tagged `podium()` snapshots on `Buy`, WarBow BP logs, `LastBuyEpochStarted`, `PodiumEpochRolled`; WarBow rollup from `idx_warbow_epoch_score` | `arena_podium_live.rs`, `ingestion.rs` |
| **`INV-INDEXER-PODIUM-LIVE-HTTP`** | UX order (Last Buy · WarBow · Defended · Time Booster); per-row `epoch` from head `lastBuyEpoch` / `podiumEpoch[cat]`; `podium_prediction: true` only when Postgres supplies entrants | `api_arena.rs`, `integration_stage2.rs::arena_podiums_live_predictions_smoke` |
| **`INV-INDEXER-273-CHAIN-TIMER-SELECTORS`** | `chain_timer` + ingest epoch reads call **`podiumDeadline(uint256)`** / **`podiumEpoch(uint256)`** (Solidity public-array getters), not `uint8` overloads that revert | `chain_timer.rs`, `warbow_score.rs`, `bash scripts/verify-podium-live-anvil.sh` |

<a id="timearena-xp-charm-scale-gitlab-304"></a>

### TimeArena XP CHARM scaling (GitLab [#304](https://gitlab.com/PlasticDigits/yieldomega/-/issues/304))

End-to-end verification that player XP scales with **CHARM weight cleared per buy** (not flat per transaction). Formula: `xp = 1 + (charmWad - CHARM_MIN_WAD) * 9 / (CHARM_MAX_WAD - CHARM_MIN_WAD)` (integer floor).

| ID | Rule | Verify |
|----|------|--------|
| **`INV-TIME-ARENA-XP-CHARM-MIN-MAX`** | `xpForCharm(99e16) == 1`; `xpForCharm(10e18) == 10`; mid-band spot checks | `ArenaXp.t.sol::test_xpForCharm_linear_band`, `arenaXpMath.test.ts` |
| **`INV-TIME-ARENA-XP-CHARM-ONCHAIN`** | `_finishBuy` emits `XpGained(buyer, xpGain, newLevel)` with charm-scaled `xpGain`; no flat `+1` path | `TimeArena.t.sol::test_xp_emits_XpGained`, `test_xp_max_charm_first_buy` |
| **`INV-TIME-ARENA-XP-CHARM-CRED-PARITY`** | `buyWithCred(charmWad)` awards same XP as `buy(charmWad)` for identical weight | `TimeArena.t.sol::test_xp_buy_with_cred_same_as_doub` |
| **`INV-TIME-ARENA-XP-CHARM-INDEXER`** | `idx_player_xp.xp_gained` stores event `amount`; wallet stats `xp` = `SUM(xp_gained)` | `integration_stage2.rs`, `arena_wallet_stats.rs` tests |
| **`INV-TIME-ARENA-XP-CHARM-PREVIEW`** | Checkout projected effects `+Xxp` uses `xpForCharm(charmWadSelected)` | `arenaBuyProjectedEffects.test.ts` |

Crosslinks: [`ArenaXp.sol`](../../contracts/src/arena/libraries/ArenaXp.sol) · [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts) · [`arena-v2.md` § XP](../product/arena-v2.md#xp) · play skill [`play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

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
| **`INV-TIME-ARENA-DOUB-PRICE`** | `buy(charmWad)` pulls **DOUB** = `charmWad × effectiveCharmPriceWad() / 1e18`; epoch anchor + growth ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)); **DeployDev / Anvil** default anchor **`1000e18`**; production epoch-0 init via **`INV-TIME-ARENA-CHARM-TWAP-INIT`** ([#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)) | `test_buy_routes_doub_split`, `testFuzz_buy_charmInBand_doubPullParity`, `TimeArenaEpochCharmPrice.t.sol` |
| **`INV-TIME-ARENA-CHARM-TWAP-INIT`** | **MegaETH production** initial **`charmPriceWad`** from **Sir-parity Kumbaya V3 TWAP** (15m) on **DOUB/CL8Y (100)** + **CL8Y/WETH (100)** + **WETH/USDm (3000)** — reserve-asset bridge, **not** direct DOUB/WETH; **`charmPriceWad = floor(1e36 / doubUsdTwap)`** (~**$1** DOUB notional per 1 CHARM); spend band **`0.99×`–`10× charmPriceWad`**; **`ARENA_CHARM_PRICE_WAD`** override or fail-closed (no silent `1000e18` on 4326) ([#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)) | `ArenaCharmPriceTwap.t.sol`, `ArenaCharmPriceTwapFork.t.sol` (skip without `FORK_URL`), `DeployProductionCharmPrice.t.sol`, `bash scripts/compute-arena-charm-price-twap.sh`, `bash scripts/verify-arena-charm-twap.sh`, `DeployProduction.s.sol`, `arenaV2SaleSessionBridge.test.ts`, `timeArenaBuySubmitSizing.test.ts` |
| **`INV-TIME-ARENA-SET-PRICE`** | Governance **`setCharmPriceWad`** (mutable, > 0) | `test_setCharmPriceWad_changes_doub_owed` |
| **`INV-TIME-ARENA-CHARM-BAND`** | Fixed **0.99–10** CHARM (WAD) envelope via **`ArenaCharmBounds`** | `test_buy_reverts_charm_*`, `testFuzz_buy_charmBelowMin_reverts`, `testFuzz_buy_charmAboveMax_reverts`, `ArenaCharmBounds.sol` ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)) |
| **`INV-TIME-ARENA-BUY-ENERGY-332`** | Per-wallet buy energy: default **5** Level 1 stored charges, **+1 cap per level above 1** (Level 5 = 9), **300s** refill interval, **15s** burst gap, computed **`nextBuyAllowedAt`**; charges never exceed cap and zero-charge / burst-gap buys revert onchain ([#332](https://gitlab.com/PlasticDigits/yieldomega/-/issues/332)) | `test_buy_energy_initial_state_full_charges`, `test_buy_spends_one_buy_charge`, `test_buy_reverts_inside_burst_cooldown`, `test_buy_succeeds_at_exact_burst_boundary_if_charge_available`, `test_buy_charge_refills_at_exact_interval`, `test_buy_charges_cap_after_long_idle`, `test_buy_energy_cap_includes_level_bonus`, `test_buy_energy_preserves_partial_interval_progress`, `test_buy_reverts_when_charges_exhausted_until_next_charge`; `bash scripts/verify-buy-energy-anvil.sh` |
| **`INV-TIME-ARENA-EPOCH-EVENT`** | **`LastBuyEpochStarted`** on hard reset | `test_emits_LastBuyEpochStarted_on_hard_reset` |

Fuzz parity (DOUB pull + charm bounds): `TimeArena.t.sol::testFuzz_*` ([#246](https://gitlab.com/PlasticDigits/yieldomega/-/issues/246), [#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)). ERC-20 ingress: **`INV-ERC20-123`** · **`INV-ERC20-123-NONSTANDARD`** below · `NonStandardERC20.t.sol`, `test_feeOnTransfer_buy_reverts_erc20Parity`.

<a id="timearena-negative-tests-dry-gas-gitlab-316"></a>

### TimeArena negative tests, DRY charm bounds, buy routing gas (GitLab [#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316))

Gap follow-up from [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309). Onchain: [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) · [`ArenaCharmBounds.sol`](../../contracts/src/arena/libraries/ArenaCharmBounds.sol). Play skills: [`play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md), [`play-time-arena-warbow`](../../skills/play-time-arena-warbow/SKILL.md).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-PAUSE-MUTATING`** | Pause blocks all `_requireLive` mutators: `buy`, `buyWithCred`, WarBow steal/guard/revenge, `claimWarBowFlag` | `test_pause_blocks_*` |
| **`INV-TIME-ARENA-WARBOW-REVERT-MATRIX`** | Exact onchain revert strings for steal band, daily cap, revenge expiry, flag holder/silence, double finalize, bad victim/epoch | `test_warbow_*_reverts_*`, `test_finalize_warbow_podium_reverts_*` |
| **`INV-TIME-ARENA-CHARM-BOUNDS-DRY`** | `ArenaCharmBounds.validate` is the single charm envelope for ingress + XP + TWAP spend band | `ArenaCharmBounds.sol`, `ArenaXp.sol`, `ArenaCharmPriceTwap.sol` |
| **`INV-TIME-ARENA-BUY-ROUTING-GAS`** | When every `PodiumVaults` pool slot resolves to `address(vaults)`, one ERC-20 transfer per buy/top-up; tranche events unchanged | `TimeArena.sol::_routeDoubPrizeSplit`, `test_buy_routes_doub_split` |
| **`INV-ERC20-123-NONSTANDARD`** | Fee-on-transfer token fails `_pullDoubExact` on buy, WarBow DOUB spend, and podium top-up | `NonStandardERC20.t.sol` |

Verify: `cd contracts && forge test --match-contract "TimeArenaTest|NonStandardERC20Test" -vv` · full suite `cd contracts && forge test` (skip known `doub.csv` fork failures without gitignored CSV).

<a id="timearena-epoch-charm-price-gitlab-305"></a>

### TimeArena epoch DOUB/CHARM pricing (GitLab [#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305))

| ID | Rule | Verify |
|----|------|--------|
| **`INV-TIME-ARENA-EPOCH-CHARM-ANCHOR`** | Hard-reset buy samples TWAP (or Anvil spot), sets **`epochCharmAnchorWad`**, emits **`LastBuyEpochCharmAnchored`** **before** DOUB pull | `TimeArenaEpochCharmPrice.t.sol::test_hard_reset_reanchors_and_prices_at_new_anchor` |
| **`INV-TIME-ARENA-EPOCH-CHARM-GROWTH-MATH`** | **`effectiveCharmPriceWad()`** ≈ anchor × 1.1^(elapsed days); monotonic within epoch | `TimeArenaEpochCharmPrice.t.sol::test_effectiveCharmPriceWad_grows_10pct_per_day` |
| **`INV-TIME-ARENA-INDEXER-EPOCH-PRICE`** | **`GET /v1/arena/timers`** exposes effective + anchor fields; **`GET /v1/arena/last-buy-epoch-pricing`** lists epoch anchors | `integration_stage2.rs`, `chain_timer.rs` |
| **`INV-TIME-ARENA-FRONTEND-EFFECTIVE-PRICE`** | Buy sizing / Kumbaya quoter read **`effectiveCharmPriceWad`** (indexer-first via `charm_price_wad`) | `arenaV2SaleSessionBridge.test.ts`, `timeArenaBuySubmitSizing.test.ts` |

<a id="timearena-doub-owed-preview-gitlab-315"></a>

### TimeArena `doubOwedForBuy` preview (GitLab [#315](https://gitlab.com/PlasticDigits/yieldomega/-/issues/315))

Onchain: [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) · router: [`TimeArenaBuyRouter.sol`](../../contracts/src/arena/TimeArenaBuyRouter.sol). Integrator: [kumbaya.md § doubOwedForBuy](../integrations/kumbaya.md). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

| ID | Rule | Verify |
|----|------|--------|
| **`INV-TIME-ARENA-DOUB-OWED-PREVIEW`** | **`doubOwedForBuy(charmWad)`** is **`view`** / **`eth_call`**-safe; equals immediate **`buy`** DOUB pull within epoch and at Last Buy hard-reset boundary (samples TWAP/spot anchor without state write) | `TimeArenaEpochCharmPrice.t.sol::test_doubOwedForBuy_matches_buy_within_epoch`, `test_doubOwedForBuy_matches_buy_at_hard_reset_boundary` |
| **`INV-TIME-ARENA-DOUB-OWED-ROUTER`** | **`TimeArenaBuyRouter.buyViaKumbaya`** sizes **`exactOutput`** from **`doubOwedForBuy`**, not **`effectiveCharmPriceWad`** alone | `TimeArenaBuyRouter.t.sol`, `VerifyTimeArenaBuyRouterAnvil.t.sol` |

**TWAP manipulation:** hard-reset anchor uses **15-minute** V3 TWAP on production ([#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)); same-block spot sandwich cannot reduce DOUB owed below the sampled anchor for that transaction.

<a id="arena-charm-twap-init-gitlab-303"></a>

### Arena production charm TWAP init (GitLab [#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303))

Onchain: [`ArenaCharmPriceTwap.sol`](../../contracts/src/oracle/ArenaCharmPriceTwap.sol) · [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol). Ops dry-run: `bash scripts/compute-arena-charm-price-twap.sh`. Integrator: [kumbaya.md § TWAP](../integrations/kumbaya.md). Play skill: [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-CHARM-TWAP-INIT`** | Sir **15m** Kumbaya V3 TWAP on **DOUB/CL8Y (100)** + **CL8Y/WETH (100)** + **WETH/USDm (3000)**; **`charmPriceWad = floor(1e36 / doubUsdTwap)`**; spend band **`0.99×`–`10× charmPriceWad`**; **`ARENA_CHARM_PRICE_WAD`** override; fail-closed on 4326 (no silent `1000e18`) | `ArenaCharmPriceTwap.t.sol`, `ArenaCharmPriceTwapFork.t.sol`, `DeployProductionCharmPrice.t.sol`, `bash scripts/compute-arena-charm-price-twap.sh`, `bash scripts/verify-arena-charm-twap.sh`, `arenaV2SaleSessionBridge.test.ts`, `timeArenaBuySubmitSizing.test.ts` |

**Live mainnet pools (4326, fee 100 / 3000):** **DOUB/CL8Y** `0x1CD919D65E2f6fa591201C085C106b5281D4E234` · **CL8Y/WETH** `0x365b5a55707c449C4c9eE0D325AcdE67b3b3D285` · **WETH/USDm** `0x587F6eeAfc7Ad567e96eD1B62775fA6402164b22`. Reserve **CL8Y** `0xfBAa45A537cF07dC768c469FfaC4e88208B0098D`. Dry-run: `bash scripts/compute-arena-charm-price-twap.sh`.

**Pay-mode E2E:** `arena-paywith-{cl8y,cred,eth,usdm}` on [`ArenaSimplePage.tsx`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) (`/arena`). **DOUB** direct `buy`; **CRED** `buyWithCred` — `e2e/anvil-arena-04-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)); **ETH/USDM** use `TimeArenaBuyRouter.buyViaKumbaya` when `timeArenaBuyRouter` is set ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), frontend [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Env: `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` must match onchain when set (legacy alias `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`). **Pause:** `TimeArena.paused` only — **`INV-FRONTEND-264-ARENA-PAY-PAUSE`**.

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

Participant wallet addresses on live buy feeds and podium rankings open **`WalletProfileModal`** (indexer **`GET /v1/arena/wallet/{address}/stats`**); explorer links remain inside the modal only. Sections: Overview, Podium wins, Spending, XP/Level, **Level history** ([#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336)), WarBow, Referrals, Fun facts. Buy rows from **`GET /v1/arena/buys`** must expose **`actual_seconds_added`** ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)) and log-identify fields **`new_deadline`**, **`buy_index`**, **`log_index`**, **`block_timestamp`** ([#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)) for timer chips, buy detail, and stable React keys. Frontend: [arena-views § wallet-profile](../frontend/arena-views.md#wallet-profile-modal-gitlab-258) · **`INV-FRONTEND-258-WALLET-PROFILE`**, **`INV-INDEXER-336-WALLET-LEVEL-HISTORY`**, **`INV-INDEXER-282-ARENA-BUYS-SECONDS`**, **`INV-INDEXER-283-ARENA-BUYS-PARITY`** · `bash scripts/verify-wallet-profile-anvil.sh` · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

<a id="wallet-address-validation-and-uups-ownable2step-gitlab-329"></a>

### Wallet address validation and UUPS Ownable2Step (GitLab [#329](https://gitlab.com/PlasticDigits/yieldomega/-/issues/329))

Parent [#325](https://gitlab.com/PlasticDigits/yieldomega/-/issues/325) F-09 / F-01 partial (approved recommendation **#5**). Indexer: shared **`valid_0x_address20`** in [`api_validate.rs`](../../indexer/src/api_validate.rs) for **`GET /v1/arena/wallet/{address}/stats`**, podium donation **`donor`**, WarBow **`players`**, and referral wallet query params — malformed `0x`+42 non-hex → **400** `invalid_address`. Contracts: **`Ownable2StepUpgradeable`** on **`TimeArena`** and **`ReferralRegistry`**; **`DeployDev`** / **`DeployProduction`** unchanged at script level (initialize calls `__Ownable2Step_init`). Existing proxy upgrade notes: [security §329](../onchain/security-and-threat-model.md#uups-ownership-upgrades-gitlab-329). **`INV-INDEXER-329-ADDRESS-VALIDATE`**, **`INV-CONTRACTS-329-OWNABLE2STEP`**.


<a id="indexer-last-buy-epoch-gitlab-278"></a>

### Indexer Last Buy epoch persistence (GitLab [#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278))

**`TimeArena.lastBuyEpoch`** is global. On Last Buy hard reset the contract increments epoch and emits **`LastBuyEpochStarted(epoch, deadline)`** before **`Buy`** in the same transaction. Indexer ingest assigns **`idx_arena_buy.last_buy_epoch`** from a running head updated by epoch-start events — **not** from cumulative per-wallet **`timer_hard_reset`** counts (which mis-tags participants who never reset). **`epochs_participated`** on **`GET /v1/arena/wallet/{address}/stats`** = `COUNT(DISTINCT last_buy_epoch)` for that wallet. Closes **`INV-INDEXER-112`** gap for **`LastBuyEpochStarted`**. Design: [indexer design §278](../indexer/design.md#arena-last-buy-epoch-gitlab-278).

<a id="arena-vault-funding-gitlab-267"></a>

### Arena buy vault funding (GitLab [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267))

Onchain notifications: **`PodiumEpochFunded`** on each DOUB **`buy`** ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)); **`PodiumFunded` / `SeedFunded`** for **`topUpPodiumPools`** only. Indexer table: **`idx_arena_vault_funding`** (`kind`: `podium_epoch` | `podium_active` | `podium_seed` | `admin`; optional **`target_epoch`**). HTTP: **`GET /v1/arena/vault-funding/recent`**, **`…/by-tx/{tx_hash}`** (12 rows typical for 1000 DOUB buy), **`…/totals`**. Reconciliation: for each **`idx_arena_buy`** row with **`paid_with_cred = false`**, **`SUM(amount_doub_wad)`** over funding rows sharing **`tx_hash`** must equal **`doub_paid`**. Distinct from donate-pools ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)). Design: [indexer design §267](../indexer/design.md#arena-vault-funding-http-gitlab-267) · onchain: [fee-routing § events](../onchain/fee-routing-and-governance.md#events) · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

<a id="arena-prize-routing-gitlab-300"></a>

### Arena prize routing — 100% podiums (GitLab [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300))

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-ARENA-PRIZE-ROUTING-300-ZERO-ADMIN`** | DOUB **`buy`** sends **0%** to any admin fee sink; **`AdminSellVault`** not deployed ([#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314)) | `TimeArena.t.sol::test_buy_routes_doub_split` |
| **`INV-ARENA-PRIZE-ROUTING-300-25PCT`** | Each of 4 categories receives **25%** of buy (± remainder → Last Buy) ([#313](https://gitlab.com/PlasticDigits/yieldomega/-/issues/313)) | `ArenaPrizeRouting.t.sol`, `testFuzz_splitBuy_no_dust`, `testFuzz_epoch_split_per_category_bps`, `testFuzz_split_remainder_on_cat0` |
| **`INV-ARENA-PRIZE-ROUTING-300-702010`** | Per category: **70% / 20% / 10%** → `podiumEpoch[cat]`, `+1`, `+2` | `test_buy_routes_epoch_tranches_worked_example`, `testFuzz_epoch_split_per_category_bps` |
| **`INV-ARENA-PRIZE-ROUTING-300-ROLL`** | `rollPodiumEpoch` pays active 4∶2∶1 and **`rollEpochTranches`** promotes seed/future | `test_roll_promotes_epoch_tranches_and_pays_active`, `test_finalize_warbow_podium_pays_after_roll` |
| **`INV-ARENA-PRIZE-ROUTING-300-TOPUP`** | **`topUpPodiumPools`** unchanged (10:7.5 active:seed, 0% admin) | `TimeArena.t.sol::test_topUpPodiumPools_*` ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)) |
| **`INV-ARENA-PRIZE-ROUTING-300-INDEXER`** | **`PodiumEpochFunded`** → `idx_arena_vault_funding` (`kind=podium_epoch`, `target_epoch`); API schema **≥ 2.7.0** | `integration_stage2.rs::api_vault_funding_smoke` · `bash scripts/verify-vault-funding-anvil.sh` |
| **`INV-ARENA-PRIZE-ROUTING-300-UI`** | Fee / AUDIT surfaces show **100% podium** routing (no 30% admin on buys) | `FeeTransparency.test.tsx`, `ArenaProtocolPage` copy |

Product: [arena-v2.md § DOUB prize routing](../product/arena-v2.md) · onchain: [fee-routing](../onchain/fee-routing-and-governance.md) · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

<a id="timearena-warbow-bp-routing-gitlab-310"></a>

### TimeArena WarBow BP + DOUB routing (GitLab [#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310))

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-WARBOW-BP-STREAK-AMBUSH`** | `_applyBuyWarBowBp` awards **streak-break** (`prior active streak × 100 BP`) and **ambush** (+200 BP on hard reset + streak break) under **`DEFENDED_STREAK_WINDOW_SEC`**, using defended-streak state **before** `_processDefendedStreak` | `test_warbow_streak_break_bp`, `test_warbow_ambush_bp_on_hard_reset_streak_break` · sim: `warbow_buy_bp_delta` |
| **`INV-TIME-ARENA-WARBOW-DOUB-ROUTE`** | **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** call **`_routeDoubPrizeSplit`** + **`totalDoubRaised`**; **`TimeArena`** DOUB balance unchanged after spend (beyond rounding dust) | `test_warbow_steal_pulls_doub`, `test_warbow_guard_pulls_doub`, `test_warbow_revenge_pulls_doub`, `test_warbow_steal_limit_override_pulls_doub`, `test_warbow_steal_routes_doub_split` |
| **`INV-TIME-ARENA-WARBOW-DOUB-300-PARITY`** | WarBow DOUB uses the same **100% podium** split as **`buy`** ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)); **0%** admin | `test_warbow_steal_routes_doub_split` (vault + admin vault checks) |

Product: [arena-v2.md § WarBow](../product/arena-v2.md#warbow-doub) · play skill: [play-time-arena-warbow](../../skills/play-time-arena-warbow/SKILL.md).

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

# Python simulations (bounded repricing / eco scenarios — not v1 launchpad sale authority)
cd simulations && PYTHONPATH=. python3 -m unittest discover -s tests -v

# TimeArena bots (CI: bots-timearena-test job)
cd bots/timearena && pip install -e ".[dev]" && pytest tests -v

# Doc anchor gate
bash scripts/check-doc-anchors.sh
```

Forge dependencies: [contracts/README.md](../../contracts/README.md).

### Postgres integration test behavior (`indexer/tests/integration_stage2.rs`)

CI sets `YIELDOMEGA_PG_TEST_URL` so `postgres_stage2_persist_all_events_and_rollback_after` runs migrations, inserts **every non-Unknown Arena v2** [`DecodedEvent`](../../indexer/src/decoder.rs) variant, checks idempotency, calls `rollback_after`, then HTTP smoke for **`GET /v1/arena/*`** and **`GET /v1/referrals/*`**. **`arena_wallet_stats_two_epochs_and_bonus_fields`** ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)) and **`last_buy_epoch_global_assignment_non_resetting_participant`** ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)) assert epoch assignment + wallet stats on **`GET /v1/arena/wallet/{address}/stats`**.

Tests share one Postgres URL and serialize on a process-wide mutex (`PG_INTEGRATION_MUTEX`) so parallel `cargo test` does not cross-delete fixture rows.

If the variable is **unset** locally, that test **returns immediately** (passes without proving Postgres).

<a id="indexer-emitted-event-coverage-gitlab-112"></a>

### Indexer emitted-event coverage (GitLab [#112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112))

**INV-INDEXER-112:** Solidity `event`s emitted by **deployed Arena v2** contracts in [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs) must each map to a **`DecodedEvent` variant**, a Postgres **`idx_*` table**, and **`persist_decoded_log_conn`** / **`rollback_after`** coverage in [`reorg.rs`](../../indexer/src/reorg.rs). **ReferralRegistry** events remain first-class when deployed. **`DoubPresaleVesting`** was removed from the production address registry ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)); **`BuyViaKumbaya`** on **`TimeArenaBuyRouter`** persists **`idx_arena_buy_router_kumbaya`** and annotates **`idx_arena_buy.pay_kind`** ([#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)).

<a id="indexer-timearena-events-gitlab-317"></a>

#### TimeArena event completeness (GitLab [#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317))

Follow-up to [#112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112) / [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309). Every **`TimeArena`** log topic in [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) maps to decode + persist + reorg rollback:

| Event | `DecodedEvent` | Postgres table |
|-------|----------------|----------------|
| `ArenaStarted` | `ArenaStarted` | `idx_arena_started` |
| `LastBuyEpochStarted` | `ArenaLastBuyEpochStarted` | `idx_arena_last_buy_epoch_started` |
| `LastBuyEpochCharmAnchored` | `ArenaLastBuyEpochCharmAnchored` | `idx_arena_last_buy_epoch_started` (anchor columns) |
| `Buy` | `ArenaBuy` | `idx_arena_buy` |
| `ReferralCredApplied` | `ArenaReferralCred` | `idx_arena_referral_cred` |
| `CredClaimed` | `ArenaCredClaimed` | `idx_play_cred_claim` |
| `FirstBuyCredScheduled` | `ArenaFirstBuyCredScheduled` | `idx_arena_first_buy_cred_scheduled` |
| `XpGained` | `ArenaXpGained` | `idx_player_xp` |
| `LevelUp` | `ArenaLevelUp` | `idx_arena_level_up` |
| `FeatureUnlocked` | `ArenaFeatureUnlocked` | `idx_arena_feature_unlocked` |
| `PausedSet` | `ArenaPausedSet` | `idx_arena_paused_set` |
| `PodiumEpochRolled` | `ArenaPodiumEpochRolled` | `idx_arena_podium_epoch` |
| `WarBowSteal` / `Guard` / `Revenge` | `ArenaWarbow*` | `idx_arena_warbow_*` |
| `WarBowFlagClaimed` | `ArenaWarbowFlagClaimed` | `idx_arena_warbow_flag_claimed` |
| `WarbowPodiumFinalized` | `ArenaWarbowPodiumFinalized` | `idx_arena_warbow_podium_finalized` |
| `PodiumPoolsToppedUp` | `ArenaPodiumPoolTopUp` | `idx_arena_podium_pool_top_up` |
| `ReferralApplied` | `ArenaReferralApplied` | `idx_arena_referral_applied` |

Vault **`PodiumFunded` / `SeedFunded` / `PodiumEpochFunded` / `AdminVaultFunded`** decode from registry contracts into **`idx_arena_vault_funding`**. Derived **`idx_warbow_epoch_score`** and **`idx_arena_podium_live`** rows come from post-log **`eth_call`** side-effects in the same block transaction — failures **abort** the block ingest ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317); **`INV-INDEXER-317-INGEST-SIDE-EFFECTS`**).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-317-TIMEARENA-EVENTS`** | All six previously missing events persist dedicated `idx_*` rows | [`integration_stage2.rs::postgres_stage2_persist_all_events_and_rollback_after`](../../indexer/tests/integration_stage2.rs) |
| **`INV-INDEXER-317-INGEST-SIDE-EFFECTS`** | WarBow BP / live podium snapshot RPC errors roll back the block tx (no silent stale derived tables) | [`ingestion.rs`](../../indexer/src/ingestion.rs) · [indexer design §317](../indexer/design.md#ingest-side-effects-gitlab-317) |
| **`INV-INDEXER-317-REORG`** | `rollback_after` clears new `idx_*` tables | `integration_stage2.rs` rollback assertions |

Vault events and **`ReferralCodeRegistered`** remain per the table above and [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267).

<a id="indexer-registry-cleanup-gitlab-319"></a>

### Indexer registry cleanup, Kumbaya ingest, platform-usage API (GitLab [#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319))

| ID | Check |
|----|--------|
| **`INV-INDEXER-319-REGISTRY-VESTING`** | **`address-registry.megaeth-mainnet.json`** has no **`DoubPresaleVesting`** entry ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)) |
| **`INV-INDEXER-319-KUMBAYA-BUY`** | **`TimeArenaBuyRouter`** in **`index_addresses()`**; **`BuyViaKumbaya`** decoded; **`GET /v1/arena/buys`** exposes **`pay_kind`**; optional **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** fail-closed | `config.rs`, `decoder.rs`, `persist.rs`, `bash scripts/verify-time-arena-buy-router-anvil.sh` |
| **`INV-INDEXER-319-PLATFORM-USAGE`** | **`GET /v1/arena/platform-usage`** returns documented JSON (schema **≥ 2.12.0**); frontend **`fetchArenaPlatformUsage`** wired | `integration_stage2.rs` **`api_platform_usage_smoke`**, `frontend/src/lib/indexerApi.test.ts` |
| **`INV-INDEXER-345-ACTIVITY-TRANSITIONS`** | **`GET /v1/arena/activity`** unions **`level_up`**, **`cred_claim`**, **`podium_epoch`**, **`epoch_started`**, and **`feature_unlocked`** from indexed transition tables with stable per-kind field mapping; cursor pagination works across mixed kinds ([#345](https://gitlab.com/PlasticDigits/yieldomega/-/issues/345)) | `api_arena.rs` **`ACTIVITY_UNION_SQL`**, `integration_stage2.rs::api_arena_activity_smoke`, `integration_stage2.rs::api_activity_cursor_smoke` · [design — activity](../indexer/design.md#arena-activity-http-gitlab-292) |
| **`INV-INDEXER-319-CURSOR-PAGE`** | **`GET /v1/arena/buys`** and **`GET /v1/arena/activity`** accept **`cursor`** + emit **`next_cursor`** | `api_cursor.rs`, `integration_stage2.rs` **`api_buys_cursor_smoke`**, **`api_activity_cursor_smoke`** |
| **`INV-INDEXER-319-NO-SILENT-DROP`** | Referral list handlers return **500** on corrupt row projection (no **`filter_map`** drop) | `api.rs` **`pg_row_required`** |

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
| **TimeArena** | DOUB/CRED buys, four podium timers, 100% podium buy routing (25% × 4 · 70/20/10 epoch tranches ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300))), epoch CRED, XP, DOUB WarBow, always-live (`paused` only) | [arena-v2.md](../product/arena-v2.md), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) |
| **PodiumVaults** | Active/seed pools, `rollPodiumEpoch`, manual top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)) | [arena-v2.md](../product/arena-v2.md) |
| **ReferralRegistry** | Code registration; referred-buy **flat 5 CRED per side** on DOUB buys ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272); baseline [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)) | [referrals.md](../product/referrals.md) |
| **Indexer** | Arena + referral decode; per-block tx ([#140](#indexer-transactional-block-ingestion-gitlab-140)); reorg rollback | [`REORG_STRATEGY.md`](../../indexer/REORG_STRATEGY.md), [indexer design](../indexer/design.md) |
| **Frontend `/arena`** | Env-driven addresses, indexer reads, wallet gating | [arena-views.md](../frontend/arena-views.md), [wallet-connection.md](../frontend/wallet-connection.md) |

---

## Cross-cutting invariants (still apply)

<a id="anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87"></a>

### Anvil E2E Playwright (GitLab [#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))

**INV-ANVIL-E2E-87:** With **`ANVIL_E2E=1`**, Playwright uses **`workers: 1`**. Pay mode on **`/arena`**: **`getByTestId("arena-paywith-eth")`** (and **`…-cl8y`**, **`…-usdm`**). Doc: [e2e-anvil.md](e2e-anvil.md).

<a id="anvil-e2e-trap-and-mock-cl8y-gitlab-279"></a>

### Anvil E2E script reliability (GitLab [#279](https://gitlab.com/PlasticDigits/yieldomega/-/issues/279))

Follow-up to [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) / Anvil Playwright pipeline hardening.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-ANVIL-E2E-279-TRAP`** | `scripts/e2e-anvil.sh` EXIT cleanup never invokes **`kill 0`** when **`PREVIEW_PID`** / **`ANVIL_PID`** are unset | [`verify-e2e-anvil-trap.sh`](../../scripts/verify-e2e-anvil-trap.sh) · [`_yieldomega_kill_pid_if_set`](../../scripts/lib/anvil_deploy_dev.sh) |
| **`INV-ANVIL-E2E-279-CL8Y-EXTRACT`** | After default mock **`DeployDev`**, **`yieldomega_anvil_deploy_dev`** resolves non-empty **`CL8Y`** from deploy log **`MockReserveCl8y:`** and/or broadcast **`run-latest.json`** | [`test-anvil-deploy-cl8y-extract.sh`](../../scripts/test-anvil-deploy-cl8y-extract.sh) · [`verify-evm-dev-wallet-seed-anvil.sh`](../../scripts/verify-evm-dev-wallet-seed-anvil.sh) |
| **`INV-ANVIL-E2E-279-SEED-ERRORS`** | Dev-wallet seed failure surfaces before EXIT trap (explicit message + non-zero exit) | [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh) seed block |

Doc: [e2e-anvil.md §279 troubleshooting](e2e-anvil.md#anvil-e2e-trap-and-mock-cl8y-extract-gitlab-279) · manual QA: [§279](manual-qa-checklists.md#manual-qa-issue-279).

<a id="anvil-e2e-ci-defaults-gitlab-322"></a>

### Anvil E2E defaults + CI lint (GitLab [#322](https://gitlab.com/PlasticDigits/yieldomega/-/issues/322))

Gap follow-up from [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309): frontend **lint** in GitHub **`frontend-test`** job; Anvil E2E **referrals** + optional **indexer-first** mode; document GitLab vs GitHub CI split.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-CI-322-FRONTEND-LINT`** | GitHub **`unit-tests`** job **`frontend-test`** runs **`npm run lint`** (errors block; warnings allowed until cleanup) | [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) · `cd frontend && npm run lint` |
| **`INV-ANVIL-E2E-322-REFERRALS-DEFAULT`** | Default **`scripts/e2e-anvil.sh`** Playwright set includes **`e2e/anvil-referrals.spec.ts`** | `bash scripts/e2e-anvil.sh` |
| **`INV-ANVIL-E2E-322-INDEXER-MODE`** | **`YIELDOMEGA_E2E_INDEXER=1`** starts Postgres-backed indexer, inlines **`VITE_INDEXER_URL`**, runs **`e2e/anvil-indexer-first.spec.ts`** | `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` · [e2e-anvil.md §301](e2e-anvil.md#indexer-first-vs-minimal-e2e-gitlab-301) |
| **`INV-DEVOPS-322-GITLAB-CI-MINIMAL`** | No `.gitlab-ci.yml`; GitLab is issue/MR host; merge gate stays on GitHub Actions | [ci.md §322](ci.md#gitlab-github-ci-split-gitlab-322) |

<a id="anvil-deploy-dev-caller-scope-gitlab-289"></a>

### Anvil DeployDev caller scope (GitLab [#289](https://gitlab.com/PlasticDigits/yieldomega/-/issues/289))

Follow-up to [#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281) / [!43](https://gitlab.com/PlasticDigits/yieldomega/-/merge_requests/43): **`yieldomega_anvil_deploy_dev`** must not assign **`TA`**, **`DOUB`**, **`CRED`**, etc. in the caller shell.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DEPLOY-289-NO-CALLER-LEAK`** | Two **`yieldomega_anvil_deploy_dev`** calls in one shell do not change caller **`DOUB`** until **`yieldomega_export_deploy_addrs_from_log`** | [`verify-evm-dev-wallet-seed-anvil.sh`](../../scripts/verify-evm-dev-wallet-seed-anvil.sh) |
| **`INV-DEPLOY-289-EXPORT-API`** | Callers that need addresses call **`yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"`** (and **`yieldomega_export_kumbaya_addrs_from_log`** when Kumbaya fixtures ran) | [`test-anvil-deploy-caller-scope.sh`](../../scripts/test-anvil-deploy-caller-scope.sh) · [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh) |

Doc: [e2e-anvil.md §289](e2e-anvil.md#anvil-deploy-dev-caller-scope-gitlab-289).

<a id="frontend-single-chain-wagmi-issue-81"></a>

### Frontend single-chain wagmi (GitLab [#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81))

**INV-FRONTEND-81:** Wagmi **`chains`** = [`configuredChain()`](../../frontend/src/lib/chain.ts) only (default **31337** + local RPC).

<a id="frontend-wallet-chain-write-gating-issue-95"></a>

### Frontend wallet chain write gate (GitLab [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95))

**INV-FRONTEND-95:** When **`useChainId() !== configuredTargetChainId()`**, in-app writes on **`/arena`**, **`/referrals`** are blocked via **`chainMismatchWriteMessage`**, overlays, and **`SwitchToTargetChainButton`**.

<a id="arena-buy-charm-wrong-chain-visual-gitlab-194"></a>

### Arena buy CTA wrong-chain visual (GitLab [#194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194))

**INV-FRONTEND-194-ARENA-BUY-CHAIN:** On **`/arena`**, mismatched chain adds **`arena-simple__cta--wrong-network`**, native **`title`**, no Framer lift, raised **`ChainMismatchWriteBarrier`**.

<a id="arena-buy-wallet-session-drift-gitlab-144"></a>

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

<a id="megaeth-wss-realtime-gitlab-237"></a>

## MegaETH WSS realtime head (GitLab [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237)) — deferred

Phase 1 (**`miniBlocks`** WSS → in-memory head → SSE/snapshot → second agent-card pill) is **open**. Arena v2 replan required before implementation (issue comment 2026-05-30). Manual mainnet QA rows: [manual QA §237](manual-qa-checklists.md#manual-qa-issue-237).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-237-WSS-NO-WRITE`** | While deferred: no WSS client, no **`miniBlocks`** / **`eth_subscribe`** in **`indexer/src`**; RPC ingest unchanged | `bash scripts/verify-issue-237-wss-deferred.sh` · `rg miniBlocks indexer/src` → empty |
| **`INV-INDEXER-237-STATUS-SPLIT`** | While deferred: **`GET /v1/status`** exposes **`max_indexed_block`** / **`chain_pointer` only** — no WSS head mixed into indexed fields | `verify-issue-237-wss-deferred.sh` · [`api.rs`](../../indexer/src/api.rs) |
| **`INV-INDEXER-237-REALTIME-ROUTES`** | While deferred: no **`GET /v1/realtime/*`** routes | `verify-issue-237-wss-deferred.sh` |
| **`INV-FRONTEND-237-WSS-HEAD-PILL`** | While deferred: **`IndexerStatusBar`** shows **indexed block only** (no “latest websockets block” pill) | `verify-issue-237-wss-deferred.sh` · [`IndexerStatusBar.tsx`](../../frontend/src/components/IndexerStatusBar.tsx) |
| **`INV-INDEXER-237-ANVIL-GRACEFUL`** | Anvil / CI: no **`miniBlocks`**; stack runs without WSS env | `verify-issue-237-wss-deferred.sh` · `unset INDEXER_WSS_URL` |

**When Phase 1 ships (future):** add **`confirmation: wss_realtime`** on realtime DTOs; WSS supervision fields on status/health ([#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)); optional mainnet smoke behind **`INDEXER_WSS_URL`** secret.

Cross-links: [`docs/indexer/design.md` §237](../indexer/design.md#megaeth-wss-realtime-gitlab-237) · [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

<a id="indexer-json-rpc-load-benchmark-gitlab-306"></a>

### Indexer JSON-RPC load benchmark (GitLab [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-306-STATUS-METRICS`** | With **`INDEXER_EXPOSE_OPS_METRICS=1`**, **`GET /v1/status/ops`** (schema **≥ 2.13.0**) exposes **`rpc_metrics`** with **`calls_per_min_1m`**, **`peak_calls_10s`**, **`by_method`**, **`by_caller`** after warm-up; public **`GET /v1/status`** always omits **`rpc_metrics`** ([#328](https://gitlab.com/PlasticDigits/yieldomega/-/issues/328)) | `bash scripts/verify-indexer-rpc-metrics.sh` · [`api.rs`](../../indexer/src/api.rs) · [`rpc_metrics.rs`](../../indexer/src/rpc_metrics.rs) |
| **`INV-INDEXER-306-BENCHMARK-HARNESS`** | Reproducible localnet scenario script (idle, catch-up, active arena) samples status metrics | `bash scripts/benchmark-indexer-rpc-anvil.sh` · [`docs/indexer/rpc-load-benchmark.md`](../indexer/rpc-load-benchmark.md) |
| **`INV-INDEXER-306-NO-REGRESSION`** | Ingestion liveness ([#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)) and arena head APIs ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) unchanged | `bash scripts/verify-podium-live-anvil.sh` · `cd indexer && cargo test` |

<a id="indexer-http-rate-limiting-gitlab-328"></a>

### Indexer HTTP rate limiting (GitLab [#328](https://gitlab.com/PlasticDigits/yieldomega/-/issues/328))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-328-RATE-LIMIT`** | Per-peer in-process limits via **`tower_governor`**; **`GET /healthz`** exempt; burst abuse returns **429** | `bash scripts/verify-indexer-rate-limit.sh` · [`rate_limit.rs`](../../indexer/src/rate_limit.rs) · [`main.rs`](../../indexer/src/main.rs) |
| **`INV-INDEXER-328-STATUS-TRIM`** | Public **`GET /v1/status`** omits **`rpc_metrics`** / **`chain_pointer`** by default; ops detail on **`GET /v1/status/ops`** when **`INDEXER_EXPOSE_OPS_METRICS=1`** | `bash scripts/verify-indexer-rpc-metrics.sh` · [`api.rs`](../../indexer/src/api.rs) |

<a id="indexer-adaptive-chain-timer-poll-gitlab-308"></a>

### Indexer adaptive chain-timer poll spacing (GitLab [#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-308-ADAPTIVE-POLL`** | Chain-timer uses **1s** fast polls when `read_block_number`, `last_buy_epoch`, `podium_epochs`, or onchain deadlines change, or wall-clock is within **`CHAIN_TIMER_DEADLINE_PROXIMITY_SEC`** of any deadline; otherwise **`CHAIN_TIMER_IDLE_POLL_MS`** (default **3000**, max **3000**) with **1-call** `eth_blockNumber` short-circuit when the head block is unchanged | [`chain_timer_poll.rs`](../../indexer/src/chain_timer_poll.rs) · [`chain_timer.rs`](../../indexer/src/chain_timer.rs) · `cd indexer && cargo test chain_timer_poll` |
| **`INV-INDEXER-308-FAILURE-BACKOFF`** | `RpcPollHealth` failure / HTTP **429** backoff tiers unchanged on poll errors (`chain_timer_sleep_after_cycle` delegates to `backoff_sleep` when poll fails or streak ≥ threshold) | [`chain_timer_poll.rs`](../../indexer/src/chain_timer_poll.rs) · [`rpc_poll_health.rs`](../../indexer/src/rpc_poll_health.rs) |
| **`INV-INDEXER-308-TIMER-FRESHNESS`** | Idle spacing capped at **3s** so `GET /v1/arena/timers` `polled_at_ms` stays within operator SLO when RPC healthy | [`chain_timer_poll.rs`](../../indexer/src/chain_timer_poll.rs) · `bash scripts/benchmark-indexer-rpc-anvil.sh` |

Cross-links: [`docs/indexer/rpc-load-benchmark.md`](../indexer/rpc-load-benchmark.md) · parent [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306).

Cross-links: [`docs/indexer/design.md` §306](../indexer/design.md#indexer-json-rpc-load-benchmark-gitlab-306) · play skill [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md).

<a id="indexer-chain-timer-multicall-gitlab-307"></a>

### Indexer chain-timer Multicall3 batching (GitLab [#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307))

Parent: [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306). Head poller: [`chain_timer.rs`](../../indexer/src/chain_timer.rs) · transport: [`multicall.rs`](../../indexer/src/multicall.rs).

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-INDEXER-307-MULTICALL-BATCH`** | `poll_once` batches timer/sale-head/podium reads via Multicall3 **`aggregate3`** at one `read_block_number`; **`rpc_metrics`** counts **one** `eth_call` per aggregate | [`multicall.rs`](../../indexer/src/multicall.rs) · [`chain_timer.rs`](../../indexer/src/chain_timer.rs) · `bash scripts/verify-indexer-rpc-metrics.sh` |
| **`INV-INDEXER-307-ANVIL-MULTICALL3`** | Fresh Anvil bootstraps Multicall3 at `0xcA11…CA11` before indexer start (signed deploy tx) | [`scripts/lib/anvil_multicall3.sh`](../../scripts/lib/anvil_multicall3.sh) · `start-local-anvil-stack.sh` · `benchmark-indexer-rpc-anvil.sh` |
| **`INV-INDEXER-307-RPC-BURST`** | Idle localnet **`peak_calls_10s` ≤ 50** after warm-up (120s benchmark scenario) | `BENCHMARK_SCENARIO_SEC=120 bash scripts/benchmark-indexer-rpc-anvil.sh` · [`rpc-benchmark-20260613T071949Z.json`](../indexer/benchmarks/rpc-benchmark-20260613T071949Z.json) |
| **`INV-INDEXER-307-FALLBACK`** | When Multicall3 is unavailable, sequential `eth_call` path preserves API shapes; poll failure triggers `RpcPollHealth` backoff (no stale-as-fresh) | [`chain_timer.rs`](../../indexer/src/chain_timer.rs) `poll_once_sequential` |

Cross-links: [`docs/indexer/rpc-load-benchmark.md`](../indexer/rpc-load-benchmark.md) · [#306 invariants](#indexer-json-rpc-load-benchmark-gitlab-306).

<a id="indexer-ingestion-liveness-and-rpc-timeouts-gitlab-168"></a>

### Indexer ingestion liveness + RPC timeouts (GitLab [#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168))

**INV-INDEXER-168:** Supervised ingestion retry; **`INDEXER_RPC_REQUEST_TIMEOUT_SEC`**; **`GET /v1/status`** **`ingestion_alive`** + **`last_indexed_at_ms`**.

<a id="indexer-production-database-url-placeholders-gitlab-142"></a>

### Indexer production `DATABASE_URL` (GitLab [#142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142))

**INV-INDEXER-142:** **`INDEXER_PRODUCTION`** rejects placeholder substrings in **`DATABASE_URL`**.

<a id="indexer-production-address-registry-fail-closed-gitlab-156"></a>

### Indexer production registry (GitLab [#156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156))

**INV-INDEXER-156:** With **`INDEXER_PRODUCTION`**, registry must include **`TimeArena`**, **`PodiumVaults`**, **`ReferralRegistry`**, valid **`chain_id`**, and **`deploy_block > 0`** (except Anvil **31337**). Legacy **`AdminSellVault`** key is optional ([#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314)).

<a id="indexer-public-bind-cors-guard-gitlab-326"></a>

### Indexer public bind + CORS guard (GitLab [#326](https://gitlab.com/PlasticDigits/yieldomega/-/issues/326))

**INV-INDEXER-326-PUBLIC-BIND-CORS:** When **`LISTEN_ADDR`** is not loopback and **`INDEXER_PRODUCTION`** is unset, startup logs a high-visibility warning naming permissive CORS risk (audit **F-04**, parent [#325](https://gitlab.com/PlasticDigits/yieldomega/-/issues/325)). Internet-facing operators must set **`INDEXER_PRODUCTION=1`** and **`CORS_ALLOWED_ORIGINS`**. Loopback local stacks (`127.0.0.1:3100`, Anvil) unchanged. Implementation: [`warn_public_bind_without_production`](../../indexer/src/config.rs) · [`indexer/README.md` § internet-facing](../../indexer/README.md#internet-facing-indexer-gitlab-326) · unit tests `public_bind_guard_tests` in [`config.rs`](../../indexer/src/config.rs).

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
| **`INV-DEPLOY-281-DEV-WALLET-SEED`** | Idempotent **`KEY_EVM_1..3`** seed after DeployDev: minter PK aligned with **`PRIVATE_KEY`**, loopback-only, balance skip, clear **`MINTER_ROLE`** diagnostic | [`seed-evm-dev-wallets-anvil.sh`](../../scripts/seed-evm-dev-wallets-anvil.sh), [`verify-evm-dev-wallet-seed-anvil.sh`](../../scripts/verify-evm-dev-wallet-seed-anvil.sh) ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)) |
| **`INV-DEPLOY-281-EXTRA-MINTER`** | When seed minter ≠ deploy broadcaster, **`DeployDev`** grants **`MINTER_ROLE`** to **`YIELDOMEGA_SEED_MINTER_ADDRESS`** (dev chain only) | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`anvil_deployer_key.sh`](../../scripts/lib/anvil_deployer_key.sh) ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)) |
| **`INV-DEPLOY-259-PROD-CLEAN`** | DeployProduction: no Leprechaun/Rabbit/Presale/v1 launchpad cores | [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol) |
| **`INV-DEPLOY-259-REGISTRY`** | Registry JSON: TimeArena, PodiumVaults, PlayCred, ReferralRegistry | [`scripts/lib/arena_v2_registry_from_broadcast.sh`](../../scripts/lib/arena_v2_registry_from_broadcast.sh) |
| **`INV-DEPLOY-314-NO-ADMIN-VAULT`** | Arena deploy omits **`AdminSellVault`**; `TimeArena.initialize` has no admin vault param; reserved storage slot only | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) · [#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314) |

<a id="arena-deploy-no-admin-sell-vault-gitlab-314"></a>

### Arena deploy without AdminSellVault (GitLab [#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314))

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-DEPLOY-314-NO-ADMIN-VAULT`** | **`DeployDev`** / **`DeployProduction`** do not deploy **`AdminSellVault`**; Anvil registry JSON omits the key | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh`, `bash scripts/start-local-anvil-stack.sh --no-frontend` |
| **`INV-DEPLOY-314-BUY-ZERO-ADMIN`** | Buy path still routes **100%** to podiums | `TimeArena.t.sol::test_buy_routes_doub_split` |
| **`INV-DEPLOY-314-KUMBAYA-SURPLUS`** | Kumbaya buy-router DOUB dust → deployer (`doubSurplusRecipient`), not admin vault | [`DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol) |

Ops: [`deployment-guide` §314](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) · play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

Ops: [`deployment-guide` §259](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) · E2E: [`e2e-anvil.md`](e2e-anvil.md) · dev-wallet seed: [`e2e-anvil.md` § dev-wallet seed](e2e-anvil.md#anvil-dev-wallet-seed-gitlab-281) ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)).

---

<a id="cloud-agent-native-postgres-gitlab-287"></a>

### Cloud Agent native Postgres (GitLab [#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287))

Indexer QA on Cloud VMs without Docker **`yieldomega-pg`**: host **PostgreSQL 16** on **`127.0.0.1:5433`**, **`postgresql-client`**, **`yieldomega`** / **`password`**, **`CREATEDB`**, databases **`yieldomega_indexer`** and **`yieldomega_indexer_test`**.

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-CLOUD-287-NATIVE-PG`** | Bootstrap is idempotent; `psql "$DATABASE_URL" -c 'SELECT 1'` succeeds after `bootstrap-cloud-postgres-native.sh` | [`bootstrap-cloud-postgres-native.sh`](../../scripts/bootstrap-cloud-postgres-native.sh), [`verify-cloud-postgres.sh`](../../scripts/verify-cloud-postgres.sh) |
| **`INV-CLOUD-287-PSQL-CLIENT`** | **`psql`** and **`pg_isready`** on PATH for verify / Anvil indexer scripts | [`verify-cloud-postgres.sh`](../../scripts/verify-cloud-postgres.sh) |
| **`INV-CLOUD-287-CREATEDB`** | **`yieldomega`** can `DROP`/`CREATE` databases via `psql` (verify scripts reset app DB without `docker exec`) | [`verify-cloud-postgres.sh`](../../scripts/verify-cloud-postgres.sh) CREATEDB probe; [`verify-podium-live-anvil.sh`](../../scripts/verify-podium-live-anvil.sh) |

Cross-links: [AGENTS.md § Postgres without Docker](../../AGENTS.md#postgres-without-docker-yieldomega-pg) · [`.cursor/environment.json`](../../.cursor/environment.json) · [qa-local-full-stack.md](qa-local-full-stack.md) · [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md). Docker socket / container path: [#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288).

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
| [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol) | 100% podium split math (25% × 4 · 70/20/10 epoch tranches) |
| [`ReferralRegistry.t.sol`](../../contracts/test/ReferralRegistry.t.sol) | Referral burns + registration |
| [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) | DeployDev wiring |
| [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) | Optional RPC fork smoke ([#275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275)); **`INV-CONTRACTS-275-FORK-SMOKE`** |

Run `cd contracts && forge test --list` for the authoritative list. Pre–Arena v1 contract tests may remain in-tree but are **not** mapped here.

---

## Cloud Agent Docker (GitLab [#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288))

<a id="cloud-agent-docker-gitlab-288"></a>

DevOps invariants for Cursor Cloud Agent Docker socket access and native Postgres fallback. Runbook: [AGENTS.md § Docker troubleshooting](../../AGENTS.md#docker-troubleshooting-gitlab-288).

| ID | Invariant | Verify |
|----|-----------|--------|
| **`INV-DEVOPS-288-DOCKER-USER`** | After bootstrap, `docker info` and `docker run --rm hello-world` succeed **without sudo** as `$USER`, **or** `/tmp/yieldomega-docker-unavailable` is written and verify exits **SKIP** (not FAIL) | `bash scripts/verify-docker-cloud-agent.sh` (0=PASS, 2=SKIP) · `bash scripts/bootstrap-cloud-vm-toolchain.sh` |
| **`INV-DEVOPS-288-DIAGNOSE`** | Permission-denied vs overlay/daemon errors are classified; failure prints user, groups, socket mode, and remediation | `bash scripts/verify-docker-cloud-agent.sh` (stderr on FAIL) · [`docker_cloud_agent.sh`](../../scripts/lib/docker_cloud_agent.sh) |
| **`INV-DEVOPS-288-TOOLCHAIN-SKIP`** | `verify-cloud-vm-toolchain.sh` does **not** hard-fail Docker for optional workloads; `YIELDOMEGA_DOCKER_REQUIRED=1` hard-fails | `bash scripts/verify-cloud-vm-toolchain.sh` |
| **`INV-DEVOPS-288-STACK-HINT`** | `start-local-anvil-stack.sh` suggests native Postgres when Docker socket/run fails | Manual: run stack without docker group |

---

## Gaps and non-goals

- **Stage 2 wallet-signed txs:** [stage2-run-log.md](../operations/stage2-run-log.md); CI Playwright is UI smoke only unless **`ANVIL_E2E=1`**.
- **~90% / 100%:** [stage3-mainnet-operator-runbook.md](../operations/stage3-mainnet-operator-runbook.md).
- **Fork smoke:** optional; see [contract-fork-smoke.md](contract-fork-smoke.md) and **`INV-CONTRACTS-275-FORK-SMOKE`** below.

---

## Contract fork smoke (optional) (GitLab #275)

<a id="contract-fork-smoke-optional-gitlab-275"></a>

**`INV-CONTRACTS-275-FORK-SMOKE`:** [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) (`TimeArenaForkTest`) is the only CI-matched fork smoke contract. With **`FORK_URL` unset**, both tests **no-op** (pass) so default **`unit-tests`** stays deterministic. With **`FORK_URL` set**, `test_fork_smoke_chainIdAndBlock` forks and asserts positive `chainid` / `block.number`. Optional `test_fork_smoke_timeArenaHeadState` reads `TimeArena.paused()` and `deadline()` when **`TIME_ARENA_FORK_ADDRESS`** points at deployed bytecode; skips on zero placeholder or empty code. **`contract-fork-smoke`** workflow uses `--match-contract TimeArenaForkTest` ([`contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml)). Runbook: [contract-fork-smoke.md](contract-fork-smoke.md). Verify: `bash scripts/verify-contract-fork-smoke.sh` · [manual QA §275](manual-qa-checklists.md#manual-qa-issue-275). Replaces retired v1 fork smoke ([#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274) doc follow-up).

---

**Related:** [testing strategy](strategy.md) · [CI mapping](ci.md) · [manual QA](manual-qa-checklists.md) · [arena-views](../frontend/arena-views.md)
