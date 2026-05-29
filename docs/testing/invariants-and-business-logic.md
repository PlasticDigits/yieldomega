# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Player vs contributor aids:** Root [`skills/`](../../skills/) holds **play** skills (participation). Maintainer **manual QA** lives in [manual-qa-checklists.md](manual-qa-checklists.md).

**Authoritative rules live onchain**; the indexer and frontend are derived read models ([architecture/overview.md](../architecture/overview.md)).

**Arena v2 product spec:** [`docs/product/arena-v2.md`](../product/arena-v2.md) · Epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Retired v1 launchpad, treasury, NFT, and CL8Y fee-split stacks — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). Bulk removal of legacy invariant sections: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263) · verify links: `bash scripts/check-doc-anchors.sh`.

---

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

Authoritative product rules: [`docs/product/arena-v2.md`](../product/arena-v2.md). Parent epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

| ID | Property | Automated evidence |
|----|----------|-------------------|
| **`INV-TIME-ARENA-ROUTE-SPLIT`** | 40% active + 30% seed + 30% admin per DOUB buy; zero dust in `TimeArena` | [`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol), `TimeArena.t.sol::test_buy_routes_doub_split` |
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
| **`INV-FRONTEND-260-ARENA-MOUNT`** | `/arena` mounts timer chips + CRED card | `e2e/anvil-arena-mount.spec.ts` |
| **`INV-INDEXER-260-ARENA-TIMERS`** | `GET /v1/arena/timers` (+ buys, wallet stats) | `integration_stage2.rs` HTTP smoke |
| **`INV-INDEXER-260-NO-TIMECURVE-DECODE`** | No legacy sale `DecodedEvent` variants; Arena + referral registry only | `decoder.rs`, `cargo test` |
| **`INV-TIME-ARENA-PODIUM-TOPUP`** | `topUpPodiumPools` sends 100% of DOUB to eight prize vaults (10:7.5 active:seed per category); **no** admin take; **no** `totalDoubRaised` bump | `ArenaPrizeRouting.t.sol`, `TimeArena.t.sol::test_topUpPodiumPools_*` |
| **`INV-INDEXER-262-DONATE-POOLS`** | `PodiumPoolsToppedUp` → `idx_arena_podium_pool_top_up`; `GET /v1/arena/podium-pool-donations` | `integration_stage2.rs` |
| **`INV-FRONTEND-262-DONATE-POOLS`** | AUDIT card disclosure + indexer empty/offline placeholders + write gate | `TimeCurveProtocolDonatePoolsSection.test.tsx`, `e2e/timecurve.spec.ts` |

**Pay-mode E2E:** `arena-paywith-{cl8y,eth,usdm}` on [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) (`/arena`). ETH route E2E gates on `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER` until [#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251).

<a id="arena-podium-pool-donations-gitlab-262"></a>

### Arena podium pool donations (GitLab [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

Onchain entry: **`TimeArena.topUpPodiumPools`** ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)). Indexer HTTP: **`GET /v1/arena/podium-pool-donations`**. Frontend: protocol AUDIT card — [arena-views § donate-pools](../frontend/arena-views.md#protocol-donate-pools-gitlab-262). Play skill: [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md).

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

**INV-FRONTEND-95:** When **`useChainId() !== configuredTargetChainId()`**, in-app writes on **`/arena`**, **`/referrals`**, **`/vesting`** are blocked via **`chainMismatchWriteMessage`**, overlays, and **`SwitchToTargetChainButton`**.

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

<a id="qa-local-full-stack-orchestrator-gitlab-104"></a>

### QA local full stack (GitLab [#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104))

**INV-QA-FULLSTACK-104:** [`start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) delegates only to [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh). Playwright stays in [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh).

<a id="launchgate-home-route--no-env-parity-gitlab-199"></a>

### LaunchGate `/home` route (GitLab [#199](https://gitlab.com/PlasticDigits/yieldomega/-/issues/199))

**INV-FRONTEND-199-HOME-ROUTE:** No-env builds register **`/home`** → **`HomePage`** so the shell outlet is not empty.

<a id="branded-404-catch-all-gitlab-223"></a>

### Branded 404 (GitLab [#223](https://gitlab.com/PlasticDigits/yieldomega/-/issues/223))

**INV-FRONTEND-223-NOT-FOUND:** **`path="*"`** → **`NotFoundPage`**; **`/arena`**, **`/referrals`**, **`/vesting`** unchanged.

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
