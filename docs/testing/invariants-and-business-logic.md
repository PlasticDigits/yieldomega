# Business logic, invariants, and test mapping

This document ties **product intent** and **must-hold properties** to **automated tests** and **manual evidence**. It complements [strategy.md](strategy.md) (stages and CI) and [ci.md](ci.md) (what runs in GitHub Actions).

**Player vs contributor aids ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)):** Root [`skills/`](../../skills/) holds **six** player-facing Agent skills (participation, not forks). Maintainer **manual QA** procedural checklists for contributors live in [manual-qa-checklists.md](manual-qa-checklists.md); links below say **Manual QA** where those rows apply.

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

GitHub Actions sets `YIELDOMEGA_PG_TEST_URL` against a **service container** so `postgres_stage2_persist_all_events_and_rollback_after` connects, runs migrations, inserts **every non-Unknown** [`DecodedEvent`](../../indexer/src/decoder.rs) variant—including **`BuyViaKumbaya`** ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)), **`PodiumResidualRecipientSet`** / buy-router **`EthRescued`**/**`Erc20Rescued`** ([GitLab #139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139)), **and operator / treasury / vesting observability emitted by deployed contracts per** [§ Indexer emitted-event coverage (GitLab #112)](#indexer-emitted-event-coverage-gitlab-112)—checks idempotency, calls `rollback_after`, exercises **per-block transaction rollback** coverage ([§ #140](#indexer-transactional-block-ingestion-gitlab-140)), then HTTP API smoke ([ci.md](ci.md)).

If the variable is **unset or empty** locally, that test **returns immediately** and still reports **passed** — it does **not** prove Postgres behavior. Export a URL to the same database you use for manual indexer runs when you need local parity with CI.

<a id="indexer-emitted-event-coverage-gitlab-112"></a>

### Indexer emitted-event coverage (GitLab [#112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112))

**INV-INDEXER-112:** Solidity `event`s emitted by **deployed** Yieldomega protocol contracts mapped in [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs) must each land in a **`DecodedEvent` variant with a Postgres `idx_*` table** (migration `20260502130000_gl112_extended_event_tables`, prior migrations for legacy coverage) and **`persist_decoded_log_conn`** / **`persist_decoded_log_autocommit`** inserts (same row writes; see [**INV-INDEXER-148-AUTOCOMMIT**](#post-138-hygiene-naming-gitlab-148)). **`rollback_after`** must delete rows from **every** persisted event table [listed in **`reorg.rs`**](../../indexer/src/reorg.rs) so deep reorgs do not strand orphan projections. Operational toggles (e.g. **`BuyFeeRoutingEnabled`**, **`CharmRedemptionEnabled`**, **`ClaimsEnabled`**), treasury accounting (**`BurrowProtocolRevenueSplit`**, **`BurrowReserveBuckets`**, **`BurrowWithdrawalFeeAccrued`**), podium wiring (**`PrizePusherSet`**), buy-router dust (**`Cl8ySurplusToProtocol`**), **`FeeSink` `Withdrawn`**, **`DoubPresaleVesting` lifecycle / claims / `RescueERC20`** ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137); table **`idx_doub_vesting_rescue_erc20`**), **`TimeCurveBuyRouterSet`**, and **`DoubPresaleVestingSet`** (presale CHARM weight wiring) are **first-class indexer rows** alongside user-activity aggregates. **`TimeCurve` `PodiumResidualRecipientSet`** (**`idx_timecurve_podium_residual_recipient_set`**) and **`TimeCurveBuyRouter` `EthRescued` / `Erc20Rescued`** (**`idx_timecurve_buy_router_eth_rescued`**, **`idx_timecurve_buy_router_erc20_rescued`** — **distinct `topic0`** from **`FeeRouter.ERC20Rescued`**, [GitLab #139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139), [GitLab #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117)) complete the audit trail for governance routing and router owner rescue. **Prize settlement ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)):** **`PrizesDistributed`** ↔ **`idx_timecurve_prizes_distributed`**; **`PrizesSettledEmptyPodiumPool`** ↔ **`idx_timecurve_prizes_settled_empty_podium_pool`**; **`GET /v1/timecurve/prize-distributions`** unions both with **`kind`** **`distributed`** \| **`settled_empty_podium_pool`** (schema **≥ 1.14.0**).

<a id="indexer-residual-router-rescue-gitlab-139"></a>

**INV-INDEXER-139 (rows under #112):** every **`setPodiumResidualRecipient`** and buy-router **`rescueETH` / `rescueERC20`** emit must **decode**, **persist**, and **rollback** with the same **`reorg.rs`** guarantees as other `idx_*` projections (integration: [`indexer/tests/integration_stage2.rs`](../../indexer/tests/integration_stage2.rs)).

**Historical compatibility:** legacy **`AllocationClaimed`** logs decode into **`TimeCurveCharmsRedeemed`** (same row shape); there is **no duplicate** AllocationClaimed-only table ([issue discussion](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112)).

**Contributor / third-party agents:** indexer scope is contributor Phase 18 / [`.cursor/skills/yieldomega-guardrails`](../../.cursor/skills/yieldomega-guardrails/SKILL.md). Participant-facing indexer *usage* pointers stay in **[`skills/README.md`](../../skills/README.md)** (derived read models, API pagination). **`FeeRouter`** emits **`DistributableTokenUpdated`** / **`ERC20Rescued`** for governance observability ([GitLab #122](https://gitlab.com/PlasticDigits/yieldomega/-/issues/122); tables **`idx_fee_router_*`** in migrations).

<a id="indexer-block-ingest-transaction-gitlab-146"></a>
<a id="indexer-transactional-block-ingestion-gitlab-140"></a>

### Indexer transactional per-block ingestion (GitLab [#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140))

**INV-INDEXER-140:** For each canonical block the JSON-RPC ingestion loop ingests, **all** decoded event inserts for that block, the matching **`indexed_blocks`** row, and the **`chain_pointer`** update are applied in **one** Postgres **transaction** (`BEGIN` … `COMMIT` in [`ingestion.rs`](../../indexer/src/ingestion.rs)). If the process crashes or a statement errors after some inserts but before commit, the transaction **rolls back**: the pointer stays at the prior tip and **no** partial `idx_*` rows for that block remain—avoiding pointer–data skew and `ON CONFLICT DO NOTHING` replay gaps described in the issue. **Bootstrap** of the pointer immediately before `effective_start` uses the same **all-or-nothing** pattern. **`rollback_after`** (reorg) remains its own multi-statement transaction and is unchanged. Callers that persist a **single** log outside the hot loop intentionally use **`persist_decoded_log_autocommit`**, which acquires a connection and auto-commits once ([GitLab #148](#post-138-hygiene-naming-gitlab-148)); the shared implementation is **`persist_decoded_log_conn`** on an open **`PgConnection`** (pool handle or outer SQL transaction). Umbrella [**#146**](https://gitlab.com/PlasticDigits/yieldomega/-/issues/146) adds related Forge coverage; Postgres evidence: **`postgres_gitlab146_block_transaction_all_or_nothing_for_shared_tx_hash`** in [`integration_stage2.rs`](../../indexer/tests/integration_stage2.rs) (explicit `ROLLBACK` leaves no ghost rows; requires `YIELDOMEGA_PG_TEST_URL`).

<a id="post-138-hygiene-naming-gitlab-148"></a>

### Post-#138 naming hygiene (GitLab [#148](https://gitlab.com/PlasticDigits/yieldomega/-/issues/148))

**Intent:** Clarify **onchain** and **indexer** identifiers after #134 / #140 verification so future edits do not misread shared thresholds or mistake **single-event** DB commits for **per-block** atomic ingestion.

| ID | Check |
|----|--------|
| **`INV-WARBOW-148-CONST`** | Public **`TimeCurve.WARBOW_MAX_STEALS_PER_DAY`** is the **single numeric threshold** for **both** **`stealsReceivedOnDay[victim][day]`** and **`stealsCommittedByAttackerOnDay[attacker][day]`** before **`payBypassBurn`** applies ([§ WarBow steal rules — #134](#timecurve-warbow-steal-rules-gitlab-134)); rename avoids **`PER_VICTIM`** implying attacker reads differ. |
| **`INV-INDEXER-148-AUTOCOMMIT`** | **`persist_decoded_log_autocommit`** in [`indexer/src/persist.rs`](../../indexer/src/persist.rs) is **one SQL transaction per call** — OK for tests / tools inserting **one** row at a time. **Do not** use it for multi-event batches that must mirror **`INV-INDEXER-140`**; open a transaction on the pool and call **`persist_decoded_log_conn`** repeatedly instead ([`ingestion.rs`](../../indexer/src/ingestion.rs)). |

**Automated:** existing Forge WarBow UTC-cap tests (unchanged behavior); **`cargo test`** — [`integration_stage2.rs`](../../indexer/tests/integration_stage2.rs) (calls **`persist_decoded_log_autocommit`** where appropriate).

<a id="gitlab-149-warbow-arena-indexer-hardening"></a>

### GitLab #149 — Arena pending-revenge load, WarBow SQL indexes, post-end refresh gate ([GitLab #149](https://gitlab.com/PlasticDigits/yieldomega/-/issues/149))

**Intent:** MegaETH-scale Arena viewers must not **spam** the indexer on every sub-second block; WarBow HTTP handlers must keep **btree** predicates aligned with lowercase **`addr_hex`** rows; **`refreshWarbowPodium`** must not **unlatch** **`warbowPodiumFinalized`** after **`endSale`**; **`pendingRevengeStealer`** must align with the **soonest-expiring** window; podium refresh UX mirrors **`uint160`** ladder tie-break; post-end gate scripts must validate **`ADDR_ALICE`**.

| ID | Check |
|----|--------|
| **`INV-INDEXER-149-ADDR-EQ`** | **`GET /v1/timecurve/warbow/pending-revenge`**, **`…/steals-by-victim-day`**, **`…/guard-latest`**, **`GET /v1/timecurve/buyer-stats`**, Rabbit deposit/withdraw filters use **`column = $n`** with **`bind_addr_lower(query)`** — **no** `LOWER(column)` on indexed address columns. **`pending-revenge`** orders **`expiry_exclusive ASC, stealer ASC`**. **`WarbowLeaderboard`** **`DISTINCT ON (buyer)`** orders by plain **`buyer`**. |
| **`INV-ARENA-149-PENDING-REVENGE`** | **`useTimeCurveArenaModel`**: **`loadPendingRevenge`** **`useCallback`** deps **`[address, saleActive]`** only; **`now_sec`** from **`ledgerSecIntRef`**. Poll: **immediate** + **8s** interval. **`pendingRevengeTargets`** sorted by **expiry** then **`stealer`**; **`pendingRevengeStealer`** = **first** target (**soonest expiry**). |
| **`INV-WARBOW-149-REFRESH-ENDED`** | **`refreshWarbowPodium`** **`require(!ended, "TimeCurve: ended")`** — sale-time repair only. |
| **`INV-WARBOW-149-PODIUM-HEURISTIC`** | **`viewerShouldSuggestWarBowPodiumRefresh`**: off-podium viewer suggests refresh when **`viewerBp > third`** or **(equal BP ∧ `uint160(viewer) < uint160(thirdWallet)`)** — [`timeCurveWarbowSnapshotClaim.ts`](../../frontend/src/lib/timeCurveWarbowSnapshotClaim.ts). |
| **`INV-SCRIPT-149-ADDR-ALICE`** | **`verify-timecurve-post-end-gates-anvil.sh`** rejects empty **`ADDR_ALICE`** / Bob / Carol / Deployer. |
| **`INV-INDEXER-160-WARBOW-REFRESH-CANDIDATES`** | **`GET /v1/timecurve/warbow/refresh-candidates`** (schema **≥ 1.15.1**, [GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160); head WarBow hint omission post-end — [GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170)) returns paginated **`candidates`** for calldata to **`refreshWarbowPodium`** **while the sale is live** only — prepends head-indexer **WarBow `podium(category=3)`** RPC hints when **`chain_timer`** is configured **and** **`!sale_ended`**, then DISTINCT wallets from indexed WarBow tables + **`idx_timecurve_buy`** rows with **`battle_points_after > 0`**; **`distinct_sql_cap_hit`** signals the SQL DISTINCT cap (**10 000**); body includes **`sale_ended`** mirroring the head timer when present (**`false`** when the timer is unset). **Does not** change **`INV-WARBOW-149-REFRESH-ENDED`**. UI: [`TimeCurveProtocolWarbowRefreshSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveProtocolWarbowRefreshSection.tsx) on **`/timecurve/protocol`**. |

**Automated:** Forge **`test_refreshWarbowPodium_reverts_after_endSale`** · Vitest **`timeCurveWarbowSnapshotClaim.test.ts`** · **`cargo test`** (`integration_stage2` WarBow routes incl. **`/v1/timecurve/warbow/refresh-candidates`**).

**Docs / play:** [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md) · [§ #129 refresh](#warbow-podium-snapshot-drifts-gitlab-129).

<a id="gitlab-170-indexer-frontend-p3-polish"></a>

### GitLab #170 — Indexer + frontend P3 polish ([GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170))

**Intent:** Reduce hot-path Postgres work on **`GET /v1/timecurve/buys`**, make referrer leaderboard pages deterministic on ties, surface indexer load failures in the protocol WarBow refresh panel, and stop merging post-end WarBow “refresh” hints that the contract rejects anyway (#149).

| ID | Check |
|----|--------|
| **`INV-INDEXER-170-BUYS-TOTAL`** | **`GET /v1/timecurve/buys`** **`total`** uses **`COALESCE(MAX(buy_index), 0)`** — equivalent to **`COUNT(*)`** while each persisted **`Buy`** row keeps **`buy_index`** sequential **1..N** per **`TimeCurve`** emits (same envelope as [`fetch_last_buy_prediction_row`](../../indexer/src/api.rs)). |
| **`INV-INDEXER-170-REFERRAL-LB-TIE`** | **`GET /v1/referrals/referrer-leaderboard`** orders **`SUM(referrer_amount) DESC NULLS LAST, referrer ASC`** — stable **`LIMIT`/`OFFSET`** when totals tie. **`rank`** in JSON remains **page ordinal** (**`offset + row_index + 1`**), not dense competitive placement when multiple referrers share the same Σ amount. |
| **`INV-INDEXER-170-WARBOW-REFRESH-POSTEND`** | **`GET /v1/timecurve/warbow/refresh-candidates`** skips head WarBow podium hint prepend when **`chain_timer.sale_ended`**; includes **`sale_ended`** in the body (**[`INV-INDEXER-160-WARBOW-REFRESH-CANDIDATES`](#gitlab-149-warbow-arena-indexer-hardening)**). |
| **`INV-FRONTEND-170-WARBOW-IDX-ERR`** | **`TimeCurveProtocolWarbowRefreshSection`** **`loadFromIndexer`** wraps pagination / checksum in **`try`/`catch`** — **`friendlyRevertFromUnknown`** on unexpected failures; clears candidates / extras (**[`TimeCurveProtocolWarbowRefreshSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveProtocolWarbowRefreshSection.tsx)**). |

**Automated:** **`cargo test`** (`integration_stage2` asserts **`sale_ended`** on **`refresh-candidates`** smoke).

**Docs / play:** [`skills/README.md`](../../skills/README.md) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

---

## Business logic (what the code is supposed to enforce)

| Area | Intent (short) | Product / onchain spec |
|------|----------------|-------------------------|
| **TimeCurve** | Sale lifecycle: **exponential CHARM band** (0.99–10 CHARM × envelope), **linear per-CHARM price** (`ICharmPrice`), timer extension with cap, fees to router, sale end, CHARM-weighted redemption, prize podiums. **Redemption monotonicity (no referral):** [primitives — CL8Y value of DOUB per CHARM](../product/primitives.md#timecurve-redemption-cl8y-density-no-referral). **Gates (issue #55):** `buyFeeRoutingEnabled` — sale `buy` → `FeeRouter` **and** WarBow CL8Y paths (`warbowSteal`, `warbowRevenge`, `warbowActivateGuard`); `charmRedemptionEnabled` (`redeemCharms`); `reservePodiumPayoutsEnabled` — required for **`distributePrizes`** on **both** zero and non-zero `PodiumPool` balance ([GitLab #133](#timecurve-empty-podium-pool-settlement-gitlab-133): zero balance emits **`PrizesSettledEmptyPodiumPool`** and latches **`prizesDistributed`**) — [operations: final signoff](../operations/final-signoff-and-value-movement.md). | [product/primitives.md](../product/primitives.md), [TimeCurve.sol](../../contracts/src/TimeCurve.sol), [LinearCharmPrice.sol](../../contracts/src/pricing/LinearCharmPrice.sol) |
| **Rabbit Treasury (Burrow)** | Deposits → **redeemable** backing + DOUB mint; `receiveFee` → burn + **protocol-owned** backing (no DOUB mint); withdraw from redeemable only (pro-rata, health efficiency, fees → protocol); epoch repricing via **total** backing + BurrowMath; canonical Burrow* events. | [product/rabbit-treasury.md](../product/rabbit-treasury.md), [RabbitTreasury.sol](../../contracts/src/RabbitTreasury.sol) |
| **Fee routing** | TimeCurve pulls sale asset from buyer, forwards to `FeeRouter`; splits per bps to sinks; weights sum to 10_000; remainder to last sink. **`FeeRouter.initialize`** rejects **`admin == address(0)`** before sink validation ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)). **`distributeFees`** only for **`GOVERNOR_ROLE`**-allowlisted tokens; stray assets use **`rescueERC20`** ([§ #122](../testing/invariants-and-business-logic.md#feerouter-distributable-token-and-rescue-gitlab-122)). | [onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md), [FeeRouter.sol](../../contracts/src/FeeRouter.sol) |
| **DOUB presale vesting** | Immutable `EnumerableSet` of beneficiaries + allocations; constructor enforces `sum(amounts) == requiredTotal`; **30%** vested at `vestingStart`, **70%** linear over `vestingDuration`; `startVesting` once when `token.balanceOf(this) >= totalAllocated`. **`claims` gate (issue #55):** `claim()` requires `claimsEnabled` via `setClaimsEnabled` (`onlyOwner`) — [operations: final signoff](../operations/final-signoff-and-value-movement.md). **Owner rescue ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)):** `rescueERC20` moves **only** vesting-token balance above `totalAllocated − Σ claimedOf` (per-beneficiary claims unchanged) or **full** non-vesting ERC20 dust; emits **`RescueERC20`** (`INV-INDEXER-112`). | [DoubPresaleVesting.sol](../../contracts/src/vesting/DoubPresaleVesting.sol), [PARAMETERS.md](../../contracts/PARAMETERS.md) |
| **NFT** | Series supply cap, authorized mint, traits onchain. Constructor rejects **`admin == address(0)`** before role grants ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)). **`DEFAULT_ADMIN_ROLE`** may **`setBaseURI`** — offchain `tokenURI` JSON root is mutable (**[#125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125)**). | [LeprechaunNFT.sol](../../contracts/src/LeprechaunNFT.sol), [schemas/README.md](../schemas/README.md), [product — metadata trust](../product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json) |
| **Indexer** | Decode canonical logs, **exhaustively cover emitted events** stored in Postgres for history / future UI ([§ #112](#indexer-emitted-event-coverage-gitlab-112); [scoped issue discussion](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112)); idempotent persist; chain pointer + reorg rollback of **all** `idx_*` tables ([GitLab #139](#indexer-residual-router-rescue-gitlab-139) — **`PodiumResidualRecipientSet`**, **`TimeCurveBuyRouter` `EthRescued`/`Erc20Rescued`**). **Per-block durability:** event rows + `indexed_blocks` + `chain_pointer` for one height commit together ([§ #140](#indexer-transactional-block-ingestion-gitlab-140)). **Single-event test/tool persists:** explicit autocommit wrapper ([§ #148](#post-138-hygiene-naming-gitlab-148)). **`TimeCurveBuyRouter`** `BuyViaKumbaya` + `TimeCurve` `Buy` correlation for multi-asset entry metadata ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). **Deploy-time AccessControl admin** ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)): a zero-admin initializer **reverts** and emits **no** protocol logs the indexer could store (**`INV-INDEXER-120-DEPLOY`**). | [`REORG_STRATEGY.md`](../../indexer/REORG_STRATEGY.md), [`ingestion.rs`](../../indexer/src/ingestion.rs), [`persist.rs`](../../indexer/src/persist.rs), [`reorg.rs`](../../indexer/src/reorg.rs), [design — emitted logs](../indexer/design.md), [integrations/kumbaya.md](../integrations/kumbaya.md), [indexer README — #120](../../indexer/README.md#accesscontrol-zero-admin-gitlab-120) |
| **Frontend** | Env-driven chain, addresses, indexer URL normalization for read paths. **[GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120) derived layer:** no runtime probe that **`DEFAULT_ADMIN_ROLE`** landed on a non-zero admin (**`INV-FRONTEND-120-DEPLOY`** — deployment + env discipline). | [frontend/.env.example](../../frontend/.env.example), [frontend/src/lib/addresses.ts](../../frontend/src/lib/addresses.ts), [wallet-connection — #120](../frontend/wallet-connection.md#accesscontrol-zero-admin-deployment-gitlab-120) |
| **Frontend — indexer offline / backoff (#96)** | When `VITE_INDEXER_URL` is set, shared **`reportIndexerFetchAttempt`**: offline after **3** debounced failure seconds; **`IndexerStatusBar`** **Indexer offline · retrying**; pollers back off **30s → 60s → 120s**; Simple **Recent buys** empty copy distinguishes unreachable indexer vs zero rows. **`getJson`** / **`fetchTimecurveChainTimer`** **`await res.json()`** so HTTP **200** with non-JSON bodies surface as **`null`** (not escaped rejections) and feed the same failure streak ([issue #111](https://gitlab.com/PlasticDigits/yieldomega/-/issues/111)). | [timecurve-views — issue #96](../frontend/timecurve-views.md#indexer-offline-ux-issue-96), [invariants — #96](#indexer-offline-ux-and-backoff-gitlab-96), [`indexerApi.ts`](../../frontend/src/lib/indexerApi.ts), [`indexerConnectivity.ts`](../../frontend/src/lib/indexerConnectivity.ts) |
| **Frontend — wallet modal (SafePal / WalletConnect)** | With **`VITE_WALLETCONNECT_PROJECT_ID`**, RainbowKit lists **SafePal** (`safepalWallet`) plus default popular wallets; **EIP-6963** multi-injected discovery enabled. Without project id (non–E2E mock), **injected-only** (no WC QR). SafePal extension uses injected connector; mobile uses WC + SafePal deep link per RainbowKit. | [wallet-connection.md](../frontend/wallet-connection.md) ([issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58)), [`wagmi-config.ts`](../../frontend/src/wagmi-config.ts) |
| **Frontend — keyboard focus visible (WCAG 2.4.7, #97)** | **`a` / `button` / form controls / `[role="button"]` / `summary` / focusable `[tabindex]`** use **`:focus-visible`** outline via **`--yo-focus-ring`**; the same selectors are repeated under **`[data-rk]`** so RainbowKit’s scoped **`outline: none`** reset (`.iekbcc5`) does not suppress keyboard focus indicators in connect / account UI. Mouse activation does not show the ring (`:focus-visible` only). | [timecurve-views — #97](../frontend/timecurve-views.md#keyboard-focus-visible-issue-97), [design — a11y](../frontend/design.md#accessibility-and-ux), [wallet-connection.md](../frontend/wallet-connection.md), [§ #97](#keyboard-focus-visible-wcag-247-gitlab-97), [`index.css`](../../frontend/src/index.css) ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)) |
| **Frontend — single-chain wagmi (#81)** | **`wagmi` `chains`** lists **only** [`configuredChain()`](../../frontend/src/lib/chain.ts) — **no** bundled **`mainnet` / `sepolia`**. Default env when unset: **`VITE_CHAIN_ID=31337`**, **`VITE_RPC_URL=http://127.0.0.1:8545`** (matches [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)). Prevents incidental requests to viem default RPCs (e.g. **`eth.merkle.io`**) during local QA. | [wallet-connection.md — chains](../frontend/wallet-connection.md), [§ Single-chain wagmi](#frontend-single-chain-wagmi-issue-81), [issue #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) |
| **Frontend — wallet chain gate for writes (#95)** | When a wallet session is connected and **`useChainId() !==`** [`configuredTargetChainId()`](../../frontend/src/lib/chain.ts) (**`VITE_CHAIN_ID`** + **`VITE_RPC_URL`** rules; default **31337** Anvil — [`.env.example`](../../frontend/.env.example)): **writes are blocked**: overlay on TimeCurve Simple buy panel, Arena buy hub + standings + WarBow surfaces, **`/referrals`** register panel, **`/vesting`** claim panel; **`ChainMismatchWriteBarrier`**, **`SwitchToTargetChainButton`** (EIP-3326 `wallet_switchEthereumChain` via wagmi **`switchChain`**); **`chainMismatchWriteMessage`** pre-flight on **`submitBuy` / `submitRedeem`**, Arena **`handleBuy` / `runVoid` / WarBow**, referral **`register`**, vesting **`claim`** so calldata cannot be built for the wrong RPC network. **`/kumbaya`**, **`/sir`**: outbound DEX navigational links only — [issue #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95). | [wallet-connection.md — wrong-chain writes](../frontend/wallet-connection.md#wrong-network-write-gating-issue-95), [timecurve-views.md — Wrong network write gate (#95)](../frontend/timecurve-views.md#wrong-network-write-gating-issue-95), § [Frontend wrong-chain writes](#frontend-wallet-chain-write-gating-issue-95), [manual QA (#95)](manual-qa-checklists.md#manual-qa-issue-95) |
| **Frontend — ERC-20 approval sizing (#143)** | In-app **`approve`** defaults to **exact** amounts for Kumbaya router legs (**`maxIn`**), **`ReferralRegistry`** burn (**`registrationBurnAmount`**), and **CL8Y → `TimeCurve`** (**per-tx gross**). Optional **unlimited** CL8Y → TimeCurve via **`Cl8yTimeCurveUnlimitedApprovalFieldset`** + disclosure (localStorage **`yieldomega.erc20.cl8yTimeCurveUnlimited.v1`**); mitigates blast radius vs audit **H-01** coupling ([GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)). | [wallet-connection §143](../frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143), [timecurve-views §143](../frontend/timecurve-views.md#erc20-approval-sizing-gitlab-143), § [INV-ERC20-APPROVAL-143](#frontend-erc20-approval-sizing-gitlab-143), [`cl8yTimeCurveApprovalPreference.ts`](../../frontend/src/lib/cl8yTimeCurveApprovalPreference.ts) |
| **Frontend — TimeCurve buy wallet session drift (#144)** | Multi-step **`submitBuy`** / Arena **`handleBuy`** (Kumbaya **`exactOutput`** + approvals + **`buy`**, or **[issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)** **`buyViaKumbaya`**) must not mix **two wallets** or **two chains** across awaits: **`captureWalletBuySession`** after submit-time sizing, then **`assertWalletBuySessionUnchanged`** after **each** async boundary (**[`INV-BUY-SESSION-144`](#timecurve-buy-wallet-session-drift-gitlab-144)**). User-visible abort: **`Wallet or network changed during purchase — please retry from the beginning.`** Complements [#95](#frontend-wallet-chain-write-gating-issue-95) (wrong chain **before** submit). | [`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts), [`walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts), [`useTimeCurveSaleSession.ts`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts), [`useTimeCurveArenaModel.tsx`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx), [`timeCurveKumbayaSingleTx.ts`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts), [wallet-connection § #144](../frontend/wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144), § [#144](#timecurve-buy-wallet-session-drift-gitlab-144), [manual QA (#144)](manual-qa-checklists.md#manual-qa-issue-144-wallet-session-drift-on-buy) |
| **Frontend — Referral registration wallet session drift (#155)** | **`ReferralRegisterSection`** **`registerCode`** flow spans **`readContract` allowance**, optional **CL8Y `approve`**, **`registerCode`**, and receipts — same drift class as [#144](#timecurve-buy-wallet-session-drift-gitlab-144). **`captureWalletBuySession`** immediately before the first async step; **`assertWalletBuySessionUnchanged`** after **each** **`await`**; **`setStoredMyReferralCodeForWallet`** uses the **latched** snapshot address only after the final guard (**[`INV-REFERRAL-SESSION-155`](#referral-registration-wallet-session-drift-gitlab-155)**). User-visible abort uses **`WALLET_BUY_SESSION_DRIFT_MESSAGE`** (same string as buys). Complements [#95](#frontend-wallet-chain-write-gating-issue-95). Audit: [`audits/audit_full_1777967937.md`](../../audits/audit_full_1777967937.md) **M-01**. | [`ReferralRegisterSection.tsx`](../../frontend/src/pages/referrals/ReferralRegisterSection.tsx), [`referralRegisterWalletSession.test.ts`](../../frontend/src/pages/referrals/referralRegisterWalletSession.test.ts), [`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts), [wallet-connection § #155](../frontend/wallet-connection.md#wallet-session-continuity-during-referral-register-gitlab-155), § [#155](#referral-registration-wallet-session-drift-gitlab-155), [manual QA (#155)](manual-qa-checklists.md#manual-qa-issue-155-referral-register-wallet-session-drift) |
| **Frontend — Album 1 BGM resume** | **localStorage** `yieldomega:audio:v1:playbackState`: stable **`trackId`**, index, **`positionSec`**, **`savedAt`**. **7-day** TTL clears offset only; **≥4s** throttle while playing; pause / skip / ended / tab-hide flush. **`AudioEngineProvider`** initial **`trackIndex`** matches hydrate so the dock title does not flash track 1. **Verification** lives under [manual QA (#71)](manual-qa-checklists.md#manual-qa-issue-71) — not **`skills/verify-yo-album-bgm-resume/`** ([issue #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)). | [§ Album 1 BGM + SFX + resume](#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68), [sound-effects §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68), [issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71) |
| **Kumbaya routing (TimeCurve entry)** | Optional **ETH** / **stable** spend: either v3 **`exactOutput`** then **`TimeCurve.buy`**, or when **`timeCurveBuyRouter` ≠ 0**, **`buyViaKumbaya`** (single-tx, [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) / [issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)) — shared path + slippage in [`timeCurveKumbayaSingleTx.ts`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts). **Fail closed** if `chainId` or router config is missing, or **env / onchain** buy-router mismatch; MegaETH defaults track [Kumbaya integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit). | [integrations/kumbaya.md](../integrations/kumbaya.md), [kumbayaRoutes.ts](../../frontend/src/lib/kumbayaRoutes.ts), [TimeCurveBuyRouter.sol](../../contracts/src/TimeCurveBuyRouter.sol) |
| **Indexer — `buyFor` + `BuyViaKumbaya` ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67))** | Canonical **`TimeCurve` `Buy`** rows always use the event’s **`buyer`** (participant). **`BuyViaKumbaya`** is ingested only when **`TimeCurveBuyRouter`** is listed in **`ADDRESS_REGISTRY`**; persisted in **`idx_timecurve_buy_router_kumbaya`** and **left-joined** into **`GET /v1/timecurve/buys`** as optional **`entry_pay_asset`** (`eth` \| `stable`) and **`router_attested_gross_cl8y`**, keyed by **`tx_hash` + buyer + charm_wad**. **`pay_kind`**: `0` = ETH/WETH path, `1` = deployment stable (USDM/USDm). | [indexer/tests/integration_stage2.rs](../../indexer/tests/integration_stage2.rs), [decoder round-trip](../../indexer/src/decoder.rs) |
| **Indexer — public HTTP `500` bodies ([GitLab #157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157))** | Unexpected **`sqlx`** failures on **`GET /v1/...`** must return a **stable** JSON **`error`** string (**no** raw table/constraint/SQL text); full detail is **`tracing::error!`** + trace layer only (**`INV-INDEXER-157`**). | [§ #157](#indexer-public-api-500-error-redaction-gitlab-157), [`api.rs`](../../indexer/src/api.rs), [indexer README — #157](../../indexer/README.md#public-http-api-error-bodies-gitlab-157) |
| **TimeCurve (frontend) — sale phase** | `derivePhase` uses **`ledgerSecIntForPhase`**: same preferred **“chain now”** as the **hero timer** (indexer `/v1/timecurve/chain-timer` + skew) when a snapshot exists; else **`latestBlock` / wall** fallback. Keeps **phase / Buy gating** aligned with the **deadline countdown** when wallet RPC lags; **onchain** `saleStart` / `deadline` / `ended` are still the authority for values. | [timecurve-views — Chain time and sale phase](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48) ([issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48)), [timeCurveSimplePhase.ts](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts) |
| **TimeCurve (frontend) — inclusive `deadline` second ([issue #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136))** | **`saleExpiredAwaitingEnd`** when **`ledgerSecInt > deadlineSec`** (strict past), not **`>=`**, mirroring **`TimeCurve.endSale`** (**`> deadline()`**) and onchain **`buy` / WarBow** (**`<= deadline()`** inclusive). | [timecurve-views — #136](../frontend/timecurve-views.md#inclusive-round-deadline-issue-136), [invariants §136](invariants-and-business-logic.md#timecurve-round-deadline-inclusive-warbow-gitlab-136), [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts) |
| **TimeCurve — pre-open hero countdown ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115))** <a id="timecurve-pre-open-hero-countdown-issue-115"></a> | When **`saleStartPending`**, hero digits on **Simple** and **Arena** use **`max(0, saleStart − floor(chainNow))`** with the same indexer-anchored clock as [**#48**](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48). **`chain-timer`** includes **`sale_start_sec`** (schema **≥ 1.11.0**, same `read_block_number` as **`deadline_sec`**); without it, use RPC **`saleStart()`** for the target timestamp. **Live** phases: **`deadline − chainNow`**. **`timerCapSec`** / extension preview use **live** deadline countdown only. **Copy:** **“TimeCurve Opens In”** on pre-start heroes. | [timecurve-views — #115](../frontend/timecurve-views.md#pre-open-countdown-unified-issue-115), [`timecurveHeroDisplaySecondsRemaining`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts), [`useTimecurveHeroTimer.ts`](../../frontend/src/pages/timecurve/useTimecurveHeroTimer.ts), [`chain_timer.rs`](../../indexer/src/chain_timer.rs), [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts) |
| **TimeCurve Arena — WarBow hero actions (issue #101)** | `PageHeroArcadeBanner` exposes **Steal / Guard / Revenge** directly in the hero through `WarbowHeroActions`. Suggested steal targets are discovery-only rows from `warbowLadderPodium()` and `/v1/timecurve/warbow/leaderboard`, deduped and filtered by the 2× BP rule when viewer BP is **positive**; selecting one feeds the existing `stealVictimInput`, so live `battlePoints` / `stealsReceivedOnDay` / `stealsCommittedByAttackerOnDay` reads and `describeStealPreflight` remain the eligibility gate. Guard/revenge CTAs share wrong-network and `buyFeeRoutingEnabled` barriers with the lower `WarbowSection`. **Revenge** lists **all** open **(victim, stealer)** windows from the indexer when configured ([GitLab #135](https://gitlab.com/PlasticDigits/yieldomega/-/issues/135), [§ #135](#warbow-per-stealer-revenge-windows-gitlab-135)). | [timecurve-views — Arena WarBow hero actions](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101), [`WarbowHeroActions.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.tsx), [`WarbowHeroActions.test.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.test.tsx), [participant play skill](../../skills/play-timecurve-warbow/SKILL.md) |
| **TimeCurve — WarBow ladder snapshot drift + **`distributePrizes`** latch (#129)** | **`refreshWarbowPodium(candidates)`** (**`!ended`** only — [GitLab #149](https://gitlab.com/PlasticDigits/yieldomega/-/issues/149); reverts **`TimeCurve: ended`** after **`endSale`**) re-applies live **`battlePoints`** heap updates and clears **`warbowPodiumFinalized`** while the sale is active. **`finalizeWarbowPodium(candidates)`** (`onlyOwner`, **ended**, **`!prizesDistributed`**) rebuilds the podium from **`bp > 0`** candidates and sets **`warbowPodiumFinalized`**. When **`reservePodiumPayoutsEnabled`** and **`acceptedAsset.balanceOf(podiumPool) > 0`**, **`distributePrizes`** requires **`warbowPodiumFinalized`** before paying (**zero** balance skips WarBow finalize — [GitLab #133](#timecurve-empty-podium-pool-settlement-gitlab-133)). **Arena** maps a **Claim your WarBow position (refresh snapshot)** CTA via [`timeCurveWarbowSnapshotClaim.ts`](../../frontend/src/lib/timeCurveWarbowSnapshotClaim.ts) (sale-active heuristic). **`/timecurve/protocol`** loads indexer-assisted candidate supersets for the same permissionless refresh ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160); **`INV-INDEXER-160-WARBOW-REFRESH-CANDIDATES`**). **Harness:** [`SimulateAnvilRichState.s.sol`](../../contracts/script/SimulateAnvilRichState.s.sol), [`verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh). | [§ #129](#warbow-podium-snapshot-drifts-gitlab-129), [§ #149](#gitlab-149-warbow-arena-indexer-hardening), [§ #133](#timecurve-empty-podium-pool-settlement-gitlab-133), [issue #129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129), [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md), [timecurve-views — #129](../frontend/timecurve-views.md#warbow-ladder-podium-snapshot-mismatch-issue-129) |
| **TimeCurve Simple — live reserve podiums (issue #113)** | `/timecurve` shows a compact read-only `PageSection` immediately above **Recent buys / Live ticker** with all four fixed v1 reserve categories from `TimeCurve.podium(category)`: Last Buy, WarBow, Defended Streak, Time Booster. The frontend uses `PODIUM_CONTRACT_CATEGORY_INDEX` for contract category mapping, shared ranking/address chrome, and viewer highlighting; `Buy` logs refetch immediately and a light RPC interval catches WarBow-only moves. The indexer is not authoritative for winners. | [timecurve-views — Simple live podiums](../frontend/timecurve-views.md), [`TimeCurveSimplePodiumSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.tsx), [`TimeCurveSimplePodiumSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.test.tsx), [`timecurve.spec.ts`](../../frontend/e2e/timecurve.spec.ts), [manual QA](manual-qa-checklists.md#manual-qa-issue-113), [play skill](../../skills/play-timecurve-doubloon/SKILL.md) |
| **TimeCurve Arena — sniper-shark cutout (issue #80)** | One animated `sniper-shark-peek-scope.png` decoration appears only on the Arena **Buy CHARM** panel, where timing / WarBow pressure matches the "hunter" metaphor. It replaces an existing buy-panel mascot slot instead of adding global chrome; `CutoutDecoration` keeps it decorative (`alt=""`, `aria-hidden`) and `prefers-reduced-motion` suppresses the animation. | [timecurve-views — Arena sniper-shark cutout](../frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80), [art README](../../frontend/public/art/README.md), [manual QA checklist](manual-qa-checklists.md#manual-qa-issue-80) |
| **Anvil E2E (Playwright) — pay mode + workers ([issue #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))** | **TimeCurve Simple** and **Arena** choose pay asset with **toggle buttons** (`aria-label` “Show price in …”), not legacy **radio** inputs. Stable hooks: **`data-testid="timecurve-simple-paywith-cl8y"`** / **`eth`** / **`usdm`**. E2E must not depend on removed **`input[name="timecurve-pay-with"]`**. With **`ANVIL_E2E=1`**, `frontend/playwright.config.ts` sets **`workers: 1`** and **`fullyParallel: false`**: one Anvil + one default mock account → **no cross-file parallel wallet txs** (nonce / sale / referral races). Unrelated: default CI **`npm run test:e2e`** (no Anvil) may use **5** workers. | [e2e-anvil.md](e2e-anvil.md), [`anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts), [`playwright.config.ts`](../../frontend/playwright.config.ts), [§ Anvil E2E Playwright](#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87) |
| **Dev stack** | Same wiring as [DeployDev.s.sol](../../contracts/script/DeployDev.s.sol): epoch open + sale start; deposit + buy with correct ERC20 approvals. | [DevStackIntegration.t.sol](../../contracts/test/DevStackIntegration.t.sol) |
| **Forge dev scripts — chain allowlist ([GitLab #141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141))** | **`DeployDev`**, **`DeployKumbayaAnvilFixtures`**, **`AnvilSameBlockDrill`**, **`SimulateAnvilRichState*`** revert at `run()` unless **`block.chainid ∈ {31337,6342,6343}`** (**Anvil** + MegaETH **testnet** IDs from [`contracts/README.md`](../../contracts/README.md); **6342** retained for legacy envs). **Not** MegaETH **mainnet (4326)** — avoids broadcasting mocks and dev operator flags to production via a mistaken RPC URL. Shared guard: [`DevOnlyChainGuard.sol`](../../contracts/script/DevOnlyChainGuard.sol). | [§ `INV-DEVSCRIPT-141`](#forge-dev-scripts-chain-allowlist-gitlab-141), [foundry-and-megaeth.md § dev scripts](../contracts/foundry-and-megaeth.md#dev-only-forge-script-entrypoints-chain-allowlist-gitlab-141) |
| **DeployDev broadcast JSON (UUPS proxies)** | In `run-latest.json`, Foundry labels the **implementation** deployment as `contractName` `TimeCurve` / `RabbitTreasury` (and similar for other UUPS cores). The **canonical onchain address** is the **`ERC1967Proxy`** whose constructor `arguments[0]` matches that implementation. Calling or funding the **implementation** address reads **uninitialized** storage → misleading reads, **Solidity panic 0x12** on some paths, or empty/decode failures ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). **`currentCharmBoundsWad`** no longer **panics** when `initialMinBuy == 0`; it returns the **base CHARM envelope** **`(0.99e18, 10e18)`** ([issue #73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73)) — **buys and authoritative bounds still require the proxy**. Use console/registry extraction (`start-local-anvil-stack.sh`), `scripts/lib/broadcast_proxy_addresses.sh`, or `anvil_rich_state.sh` defaults — **not** a naive `jq 'select(.contractName=="TimeCurve")'` on the implementation row. | [`scripts/lib/broadcast_proxy_addresses.sh`](../../scripts/lib/broadcast_proxy_addresses.sh), [`anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh), [anvil-rich-state.md](anvil-rich-state.md); `test_currentCharmBoundsWad_zero_initialMinBuy_returns_base_envelope` |
| **MegaEVM bytecode vs local Anvil (issue #72)** | **MegaETH / MegaEVM** targets **large** maxima for deployed runtime (**524,288 bytes** = 512 KiB) and initcode (**548,864 bytes** = 536 KiB), per [MegaETH contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits). **Ethereum** and a **default** `anvil` (EIP-170 **0x6000** / ~24 KiB) differ from that; **our** [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) (and E2E / bot Anvil launchers) use **`--code-size-limit 524288`** (decimal; **0x80000** is invalid for this Foundry flag) so local **node** deploys match **512 KiB**, not 24 KiB. **`forge script`** applies the same EIP-170 limit during **pre-broadcast simulation**, so repo shell also passes **`--code-size-limit 524288`** on `forge script` (e.g. [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh), stack script, rich-state). A failure on a **raw** `anvil` or **`forge script` without the flag** is **not** automatically a MegaETH mainnet blocker. **Nested calls:** MegaEVM uses **98/100** gas forwarding (stricter than L1’s **63/64**); see [Gas forwarding](https://docs.megaeth.com/spec/megaevm/gas-forwarding.md). Verify sizes with `forge build --sizes` from `contracts/`. | [foundry-and-megaeth — MegaEVM bytecode limits](../contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas), [research/megaeth.md](../research/megaeth.md) |
| **Local stack bot swarm (tooling)** | [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) may spawn the Python bot swarm when `START_BOT_SWARM=1`. That path must be able to **`import web3`** (same deps as [`timecurve-bot`](../../bots/timecurve/README.md)). This is **QA tooling**, not onchain authority. On **PEP 668** hosts, a bare `pip install` without a venv can fail silently until swarm start; the script preflights and the README documents venv + `--user --break-system-packages` fallback ([issue #50](https://gitlab.com/PlasticDigits/yieldomega/-/issues/50)). **`SKIP_ANVIL_RICH_STATE=1` + default `buyCooldownSec`** used to **freeze `block.timestamp`** under pure automine while every wallet slept ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)): the stack now starts Anvil with **`--block-time`** when it launches the node for the swarm and documents **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** / **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** for dense buys. **Referral buys ([issue #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94)):** swarm registers a shared code from HD index **27** (unless `YIELDOMEGA_SWARM_REFERRALS=0`) and sets **`YIELDOMEGA_REFERRAL_CODE`** for worker `buy` paths — [`swarm_runner.py`](../../bots/timecurve/src/timecurve_bot/swarm_runner.py). **Standalone swarm + opt-out discoverability ([issue #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102)):** repo-checked checklist for **`run_swarm()`** without the full stack ([`bots/timecurve/README.md`](../../bots/timecurve/README.md), [`e2e-anvil.md`](e2e-anvil.md#standalone-bot-swarm-run_swarm-without-the-full-stack-gitlab-102)); stack banner prints referral bootstrap on/off; **`run_swarm()`** appends a **`sync-bot-env-from-frontend.sh` / repo-root `cwd`** hint on **`load_config` `ValueError`**. | Manual: README install + stack script; [§ Bot swarm + Anvil timing — #99](#bot-swarm-anvil-interval-mining-issue-99); [`manual-qa-checklists.md#manual-qa-issue-99`](manual-qa-checklists.md#manual-qa-issue-99); [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) |
| **Local QA full stack orchestrator ([GitLab #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104); **`--help` hygiene [GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)**; **Vite cleanup [GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)**)** | [`start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) delegates **only** to [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) (Postgres, Anvil, deploy, registry, indexer DB reset, indexer, `frontend/.env.local`), then optionally backgrounds **`npm run dev`** with log **`/tmp/yieldomega_frontend_qa.log`** and PID **`/tmp/yieldomega_frontend_qa.pid`**. **Invariant:** the orchestrator must **not** duplicate deploy, indexer, or registry logic. **`INV-QA-FULLSTACK-HELP-105`:** **`--help`** emits **leading `#` banner lines only**, not shell directives (`set -euo pipefail`, …). **`INV-QA-FULLSTACK-153`:** while Vite readiness runs, **INT/TERM** + **`EXIT`** traps in [`scripts/lib/qa_local_full_stack_frontend.sh`](../../scripts/lib/qa_local_full_stack_frontend.sh) tear down the recorded dev PID; readiness **`curl`** uses **`--connect-timeout` / `--max-time`**; subshell uses **`exec npm`** so **`$!`** tracks Node/Vite. Hermetic check: [`verify-qa-orchestrator-frontend-trap.sh`](../../scripts/verify-qa-orchestrator-frontend-trap.sh). Full procedural runbook: [`qa-local-full-stack.md`](qa-local-full-stack.md). Playwright stays in [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh). | [§ QA local full stack](#qa-local-full-stack-orchestrator-gitlab-104), [§ #153](#qa-orchestrator-vite-cleanup-gitlab-153), [`manual-qa-checklists.md#manual-qa-issue-104`](manual-qa-checklists.md#manual-qa-issue-104), [`skills/README.md`](../../skills/README.md) |

### Wallet connect UX (issue #58)

Same intent as the **Frontend — wallet modal** table row: production hosts should set **`VITE_WALLETCONNECT_PROJECT_ID`** so WalletConnect (and SafePal mobile via RainbowKit’s connector) work. Details: [wallet-connection.md](../frontend/wallet-connection.md).

<a id="keyboard-focus-visible-wcag-247-gitlab-97"></a>

### Keyboard focus visible — WCAG 2.4.7 (GitLab #97)

**Intent:** [GitLab #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97) — keyboard users must see **where focus is** when tabbing (WCAG 2.4.7 Focus Visible, Level AA). Focus moves correctly but was **invisible** when RainbowKit’s **`[data-rk] .iekbcc5 { outline: none }`** (specificity **0,2,0**) overrode unscoped **`button:focus-visible`** (**0,1,1**).

**Invariant:** Global **`index.css`** defines matching **`:focus-visible`** outlines using **`var(--yo-focus-ring)`**, and duplicates the same selector list under **`[data-rk]`** so wallet modal / account chrome shows the same ring as the rest of the app. **`[tabindex]:not([tabindex="-1"])`** covers custom focusable widgets; **`tabindex="-1"`** stays programmatic-only without a misleading ring policy. Prefer **`:focus-visible`** over **`:focus`** so pointer clicks do not flash an outline.

**Docs:** [design.md — Accessibility and UX](../frontend/design.md#accessibility-and-ux), [wallet-connection.md — configuration invariants](../frontend/wallet-connection.md#configuration-invariants). **Manual QA checklist:** [`manual-qa-checklists.md#manual-qa-issue-97`](manual-qa-checklists.md#manual-qa-issue-97).

<a id="anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87"></a>

### Anvil E2E Playwright — concurrency and pay-mode selectors (issue #87)

**Intent:** [GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87) — `bash scripts/e2e-anvil.sh` runs **one** Anvil, **one** preview server, and **`e2e/anvil-*.spec.ts`** with **`ANVIL_E2E=1`**. `test.describe.configure({ mode: "serial" })` inside a file does **not** prevent **other** spec files from running in parallel, so a multi-worker run can interleave **writes** to the same chain and account. **Invariant:** when **`ANVIL_E2E=1`**, use **`workers: 1`** and disable **`fullyParallel`** for Playwright. **Pay mode:** E2E selects ETH (or other assets) via **`getByTestId("timecurve-simple-paywith-eth")`** (and siblings **`…-cl8y`**, **`…-usdm`**) on the buy panel, matching Simple + Arena **toggle** UI. **Do not** reintroduce `input[name="timecurve-pay-with"]` without restoring that markup. **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-87`](manual-qa-checklists.md#manual-qa-issue-87).

<a id="qa-local-full-stack-orchestrator-gitlab-104"></a>

### QA local full stack orchestrator (GitLab #104)

**Intent:** Operators need **one** procedural entrypoint for **Postgres + Anvil + indexer + `frontend/.env.local` + optional Vite**, without re-scattering env across shells.

**Invariants:**

1. [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) calls [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) only — **no** second copy of deploy or indexer startup.
2. **`frontend/.env.local`** remains the stack-authored source of **`VITE_*`**; restart Vite after changes (or start Vite after the stack).
3. **Playwright E2E** remains [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) — not invoked by this orchestrator.
4. **`INV-QA-FULLSTACK-HELP-105`** — **`--help`** on the orchestrator lists **leading `#` banner lines only**, stopping before the first non-comment line ([GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)). Operators must not see stray shell directives (**`set -euo pipefail`**) after usage text.
5. **`INV-QA-FULLSTACK-153`** — While **`start_frontend_dev`** is waiting for HTTP readiness, **INT/TERM** handlers kill the PID in **`/tmp/yieldomega_frontend_qa.pid`** (override: **`QA_FRONTEND_PID_FILE`**) and **`exit 130`**; **`EXIT`** covers **errexit** without stealing the script’s exit code; **`trap - EXIT`** runs before that **`exit`** so **`EXIT`** cleanup is not double-run. After readiness succeeds, traps are cleared so a normal orchestrator exit leaves Vite running. **`curl`** uses **`--connect-timeout 1 --max-time 3`**. The dev command uses **`exec npm`** inside the subshell so **`$!`** is the server process ([GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)).

**Docs:** [`qa-local-full-stack.md`](qa-local-full-stack.md) · **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-104`](manual-qa-checklists.md#manual-qa-issue-104) · **#105** help hygiene: [`qa-local-full-stack.md#invariants-do-not-regress`](qa-local-full-stack.md#invariants-do-not-regress) · **#153:** [§153](#qa-orchestrator-vite-cleanup-gitlab-153).

<a id="qa-orchestrator-vite-cleanup-gitlab-153"></a>

### QA orchestrator — Vite interrupt cleanup (GitLab #153)

**Intent:** Avoid orphaned **`npm run dev`** / Vite on **`FRONTEND_DEV_PORT`** when the orchestrator is interrupted or errors **before** readiness completes (same class of stale-listener risk as [GitLab #151](https://gitlab.com/PlasticDigits/yieldomega/-/issues/151) for Anvil).

**Implementation:** [`scripts/lib/qa_local_full_stack_frontend.sh`](../../scripts/lib/qa_local_full_stack_frontend.sh) (sourced from [`start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh)). **Automated smoke:** [`scripts/verify-qa-orchestrator-frontend-trap.sh`](../../scripts/verify-qa-orchestrator-frontend-trap.sh).

<a id="frontend-single-chain-wagmi-issue-81"></a>

### Frontend single-chain wagmi (issue #81)

**Intent:** [GitLab #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) — browsing with the wallet on **local Anvil** must not trigger background JSON-RPC to **Ethereum mainnet** defaults (e.g. **`https://eth.merkle.io`** via viem transports). **Invariant:** declare **one** wagmi chain — the env-driven [`configuredChain()`](../../frontend/src/lib/chain.ts). **Default** when `VITE_CHAIN_ID` / `VITE_RPC_URL` are unset: **31337** + **`http://127.0.0.1:8545`**. **Manual verification:** DevTools **Network** filter `merkle` → **0** requests after load on `http://127.0.0.1:5173/timecurve/arena` with stack + wallet on 31337. **Automated:** [`frontend/src/lib/chain.test.ts`](../../frontend/src/lib/chain.test.ts) (`resolveChainRpcConfig` defaults). **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-81`](manual-qa-checklists.md#manual-qa-issue-81).

<a id="frontend-wallet-chain-write-gating-issue-95"></a>

### Frontend wallet chain write gate (issue #95)

**Intent:** [GitLab #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) — a connected wallet can still be left on **another** EVM chain while the header shows **Wrong Network**. The app must **not** open wallet submits with calldata built from this build’s deployment addresses unless **`useChainId()`** matches [`configuredTargetChainId()`](../../frontend/src/lib/chain.ts) (**`VITE_CHAIN_ID`** rules; default **Anvil 31337**). **Invariant:** `chainMismatchWriteMessage(useChainId())` **aborts** before **`writeContract` / approvals** in **`useTimeCurveSaleSession`** and **`useTimeCurveArenaModel`** (buy, WarBow, post-end **`runVoid`**); overlays + **`wallet_switchEthereumChain`** CTA (**`SwitchToTargetChainButton`**) gate Simple buy, Arena buy hub + standings + WarBow, **`/referrals`** register panel, **`/vesting`** claim. **`/vesting`** **`claim`** also **surfaces** that message in-panel when the handler runs while mismatched (race after enabling the button — [GitLab #106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106)). **Automated:** [`frontend/src/lib/chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts). **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-95`](manual-qa-checklists.md#manual-qa-issue-95), [`manual-qa-checklists.md#manual-qa-issue-106`](manual-qa-checklists.md#manual-qa-issue-106). **`/kumbaya`** / **`/sir`** outbound venue links remain **outside** this gate (#95 scoped to in-app ABI writes).

<a id="frontend-erc20-approval-sizing-gitlab-143"></a>

### Frontend ERC-20 approval sizing (GitLab #143)

**Intent:** [GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143) — default **`approve(spender, exactNeed)`** on swap / referral / CL8Y→TimeCurve paths instead of silent **`type(uint256).max`**, reducing allowance blast radius if a **malicious proxy upgrade** ever reused an existing grant (audit **H-01** in `audits/audit_smartcontract_1777813071.md`). **Invariant (`INV-ERC20-APPROVAL-143`):** Kumbaya **WETH / USDM → `swapRouter`** and **USDM → `TimeCurveBuyRouter`** use slippage-bounded **`maxIn`**. **`ReferralRegistry.registerCode`** approves **`registrationBurnAmount`** exactly. **CL8Y → `TimeCurve`** uses the **pending tx** gross unless the user opts in via **`Cl8yTimeCurveUnlimitedApprovalFieldset`** (**`yieldomega.erc20.cl8yTimeCurveUnlimited.v1`**). WarBow steal / guard / revenge share the same CL8Y→TimeCurve sizing read. **Automated:** [`cl8yTimeCurveApprovalPreference.test.ts`](../../frontend/src/lib/cl8yTimeCurveApprovalPreference.test.ts). **Docs:** [`wallet-connection.md` §143](../frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143), [`timecurve-views` §143](../frontend/timecurve-views.md#erc20-approval-sizing-gitlab-143).

<a id="timecurve-buy-wallet-session-drift-gitlab-144"></a>

### TimeCurve buy wallet session drift mid-flow (GitLab #144)

**Intent:** [GitLab #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144) — **`submitBuy`** / Arena **`handleBuy`** span **many** awaits (quotes, **`waitForTransactionReceipt`**, approvals, swap, **`buy`**). Capturing **`address` once** from the React closure risks **silent cross-wallet routing** when the user switches accounts mid-flow.

**Invariant (`INV-BUY-SESSION-144`):** Immediately after **`readFreshTimeCurveBuySizing`** succeeds, **`captureWalletBuySession(wagmi)`** must match the hook’s **`address` + `chainId`** (otherwise abort). Then **`assertWalletBuySessionUnchanged`** runs after **every** subsequent **`await`** until the purchase completes or fails. **`submitKumbayaSingleTxBuy`** receives **`sessionSnapshot`** and applies the same checks internally.

**Automated:** [`frontend/src/lib/walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts). **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-144-wallet-session-drift-on-buy`](manual-qa-checklists.md#manual-qa-issue-144-wallet-session-drift-on-buy). **Docs:** [`wallet-connection.md` § #144](../frontend/wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144).

<a id="referral-registration-wallet-session-drift-gitlab-155"></a>

### Referral registration wallet session drift mid-flow (GitLab #155)

**Intent:** [GitLab #155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155) — internal audit **M-01** (`audits/audit_full_1777967937.md`): **`ReferralRegisterSection.onRegister`** previously captured **`address`** only from the React closure across **`allowance` → optional `approve` → `registerCode`** awaits. Switching accounts or chains mid-flow could misalign **approvals**, **onchain `msg.sender`**, and **`yieldomega.myrefcode.v1.<wallet>`** local storage.

**Invariant (`INV-REFERRAL-SESSION-155`):** After synchronous validation (wrong-chain preflight via **`chainMismatchWriteMessage`**, registry reads, normalized code), **`captureWalletBuySession(wagmi)`** must match the UI session’s **`address` + `chainId`** (otherwise abort with **`WALLET_BUY_SESSION_DRIFT_MESSAGE`**). Then **`assertWalletBuySessionUnchanged`** runs after **every** subsequent **`await`** through the optional approve path and both receipts. **`setStoredMyReferralCodeForWallet`** runs **only** after the final guard and keys storage with the **snapshot** address (the wallet that latched the flow).

**Automated:** [`frontend/src/pages/referrals/referralRegisterWalletSession.test.ts`](../../frontend/src/pages/referrals/referralRegisterWalletSession.test.ts) (guard wiring; drift detection shares [`walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts)). **Manual QA:** [`manual-qa-checklists.md#manual-qa-issue-155-referral-register-wallet-session-drift`](manual-qa-checklists.md#manual-qa-issue-155-referral-register-wallet-session-drift). **Docs:** [`wallet-connection.md` § #155](../frontend/wallet-connection.md#wallet-session-continuity-during-referral-register-gitlab-155).

<a id="erc20-balance-delta-ingress-gitlab-123"></a>

### ERC20 balance-delta ingress (GitLab #123)

**Intent:** [GitLab #123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123) — **fee-on-transfer** and similar non‑canonical ERC20s must not leave **`totalRaised`**, **`FeeRouter`** pushes, Burrow **`deposit` / `receiveFee`**, referral registration burns, or **`buyViaKumbaya`** stable pulls using **nominal** transfer amounts when the contract **credited** less. **Invariant (`INV-ERC20-123`):** ingress paths **snapshot `balanceOf`**, perform **`transferFrom`**, require **`received == declared`**, and route **`received`** through accounting (`TimeCurve: ERC20 parity`, `RT: ERC20 parity`, `ReferralRegistry: ERC20 parity`, **`TimeCurveBuyRouter__StableIngressParity`**). **`FeeRouter.distributeFees`** — callers must pass an **`amount`** equal to the measured segment ([NatSpec](../../contracts/src/FeeRouter.sol)). **WarBow CL8Y burns ([`INV-WARBOW-123-BURN-CALLER`](#inv-warbow-123-burn-caller)):** **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** forbid **`msg.sender == BURN_SINK`** so balance-delta **`_pullAcceptedExact`** cannot round-trip with **net zero** ingress to the sink while BP state mutates. **Automated:** [`NonStandardERC20.t.sol`](../../contracts/test/NonStandardERC20.t.sol), [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) (`TimeCurveBuyRouterStableIngress123Test`), [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) (burn-sink caller revert + fuzz assumes).

<a id="inv-warbow-123-burn-caller"></a>

| **INV-WARBOW-123-BURN-CALLER** | **`msg.sender != 0x…dEaD`** on **`warbowSteal`**, **`warbowRevenge`**, **`warbowActivateGuard`** — revert **`TimeCurve: burn sink caller`**. Complements **`INV-ERC20-123`** on the WarBow relay: the burn sink is not a valid transaction `msg.sender` ([issue #123 discussion](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)). |

### Business rules (narrative, for reviewers)

- **TimeCurve + TimeMath + `ICharmPrice`:** **CHARM quantity** per buy is bounded by an **exponential daily envelope** (same `TimeMath.currentMinBuy` factor on a reference WAD): onchain **min CHARM** = `0.99e18 × scale` and **max CHARM** = `10e18 × scale` (ratio **10 / 0.99** always). **Per-CHARM price** in the accepted asset is **decoupled** and comes from **`ICharmPrice`** (default **`LinearCharmPrice`**: `base + dailyIncrement × elapsed / 1 day`). **Gross spend** = `charmWad × priceWad / 1e18`. Buys extend the deadline (or apply the **under-13m → 15m remaining** hard reset) up to **`timerCapSec`**. When the sale ends, participants **`redeemCharms`** once for a pro-rata share of launched tokens using **`totalCharmWeight`** in the denominator; **reserve** podium slots (**last buy, time booster, defended streak**) and **WarBow Battle Points** (separate PvP layer) update per [`docs/product/primitives.md`](../product/primitives.md). Each buy routes the **credited** gross accepted asset ( **`balanceOf` delta** equals computed spend on canonical ERC20 — [§ #123](#erc20-balance-delta-ingress-gitlab-123)) through **`FeeRouter`** (five sinks — see fee doc). Referral incentives add **CHARM weight** (as a fraction of **`charmWad`**) without reserve rebates. **Rebasing** reserve assets remain **unsupported** for separate accounting reasons; **`acceptedAsset`** should be the canonical non‑rebasing CL8Y rail. when **`doubPresaleVesting`** is set, each buy credits **`DoubPresaleVesting.isBeneficiary(buyer)`** wallets with **`charmWad + charmWad × 1500 / 10000`** toward **`charmWeight`** / **`totalCharmWeight`** ([`INV-TC-PRESALE-CHARM-BOOST`](../testing/invariants-and-business-logic.md#timecurve-presale-charm-weight-boost)). **Issue #55:** `redeemCharms` / paying non-zero `distributePrizes` (CL8Y reserve to winners) and sale-time **`buyFeeRoutingEnabled`** (`buy` + WarBow **CL8Y** steal/revenge/guard) are **gated by `onlyOwner` flags** until operators enable them ([final signoff runbook](../operations/final-signoff-and-value-movement.md)). **`distributePrizes`** remains **permissionless** but reverts if the owner has not enabled reserve podium payouts and the pool balance is non-zero; empty-pool no-op behavior is unchanged. **Redemption intent:** **DOUB per CHARM** falls as the sale progresses (fixed sale pool, growing `totalCharmWeight`); **implied CL8Y per DOUB** from **`totalRaised / totalTokensForSale`** rises with each buy; **excluding referral**, the **CL8Y value of DOUB per CHARM** does not decrease — see [primitives — redemption economics](../product/primitives.md#timecurve-redemption-cl8y-density-no-referral). **The presale weight bonus is spend-free CHARM weight** (same `amount` to `FeeRouter`); treat it like referral for the **no-referral** redemption-density invariant — i.e. it is **out of scope** for the “CL8Y value of DOUB per CHARM non-decreasing” path that assumes weight only from raw `charmWad`.
- **RabbitTreasury + BurrowMath:** Users deposit the reserve asset during an **open** epoch and receive DOUB (credited to **redeemable** backing). **`receiveFee`** increases **total** backing but splits gross inflows into **burn** (sink transfer) and **protocol-owned** backing—no DOUB is minted. **Withdraw** burns DOUB and pays users from **redeemable** backing using `min(nominal, pro-rata)` on that bucket, a **health-linked efficiency** curve, an optional **epoch cooldown**, and a **withdrawal fee** that recycles into protocol-owned backing. **Epoch finalization** uses **total** backing (redeemable + protocol) inside `BurrowMath.coverageWad` so treasury strength reflects accumulated CL8Y. Math is fuzzed and cross-checked against Python reference and simulations where applicable.
- **FeeRouter + FeeMath:** Sink weights are validated to sum to 10_000 bps; distribution uses integer division with **remainder assigned to the last sink** so no dust remains in the router. Governance roles control sink updates.
- **DoubPresaleVesting:** Beneficiary list and per-address allocations are **immutable** after deploy. The constructor rejects **duplicate or zero addresses**, **zero individual allocations**, **length mismatches**, **`vestingDuration == 0`**, and **`requiredTotalAllocation != sum(amounts)`**. Only **`Ownable` owner** may call **`startVesting` once**, after **`DOUB.balanceOf(vesting) >= totalAllocated`**. Vesting math: **`cliff = allocation × 3000 / 10000`**, **`linearCap = allocation - cliff`**, **`linearReleased = linearCap × min(elapsed, duration) / duration`** for **`elapsed = t - vestingStart`**; **`vested = min(allocation, cliff + linearReleased)`** once **`t >= vestingStart`**. **`claim`** is **nonReentrant** and cannot exceed **`vested - claimed`**. **`claim` order:** **`NotStarted` → `ClaimsNotEnabled` → `NotBeneficiary`** (issue #55: **`setClaimsEnabled(true)`** is required for DOUB transfers). **Owner `rescueERC20` ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)):** may recover vesting-token **surplus** above **`totalAllocated − Σ claimedOf`** (O(n) sum over beneficiaries) and **arbitrary** non-vesting ERC20 balances; cannot reduce DOUB below that reserve while beneficiaries retain unclaimed allocation headroom. Enumeration via **`beneficiaryCount` / `beneficiaryAt` / `isBeneficiary`** wraps OpenZeppelin **`EnumerableSet.AddressSet`**.
- **LeprechaunNFT:** Series are created with a max supply; only the minter role can mint; trait structs are stored onchain for indexer/UI derivation. **`DEFAULT_ADMIN_ROLE`** may call **`setBaseURI`**, so **`tokenURI`** offchain JSON roots are **admin-mutable by design**; gameplay authority stays in **`tokenTraits`** ([issue #125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125), [product § metadata trust](../product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json)).
- **Indexer:** Log decoding must match Solidity event layouts; persistence must survive duplicate delivery (`ON CONFLICT`); on reorg, rows strictly after the common ancestor block are removed and the chain pointer is reset ([REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md)).
- **Frontend helpers:** User-supplied addresses and indexer base URLs are normalized so RPC and HTTP clients see stable values.
- **Kumbaya routing:** See [integrations/kumbaya.md](../integrations/kumbaya.md) for environment runbooks and the **fail closed / path encoding / integrator parity** invariants. Unit coverage: [`kumbayaRoutes.test.ts`](../../frontend/src/lib/kumbayaRoutes.test.ts).
- **TimeCurve sale phase (UI):** Off-chain only **interprets** onchain `saleStart` / `deadline` / `ended` and must not split “now” between the **hero timer** and **`derivePhase`** when the **indexer** provides `chain-timer` — see [timecurve-views — Chain time and sale phase](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48) and [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48).
- **Arena WarBow hero actions (UI):** Hero steal candidates are convenience rows only; the selected target still flows through live `battlePoints` / `stealsReceivedOnDay` / `stealsCommittedByAttackerOnDay` reads and `describeStealPreflight` before signing. Guard and revenge CTAs share the same wrong-chain and `buyFeeRoutingEnabled` write gates as the detailed WarBow section — see [timecurve-views — Arena WarBow hero actions](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) and [issue #101](https://gitlab.com/PlasticDigits/yieldomega/-/issues/101).
- **Arena sniper-shark cutout (UI):** Visual art remains non-authoritative and sparse: one decorative shark on the Arena buy panel, no shark in global chrome or neutral operator surfaces — see [timecurve-views — Arena sniper-shark cutout](../frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80) and [issue #80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80).

---

<a id="timecurve-presale-charm-weight-boost"></a>

### TimeCurve presale CHARM weight bonus (`INV-TC-PRESALE-CHARM-BOOST`)

**Intent:** Addresses in **`DoubPresaleVesting`** earn **+15%** of each **`buy` / `buyFor`** **`charmWad`** as **extra `charmWeight` and `totalCharmWeight`** when **`TimeCurve.doubPresaleVesting`** is set to that vesting contract’s **ERC-1967 proxy**. **Gross accepted-asset spend** for the buy is **unchanged** (same `amount` routed to **`FeeRouter`**). Referral splits still apply as today; the presale bonus applies **only** to the buyer’s purchased-`charmWad` weight line (not to the referrer’s referral tranche). Canonical product copy: [primitives — TimeCurve buy + redemption](../product/primitives.md) · header hint: [timecurve-views — presale header](../frontend/timecurve-views.md#timecurve-presale-charm-header-hint).

| Invariant | Check |
|-----------|-------|
| **BPS** | Onchain constant **`PRESALE_CHARM_WEIGHT_BPS`** (`1500`). |
| **Membership** | `IDoubPresaleBeneficiary(doubPresaleVesting).isBeneficiary(buyer)`; `doubPresaleVesting == address(0)` disables the bonus. |
| **Ops event** | `setDoubPresaleVesting` emits **`DoubPresaleVestingSet`**; indexer table **`idx_timecurve_presale_vesting_set`** ([§ #112](#indexer-emitted-event-coverage-gitlab-112)). |
| **Local DeployDev** | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) calls **`setDoubPresaleVesting`** after vesting deploy so stack QA matches mainnet wiring. |

**Forge:** [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) — `test_buy_presale_beneficiary_adds_15pct_charm_weight`, `test_buy_non_presale_beneficiary_no_boost_when_vesting_set`, `test_presale_charm_boost_zero_when_vesting_cleared`.

---

<a id="timecurve-arena-warbow-hero-actions-issue-101"></a>

### TimeCurve Arena WarBow hero actions (issue #101)

**Intent:** WarBow actions should be obvious at first glance on
`/timecurve/arena` without making the frontend authoritative for PvP rules.

| Invariant | Check |
|-----------|-------|
| **Hero visibility** | `PageHeroArcadeBanner` renders `WarbowHeroActions` with wallet context and **Steal / Guard / Revenge** controls before the detailed `WarbowSection`. |
| **Steal candidate source** | Candidates are deduped from `warbowLadderPodium()` and `/v1/timecurve/warbow/leaderboard`; indexer rows are only discovery hints. |
| **Onchain eligibility remains final** | Selecting a candidate writes `stealVictimInput`, which triggers the existing live contract reads for victim BP, `stealsReceivedOnDay`, and `stealsCommittedByAttackerOnDay`; `describeStealPreflight` and wallet simulation still gate the action. |
| **Write barriers** | Hero WarBow controls sit under `ChainMismatchWriteBarrier`; submit functions also abort on `chainMismatchWriteMessage` and `buyFeeRoutingEnabled === false`. |
| **Empty state** | No suggested target renders a clear empty state and leaves the manual address path in `WarbowSection` available. |
| **Revenge targets** | With **`VITE_INDEXER_URL`**, the hero lists **all** open **(victim, stealer)** windows from **`GET /v1/timecurve/warbow/pending-revenge`** and submits **`warbowRevenge(stealer)`** per selection ([GitLab #135](https://gitlab.com/PlasticDigits/yieldomega/-/issues/135)). |

**Automated:** [`WarbowHeroActions.test.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.test.tsx).
**Docs / play:** [timecurve-views — issue #101](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) · [invariants — per-stealer revenge (#135)](#warbow-per-stealer-revenge-windows-gitlab-135) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

<a id="timecurve-warbow-steal-rules-gitlab-134"></a>

### WarBow steal ranking, drain math, and UTC-day caps ([GitLab #134](https://gitlab.com/PlasticDigits/yieldomega/-/issues/134))

**Intent:** Steals stay **underdog-vs-leader** PvP: **no zero-BP sybil steals**, explicit **floor(10%) / floor(1%)** drain semantics, and **independent UTC-day counters** on **victim receives** vs **attacker commits** so bypass economics are **per wallet**, not funnelable through rotating fresh identities alone.

| Invariant ID | Check |
|--------------|-------|
| **`INV-WARBOW-134-RANK`** | **`warbowSteal`** requires **`battlePoints(attacker) > 0`** and **`battlePoints(victim) ≥ 2 × battlePoints(attacker)`** — revert **`TimeCurve: steal 2x rule`**. |
| **`INV-WARBOW-134-DRAIN`** | BP moved is **`_warbowStealDrainBp(victimBp, drainBps)`** with **`drainBps ∈ {WARBOW_STEAL_DRAIN_BPS, WARBOW_STEAL_DRAIN_GUARDED_BPS}`**; **`take == 0`** → **`steal zero`**. |
| **`INV-WARBOW-134-UTC-VICTIM`** | **`stealsReceivedOnDay[victim][day]`** increments on success; when **≥ `WARBOW_MAX_STEALS_PER_DAY`** before the tx, **`payBypassBurn`** must be **true** or revert **`TimeCurve: steal victim daily limit`**. |
| **`INV-WARBOW-134-UTC-ATTACKER`** | **`stealsCommittedByAttackerOnDay[attacker][day]`** increments on success; when **≥** the same threshold before the tx, **`payBypassBurn`** must be **true** or revert **`TimeCurve: steal attacker daily limit`**. |
| **`INV-WARBOW-134-BYPASS-SINK`** | When **either** UTC gate binds, the contract pulls **`WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD`** once and emits **`StealLimitBypass`**; **`WarBowSteal.bypassedVictimDailyLimit`** documents **any** bypass burn (field name unchanged). |

**Forge:** [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) — `test_warbow_steal_revert_zero_attacker_bp`, `test_warbow_steal_attacker_daily_limit_fourth_needs_bypass`; [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) — fuzz setups grant stealer BP (**one buy**) and victim **`≥ 2×`** (**two buys** at flat BP rates). **Frontend:** [`timeCurveUx.ts` — `describeStealPreflight`](../../frontend/src/lib/timeCurveUx.ts), Arena `WarbowSection` / `WarbowHeroActions`, [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts). **Docs / play:** [primitives — Steal](../product/primitives.md#steal-warbowsteal) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

<a id="warbow-podium-snapshot-drifts-gitlab-129"></a>

### WarBow ladder snapshot drift, permissionless refresh, and **`distributePrizes`** latch ([GitLab #129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129))

**Intent:** The **`warbowLadderPodium()`** snapshot can occasionally disagree with authoritative **`battlePoints`** (e.g. edge paths before full heap repair). Operators and participants need a **repair** path before prize movement; **`distributePrizes`** must not pay a stale WarBow slice when **`reservePodiumPayoutsEnabled`** and podium CL8Y is positive.

| Invariant ID | Check |
|--------------|-------|
| **`INV-WARBOW-129-REFRESH`** | **`refreshWarbowPodium(candidates)`** is **`external`**, **non-payable**, requires **`!ended`** (**GitLab #149**), re-applies **`_updateWarbowPodium(acc)`** for each non-zero **`candidates[i]`**, emits **`WarbowPodiumRefreshed`**, and sets **`warbowPodiumFinalized = false`**. |
| **`INV-WARBOW-129-FINALIZE`** | **`finalizeWarbowPodium(candidates)`** is **`onlyOwner`**, requires **`ended && !prizesDistributed`**, **`_clearWarbowPodium`**, then for each **`candidates[i]`** with **`battlePoints[c] > 0`** applies **`_updateWarbowPodium`**, emits **`WarbowPodiumFinalized`**, **`warbowPodiumFinalized = true`**. |
| **`INV-WARBOW-129-DIST`** | **`distributePrizes`** when **`acceptedAsset.balanceOf(podiumPool) > 0`**: **`reservePodiumPayoutsEnabled`** and **`warbowPodiumFinalized`** are **`require`**'d before paying winners (WarBow slice may still be zero wei — finalize still required when pool balance is positive). **Zero balance:** see **`INV-TIMECURVE-133-*`** ([GitLab #133](#timecurve-empty-podium-pool-settlement-gitlab-133)); **`warbowPodiumFinalized`** is **not** consulted. |

**Forge:** [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) — refresh steal scenarios + **`_finalizeWarbow*`** helpers on successful **`distributePrizes`** paths. **Frontend:** **`warbowPodiumFinalized()`** reads, **`viewerShouldSuggestWarBowPodiumRefresh`** + **`WarbowSection`** refresh CTA — [`timeCurveWarbowSnapshotClaim.ts`](../../frontend/src/lib/timeCurveWarbowSnapshotClaim.ts), **`useTimeCurveArenaModel`**. **Anvil harness:** **`SimulateAnvilRichState` Part 2**, [`verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) row **4**. **Indexer (optional vs [#112](#indexer-emitted-event-coverage-gitlab-112)):** decode **`WarbowPodiumRefreshed`** / **`WarbowPodiumFinalized`** if UI needs history (**follow-up**, not blocking reads — events are ancillary to authoritative views).

**Docs / play:** [timecurve-views — WarBow podium snapshot (#129)](../frontend/timecurve-views.md#warbow-ladder-podium-snapshot-mismatch-issue-129) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md) · [empty **`PodiumPool`** settlement — #133](#timecurve-empty-podium-pool-settlement-gitlab-133).

<a id="timecurve-empty-podium-pool-settlement-gitlab-133"></a>

### Empty **`PodiumPool`** at **`distributePrizes`** — observer-visible settlement ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133))

**Intent:** When the sale has **`ended`** and **`acceptedAsset.balanceOf(podiumPool) == 0`**, owner **`distributePrizes`** must **not** silently return: observers need a **distinct** signal from the non-zero path (**`PrizesDistributed`** after drain). Product choice (**#133**): **`reservePodiumPayoutsEnabled`** is still **`require`**'d (#55), then **`prizesDistributed = true`**, **`PrizesSettledEmptyPodiumPool(podiumPool)`**, and **no** second settlement (**donations after latch do not reopen** the distribution tx).

| Invariant ID | Check |
|--------------|-------|
| **`INV-TIMECURVE-133-EMPTY-EVENT`** | **`onlyOwner` `distributePrizes`** with **`ended`**, **`!prizesDistributed`**, **`balanceOf(podiumPool)==0`**, **`reservePodiumPayoutsEnabled`**: emits **`PrizesSettledEmptyPodiumPool`** indexed **`podiumPool`**; does **not** emit **`PrizesDistributed`**. |
| **`INV-TIMECURVE-133-EMPTY-LATCH`** | Same path sets **`prizesDistributed = true`** before return; a later owner call to **`distributePrizes`** reverts **`"TimeCurve: prizes done"`**. |
| **`INV-TIMECURVE-133-EMPTY-GATE`** | **`reservePodiumPayoutsEnabled == false`** with zero balance reverts **`"TimeCurve: reserve podium payouts disabled"`** (same gate string as non-zero path). |
| **`INV-INDEXER-133`** | Decoder persists **`PrizesSettledEmptyPodiumPool`** → **`idx_timecurve_prizes_settled_empty_podium_pool`**; **`GET /v1/timecurve/prize-distributions`** exposes **`kind`** / merged rows (**[`INV-INDEXER-112`](#indexer-emitted-event-coverage-gitlab-112)**). |

**Forge:** [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) — `test_distributePrizes_empty_vault_emits_empty_settlement_and_locks`, `test_distributePrizes_empty_pool_reverts_when_reserve_podium_payouts_disabled`; indexer integration — [`integration_stage2.rs`](../../indexer/tests/integration_stage2.rs).

**Docs / play:** [final signoff — empty pool](../operations/final-signoff-and-value-movement.md) · [`play-timecurve-doubloon/SKILL.md`](../../skills/play-timecurve-doubloon/SKILL.md) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

<a id="warbow-per-stealer-revenge-windows-gitlab-135"></a>

### WarBow per-stealer revenge windows (GitLab #135)

**Intent:** A victim can owe **multiple concurrent revenge windows** — one per **stealer** that successfully triggered a qualifying steal — without later steals **clobbering** earlier pending windows. Authoritative state is the **pair** mappings on `TimeCurve`; the indexer and Arena UI surface **all** open windows for the connected victim.

| Invariant | Check |
|-----------|--------|
| **Onchain pair slot** | `warbowSteal` sets **`warbowPendingRevengeExpiryExclusive[victim][stealer]`** and bumps **`warbowPendingRevengeStealSeq[victim][stealer]`**; emits **`WarBowRevengeWindowOpened(victim, stealer, expiryExclusive, stealSeq)`**. |
| **`warbowRevenge(stealer)`** | Clears **only** the **`[msg.sender][stealer]`** slot; other stealers' windows remain until consumed or past expiry. |
| **Indexer** | Table **`idx_timecurve_warbow_revenge_window`** + rollback coverage per [**INV-INDEXER-112**](#indexer-emitted-event-coverage-gitlab-112); **`GET /v1/timecurve/warbow/pending-revenge`** reconciles open rows vs later **`WarBowRevenge`**. |
| **Arena UX** | `WarbowHeroActions` + `WarbowSection` show **per-stealer** actions when **`VITE_INDEXER_URL`** is set; raw accordion lists **all** open windows. Without indexer URL, hero explains that the full list requires env configuration. |
| **`INV-WARBOW-135-CARD`** | **Cardinality:** ≥**7** distinct stealers vs one victim can hold **simultaneous** open revenge slots on one UTC day (**`payBypassBurn`** from the victim’s **4th** received steal onward per **`WARBOW_MAX_STEALS_PER_DAY()`**); victim may **`warbowRevenge(stealer)`** in any order and each tx clears **only** that **`[victim][stealer]`** row. |

**Automated:** Foundry [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) — `test_warbow_revenge_overwritten_by_second_stealer_shields_first` (minimal **2**-stealer isolation), **`test_warbow_revenge_seven_stealers_distinct_slots`** (explicit **7** + non-sequential consume order), **`testFuzz_warbow_revenge_distinct_stealer_slots_overlap`** (**7–14** stealers, **256** runs); indexer integration stage2; [`WarbowHeroActions.test.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.test.tsx).

**Docs / play:** [timecurve-views — hero #101 / revenge list](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md) · [issue #135](https://gitlab.com/PlasticDigits/yieldomega/-/issues/135).

<a id="timecurve-simple-live-reserve-podiums-issue-113"></a>

### TimeCurve Simple live reserve podiums (issue #113)

**Intent:** The first-run `/timecurve` route should surface the live reserve
podium races without becoming the dense Arena surface. Participants can see
who currently holds 1st / 2nd / 3rd across the four fixed v1 categories before
they reach the Recent buys ticker.

| Invariant | Check |
|-----------|-------|
| **Placement** | `TimeCurveSimplePage` renders `TimeCurveSimplePodiumSection` immediately above the `Recent buys` `PageSection` whose badge is **Live ticker**. |
| **Onchain source** | Rows come from `usePodiumReads` / `TimeCurve.podium(category)` through `PODIUM_CONTRACT_CATEGORY_INDEX`; no indexer row is used to decide winners. |
| **Canonical categories** | The section renders exactly `PODIUM_LABELS`: Last Buy, WarBow, Defended Streak, Time Booster, each with 1st / 2nd / 3rd rows. |
| **Viewer highlight** | Connected-wallet matches use the shared `RankingList` `ranking-list__item--you` treatment. |
| **Near-real-time refresh** | `Buy` logs refetch podium reads immediately; a light RPC interval catches WarBow-only moves. |
| **Simple vs Arena density** | The Simple route uses a compact summary title (**Live reserve podiums**) and must not reintroduce Arena headings such as **Podiums and prizes**, **WarBow moves and rivalry**, or **Live battle feed** above the fold. |

**Automated:** [`TimeCurveSimplePodiumSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.test.tsx) · [`timecurve.spec.ts`](../../frontend/e2e/timecurve.spec.ts).
**Docs / play:** [timecurve-views](../frontend/timecurve-views.md) · [manual QA #113](manual-qa-checklists.md#manual-qa-issue-113) · [`play-timecurve-doubloon/SKILL.md`](../../skills/play-timecurve-doubloon/SKILL.md).

## Invariants and where they are tested

### Kumbaya routing (`kumbayaRoutes`)

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Unknown chain | No routing without a `CHAIN_DEFAULTS` entry | `resolveKumbayaRouting`: fails on chain `1` |
| Missing router on Anvil | `31337` without `VITE_*` addresses → `missing_router` | `resolveKumbayaRouting` |
| MegaETH defaults | `4326` / `6343` resolve **SwapRouter02**, **QuoterV2**, **WETH9** without env | `resolveKumbayaRouting` (integrator-kit parity) |
| Mainnet USDm | `4326` includes **USDm** token for stable pay mode | `resolveKumbayaRouting` + `routingForPayAsset` |
| Testnet stable | `6343` leaves stable to **`VITE_KUMBAYA_USDM`** when no default pool token | `routingForPayAsset` `usdm` + zero `usdm` |
| Path packing | `exactOutput` path bytes length / hop count | `buildV3PathExactOutput` |
| Slippage floor | `minOutFromSlippage` BPS clamp | `minOutFromSlippage` |

---

<a id="timecurve-simple-kumbaya-quote-refresh-issue-56"></a>

### TimeCurve Simple — Kumbaya quote refresh (issue #56)

When **Pay with** is **ETH** or **USDM**, the Simple buy CTA must stay **disabled** and show **Refreshing quote…** while the Kumbaya **`quoteExactOutput`** read is **in flight** for the current slider-derived CL8Y amount, including TanStack Query **background refetches** (`isFetching` without `isPending`). **`swapQuoteLoading`** in [`useTimeCurveSaleSession.ts`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) gates both the CTA label and `nonCl8yBlocked` on [`TimeCurveSimplePage`](../../frontend/src/pages/TimeCurveSimplePage.tsx).

**Why:** Prevents signing against a stale on-screen quote after rapid slider changes; aligns with Anvil wallet-write E2E stability ([issue #52](https://gitlab.com/PlasticDigits/yieldomega/-/issues/52)). **Doc:** [timecurve-views — Buy quote refresh](../frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56) · [issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56).

<a id="indexer-offline-ux-and-backoff-gitlab-96"></a>

### Indexer offline UX and poll backoff (issue #96)

**Intent:** When the HTTP indexer (`VITE_INDEXER_URL`) fails during a session, participants see an explicit **offline / retrying** signal, indexer pollers **back off** (30s → 60s → 120s) after a short streak of failures, and **Recent buys** does not use the **“first buy of the round”** empty copy while the feed is unreachable ([issue #96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)).

| Invariant | Check |
|-----------|--------|
| **Shared failure streak** | [`reportIndexerFetchAttempt`](../../frontend/src/lib/indexerConnectivity.ts): **≤1 failure increment per wall-clock second**; **any** success resets streak to **0**. |
| **Offline threshold** | **`failureStreak >= 3`** → user-visible **offline** (`useIndexerConnectivity` / `IndexerStatusBar` **Indexer offline · retrying**). |
| **Adaptive intervals** | **`getIndexerBackoffPollMs(fastMs)`** returns **`fastMs`** when healthy; after threshold, **30s / 60s / 120s** capped tiers. |

| Caller (representative) | Baseline `fastMs` |
|------------------------|-------------------|
| `IndexerConnectivityProvider` (`fetchIndexerStatus`) | **3000** |
| `useTimecurveHeroTimer` (`fetchTimecurveChainTimer`) | **1000** |
| `fetchTimecurveBuys` (Simple + Arena) | **5000** / **3000** |

| Empty-state guard | **Waiting for the first buy…** only when the **last** buys poll succeeded with **zero** rows **and** offline streak is not active; unreachable / failed poll → **Cannot reach indexer · cached data may be stale** (and optional hint when cached rows still show). |

**Automated:** [`indexerConnectivity.test.ts`](../../frontend/src/lib/indexerConnectivity.test.ts) (`indexerBackoffPollMsForStreak`, debounced failure counting).

**Doc:** [timecurve-views — Indexer offline (issue #96)](../frontend/timecurve-views.md#indexer-offline-ux-issue-96) · manual QA checklist [`manual-qa-checklists.md#manual-qa-issue-96`](manual-qa-checklists.md#manual-qa-issue-96).

<a id="indexer-http-json-parse-issue-111"></a>

### Indexer HTTP responses — JSON parse errors (`getJson`, chain timer) (issue #111)

**Intent:** Rare misbehaving proxies can return **`200 OK`** with a **truncated or HTML body** while claiming JSON. **`Response.json()`** rejects asynchronously; **`return res.json()` without `await`** escapes the surrounding **`try/catch`** and yields an **uncaught rejection** upstream ([issue #111](https://gitlab.com/PlasticDigits/yieldomega/-/issues/111)).

| Invariant | Check |
|-----------|--------|
| **`await res.json()`** | [`getJson`](../../frontend/src/lib/indexerApi.ts) and [`fetchTimecurveChainTimer`](../../frontend/src/lib/indexerApi.ts) **`await`** parse inside **`try`** so **`SyntaxError`** maps to **`null`**. |
| **Observability** | **`fetchTimecurveBuys`** → **`null`** lets Arena **`loadBuys`** / Simple **`tick`** call **`reportIndexerFetchAttempt(false)`** (same as HTTP failures). **`fetchTimecurveChainTimer`** → **`null`** yields **`reportIndexerFetchAttempt(false)`** from **`useTimecurveHeroTimer`** when no finite snapshot. |

**Automated:** [`indexerApi.test.ts`](../../frontend/src/lib/indexerApi.test.ts) (`indexer JSON bodies (issue #111)`).

**Doc:** [timecurve-views — Indexer offline (#96), malformed JSON (#111)](../frontend/timecurve-views.md#indexer-offline-ux-issue-96) · extends [#96](#indexer-offline-ux-and-backoff-gitlab-96) above.

<a id="indexer-public-api-500-error-redaction-gitlab-157"></a>

### Indexer public HTTP API — database errors must not leak in JSON `500` bodies (issue #157)

**`INV-INDEXER-157`:** On unexpected **Postgres / `sqlx`** failures while serving **`GET /v1/...`** read routes, the HTTP response body must **not** echo raw driver strings (table names, constraint names, SQL fragments). Clients receive a **stable** JSON shape **`{ "error": "internal server error" }`** with **`500`**; operators rely on **`tracing::error!`** server logs (include per-route **`context`** strings) and **`tower_http::trace::TraceLayer`** request metadata ([GitLab #157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157), audit L‑01).

| Invariant | Check |
|-----------|--------|
| **No `sqlx::Error::to_string()` in JSON** | [`internal_db_error_response`](../../indexer/src/api.rs) is the single path for this class of failure in [`api.rs`](../../indexer/src/api.rs). |
| **Regression** | Unit test `internal_db_error_response_does_not_echo_sqlx_in_json_body` constructs a synthetic error containing **`idx_timecurve_buy`** and asserts it is absent from the serialized body. |

**Automated:** [`api.rs`](../../indexer/src/api.rs) (`internal_db_error_response_tests`).

**Doc:** [indexer design — API](../indexer/design.md#http-api-error-bodies-gitlab-157) · [indexer README](../../indexer/README.md#public-http-api-error-bodies-gitlab-157).

<a id="indexer-production-database-url-placeholders-gitlab-142"></a>

### Indexer production `DATABASE_URL` — placeholder rejection (issue #142)

**`INV-INDEXER-142`:** When **`INDEXER_PRODUCTION`** is enabled ([`indexer/src/cors_config.rs`](../../indexer/src/cors_config.rs)), **`Config::from_env`** must **`bail!`** if **`DATABASE_URL`** contains any substring listed in **`FORBIDDEN_PRODUCTION_DATABASE_URL_SUBSTRINGS`** in [`indexer/src/config.rs`](../../indexer/src/config.rs) (compared **case-insensitively**). This blocks copy-paste deployments with template credentials from [`indexer/.env.example`](../../indexer/.env.example) (for example **`CHANGE_ME_BEFORE_DEPLOY`**) or the legacy **`:password@`** tutorial userinfo pattern.

| Invariant | Check |
|-----------|--------|
| **Production gate** | [`ensure_production_database_url`](../../indexer/src/config.rs) runs after **`DATABASE_URL`** is read; no DB connect before the check. |
| **Non-production** | Without **`INDEXER_PRODUCTION`**, local URLs such as **`postgres://yieldomega:password@127.0.0.1/...`** from [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) remain valid. |
| **Operator docs** | [indexer/README.md](../../indexer/README.md) · [`.env.example`](../../indexer/.env.example) warn that **`RPC_URL` / `CHAIN_ID`** defaults are not a substitute for mainnet review. |

**Automated:** unit tests on `first_forbidden_production_database_url_substring` in [`config.rs`](../../indexer/src/config.rs).

**Doc:** [indexer design — Configuration](../indexer/design.md#configuration) · [issue #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142).

<a id="indexer-production-address-registry-fail-closed-gitlab-156"></a>

### Indexer production `ADDRESS_REGISTRY` — fail closed (issue #156)

**`INV-INDEXER-156`:** When **`INDEXER_PRODUCTION`** is enabled, **`Config::from_env`** must **`bail!`** on unsafe registry or chain configuration so production never runs **warn-and-idle** ingestion with a wrong or empty address set ([audit M-02](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156)).

| Invariant | Check |
|-----------|--------|
| **Ingestion + registry path** | With **`INGESTION_ENABLED`** truthy (default), missing **`ADDRESS_REGISTRY_PATH`** → startup error (not API-only idle loop). |
| **`CHAIN_ID` vs JSON `chain_id`** | Mismatch → **`bail!`** (non-production keeps **warn** only when a registry file is present). |
| **Parse / zero / mandatory fields** | With ingestion enabled: **`TimeCurve`**, **`RabbitTreasury`**, **`LeprechaunNFT`**, **`FeeRouter`**, **`ReferralRegistry`**, **`PodiumPool`** must be non-empty, parseable, and non-zero; any other **non-empty** field must parse (no silent skip of garbage strings). |
| **`deploy_block`** | For **`CHAIN_ID ∉ {31337}`**, **`deploy_block`** must be **> 0**. **`31337`** (Anvil) may use **`0`**. |
| **`TimeCurveBuyRouter`** | Optional unless **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** (`1` / `true` / `yes`), then the router proxy must be set ([GitLab #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). |
| **Non-production** | Without **`INDEXER_PRODUCTION`**, existing warn / skip / idle behavior is unchanged. |

**Automated:** unit tests in **`production_registry_validation_tests`** in [`indexer/src/config.rs`](../../indexer/src/config.rs).

**Doc:** [indexer README — production checklist](../../indexer/README.md) · [indexer design — Configuration](../indexer/design.md#configuration) · [issue #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156).

<a id="timecurve-simple-stake-redeemed-issue-90"></a>

### TimeCurve Simple — stake panel after `redeemCharms` (issue #90)

After **`charmsRedeemed(address)`** is true, **`charmWeight`** still reflects the wallet’s historical allocation (**`redeemCharms`** does not zero weight — [`TimeCurve.sol`](../../contracts/src/TimeCurve.sol)), so the **Your stake at launch** panel must read as **settled**, not an unfilled claim:

| Invariant | Check |
|-----------|--------|
| **Redeemed DOUB row** | Show **`totalTokensForSale × charmWeight ÷ totalCharmWeight`** (matches **`redeemCharms`** **`tokenOut`**); sourced from **`expectedTokenFromCharms`** in [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) when **`phase === 'saleEnded'`**. |
| **CL8Y-at-launch tile** | **Dim + strikethrough** on the projection + **(redeemed)** on the label; **do not** replace CL8Y with DOUB-only “worth” copy (*issue #90 option B rejected*: mixed ETH/USDM/CL8Y pay rails keep anchoring semantics CL8Y-native for the historical projection). |
| **Settled chrome** | Header **`actions`**: check pictogram + **`PageBadge`** label **Settled** (`tone="live"`) — [`TimeCurveStakeAtLaunchSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.tsx). |

**Doc:** [timecurve-views — stake redeemed](../frontend/timecurve-views.md#timecurve-simple-stake-redeemed-issue-90) · [`TimeCurveStakeAtLaunchSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx) · [issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90) · manual QA checklist [`manual-qa-checklists.md#manual-qa-issue-90`](manual-qa-checklists.md#manual-qa-issue-90).

<a id="timecurve-buy-charm-submit-fresh-bounds-issue-82"></a>

### TimeCurve buy — submit-time CHARM sizing (issue #82)

**Intent:** Prevent **`buy` / `buyViaKumbaya`** reverts when **`charmWad`** was valid at quote time but **outside** `currentCharmBoundsWad` at inclusion time (fast chains, slider near **max** or **min CHARM**). Same root cause affects **CL8Y direct** and **Kumbaya** paths ([issue #74](https://gitlab.com/PlasticDigits/yieldomega/-/issues/74) ETH single-tx repro in #82 notes).

| Invariant | Check |
|-----------|--------|
| Fresh RPC read at submit | [`readFreshTimeCurveBuySizing`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts) runs immediately before calldata for **Simple** [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) and **Arena** [`useTimeCurveArenaModel`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx). |
| Slack under `maxCharmWad` | `CHARM_SUBMIT_UPPER_SLACK_BPS` (**50** → **99.5%** of live max) used as the CHARM clamp ceiling in [`reconcileFreshBuySizingFromReads`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts). |
| Headroom above `minCharmWad` | `CHARM_SUBMIT_LOWER_HEADROOM_BPS` (**50** → **100.5%** of live min) used as the CHARM clamp floor in [`reconcileFreshBuySizingFromReads`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts) ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)). |
| Floored CHARM from spend | [`finalizeCharmSpendForBuy`](../../frontend/src/lib/timeCurveBuyAmount.ts) documents floor division; unit tests in [`timeCurveBuySubmitSizing.test.ts`](../../frontend/src/lib/timeCurveBuySubmitSizing.test.ts). |
| Bare revert UX | [`friendlyRevertFromUnknown`](../../frontend/src/lib/revertMessage.ts) `buySubmit: true` maps generic execution failures to band-shift guidance. |

**Doc:** [timecurve-views — Buy CHARM fresh bounds](../frontend/timecurve-views.md#buy-charm-submit-fresh-bounds-issue-82) · [kumbaya.md](../integrations/kumbaya.md#issue-65-single-tx-router) · [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) · manual QA checklist [`manual-qa-checklists.md#manual-qa-issue-82`](manual-qa-checklists.md#manual-qa-issue-82).

<a id="timecurve-kumbaya-swap-deadline-chain-time-issue-83"></a>

### Kumbaya swap deadline vs chain time (issue #83)

**Intent:** Kumbaya **`exactOutput`** / **`buyViaKumbaya`** pass a **`swapDeadline`** checked against **`block.timestamp`** on the router (e.g. `AnvilKumbayaRouter`). Encoding the deadline as **`Date.now() + buffer`** fails after **`cast rpc anvil_increaseTime`** (or full **`anvil_rich_state.sh`**) because **chain time can run far ahead of wall clock** → router **`Expired()`** while the app wiring is otherwise correct ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)).

| Invariant | Check |
|-----------|--------|
| **Chain-aligned deadline** | [`fetchSwapDeadlineUnixSec`](../../frontend/src/lib/timeCurveKumbayaSwap.ts) uses **`getBlock({ blockTag: 'latest' })`** + default **600s** buffer; **two-step** swap uses the same fetch **immediately before** the swap write (after wrap/approve). **Single-tx** [`submitKumbayaSingleTxBuy`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts) fetches after any USDM **`approve`**. |
| **Prod parity** | On live networks, head **`block.timestamp`** tracks real time; behavior matches the prior wall-clock rule in the common case. |
| **Stacks using `anvil_increaseTime`** | Documented in [kumbaya.md — QA time warp](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83); see **Option B** there for workflows that must not warp before Kumbaya evidence. |

**Doc:** [kumbaya.md — issue #83](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83) · [timecurve-views — swap deadline](../frontend/timecurve-views.md#kumbaya-swap-deadline-chain-time-issue-83) · [issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83).

<a id="timecurve-arena-sniper-shark-cutout-issue-80"></a>

### TimeCurve Arena — sniper-shark cutout (issue #80)

**Intent:** Shark art stays contextual and sparse. The only shipped placement is
the Arena **Buy CHARM** panel, because its timing pressure and optional WarBow
flag planting fit the "hunter / sniper" narrative without changing any onchain
rule or buy path.

| Invariant | Check |
|----------|--------|
| Single runtime shark | `/timecurve/arena` references `sniper-shark-peek-scope.png`; Simple, Protocol, and global layout do not gain shark cutouts. |
| Decorative a11y | `CutoutDecoration` default empty `alt` keeps the image `aria-hidden`; text labels and buttons remain the accessibility source of truth. |
| Motion restraint | The shark uses the existing `peek-loop` animation and the global `prefers-reduced-motion` suppression. |
| Visual QA | Run the manual QA checklist in [`manual-qa-checklists.md#manual-qa-issue-80`](manual-qa-checklists.md#manual-qa-issue-80); confirm it does not crowd bunny/leprechaun hierarchy on Home, Simple, and Arena. |

**Automated coverage:** frontend typecheck / lint / build smoke. Full crowding
and hierarchy verification is visual QA.

### TimeCurve — single-tx Kumbaya `buyViaKumbaya` (issue #66)

When **Simple** or **Arena** pay mode is **ETH** or **USDM** and **`TimeCurve.timeCurveBuyRouter()`** is **non-zero**, the buy path calls **`TimeCurveBuyRouter.buyViaKumbaya`** (same **packed path** and **slippage** as the two-step flow); **`plantWarBowFlag`** matches the **`buy` / `buyFor`** opt-in ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). **Zero** onchain buy router → legacy **two-step** only. **CL8Y** direct **`buy`** does not use the buy router. **Anvil E2E:** `scripts/lib/anvil_deploy_dev.sh` logs **TimeCurveBuyRouter**; `scripts/e2e-anvil.sh` may set **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`** for optional env/onchain parity checks. **Live Anvil buy-router scope (#65) automated via fork test:** [issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78) — `scripts/verify-timecurve-buy-router-anvil.sh` + [`VerifyTimeCurveBuyRouterAnvil.t.sol`](../../contracts/test/VerifyTimeCurveBuyRouterAnvil.t.sol). **Doc:** [kumbaya.md — single-tx](../integrations/kumbaya.md#issue-65-single-tx-router) · [issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66).

<a id="timecurve-buy-router-buyviakumbaya-sale-live-fail-fast-gitlab-118"></a>

### TimeCurveBuyRouter — `buyViaKumbaya` sale-live fail-fast ([issue #118](https://gitlab.com/PlasticDigits/yieldomega/-/issues/118))

**Intent:** After **`startSaleAt(epoch)`** ([issue #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)), **`buyViaKumbaya`** must align with **`TimeCurve`** buys: **`block.timestamp >= saleStart()`** before **`exactOutput`** or **`buyFor`**, so pre-open callers revert early with **`TimeCurveBuyRouter__BadSalePhase`** (audit **L-01** in [`audits/audit_smartcontract_1777813071.md`](../../audits/audit_smartcontract_1777813071.md)).

**INV-BUYROUTER-118:** With **`saleStart() > 0`**, **`!ended()`**, **`block.timestamp <= deadline()`**, and **`block.timestamp < saleStart()`**, **`buyViaKumbaya`** reverts **`BadSalePhase`** **without** calling **`kumbayaRouter.exactOutput`**. (Router sale-open window matches **`TimeCurve`** — timer past is **`> deadline()`** via [GitLab #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136).)

| Check | Coverage |
|-------|-----------|
| Pre-live revert (stable + ETH) | [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) — **`TimeCurveBuyRouterScheduledNotLive118Test`** · `test_buyViaKumbaya_badSalePhase_whenScheduledNotLive_stable`, `test_buyViaKumbaya_badSalePhase_whenScheduledNotLive_eth` |
| Post-warp success | Same contract · `test_buyViaKumbaya_stable_succeeds_afterWarpToSaleStart`, `test_buyViaKumbaya_eth_succeeds_afterWarpToSaleStart` |

**Doc:** [kumbaya.md — scheduled sale / fail-fast](../integrations/kumbaya.md#issue-65-single-tx-router).

<a id="timecurvebuyrouter-anvil-verification-issue-78"></a>

### TimeCurveBuyRouter — Anvil verification (issue #78)

**Intent:** The [#65 / #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) **TimeCurveBuyRouter** path on Anvil (fixtures, `quoteExactOutput` vs `exactOutput`, `buyViaKumbaya`, `plantWarBowFlag` / WarBow, `setTimeCurveBuyRouter(0)` revert) is covered by a **one-command** script so the **scope checklist** is not deferred. **`start-local-anvil-stack.sh`** runs **`DeployDev`** only unless **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)); otherwise use **`e2e-anvil.sh`**, **`anvil_deploy_dev.sh`**, or **`YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/verify-timecurve-buy-router-anvil.sh`** to deploy **`DeployKumbayaAnvilFixtures`** and merge **`contracts.TimeCurveBuyRouter`** into [`contracts/deployments/local-anvil-registry.json`](../../contracts/deployments/local-anvil-registry.json) for the indexer ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

| Invariant | Check |
|----------|--------|
| **Preconditions** | Anvil **`--code-size-limit 524288`**; **TimeCurve** = **proxy**; sale **not** ended (use `SKIP_ANVIL_RICH_STATE=1` for default stack, or a fresh `DeployDev`). |
| **Script** | `bash scripts/verify-timecurve-buy-router-anvil.sh` sets **`YIELDOMEGA_FORK_VERIFY=1`** and runs **`forge test`** for [`VerifyTimeCurveBuyRouterAnvil.t.sol`](../../contracts/test/VerifyTimeCurveBuyRouterAnvil.t.sol) against **`FORK_URL`**. With **`YIELDOMEGA_DEPLOY_KUMBAYA=1`**, broadcasts **`DeployKumbayaAnvilFixtures`** when **`timeCurveBuyRouter()`** is zero. After a non-zero router, **jq-merges** **`contracts.TimeCurveBuyRouter`** into **`local-anvil-registry.json`** when present and merges **`VITE_KUMBAYA_*`** into **`frontend/.env.local`** when the deploy log supplies fixture addresses ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)). |
| **Local registry + indexer ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84))** | **`ADDRESS_REGISTRY_PATH`** must include **`contracts.TimeCurveBuyRouter`** matching **`cast call <TimeCurve> "timeCurveBuyRouter()(address)"`** after fixtures, or **`BuyViaKumbaya`** rows are **not** ingested ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). **Restart** the indexer after the verify script or **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** stack start so it reloads the registry. Optional one-shot stack: **`YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/start-local-anvil-stack.sh`**. Helpers: [`scripts/lib/kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh). **`VITE_*`** line merge is **literal** (**[#154](#kumbaya-env-local-line-merge-gitlab-154)**). |
| **Buy event `flagPlanted`** | The fork test uses **`warbowPendingFlagOwner`** (same **opt-in** semantics as the **`Buy`** event, [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)) instead of log decoding. |
| **CI / default `forge test`** | Without **`YIELDOMEGA_FORK_VERIFY`**, the test **no-ops** (passes) so `forge test` in CI is unchanged. |

**Manual QA (third-party agents):** [`manual-qa-checklists.md#manual-qa-issue-78`](manual-qa-checklists.md#manual-qa-issue-78) · [issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78).

<a id="kumbaya-env-local-line-merge-gitlab-154"></a>

### Kumbaya local `frontend/.env.local` merge — literal KEY=value ([issue #154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154))

**Intent:** Stack helpers must not corrupt **`frontend/.env.local`** when **`KEY=value`** payloads contain characters **`sed` treats specially** in substitutions (**`&`**, **`#`**, **`/`**, backslashes).

**INV-KUMBAYA-ENV-154:** [`scripts/lib/kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh) delegates line writes to [`scripts/lib/kumbaya_env_set_line.py`](../../scripts/lib/kumbaya_env_set_line.py) so values are **literal** UTF-8 strings (**single-line** keys and values; newline rejected). **Regression:** [`scripts/test-kumbaya-env-set-line.sh`](../../scripts/test-kumbaya-env-set-line.sh).

**Doc:** [kumbaya.md — Localnet (Anvil)](../integrations/kumbaya.md#localnet-anvil) · [issue #154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154).

---

<a id="timecurve-post-end-gates-live-anvil-gitlab-79"></a>

### TimeCurve post-end gates — live Anvil (issue #79)

**Intent:** [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79) tracks a **deferred** live walkthrough for **#55** post-end gates (`redeemCharms`, `distributePrizes`) on an **ended** sale. Forge already covers the revert strings; this section ties **one-chain** `cast` evidence to a reproducible script.

| Invariant | Check |
|----------|--------|
| **Preconditions** | `TimeCurve.ended == true`; `charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` start **false** (after [DeployDev](../../contracts/script/DeployDev.s.sol)’s E2E convenience flags, the setup script [resets them](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79)); `prizesDistributed == false`; **non-zero** `acceptedAsset` balance on `podiumPool` — this script exercises the **funded-pool** path (**reserve gate** → **`finalizeWarbowPodium`** → **`PrizesDistributed`**). With **zero** balance, **`distributePrizes`** follows [**GitLab #133**](#timecurve-empty-podium-pool-settlement-gitlab-133) instead (**`PrizesSettledEmptyPodiumPool`** latch); use Forge or a dedicated cast workflow for that branch. |
| **Setup (preferred)** | `ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh` — Part1 buys + shell warp + `SimulateAnvilRichStatePart2EndSaleOnly` only (see [anvil-rich-state.md](anvil-rich-state.md#post-end-gate-walkthrough-issue-55--79)). |
| **Script** | `bash scripts/verify-timecurve-post-end-gates-anvil.sh` (rows: charm gate revert → owner on → redeem; reserve gate revert → owner on → `distributePrizes`). |

**Manual QA (third-party agents):** [`manual-qa-checklists.md#manual-qa-issue-79`](manual-qa-checklists.md#manual-qa-issue-79).

**CL8Y surplus (issue #70):** After `buyFor`, any **CL8Y** remaining on the router (exact-output dust / rounding, or accidental pre-seed on the router) is **`safeTransfer`’d to `cl8yProtocolTreasury`** — not refunded to the buyer. Constructor requires a **non-zero** treasury address. **`Cl8ySurplusToProtocol`** event. Tests: [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) `test_buyViaKumbaya_preseed_cl8y_surplus_routes_to_protocol_treasury`. [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70) · [CL8Y flow audit](../onchain/cl8y-flow-audit.md).

<a id="timecurve-buy-router-net-refund-rescue-issue-117"></a>

### `TimeCurveBuyRouter` — net WETH/USDM refunds + owner rescue ([issue #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117))

**Intent:** Audit **M‑02** (pre‑seed **WETH** / **`stableToken`** could be refunded to **`buyViaKumbaya`** callers as if it were marginal unused input). The router snapshots **opening** **`balanceOf(this)`** for the funding leg **before** `deposit`/`transferFrom`; post‑`exactOutput`, **PAY_ETH** unwraps **`balanceAfter − snapshot`** and **`call`s** exactly that ETH to **`msg.sender`**; **PAY_STABLE** **`safeTransfer`s** **`balanceAfter − snapshot`** only. Opening stranded balances therefore **stay** until governance rescue.

| Invariant ID | Statement |
|----------------|-----------|
| **`INV-BUYROUTER-117-NET-REFUND`** | Refund \(\le\) \(\Delta\) input token balance since the snapshot; **never** implicitly pays out third‑party deposits to the buyer. |
| **`INV-BUYROUTER-117-RESCUE`** | **`rescueETH` / `rescueERC20`** are **`onlyOwner`** (**[`Ownable2Step`](../../contracts/lib/openzeppelin-contracts/contracts/access/Ownable2Step.sol)**), **`nonReentrant`**, allow **`amount == type(uint256).max`** ⇒ full sweep; emit **`EthRescued`** / **`Erc20Rescued`**. **Indexer:** decode + **`idx_timecurve_buy_router_eth_rescued`** / **`idx_timecurve_buy_router_erc20_rescued`** + **`rollback_after`** ([GitLab #139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139), [`INV-INDEXER-139`](#indexer-residual-router-rescue-gitlab-139)). |

**Constructor:** `initialOwner` (non‑zero, same trust domain as **TimeCurve** ops — typically multisig aligned) is explicit from deploy scripts; **`DeployKumbayaAnvilFixtures`** passes **`deployer`** for **`cl8yProtocolTreasury`** and **`initialOwner`** on Anvil. **Forge:** `test_issue117_buyViaKumbaya_preseed_*`, `test_issue117_rescue_*` in [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol). **Product / integration narrative:** [`kumbaya.md` § single‑tx router](../integrations/kumbaya.md#issue-65-single-tx-router).

---

<a id="referrals-page-visual-issue-64"></a>

### Referrals `/referrals` visual surface and E2E (issue #64)

**Intent:** The dedicated referrals surface ([`ReferralsPage.tsx`](../../frontend/src/pages/ReferralsPage.tsx) + [`ReferralRegisterSection.tsx`](../../frontend/src/pages/referrals/ReferralRegisterSection.tsx)) must stay usable for **link capture docs**, **registry reads** (from `VITE_REFERRAL_REGISTRY_ADDRESS` or `TimeCurve.referralRegistry()`), **wallet-gated register**, and **post-register share links** with copy-to-clipboard. **Copy UX** must not be silent: success shows an obvious **inline banner** plus button **Copied!**; clipboard **unsupported or denied** shows an error `StatusMessage` ([issue #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)). **Authority** for codes and burns stays on **`ReferralRegistry`** + **`TimeCurve`** — see [product/referrals.md](../product/referrals.md).

**Launch-plan / F-11 (issue #91):** The **`YO-DOUB-Launch-UX-Flows`** **F-11** checklist and [`launchplan-timecurve.md`](../../launchplan-timecurve.md#6-under-construction-frontend) must **not** classify **`/referrals`** as **`UnderConstruction`**. That route is a **first-class** shipping surface alongside TimeCurve; placeholders remain **`/rabbit-treasury`** and **`/collection`** until their milestones.

**Browser storage (issue #85):** Pending capture (`?ref=` / path) uses **`yieldomega.ref.v1`** in **`localStorage` + `sessionStorage`**. Post-register “my code” cache for share-link UX uses **`yieldomega.myrefcode.v1.<walletLowercase>`** in **`localStorage` only** — do not conflate with R7 pending-key checks. Table + payloads: [product/referrals.md — referral browser storage keys](../product/referrals.md#referral-browser-storage-keys).

<a id="referral-registration-ordering-issue-121"></a>

**Referral registration ordering — mempool-fair / first-successful wins ([issue #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121), audit [L‑02](../../audits/audit_smartcontract_1777813071.md#l-02-referral-code-registration-is-front-runnable)):** **`ReferralRegistry.registerCode`** is **single-winner**: the **first included successful execution** binds `codeHash`; later registrations with the same normalized code revert (**`ReferralRegistry: code taken`**). **`Intent` ordering** (broadcast time, mempool position) **does not** reserve a slug. **`registerCode` calldata exposes the plaintext** before execution on public mempools, so observers may compete. **Mitigation:** the configured **`registrationBurnAmount`** CL8Y is burned **only after** uniqueness checks (**failed txs do not burn** — see [`ReferralRegistry.sol`](../../contracts/src/ReferralRegistry.sol)). **`INV-REFERRAL-121-UX`:** Unregistered **`/referrals`** register UI must disclose this **before** submit — [`ReferralRegisterSection.tsx`](../../frontend/src/pages/referrals/ReferralRegisterSection.tsx) **`data-testid="referrals-register-ordering-disclosure"`**; canonical copy aligns with [product § registration ordering](../product/referrals.md#referral-registration-ordering-issue-121). Third-party verifier brief: [`manual-qa-checklists.md#manual-qa-issue-121-referrals-register-disclosure`](manual-qa-checklists.md#manual-qa-issue-121-referrals-register-disclosure).

**Automated coverage (not a substitute for full visual QA):**

| Checklist row | Playwright / unit | Notes |
|---------------|-------------------|--------|
| R1 Page renders (post-launch or no-env shell) | [`referrals-surface.spec.ts`](../../frontend/e2e/referrals-surface.spec.ts) | Skips countdown-only builds via [`launchState.ts`](../../frontend/e2e/launchState.ts). |
| R2 Empty / connected, unregistered | [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) | Anvil default account + DeployDev registry. |
| R3 Empty / disconnected | Manual or non-mock smoke | CI UI job uses injected-only wallets; expect “Connect a wallet” when env has a resolvable registry. |
| R4 Register flow | `anvil-referrals.spec.ts` | Approve + `registerCode`; post-register UX implies **`localStorage`** under **`yieldomega.myrefcode.v1.<wallet>`** (not `yieldomega.ref.v1`). |
| R5 Post-register links | `anvil-referrals.spec.ts` | “Your share links” panel. |
| R6 Copy / share | `anvil-referrals.spec.ts` | `clipboard-read` / `clipboard-write` permission grant; **success:** inline **“Copied to clipboard!”** (`.status-pill--success`, `data-testid="referrals-copy-feedback"`, ~`REFERRAL_COPY_BANNER_MS` in [`referralShareCopyFeedback.ts`](../../frontend/src/pages/referrals/referralShareCopyFeedback.ts)) + **Copy → Copied!** on the row button; **repeat copy** refreshes the same confirmation (not silent on double-click). **Failure:** `StatusMessage` error strings from the same module — [issue #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86). |
| R7 `?ref=` / path capture | `referrals-surface.spec.ts` + [`referral-path.spec.ts`](../../frontend/e2e/referral-path.spec.ts) | Asserts **`yieldomega.ref.v1`** pending JSON (`localStorage` / path flow); path segment variant on `/timecurve/{code}`. |
| R121 Register disclosure (**#121**) | [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) | Asserts **`referrals-register-ordering-disclosure`** is visible in the connected unregistered path (before **Register & burn CL8Y** — same setup as **R4** preamble). |

**Manual QA (agents walking the checklist):** [`manual-qa-checklists.md#manual-qa-issue-64`](manual-qa-checklists.md#manual-qa-issue-64) · GitLab [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64).

<a id="referrals-leaderboard-and-earnings-issue-94"></a>

### Referrals — indexer leaderboard + wallet earnings (issue #94)

**Intent:** `/referrals` may show an **indexer-backed referrer leaderboard** and a **per-wallet CHARM summary** without fabricating metrics. Ranks and sums must come from **`idx_timecurve_referral_applied`** / the HTTP routes in [product/referrals.md — dashboard §](../product/referrals.md#referrals-dashboard-issue-94). **CL8Y / USDM / ETH “notional”** lines on the page are **illustrative** (current `currentPricePerCharmWad` × combined indexed referral CHARM, plus fallback pay-asset multipliers) — not tax, legal, or treasury advice.

| Invariant | Meaning |
|-----------|---------|
| Leaderboard ordering | **`GET /v1/referrals/referrer-leaderboard`** sorts by **Σ `referrer_amount`** descending, then **`referrer ASC`** for deterministic pagination when totals tie ([GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170) · **`INV-INDEXER-170-REFERRAL-LB-TIE`**). |
| Wallet row | **`GET /v1/referrals/wallet-charm-summary`** returns string integer **wei** totals for referrer vs referee CHARM splits. |
| Schema | Indexer **`x-schema-version`** bumped with new routes (see `indexer/src/api.rs`). |

**Implementation:** [`ReferralLeaderboardSection.tsx`](../../frontend/src/pages/referrals/ReferralLeaderboardSection.tsx), [`ReferralProgramEarningsSection.tsx`](../../frontend/src/pages/referrals/ReferralProgramEarningsSection.tsx), [`ReferralConnectedWalletSection.tsx`](../../frontend/src/pages/referrals/ReferralConnectedWalletSection.tsx); API: [`indexerApi.ts`](../../frontend/src/lib/indexerApi.ts). **Local swarm:** `timecurve-bot swarm` registers a shared code from HD index **`27`** when **`YIELDOMEGA_SWARM_REFERRALS≠0`** and sets **`YIELDOMEGA_REFERRAL_CODE`** for worker buys — [`swarm_layout.py`](../../bots/timecurve/src/timecurve_bot/swarm_layout.py), [`referral_bootstrap.py`](../../bots/timecurve/src/timecurve_bot/referral_bootstrap.py).

---

<a id="timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68"></a>

### TimeCurve frontend — Album 1 BGM + SFX bus (issue #68) and BGM resume (issue #71)

**Intent:** One **Web Audio** graph serves **Blockie Hills** BGM (streaming MP3) and decoded **SFX** buses. **#68** shipped autoplay attempt, gesture unlock, mix prefs in **`yieldomega:audio:v1:prefs`**, and TimeCurve / global UI wiring. **#71** adds **playback resume**: same key namespace, **`playbackState`** JSON, **track id** reconciliation if the manifest changes, **7-day** staleness (offset only), **≥4s** coalesced writes while playing, and synchronous flush on **pause**, **skip**, **natural `ended`**, **`visibilitychange` → hidden**, **`pagehide` / `beforeunload`**.

<a id="mobile-album-dock-layout-issue-103"></a>

**INV-AUDIO-103 — Mobile dock vs nav chrome ([GitLab #103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103)):** The **`AlbumPlayerBar`** shell uses **`position: fixed`** (`z-index: 1050`, `.album-player-dock`). On **`max-width: 720px`**, the bordered **`RootLayout`** **`.app-header`** gains **`margin-top: max(0.75rem, calc(env(safe-area-inset-top, 0px) + 4.5rem))`** so the menu card sits **below** the dock bubble — no overlap with typical phone widths. **`top` / `right` offsets on the dock** stay as in **#68**; **tablet/desktop** (`min-width: 721px`) header rhythm is unchanged. Token: [`mobileAlbumDockLayout.ts`](../../frontend/src/audio/mobileAlbumDockLayout.ts) (`MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM` **must** match **`index.css`**). **Bidirectional parity:** Vitest reads **`frontend/src/index.css`** and asserts the **`env(safe-area-inset-top, 0px) + Nrem`** margin term equals the exported constant ([GitLab #107](https://gitlab.com/PlasticDigits/yieldomega/-/issues/107)) so CSS-only drift fails CI. **Doc routing ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)):** Procedural verification is anchored at [manual QA #103](manual-qa-checklists.md#manual-qa-issue-103) only; [`skills/contributor-mobile-album-dock/SKILL.md`](../../skills/contributor-mobile-album-dock/SKILL.md) is optional implementation detail, not a parallel maintainer checklist — see [Agents: metadata and skills](../agents/metadata-and-skills.md#contributor-manual-qa-not-play-skills).

<a id="timecurve-sfx-buy-warbow-issue-108"></a>

**INV-AUDIO-68-WIRE — Buy submit coin + Arena WarBow twang ([#68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68), inventory [#108](https://gitlab.com/PlasticDigits/yieldomega/-/issues/108)):** **`coin_hit_shallow`** fires once **`writeContractAsync` resolves** with a hash for **`TimeCurve.buy`** or **`buyViaKumbaya`** (**before** `waitForTransactionReceipt`) — **`playGameSfxCoinHitBuySubmit`** (`useTimeCurveSaleSession`, `useTimeCurveArenaModel`, **`timeCurveKumbayaSingleTx.ts`**). **`warbow_twang`** uses **`playWarbowTwangThrottled`** (minimum spacing **18 s**) per **`shouldPlayWarbowRankStinger`** ([`warbowRankSfxPolicy.ts`](../../frontend/src/audio/warbowRankSfxPolicy.ts)) — **indexed top‑3 podium** entry or moves **among ranks ≤3** (**not** non‑podium rank drifts like **10 → 4** · **Vitest:** [`warbowRankSfxPolicy.test.ts`](../../frontend/src/audio/warbowRankSfxPolicy.test.ts)). **`kumbaya_whoosh`** stays **off** prefetch / hot quoter paths until pay‑mode wiring ships ([#68 discussion](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68)).

| Invariant | Meaning | Automated / manual |
|-----------|---------|-------------------|
| Graph + buses | `WebAudioMixer`: `bgmGain` + `sfxGain` → `masterGain` → destination | Code review |
| Autoplay + unlock | Matches #68: first pointer may unlock + start BGM | Manual Chromium / Firefox |
| **Resume offset** | After **`loadedmetadata`**, apply saved **`currentTime`** before **`play()`** so autoplay-blocked sessions still resume on first gesture | Manual |
| **Throttle** | No periodic **localStorage** writes faster than **`AUDIO_PLAYBACK_PERIODIC_SAVE_MS`** (~4s) during steady playback | Manual timer or unit gate (`createMinIntervalGate`) |
| **Skip / end** | Next track always starts at **0:00** in storage and on element | Manual |
| **Dock title** | Initial React **`trackIndex`** reads **`loadAudioPlaybackState`** in sync with **`WebAudioMixer`** hydrate | Manual refresh mid-album |
| **Mobile clearance (#103)** | **`INV-AUDIO-103`**: narrow viewports clear dock vs **`.app-header`** via scoped **`margin-top`**; **`MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM`** ↔ **`index.css`** (TS ↔ CSS parity [#107](https://gitlab.com/PlasticDigits/yieldomega/-/issues/107)) | Vitest [`mobileAlbumDockLayout.test.ts`](../../frontend/src/audio/mobileAlbumDockLayout.test.ts); manual [#103](manual-qa-checklists.md#manual-qa-issue-103) |
| **SFX — buy + WarBow wire (#68 / #108)** | **`INV-AUDIO-68-WIRE`**: **`coin_hit`** on **`buy` / `buyViaKumbaya` hash**; **`warbow_twang`** throttled podium policy only (`warbowRankSfxPolicy`); **`kumbaya_whoosh`** not prefetched until wired | Vitest [`warbowRankSfxPolicy.test.ts`](../../frontend/src/audio/warbowRankSfxPolicy.test.ts); manual [#68 / #108 SFX checklist](manual-qa-checklists.md#manual-qa-sfx-coin-warbow-108) |

**Unit tests:** [`audioPlaybackState.test.ts`](../../frontend/src/audio/audioPlaybackState.test.ts) (`normalizePlaybackState`, save/load, stale TTL, throttle gate), [`albumPlaylist.test.ts`](../../frontend/src/audio/albumPlaylist.test.ts) (`id` + `durationSec` on tracks), [`mobileAlbumDockLayout.test.ts`](../../frontend/src/audio/mobileAlbumDockLayout.test.ts) (**#103** clearance token + **#107** CSS literal parity), [`warbowRankSfxPolicy.test.ts`](../../frontend/src/audio/warbowRankSfxPolicy.test.ts) (**#68** / **#108** Arena podium stinger predicate).

**Manual QA (agents):** [`manual-qa-checklists.md#manual-qa-issue-71`](manual-qa-checklists.md#manual-qa-issue-71) · GitLab [#71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71); dock vs nav [**#103**](manual-qa-checklists.md#manual-qa-issue-103); SFX coin + podium twang [**#68 / #108**](manual-qa-checklists.md#manual-qa-sfx-coin-warbow-108).

**Product / UX doc:** [sound-effects-recommendations §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) · GitLab [#68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68) · mobile clearance [#103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103).

---

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
| **CL8Y value of DOUB per CHARM (no referral)** | **Product invariant:** On the **non-referral** buy path, **implied CL8Y per DOUB** (`totalRaised / totalTokensForSale`) **increases** stepwise; **DOUB per unit `charmWeight`** **decreases** as `totalCharmWeight` grows; the **CL8Y value of DOUB per CHARM** **does not decrease** through the sale. **Referral** CHARM is out of scope. | Doc: [primitives](../product/primitives.md#timecurve-redemption-cl8y-density-no-referral); UX projection: [`projectedReservePerDoubWad`](../../frontend/src/lib/timeCurvePodiumMath.ts) |
| **Launch-anchor 1.275× rule** <a id="timecurve-launch-anchor-gitlab-158"></a> | **Product invariant (DOUB/CL8Y locked LP):** `DoubLPIncentives` seeds DOUB/CL8Y locked liquidity at **1.275× the per-CHARM clearing price** (**27.5%** above final clearing — fixed-point `× 1275 / 1000` in [`timeCurvePodiumMath.ts`](../../frontend/src/lib/timeCurvePodiumMath.ts)), so a participant's CHARM is projected to be worth **`charmWeightWad × pricePerCharmWad × 1275 / (1000 × 1e18)`** CL8Y wei at launch. **Worked example:** if the final buyer pays `2 CL8Y` for `1 CHARM` and `1 CHARM` redeems for `100 DOUB`, those `100 DOUB` are worth **`2 × 1.275 = 2.55 CL8Y`** at launch — the DOUB count drops out because dilution and pricing are dual sides of the same anchor. The number is **non-decreasing** during the sale because the per-CHARM price (e.g. `LinearCharmPrice`) is non-decreasing in elapsed time, so participant-facing UX should **show CL8Y-at-launch and hide the DOUB count**. | Helpers: [`launchLiquidityAnchorWad`](../../frontend/src/lib/timeCurvePodiumMath.ts), [`participantLaunchValueCl8yWei`](../../frontend/src/lib/timeCurvePodiumMath.ts); tests: `frontend/src/lib/timeCurvePodiumMath.test.ts` (`launch-anchor invariant: launch price = final per-CHARM price × 1.275`); policy: [`docs/onchain/fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md), [`contracts/src/sinks/DoubLPIncentives.sol`](../../contracts/src/sinks/DoubLPIncentives.sol), [`launchplan-timecurve.md`](../../launchplan-timecurve.md); product change [GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158) |
| **Scheduled sale anchor (`startSaleAt`) ([issue #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114))** <a id="timecurve-startsaleat-issue-114"></a> | **`onlyOwner` `startSaleAt(epoch)`** once while **`saleStart == 0`**. **`epoch != 0`**, **`epoch >= block.timestamp`**, **`launchedToken` balance ≥ `totalTokensForSale`**. Sets **`saleStart = epoch`**, **`deadline = min(epoch + initialTimerSec, epoch + MAX_SALE_ELAPSED_SEC + 1)`** (GitLab #124 hard sale wall). Emits **`SaleStarted(epoch, deadline, totalTokensForSale)`** (shape unchanged). Reverts **`"TimeCurve: already started"`**, **`"TimeCurve: insufficient launched tokens"`**, **`"TimeCurve: invalid epoch"`**, **`"TimeCurve: epoch in past"`**. **`buy`** / **`buyFor`** / **WarBow CL8Y txs** / **`claimWarBowFlag`** require **`block.timestamp >= saleStart`** or revert **`"TimeCurve: sale not live"`**. **`currentMinBuyAmount`**, **`currentCharmBoundsWad`**, **`currentPricePerCharmWad`** (and **`currentMaxBuyAmount`**) treat elapsed time as **0** until **`block.timestamp >= saleStart`** (**`_elapsedForCharmPricing`**). **`endSale`** requires **`block.timestamp > deadline()`** ([GitLab #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136) / **[#136](#timecurve-round-deadline-inclusive-warbow-gitlab-136)**). Deploy scripts (**`DeployDev`** / drills) continue to use **`startSaleAt(block.timestamp)`** for “start now” parity. | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): `test_startSaleAt_now_sets_saleStart_and_deadline`, `test_startSaleAt_reverts_twice`, `test_startSale_insufficient_launched_tokens_reverts`, `test_startSaleAt_reverts_for_non_owner`, `test_startSaleAt_reverts_when_epoch_zero`, `test_startSaleAt_reverts_when_epoch_in_past`, `test_startSaleAt_future_epoch_buys_revert_until_live`, `test_buy_reverts_sale_not_live_when_start_scheduled_future`, `test_gitlab124_startSaleAt_uses_min_of_initial_timer_and_hard_cap`; [timecurve-views — #114](../frontend/timecurve-views.md#scheduled-sale-start-onsalestartsaleat-issue-114) |
| **300-day sale wall + pricing plateau ([issue #124](https://gitlab.com/PlasticDigits/yieldomega/-/issues/124))** <a id="timecurve-max-sale-elapsed-gitlab-124"></a> | **`MAX_SALE_ELAPSED_SEC = 300 × 86400`**. **`buy` / `buyFor`** and **`claimWarBowFlag` / `warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** require **`block.timestamp <= saleStart + MAX_SALE_ELAPSED_SEC`** (inclusive last second at the wall — GitLab #124). With **`deadline`** typically clamped to **`saleStart + MAX_SALE_ELAPSED_SEC + 1`** after buys near the cap, the wall-clock cap and configurable **round timer** stay aligned (**[#136](#timecurve-round-deadline-inclusive-warbow-gitlab-136)**). **`_elapsedForCharmPricing`** (views + buy path) **caps** elapsed at **`MAX_SALE_ELAPSED_SEC`**. **`initialize`** requires **`initialTimerSec`**, **`timerCapSec` ≤ **`MAX_SALE_ELAPSED_SEC`**. **`LinearCharmPrice.initialize`** rejects **`dailyIncrementWad`** too large for a **300-day** plateau vs **`basePriceWad`**. TS chart helpers cap in **`timeCurveMath.ts`** (**`MAX_SALE_ELAPSED_SEC`**, **`capElapsedForSalePricing`**). | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) (`test_gitlab124_*`); [`LinearCharmPrice.t.sol`](../../contracts/test/LinearCharmPrice.t.sol) (`test_gitlab124_initialize_increment_too_large_reverts`); [`timeCurveMath.test.ts`](../../frontend/src/lib/timeCurveMath.test.ts) |
| **Inclusive round `deadline()` + WarBow cutoff ([issue #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136))** <a id="timecurve-round-deadline-inclusive-warbow-gitlab-136"></a> | **`buy` / `buyFor`** and **`claimWarBowFlag` / `warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** require **`block.timestamp <= deadline()`** (inclusive last second of the **round countdown** timer; overlaps [`#124`](#timecurve-max-sale-elapsed-gitlab-124) where both apply). Revert **`"TimeCurve: timer expired"`** when **`block.timestamp > deadline()`**. **`endSale`** requires **`block.timestamp > deadline()`** (**`"TimeCurve: timer not expired"`** otherwise) so **`endSale`** cannot land in the same second as a timer-valid buy/WarBow touch. **`TimeCurveBuyRouter.buyViaKumbaya`** fails closed only when **`block.timestamp > deadline()`**. **Frontend **`derivePhase`:** **`saleExpiredAwaitingEnd`** iff **`ledgerSecInt > deadlineSec`** (mirrors **`endSale`**, not the strict **`>=`** cutoff). Fixes **Finding 6** from [GitLab #131](https://gitlab.com/PlasticDigits/yieldomega/-/issues/131) (WarBow mutations in **post-round-timer**, pre-**`endSale`** limbo when **`ended`** was still false — `ended` flipped only via **`endSale`**). Play + contributor cross-links: [timecurve-views — #136](../frontend/timecurve-views.md#inclusive-round-deadline-issue-136); [`skills/play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md). | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) (`test_buy_succeeds_at_deadline_second`, `test_end_sale_reverts_until_strictly_after_deadline`, `test_gitlab136_warbow_steal_reverts_when_past_deadline_before_endsale`); [`VerifyTimeCurveBuyRouterAnvil.t.sol`](../../contracts/test/VerifyTimeCurveBuyRouterAnvil.t.sol); [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts) |
| Happy-path buy | Valid buy updates CHARM weight and `totalRaised` | `test_buy_basic` |
| **`buyFor` / companion router (issue #65)** | Only **`timeCurveBuyRouter`** may call **`buyFor`**; CL8Y **`transferFrom(payer)`** with payer = router; CHARM weight, WarBow, cooldown, referrals use **`buyer`**. Immutable **`TimeCurveBuyRouter`**: recomputes gross CL8Y from TimeCurve views, validates packed path (CL8Y first, WETH or `stableToken` last), **`exactOutput`**, then **`buyFor`**. **`buyViaKumbaya`** sale-phase guard includes **`block.timestamp >= saleStart()`** once scheduled (**[#118](#timecurve-buy-router-buyviakumbaya-sale-live-fail-fast-gitlab-118)**). | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) (`test_buyFor_*`); [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) · **`TimeCurveBuyRouterScheduledNotLive118Test`** ([#118](#timecurve-buy-router-buyviakumbaya-sale-live-fail-fast-gitlab-118)) |
| Per-wallet buy cooldown | Second buy before `nextBuyAllowedAt` reverts **`"TimeCurve: buy cooldown"`**; boundary at `nextBuyAllowedAt` succeeds; wallets independent | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): cooldown / boundary / two-wallet tests; handler respects cooldown in [`TimeCurveInvariant.t.sol`](../../contracts/test/TimeCurveInvariant.t.sol) |
| **Forge dev scripts — chain allowlist ([GitLab #141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141))** <a id="forge-dev-scripts-chain-allowlist-gitlab-141"></a> | **`INV-DEVSCRIPT-141`:** **`DeployDev.s.sol`**, **`DeployKumbayaAnvilFixtures.s.sol`**, **`AnvilSameBlockDrill.s.sol`**, and **`SimulateAnvilRichState.s.sol`** (all `run()` targets) call **`DevOnlyChainGuard.assertDevScriptChain()`** first. **Allowed:** **31337** (Anvil default), **6343** (MegaETH testnet — [`contracts/README.md`](../../contracts/README.md) RPC table), **6342** (legacy id, e.g. [`indexer/.env.example`](../../indexer/.env.example)). **Disallowed:** **4326** (MegaETH mainnet) and every other chain id — a wrong **`--rpc-url`** must not broadcast **`MockReserveCl8y`** and **dev gate** wiring using a production key. **Production** deployments must use maintainer **production** scripts and runbooks, not these convenience entrypoints. | [`DevOnlyChainGuard.t.sol`](../../contracts/test/DevOnlyChainGuard.t.sol); [e2e-anvil.md — chain guard](e2e-anvil.md#forge-dev-scripts-chain-allowlist-gitlab-141) |
| **DeployDev buy cooldown env** <a id="deploydev-buy-cooldown-env-issue-88"></a> | **`DeployDev`** must still default to **`buyCooldownSec = 300`** when QA flags are unset. Optional **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** → initializer uses **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** default **1** (seconds). Optional explicit **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** in either branch (**must be &gt; 0** — **`TimeCurve`** rejects zero at init). Resolver is single-source in [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol). | [`DeployDevBuyCooldown.t.sol`](../../contracts/test/DeployDevBuyCooldown.t.sol) (`test_readBuyCooldownSec_env_resolution_matrix`, `test_constants_match_documented_defaults`) |
| **Bot swarm + Anvil interval mining + cooldown guidance** <a id="bot-swarm-anvil-interval-mining-issue-99"></a> | [GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99): With **`SKIP_ANVIL_RICH_STATE=1`**, **`START_BOT_SWARM`** defaults **on**. **Per-wallet `buyCooldownSec`** (default **300**) + **pure automine** (**no txs ⇒ no new blocks ⇒ frozen `block.timestamp`**) stalled bots that **`sleep` until `nextBuyAllowedAt`**. **Mitigations (local only):** (1) [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) starts Anvil with **`--block-time`** when it spawns the node (**`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC`**, default **12**; **`0`** disables interval mining). (2) Operators should set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** when they want **dense** continuous **`Buy`** traffic without long wall-clock gaps — see [#88](#deploydev-buy-cooldown-env-issue-88). **Non-Anvil / production bot code is unchanged** (no auto `evm_increaseTime`). Reusing a **pre-existing** RPC on the swarm port skips **`--block-time`** — script warns. | Manual + script header; manual QA checklist [`manual-qa-checklists.md#manual-qa-issue-99`](manual-qa-checklists.md#manual-qa-issue-99); [e2e-anvil.md — swarm + chain time](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99) |
| Min / max gross spend monotonic | `currentMinBuyAmount` / `currentMaxBuyAmount` increase with time (envelope × price) | `test_minBuy_grows_over_time` |
| CHARM bounds ratio | `10 × minCharm` and `0.99 × maxCharm` match within **floor-division slack** (shared envelope factor) | `test_charmBounds_ratio_10_over_099_fuzz` |
| CHARM bounds exponential scale | Min/max CHARM ~20%/day with canonical `growthRateWad` | `test_charmBounds_scale_approx_20_percent_per_day` |
| Purchase bounds (CHARM WAD) | Each buy in `[currentCharmBoundsWad.min, .max]` | `test_buy_below_minBuy_reverts`, `test_buy_above_cap_reverts`, `test_buy_charmWad_in_bounds_fuzz` |
| **`currentCharmBoundsWad` degenerate storage ([issue #73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73))** | If **`initialMinBuy == 0`** (uninitialized **implementation** / wrong storage), **`currentCharmBoundsWad`** returns the **base CHARM band** **`(0.99e18, 10e18)`** instead of **panic 0x12** (div-by-zero in `_charmBounds`). **Initialized proxy** behavior is unchanged. | `test_currentCharmBoundsWad_zero_initialMinBuy_returns_base_envelope` |
| **<a id="ts-charm-envelope-ref-zero-issue-109"></a>TS CHARM envelope mirror — `ref === 0n` ([issue #109](https://gitlab.com/PlasticDigits/yieldomega/-/issues/109))** | Chart/UI helpers **`minCharmWadAt`**, **`maxCharmWadAt`**, **`minCharmWadAtFloat`**, **`maxCharmWadAtFloat`** in [`timeCurveMath.ts`](../../frontend/src/lib/timeCurveMath.ts) must **not** throw on **`charmEnvelopeRefWad === 0n`** (JS **`RangeError: Division by zero`**); they return **`CHARM_MIN_BASE_WAD`** / **`CHARM_MAX_BASE_WAD`** in lockstep with **`_charmBounds`** ([#61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61) / [#73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73)). **Elapsed** inputs are **capped** at **`MAX_SALE_ELAPSED_SEC`** to mirror **`TimeCurve._elapsedForCharmPricing`** ([#124](#timecurve-max-sale-elapsed-gitlab-124)). Onchain reads and buys still require the **ERC1967 proxy**. | [`timeCurveMath.test.ts`](../../frontend/src/lib/timeCurveMath.test.ts) (`CHARM bounds mirror vs TimeCurve._charmBounds (ref === 0)`), **`capElapsedForSalePricing`** / **`linearPriceWad`** plateau ([#124](#timecurve-max-sale-elapsed-gitlab-124)) |
| Spend formula | `amount = charmWad × pricePerCharmWad / WAD`; `totalRaised` += `amount` | `test_buy_charmWad_in_bounds_fuzz`, `test_linear_price_per_charm_independent_of_envelope` |
| Linear price schedule | `LinearCharmPrice.priceWad` matches `base + daily×elapsed/86400`; monotone in `elapsed`; initializer rejects increment too large for **300** sale-day plateau ([#124](#timecurve-max-sale-elapsed-gitlab-124)) | [`LinearCharmPrice.t.sol`](../../contracts/test/LinearCharmPrice.t.sol): `test_priceWad_linear_matches_formula_fuzz`, `test_priceWad_monotonic_in_elapsed_fuzz`, `test_constructor_zero_base_reverts`, `test_gitlab124_initialize_increment_too_large_reverts` |
| Price decoupled from envelope | With `growthRateWad = 0`, CHARM bounds flat while `currentPricePerCharmWad` still ramps linearly | `test_linear_price_per_charm_independent_of_envelope` |
| Timer extension capped | Extended deadline respects `timerCapSec` | `test_timer_extends_on_buy`, `test_timer_cap_fuzz` |
| Sale state machine | No buy before start / after end / after timer expiry | `test_buy_not_started_reverts`, `test_buy_after_end_reverts`, `test_buy_after_timer_expires_reverts` |
| `endSale` gating | Not before start; not twice | `test_endSale_not_started_reverts`, `test_endSale_already_ended_reverts` |
| End + redemption | Sale can end; user redeems once | `test_endSale_and_claim`, `test_redeemCharms_reverts_before_end`, `test_double_redeem_reverts` |
| **Unredeemed launched-token sweep ([issue #128](https://gitlab.com/PlasticDigits/yieldomega/-/issues/128))** <a id="timecurve-unredeemed-launch-allocation-sweep-gitlab-128"></a> | **`endSale`** sets **`saleEndedAt`**. **`onlyOwner` `sweepUnredeemedLaunchedToken`** transfers the full **`launchedToken` `balanceOf(TimeCurve)`** to **`unredeemedLaunchedTokenRecipient`** iff **`ended`**, **`block.timestamp >= saleEndedAt + UNREDEEMED_LAUNCHED_TOKEN_GRACE_SEC`** (**7 days**), recipient **non-zero**, balance **non-zero**. **`repairSaleEndedAt(ts)`** — **once**, when **`saleEndedAt == 0`** and **`ended`**, for UUPS backfill. **`INV-INDEXER-128`:** **`UnredeemedLaunchedTokenRecipientSet`** / **`UnredeemedLaunchedTokenSwept`** → **`idx_timecurve_unredeemed_launched_token_*`**. **SQLx migrations:** `indexer/migrations/20260504180000_timecurve_unredeemed_launched_token` ships **paired** **`.up.sql`** / **`.down.sql`** so **`sqlx migrate revert`** can drop and re-apply the schema step without manual **`_sqlx_migrations`** edits ([GitLab #152](https://gitlab.com/PlasticDigits/yieldomega/-/issues/152)). | `test_sweepUnredeemedLaunchedToken_after_grace_to_governance`, `test_sweepUnredeemedLaunchedToken_reverts_*`, `test_repairSaleEndedAt_reverts_when_already_set`; [primitives §128](../product/primitives.md#unredeemed-launch-allocation-sweep-gitlab-128), [fee routing §128](../onchain/fee-routing-and-governance.md#timecurve-unredeemed-launch-allocation-gitlab-128) |
| **Value-movement gates (issue #55)** | `buy` + WarBow CL8Y + `redeemCharms` + non-zero `distributePrizes` respect `onlyOwner` flags; [`DeployDev`](../../contracts/script/DeployDev.s.sol) enables post-end flags for local E2E; **post-end `cast` walkthrough** for disabled-gate reverts: [issue #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79), `ANVIL_RICH_END_SALE_ONLY=1` + [`verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) | `test_redeemCharms_reverts_while_charm_redemption_disabled`, `test_distributePrizes_reverts_while_reserve_podium_payouts_disabled`, `test_buy_reverts_when_sale_interactions_disabled`, `test_warbow_cl8y_burns_revert_when_sale_interactions_disabled`; [final-signoff runbook](../operations/final-signoff-and-value-movement.md) |
| **`distributePrizes` execution (issue #70)** | **`TimeCurve.distributePrizes`** is **`onlyOwner`** (manual review of the **execution** tx, not only `reservePodiumPayoutsEnabled`). Non-owner reverts. | `test_distributePrizes_reverts_for_non_owner` |
| Redemption rounding | Integer redeem can be zero (tiny sale supply vs raised) | `test_redeemCharms_nothing_to_redeem_reverts` |
| Fees to router | Buy path pulls from buyer and routes via `FeeRouter` | `test_fees_routed_on_buy` |
| Same-block call order | Last-buyer podium reflects sequential buy order (Foundry single-tx context; aligns with tx-index ordering) | `test_sameBlock_buyOrder_lastBuyerReflectsSecondCall` |
| **`distributePrizes` empty `PodiumPool` ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133))** | **`reservePodiumPayoutsEnabled`** required; emits **`PrizesSettledEmptyPodiumPool`**, sets **`prizesDistributed`** (**no** **`PrizesDistributed`**, **no** refill/retry). Second call reverts **`prizes done`**. | `test_distributePrizes_empty_vault_emits_empty_settlement_and_locks`, `test_distributePrizes_empty_pool_reverts_when_reserve_podium_payouts_disabled`; [§ **`INV-TIMECURVE-133-*`**](#timecurve-empty-podium-pool-settlement-gitlab-133) |
| Podium payout happy path | Podium pool balance decreases after distribution; flag set; emits **`PrizesDistributed`** | `test_distributePrizes_reduces_vault_and_sets_flag` |
| **Podium push auth (issue #70)** | Production: **`PodiumPool.setPrizePusher(TimeCurve)`** once; then **`payPodiumPayout`** only accepts **`msg.sender == prizePusher`** (legacy **`DISTRIBUTOR_ROLE`** path when `prizePusher` unset — tests / migration). | [`FeeSinks.t.sol`](../../contracts/test/FeeSinks.t.sol): `test_podiumPool_payPodiumPayout_prize_pusher_wins_over_distributor_role` |
| Constructor sanity | Non-zero asset, router, `launchedToken`, `podiumPool`, **`ICharmPrice`** | `test_constructor_zero_acceptedAsset_reverts`, `test_constructor_zero_feeRouter_reverts`, `test_constructor_zero_launchedToken_reverts`, `test_constructor_zero_podiumPool_reverts`, `test_constructor_zero_charmPrice_reverts` |
| Referral CHARM | Full gross to router; referee + referrer CHARM from `charmWad`; **`plantWarBowFlag` passthrough** on `buy(charmWad, codeHash, plant)` ([issue #77](https://gitlab.com/PlasticDigits/yieldomega/-/issues/77)) | [`TimeCurveReferral.t.sol`](../../contracts/test/TimeCurveReferral.t.sol): `test_buy_with_referral_charms_and_full_gross_to_fee_router`, `test_buy_self_referral_reverts`, `test_buy_invalid_code_reverts`, `test_referral_buy_with_plant_false_does_not_plant`, `test_referral_buy_with_plant_true_plants` |
| Referral path capture (read client) | `?ref=` and allowed path shapes normalize with `ReferralRegistry` rules; reserved app path segments are not treated as codes | [`referralPathCapture.test.ts`](../../frontend/src/lib/referralPathCapture.test.ts) |
| **Referrals `/referrals` surface (issue #64, **#121**, #85, #86, launch F-11 #91, #94, #155)** | Branded shell + registry section invariants: either resolvable registry (reads + register UX) or explicit **unconfigured** messaging; pending `?ref=` / path capture stays consistent with [product/referrals.md](../product/referrals.md). **`/referrals`** is **not** documented as **`UnderConstruction`** in [`launchplan-timecurve.md`](../../launchplan-timecurve.md) [**F-11** / `YO-DOUB-Launch-UX-Flows.md`](../../YO-DOUB-Launch-UX-Flows.md). **Registration ordering ([issue #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121)):** first **`registerCode`** success wins the slug — [§ **#121**](#referral-registration-ordering-issue-121); **`INV-REFERRAL-121-UX`** (pre-submit disclosure + `referrals-register-ordering-disclosure`). **Wallet session drift ([GitLab #155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155)):** **`INV-REFERRAL-SESSION-155`** — **`captureWalletBuySession` / `assertWalletBuySessionUnchanged`** on **`ReferralRegisterSection`** **`registerCode`** flow (same user-visible string as [#144](#timecurve-buy-wallet-session-drift-gitlab-144)) — [§ **#155**](#referral-registration-wallet-session-drift-gitlab-155). **Storage keys ([issue #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)):** pending **`yieldomega.ref.v1`** (local + session) vs my-code **`yieldomega.myrefcode.v1.<wallet>`** (local only). **Share-link copy ([issue #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)):** visible success/error feedback, not silent no-ops. **Indexer leaderboard + wallet CHARM ([issue #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94)):** `GET /v1/referrals/referrer-leaderboard` / `GET /v1/referrals/wallet-charm-summary` + `/referrals` panels stay aligned with [product dashboard §](../product/referrals.md#referrals-dashboard-issue-94). | [§ Referrals page visual — issue #64](#referrals-page-visual-issue-64); [§ referral registration ordering — **#121**](#referral-registration-ordering-issue-121); [§ referral registration session drift — **#155**](#referral-registration-wallet-session-drift-gitlab-155); [§ Referrals leaderboard + earnings — issue #94](#referrals-leaderboard-and-earnings-issue-94); [`referrals-surface.spec.ts`](../../frontend/e2e/referrals-surface.spec.ts); [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) |
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

- **WarBow pending-flag plant opt-in ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63), [issue #77](https://gitlab.com/PlasticDigits/yieldomega/-/issues/77))** — Referral entry `buy(..., codeHash, plant)` and router `buyFor(buyer, ..., plant)` must forward `plantWarBowFlag` so the **buyer** (not router) owns `warbowPendingFlag*` when `plant=true`, and leave the slot cleared when `plant=false` — `test_referral_buy_with_plant_false_does_not_plant`, `test_referral_buy_with_plant_true_plants` ([`TimeCurveReferral.t.sol`](../../contracts/test/TimeCurveReferral.t.sol)); `test_buy_for_with_plant_false_does_not_plant`, `test_buy_for_with_plant_true_plants` ([`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol))
- Base BP flat per buy — `test_warbow_base_bp_flat_per_buy_independent_of_charm_wad`
- BP top-3 snapshot ordering — `test_warbow_ladder_podium_orders_by_battle_points`
- Timer hard reset + ambush stacking — `test_timer_hard_reset_below_13m_and_ambush_bonus`
- Steal path — `test_warbow_steal_drains_ten_percent_and_burns_one_reserve`, `test_warbow_steal_revert_2x_rule`, `test_warbow_steal_burn_is_one_cl8y_wad`
- Revenge — `test_warbow_revenge_once`

<a id="timecurve-warbow-cl8y-burns-issue-70"></a>

**WarBow CL8Y burns — user-driven, sink-exact (issue #70)** — *Approved policy exception: public **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** pull CL8Y from the caller and forward **fixed WAD** amounts to **`0x…dEaD`** in the same transaction; **`claimWarBowFlag`** has no CL8Y leg.* **`msg.sender`** must **not** be **`BURN_SINK`** (**[`INV-WARBOW-123-BURN-CALLER`](#inv-warbow-123-burn-caller)** — complement to ERC20 parity on the pull leg, [GitLab #123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)). Fuzz / regression: [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) (`testFuzz_warbow_guard_burn_exact_to_sink`, `testFuzz_warbow_steal_burn_exact_to_sink`, `testFuzz_warbow_revenge_burn_exact_to_sink`, **`test_warbow_*_reverts_when_caller_is_burn_sink`**). Play skill: [`skills/play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md). [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70) · [CL8Y flow audit](../onchain/cl8y-flow-audit.md).

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
| Fee-on-transfer ingress | [`NonStandardERC20.t.sol`](../../contracts/test/NonStandardERC20.t.sol) (`test_feeOnTransfer_*`), [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) `TimeCurveBuyRouterStableIngress123Test` | `buy` / Burrow / referral register / stable **`buyViaKumbaya`** revert on **`balanceOf` parity** vs declared pull ([§ #123](#erc20-balance-delta-ingress-gitlab-123)). |
| Reverting transfer | `test_alwaysRevert_feeRouter_distributeReverts`, `test_alwaysRevert_rabbitTreasury_depositReverts` | Griefing / bad token. |
| Blocked recipient | `test_blockedSink_feeRouter_distributeReverts` | Token reverts when paying a chosen sink. |
| Rebasing (stub) | `test_rebasing_treasury_balanceCanDesyncFromTotalReserves` | Balance can diverge from `totalReserves`. |

Mitigations and product stance: [security-and-threat-model.md — Implementation notes](../onchain/security-and-threat-model.md#implementation-notes-contract-hardening).

<a id="rabbit-treasury-burrow-param-bounds-gitlab-119"></a>

### RabbitTreasury Burrow param bounds + `finalizeEpoch` liveness (GitLab [#119](https://gitlab.com/PlasticDigits/yieldomega/-/issues/119))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Governed curve envelope** | `c*` ∈ `(0, c_max]`; `alpha` ∈ `[0, 1)` (`alphaWad < WAD`); `beta` ∈ `(0, 10]`; `lambda` ∈ `(0, 1]`; `delta_max_frac` ∈ `(0, 0.20]` (WAD-scaled); mirrored at **`initialize`**. | [`RabbitTreasury.sol`](../../contracts/src/RabbitTreasury.sol), [`PARAMETERS.md`](../../contracts/PARAMETERS.md) § Rabbit Treasury |
| **Revert at setter, not only at finalize** | Illegal values rejected with **`RT: …`** stable strings; prevents reaching `BurrowMath: inner<=0` from **`alphaWad ≥ WAD`** via governance alone. | `test_setAlphaWad_reverts_when_not_strictly_below_wad`, `test_setCStarWad_reverts_out_of_envelope`, … |
| **`initialize` validation** | Proxy deploy with invalid curve params reverts (cheat schedules **`new ERC1967Proxy`**, not library-internal deploy). | `test_initialize_reverts_zero_cStar` |
| **Permissionless finalize after legal extremes** | Boundary-legal knob updates still allow **`finalizeEpoch`** on representative backing/supply. | `test_finalizeEpoch_succeeds_after_extreme_legal_params` |
| **Product framing** | **`epochId`** = rolling accounting windows — not "defer governance to next product epoch." | [`rabbit-treasury.md`](../product/rabbit-treasury.md#epochid-is-accounting-windows-not-a-multi-stage-product-roadmap), [`fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md#rabbit-treasury-repricing-parameters-gitlab-119) |

<a id="accesscontrol-zero-admin-deployments-gitlab-120"></a>

### AccessControl zero-admin deployment guard (GitLab [#120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120); audit L-03)

**INV-AC-ZERO-ADMIN-120:** Contracts that grant **`DEFAULT_ADMIN_ROLE`** from a caller-supplied **`admin`** in their **`initializer`** or **`constructor`** must **`require(admin != address(0), …)`** **before** any **`_grantRole(DEFAULT_ADMIN_ROLE, admin)`** (and before co-granted roles in the same block: **`WITHDRAWER_ROLE`**, **`GOVERNOR_ROLE`**, **`PARAMS_ROLE`**, **`PAUSER_ROLE`**, **`MINTER_ROLE`** as applicable). OpenZeppelin **`AccessControl._grantRole`** does not treat **`address(0)`** as invalid; a zero admin is an operator footgun that can brick governance.

| Surface | Revert prefix | Tests |
|---------|---------------|--------|
| **`FeeSink.__FeeSink_init`** (covers **`CL8YProtocolTreasury`**, **`DoubLPIncentives`**, **`EcosystemTreasury`**) | `FeeSink: zero admin` | [`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol) |
| **`PodiumPool.initialize`** | `PodiumPool: zero admin` | same |
| **`FeeRouter.initialize`** | `FeeRouter: zero admin` (runs **before** **`_setSinks`** — zero admin loses to this check, not sink validation) | same |
| **`RabbitTreasury.initialize`** | `RT: zero admin` | same |
| **`Doubloon` constructor** | `Doubloon: zero admin` | same |
| **`LeprechaunNFT` constructor** | `LeprechaunNFT: zero admin` | same |

Operator context: [fee-routing-and-governance.md — Governance actors](../onchain/fee-routing-and-governance.md#governance-actors). Third-party deployers: [skills/README.md](../../skills/README.md).

<a id="indexer-accesscontrol-deploy-footgun-gitlab-120"></a>

**INV-INDEXER-120-DEPLOY:** The indexer ingests **logs from txs that mined successfully**. A **`constructor`** / **`initializer`** that **`require`**s **`admin != address(0)`** (**[`INV-AC-ZERO-ADMIN-120`](#accesscontrol-zero-admin-deployments-gitlab-120)**) reverts **before** any **`event`** the indexer could store—there is **no** Postgres signal for “zero admin attempted.” Governance deploy safety is **Forge + broadcast evidence** ([`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol)), not **`idx_*` rows**. Operational docs: [`indexer/README.md`](../../indexer/README.md#accesscontrol-zero-admin-gitlab-120), [`docs/indexer/design.md`](../indexer/design.md#accesscontrol-zero-admin-gitlab-120).

<a id="frontend-accesscontrol-deploy-assumption-gitlab-120"></a>

**INV-FRONTEND-120-DEPLOY:** The SPA trusts **`VITE_*` registry addresses** and onchain **`readContract`** paths against **already-live** bytecode. It **does not** implement a standalone “is **`DEFAULT_ADMIN_ROLE`** held by a sane account?” preflight—the EVM boundary for **`INV-AC-ZERO-ADMIN-120`** is **deployment time**. Miswired env (wrong proxy, wrong chain) surfaces as **RPC reverts / empty reads**, not a dedicated indexer or UI badge. Contributor surface: [`docs/frontend/wallet-connection.md`](../frontend/wallet-connection.md#accesscontrol-zero-admin-deployment-gitlab-120), [manual QA — #120](manual-qa-checklists.md#manual-qa-issue-120-accesscontrol-zero-admin-derived-layers).

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
| Zero admin at initialize | `initialize(..., admin=0)` reverts before roles | [`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol) ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)) |
| Parameter governance | Burrow params update emits event; unauthorized reverts; **curve envelope** reverts ([GitLab #119](https://gitlab.com/PlasticDigits/yieldomega/-/issues/119)) | `test_params_update_emits_event`, `test_params_update_unauthorized_reverts`, `test_setMBounds_invalid_reverts`, `test_setCStarWad_reverts_out_of_envelope`, `test_setAlphaWad_reverts_when_not_strictly_below_wad`, `test_setBetaWad_reverts_out_of_envelope`, `test_setLamWad_reverts_out_of_envelope`, `test_setDeltaMaxFracWad_reverts_out_of_envelope`, `test_initialize_reverts_zero_cStar`, `test_finalizeEpoch_succeeds_after_extreme_legal_params` |
| Coverage / multiplier bounds | `C` clipped; `m ∈ [m_min, m_max]` | `BurrowMath.t.sol`: `test_coverage_clips_high`, `test_multiplier_bounds_fuzz`, `test_epoch_invariants_fuzz` |
| Numeric parity with sims | One epoch matches Python reference | `test_matches_python_reference_epoch` |

<a id="feerouter-distributable-token-and-rescue-gitlab-122"></a>

### FeeMath and FeeRouter

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Stateful accounting (fuzz) | Router balance and sink totals match funded vs distributed under random `fund`/`distribute` sequences (allowlisted token) | [FeeRouterInvariant.t.sol](../../contracts/test/FeeRouterInvariant.t.sol): `invariant_feeRouter_routerBalanceMatchesGhost`, `invariant_feeRouter_sinksSumEqualsDistributed` |
| Weights sum to 10_000 | Library + router reject bad sums | `FeeMath.t.sol`: `test_validateWeights_canonical_split`, `test_validateWeights_reverts_wrong_sum`, `test_validateWeights_reverts_single_overflow`; `FeeRouter.t.sol`: `test_updateSinks_invalid_sum_reverts`, `test_weights_sum_invariant` |
| BPS share basics | Integer division and rounding-down behavior | `test_bpsShare_basic`, `test_bpsShare_rounding_down` |
| BPS split no overallocation | Sum of shares ≤ amount (fuzz) | `test_bpsShare_no_overallocation_fuzz` |
| Non-zero distribution | Zero total amount reverts | `test_distributeFees_zero_reverts` |
| Distributable allowlist (L-04 / #122) | Non-allowlisted token cannot be split to sinks; governor can `setDistributableToken` | `test_distributeFees_reverts_when_token_not_distributable`, `test_setDistributableToken_emits_and_gate`, `test_setDistributableToken_zero_token_reverts`, `test_setDistributableToken_unauthorized_reverts` |
| Governed rescue (L-04 / #122) | `rescueERC20` transfers balance without fee split; only `GOVERNOR_ROLE` | `test_rescueERC20_moves_balance`, `test_rescueERC20_unauthorized_reverts`, `test_rescueERC20_zero_to_reverts` |
| Sufficient balance | Cannot distribute more than router holds | `test_distributeFees_insufficient_balance_reverts` |
| Remainder to last sink | No dust stuck in router | `test_distributeFees_remainder_to_last_sink`, `test_no_dust_fuzz` |
| Canonical 25/35/20/0/20 split | Matches governance doc | `test_distributeFees_canonical_split` |
| Governance on sinks | `updateSinks` happy path + auth + zero address | `test_updateSinks`, `test_updateSinks_unauthorized_reverts`, `test_updateSinks_zero_address_reverts` |
| Zero admin at initialize | Proxy deploy reverts before roles / sinks | [`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol) `test_FeeRouter_zeroAdmin_reverts_before_sink_validation` ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)) |

Align fee expectations with [post-update invariants](../onchain/fee-routing-and-governance.md#post-update-invariants).

<a id="rabbit-treasury-vault-interim-gitlab-159"></a>

### RabbitTreasuryVault interim custody (GitLab [#159](https://gitlab.com/PlasticDigits/yieldomega/-/issues/159))

**Intent:** EcoStrategy audit **H-01** — **`FeeRouter.distributeFees`** pays sinks with **`ERC20.safeTransfer`**. The fifth sink is documented as funding Rabbit workstreams; **`RabbitTreasury.receiveFee`** is the Burrow hook that books **`protocolOwnedBacking`** / burn splits. Until that path is production-proven, **`RabbitTreasuryVault`** accumulates the Rabbit slice as **plain ERC-20 custody** with owner **`withdrawERC20`** / **`withdrawETH`** and **`ERC20Withdrawn`** / **`ETHWithdrawn`** (+ **`reason`** string).

| ID | Invariant |
|----|-----------|
| **`INV-VAULT-159-NOT-BURROW`** | **`ERC20.balanceOf(RabbitTreasuryVault)` is not `protocolOwnedBacking`** (nor redeemable backing). Burrow books **`receiveFee`** gross flows only when **`FEE_ROUTER_ROLE`** callers invoke **`receiveFee`** per [`RabbitTreasury.sol`](../../contracts/src/RabbitTreasury.sol). Treat vault balances as **unbooked** until swept into **`RabbitTreasury`** or sinks migrate via **`FeeRouter.updateSinks`**. |
| **`INV-VAULT-159-ROUTING`** | **`distributeFees`** credits the vault when the fifth **`FeeRouter`** sink destination is the vault; **`withdrawERC20`** moves arbitrary ERC-20 to **`to != 0`**; **`Ownable2Step`** gates sweeps. |

**Tests:** [`RabbitTreasuryVault.t.sol`](../../contracts/test/RabbitTreasuryVault.t.sol) (`test_distributeFees_increases_vault_balance`, `test_owner_withdrawERC20_moves_balance`, auth / ETH sweep). **Docs:** [`treasury-contracts.md`](../onchain/treasury-contracts.md#rabbit-treasury-vault-gitlab-159).

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
| Owner `rescueERC20` (GitLab [#137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)) | Vesting token: only **excess** over `totalAllocated − Σ claimedOf`; non-vesting token: full sweep; non-owner / zero `to` / zero `amount` / over-cap reverts | `test_rescueERC20_*`, `test_fuzz_rescueERC20_vesting_excess_bounded` |

<a id="doub-presale-vesting-owner-rescue-gitlab-137"></a>

### DoubPresaleVesting owner `rescueERC20` (GitLab [#137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Beneficiary DOUB reserve** | For the vesting **`token`**, `rescueERC20` cannot reduce `balanceOf(vesting)` below **`totalAllocated − totalClaimedAcrossBeneficiaries()`** (same as **`reserveDoubForOutstandingClaimsWad()`**). | [`DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol) |
| **Foreign ERC20** | Any other `IERC20` may be swept up to **full** `balanceOf(vesting)` (subject to `amount` / `type(uint256).max`). | Forge: `test_rescueERC20_foreign_token_full_balance` |
| **Indexer** | **`RescueERC20`** → **`idx_doub_vesting_rescue_erc20`**; `kind` **0** = vesting-token path, **1** = non-vesting token. | [`INV-INDEXER-112`](#indexer-emitted-event-coverage-gitlab-112), [`decoder.rs`](../../indexer/src/decoder.rs) |

<a id="presale-vesting-frontend-gitlab-92"></a>

### Presale vesting frontend — `/vesting` (GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Hidden route** | `/vesting` is **not** listed in `RootLayout` primary nav — participants open a **direct URL** only (issue comment: PlasticDigits). | [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx) |
| **Proxy address** | `VITE_DOUB_PRESALE_VESTING_ADDRESS` must be the **ERC-1967 proxy**, not an implementation row from `run-latest.json` (same rule as other UUPS cores — [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). | [`addresses.ts`](../../frontend/src/lib/addresses.ts), [`frontend/.env.example`](../../frontend/.env.example) |
| **`DeployDev` wiring** | Local `DeployDev` deploys a **dev-only** two-beneficiary vesting (Anvil **#0** + **#1**), **180-day** duration, mints DOUB to the contract, **`setClaimsEnabled(true)`**, **`startVesting()`**, logs **`DoubPresaleVesting:`** for stack scripts. **Production mainnet:** do **not** assume claims are enabled at deploy — follow [final signoff](../operations/final-signoff-and-value-movement.md). | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) |
| **Schedule UX** | Page states **30% / 70%** cliff + linear, shows **vestingStart** and **vestingStart + vestingDuration** in **local timezone** and **UTC**, and surfaces **allocation / claimed / claimable** for the connected wallet. | [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx), [presale-vesting.md](../frontend/presale-vesting.md) |
| **Claim** | `claim` CTA disabled when `claimable == 0`, `!claimsEnabled`, or wallet not a beneficiary; matches onchain `claim` revert order (`NotStarted` → `ClaimsNotEnabled` → `NotBeneficiary` — [issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)). | [`DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol) |
| **Claim wrong-chain feedback** | If **`claim`** is clicked while **`chainMismatchWriteMessage(useChainId())`** is non-null (race: wallet switched networks before React re-disabled the button), the page shows the same **`StatusMessage`** copy as other gated writes — not a silent no-op ([GitLab #106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106)). | [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx), [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) |
| **Claim wagmi error after chain return** | **`INV-FRONTEND-166`:** When a **`claim`** attempt on a **wrong chain** leaves wagmi **`useWriteContract` `error`** set, switching the wallet **back** to the build target clears that red **`StatusMessage`** via **`reset()`** on a **mismatch → target** transition — mirroring **`claimGateError`** recovery **without** wiping a **same-chain** reject until the user retries, succeeds, or leaves and returns to target ([GitLab #166](https://gitlab.com/PlasticDigits/yieldomega/-/issues/166)). | [`usePresaleVestingChainWriteEffects.ts`](../../frontend/src/pages/presaleVesting/usePresaleVestingChainWriteEffects.ts), [`presaleVestingWriteErrorChainReset.ts`](../../frontend/src/pages/presaleVesting/presaleVestingWriteErrorChainReset.ts), [`presaleVestingWriteErrorChainReset.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingWriteErrorChainReset.test.ts) |
| **Claim error privacy** | **`useWriteContract`** claim failures render through **`friendlyRevertFromUnknown`**, which **redacts** embedded RPC URLs (**`VITE_RPC_URL`** plus common hosted patterns) so **`StatusMessage`** never shows raw provider keys ([GitLab #145](https://gitlab.com/PlasticDigits/yieldomega/-/issues/145)). | [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx), [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts), [`revertMessage.test.ts`](../../frontend/src/lib/revertMessage.test.ts) |

<a id="presale-vesting-claim-chain-preflight-gitlab-106"></a>

<a id="presale-vesting-claim-wagmi-error-clear-on-target-gitlab-166"></a>

<a id="presale-vesting-claim-error-redaction-gitlab-145"></a>

**Manual QA checklist (3rd-party agents):** [`manual-qa-checklists.md#manual-qa-issue-92`](manual-qa-checklists.md#manual-qa-issue-92) · [§ #106 — claim chain race](manual-qa-checklists.md#manual-qa-issue-106) · [§ #166 — wagmi claim error clears on target return](manual-qa-checklists.md#manual-qa-issue-166-presale-vesting-claim-error-chain-return) · [§ #145 — claim error redaction](manual-qa-checklists.md#manual-qa-issue-145). **Anvil E2E:** [`anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts) via [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh).

<a id="canonical-fee-sinks-mobile-gitlab-93"></a>

### Canonical fee sinks — mobile address affordance + readable protocol labels (GitLab [#93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Mobile address link** | Viewports **≤479px** (`matchMedia max-width: 479px`): each **full** EVM address (`0x` + 40 hex) in the global **Canonical fee sinks** panel and related trust rows shows **`0x`** + **first four** + **ellipsis** + **last four** characters; the link lands on **`{VITE_EXPLORER_BASE_URL}/address/{addr}`** (default **`https://mega.etherscan.io`**; trailing slash stripped), same contract as tx links ([GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)). Wider viewports show the **full** hex. Invalid addresses render as monospace text without a link. | [`MegaScannerAddressLink.tsx`](../../frontend/src/components/MegaScannerAddressLink.tsx), [`explorerAddressUrl`](../../frontend/src/lib/explorer.ts), [`abbreviateAddressEnds`](../../frontend/src/lib/addressFormat.ts), [`FeeTransparency.tsx`](../../frontend/src/components/FeeTransparency.tsx) |
| **Operator-readable names** | KV labels that mirror **Solidity** getters use **spaced title case**: `WARBOW_FLAG_SILENCE_SEC` → *Warbow Flag Silence Sec*; `warbowPendingFlagOwner` → *Warbow Pending Flag Owner*; multi-token rows like `charmPrice basePriceWad` → *Charm Price · …*. Prose phrases such as *seconds remaining* stay unchanged (`humanizeKvLabel` heuristics). | [`humanizeIdentifier.ts`](../../frontend/src/lib/humanizeIdentifier.ts), [`TimeCurveProtocolPage.tsx`](../../frontend/src/pages/TimeCurveProtocolPage.tsx), [`TimeCurveSections.tsx`](../../frontend/src/pages/timecurve/TimeCurveSections.tsx), [`humanizeIdentifier.test.ts`](../../frontend/src/lib/humanizeIdentifier.test.ts) |

**Manual QA checklist (3rd-party agents):** [`manual-qa-checklists.md#manual-qa-issue-93`](manual-qa-checklists.md#manual-qa-issue-93). **Spec:** [`timecurve-views.md` — global footer fee sinks](../frontend/timecurve-views.md#global-footer-fee-sinks-mobile-issue-93).

<a id="canonical-address-display-gitlab-98"></a>

### Canonical address display — blockie + explorer link (GitLab [#98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Single component** | User-visible **20-byte identities** (EOAs and contracts) in TimeCurve / referrals / protocol surfaces use [`AddressInline`](../../frontend/src/components/AddressInline.tsx): **blockie** + short label + **external** explorer link (`target="_blank"`, `rel="noreferrer noopener"`), unless **`explorer={false}`** is explicitly justified. Invalid or **`0x000…000`** → fallback (e.g. **—**); no URL emitted without **`viem` `isAddress`**. | [`AddressInline.tsx`](../../frontend/src/components/AddressInline.tsx), [`LiveBuyRow.tsx`](../../frontend/src/pages/timecurve/LiveBuyRow.tsx) (no duplicate `WalletBlockie` + orphan label) |
| **URL helper** | Address pages use the **same** base as tx links: [`explorerAddressUrl`](../../frontend/src/lib/explorer.ts) with **`VITE_EXPLORER_BASE_URL`** (trailing slash stripped); default **`https://mega.etherscan.io`**. [`megaEtherscanAddressUrl`](../../frontend/src/lib/megaEtherscan.ts) delegates to the same helper ([GitLab #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93) surfaces stay aligned with tx links). | [`explorer.ts`](../../frontend/src/lib/explorer.ts), [`explorer.test.ts`](../../frontend/src/lib/explorer.test.ts), [`megaEtherscan.test.ts`](../../frontend/src/lib/megaEtherscan.test.ts) |
| **Accessibility** | Decorative blockie stays **`aria-hidden`** (in `WalletBlockie`); the anchor gets a **non-misleading** accessible name (full address in `aria-label`). | `AddressInline`, `WalletBlockie` |
| **Live buys row interaction** | Interactive **live-buy** rows use a **focusable** hit target (`role="group"`, `tabIndex={0}`, **`aria-label`**) with **click / Enter / Space** opening buy details, while **clicks on the explorer link** do not activate the row (`stopPropagation` + `closest('a')` guard). Not a `<button>` wrapping an `<a>`. | [`LiveBuyRow.tsx`](../../frontend/src/pages/timecurve/LiveBuyRow.tsx), [`timecurve-live-buys-modals.spec.ts`](../../frontend/e2e/timecurve-live-buys-modals.spec.ts) |
| **Arena — no `VITE_TIMECURVE_ADDRESS`** | Indexer-backed **live buys** strip and **buy list / detail** modals still work when the indexer URL is set (`TimerHeroLiveBuys` + `TimecurveBuyModals` on the config-missing Arena branch); E2E uses **`/timecurve/arena`** + mocked `/v1/timecurve/buys` ([`timecurve-live-buys-modals.spec.ts`](../../frontend/e2e/timecurve-live-buys-modals.spec.ts), [`playwright.timecurve-ui.config.ts`](../../frontend/playwright.timecurve-ui.config.ts)). |
| **Narrative strings** | **`buildBuyFeedNarrative` / `buildWarbowFeedNarrative`** and similar **plain-text** strings may keep **text-only** wallet snippets (no blockie in prose); see issue #98 “Option A”. | [`timeCurveUx.ts`](../../frontend/src/lib/timeCurveUx.ts) |

**Manual QA checklist (contributors / 3rd-party agents):** [`manual-qa-checklists.md#manual-qa-issue-98`](manual-qa-checklists.md#manual-qa-issue-98). **Spec:** [`wallet-connection.md` — explorer env](../frontend/wallet-connection.md#block-explorer-base-url-gitlab-98).

### FeeSink and PodiumPool

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Sink withdraw | Only `WITHDRAWER_ROLE`; `to != address(0)` | `FeeSinks.t.sol`: `test_feeSink_withdraw_happy_path`, `test_feeSink_withdraw_unauthorized_reverts`, `test_feeSink_withdraw_zero_to_reverts` |
| Podium payout | **`prizePusher`** if set (production **TimeCurve**), else **`DISTRIBUTOR_ROLE`**; `winner != address(0)` | `test_podiumPool_payPodiumPayout_happy_path`, `test_podiumPool_payPodiumPayout_unauthorized_reverts`, `test_podiumPool_payPodiumPayout_zero_winner_reverts`, `test_podiumPool_payPodiumPayout_prize_pusher_wins_over_distributor_role` |

### LeprechaunNFT

| Invariant | Meaning | Tests |
|-----------|---------|--------|
| Mint path | Authorized mint stores owner + traits | `test_mint_basic`, `test_traits_stored_onchain` |
| Supply cap | Mint count ≤ series max | `test_series_max_supply_enforced`, `test_series_mint_count_fuzz` |
| Series validity | Zero-supply series rejected; mint only for active series | `test_createSeries_zero_supply_reverts`, `test_inactive_series_reverts` |
| Access control | Only minter role mints | `test_mint_unauthorized_reverts` |
| Metadata admin | `DEFAULT_ADMIN_ROLE` sets `baseURI`; `tokenURI` reflects prefix for new and **existing** tokens; non-admin reverts | `test_setBaseURI`, `test_setBaseURI_updates_existing_tokenURI`, `test_setBaseURI_non_admin_reverts` |

**INV-LEP-125 — Holder-visible metadata mutability (audit I-02, disclosure):** <a id="leprechaun-metadata-base-uri-gitlab-125"></a> Offchain JSON behind **`tokenURI`** can change whenever **`setBaseURI`** runs; integrators must not assume a frozen metadata host. Onchain **`tokenTraits`** remain the gameplay source of truth. Spec: [product — Metadata URI trust model](../product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json) · [GitLab #125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125) · play skill: [`skills/collect-leprechaun-sets/SKILL.md`](../../skills/collect-leprechaun-sets/SKILL.md).

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
| Per-block ingestion transaction ([GitLab #140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140)) | **`INV-INDEXER-140`:** decoded inserts for a block, `indexed_blocks`, and `chain_pointer` share one commit; failed / rolled-back work leaves no ghost rows vs pointer | Same integration test (section C: explicit `ROLLBACK` after writes) |
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
| TimeCurve `ledgerSecIntForPhase` + `derivePhase` | Prefers hero `chainNowSec` over block time when set; state machine for Simple + Arena | [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts) (issue [#48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48), [view doc](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48)) |
| Presale vesting display helpers | `formatDoubHuman` + `dualWallClockLines` for `/vesting` | [`presaleVestingFormat.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingFormat.test.ts) ([issue #92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)) |
| Fee sinks labels + abbreviated addresses + explorer URL helpers | `humanizeKvLabel` · `explorerAddressUrl` / `megaEtherscanAddressUrl` · `abbreviateAddressEnds` for **42-char** hex | [`humanizeIdentifier.test.ts`](../../frontend/src/lib/humanizeIdentifier.test.ts), [`explorer.test.ts`](../../frontend/src/lib/explorer.test.ts), [`megaEtherscan.test.ts`](../../frontend/src/lib/megaEtherscan.test.ts), [`addressFormat.test.ts`](../../frontend/src/lib/addressFormat.test.ts) ([issue #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93), [issue #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)) |

### TimeCurve frontend: sale phase and hero timer

Narrative for [timecurve-views — Single source of truth](../frontend/timecurve-views.md#single-source-of-truth-invariants): the **state badge**, **phase narrative**, and **pre-start window** on Simple, plus **Arena** `phaseFlags`, must not disagree with the **indexer-anchored hero countdown** because `wagmi`’s `latestBlock` timestamp lags — including when **`saleStart` > chain “now”** ([**`startSaleAt` (#114)**](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114), [`timecurve-views` — scheduled starts](../frontend/timecurve-views.md#scheduled-sale-start-onsalestartsaleat-issue-114)). **Unit tests** above cover the pure `ledgerSecIntForPhase` + `derivePhase` helpers; **E2E** does not start Anvil in CI (see [strategy — Stage 1](strategy.md#stage-1--unit-tests)).

### Python simulations (Stage 1 scope)

| Module | What it checks | Test names |
|--------|----------------|------------|
| `test_model.py` | Clip, coverage bounds, epoch step invariants, multiplier saturation, NaN freedom | `test_clip`, `test_coverage_bounds`, `test_epoch_step_invariants`, `test_multiplier_saturates`, `test_no_nan_after_many_steps` |
| `test_scenarios.py` | Bundled scenario expectations | `test_all_scenarios_pass` |
| `test_timecurve.py` | Legacy **sim** min-buy curve (exponential daily); does **not** yet model split **linear price × CHARM envelope** (track as sim gap vs [product/primitives.md](../product/primitives.md)) | `test_min_buy_monotone`, `test_daily_growth_20_percent`, `test_next_sale_end_cap`, `test_clamp_spend_continuous` |
| `test_comeback.py` | Comeback scoring caps and baseline | `test_comeback_caps_trailing`, `test_leader_stays_high_baseline` |
| `test_ecostrategy.py` | EcoStrategy audit scenarios — **`WarBowWorld`** mirrors `warbowSteal` / `warbowRevenge` / `warbowActivateGuard` (2× rule, UTC-day steal caps, drain bps, revenge window); scenarios **A–E** via **`python3 -m ecostrategy`** ([GitLab #161](https://gitlab.com/PlasticDigits/yieldomega/-/issues/161)); **D** final-window ordering branches (**[`INV-SIM-169-D`](#ecostrategy-scenario-d-isolated-after-tick-gitlab-169)** — [GitLab #169](https://gitlab.com/PlasticDigits/yieldomega/-/issues/169)); **E** FeeRouter splits + Rabbit **`receiveFee`** vs direct sink (H-01 narrative) + launch anchor | `test_two_x_rule_blocks_steal`, `test_steal_drain_matches_bps`, `test_guard_reduces_drain`, `test_daily_limit_blocks_without_bypass`, `test_revenge_moves_bp_from_stealer`, `test_shares_sum_to_gross_and_rabbit_is_remainder`, `test_scenarios_finish_and_b_weight_stack`, `test_scenario_c_records_pvp_events`, `test_scenario_d_ordering_branches`, `test_scenario_d_warbow_guards_parity_seed_42`, `test_scenario_e_receive_fee_books_coverage` |

#### EcoStrategy audit scenarios (GitLab #161)

Python **`simulations/ecostrategy/`** models shark-vs-believer outcomes under EcoStrategy audit assumptions ([`audits/audit_ecostrategy_1777969776.md`](../../audits/audit_ecostrategy_1777969776.md)): **`WarBowWorld`** replaces the Monte Carlo **toy** PvP steal (`pvp_steal_prob` in `monte_carlo.run_single_sale`) with **`TimeCurve`-aligned** eligibility and drains. Scenarios **D–E** add final-window tick ordering and FeeRouter / Rabbit booking slices per EcoStrategy audit threads. **`INV-SIM-161`**: mirrored numeric constants are enumerated in **`simulations/ecostrategy/constants.py`** (`MIRRORED_FROM_CONTRACT` vs `APPROXIMATIONS_AND_SCENARIO_ONLY`); Poisson arrivals and wallet budgets remain scenario-only. **`INV-SIM-169-D`**: **`run_scenario_d`** builds **separate** **`_scenario_c_style_after_tick`** closures for **`buy_first`** and **`pvp_first`** so **`guard_once`** / **`leader_guarded`** does not leak across paired runs — otherwise **`pvp_first_warbow_guards`** can read **0** while **`buy_first_warbow_guards`** is **1**, inflating ordering deltas ([GitLab #169](https://gitlab.com/PlasticDigits/yieldomega/-/issues/169)); see **`run_scenario_d`** in [`scenarios.py`](../../simulations/ecostrategy/scenarios.py). Third-party agents: [`skills/README.md`](../../skills/README.md#ecostrategy-scenarios-gitlab-161-modeling-entry). Play skill: [`skills/play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

See [simulations/README.md](../../simulations/README.md) for run commands and pass/fail criteria. The **`simulations-test`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) runs this suite on every push/PR.

<a id="ecostrategy-scenario-d-isolated-after-tick-gitlab-169"></a>

##### EcoStrategy scenario D — isolated `after_tick` per paired run (GitLab #169)

**Invariant:** For **`guard_once=True`**, **`buy_first_warbow_guards`** and **`pvp_first_warbow_guards`** must match under the same seed and parameters, because **`pvp_start`** precedes the configurable final window and **`leader_guarded`** is reset per closure. **`test_scenario_d_warbow_guards_parity_seed_42`** pins the **#169** regression (seed **42**, default horizon).

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
| [RabbitTreasury.t.sol](../../contracts/test/RabbitTreasury.t.sol) | 36 | Epochs, deposit/withdraw, finalize, pause, fee split/burn, bucket anti-leak, cooldown, stress exits, repricing vs redemption, **Burrow param bounds (#119)** |
| [RabbitTreasuryInvariant.t.sol](../../contracts/test/RabbitTreasuryInvariant.t.sol) | 2 | Foundry **invariant** handlers: reserves vs balance, DOUB supply vs mint/burn |
| [FeeMath.t.sol](../../contracts/test/FeeMath.t.sol) | 6 | Weight validation, BPS shares |
| [FeeRouter.t.sol](../../contracts/test/FeeRouter.t.sol) | 17 | Distribution, dust, **insufficient balance**, governance, **allowlist + rescue (#122)** |
| [FeeRouterInvariant.t.sol](../../contracts/test/FeeRouterInvariant.t.sol) | 2 | Foundry **invariant** handlers: router ledger + sink totals |
| [FeeSinks.t.sol](../../contracts/test/FeeSinks.t.sol) | 7 | `FeeSink` withdraw access + zero `to`; `PodiumPool.payPodiumPayout` auth + zero winner + **prizePusher** vs `DISTRIBUTOR_ROLE` ([issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) |
| [TimeCurveWarBowCl8yBurns.t.sol](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) | 6 | Fuzz: WarBow CL8Y burn amounts match constants to burn sink (**#70**); explicit **`BURN_SINK` caller revert** (**[`INV-WARBOW-123-BURN-CALLER`](#inv-warbow-123-burn-caller)**, [#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)) |
| [NonStandardERC20.t.sol](../../contracts/test/NonStandardERC20.t.sol) | 8 | Fee-on-transfer parity (`TimeCurve`, Burrow `deposit`/`receiveFee`, `ReferralRegistry`), revert-all, blocked sink, rebasing stub vs treasury |
| [LeprechaunNFT.t.sol](../../contracts/test/LeprechaunNFT.t.sol) | 10 | Series, mint, supply cap, `setBaseURI` + `tokenURI`, non-admin revert |
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
