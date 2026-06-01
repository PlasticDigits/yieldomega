# Manual QA checklists (contributors)

Procedural checklists for **maintainers and QA** live here. Root [`skills/`](../../skills/) is **player-facing only** ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)). **Product invariants** and spec ↔ test mapping remain in [`invariants-and-business-logic.md`](invariants-and-business-logic.md). **Contributor** agents: [Phase 14 — Testing strategy](../agent-phases.md#phase-14) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

## Table of contents

| Issue | Topic |
|-------|--------|
| [#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260) | [Arena v2 QA](#manual-qa-issue-260) |
| [#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265) | [XP buy-path gas](#manual-qa-issue-265) |
| [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268) | [CRED buy + first-buy bonus](#manual-qa-issue-268) |
| [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271) | [Per-podium timer params](#manual-qa-issue-271) |
| [#275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275) | [Contract fork smoke (optional)](#manual-qa-issue-275) |
| [#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87) | [Anvil E2E](#manual-qa-issue-87) |
| [#88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88) | [DeployDev cooldown](#manual-qa-issue-88) |
| [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64) | [Referrals](#manual-qa-issue-64) |
| [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) | [Wrong-network writes](#manual-qa-issue-95) |
| [#194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194) | [Arena buy wrong-chain visual](#manual-qa-issue-194-arena-buy-chain-visual) |
| [#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144) | [Buy session drift](#manual-qa-issue-144-wallet-session-drift-on-buy) |
| [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92) | [Presale vesting](#manual-qa-issue-92) |
| [#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96) | [Indexer offline](#manual-qa-issue-96) |

Also see: [`e2e-anvil.md`](e2e-anvil.md), [`arena-views.md`](../frontend/arena-views.md), [`invariants-and-business-logic.md`](invariants-and-business-logic.md).

<a id="manual-qa-issue-260"></a>

## Arena v2 QA — multi-timer, CRED, wallet (GitLab #260)

**Scope:** Epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Product: [`arena-v2.md`](../product/arena-v2.md).

### Preconditions

- Local stack or `bash scripts/e2e-anvil.sh` with `VITE_TIME_ARENA_ADDRESS`, `VITE_PODIUM_VAULTS_ADDRESS`, `VITE_ADMIN_SELL_VAULT_ADDRESS`, indexer optional for timer chips.
- Wallet on configured chain (Anvil: mock connector).

### Checklist

| Step | Pass criteria |
|------|----------------|
| Open **`/arena`** | `arena-timer-chips` shows four labels (Last Buy, Time Booster, Streak, WarBow); `arena-charm-cred-card` visible. |
| Indexer running | Timer chips show non-`—` deadlines from `GET /v1/arena/timers` (four `podium_deadlines_sec`). |
| DOUB buy | Connect wallet; slider + **Buy** succeeds; vault balances move 40/30/30 (Forge / explorer). |
| CRED | After DOUB buy, epoch pool accrues; **claim** prior epoch when eligible. |
| CRED pay ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) | Select **CRED** in buy picker; balance + burn preview; **Buy** calls `buyWithCred`; insufficient CRED disables submit with copy. |
| Wallet profile ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)) | Click participant **`AddressInline`** on live buy row or podium winner → **`WalletProfileModal`** opens; sections Overview / Podium wins / Spending / XP / WarBow / Referrals / Fun facts load from **`GET /v1/arena/wallet/{address}/stats`**. |
| Referrals | Register code on `/referrals`; referred buy shows in `GET /v1/referrals/applied`. |
| WarBow | Steal/guard txs spend DOUB (no CL8Y burn path). |

**Automated:** `TimeArena.t.sol`, `ArenaPrizeRouting.t.sol`, `e2e/anvil-arena-*.spec.ts`, `indexer` `integration_stage2`.

<a id="manual-qa-issue-87"></a>

## Anvil E2E Playwright (GitLab #87)

**Why:** [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) starts **one** Anvil, deploys Arena v2 `DeployDev`, builds the app with `VITE_*`, and runs `e2e/anvil-arena-*.spec.ts` with **`ANVIL_E2E=1`**. Specs share **one chain** and the wagmi **mock** account — multi-worker Playwright can **race** unrelated files.

### Invariants (do not regress)

1. With **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) uses **`workers: 1`** and **`fullyParallel: false`**. Do not raise Anvil E2E workers without **isolation** (separate Anvil per worker or per project), or document why and get sign-off.
2. **Pay mode** on **`/arena`** is **toggle buttons** with stable hooks: **`data-testid="arena-paywith-cl8y"`**, **`…-eth`**, **`…-usdm`** on [`TimeArenaPage`](../../frontend/src/pages/TimeArenaPage.tsx).
3. Wallet-write E2E ([`anvil-arena-03-wallet-writes.spec.ts`](../../frontend/e2e/anvil-arena-03-wallet-writes.spec.ts)) must select pay assets via **`getByTestId("arena-paywith-…")`** inside the buy panel on **`/arena`**, not dead CSS for removed radios.

### Checklist

- [ ] From repo root: `bash scripts/e2e-anvil.sh` completes **green** (Foundry + `npm ci` in `frontend/` as needed).
- [ ] If you only run Playwright manually: `cd frontend && ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1` after a matching build — confirm **one** worker in the list reporter or config.
- [ ] **ETH route** test: after **`arena-paywith-eth`**, expect **Quoted ETH spend** (aria-label) and a resolved quoted amount (not `…`) before moving the slider; then **Buy CHARM** enabled after quote refresh (see [arena-views — Buy quote refresh](../frontend/arena-views.md#buy-quote-refresh-kumbaya-issue-56), issue #56).
- [ ] **Optional:** For **back-to-back buys** from the **same** mock wallet without real-time waits, deploy with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** ([issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)) — see [e2e-anvil — buy cooldown](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) and [DeployDev buy cooldown](#manual-qa-issue-88) below.

**Doc map:** [e2e-anvil — Concurrency](e2e-anvil.md#anvil-e2e-concurrency-gitlab-87) · [invariants — Anvil E2E](invariants-and-business-logic.md#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87)

<a id="manual-qa-issue-88"></a>

## DeployDev buy cooldown (GitLab #88)

**Why:** Default **`DeployDev`** sets **`TimeArena.buyCooldownSec = 300`**. Manual checklists that need **several buys from the same wallet** are impractical without lowering the initializer argument.

### Invariants

1. **Default unchanged:** With no flags, **`buyCooldownSec`** stays **300** on fresh **`DeployDev`**.
2. **Never zero:** **`TimeArena`** init requires **`buyCooldownSec > 0`**. **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=0`** fails **`DeployDev`** before broadcast.
3. **Single source:** Env logic lives only in [`contracts/script/DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol); Forge coverage in [`DeployDevBuyCooldown.t.sol`](../../contracts/test/DeployDevBuyCooldown.t.sol) (`test_readBuyCooldownSec_env_resolution_matrix`).

### Flags

| Variable | Role |
|----------|------|
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | QA mode: default numeric cooldown becomes **1** s when **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** is unset. |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** | Explicit seconds (**> 0**). Applies in both branches; see [e2e-anvil.md](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) for defaults. |

### Checklist

- [ ] **`cast call <TimeArenaProxy> "buyCooldownSec()(uint256)" --rpc-url …`** returns **300** without flags, or your chosen override after a flagged deploy.
- [ ] After two quick buys from the same wallet (with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`**), second buy succeeds once **`block.timestamp >= nextBuyAllowedAt`** (1 s pacing).
- [ ] Production / unattended CI: **do not** export these flags unless the job intentionally tests short cooldowns.

**Bot swarm demos:** Prefer short cooldown alongside stack **[`--block-time`](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99)** defaults ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)) — [Bot swarm + Anvil chain time](#manual-qa-issue-99).

**Doc map:** [e2e-anvil — DeployDev buy cooldown](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) · [primitives — Per-wallet buy cooldown](../product/primitives.md)

<a id="manual-qa-issue-99"></a>

## Bot swarm + Anvil chain time (GitLab #99)

**Why:** Default **`SKIP_ANVIL_RICH_STATE=1`** turns **`START_BOT_SWARM`** **on**. With **`buyCooldownSec = 300`** and **automine-only** Anvil, **no transactions** while wallets **sleep** meant **no new blocks** ⇒ **`block.timestamp` froze** and bots stalled.

### Invariants

1. **Local script only:** [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) adds **`anvil --block-time`** only when **it starts** Anvil and **`START_BOT_SWARM=1`**. **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC`** (default **12**; **`0`** disables interval mining).
2. **Bots unchanged on non-Anvil:** No **`evm_increaseTime`** or similar was added to Python bot code.
3. **Cooldown opt-in unchanged:** **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** / **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** remain the way to shorten per-wallet spacing ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
4. **Pre-existing RPC:** If the stack **reuses** a node on **`ANVIL_PORT`**, the script cannot apply **`--block-time`** — operators see a **warning**.

### Checklist

- [ ] Fresh stack: **`SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh`** — startup log mentions **`Anvil interval mining`** (unless **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC=0`**).
- [ ] With default swarm + default cooldown, wait **~2–5 minutes** after the initial burst: indexer **`GET /v1/arena/buys`** should still show **new** rows (chain time advances during sleeps).
- [ ] Optional dense traffic: re-run with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** — buys should arrive much more frequently.
- [ ] **`cast block-number`** / **`eth_getBlockByNumber(latest)`** `timestamp`: after **30–60** s idle, timestamps should increase (interval mining).

**Doc map:** [e2e-anvil — Bot swarm + chain time](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99) · [`bots/timearena/README.md`](../../bots/timearena/README.md)

<a id="manual-qa-issue-64"></a>

## Referrals `/referrals` surface (GitLab #64)

Use when an agent or human needs to **produce evidence** (screenshots or tx hashes) for the **seven-row** checklist tracked in [GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64).

### Authoritative docs

- [`launchplan-timecurve.md`](../../launchplan-timecurve.md#6-under-construction-frontend) — **`/referrals`** is **not** in the **`UnderConstruction`** set at TGE (**F-11** / [GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)); [`YO-DOUB-Launch-UX-Flows.md`](../../YO-DOUB-Launch-UX-Flows.md).
- [`docs/product/referrals.md`](../product/referrals.md) — code rules, link capture, **registration ordering / mempool fairness** ([GitLab #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121), [§ ordering](../product/referrals.md#referral-registration-ordering-issue-121)), **browser storage key table** (pending vs my-code — [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)).
- [referrals.md — registration ordering](../product/referrals.md#referral-registration-ordering-issue-121).
- Contributor Anvil runbook: [e2e-anvil.md](e2e-anvil.md) (`bash scripts/e2e-anvil.sh`).

### Preconditions

- Frontend built with **`VITE_LAUNCH_TIMESTAMP` in the past** if you need the **post-launch** route tree.
- **`VITE_REFERRAL_REGISTRY_ADDRESS`** set (from **`DeployDev`**).
- Wallet with **gas + CL8Y** for `registerCode` when exercising R4.
- **Leaderboard + indexed earnings:** [GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94) — verify indexer + `/referrals` panels when the stack has referral buys.

### Rows R1–R7

| Row | What to verify | Suggested evidence |
|-----|----------------|-------------------|
| **R1** | `/referrals` renders (`data-testid="referrals-surface"`) behind launch gate | Screenshot |
| **R2** | Connected wallet, **not** yet registered: burn copy + input + CTA · **ordering disclosure** visible (`referrals-register-ordering-disclosure` — [#121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121)) | Screenshot |
| **R3** | Disconnected: wallet-gated placeholder | Screenshot |
| **R4** | Approve → `registerCode` → success → **`localStorage`** **`yieldomega.myrefcode.v1.<walletLowercase>`** vs pending **`yieldomega.ref.v1`** ([GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)) | Tx hash(es) + screenshot |
| **R5** | Registered: code visible + copy-able **path** and **`?ref=`** URLs | Screenshot |
| **R6** | Copy confirmation UX ([GitLab #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)) | Screenshot or recording |
| **R7** | Land with **`?ref=`**; pending capture under **`yieldomega.ref.v1`** | Screenshot + storage inspector |

### Automated regression

- CI: `frontend/e2e/referrals-surface.spec.ts`
- Anvil: `frontend/e2e/anvil-referrals.spec.ts`
- Unit: `frontend/src/lib/referralPathCapture.test.ts`

<a id="manual-qa-issue-222"></a>

## Referrals — self-referral pending purge (GitLab #222)

**Scope:** A registered wallet must not keep its **own** slug in **`yieldomega.ref.v1`** after visiting its share link — **`/arena`** buys must not self-refer.

### Authoritative docs

- [product/referrals.md § #222](../product/referrals.md#referral-self-referral-pending-purge-issue-222)
- [referrals.md — #222](../product/referrals.md#referral-self-referral-pending-purge-issue-222)

### Preconditions

- Wallet **registered** on `/referrals` ( **`yieldomega.myrefcode.v1.<wallet>`** populated).
- Same wallet **connected** when capturing the link.

### Checklist

- [ ] Open **`/?ref={yourCode}`** while connected — DevTools: **`yieldomega.ref.v1`** is **absent** (or removed within one tick after capture).
- [ ] On **`/arena`**, buys succeed without self-referral revert when using your own slug.
- [ ] Capture a **third-party** `?ref=` — pending key **remains** until overwritten (regression vs [#85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)).

**Automated:** `npm test -- referralSelfReferralPending` in `frontend/`.

<a id="manual-qa-issue-204-referrer-leaderboard-registry-union"></a>

### Referrals — guide leaderboard + `ReferralCodeRegistered` union ([GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204))

**Scope:** Verify the **`/referrals`** **Guide leaderboard** lists wallets that registered a code **before** any **`ReferralApplied`** buy exists, and that per-row copy matches indexer fields.

### Authoritative docs

- [referrals.md — dashboard](../product/referrals.md#referrals-dashboard-issue-94)
- [product — dashboard table](../product/referrals.md#referrals-dashboard-issue-94)

### Checklist

- [ ] With indexer **schema ≥ 1.19.0** and at least one indexed **`ReferralCodeRegistered`** for wallet **W** and **zero** `ReferralCredApplied` rows, **`GET /v1/referrals/referrer-leaderboard`** returns a row for **W** with **`codes_registered_count ≥ 1`**, **`referred_buy_count == 0`**, **`total_referrer_cred_wad == 0`**.
- [ ] `/referrals` **Guide leaderboard** shows **W** with sublines for **onchain codes registered** and **recorded buys** (may be zero buys).
- [ ] After a qualifying referred buy indexes for **W**, **`referred_buy_count`** / CRED increase while **`codes_registered_count`** stays consistent with registry rows.
- [ ] When two referrers tie on Σ CRED, JSON **`rank`** values match dense **`RANK()`** (**`1, 2, 2, 4`**, not page ordinal **`1, 2, 3, 4`**) — **`postgres_gitlab177_referrer_leaderboard_dense_rank`**.

**Automated:** `cargo test` **`postgres_gitlab204_referrer_leaderboard_includes_registry_registrations`** · **`postgres_gitlab177_referrer_leaderboard_dense_rank`** (requires **`YIELDOMEGA_PG_TEST_URL`**).

<a id="manual-qa-issue-225"></a>

### Referrals — guide leaderboard global totals + pagination ([GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225))

**Scope:** Verify **`/referrals`** **Guide leaderboard** shows **network-wide** summary totals and numbered pagination backed by indexer aggregates.

### Authoritative docs

- [referrals.md — dashboard](../product/referrals.md#referrals-dashboard-issue-94)
- [product — dashboard table](../product/referrals.md#referrals-dashboard-issue-94)

### Checklist

- [ ] With indexer **schema ≥ 1.25.0** (CRED fields **≥ 2.3.0**), **`GET /v1/referrals/referrer-leaderboard?limit=20&offset=0`** returns **`total`**, **`total_codes_registered`**, **`total_referred_buys`**, and **`total_referrer_cred_wad`** matching full-table counts (not sums of the current page **`items`**).
- [ ] `/referrals` summary strip labels read **“(global)”** and stay stable when changing pages (no flicker back to page-local sums).
- [ ] When **`total > 20`**, numbered page controls appear at the bottom; page **2** fetches **`offset=20`** and row **`rank`** values remain dense competitive ranks from JSON (not **`21, 22, …`** ordinals).
- [ ] Connected wallet **“you”** row highlight still works when your address appears on the current page.

**Automated:** `cargo test` **`postgres_gitlab225_referrer_leaderboard_global_totals_and_pagination`** · `npm test -- referralLeaderboardPagination` · Playwright **`referrals-surface.spec.ts`** (mocked global label).

<a id="manual-qa-issue-121-referrals-register-disclosure"></a>

### Referrals — register ordering disclosure ([GitLab #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121))

Brief row for **INV-REFERRAL-121-UX** (pairs with audit [L‑02](../../audits/audit_smartcontract_1777813071.md#l-02-referral-code-registration-is-front-runnable)).

- [ ] On **`/referrals`** with registry configured, connected **unregistered** wallet: **`data-testid="referrals-register-ordering-disclosure"`** renders **above** **Register & burn CL8Y**, copy matches [product referrals — § registration ordering](../product/referrals.md#referral-registration-ordering-issue-121) (**first successful on-chain registration**, public **mempool**, **burn** applies only if your tx succeeds).
- [ ] **Narrow viewport:** disclosure + burn line + input + primary CTA do not clip or collide.
- [ ] **Burn row** (`registrationBurnAmount` via `AmountDisplay`) unchanged vs chain.

**Automated:** [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) asserts the disclosure test id appears in the connected unregistered path.

<a id="manual-qa-issue-265"></a>

### XP buy-path gas — cached level + cap ([GitLab #265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265))

**Scope:** Buy-path XP uses cached **`level`** + **`xpTowardNext`**; at most **five** level-ups per buy; timer hard-reset does **not** clear progression.

### Authoritative docs

- [arena-v2 § XP](../product/arena-v2.md#xp) · [time-arena § progression](../product/time-arena.md)
- [`INV-TIME-ARENA-XP-GAS`](invariants-and-business-logic.md#timearena-xp-gas-gitlab-265) · [`ArenaXp.applyXpGain`](../../contracts/src/arena/libraries/ArenaXp.sol)
- [play-time-arena-doub § XP](../../skills/play-time-arena-doub/SKILL.md)

### Checklist

- [ ] **`forge test --match-test test_xp_`** and **`forge test --match-path test/ArenaXp.t.sol`** pass.
- [ ] **`npm test -- --run src/lib/arenaXpMath.test.ts`** passes (mirrors `applyXpGain`).
- [ ] Fresh Anvil **`DeployDev`**: max-CHARM buy → `cast call level` = **1**, `xpTowardNext` = **10**, `xpToNextLevel` = **10** (10 XP toward L2 threshold 20).
- [ ] After many buys from one wallet, a non-level-up buy gas does **not** scale vs a fresh wallet (`test_xp_high_level_buy_gas_bounded_no_level_up`).
- [ ] Timer hard-reset buy: `lastBuyEpoch` increments; **`level`** / **`xpTowardNext`** unchanged (`test_xp_survives_timer_hard_reset`).
- [ ] **`buyWithCred`** at same CHARM yields same level/progress as DOUB (`test_xp_buy_with_cred_same_as_doub`).
- [ ] Wallet profile modal **Level** (indexer `new_level` from `XpGained`) matches onchain `level()` after buys ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)).

**Automated:** `TimeArena.t.sol::test_xp_*`, `ArenaXp.t.sol`, `arenaXpMath.test.ts` · optional: `YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/lib/anvil_deploy_dev.sh` + `cast call` as above.

<a id="manual-qa-issue-268"></a>

### CRED buy burn + first-buy bonus ([GitLab #268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268))

**Scope:** `buyWithCred` burns **100 CRED per 1e18 CHARM**; wallet’s first `_finishBuy` (DOUB or CRED) schedules **150 CRED** for **`lastBuyEpoch + 1`** (post same-tx hard-reset); `pendingCred` / `claimCred` include fixed bonus.

### Authoritative docs

- [arena-v2 § CRED buy](../product/arena-v2.md) · [time-arena § Play CRED](../product/time-arena.md)
- [`INV-TIME-ARENA-CRED-BURN-BUY`](invariants-and-business-logic.md#timearena-cred-buy-gitlab-268) · [`INV-TIME-ARENA-FIRST-BUY-CRED-BONUS`](invariants-and-business-logic.md#timearena-cred-buy-gitlab-268)
- [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) · [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts) (frontend mirror)
- [play-time-arena-doub § Play CRED](../../skills/play-time-arena-doub/SKILL.md)

### Checklist

- [ ] **`forge test --match-contract TimeArena`** passes (includes `test_buy_with_cred`, `test_first_buy_*`, `test_claim_cred_*`).
- [ ] **`bash scripts/verify-cred-buy-anvil.sh`** — fresh Anvil DeployDev: burn scaling + first-buy bonus onchain.
- [ ] **`npm test -- --run src/lib/arenaCredBurn.test.ts`** — frontend burn helper matches `CRED_PER_CHARM_WAD`.
- [ ] `cast call TimeArena.CRED_PER_CHARM_WAD` → **100e18**; `buyWithCred(1e18)` decreases wallet CRED by **100e18**.
- [ ] First buy: `epochFixedCredBonus[lastBuyEpoch+1][wallet] == 150e18`; second buy from same wallet does **not** add another 150.
- [ ] First buy in hard-reset band: bonus targets **post-reset** `lastBuyEpoch + 1` (`test_first_buy_hard_reset_targets_post_epoch`).
- [ ] `claimCred(epoch)` mints pro-rata + bonus; bonus-only claim (no CHARM in epoch) mints **150e18**; reverts while `epoch >= lastBuyEpoch`.
- [ ] DOUB path still adds **35 CRED** to `epochCredPool` per buy; CRED path does **not** accrue pool.
- [ ] **`buyWithCred`** has no referral CRED path ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272)).

**Automated:** `TimeArena.t.sol::test_buyWithCred_*`, `test_first_buy_*`, `test_claim_cred_*` · `bash scripts/verify-cred-buy-anvil.sh` · `arenaCredBurn.test.ts`.

<a id="manual-qa-issue-271"></a>

### Per-podium timer params ([GitLab #271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271))

**Scope:** Each podium category has independent extension, initial timer, cap, and hard-reset bands onchain. One buy extends **all four** settlement deadlines by category-specific rules. **Scoring** (Time Booster, Defended Streak, WarBow BP) still uses **Last Buy (cat 0)** timer only.

### Authoritative docs

- [time-arena § timers](../product/time-arena.md) · [arena-v2 § timers](../product/arena-v2.md#timers-last-buy--four-podiums)
- [`ArenaPodiumTimerConfig.sol`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol) · [`PARAMETERS.md`](../../contracts/PARAMETERS.md)
- [`INV-TIME-ARENA-PODIUM-TIMER-PARAMS`](invariants-and-business-logic.md#timearena-podium-timers-gitlab-271) · [`INV-TIME-ARENA-SCORING-LAST-BUY-TIMER`](invariants-and-business-logic.md#timearena-podium-timers-gitlab-271)
- [play-time-arena-doub § Timer](../../skills/play-time-arena-doub/SKILL.md)

### Checklist

- [ ] **`FOUNDRY_PROFILE=ci forge test --match-contract TimeArenaTest`** — includes `test_start_arena_initial_deadlines_differ_by_category`, `test_multi_podium_deadline_extend`, `test_time_booster_hard_reset_band_240_to_300`, scoring hook tests.
- [ ] **`bash scripts/verify-podium-timers-anvil.sh`** — fresh Anvil DeployDev: distinct initial deadlines, per-category extensions, Time Booster hard-reset band.
- [ ] After `startArena`, four `podiumDeadline[i]` differ (24h / 12h / 18h / 48h offsets from `arenaStart`).
- [ ] One buy extends cats by +120 / +60 / +90 / +300 respectively (`test_multi_podium_deadline_extend`).
- [ ] Time Booster: remaining &lt; 240s → snap to 300s from `block.timestamp`, not +60s extension.
- [ ] WarBow BP reset bonus requires **Last Buy** hard reset, not WarBow timer band alone.
- [ ] Defended streak window uses Last Buy remaining, not other podium timers.
- [ ] `lastBuyEpoch` bumps only on Last Buy hard reset; other podium hard resets do not roll CHARM/CRED epoch.
- [ ] **`GET /v1/arena/timers`** (with indexer + Anvil): `podium_deadlines_sec` has four distinct values at arena start.
- [ ] **`/arena`** timer chips (`ArenaTimerChips`) show distinct countdowns for Time Booster / Defended Streak / WarBow.
- [ ] Buy checkout preview shows Last Buy timer/scoring effects; settlement note: all four podium deadlines extend per [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol).

**Automated:** `TimeArena.t.sol::test_*` (see above) · `bash scripts/verify-podium-timers-anvil.sh` · `ArenaTimerChips.test.tsx`.

<a id="manual-qa-issue-275"></a>

### Contract fork smoke — optional MegaETH RPC ([GitLab #275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275))

**Scope:** [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) (`TimeArenaForkTest`) is the only CI-matched optional RPC fork smoke. Default **`unit-tests`** leaves `FORK_URL` unset so both tests **no-op** (deterministic PR gate). Live connectivity is opt-in via local env or the **`contract-fork-smoke`** workflow (`workflow_dispatch` only).

### Authoritative docs

- [`INV-CONTRACTS-275-FORK-SMOKE`](invariants-and-business-logic.md#contract-fork-smoke-optional-gitlab-275) · [contract-fork-smoke.md](contract-fork-smoke.md) · [CI mapping](ci.md)
- [`.github/workflows/contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml) · [`contracts/.env.example`](../../contracts/.env.example)
- [script-with-timearena-local § fork smoke](../../skills/script-with-timearena-local/SKILL.md) (contributors)

### Checklist

- [ ] **`bash scripts/check-megaevm-contract-sizes.sh`** — all `src/` artifacts within MegaEVM 512 KiB / 536 KiB initcode limits (`TimeArena` exceeds vanilla EIP-170 but passes).
- [ ] **`bash scripts/verify-contract-fork-smoke.sh`** — passes with `FORK_URL` unset (no-op gas ~3.8k per test).
- [ ] **`export FORK_URL=<megaeth-testnet-rpc> && bash scripts/verify-contract-fork-smoke.sh`** — fork selects chain; `test_fork_smoke_chainIdAndBlock` asserts positive `chainid` / `block.number`.
- [ ] **`FOUNDRY_PROFILE=ci forge test`** (full suite, `FORK_URL` unset) — `TimeArenaForkTest` no-ops inside the run; no fork URL required for merge gate.
- [ ] Grep workflow, `contracts/README.md`, `contracts/.env.example` — no `TimeCurveForkTest` / `TimeCurveFork.t.sol` (historical `audits/` exempt).
- [ ] Dispatch **`contract-fork-smoke`** with valid RPC input or repository secret `FORK_URL` — job runs MegaEVM size gate + `--match-contract TimeArenaForkTest` and succeeds.
- [ ] After mainnet Arena deploy ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)): set `TIME_ARENA_FORK_ADDRESS=<proxy>` and re-run; `test_fork_smoke_timeArenaHeadState` reads `paused()` / `deadline()` when bytecode is present.

**Automated:** `bash scripts/verify-contract-fork-smoke.sh` · `TimeArenaFork.t.sol` · **`contract-fork-smoke`** workflow.

<a id="manual-qa-issue-273"></a>

### Live podium predictions ([GitLab #273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273))

**Scope:** `GET /v1/arena/podiums` returns UX-ordered live top-3 from Postgres (`idx_arena_podium_live` + WarBow `idx_warbow_epoch_score`) while the arena is live. Requires working **`chain_timer`** head poller (schema **≥ 2.5.0**).

### Authoritative docs

- [`INV-INDEXER-PODIUM-PREDICT-LIVE`](invariants-and-business-logic.md#indexer-live-podium-predictions-gitlab-273) · [design § live podiums](../indexer/design.md#timecurve-podiums-http)
- [`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs) · [`usePodiumReads.ts`](../../frontend/src/pages/arena/usePodiumReads.ts)
- [play-active-time-arena § Indexer](../../skills/play-active-time-arena/SKILL.md)

### Checklist

- [ ] **`YIELDOMEGA_PG_TEST_URL=… cargo test --test integration_stage2`** — includes `arena_podiums_live_predictions_smoke`.
- [ ] **`bash scripts/verify-podium-live-anvil.sh`** — DeployDev + indexer ingest + `GET /v1/arena/podiums` matches block-tagged `podium()` (Last Buy / Time Booster) and `battlePoints` (WarBow).
- [ ] Empty DB + live chain: four UX rows, head `epoch` per category, `podium_prediction: false` until first qualifying ingest.
- [ ] After 3+ DOUB buys: Last Buy row `podium_prediction: true`; winners match `cast call podium(0)` at `read_block_number`.
- [ ] WarBow row shows non-zero leaders mid-epoch when `idx_warbow_epoch_score` has data even if head `podium(3)` is empty.
- [ ] Row order: Last Buy · WarBow · Defended Streak · Time Booster (`category_index` 0 · 3 · 2 · 1).
- [ ] **`/arena`** podium cards (with `VITE_INDEXER_URL`) match indexer response for the same block.

**Automated:** `integration_stage2.rs` · `bash scripts/verify-podium-live-anvil.sh` · `indexer/README.md` § live podiums.

<a id="manual-qa-issue-262"></a>

### Arena AUDIT — donate to pools ([GitLab #262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

**Scope:** Permissionless **`topUpPodiumPools`** sponsorship card on **`/arena/protocol`** with indexer-backed history ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261) onchain).

### Authoritative docs

- [arena-views § donate-pools](../frontend/arena-views.md#protocol-donate-pools-gitlab-262)
- [INV-INDEXER-262-DONATE-POOLS](invariants-and-business-logic.md#arena-podium-pool-donations-gitlab-262) · [INV-FRONTEND-262-DONATE-POOLS](invariants-and-business-logic.md#arena-podium-pool-donations-gitlab-262)
- [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md)

### Checklist

- [ ] **`/arena/protocol`**: **`data-testid="arena-protocol-donate-pools"`** visible; required no-benefit disclosure shown **without** connecting a wallet.
- [ ] Indexer unset/offline: totals show **`EmptyDataPlaceholder`** (—), not fabricated zeros ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)).
- [ ] Connected wallet on chain **31337**: DOUB approve + **Donate to pools** succeeds; card refetches **`GET /v1/arena/podium-pool-donations`** totals.
- [ ] Recent donations row opens wallet profile modal when **`onOpenWalletProfile`** wired ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)).
- [ ] Wrong network: write UI gated by **`ChainMismatchWriteBarrier`** ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)).

**Automated:** `ArenaProtocolDonatePoolsSection.test.tsx`, `integration_stage2.rs` (`api_podium_pool_donations_smoke`), `forge test --match-test test_topUpPodiumPools`, [`arena.spec.ts`](../../frontend/e2e/arena.spec.ts) AUDIT card visibility, [`scripts/verify-donate-pools-anvil.sh`](../../scripts/verify-donate-pools-anvil.sh) (Anvil ingest + HTTP totals).

<a id="manual-qa-issue-253"></a>

### Referrals — Play CRED earnings ([GitLab #253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253))

**Scope:** Arena v2 referred buys mint **Play CRED** (not CHARM weight); indexer + **`/referrals`** surface CRED totals.

### Authoritative docs

- [referrals.md — Arena v2](../product/referrals.md)
- [INV-REFERRAL-253-CRED](invariants-and-business-logic.md#referral-cred-split-gitlab-253)

### Checklist

- [ ] **`bash scripts/verify-referral-flat-cred-anvil.sh`** — fresh Anvil DeployDev: flat **5 CRED** per side on referred DOUB buy; **`buyWithCred`** mints no referral CRED ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272)).
- [ ] **`FOUNDRY_PROFILE=ci forge test --match-test test_referred_buy_mints_cred_not_charm`** and **`test_self_referral_reverts`** pass.
- [ ] After a referred **`TimeArena.buy(charmWad, codeHash)`**, **`ReferralCredApplied`** indexes to **`idx_arena_referral_cred`**; **`GET /v1/referrals/applied`** returns **`referrer_cred`** / **`buyer_cred`** (= **5e18** each — flat **`REFERRAL_CRED_FLAT_WAD`**, [#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272)).
- [ ] **`GET /v1/referrals/wallet-cred-summary?wallet=<referrer>`** shows **`referrer_cred_wad > 0`** after a qualifying buy.
- [ ] **`/referrals`** **Your earnings** panel labels **CRED** (not CHARM); **Guide leaderboard** ranks by **CRED**.
- [ ] **`codeHash → owner`** preserved across **`ReferralRegistry`** UUPS upgrade; fresh deploy requires re-registration (see [referrals.md § continuity](../product/referrals.md)).

**Automated:** `TimeArena.t.sol` referral tests · `bash scripts/verify-referral-flat-cred-anvil.sh` · `integration_stage2` persist smoke · Playwright **`referrals-surface.spec.ts`** · `arenaV2SaleSessionBridge.test.ts`.

---
<a id="manual-qa-issue-80"></a>

## Arena sniper-shark UI (GitLab #80)

**Scope:** Visual QA on the issue #80 sniper-shark cutout — not wallet balances or onchain rules.

### Truth order

1. [arena-views — Arena sniper-shark](../frontend/arena-views.md#arena-sniper-shark-cutout-issue-80)
2. [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
3. `TimeArenaPage.tsx` and `CutoutDecoration.tsx`

### Checklist

- [ ] Open `/arena` on desktop width.
- [ ] Confirm the **only** shark is `sniper-shark-peek-scope.png` on the Arena **Buy CHARM** panel.
- [ ] Shark does not cover the buy CTA, pay mode controls, WarBow flag option, rate board, or error text.
- [ ] Home and header/footer do **not** gain shark cutouts outside **`/arena`** buy panel.
- [ ] Decorative: no spoken label; headings/buttons remain a11y source of truth.
- [ ] `prefers-reduced-motion`: page usable without shark animation.
- [ ] Mobile 390×844: cutouts hidden; buy panel readable.

<a id="manual-qa-issue-81"></a>

## Single-chain wagmi — no stray mainnet RPC (GitLab #81)

**Why:** Extra chains caused viem to probe **`https://eth.merkle.io`** during local QA.

### Checklist

1. **Stack:** `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` (or usual Anvil path). Confirm **`VITE_CHAIN_ID=31337`** and **`VITE_RPC_URL`** when the script writes `frontend/.env.local`.
2. **Frontend:** `cd frontend && npm run dev`, open `http://127.0.0.1:5173/arena`.
3. **Wallet:** Connect on **31337**.
4. **Network tab:** Filter **`merkle`** → **no** requests to that host.
5. **Console:** No repeated CORS errors referencing **`eth.merkle.io`**.

**Defaults:** Unset **`VITE_CHAIN_ID`** / **`VITE_RPC_URL`** → **31337** + **`http://127.0.0.1:8545`**.

**Doc map:** [`wallet-connection.md`](../frontend/wallet-connection.md) · [invariants — #81](invariants-and-business-logic.md#frontend-single-chain-wagmi-issue-81)

<a id="manual-qa-issue-199-home-route-launchgate"></a>

## `LaunchGate` `/home` hub route — no-env + post-launch (GitLab #199)

**Why:** Without **`VITE_LAUNCH_TIMESTAMP`**, the marketing hub lives at **`/`**. **`ROUTES_NO_ENV`** previously omitted **`path: "home"`**, so **`http://127.0.0.1:<port>/home`** matched **`RootLayout`** but rendered an **empty** `<Outlet />` (shell + green grid only). Post-launch builds already map **`/home` → `HomePage`**.

### Checklist

1. **No-env:** `cd frontend && npm run dev` with **no** `VITE_LAUNCH_TIMESTAMP` in `.env` / `.env.local`.
2. Open **`/home`** (e.g. `http://127.0.0.1:5173/home`).
3. Expect **`YieldOmega`** hero **`h1`**, hero art, **Open TimeCurve** CTA, and **surface cards** — same hub as **`/`** (not a blank main).
4. **`/`** still shows the same hub; **no** double layout (single **`RootLayout`** outlet).
5. **Post-launch (optional):** rebuild with **`VITE_LAUNCH_TIMESTAMP`** in the **past** → **`/`** is Arena, **`/home`** is still the full hub.

**Doc map:** [`arena-views.md` — LaunchCountdown → Simple handoff](../frontend/arena-views.md#launchcountdown--simple-handoff) · [invariants — #199](invariants-and-business-logic.md#launchgate-home-route--no-env-parity-gitlab-199) · [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx)

<a id="manual-qa-issue-223"></a>

## Wrong-network write gating (GitLab #95)

Participant / QA checklist: the app must **not** send calldata built from this deployment’s env when the wallet is on **another** `chainId`.

### Preconditions

1. Local stack or preview with known **`VITE_CHAIN_ID`** (default dev **31337**).
2. A wallet that can switch between **two** chains.

### Manual steps

1. Connect on the **correct** target chain → **`/arena`**: buys work when not **`paused`**.
2. Switch wallet to a **wrong** chain:
   - **`/arena`:** **`timecurve-arena-buy-chain-write-gate`**, **`data-testid="switch-to-target-chain"`**, WarBow gates as documented.
   - **`/referrals`:** **`referrals-register-chain-write-gate`**.
   - **`/vesting`:** **`presale-vesting-chain-write-gate`**.
3. **Switch to …** → return to **`VITE_CHAIN_ID`** → overlays clear.
4. **`/kumbaya`**, **`/sir`:** outbound links only — not #95-gated writes.

### Code references

- [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) · [`chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts)
- [`ChainMismatchWriteBarrier.tsx`](../../frontend/src/components/ChainMismatchWriteBarrier.tsx), [`SwitchToTargetChainButton.tsx`](../../frontend/src/components/SwitchToTargetChainButton.tsx)

**Doc map:** [`wallet-connection.md`](../frontend/wallet-connection.md#wrong-network-write-gating-issue-95) · [`arena-views.md`](../frontend/arena-views.md#wrong-network-write-gating-issue-95) · [invariants — #95](invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95) · [§ #106 — `/vesting` claim race](#manual-qa-issue-106)

<a id="manual-qa-issue-194-arena-buy-chain-visual"></a>

## Arena `Buy CHARM` — wrong-chain visual parity (GitLab #194)

**Why:** The Arena **arcade** primary CTA already respected **`chainMismatch`** in its **`disabled`** prop, but the **gold / motion** affordance could still read as “press me” compared with **`btn-secondary`** settlement CTAs under the same wrong-network state ([GitLab #194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194)).

### Preconditions

Same as [#95](#manual-qa-issue-95): local stack with default **31337** target (or a known **`VITE_CHAIN_ID`**) and a wallet that can switch chains.

### Manual steps

1. Open **`/arena`** with the wallet on the **correct** target chain — **Buy CHARM** shows normal **arcade** styling and hover lift (unless reduced motion).
2. Switch to a **wrong** chain — **`timecurve-arena-buy-chain-write-gate`** overlay; **`data-testid="arena-arena-buy-charm-cta"`** is **dimmed**, **`disabled`**, with **`chainMismatchWriteMessage`** as native **`title`**.
3. Switch back to the build target chain — **Buy CHARM** regains normal styling.

### Code references

- [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) · [`index.css`](../../frontend/src/index.css) (`arena-simple__cta--wrong-network`)
- [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts)

**Doc map:** [`arena-views.md` §194](../frontend/arena-views.md#arena-buy-charm-wrong-chain-visual-gitlab-194) · [invariants — `INV-FRONTEND-194-ARENA-BUY-CHAIN`](invariants-and-business-logic.md#arena-buy-charm-wrong-chain-visual-gitlab-194)

<a id="manual-qa-issue-144-wallet-session-drift-on-buy"></a>

## Arena buy — wallet session drift mid-flow (GitLab #144)

**Why:** Multi-step pay paths on **`/arena`** may issue several signed txs before the final buy. Switching wallet accounts or chains mid-flow must **abort** with **`Wallet or network changed during purchase — please retry from the beginning.`**

### Preconditions

1. Local stack or testnet where **`/arena`** buys work (not **`paused`**; Kumbaya env if testing ETH/USDM).
2. A wallet with **two accounts** on the **same** target **`VITE_CHAIN_ID`** (e.g. MetaMask / Rabby).

### Manual steps

1. **Happy path:** Complete one **DOUB** (or CL8Y) buy on **`/arena`** without switching accounts — no regression.
2. **Account switch (two-step ETH/USDM or CL8Y if multi-step):** Start a buy that pauses between steps (e.g. after wrap or after **first** confirmation). Switch to **another account** in the extension before the next signature — expect **aborted** flow and the **#144** error string in buy error state (`buyError` / `buyErr`); **no** successful buy attributed to the original account without user retry from scratch.
3. **Network switch:** On target chain, begin a multi-step buy, then switch the wallet to **another chain** before the next step — expect the same **#144** message (or **#95** wrong-network preflight if the switch happens before guarded steps; either is acceptable UX as long as the user is not led through a mixed-wallet success).
4. **Kumbaya / ETH path:** When enabled, switching account between approve and router steps should still **abort** per guards.

### Code references

- [`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts) · [`arenaV2SaleSessionBridge.ts`](../../frontend/src/pages/arena/arenaV2SaleSessionBridge.ts)

**Doc map:** [`wallet-connection.md` § #144](../frontend/wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144) · [invariants — #144](invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144)

<a id="manual-qa-issue-155-referral-register-wallet-session-drift"></a>

## Referral registration — wallet session drift mid-flow (GitLab #155)

**Why:** **`ReferralRegisterSection`** runs **`allowance` → optional CL8Y `approve` → `registerCode`** across multiple awaits. Switching wallet accounts or **`chainId`** mid-flow must **abort** with **`Wallet or network changed during purchase — please retry from the beginning.`** (same **`WALLET_BUY_SESSION_DRIFT_MESSAGE`** as [#144](#manual-qa-issue-144-wallet-session-drift-on-buy)), and must **not** call **`setStoredMyReferralCodeForWallet`** under the wrong wallet key.

### Preconditions

1. Local stack with **`VITE_REFERRAL_REGISTRY_ADDRESS`** from **`DeployDev`**.
2. Wallet **A** with CL8Y balance ≥ **`registrationBurnAmount`** on the target chain (and same wallet **B** if testing account switch).

### Manual steps

1. **Happy path:** Connect wallet **A**, enter a fresh normalized code, **Register & burn CL8Y** without switching accounts — registration succeeds; **`yieldomega.myrefcode.v1.<walletA>`** holds the plaintext when applicable.
2. **Account switch:** Connect **A**, enter a code, click **Register**. After the **first** wallet prompt (e.g. approve) but **before** **`registerCode`** confirms, switch to wallet **B** in the extension — expect **Could not register:** … **`Wallet or network changed during purchase — please retry from the beginning.`** Inspect **Application → Local Storage** — no new **`myrefcode`** entry keyed to **A** from this aborted attempt alone (storage must stay aligned with the signing wallet).
3. **Network switch:** On target chain, start registration, then switch the wallet to **another chain** before the next signature — same **#155** message (or **#95** preflight if the switch happens before guarded steps).

### Code references

- [`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts) · [`referralRegisterWalletSession.test.ts`](../../frontend/src/pages/referrals/referralRegisterWalletSession.test.ts)
- [`ReferralRegisterSection.tsx`](../../frontend/src/pages/referrals/ReferralRegisterSection.tsx)

**Doc map:** [`wallet-connection.md` § #155](../frontend/wallet-connection.md#wallet-session-continuity-during-referral-register-gitlab-155) · [invariants — #155](invariants-and-business-logic.md#referral-registration-wallet-session-drift-gitlab-155)

<a id="manual-qa-issue-106"></a>

## Presale vesting — wagmi claim error clears on target return (GitLab #166)

This is **checklist item 4** under [§ #106 — claim chain mismatch](#manual-qa-issue-106). **Why:** wagmi's **`useWriteContract` `error`** could persist after switching back to **`VITE_CHAIN_ID`**; **`reset()`** runs only on a **wrong-chain → target** transition so same-chain rejects still surface until retry or success.

**Vitest:** [`presaleVestingWriteErrorChainReset.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingWriteErrorChainReset.test.ts)

<a id="manual-qa-issue-145"></a>

## Presale vesting `/vesting` (GitLab #92)

### Preconditions

- **`VITE_DOUB_PRESALE_VESTING_ADDRESS`** = **ERC-1967 proxy** ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).
- RPC + chain id match deployment.
- Anvil: [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) or [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh) for vesting env line.

### Checklist

1. **Hidden nav:** `/vesting` not in primary nav.
2. **Direct URL** loads; heading **Presale vesting**.
3. **Contract block:** proxy + **DOUB `token()`** as read-only hex.
4. **Schedule:** 30% + 70% linear copy matches `vestingDuration()`.
5. **Dual clock:** Local + UTC after `startVesting`.
6. **Wallet:** allocation / claimed / claimable match `cast` / explorer.
7. **`claimsEnabled` false:** Claim disabled; messaging references signoff ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)).
8. **`claimable > 0`:** **Claim DOUB** submits `claim()`.
9. **Wrong-chain race (#106):** If **Claim** is clicked after a **network switch** before the UI re-disables the button, expect an in-panel **`Wrong network:`** **`StatusMessage`** (same family as Simple buy / referrals) — [dedicated checklist § #106](#manual-qa-issue-106).
10. **Claim RPC leak (#145):** Claim failures must **not** print raw RPC URLs — see [§ #145](#manual-qa-issue-145).

**Automated:** [`anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts) via `bash scripts/e2e-anvil.sh`.

<a id="manual-qa-issue-202-presale-charm-registry"></a>

## Indexer offline UX (GitLab #96)

Use after changes to **`VITE_INDEXER_URL`** polling, **`IndexerStatusBar`**, or arena timer / buy fetch hooks.

### Checklist

1. **Baseline:** **`/arena`** indexer pill **live** (when indexer configured).
2. **Stop indexer** or block **`127.0.0.1:3100`** — wait **~3–5 s**.
3. Pill **Indexer offline · retrying** on Simple + footer routes.
4. **Network:** polls **not** hammering at 1s indefinitely — backoff steps **5s → 15s → 30s** after failures.
5. **Recent buys:** **Cannot reach indexer · cached data may be stale**, not **Waiting for the first buy** when empty/offline.
6. **Recovery:** indexer back → pill **live**.

**Doc map:** [arena-views — #96](../frontend/arena-views.md#indexer-offline-ux-issue-96) · [invariants — #96](invariants-and-business-logic.md#indexer-offline-ux-and-backoff-gitlab-96)

<a id="manual-qa-issue-97"></a>

## Keyboard focus visible — WCAG 2.4.7 (GitLab #97)

### Checklist

1. **`/arena`:** **Tab** through controls — visible **`:focus-visible`** ring (`--yo-focus-ring`).
2. **Connect modal:** Tab through **`[data-rk]`** controls — same focus family.
3. **Contrast:** Ring visible on light and green chrome.

**Doc map:** [design — Accessibility](../frontend/design.md#accessibility-and-ux) · [`wallet-connection.md`](../frontend/wallet-connection.md) · [invariants — #97](invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97)

<a id="manual-qa-issue-163"></a>

## Placeholder split-layout hero figure — wide / landscape (GitLab #163)

**Why:** [`UnderConstruction`](../../frontend/src/pages/UnderConstruction.tsx) and [`ThirdPartyDexPage`](../../frontend/src/components/ThirdPartyDexPage.tsx) render **`.placeholder-figure`** beside **`PageSection`** inside **`.split-layout`**. Without **`align-self: start`**, the figure stretches with empty panel below the image.

### Checklist

1. **Desktop (width > ~720px, two columns):** Open **`/retired-v1-reserve`**, **`/collection`**, **`/kumbaya`**, **`/sir`** — the left image card’s **border** should hug the **image** (no tall empty green band inside the frame).
2. **Landscape phone / narrow-tall viewport** where the layout still uses **two columns:** same check — no interior gap between image bottom and card border.
3. **Narrow / stacked (`max-width: 720px`):** layout stacks to one column; image card still looks coherent (no overflow clipping).

**Doc map:** [design — Placeholder split panels](../frontend/design.md#placeholder-split-panels-gitlab-163) · [`placeholderSplitLayoutCss.test.ts`](../../frontend/src/lib/placeholderSplitLayoutCss.test.ts)

<a id="manual-qa-issue-198"></a>

## SFX — buy coin + WarBow twang (GitLab #68 / #108)

Spot-check after changing **`playGameSfx*`**, **`submitArenaKumbayaSingleTxBuy`**, **`useArenaSaleSession`**, **`useTimeCurveArenaModel`**, **`useArenaWarbowRankSfx`**, or **`WebAudioMixer` throttles**.

### Checklist

1. **`/arena` — DOUB/CL8Y path:** After signing the buy tx, a **shallow coin** plays **before** the receipt lands; **charmed** on success.
2. **ETH / USDM — single-tx router:** After signing **`buyViaKumbaya`**, the same **coin** fires once (not on wrap/approve-only steps in the two‑step fallback).
3. **Arena — WarBow podium:** **`warbow_twang`** fires only when the indexed ladder shows **top‑3 entry** (from unranked/deep) **or** a move **among ranks ≤3** (see `warbowRankSfxPolicy` — **no** stinger on e.g. **10 → 4**); **≤1** hit per **~18 s** throttle.
4. **Kumbaya whoosh:** Confirm **no** whoosh on mere **quote refresh** (still **unwired**).

**Spec:** [sound-effects §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)

**Automation:** [`warbowRankSfxPolicy.test.ts`](../../frontend/src/audio/warbowRankSfxPolicy.test.ts)

<a id="manual-qa-issue-103"></a>

## Mobile album dock vs nav chrome (GitLab #103)

**Goal:** On phone-sized breakpoints, the fixed **Blockie Hills** dock must **not** overlap the bordered **`RootLayout`** nav card (**`INV-AUDIO-103`**).

### Invariants

1. Scoped to **`max-width: 720px`** only — **`min-width: 721px`** header **`margin-top`** stays **`1rem`** (desktop rhythm unchanged).
2. **`margin-top`** formula matches **`mobileAlbumDockLayout.ts`** (`MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM`) and **`frontend/src/index.css`**.

### Checklist

- [ ] **~360–430px** width (DevTools or device): dock bubble sits **above** the cream nav card with a visible gap; no overlap at scroll rest.
- [ ] **~390×844** (common phone): same separation with expanded dock controls (chevron open) — card edge remains clear.
- [ ] **Tablet / desktop** (`≥721px`): header vertical rhythm matches pre-change (no unexpected extra top gap vs production baseline).
- [ ] **Optional:** `cd frontend && npm run test -- src/audio/mobileAlbumDockLayout.test.ts` (Vitest asserts **`index.css`** **`+ Nrem`** ↔ TS constant — [GitLab #107](https://gitlab.com/PlasticDigits/yieldomega/-/issues/107))

**Doc map:** [sound-effects §8 — mobile dock](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)

<a id="manual-qa-issue-171"></a>

## Header mascot vs nav clearance (GitLab #171)

**Goal:** On desktop and landscape widths, the decorative header mascot must not overlap primary nav hit targets (including **Arena**).

### Invariants

1. `.app-header__brand` reserves the mascot footprint through `--app-header-mascot-clearance`; the absolute mascot stays inside that reserved gutter.
2. `.app-header__mascot` is decorative and **`pointer-events: none`**, so it cannot intercept clicks even while visually near nav.
3. At **`max-width: 720px`**, the mascot remains hidden and the reserved gutter resets to zero so mobile nav keeps its full width.

### Checklist

- [ ] Desktop width (`≥1024px`): **YieldOmega**, status badges, **Arena** nav, and wallet controls have a visible gap from the mascot.
- [ ] Landscape tablet width (`721–1023px`): if the header wraps, the mascot does not cover nav text, focus rings, or pointer hit areas.
- [ ] Narrow width (`≤720px`): mascot is hidden; nav stays a three-column grid with no empty mascot gutter.
- [ ] Keyboard Tab through the header: focus ring on **Arena** nav is fully visible and not covered by the mascot.
- [ ] Optional: `cd frontend && npm run test -- src/layout/headerLayoutCss.test.ts`.

**Doc map:** [frontend design — global header layout](../frontend/design.md#accessibility-and-ux)

<a id="manual-qa-issue-104"></a>

## Local full stack QA orchestrator (GitLab #104)

**Goal:** One entrypoint brings up **Postgres + Anvil + DeployDev + indexer + `frontend/.env.local`**, then **optionally** backgrounds **Vite** — without duplicating stack logic. Full runbook: [`qa-local-full-stack.md`](qa-local-full-stack.md).

### Invariants

1. [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) invokes [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) only for chain/indexer work.
2. **Playwright** full E2E remains [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) — not part of this orchestrator.

### Checklist

- [ ] `bash scripts/start-qa-local-full-stack.sh --help` prints usage only — **must not** contain **`set -euo pipefail`** ([GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)).
- [ ] From repo root: `bash scripts/start-qa-local-full-stack.sh` completes without error (or your chosen flags: `--no-frontend`, `--live-sale`, `--kumbaya`, `--no-swarm`).
- [ ] `cast block-number --rpc-url "$(grep '^VITE_RPC_URL=' frontend/.env.local | tail -1 | cut -d= -f2-)"` succeeds.
- [ ] `grep '^VITE_INDEXER_URL=' frontend/.env.local` — `curl -sf "<url>/v1/status"` returns OK.
- [ ] `curl -s "$(grep '^VITE_INDEXER_URL=' frontend/.env.local | tail -1 | cut -d= -f2-)/v1/arena/buys?limit=5" | jq .` — valid JSON array.
- [ ] With default frontend start: `http://127.0.0.1:${FRONTEND_DEV_PORT:-5173}/` responds (or run Vite manually after `--no-frontend`).
- [ ] Optional: `make check-frontend-env` passes.
- [ ] `bash scripts/verify-qa-orchestrator-frontend-trap.sh` prints **`OK:`** (hermetic trap + PID kill smoke for [GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)).
- [ ] **Stop / teardown:** PIDs in [`qa-local-full-stack.md — Stopping`](qa-local-full-stack.md#stopping-the-stack) match your processes.

**Doc map:** [invariants — #104 / #105 / #153](invariants-and-business-logic.md#qa-local-full-stack-orchestrator-gitlab-104) · [issue #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104) · [issue #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105) · [issue #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)

<a id="manual-qa-issue-120-accesscontrol-zero-admin-derived-layers"></a>

## AccessControl zero admin — derived read model / UX layers (GitLab #120)

**Why:** Solidity **`INV-AC-ZERO-ADMIN-120`** closes the deploy-time footgun in **`constructor` / `initializer`** scope ([`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol)). A reverting initialize emits **no** protocol logs—the **indexer** cannot surface “attempted zero admin,” and the **static frontend** does not add a dedicated AccessControl probe at boot.

### Invariants (do not regress)

1. **`INV-INDEXER-120-DEPLOY`** — Do not expect Postgres or HTTP API rows that detect a **failed** zero-admin deploy; evidence is **Forge** + **successful** chain bytecode.
2. **`INV-FRONTEND-120-DEPLOY`** — Do not add silent assumptions that “indexer empty” implies bad admin wiring; mis-set **`VITE_*`** or wrong proxy remains an **RPC / reads** problem.

### Checklist

- [ ] `cd contracts && FOUNDRY_PROFILE=ci forge test --match-path test/AccessControlZeroAdmin.t.sol -vv` — **all** zero-admin tests **revert** as expected (no behavior change for valid admins).
- [ ] Read [`indexer/README.md` — #120](../../indexer/README.md#accesscontrol-zero-admin-gitlab-120) and [`docs/indexer/design.md`](../indexer/design.md#accesscontrol-zero-admin-gitlab-120): confirm deploy-boundary wording matches **no-log** reality.
- [ ] Read [`docs/frontend/wallet-connection.md` — #120](../frontend/wallet-connection.md#accesscontrol-zero-admin-deployment-gitlab-120): confirm frontend **does not** claim indexer-backed detection of zero admin.

**Doc map:** [indexer README — #120](../../indexer/README.md) · [wallet-connection — #120](../frontend/wallet-connection.md) · [skills README](../../skills/README.md)

<a id="manual-qa-issue-142"></a>

## Indexer production `DATABASE_URL` placeholders (GitLab #142)

**Goal:** Production operators must not boot the indexer with copy-pasted template credentials from [`indexer/.env.example`](../../indexer/.env.example). **`INDEXER_PRODUCTION=1`** (see [`indexer/README.md`](../../indexer/README.md)) fails fast when **`DATABASE_URL`** contains forbidden substrings ([`INV-INDEXER-142`](invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)).

### Checklist

- [ ] From `indexer/`, with a **real** Postgres URL (not containing **`CHANGE_ME_BEFORE_DEPLOY`** or **`user:password@`**-style trivial passwords) and **`CORS_ALLOWED_ORIGINS`**: `INDEXER_PRODUCTION=1 DATABASE_URL=… CORS_ALLOWED_ORIGINS=https://example.com …` — `cargo run` progresses past config (or use **`cargo test`** only for substring unit tests).
- [ ] Same shell, swap to `DATABASE_URL=postgres://u:CHANGE_ME_BEFORE_DEPLOY@localhost/db`: expect immediate error mentioning **forbidden placeholder** / **GitLab #142**.
- [ ] Open [`indexer/.env.example`](../../indexer/.env.example): confirm warnings above **`RPC_URL` / `CHAIN_ID`** and non-production-looking **`DATABASE_URL`**.

**Doc map:** [indexer README](../../indexer/README.md) · [invariants — #142](invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)

<a id="manual-qa-issue-156"></a>

