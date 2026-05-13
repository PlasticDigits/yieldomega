# Manual QA checklists (contributors)

Procedural checklists for **maintainers and QA** live here. Root [`skills/`](../../skills/) is **player-facing only** ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)). **Product invariants** and spec ↔ test mapping remain in [`invariants-and-business-logic.md`](invariants-and-business-logic.md). **Contributor** agents: [Phase 14 — Testing strategy](../agent-phases.md#phase-14) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

## Table of contents

| Issue | Topic |
|-------|--------|
| [#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87) | [Anvil E2E Playwright](#manual-qa-issue-87) |
| [#88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88) | [DeployDev buy cooldown](#manual-qa-issue-88) |
| [#99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99) | [Bot swarm + Anvil chain time](#manual-qa-issue-99) |
| [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64) | [Referrals `/referrals` surface](#manual-qa-issue-64) |
| [#121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121) | [Referrals — register disclosure (ordering / mempool)](#manual-qa-issue-121-referrals-register-disclosure) |
| [#80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80) | [Arena sniper-shark UI](#manual-qa-issue-80) |
| [#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) | [Single-chain wagmi (no stray mainnet RPC)](#manual-qa-issue-81) |
| [#199](https://gitlab.com/PlasticDigits/yieldomega/-/issues/199) | [`LaunchGate` `/home` hub route (no-env + post-launch)](#manual-qa-issue-199-home-route-launchgate) |
| [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) | [Wrong-network write gating](#manual-qa-issue-95) |
| [#194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194) | [Arena `Buy CHARM` wrong-chain visual](#manual-qa-issue-194-arena-buy-chain-visual) |
| [#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144) | [TimeCurve buy — wallet session drift mid-flow](#manual-qa-issue-144-wallet-session-drift-on-buy) |
| [#78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78) | [`TimeCurveBuyRouter` on Anvil](#manual-qa-issue-78) |
| [#82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) | [Buy CHARM submit-time sizing](#manual-qa-issue-82) |
| [#79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79) | [Post-end owner gates](#manual-qa-issue-79) |
| [#90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90) | [Simple stake panel after `redeemCharms`](#manual-qa-issue-90) |
| [#113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113) | [Simple live reserve podiums](#manual-qa-issue-113) |
| [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92) | [Presale vesting `/vesting`](#manual-qa-issue-92) |
| [#93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93) | [Fee sinks mobile + protocol labels](#manual-qa-issue-93) |
| [#98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98) | [Canonical address display + explorer base](#manual-qa-issue-98) |
| [#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96) | [Indexer offline UX](#manual-qa-issue-96) |
| [#97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97) | [Keyboard focus visible (WCAG 2.4.7)](#manual-qa-issue-97) |
| [#71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71) | [Album 1 BGM resume](#manual-qa-issue-71) |
| [#103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103) | [Mobile album dock vs nav chrome](#manual-qa-issue-103) |
| [#171](https://gitlab.com/PlasticDigits/yieldomega/-/issues/171) | [Header mascot vs TimeCurve nav clearance](#manual-qa-issue-171) |
| [#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104) (+ [#105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105) orchestrator **`--help`**; [#153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153) Vite traps) | [Local full stack QA orchestrator](#manual-qa-issue-104) |
| [#106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106) | [Presale vesting claim — chain mismatch feedback](#manual-qa-issue-106) |
| [#120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120) | [`AccessControl` zero admin — indexer + frontend derived layers](#manual-qa-issue-120-accesscontrol-zero-admin-derived-layers) |
| [#142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142) | [Indexer production `DATABASE_URL` hygiene](#manual-qa-issue-142) |
| [#156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156) | [Indexer production `ADDRESS_REGISTRY` / `CHAIN_ID`](#manual-qa-issue-156) |
| [#145](https://gitlab.com/PlasticDigits/yieldomega/-/issues/145) | [Presale vesting — claim error redaction (no RPC key in UI)](#manual-qa-issue-145) |
| [#163](https://gitlab.com/PlasticDigits/yieldomega/-/issues/163) | [Placeholder split-layout hero figure (wide / landscape)](#manual-qa-issue-163) |
| [#198](https://gitlab.com/PlasticDigits/yieldomega/-/issues/198) | [Homepage product card grid alignment](#manual-qa-issue-198) |

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
- [`docs/product/referrals.md`](../product/referrals.md) — code rules, link capture, **registration ordering / mempool fairness** ([GitLab #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121), [§ ordering](../product/referrals.md#referral-registration-ordering-issue-121)), **browser storage key table** (pending vs my-code — [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)).
- [invariants — Referrals page](invariants-and-business-logic.md#referrals-page-visual-issue-64) · [invariants — **#121** registration ordering](invariants-and-business-logic.md#referral-registration-ordering-issue-121).
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

<a id="manual-qa-issue-121-referrals-register-disclosure"></a>

### Referrals — register ordering disclosure ([GitLab #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121))

Brief row for **INV-REFERRAL-121-UX** (pairs with audit [L‑02](../../audits/audit_smartcontract_1777813071.md#l-02-referral-code-registration-is-front-runnable)).

- [ ] On **`/referrals`** with registry configured, connected **unregistered** wallet: **`data-testid="referrals-register-ordering-disclosure"`** renders **above** **Register & burn CL8Y**, copy matches [product referrals — § registration ordering](../product/referrals.md#referral-registration-ordering-issue-121) (**first successful on-chain registration**, public **mempool**, **burn** applies only if your tx succeeds).
- [ ] **Narrow viewport:** disclosure + burn line + input + primary CTA do not clip or collide.
- [ ] **Burn row** (`registrationBurnAmount` via `AmountDisplay`) unchanged vs chain.

**Automated:** [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) asserts the disclosure test id appears in the connected unregistered path.

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

<a id="manual-qa-issue-199-home-route-launchgate"></a>

## `LaunchGate` `/home` hub route — no-env + post-launch (GitLab #199)

**Why:** Without **`VITE_LAUNCH_TIMESTAMP`**, the marketing hub lives at **`/`**. **`ROUTES_NO_ENV`** previously omitted **`path: "home"`**, so **`http://127.0.0.1:<port>/home`** matched **`RootLayout`** but rendered an **empty** `<Outlet />` (shell + green grid only). Post-launch builds already map **`/home` → `HomePage`**.

### Checklist

1. **No-env:** `cd frontend && npm run dev` with **no** `VITE_LAUNCH_TIMESTAMP` in `.env` / `.env.local`.
2. Open **`/home`** (e.g. `http://127.0.0.1:5173/home`).
3. Expect **`YieldOmega`** hero **`h1`**, hero art, **Open TimeCurve** CTA, and **surface cards** — same hub as **`/`** (not a blank main).
4. **`/`** still shows the same hub; **no** double layout (single **`RootLayout`** outlet).
5. **Post-launch (optional):** rebuild with **`VITE_LAUNCH_TIMESTAMP`** in the **past** → **`/`** is TimeCurve Simple, **`/home`** is still the full hub.

**Doc map:** [`timecurve-views.md` — LaunchCountdown → Simple handoff](../frontend/timecurve-views.md#launchcountdown--simple-handoff) · [invariants — #199](invariants-and-business-logic.md#launchgate-home-route--no-env-parity-gitlab-199) · [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx)

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

<a id="manual-qa-issue-194-arena-buy-chain-visual"></a>

## Arena `Buy CHARM` — wrong-chain visual parity (GitLab #194)

**Why:** The Arena **arcade** primary CTA already respected **`chainMismatch`** in its **`disabled`** prop, but the **gold / motion** affordance could still read as “press me” compared with **`btn-secondary`** settlement CTAs under the same wrong-network state ([GitLab #194](https://gitlab.com/PlasticDigits/yieldomega/-/issues/194)).

### Preconditions

Same as [#95](#manual-qa-issue-95): local stack with default **31337** target (or a known **`VITE_CHAIN_ID`**) and a wallet that can switch chains.

### Manual steps

1. Open **`/timecurve/arena`** during **`saleActive`** with the wallet on the **correct** target chain — **Buy CHARM** shows the normal **arcade** styling and hover lift (unless reduced motion).
2. Switch the wallet to a **wrong** chain — confirm **`timecurve-arena-buy-chain-write-gate`** overlay still appears, and the **`Buy CHARM`** control (**`data-testid="timecurve-arena-buy-charm-cta"`**) is **dimmed / muted** (not the same “live gold lever” read as step 1), **`disabled`**, and exposes **`chainMismatchWriteMessage`** as a native **`title`** tooltip on hover / long-press.
3. Confirm **End sale** / **Redeem charms** / **Distribute prizes** (when the settlement row is visible) still match prior wrong-network expectations.
4. Switch back to the build target chain **without** a full page reload — **Buy CHARM** regains normal arcade styling and hover motion.

### Code references

- [`TimeCurveArenaView.tsx`](../../frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx) · [`index.css`](../../frontend/src/index.css) (`timecurve-simple__cta--wrong-network`, `.timer-hero__arena-buy .chain-write-gate__overlay`)
- [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts)

**Doc map:** [`timecurve-views.md` §194](../frontend/timecurve-views.md#arena-buy-charm-wrong-chain-visual-gitlab-194) · [invariants — `INV-FRONTEND-194-ARENA-BUY-CHAIN`](invariants-and-business-logic.md#arena-buy-charm-wrong-chain-visual-gitlab-194)

<a id="manual-qa-issue-144-wallet-session-drift-on-buy"></a>

## TimeCurve buy — wallet session drift mid-flow (GitLab #144)

**Why:** ETH/USDM entry paths issue **multiple** signed txs / receipts before **`TimeCurve.buy`**. Switching wallet accounts or chains mid-flow must **abort** with explicit copy (**`Wallet or network changed during purchase — please retry from the beginning.`**), not mixed-recipient swaps or opaque reverts.

### Preconditions

1. Local stack or testnet where **TimeCurve Simple** and **Arena** buys work (sale live, `buyFeeRoutingEnabled`, Kumbaya env if testing ETH/USDM).
2. A wallet with **two accounts** on the **same** target **`VITE_CHAIN_ID`** (e.g. MetaMask / Rabby).

### Manual steps

1. **Happy path:** Complete one **CL8Y** buy on **`/timecurve`** without switching accounts — no regression.
2. **Account switch (two-step ETH/USDM or CL8Y if multi-step):** Start a buy that pauses between steps (e.g. after wrap or after **first** confirmation). Switch to **another account** in the extension before the next signature — expect **aborted** flow and the **#144** error string in buy error state (`buyError` / `buyErr`); **no** successful buy attributed to the original account without user retry from scratch.
3. **Network switch:** On target chain, begin a multi-step buy, then switch the wallet to **another chain** before the next step — expect the same **#144** message (or **#95** wrong-network preflight if the switch happens before guarded steps; either is acceptable UX as long as the user is not led through a mixed-wallet success).
4. **Single-tx router:** When **`timeCurveBuyRouter` ≠ 0** and **`buyViaKumbaya`** path is active, switching account between **USDM approve** and **router** tx (if two steps) should still **abort** per internal guards.

### Code references

- [`walletBuySessionGuard.ts`](../../frontend/src/lib/walletBuySessionGuard.ts) · [`walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts)
- [`useTimeCurveSaleSession.ts`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) · [`useTimeCurveArenaModel.tsx`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx) · [`timeCurveKumbayaSingleTx.ts`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts)

**Doc map:** [`wallet-connection.md` § #144](../frontend/wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144) · [invariants — #144](invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144)

<a id="manual-qa-issue-155-referral-register-wallet-session-drift"></a>

## Referral registration — wallet session drift mid-flow (GitLab #155)

**Why:** **`ReferralRegisterSection`** runs **`allowance` → optional CL8Y `approve` → `registerCode`** across multiple awaits. Switching wallet accounts or **`chainId`** mid-flow must **abort** with **`Wallet or network changed during purchase — please retry from the beginning.`** (same **`WALLET_BUY_SESSION_DRIFT_MESSAGE`** as [#144](#manual-qa-issue-144-wallet-session-drift-on-buy)), and must **not** call **`setStoredMyReferralCodeForWallet`** under the wrong wallet key.

### Preconditions

1. Local stack or testnet with **`ReferralRegistry`** configured (`VITE_REFERRAL_REGISTRY_ADDRESS` or **`TimeCurve.referralRegistry()`**).
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

## Presale vesting — claim chain mismatch UX (GitLab #106)

**Why:** The **`Claim DOUB`** button is **`disabled`** when **`useWalletTargetChainMismatch()`** is true, but a wallet can **switch networks** between paint and click; the **`claim`** **`onClick`** must not **silently return** when **`chainMismatchWriteMessage(chainId)`** is set.

### Checklist

1. **`/vesting`** with vesting env + beneficiary wallet + **`claimable > 0`** on the target chain: **Claim DOUB** works when the wallet stays on **`VITE_CHAIN_ID`**.
2. **Race:** On target chain with **Claim** enabled, switch the wallet to **another** chain **immediately** click **Claim DOUB** before the overlay catches up — expect an **error** **`StatusMessage`** with **`Wrong network:`** … **`Switch to chain …`** (same copy family as Simple buy / referrals register).
3. **Recovery:** Use **Switch to …** / reconnect on target chain — gate error clears when back on target (**no** stale banner).
4. **Wagmi claim error (GitLab #166):** On target with **`claimable > 0`**, switch to a **wrong** chain, trigger a wallet prompt for **Claim DOUB** (e.g. reject in MetaMask), confirm a red **`StatusMessage`** from **`friendlyRevertFromUnknown`**, then switch **back** to the build target — the wagmi error panel must **clear without** reload (same recovery posture as step 3 for **`claimGateError`**). On target, a **same-chain** reject should **keep** the error until a successful claim, explicit retry path, or wrong-chain round-trip per **`INV-FRONTEND-166`**.

**Code:** [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx) · [`usePresaleVestingChainWriteEffects.ts`](../../frontend/src/pages/presaleVesting/usePresaleVestingChainWriteEffects.ts) · [`chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) · **Invariant:** [§ #106](invariants-and-business-logic.md#presale-vesting-claim-chain-preflight-gitlab-106) · [§ #166](invariants-and-business-logic.md#presale-vesting-claim-wagmi-error-clear-on-target-gitlab-166) · [`presale-vesting.md` § UX](../frontend/presale-vesting.md)

<a id="manual-qa-issue-166-presale-vesting-claim-error-chain-return"></a>

## Presale vesting — wagmi claim error clears on target return (GitLab #166)

This is **checklist item 4** under [§ #106 — claim chain mismatch](#manual-qa-issue-106). **Why:** wagmi's **`useWriteContract` `error`** could persist after switching back to **`VITE_CHAIN_ID`**; **`reset()`** runs only on a **wrong-chain → target** transition so same-chain rejects still surface until retry or success.

**Invariant:** [`INV-FRONTEND-166` — § #166](invariants-and-business-logic.md#presale-vesting-claim-wagmi-error-clear-on-target-gitlab-166) · **Vitest:** [`presaleVestingWriteErrorChainReset.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingWriteErrorChainReset.test.ts)

<a id="manual-qa-issue-145"></a>

## Presale vesting — claim error redaction (GitLab #145)

**Why:** Wagmi / viem errors can embed **full RPC URLs** (including **`VITE_RPC_URL`** API keys). The **`/vesting`** claim panel must not echo those strings into **`StatusMessage`** (screenshots, screen share, DevTools).

### Checklist

1. **Unit / CI:** [`revertMessage.test.ts`](../../frontend/src/lib/revertMessage.test.ts) covers synthetic Alchemy-style URLs and **`friendlyRevertFromUnknown`** integration.
2. **Manual / staging:** With a throwaway RPC URL containing an obvious fake key in **`VITE_RPC_URL`**, force a **`claim`** write failure (e.g. disable network or bad calldata if needed) — confirm the visible error contains **`[RPC URL redacted]`** (or mapped friendly copy) and **not** the full URL / key substring.
3. **Write-surface audit:** Grep **`StatusMessage`** + raw **`.message`** on wallet writes — **`PresaleVestingPage`** must use **`friendlyRevertFromUnknown`** only (no raw wagmi **`message`**).

**Code:** [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx) · [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts) · **Invariant:** [§ #145](invariants-and-business-logic.md#presale-vesting-claim-error-redaction-gitlab-145) · [`presale-vesting.md` § UX](../frontend/presale-vesting.md)

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

<a id="manual-qa-issue-113"></a>

## Simple live reserve podiums (GitLab #113)

**Goal:** `/timecurve` shows a compact, onchain-sourced four-category podium
snapshot above **Recent buys / Live ticker** without pulling the dense Arena
surface onto the first-run page.

### Checklist

1. **Placement:** Open `/timecurve`; confirm **Live reserve podiums** appears above **Recent buys** and the **Live ticker** badge.
2. **Categories:** Confirm all four v1 categories are present: **Last Buy**, **WarBow**, **Defended Streak**, **Time Booster**.
3. **Placements:** Each category shows 1st / 2nd / 3rd rows with blockie + abbreviated explorer-linked wallet display, or **Awaiting wallet / Pending** for zero onchain slots.
4. **Viewer highlight:** Connect a wallet that appears in any podium slot; that row has the shared magenta `ranking-list__item--you` ring.
5. **Refresh:** With local Anvil or bot swarm activity, submit a buy and observe the podium section refresh without a full page reload. WarBow-only moves should also update after the light RPC refresh interval.
6. **Simple density:** Confirm Simple still does **not** show Arena headings **Podiums and prizes**, **WarBow moves and rivalry**, or **Live battle feed** above the fold.
7. **Mobile:** At ~390×844, confirm the podium cards stack cleanly and address links remain tappable.

**Automation:** [`TimeCurveSimplePodiumSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.test.tsx) · [`frontend/e2e/timecurve.spec.ts`](../../frontend/e2e/timecurve.spec.ts)

**Doc map:** [timecurve-views](../frontend/timecurve-views.md) · [invariants — #113](invariants-and-business-logic.md#timecurve-simple-live-reserve-podiums-issue-113) · [`play-timecurve-doubloon/SKILL.md`](../../skills/play-timecurve-doubloon/SKILL.md)

<a id="manual-qa-issue-182"></a>

## Arena — WarBow indexer rank + feed refresh (GitLab #182)

**Goal:** After BP-changing activity, **Your WarBow rank**, **chasing pack** rows, and **rivalry / battle feed** match the indexer within a short window **without** reloading **`/timecurve/arena`**.

### Preconditions

- Full stack or staging with **`VITE_INDEXER_URL`** and indexer caught up to the chain used by the wallet.

### Checklist

1. Open **`/timecurve/arena`**; note **Your WarBow rank** and top chasing-pack rows (or **Unranked** if applicable).
2. Perform a **BP-changing** action (e.g. **steal**, **buy** with WarBow flag plant, **claim flag**, **revenge**, **guard**).
3. After the tx confirms and the indexer ingests (**~2–10 s** locally), confirm **Your WarBow rank** and chasing-pack list update if indexed BP ordering changed.
4. Confirm **rivalry / battle feed** shows new rows when corresponding events exist (may require another participant or bot traffic).
5. Optional: leave the tab open **without** acting; when another wallet moves the ladder, confirm rank / feed drift resolves within **one or two** poll intervals (**~5 s** base backoff, longer after indexer failures per shared backoff).

**Doc map:** [timecurve-views — #182](../frontend/timecurve-views.md#arena-warbow-indexer-leaderboard-feed-refresh-gitlab-182) · [invariants — **`INV-FRONTEND-182-WARBOW-IDX`**](invariants-and-business-logic.md#timecurve-arena-warbow-indexer-refresh-gitlab-182) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md)

<a id="manual-qa-issue-189"></a>

## Arena — WarBow Chasing pack (7+ ladder rows) (GitLab #189)

**Goal:** **Chasing pack** shows **every** wallet returned by the indexer ladder for the current page (**no** hidden sixth-row cap) and remains usable when **seven or more** rows exist.

### Preconditions

- Full stack or staging with **`VITE_INDEXER_URL`** and **≥ 7** distinct wallets on **`GET /v1/timecurve/warbow/leaderboard`** (local bot swarm + rich state, or shared env with traffic).

### Checklist

1. Open **`/timecurve/arena`** → **WarBow moves and rivalry** → **Chasing pack**.
2. Confirm **row count** matches the indexer ladder length you expect (at least **7** visible ranks when the API returns **7+** rows).
3. Confirm **ranks** are **1…N** with **no** gap after rank **6**.
4. **Layout:** With a long list, confirm the **Chasing pack** column scrolls vertically (**no** page-level overflow or overlap with **Top rivals**); optional: **`[data-testid="warbow-chasing-pack-scroll"]`** wraps the list.
5. **Mobile / narrow:** Repeat at ~390×844 — scroll still works; **Top rivals** + **Chasing pack** stack without clipped addresses.

**Doc map:** [timecurve-views — #189](../frontend/timecurve-views.md#arena-warbow-chasing-pack-scroll-gitlab-189) · [invariants — **`INV-FRONTEND-189-WARBOW-CHASING-PACK`**](invariants-and-business-logic.md#timecurve-arena-warbow-chasing-pack-gitlab-189) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md)

<a id="manual-qa-issue-188"></a>

## Arena — post-timer settlement row visible (GitLab #188)

**Goal:** When the **round timer is past `deadline`** but **`TimeCurve.ended()`** is still **false**, **`/timecurve/arena`** shows **End sale**, **Redeem charms**, and **Distribute prizes** in the status panel — not only the live standings grid — so the **permissionless `endSale`** path is obvious.

### Checklist

1. Repro a chain state with **`saleExpiredAwaitingEnd`** (e.g. local Anvil after **`anvil_rich_state`** warp + **`endSale` not yet called**, or staging snapshot).
2. Open **`/timecurve/arena`**; confirm the panel title/badge reflects **settlement** (e.g. **Round over — settle onchain** / **End sale first**), not only **Standings and prize chase**.
3. **End sale** button is **present** and **enabled** (subject to wrong-network gate).
4. **Redeem charms** and **Distribute prizes** are **visible** and **disabled** with helper copy until **`ended`** reads **true** after **End sale**.
5. After **`endSale`** confirms, **End sale** disappears; **Redeem** enables per existing gates (**`charmRedemptionEnabled`**, weight, etc.).

**Doc map:** [timecurve-views — #188](../frontend/timecurve-views.md#arena-settlement-panel-timer-expired-gitlab-188) · [invariants — **`INV-FRONTEND-188-ARENA-SETTLEMENT`**](invariants-and-business-logic.md#timecurve-arena-settlement-panel-timer-expired-gitlab-188) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md)

<a id="manual-qa-issue-191"></a>

## TimeCurve Simple + Arena — buy hub numeric consistency (GitLab #191)

**Goal:** **Live band**, **CHARM preview**, **Worth at launch ≈**, and Arena **buy summary** lines use the same **four significant figures** compact policy; hero per-CHARM tiles still show **fixed** fractional digits for tick visibility.

### Checklist

1. Open **`/timecurve`** and **`/timecurve/arena`** with a funded wallet during **`saleActive`**; move the spend slider.
2. Confirm **Live band** min–max uses the same digit density as **You add** CHARM and **Worth at launch ≈** (no unexplained jump from e.g. **3** to **4** sigfig styling on one card).
3. On **Arena**, **`data-testid="timecurve-arena-buy-preview"`** shows **Worth at launch ≈** when CHARM &gt; 0 (parity with Simple **`timecurve-simple-buy-preview`**).
4. Toggle **ETH** / **USDM** pay modes (when Kumbaya is configured): band hints + parenthetical CL8Y band still match the **4** sigfig policy.
5. Compare **recent buys** table on Simple: CL8Y and CHARM columns match the buy-preview formatter (no harsher truncation than the preview row).

**Doc map:** [timecurve-views — #191](../frontend/timecurve-views.md#timecurve-buy-hub-numeric-display-gitlab-191) · [invariants — **`INV-FRONTEND-191-BUY-HUB-DERIVED`**](invariants-and-business-logic.md#timecurve-buy-hub-derived-numeric-display-gitlab-191) · [`timeCurveBuyHubFormat.ts`](../../frontend/src/lib/timeCurveBuyHubFormat.ts) · [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191)

<a id="manual-qa-issue-192"></a>

## TimeCurve — USD equivalent staleness (GitLab #192)

**Goal:** Participants can see that **USD-shaped** numbers are **not** live oracle quotes, and when the **CL8Y** basis last moved — without noisy banners.

### Checklist

1. **Arena — sale live:** open **`/timecurve/arena`** with a connected wallet on the target chain; under the hero timer, confirm **TOTAL RAISE** (CL8Y) and **TOTAL USD** render.
2. Hover the **TOTAL USD** block (or long-press on mobile): **`title`** explains the **1 CL8Y = 1 USD** placeholder and ~1s poll context.
3. Confirm the muted line **“CL8Y total seen … · USD is illustrative (1 CL8Y = $1)”** appears when reads succeed; after a buy (or forced refetch), the **“… ago”** segment should eventually advance (ticks ~every **8s**).
4. **Simple:** open **`/timecurve`** → **Live reserve podiums**; confirm **≈ $… USD** rows still render; hover one **≈** row for the static **0.98×** tooltip.
5. Read the second footnote under the grid (**static CL8Y→USDM display shape**); when preview data exists, confirm **“Prize CL8Y preview seen …”** appears.
6. **Narrow viewport (~375px):** confirm the Arena affordance line and Simple footnote wrap cleanly (no clipped hero text).

**Doc map:** [timecurve-views — #192](../frontend/timecurve-views.md#usd-equivalent-staleness-gitlab-192) · [invariants — **`INV-FRONTEND-192-USD-AFFORDANCE`**](invariants-and-business-logic.md#usd-equivalent-staleness-affordance-gitlab-192) · [`play-timecurve-doubloon/SKILL.md`](../../skills/play-timecurve-doubloon/SKILL.md)

<a id="manual-qa-issue-160"></a>

## Protocol — WarBow refresh candidates + governance finalize (GitLab #160 / #172)

**Goal:** Operators can load indexer-derived **`GET /v1/timecurve/warbow/refresh-candidates`** as a **reference** list on **`/timecurve/protocol`**, then (post-**`endSale`**) the **owner** submits **`finalizeWarbowPodium(first, second, third)`** with live **`battlePoints`** ordering (**#172**).

### Preconditions

- Full stack or staging with **`VITE_INDEXER_URL`** pointing at an indexer **≥ schema 1.15.1** (**≥ 1.18.0** for responses **without** legacy **`distinct_sql_cap_hit`**) and **`VITE_TIMECURVE_ADDRESS`** on the target chain.

### Checklist

1. Open **`/timecurve/protocol`**; locate **WarBow podium (governance)**.
2. **Load reference candidates from indexer** succeeds; merged **`total`** / hint counts render without errors (**no** “SQL DISTINCT cap hit” field on **≥ 1.18.0** indexers).
3. With sale **live** (`ended == false`): indexer panel still loads reference rows; **finalize** button stays disabled until **`ended`** matches props / onchain reads.
4. After **`endSale`** (`ended == true`): connect **`TimeCurve.owner()`** on the build target chain; **Submit finalizeWarbowPodium** succeeds with valid left-packed ranks + BP ordering (or surfaces a clear revert / chain gate).
5. Optional: `curl` **`GET …/v1/timecurve/warbow/refresh-candidates?limit=10&offset=0`** — JSON **`candidates`** array, **`total`**, **`sale_ended`**, **`note`** present; confirm **`distinct_sql_cap_hit`** is **absent** on **1.18.0+**.

**Doc map:** [timecurve-views — protocol row](../frontend/timecurve-views.md) · [timecurve-views — #174 guard](../frontend/timecurve-views.md#warbow-refresh-candidates-ui-pagination-guard-gitlab-174) · [indexer design — agents](../indexer/design.md) · **`INV-INDEXER-160-WARBOW-REFRESH-CANDIDATES`** · **`INV-INDEXER-170-WARBOW-REFRESH-POSTEND`** · **`INV-FRONTEND-174-WARBOW-REFRESH-GUARD`** · **`INV-WARBOW-172-*`** ([invariants §149 / §170](invariants-and-business-logic.md#gitlab-149-warbow-arena-indexer-hardening) · [§174](invariants-and-business-logic.md#gitlab-174-warbow-refresh-pagination-guard)) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md)

<a id="manual-qa-issue-174-warbow-refresh-pagination-guard"></a>

## Protocol — WarBow refresh pagination guard warning (GitLab #174)

**Goal:** When the **`/timecurve/protocol`** panel hits its **client-side** page ceiling while the indexer still advertises **`next_offset`**, operators see a **warning** (not a silent truncate).

### Preconditions

- Same as [§ #160 / #172](#manual-qa-issue-160) (**`VITE_INDEXER_URL`**, schema **≥ 1.15.1**).

### Checklist

1. **Happy path:** With a chain/indexer where **`refresh-candidates`** returns **`next_offset: null`** within the first **50** pages, **Load reference candidates** shows **no** yellow **`warning-text`** banner; candidate count matches expectations.
2. **Guard path (staged):** Mock or fixture an indexer (or temporary local patch) that always returns a **positive** **`next_offset`** for **50** consecutive pages — confirm a **warning** **`StatusMessage`** appears, the loaded checksum count is **at most 25,000** raw rows (**50 × 500**), and **`finalizeWarbowPodium`** remains usable (warning is non-blocking).
3. **Regression:** After a successful full load, reload again — warning clears when the natural end is reached.

**Automation:** Vitest [`warbowRefreshCandidatesPagination.test.ts`](../../frontend/src/lib/warbowRefreshCandidatesPagination.test.ts) · **`INV-FRONTEND-174-WARBOW-REFRESH-GUARD`** ([invariants §174](invariants-and-business-logic.md#gitlab-174-warbow-refresh-pagination-guard)).

**Doc map:** [timecurve-views — #174](../frontend/timecurve-views.md#warbow-refresh-candidates-ui-pagination-guard-gitlab-174) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md)

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
10. **Claim RPC leak (#145):** Claim failures must **not** print raw RPC URLs — see [§ #145](#manual-qa-issue-145).

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

<a id="manual-qa-issue-163"></a>

## Placeholder split-layout hero figure — wide / landscape (GitLab #163)

**Why:** [`UnderConstruction`](../../frontend/src/pages/UnderConstruction.tsx) (e.g. **`/rabbit-treasury`**, **`/collection`**) and [`ThirdPartyDexPage`](../../frontend/src/components/ThirdPartyDexPage.tsx) (**`/kumbaya`**, **`/sir`**) render a bordered **`.placeholder-figure`** beside **`PageSection`** inside **`.split-layout`**. Without **`align-self: start`**, the figure stretched to the taller column and showed **empty panel** below the image ([`INV-FRONTEND-163`](invariants-and-business-logic.md#placeholder-split-layout-figure-gitlab-163)).

### Checklist

1. **Desktop (width > ~720px, two columns):** Open **`/rabbit-treasury`**, **`/collection`**, **`/kumbaya`**, **`/sir`** — the left image card’s **border** should hug the **image** (no tall empty green band inside the frame).
2. **Landscape phone / narrow-tall viewport** where the layout still uses **two columns:** same check — no interior gap between image bottom and card border.
3. **Narrow / stacked (`max-width: 720px`):** layout stacks to one column; image card still looks coherent (no overflow clipping).

**Doc map:** [design — Placeholder split panels](../frontend/design.md#placeholder-split-panels-gitlab-163) · [invariants — #163](invariants-and-business-logic.md#placeholder-split-layout-figure-gitlab-163) · [`placeholderSplitLayoutCss.test.ts`](../../frontend/src/lib/placeholderSplitLayoutCss.test.ts)

<a id="manual-qa-issue-198"></a>

## Homepage product card grid alignment (GitLab #198)

**Goal:** Product cards on the homepage should read as a clean desktop grid, with consistent gutters and matching card heights despite different titles, badges, images, and blurb lengths.

### Checklist

1. **Desktop (`>= 721px`):** open `/` and verify the six product cards form a centered three-column grid; all cards in the grid share the same visible height and the bottom card edges align.
2. **Responsive stack / narrow widths:** cards stack or reflow without clipping; image slots keep the 4:3 crop and text remains readable.
3. **`/referrals` overview strip:** the three numbered overview cards keep aligned heights and gutters when shown side by side.
4. **Hover / focus:** product-card hover lift and keyboard focus still target the full card link.

**Automated:** [`homeCardGridCss.test.ts`](../../frontend/src/lib/homeCardGridCss.test.ts) asserts the CSS stretch contract for homepage cards and referral overview cards.

**Doc map:** [design — Home product card grid](../frontend/design.md#home-product-card-grid-gitlab-198) · [invariants — #198](invariants-and-business-logic.md#frontend-home-product-card-grid-gitlab-198)

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

<a id="manual-qa-sfx-coin-warbow-108"></a>

## SFX — buy coin + WarBow twang (GitLab #68 / #108)

Spot-check after changing **`playGameSfx*`**, **`submitKumbayaSingleTxBuy`**, **`useTimeCurveSaleSession`**, **`useTimeCurveArenaModel`**, **`useArenaWarbowRankSfx`**, or **`WebAudioMixer` throttles**.

### Checklist

1. **Simple + Arena — CL8Y path:** After signing **`TimeCurve.buy`**, a **shallow coin** plays **before** the receipt lands; **charmed** still plays on success.
2. **ETH / USDM — single-tx router:** After signing **`buyViaKumbaya`**, the same **coin** fires once (not on wrap/approve-only steps in the two‑step fallback).
3. **Arena — WarBow podium:** **`warbow_twang`** fires only when the indexed ladder shows **top‑3 entry** (from unranked/deep) **or** a move **among ranks ≤3** (see `warbowRankSfxPolicy` — **no** stinger on e.g. **10 → 4**); **≤1** hit per **~18 s** throttle.
4. **Kumbaya whoosh:** Confirm **no** whoosh on mere **quote refresh** (still **unwired**).

**Spec:** [`INV-AUDIO-68-WIRE`](invariants-and-business-logic.md#timecurve-sfx-buy-warbow-issue-108) · [sound-effects §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)

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

**Doc map:** [invariants — #103](invariants-and-business-logic.md#mobile-album-dock-layout-issue-103) · [sound-effects §8 — mobile dock bullet](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)

<a id="manual-qa-issue-171"></a>

## Header mascot vs TimeCurve nav clearance (GitLab #171)

**Goal:** On desktop and landscape widths, the decorative circular mascot in the global header must not overlap the **TimeCurve** nav button or any other primary nav hit target.

### Invariants

1. `.app-header__brand` reserves the mascot footprint through `--app-header-mascot-clearance`; the absolute mascot stays inside that reserved gutter.
2. `.app-header__mascot` is decorative and **`pointer-events: none`**, so it cannot intercept clicks even while visually near nav.
3. At **`max-width: 720px`**, the mascot remains hidden and the reserved gutter resets to zero so mobile nav keeps its full width.

### Checklist

- [ ] Desktop width (`≥1024px`): **YieldOmega**, status badges, **TimeCurve**, and the wallet controls are aligned with a visible gap between the mascot and **TimeCurve**.
- [ ] Landscape tablet width (`721–1023px`): if the header wraps, the mascot does not cover nav text, focus rings, or pointer hit areas.
- [ ] Narrow width (`≤720px`): mascot is hidden; nav stays a three-column grid with no empty mascot gutter.
- [ ] Keyboard Tab through the header: focus ring on **TimeCurve** is fully visible and not covered by the mascot.
- [ ] Optional: `cd frontend && npm run test -- src/layout/headerLayoutCss.test.ts`.

**Doc map:** [invariants — #171](invariants-and-business-logic.md#frontend-header-mascot-nav-clearance-gitlab-171) · [frontend design — global header layout](../frontend/design.md#accessibility-and-ux)

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

**Doc map:** [invariants — #120 + derived IDs](invariants-and-business-logic.md#accesscontrol-zero-admin-deployments-gitlab-120) · [fee-routing — deployer boundary](../onchain/fee-routing-and-governance.md#deployer-evm-boundary-gitlab-120) · [skills README — contributor #120](../../skills/README.md)

<a id="manual-qa-issue-142"></a>

## Indexer production `DATABASE_URL` placeholders (GitLab #142)

**Goal:** Production operators must not boot the indexer with copy-pasted template credentials from [`indexer/.env.example`](../../indexer/.env.example). **`INDEXER_PRODUCTION=1`** (see [`indexer/README.md`](../../indexer/README.md)) fails fast when **`DATABASE_URL`** contains forbidden substrings ([`INV-INDEXER-142`](invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)).

### Checklist

- [ ] From `indexer/`, with a **real** Postgres URL (not containing **`CHANGE_ME_BEFORE_DEPLOY`** or **`user:password@`**-style trivial passwords) and **`CORS_ALLOWED_ORIGINS`**: `INDEXER_PRODUCTION=1 DATABASE_URL=… CORS_ALLOWED_ORIGINS=https://example.com …` — `cargo run` progresses past config (or use **`cargo test`** only for substring unit tests).
- [ ] Same shell, swap to `DATABASE_URL=postgres://u:CHANGE_ME_BEFORE_DEPLOY@localhost/db`: expect immediate error mentioning **forbidden placeholder** / **GitLab #142**.
- [ ] Open [`indexer/.env.example`](../../indexer/.env.example): confirm warnings above **`RPC_URL` / `CHAIN_ID`** and non-production-looking **`DATABASE_URL`**.

**Doc map:** [indexer README](../../indexer/README.md) · [invariants — #142](invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)

<a id="manual-qa-issue-156"></a>

## Indexer production `ADDRESS_REGISTRY` / `CHAIN_ID` (GitLab #156)

**Goal:** With **`INDEXER_PRODUCTION=1`**, a wrong registry file, wrong **`CHAIN_ID`**, invalid addresses, or missing ingestion registry must **exit during config load** — not warn, skip bad rows, or idle forever ([`INV-INDEXER-156`](invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)).

### Checklist

- [ ] **`INDEXER_PRODUCTION=1`**, **`INGESTION_ENABLED=true`** (default), valid **`DATABASE_URL`** / **`CORS_ALLOWED_ORIGINS`**, **omit** **`ADDRESS_REGISTRY_PATH`** → `cargo run` fails at config with a message about **`ADDRESS_REGISTRY_PATH`** / production ingestion.
- [ ] Same, but set **`ADDRESS_REGISTRY_PATH`** to a JSON whose **`chain_id`** ≠ **`CHAIN_ID`** → non-zero exit mentioning **`CHAIN_ID`**.
- [ ] Registry with a **non-empty** invalid **`TimeCurve`** string → non-zero exit (not “skipping invalid address”).
- [ ] Unset **`INDEXER_PRODUCTION`**: registry **`chain_id`** mismatch still **warns** only; behavior matches pre-#156 local workflows.
- [ ] `cd indexer && cargo test production_registry_validation` — all tests pass.

**Doc map:** [indexer README — checklist](../../indexer/README.md) · [invariants — #156](invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)
