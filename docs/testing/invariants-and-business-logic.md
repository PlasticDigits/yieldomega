# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Player vs contributor aids:** Root [`skills/`](../../skills/) holds **play** skills (participation). Maintainer **manual QA** lives in [manual-qa-checklists.md](manual-qa-checklists.md).

**Authoritative rules live onchain**; the indexer and frontend are derived read models ([architecture/overview.md](../architecture/overview.md)).

**Arena v2 product spec:** [`docs/product/arena-v2.md`](../product/arena-v2.md) · Epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Retired v1 launchpad, treasury, NFT, and CL8Y fee-split stacks — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). Bulk removal of legacy invariant sections: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263) · verify links: `bash scripts/check-doc-anchors.sh`.

<a id="arena-v2-play-skills-gitlab-245"></a>

## Arena v2 play skills & bot paths (GitLab [#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-DOCS-245-PLAY-SKILLS`** | Root [`skills/README.md`](../../skills/README.md) indexes **`play-active-time-arena`**, **`play-time-arena-doub`**, **`play-time-arena-warbow`** only (legacy `play-timecurve-*` / Rabbit / collectible NFT removed) | `skills/play-*-time-arena*/SKILL.md`, grep absence of `play-timecurve-doubloon` |
| **`INV-DOCS-245-GUARDRAILS`** | [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) references Arena v2 onchain authority + [`skills/README.md`](../../skills/README.md) play index | manual review |
| **`INV-DOCS-245-PHASE20`** | [`docs/agent-phases.md`](../agent-phases.md) Phase 20 prompt names Time Arena play skills + [`docs/product/time-arena.md`](../product/time-arena.md) | `grep play-time-arena agent-phases.md` |
| **`INV-BOTS-245-TIMEARENA`** | Bot package at [`bots/timearena/`](../../bots/timearena/README.md); env **`YIELDOMEGA_TIME_ARENA_ADDRESS`**; `inspect` reads **`TimeArena.doub()`** / **`arenaStart`** / **`paused`** (not legacy `saleStart` / `acceptedAsset`) | `bots/timearena/tests/`, `bash scripts/sync-bot-env-from-frontend.sh` |
| **`INV-BOTS-245-ENV-SYNC`** | `scripts/sync-bot-env-from-frontend.sh` maps **`VITE_TIME_ARENA_ADDRESS`** → bot env (no Rabbit / retired NFT env required) | script + `frontend/.env.example` |

Cross-links: [`bots/timearena/README.md`](../../bots/timearena/README.md) · [`skills/script-with-timecurve-local/SKILL.md`](../../skills/script-with-timecurve-local/SKILL.md) (local stack env hygiene).


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

Authoritative product rules: [`docs/product/time-arena.md`](../product/time-arena.md) · [`docs/product/arena-v2.md`](../product/arena-v2.md). Parent epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-ROUTE-SPLIT`** | 40% active + 30% seed + 30% admin per DOUB buy; **no** legacy FeeRouter CL8Y burn/LP sinks ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)) | [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol), `TimeArena.t.sol::test_buy_routes_doub_split` · [fee-routing](../onchain/fee-routing-and-governance.md) |
| **`INV-TIME-ARENA-TIMER-EXTEND`** | Qualifying buy adds **+120s** when not in hard-reset band | `test_timer_extension_without_hard_reset` |
| **`INV-TIME-ARENA-TIMER-HARD-RESET`** | Under **13m** remaining → **900s** reset; **`lastBuyEpoch`** increments | `test_timer_hard_reset_increments_epoch` |
| **`INV-TIME-ARENA-TIMER-MULTI`** | One buy extends **all four** `podiumDeadline[i]` | `test_multi_podium_deadline_extend` |
| **`INV-TIME-ARENA-PODIUM-ROLL`** | `rollPodiumEpoch(cat)` after expiry; epoch bump | `test_roll_podium_after_expiry` |
| **`INV-TIME-ARENA-CRED-ACCRUE`** | DOUB buy adds **35 CRED** (18 dec) to epoch pool | `test_cred_accrue_on_doub_buy` |
| **`INV-TIME-ARENA-CRED-CLAIM`** | `claimCred(epoch)` pro-rata by `epochCharmWad` | `test_cred_pro_rata_claim` |
| **`INV-TIME-ARENA-CRED-BURN-BUY`** | `buyWithCred` burns **100 CRED** per 1e18 CHARM (`CRED_PER_CHARM_WAD`) | `test_buy_with_cred`, `test_buyWithCred_10charm_burns_1000_cred`, `test_buyWithCred_min_charm_burns_scaled` |
| **`INV-TIME-ARENA-FIRST-BUY-CRED-BONUS`** | First `_finishBuy` per wallet schedules **150 CRED** for **`lastBuyEpoch + 1`** (post-reset); not repeated; survives epoch roll | `test_first_buy_doub_schedules_bonus`, `test_first_buy_cred_schedules_bonus_once`, `test_claim_cred_bonus_only_no_charm`, `test_first_buy_hard_reset_targets_post_epoch` ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) |
| **`INV-TIME-ARENA-XP`** | XP 1–10 linear in CHARM band; level steps per `ArenaXp` | `test_xp_levels` |
| **`INV-TIME-ARENA-XP-GAS`** | Cached **`level`** + **`xpTowardNext`**; ≤5 level-ups/buy; no reset on epoch; O(1) views; matches `levelFromXp` after each buy | `ArenaXp.t.sol`, `TimeArena.t.sol::test_xp_*` ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)) |
| **`INV-TIME-ARENA-WARBOW-DOUB`** | WarBow spends are DOUB pulls | `test_warbow_steal_pulls_doub` |
| **`INV-TIME-ARENA-ALWAYS-LIVE`** | No sale-end or charm-redemption gates; only `paused` | `TimeArena.sol` + negative grep in arena contracts |
| **`INV-REMOVAL-243-NO-LAUNCHPAD-LIFECYCLE`** | No `TimeCurve.sol`, `endSale`, `redeemCharms`, `distributePrizes`, `LinearCharmPrice`, presale vesting contracts, or `/vesting` route | `rg` clean in `contracts/src`; no `PresaleVestingPage`; `LaunchGate.tsx` routes; [`surfaceContent.ts`](../../frontend/src/lib/surfaceContent.ts) → `/arena` ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)) |
| **`INV-FRONTEND-260-ARENA-MOUNT`** | `/arena` mounts timer chips + CRED card | `e2e/anvil-arena-mount.spec.ts` |
| **`INV-FRONTEND-269-CRED-BUY`** | Arena buy picker includes CRED when `playCred` set; burn preview from onchain constants; submit `buyWithCred` | `arenaCredBurn.test.ts`, `e2e/anvil-arena-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| **`INV-INDEXER-260-ARENA-TIMERS`** | `GET /v1/arena/timers` (+ buys, wallet stats) | `integration_stage2.rs` HTTP smoke |
| **`INV-INDEXER-260-NO-TIMECURVE-DECODE`** | No legacy sale `DecodedEvent` variants; Arena + referral registry only | `decoder.rs`, `cargo test` |
| **`INV-TIME-ARENA-PODIUM-TOPUP`** | `topUpPodiumPools` sends 100% of DOUB to eight prize vaults (10:7.5 active:seed per category); **no** admin take; **no** `totalDoubRaised` bump | `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*` |
| **`INV-INDEXER-262-DONATE-POOLS`** | `PodiumPoolsToppedUp` → `idx_arena_podium_pool_top_up`; `GET /v1/arena/podium-pool-donations` | `integration_stage2.rs` |
| **`INV-FRONTEND-262-DONATE-POOLS`** | AUDIT card disclosure + indexer empty/offline placeholders + write gate | `TimeCurveProtocolDonatePoolsSection.test.tsx`, `e2e/timecurve.spec.ts` |
| **`INV-INDEXER-267-VAULT-FUNDING`** | `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` → `idx_arena_vault_funding`; sum per `tx_hash` = `doub_paid` for DOUB buys; CRED buys have zero funding rows | `integration_stage2.rs` (`api_vault_funding_smoke`) |
| **`INV-FRONTEND-266-ARENA-ROUTES`** | Canonical play at `/arena`, AUDIT at `/arena/protocol`; `/timecurve/*` redirects; env requires `VITE_TIME_ARENA_ADDRESS` only | `LaunchGate.tsx`, `scripts/check-frontend-vite-env.sh`, `e2e/navigation.spec.ts` |
| **`INV-FRONTEND-266-ARENA-INDEXER`** | Browser reads use `/v1/arena/*` only; no `/v1/timecurve/*` or legacy WarBow HTTP | `indexerApi.ts`, `indexer/src/api_arena.rs` |

**Pay-mode E2E:** `arena-paywith-{cl8y,cred,eth,usdm}` on [`TimeCurveSimplePage.tsx`](../../frontend/src/pages/TimeCurveSimplePage.tsx) (`/arena`). **DOUB** direct `buy`; **CRED** `buyWithCred` — `e2e/anvil-arena-cred-buy.spec.ts` ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)); **ETH/USDM** use `TimeArenaBuyRouter.buyViaKumbaya` when `timeArenaBuyRouter` is set ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), frontend [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Env: `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` must match onchain when set (legacy alias `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`). **Pause:** `TimeArena.paused` only — not `buyFeeRoutingEnabled`.

<a id="arena-podium-pool-topup-gitlab-261"></a>

### Manual podium pool top-up (GitLab [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

Onchain: **`TimeArena.topUpPodiumPools`** · routing: **`ArenaBuyRouting.splitPrizeTopUpAmount`** · **`INV-TIME-ARENA-PODIUM-TOPUP`**. Product: [arena-v2 § manual top-up](../product/arena-v2.md#manual-podium-pool-top-up-gitlab-261) · onchain: [fee-routing § top-up](../onchain/fee-routing-and-governance.md#manual-podium-pool-top-up-gitlab-261). Forge: `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*`.

<a id="dev-kumbaya-anvil-deploy-gitlab-270"></a>

### Dev Kumbaya deploy + ETH E2E (GitLab #270)

| ID | Rule | Enforcement |
|----|------|-------------|
| **`INV-DEV-KUMBAYA-270-DEPLOY`** | `DeployKumbayaAnvilFixtures` calls `DevOnlyChainGuard`; seeds DOUB↔WETH and USDM↔WETH↔DOUB pools; `setTimeArenaBuyRouter` matches logged router | `DeployKumbayaAnvilFixtures.s.sol`, `scripts/lib/anvil_deploy_dev.sh` cast check |
| **`INV-DEV-KUMBAYA-270-E2E`** | Default `bash scripts/e2e-anvil.sh` sets `YIELDOMEGA_DEPLOY_KUMBAYA=1` and exports `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | `scripts/e2e-anvil.sh`, `e2e/anvil-arena-wallet-writes.spec.ts` ETH case |
| **`INV-TIME-ARENA-BUY-ROUTER`** | `buyViaKumbaya` ETH/USDM happy path; stable ingress parity; charm bounds; paused arena; router-only `buyFor` | `TimeArenaBuyRouter.t.sol` |
| **`INV-TIME-ARENA-BUYFOR-PULL`** | `buyFor` pulls DOUB from `timeArenaBuyRouter`, not the participant wallet | `TimeArena.sol` `_buyDoub`; `TimeArenaBuyRouter.t.sol` |

<a id="arena-podium-pool-donations-gitlab-262"></a>

### Arena podium pool donations (GitLab [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

Indexer HTTP: **`GET /v1/arena/podium-pool-donations`** (ingests **`PodiumPoolsToppedUp`** from [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)). Frontend: protocol AUDIT card — [arena-views § donate-pools](../frontend/arena-views.md#protocol-donate-pools-gitlab-262). Play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

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

CI sets `YIELDOMEGA_PG_TEST_URL` so `postgres_stage2_persist_all_events_and_rollback_after` runs migrations, inserts **every non-Unknown Arena v2** [`DecodedEvent`](../../indexer/src/decoder.rs) variant, checks idempotency, calls `rollback_after`, then HTTP smoke for **`GET /v1/arena/*`** and **`GET /v1/referrals/*`**.

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
| **ReferralRegistry** | Code registration, referred-buy CRED split | [referrals.md](../product/referrals.md) |
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

**INV-FRONTEND-194-ARENA-BUY-CHAIN:** On **`/arena`**, mismatched chain adds **`timecurve-simple__cta--wrong-network`**, native **`title`**, no Framer lift, raised **`ChainMismatchWriteBarrier`**.

<a id="timecurve-buy-wallet-session-drift-gitlab-144"></a>

### Buy wallet session drift mid-flow (GitLab [#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144))

**INV-BUY-SESSION-144:** **`captureWalletBuySession`** + **`assertWalletBuySessionUnchanged`** after every **`await`** in multi-step **`/arena`** buys ([`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts)).

<a id="referral-registration-wallet-session-drift-gitlab-155"></a>

### Referral registration session drift (GitLab [#155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155))

**INV-REFERRAL-SESSION-155:** Same guard pattern on **`/referrals`** **`registerCode`**.

<a id="erc20-balance-delta-ingress-gitlab-123"></a>

### ERC-20 balance-delta ingress (GitLab [#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123))

**INV-ERC20-123:** DOUB (and other) pulls on **`TimeArena`** use balance-delta parity — credited amount equals declared spend.

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
| **`INV-DEPLOY-259-PROD-CLEAN`** | DeployProduction: no retired v1 NFT/treasury/presale/TimeCurve | [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol) |
| **`INV-DEPLOY-259-REGISTRY`** | Registry JSON: TimeArena, PodiumVaults, AdminSellVault, PlayCred | [`scripts/lib/arena_v2_registry_from_broadcast.sh`](../../scripts/lib/arena_v2_registry_from_broadcast.sh) |

Ops: [`deployment-guide` §259](../operations/deployment-guide.md#arena-v2-deploy-gitlab-259) · E2E: [`e2e-anvil.md`](e2e-anvil.md).

<a id="retired-collectible-nft-gitlab-241"></a>

### Retired collectible NFT surface (GitLab [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241))

| ID | Property | Evidence |
|----|----------|----------|
| **`INV-RETIRED-241-NO-CONTRACT`** | No collectible NFT Solidity under `contracts/src/`; no deploy wiring in `DeployDev` / `DeployProduction` | File grep for retired NFT contract name → empty |
| **`INV-RETIRED-241-NO-INDEXER`** | No NFT decode tables or `/v1/*` mint routes in `indexer/src/` | Indexer source grep → empty |
| **`INV-RETIRED-241-NO-FRONTEND`** | No `/collection` route, `CollectionPage`, or NFT read ABI in `frontend/src/` | Frontend source grep → empty |
| **`INV-RETIRED-241-DOCS-SKILLS`** | Product doc + play skill removed; schema archived under [`schemas/archive/`](../../schemas/archive/) | [`skills/README.md`](../../skills/README.md) · guardrails [§12](../../.cursor/skills/yieldomega-guardrails/SKILL.md) |
| **`INV-RETIRED-241-RG-CLEAN`** | Repo grep for retired NFT keyword empty outside `CHANGELOG` / `archive` / `audits` | Manual gate before closing #241 |

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

---

## Contract test suite inventory (Arena v2 focus)

| File | Focus |
|------|--------|
| [`TimeArena.t.sol`](../../contracts/test/TimeArena.t.sol) | Timers, buys, CRED, XP, WarBow DOUB, routing |
| [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol) | 40/30/30 split math |
| [`DoubPresaleVesting.t.sol`](../../contracts/test/DoubPresaleVesting.t.sol) | Vesting schedule + claims |
| [`ReferralRegistry.t.sol`](../../contracts/test/ReferralRegistry.t.sol) | Referral burns + registration |
| [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol) | DeployDev wiring |

Run `cd contracts && forge test --list` for the authoritative list. Pre–Arena v1 contract tests may remain in-tree but are **not** mapped here.

---

## Gaps and non-goals

- **Stage 2 wallet-signed txs:** [stage2-run-log.md](../operations/stage2-run-log.md); CI Playwright is UI smoke only unless **`ANVIL_E2E=1`**.
- **~90% / 100%:** [stage3-mainnet-operator-runbook.md](../operations/stage3-mainnet-operator-runbook.md).
- **Fork smoke:** optional; see [contract-fork-smoke.md](contract-fork-smoke.md).

---

**Related:** [testing strategy](strategy.md) · [CI mapping](ci.md) · [manual QA](manual-qa-checklists.md) · [arena-views](../frontend/arena-views.md)
