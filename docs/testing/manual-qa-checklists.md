# Manual QA checklists (contributors)

Procedural checklists for **maintainers and QA** live here. Root [`skills/`](../../skills/) is **player-facing only** ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)). **Product invariants** and spec ↔ test mapping remain in [`invariants-and-business-logic.md`](invariants-and-business-logic.md). **Contributor** agents: [Phase 14 — Testing strategy](../agent-phases.md#phase-14) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

## Table of contents

| Issue | Topic |
|-------|--------|
| [#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87) | [Anvil E2E Playwright](#manual-qa-issue-87) |
| [#88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88) | [DeployDev buy cooldown](#manual-qa-issue-88) |
| [#99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99) | [Bot swarm + Anvil chain time](#manual-qa-issue-99) |
| [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64) | [Referrals `/referrals` surface](#manual-qa-issue-64) |
| [#80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80) | [Arena sniper-shark UI](#manual-qa-issue-80) |
| [#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) | [Single-chain wagmi (no stray mainnet RPC)](#manual-qa-issue-81) |
| [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) | [Wrong-network write gating](#manual-qa-issue-95) |
| [#78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78) | [`TimeCurveBuyRouter` on Anvil](#manual-qa-issue-78) |
| [#82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) | [Buy CHARM submit-time sizing](#manual-qa-issue-82) |
| [#79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79) | [Post-end owner gates](#manual-qa-issue-79) |
| [#90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90) | [Simple stake panel after `redeemCharms`](#manual-qa-issue-90) |
| [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92) | [Presale vesting `/vesting`](#manual-qa-issue-92) |
| [#93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93) | [Fee sinks mobile + protocol labels](#manual-qa-issue-93) |
| [#98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98) | [Canonical address display + explorer base](#manual-qa-issue-98) |
| [#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96) | [Indexer offline UX](#manual-qa-issue-96) |
| [#97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97) | [Keyboard focus visible (WCAG 2.4.7)](#manual-qa-issue-97) |
| [#71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71) | [Album 1 BGM resume](#manual-qa-issue-71) |
| [#103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103) | [Mobile album dock vs nav chrome](#manual-qa-issue-103) |
| [#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104) (+ [#105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105) orchestrator **`--help`**) | [Local full stack QA orchestrator](#manual-qa-issue-104) |
| [#106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106) | [Presale vesting claim — chain mismatch feedback](#manual-qa-issue-106) |

Also see: [`e2e-anvil.md`](e2e-anvil.md), [`qa-local-full-stack.md`](qa-local-full-stack.md), [`anvil-rich-state.md`](anvil-rich-state.md), [`../integrations/kumbaya.md`](../integrations/kumbaya.md), [`../frontend/timecurve-views.md`](../frontend/timecurve-views.md), [`../frontend/wallet-connection.md`](../frontend/wallet-connection.md).

<a id="manual-qa-issue-87"></a>

## Anvil E2E Playwright (GitLab #87)

**Why:** [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) starts **one** Anvil, deploys `DeployDev`, builds the app with `VITE_*`, and runs `e2e/anvil-*.spec.ts` with **`ANVIL_E2E=1`**. Specs share **one chain** and the wagmi **mock** account — multi-worker Playwright can **race** unrelated files.

### Invariants (do not regress)

1. With **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) uses **`workers: 1`** and **`fullyParallel: false`**. Do not raise Anvil E2E workers without **isolation** (separate Anvil per worker or per project), or document why and get sign-off.
2. **Pay mode** on TimeCurve **Simple** and **Arena** is **toggle buttons**, not `<input name="timecurve-pay-with">`. Stable hooks: **`data-testid="timecurve-simple-paywith-cl8y"`**, **`…-eth`**, **`…-usdm`** on [`TimeCurveSimplePage`](../../frontend/src/pages/TimeCurveSimplePage.tsx) and [`TimeCurveArenaView`](../../frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx).
3. Wallet-write E2E ([`anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts)) must select ETH (or other assets) via **`getByTestId`** inside the **Buy CHARM** `.data-panel` scope, not dead CSS for removed radios.

### Checklist

- [ ] From repo root: `bash scripts/e2e-anvil.sh` completes **green** (Foundry + `npm ci` in `frontend/` as needed).
- [ ] If you only run Playwright manually: `cd frontend && ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1` after a matching build — confirm **one** worker in the list reporter or config.
- [ ] **ETH route** test: after **`timecurve-simple-paywith-eth`**, expect **Quoted ETH spend** (aria-label) and a resolved quoted amount (not `…`) before moving the slider; then **Buy CHARM** enabled after quote refresh (see [timecurve-views — Buy quote refresh](../frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56), issue #56).
- [ ] **Optional:** For **back-to-back buys** from the **same** mock wallet without real-time waits, deploy with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** ([issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)) — see [e2e-anvil — buy cooldown](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) and [DeployDev buy cooldown](#manual-qa-issue-88) below.

**Doc map:** [e2e-anvil — Concurrency](e2e-anvil.md#anvil-e2e-concurrency-gitlab-87) · [invariants — Anvil E2E](invariants-and-business-logic.md#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87)

<a id="manual-qa-issue-88"></a>

## DeployDev buy cooldown (GitLab #88)

**Why:** Default **`DeployDev`** sets **`TimeCurve.buyCooldownSec = 300`**. Manual checklists that need **several buys from the same wallet** are impractical without lowering the initializer argument.

### Invariants

1. **Default unchanged:** With no flags, **`buyCooldownSec`** stays **300** on fresh **`DeployDev`**.
2. **Never zero:** Resolver and **`TimeCurve.initialize`** require **`buyCooldownSec > 0`**. **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=0`** fails **`DeployDev`** before broadcast.
3. **Single source:** Env logic lives only in [`contracts/script/DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol); Forge coverage in [`DeployDevBuyCooldown.t.sol`](../../contracts/test/DeployDevBuyCooldown.t.sol) (`test_readBuyCooldownSec_env_resolution_matrix`).

### Flags

| Variable | Role |
|----------|------|
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | QA mode: default numeric cooldown becomes **1** s when **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** is unset. |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** | Explicit seconds (**> 0**). Applies in both branches; see [e2e-anvil.md](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) for defaults. |

### Checklist

- [ ] **`cast call <TimeCurveProxy> "buyCooldownSec()(uint256)" --rpc-url …`** returns **300** without flags, or your chosen override after a flagged deploy.
- [ ] After two quick buys from the same wallet (with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`**), second buy succeeds once **`block.timestamp >= nextBuyAllowedAt`** (1 s pacing).
- [ ] Production / unattended CI: **do not** export these flags unless the job intentionally tests short cooldowns.

**Bot swarm demos:** Prefer short cooldown alongside stack **[`--block-time`](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99)** defaults ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)) — [Bot swarm + Anvil chain time](#manual-qa-issue-99).

**Doc map:** [e2e-anvil — DeployDev buy cooldown](e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) · [invariants — #88](invariants-and-business-logic.md#deploydev-buy-cooldown-env-issue-88) · [primitives — Per-wallet buy cooldown](../product/primitives.md)

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
- [ ] With default swarm + default cooldown, wait **~2–5 minutes** after the initial burst: **Recent buys** / indexer **`/v1/timecurve/buys`** should still show **new** rows (chain time advances during sleeps).
- [ ] Optional dense traffic: re-run with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** — buys should arrive much more frequently.
- [ ] **`cast block-number`** / **`eth_getBlockByNumber(latest)`** `timestamp`: after **30–60** s idle, timestamps should increase (interval mining).

**Doc map:** [e2e-anvil — Bot swarm + chain time](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99) · [invariants — #99](invariants-and-business-logic.md#bot-swarm-anvil-interval-mining-issue-99) · [`bots/timecurve/README.md`](../../bots/timecurve/README.md)

<a id="manual-qa-issue-64"></a>

## Referrals `/referrals` surface (GitLab #64)

Use when an agent or human needs to **produce evidence** (screenshots or tx hashes) for the **seven-row** checklist tracked in [GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64).

### Authoritative docs

- [`launchplan-timecurve.md`](../../launchplan-timecurve.md#6-under-construction-frontend) — **`/referrals`** is **not** in the **`UnderConstruction`** set at TGE (**F-11** / [GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)); [`YO-DOUB-Launch-UX-Flows.md`](../../YO-DOUB-Launch-UX-Flows.md).
- [`docs/product/referrals.md`](../product/referrals.md) — code rules, link capture, **browser storage key table** (pending vs my-code — [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)).
- [invariants — Referrals page](invariants-and-business-logic.md#referrals-page-visual-issue-64).
- Contributor Anvil runbook: [e2e-anvil.md](e2e-anvil.md) (`bash scripts/e2e-anvil.sh`).

### Preconditions

- Frontend built with **`VITE_LAUNCH_TIMESTAMP` in the past** if you need the **post-launch** route tree.
- **`VITE_REFERRAL_REGISTRY_ADDRESS`** set **or** **`VITE_TIMECURVE_ADDRESS`** pointing at a TimeCurve whose **`referralRegistry()`** is non-zero.
- Wallet with **gas + CL8Y** for `registerCode` when exercising R4.
- **Leaderboard + indexed earnings:** [GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94) — verify indexer + `/referrals` panels when the stack has referral buys.

### Rows R1–R7

| Row | What to verify | Suggested evidence |
|-----|----------------|-------------------|
| **R1** | `/referrals` renders (`data-testid="referrals-surface"`) behind launch gate | Screenshot |
| **R2** | Connected wallet, **not** yet registered: burn copy + input + CTA | Screenshot |
| **R3** | Disconnected: wallet-gated placeholder | Screenshot |
| **R4** | Approve → `registerCode` → success → **`localStorage`** **`yieldomega.myrefcode.v1.<walletLowercase>`** vs pending **`yieldomega.ref.v1`** ([GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)) | Tx hash(es) + screenshot |
| **R5** | Registered: code visible + copy-able **path** and **`?ref=`** URLs | Screenshot |
| **R6** | Copy confirmation UX ([GitLab #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)) | Screenshot or recording |
| **R7** | Land with **`?ref=`**; pending capture under **`yieldomega.ref.v1`** | Screenshot + storage inspector |

### Automated regression

- CI: `frontend/e2e/referrals-surface.spec.ts`
- Anvil: `frontend/e2e/anvil-referrals.spec.ts`
- Unit: `frontend/src/lib/referralPathCapture.test.ts`

<a id="manual-qa-issue-80"></a>

## Arena sniper-shark UI (GitLab #80)

**Scope:** Visual QA on the issue #80 sniper-shark cutout — not wallet balances or onchain rules.

### Truth order

1. [timecurve-views — Arena sniper-shark](../frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80)
2. [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
3. `TimeCurveArenaView.tsx` and `CutoutDecoration.tsx`

### Checklist

- [ ] Open `/timecurve/arena` on desktop width.
- [ ] Confirm the **only** shark is `sniper-shark-peek-scope.png` on the Arena **Buy CHARM** panel.
- [ ] Shark does not cover the buy CTA, pay mode controls, WarBow flag option, rate board, or error text.
- [ ] Home, Simple, `/timecurve/protocol`, header/footer do **not** gain shark cutouts.
- [ ] Decorative: no spoken label; headings/buttons remain a11y source of truth.
- [ ] `prefers-reduced-motion`: page usable without shark animation.
- [ ] Mobile 390×844: cutouts hidden; buy panel readable.

<a id="manual-qa-issue-81"></a>

## Single-chain wagmi — no stray mainnet RPC (GitLab #81)

**Why:** Extra chains caused viem to probe **`https://eth.merkle.io`** during local QA.

### Checklist

1. **Stack:** `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` (or usual Anvil path). Confirm **`VITE_CHAIN_ID=31337`** and **`VITE_RPC_URL`** when the script writes `frontend/.env.local`.
2. **Frontend:** `cd frontend && npm run dev`, open `http://127.0.0.1:5173/timecurve/arena`.
3. **Wallet:** Connect on **31337**.
4. **Network tab:** Filter **`merkle`** → **no** requests to that host.
5. **Console:** No repeated CORS errors referencing **`eth.merkle.io`**.

**Defaults:** Unset **`VITE_CHAIN_ID`** / **`VITE_RPC_URL`** → **31337** + **`http://127.0.0.1:8545`**.

**Doc map:** [`wallet-connection.md`](../frontend/wallet-connection.md) · [invariants — #81](invariants-and-business-logic.md#frontend-single-chain-wagmi-issue-81)

<a id="manual-qa-issue-95"></a>

## Wrong-network write gating (GitLab #95)

Participant / QA checklist: the app must **not** send calldata built from this deployment’s env when the wallet is on **another** `chainId`.

### Preconditions

1. Local stack or preview with known **`VITE_CHAIN_ID`** (default dev **31337**).
2. A wallet that can switch between **two** chains.

### Manual steps

1. Connect on the **correct** target chain → **`/timecurve`**, **`/timecurve/arena`**: buys work when sale active.
2. Switch wallet to a **wrong** chain:
   - **`/timecurve`:** **Wrong network** overlay, **`data-testid="switch-to-target-chain"`**, **`timecurve-simple-chain-write-gate`**.
   - **`/timecurve/arena`:** **`timecurve-arena-buy-chain-write-gate`**, standings/WarBow gates as documented.
   - **`/referrals`:** **`referrals-register-chain-write-gate`**.
   - **`/vesting`:** **`presale-vesting-chain-write-gate`**.
3. **Switch to …** → return to **`VITE_CHAIN_ID`** → overlays clear.
4. **`/kumbaya`**, **`/sir`:** outbound links only — not #95-gated writes.

### Code references

- [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) · [`chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts)
- [`ChainMismatchWriteBarrier.tsx`](../../frontend/src/components/ChainMismatchWriteBarrier.tsx), [`SwitchToTargetChainButton.tsx`](../../frontend/src/components/SwitchToTargetChainButton.tsx)

**Doc map:** [`wallet-connection.md`](../frontend/wallet-connection.md#wrong-network-write-gating-issue-95) · [`timecurve-views.md`](../frontend/timecurve-views.md#wrong-network-write-gating-issue-95) · [invariants — #95](invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95) · [§ #106 — `/vesting` claim race](#manual-qa-issue-106)

<a id="manual-qa-issue-106"></a>

## Presale vesting — claim chain mismatch UX (GitLab #106)

**Why:** The **`Claim DOUB`** button is **`disabled`** when **`useWalletTargetChainMismatch()`** is true, but a wallet can **switch networks** between paint and click; the **`claim`** **`onClick`** must not **silently return** when **`chainMismatchWriteMessage(chainId)`** is set.

### Checklist

1. **`/vesting`** with vesting env + beneficiary wallet + **`claimable > 0`** on the target chain: **Claim DOUB** works when the wallet stays on **`VITE_CHAIN_ID`**.
2. **Race:** On target chain with **Claim** enabled, switch the wallet to **another** chain **immediately** click **Claim DOUB** before the overlay catches up — expect an **error** **`StatusMessage`** with **`Wrong network:`** … **`Switch to chain …`** (same copy family as Simple buy / referrals register).
3. **Recovery:** Use **Switch to …** / reconnect on target chain — gate error clears when back on target (**no** stale banner).

**Code:** [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx) · [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) · **Invariant:** [§ #106](invariants-and-business-logic.md#presale-vesting-claim-chain-preflight-gitlab-106) · [`presale-vesting.md` § UX](../frontend/presale-vesting.md)

<a id="manual-qa-issue-78"></a>

## `TimeCurveBuyRouter` on Anvil (GitLab #65 / #78 / #84)

One-shot PASS for **TimeCurveBuyRouter** + **DeployKumbayaAnvilFixtures**. See [invariants — #78](invariants-and-business-logic.md#timecurvebuyrouter-anvil-verification-issue-78), [kumbaya — localnet](../integrations/kumbaya.md#localnet-anvil).

### Preconditions

- Anvil with **`--code-size-limit 524288`**
- **TimeCurve proxy** in `YIELDOMEGA_TIMECURVE` or `contracts/deployments/local-anvil-registry.json`
- **`TimeCurve.ended() == false`**
- `cast`, `forge`, `jq` on PATH
- If **`timeCurveBuyRouter() == 0`**, set **`YIELDOMEGA_DEPLOY_KUMBAYA=1`**

### Command

```bash
export RPC_URL=http://127.0.0.1:8545
bash scripts/verify-timecurve-buy-router-anvil.sh
```

Then: registry **`TimeCurveBuyRouter`** must match `cast call` on TimeCurve; **restart indexer** after registry merge if needed.

**Browser / wallet flows** after **`anvil_increaseTime`:** see [Kumbaya swap deadline (#83)](#manual-qa-issue-82) and [kumbaya — Option B](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83).

<a id="manual-qa-issue-82"></a>

## Buy CHARM submit-time sizing (GitLab #82 / #83)

Use after changes to **`useTimeCurveSaleSession`**, **`useTimeCurveArenaModel`**, **`timeCurveBuySubmitSizing.ts`**, or **`revertMessage.ts`**.

**Authoritative invariants:** [invariants — #82](invariants-and-business-logic.md#timecurve-buy-charm-submit-fresh-bounds-issue-82) · [timecurve-views — fresh bounds](../frontend/timecurve-views.md#buy-charm-submit-fresh-bounds-issue-82) · [kumbaya — single-tx](../integrations/kumbaya.md#issue-65-single-tx-router) · [invariants — #83](invariants-and-business-logic.md#timecurve-kumbaya-swap-deadline-chain-time-issue-83)

### Preconditions

- **TimeCurve proxy**, sale **live**, wallet with **CL8Y** (and **ETH** / **USDM** for Kumbaya).
- For **single-tx `buyViaKumbaya`**: Kumbaya fixtures + non-zero `timeCurveBuyRouter()` — see [`TimeCurveBuyRouter` on Anvil](#manual-qa-issue-78).

### Checklist

1. **CL8Y direct (`buy`)** — Simple and Arena: slider near **upper** band; expect success or clear in-panel error, not bare unknown revert.
2. **Lower band edge** — Near **minimum** CHARM: success or clear copy; occasional retry if inclusion drifts.
3. **ETH / USDM single-tx** — Same near-max and near-min; tx **`charmWad`** matches post-refresh band.
4. **Slider vs calldata** — Onchain CHARM **≤** pre-sign display when band tightened.
5. **Unit tests:** `npx vitest run src/lib/timeCurveBuySubmitSizing.test.ts src/lib/revertMessage.test.ts src/lib/timeCurveKumbayaSwap.test.ts` (from `frontend/`).
6. **Warped Anvil (#83)** — No spurious **`AnvilKumbayaRouter` `Expired()`** from deadline vs `Date.now()`; see [kumbaya — Option B](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83).

<a id="manual-qa-issue-79"></a>

## Post-end owner gates (GitLab #79 / #55)

**cast-level evidence** for `redeemCharms` and `distributePrizes` with owner flags after **`endSale()`**.

### Authoritative docs

- [`docs/operations/final-signoff-and-value-movement.md`](../operations/final-signoff-and-value-movement.md)
- [invariants — post-end gates](invariants-and-business-logic.md#timecurve-post-end-gates-live-anvil-gitlab-79)
- [anvil-rich-state — Post-end walkthrough](anvil-rich-state.md#post-end-gate-walkthrough-issue-55--gitlab-79)

### One-command setup

```bash
export RPC_URL=http://127.0.0.1:8545
ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh
bash scripts/verify-timecurve-post-end-gates-anvil.sh
```

Use **TimeCurve proxy** (not implementation row from `run-latest.json` — [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

### Rows

| Row | Verify | Evidence |
|-----|--------|----------|
| **1** | `redeemCharms` reverts **`TimeCurve: charm redemptions disabled`** when gate off | Revert output |
| **2** | Owner enables → `redeemCharms` succeeds | Tx hash |
| **3** | `distributePrizes` reverts **`TimeCurve: reserve podium payouts disabled`** when pool **> 0** and gate off | Revert output |
| **4** | Owner enables → `distributePrizes` succeeds | Tx hash |

**Automated:** Forge tests in `TimeCurve.t.sol` (see invariants test map).

<a id="manual-qa-issue-90"></a>

## Simple stake panel after `redeemCharms` (GitLab #90)

### Preconditions

- Wallet **`charmWeight > 0`**, sale **ended**, **`charmRedemptionEnabled`** true, **`redeemCharms()`** succeeded.

### Checklist

1. **`/timecurve`:** Settlement CTA **Already redeemed**.
2. **Your stake at launch:** **Settled** badge + green check in section header.
3. **Redeemed** row: **DOUB** matches onchain formula.
4. **Worth at launch ≈** CL8Y **struck through**, labeled **(redeemed)** — not replaced by DOUB-only “worth at launch” copy.
5. Optional: **`data-testid="timecurve-simple-stake-redeemed-doub"`**.

**Doc map:** [timecurve-views — stake redeemed](../frontend/timecurve-views.md#timecurve-simple-stake-redeemed-issue-90) · [invariants — #90](invariants-and-business-logic.md#timecurve-simple-stake-redeemed-issue-90) · [`TimeCurveStakeAtLaunchSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx)

<a id="manual-qa-issue-92"></a>

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

**Automated:** [`anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts) via `bash scripts/e2e-anvil.sh`.

<a id="manual-qa-issue-93"></a>

## Fee sinks mobile + protocol labels (GitLab #93)

After changes to **`FeeTransparency`**, **`MegaScannerAddressLink`**, or **`humanizeKvLabel`**.

### Preconditions

- **`VITE_FEE_ROUTER_ADDRESS`** set.
- Optional: **`VITE_INDEXER_URL`**.

### Checklist

1. **Wide (≥480px):** Footer sinks full `0x…` rows; outbound URLs use **`{VITE_EXPLORER_BASE_URL}/address/{addr}`** ([`explorerAddressUrl`](../../frontend/src/lib/explorer.ts); default **`https://mega.etherscan.io`**); `/timecurve/protocol` matches fee-sink monospace rows.
2. **Narrow (≤479px):** **4+4** glyph abbreviation + ellipsis; tap opens explorer; rows wrap.
3. **Protocol labels:** `WARBOW_*` / camelCase humanized on `/timecurve/protocol` and Arena raw accordion.
4. **Regression:** indexer **TxHash** links still use **`VITE_EXPLORER_BASE_URL`** (`/tx/…`) consistently with addresses.

**Automation:** [`humanizeIdentifier.test.ts`](../../frontend/src/lib/humanizeIdentifier.test.ts) · [`megaEtherscan.test.ts`](../../frontend/src/lib/megaEtherscan.test.ts) · [`addressFormat.test.ts`](../../frontend/src/lib/addressFormat.test.ts)

<a id="manual-qa-issue-98"></a>

## Canonical address display + explorer base (GitLab #98)

After changes to **`AddressInline`**, **`explorer.ts`**, **`LiveBuyRow`**, or **`MegaScannerAddressLink`**.

### Preconditions

- Dev server or staging build; indexer mocks optional.
- Optional: set **`VITE_EXPLORER_BASE_URL`** in `frontend/.env.local` to a non-default origin so **tx** and **address** links share the same base.

### Checklist

1. **`AddressInline` surfaces** (TimeCurve Simple recent buys, Arena wallets, `/referrals`, protocol rows using the component): valid non-zero address shows **blockie** + truncated label in one **`target="_blank"`** link; decorative blockie not exposed as separate control (`aria-hidden` where applicable); **`0x000…000`** / invalid → fallback (**—**), **no** `href`.
2. **Explorer URLs** — default build: address links resolve to **`https://mega.etherscan.io/address/0x…`** (unless env overrides). With **`VITE_EXPLORER_BASE_URL=https://explorer.example/`**, address links and **tx** links share that origin (`/address/…`, `/tx/…`).
3. **`LiveBuyRow`** — buyer link opens explorer; clicking the rest of the row opens buy details (**no** nested `<button>` around `<a>`). **Tab**: row focus opens details on Enter/Space; Tab to buyer link activates explorer; **tx** link still opens transaction explorer.
4. **Fee sinks / monospace** (**`MegaScannerAddressLink`**) — same **`VITE_EXPLORER_BASE_URL`** contract as **`AddressInline`**; narrow-viewport abbreviation matches [fee sinks checklist](#manual-qa-issue-93).
5. **Regression** — **`TxHash`** (or equivalent) still uses `/tx/` with safe `rel` (**noopener** / **noreferrer** as applicable).

**Spec:** [`wallet-connection.md` — explorer env](../frontend/wallet-connection.md#block-explorer-base-url-gitlab-98) · [invariants — #98](invariants-and-business-logic.md#canonical-address-display-gitlab-98)

**Automation:** [`explorer.test.ts`](../../frontend/src/lib/explorer.test.ts) · [`megaEtherscan.test.ts`](../../frontend/src/lib/megaEtherscan.test.ts) · [`timecurve-live-buys-modals.spec.ts`](../../frontend/e2e/timecurve-live-buys-modals.spec.ts)

<a id="manual-qa-issue-96"></a>

## Indexer offline UX (GitLab #96)

Use after changes to **`VITE_INDEXER_URL`** polling, **`IndexerStatusBar`**, **`useTimecurveHeroTimer`**, or **`fetchTimecurveBuys`**.

### Checklist

1. **Baseline:** `/timecurve` pill **live**.
2. **Stop indexer** or block **`127.0.0.1:3100`** — wait **~3–5 s**.
3. Pill **Indexer offline · retrying** on Simple + footer routes.
4. **Network:** polls **not** hammering at 1s indefinitely — backoff toward **30s+**.
5. **Recent buys:** **Cannot reach indexer · cached data may be stale**, not **Waiting for the first buy** when empty/offline.
6. **Recovery:** indexer back → pill **live**.

**Doc map:** [timecurve-views — #96](../frontend/timecurve-views.md#indexer-offline-ux-issue-96) · [invariants — #96](invariants-and-business-logic.md#indexer-offline-ux-and-backoff-gitlab-96)

<a id="manual-qa-issue-97"></a>

## Keyboard focus visible — WCAG 2.4.7 (GitLab #97)

### Checklist

1. **`/timecurve`:** **Tab** through controls — visible **`:focus-visible`** ring (`--yo-focus-ring`); mouse click without sticky wrong focus.
2. **Connect modal:** Tab through **`[data-rk]`** controls — same focus family.
3. **Contrast:** Ring visible on light and green chrome.

**Doc map:** [design — Accessibility](../frontend/design.md#accessibility-and-ux) · [`wallet-connection.md`](../frontend/wallet-connection.md) · [invariants — #97](invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97)

<a id="manual-qa-issue-71"></a>

## Album 1 BGM resume (GitLab #71)

**Canonical verification:** This anchor is the **single** contributor / agent checklist for BGM resume. Older links to `skills/verify-yo-album-bgm-resume/SKILL.md` are **obsolete** ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)) — replace them with this section (`#manual-qa-issue-71`) or [`skills/README.md`](../../skills/README.md) § contributor QA.

**Goal:** **Blockie Hills** BGM **track + offset** survive **refresh** and tab reopen ([issue #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68) autoplay semantics).

### Preconditions

- Frontend locally or staging; **Chromium** + **Firefox**.
- Optional: watch **`yieldomega:audio:v1:playbackState`** in Local Storage.

### Checklist

1. **Playing + refresh:** After **30–60s**, hard refresh → same track in dock quickly; audio **±5s** of prior position.
2. **Pause + refresh:** Paused until **Play**; offset **±2s**.
3. **Autoplay blocked:** Restored title on load; after first gesture, playback at saved offset.
4. **Skip then refresh:** New track at **0:00**.
5. **Natural track end then refresh:** Storage reflects advanced track ([issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)).
6. **Second tab same origin:** Last writer wins; no crashes.
7. **Throttle (optional):** **`savedAt`** not faster than ~**3–5s** while playing unless pause/skip/unload.

**Implementation map:** [`audioPlaybackState.ts`](../../frontend/src/audio/audioPlaybackState.ts) · [`WebAudioMixer.ts`](../../frontend/src/audio/WebAudioMixer.ts) · [`AudioEngineProvider.tsx`](../../frontend/src/audio/AudioEngineProvider.tsx)

**Doc map:** [sound-effects §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) · [invariants — Album 1 BGM](invariants-and-business-logic.md#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68) · [Agents: contributor manual QA](../agents/metadata-and-skills.md#contributor-manual-qa-not-play-skills)

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
- [ ] **Optional:** `cd frontend && npm run test -- src/audio/mobileAlbumDockLayout.test.ts`

**Doc map:** [invariants — #103](invariants-and-business-logic.md#mobile-album-dock-layout-issue-103) · [sound-effects §8 — mobile dock bullet](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)

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
- [ ] `curl -s "$(grep '^VITE_INDEXER_URL=' frontend/.env.local | tail -1 | cut -d= -f2-)/v1/timecurve/buys?limit=5" | jq .` — valid JSON array.
- [ ] With default frontend start: `http://127.0.0.1:${FRONTEND_DEV_PORT:-5173}/` responds (or run Vite manually after `--no-frontend`).
- [ ] Optional: `make check-frontend-env` passes.
- [ ] **Stop / teardown:** PIDs in [`qa-local-full-stack.md — Stopping`](qa-local-full-stack.md#stopping-the-stack) match your processes.

**Doc map:** [invariants — #104 / #105](invariants-and-business-logic.md#qa-local-full-stack-orchestrator-gitlab-104) · [issue #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104) · [issue #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)
