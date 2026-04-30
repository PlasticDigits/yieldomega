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

GitHub Actions sets `YIELDOMEGA_PG_TEST_URL` against a **service container** so `postgres_stage2_persist_all_events_and_rollback_after` connects, runs migrations, inserts every `DecodedEvent` variant (including **`TimeCurveBuyRouterBuyViaKumbaya`** — [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)), checks idempotency, and calls `rollback_after` ([ci.md](ci.md)).

If the variable is **unset or empty** locally, that test **returns immediately** and still reports **passed** — it does **not** prove Postgres behavior. Export a URL to the same database you use for manual indexer runs when you need local parity with CI.

---

## Business logic (what the code is supposed to enforce)

| Area | Intent (short) | Product / onchain spec |
|------|----------------|-------------------------|
| **TimeCurve** | Sale lifecycle: **exponential CHARM band** (0.99–10 CHARM × envelope), **linear per-CHARM price** (`ICharmPrice`), timer extension with cap, fees to router, sale end, CHARM-weighted redemption, prize podiums. **Redemption monotonicity (no referral):** [primitives — CL8Y value of DOUB per CHARM](../product/primitives.md#timecurve-redemption-cl8y-density-no-referral). **Gates (issue #55):** `buyFeeRoutingEnabled` — sale `buy` → `FeeRouter` **and** WarBow CL8Y paths (`warbowSteal`, `warbowRevenge`, `warbowActivateGuard`); `charmRedemptionEnabled` (`redeemCharms`); `reservePodiumPayoutsEnabled` (CL8Y `distributePrizes` when prize pool non-zero) — [operations: final signoff](../operations/final-signoff-and-value-movement.md). | [product/primitives.md](../product/primitives.md), [TimeCurve.sol](../../contracts/src/TimeCurve.sol), [LinearCharmPrice.sol](../../contracts/src/pricing/LinearCharmPrice.sol) |
| **Rabbit Treasury (Burrow)** | Deposits → **redeemable** backing + DOUB mint; `receiveFee` → burn + **protocol-owned** backing (no DOUB mint); withdraw from redeemable only (pro-rata, health efficiency, fees → protocol); epoch repricing via **total** backing + BurrowMath; canonical Burrow* events. | [product/rabbit-treasury.md](../product/rabbit-treasury.md), [RabbitTreasury.sol](../../contracts/src/RabbitTreasury.sol) |
| **Fee routing** | TimeCurve pulls sale asset from buyer, forwards to `FeeRouter`; splits per bps to sinks; weights sum to 10_000; remainder to last sink. | [onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md), [FeeRouter.sol](../../contracts/src/FeeRouter.sol) |
| **DOUB presale vesting** | Immutable `EnumerableSet` of beneficiaries + allocations; constructor enforces `sum(amounts) == requiredTotal`; **30%** vested at `vestingStart`, **70%** linear over `vestingDuration`; `startVesting` once when `token.balanceOf(this) >= totalAllocated`. **`claims` gate (issue #55):** `claim()` requires `claimsEnabled` via `setClaimsEnabled` (`onlyOwner`) — [operations: final signoff](../operations/final-signoff-and-value-movement.md). | [DoubPresaleVesting.sol](../../contracts/src/vesting/DoubPresaleVesting.sol), [PARAMETERS.md](../../contracts/PARAMETERS.md) |
| **NFT** | Series supply cap, authorized mint, traits onchain. | [LeprechaunNFT.sol](../../contracts/src/LeprechaunNFT.sol), [schemas/README.md](../schemas/README.md) |
| **Indexer** | Decode canonical logs, idempotent persist, chain pointer + reorg rollback of indexed rows. **`TimeCurveBuyRouter`** `BuyViaKumbaya` + `TimeCurve` `Buy` correlation for multi-asset entry metadata ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). | [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md), [indexer/src/persist.rs](../../indexer/src/persist.rs), [integrations/kumbaya.md](../integrations/kumbaya.md) |
| **Frontend** | Env-driven chain, addresses, indexer URL normalization for read paths. | [frontend/.env.example](../../frontend/.env.example), [frontend/src/lib/addresses.ts](../../frontend/src/lib/addresses.ts) |
| **Frontend — indexer offline / backoff (#96)** | When `VITE_INDEXER_URL` is set, shared **`reportIndexerFetchAttempt`**: offline after **3** debounced failure seconds; **`IndexerStatusBar`** **Indexer offline · retrying**; pollers back off **30s → 60s → 120s**; Simple **Recent buys** empty copy distinguishes unreachable indexer vs zero rows. | [timecurve-views — issue #96](../frontend/timecurve-views.md#indexer-offline-ux-issue-96), [invariants — #96](#indexer-offline-ux-and-backoff-gitlab-96), [`indexerConnectivity.ts`](../../frontend/src/lib/indexerConnectivity.ts) |
| **Frontend — wallet modal (SafePal / WalletConnect)** | With **`VITE_WALLETCONNECT_PROJECT_ID`**, RainbowKit lists **SafePal** (`safepalWallet`) plus default popular wallets; **EIP-6963** multi-injected discovery enabled. Without project id (non–E2E mock), **injected-only** (no WC QR). SafePal extension uses injected connector; mobile uses WC + SafePal deep link per RainbowKit. | [wallet-connection.md](../frontend/wallet-connection.md) ([issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58)), [`wagmi-config.ts`](../../frontend/src/wagmi-config.ts) |
| **Frontend — keyboard focus visible (WCAG 2.4.7, #97)** | **`a` / `button` / form controls / `[role="button"]` / `summary` / focusable `[tabindex]`** use **`:focus-visible`** outline via **`--yo-focus-ring`**; the same selectors are repeated under **`[data-rk]`** so RainbowKit’s scoped **`outline: none`** reset (`.iekbcc5`) does not suppress keyboard focus indicators in connect / account UI. Mouse activation does not show the ring (`:focus-visible` only). | [timecurve-views — #97](../frontend/timecurve-views.md#keyboard-focus-visible-issue-97), [design — a11y](../frontend/design.md#accessibility-and-ux), [wallet-connection.md](../frontend/wallet-connection.md), [§ #97](#keyboard-focus-visible-wcag-247-gitlab-97), [`index.css`](../../frontend/src/index.css) ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)) |
| **Frontend — single-chain wagmi (#81)** | **`wagmi` `chains`** lists **only** [`configuredChain()`](../../frontend/src/lib/chain.ts) — **no** bundled **`mainnet` / `sepolia`**. Default env when unset: **`VITE_CHAIN_ID=31337`**, **`VITE_RPC_URL=http://127.0.0.1:8545`** (matches [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)). Prevents incidental requests to viem default RPCs (e.g. **`eth.merkle.io`**) during local QA. | [wallet-connection.md — chains](../frontend/wallet-connection.md), [§ Single-chain wagmi](#frontend-single-chain-wagmi-issue-81), [issue #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) |
| **Frontend — wallet chain gate for writes (#95)** | When a wallet session is connected and **`useChainId() !==`** [`configuredTargetChainId()`](../../frontend/src/lib/chain.ts) (**`VITE_CHAIN_ID`** + **`VITE_RPC_URL`** rules; default **31337** Anvil — [`.env.example`](../../frontend/.env.example)): **writes are blocked**: overlay on TimeCurve Simple buy panel, Arena buy hub + standings + WarBow surfaces, **`/referrals`** register panel, **`/vesting`** claim panel; **`ChainMismatchWriteBarrier`**, **`SwitchToTargetChainButton`** (EIP-3326 `wallet_switchEthereumChain` via wagmi **`switchChain`**); **`chainMismatchWriteMessage`** pre-flight on **`submitBuy` / `submitRedeem`**, Arena **`handleBuy` / `runVoid` / WarBow**, referral **`register`**, vesting **`claim`** so calldata cannot be built for the wrong RPC network. **`/kumbaya`**, **`/sir`**: outbound DEX navigational links only — [issue #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95). | [wallet-connection.md — wrong-chain writes](../frontend/wallet-connection.md#wrong-network-write-gating-issue-95), [timecurve-views.md — Wrong network write gate (#95)](../frontend/timecurve-views.md#wrong-network-write-gating-issue-95), § [Frontend wrong-chain writes](#frontend-wallet-chain-write-gating-issue-95), [verify-yo-chain-write-network/SKILL](../../skills/verify-yo-chain-write-network/SKILL.md) |
| **Frontend — Album 1 BGM resume** | **localStorage** `yieldomega:audio:v1:playbackState`: stable **`trackId`**, index, **`positionSec`**, **`savedAt`**. **7-day** TTL clears offset only; **≥4s** throttle while playing; pause / skip / ended / tab-hide flush. **`AudioEngineProvider`** initial **`trackIndex`** matches hydrate so the dock title does not flash track 1. | [§ Album 1 BGM + SFX + resume](#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68), [sound-effects §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68), [issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71) |
| **Kumbaya routing (TimeCurve entry)** | Optional **ETH** / **stable** spend: either v3 **`exactOutput`** then **`TimeCurve.buy`**, or when **`timeCurveBuyRouter` ≠ 0**, **`buyViaKumbaya`** (single-tx, [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) / [issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)) — shared path + slippage in [`timeCurveKumbayaSingleTx.ts`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts). **Fail closed** if `chainId` or router config is missing, or **env / onchain** buy-router mismatch; MegaETH defaults track [Kumbaya integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit). | [integrations/kumbaya.md](../integrations/kumbaya.md), [kumbayaRoutes.ts](../../frontend/src/lib/kumbayaRoutes.ts), [TimeCurveBuyRouter.sol](../../contracts/src/TimeCurveBuyRouter.sol) |
| **Indexer — `buyFor` + `BuyViaKumbaya` ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67))** | Canonical **`TimeCurve` `Buy`** rows always use the event’s **`buyer`** (participant). **`BuyViaKumbaya`** is ingested only when **`TimeCurveBuyRouter`** is listed in **`ADDRESS_REGISTRY`**; persisted in **`idx_timecurve_buy_router_kumbaya`** and **left-joined** into **`GET /v1/timecurve/buys`** as optional **`entry_pay_asset`** (`eth` \| `stable`) and **`router_attested_gross_cl8y`**, keyed by **`tx_hash` + buyer + charm_wad**. **`pay_kind`**: `0` = ETH/WETH path, `1` = deployment stable (USDM/USDm). | [indexer/tests/integration_stage2.rs](../../indexer/tests/integration_stage2.rs), [decoder round-trip](../../indexer/src/decoder.rs) |
| **TimeCurve (frontend) — sale phase** | `derivePhase` uses **`ledgerSecIntForPhase`**: same preferred **“chain now”** as the **hero timer** (indexer `/v1/timecurve/chain-timer` + skew) when a snapshot exists; else **`latestBlock` / wall** fallback. Keeps **phase / Buy gating** aligned with the **deadline countdown** when wallet RPC lags; **onchain** `saleStart` / `deadline` / `ended` are still the authority for values. | [timecurve-views — Chain time and sale phase](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48) ([issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48)), [timeCurveSimplePhase.ts](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts) |
| **TimeCurve Arena — WarBow hero actions (issue #101)** | `PageHeroArcadeBanner` exposes **Steal / Guard / Revenge** directly in the hero through `WarbowHeroActions`. Suggested steal targets are discovery-only rows from `warbowLadderPodium()` and `/v1/timecurve/warbow/leaderboard`, deduped and filtered by the 2× BP rule when viewer BP is available; selecting one feeds the existing `stealVictimInput`, so live `battlePoints` / `stealsReceivedOnDay` reads and `describeStealPreflight` remain the eligibility gate. Guard/revenge CTAs share wrong-network and `buyFeeRoutingEnabled` barriers with the lower `WarbowSection`. | [timecurve-views — Arena WarBow hero actions](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101), [`WarbowHeroActions.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.tsx), [`WarbowHeroActions.test.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.test.tsx), [play skill](../../skills/play-timecurve-warbow/SKILL.md) |
| **TimeCurve Arena — sniper-shark cutout (issue #80)** | One animated `sniper-shark-peek-scope.png` decoration appears only on the Arena **Buy CHARM** panel, where timing / WarBow pressure matches the "hunter" metaphor. It replaces an existing buy-panel mascot slot instead of adding global chrome; `CutoutDecoration` keeps it decorative (`alt=""`, `aria-hidden`) and `prefers-reduced-motion` suppresses the animation. | [timecurve-views — Arena sniper-shark cutout](../frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80), [art README](../../frontend/public/art/README.md), [visual QA skill](../../skills/verify-yo-sniper-shark-ui/SKILL.md) |
| **Anvil E2E (Playwright) — pay mode + workers ([issue #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))** | **TimeCurve Simple** and **Arena** choose pay asset with **toggle buttons** (`aria-label` “Show price in …”), not legacy **radio** inputs. Stable hooks: **`data-testid="timecurve-simple-paywith-cl8y"`** / **`eth`** / **`usdm`**. E2E must not depend on removed **`input[name="timecurve-pay-with"]`**. With **`ANVIL_E2E=1`**, `frontend/playwright.config.ts` sets **`workers: 1`** and **`fullyParallel: false`**: one Anvil + one default mock account → **no cross-file parallel wallet txs** (nonce / sale / referral races). Unrelated: default CI **`npm run test:e2e`** (no Anvil) may use **5** workers. | [e2e-anvil.md](e2e-anvil.md), [`anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts), [`playwright.config.ts`](../../frontend/playwright.config.ts), [§ Anvil E2E Playwright](#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87) |
| **Dev stack** | Same wiring as [DeployDev.s.sol](../../contracts/script/DeployDev.s.sol): epoch open + sale start; deposit + buy with correct ERC20 approvals. | [DevStackIntegration.t.sol](../../contracts/test/DevStackIntegration.t.sol) |
| **DeployDev broadcast JSON (UUPS proxies)** | In `run-latest.json`, Foundry labels the **implementation** deployment as `contractName` `TimeCurve` / `RabbitTreasury` (and similar for other UUPS cores). The **canonical onchain address** is the **`ERC1967Proxy`** whose constructor `arguments[0]` matches that implementation. Calling or funding the **implementation** address reads **uninitialized** storage → misleading reads, **Solidity panic 0x12** on some paths, or empty/decode failures ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). **`currentCharmBoundsWad`** no longer **panics** when `initialMinBuy == 0`; it returns the **base CHARM envelope** **`(0.99e18, 10e18)`** ([issue #73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73)) — **buys and authoritative bounds still require the proxy**. Use console/registry extraction (`start-local-anvil-stack.sh`), `scripts/lib/broadcast_proxy_addresses.sh`, or `anvil_rich_state.sh` defaults — **not** a naive `jq 'select(.contractName=="TimeCurve")'` on the implementation row. | [`scripts/lib/broadcast_proxy_addresses.sh`](../../scripts/lib/broadcast_proxy_addresses.sh), [`anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh), [anvil-rich-state.md](anvil-rich-state.md); `test_currentCharmBoundsWad_zero_initialMinBuy_returns_base_envelope` |
| **MegaEVM bytecode vs local Anvil (issue #72)** | **MegaETH / MegaEVM** targets **large** maxima for deployed runtime (**524,288 bytes** = 512 KiB) and initcode (**548,864 bytes** = 536 KiB), per [MegaETH contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits). **Ethereum** and a **default** `anvil` (EIP-170 **0x6000** / ~24 KiB) differ from that; **our** [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) (and E2E / bot Anvil launchers) use **`--code-size-limit 524288`** (decimal; **0x80000** is invalid for this Foundry flag) so local **node** deploys match **512 KiB**, not 24 KiB. **`forge script`** applies the same EIP-170 limit during **pre-broadcast simulation**, so repo shell also passes **`--code-size-limit 524288`** on `forge script` (e.g. [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh), stack script, rich-state). A failure on a **raw** `anvil` or **`forge script` without the flag** is **not** automatically a MegaETH mainnet blocker. **Nested calls:** MegaEVM uses **98/100** gas forwarding (stricter than L1’s **63/64**); see [Gas forwarding](https://docs.megaeth.com/spec/megaevm/gas-forwarding.md). Verify sizes with `forge build --sizes` from `contracts/`. | [foundry-and-megaeth — MegaEVM bytecode limits](../contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas), [research/megaeth.md](../research/megaeth.md) |
| **Local stack bot swarm (tooling)** | [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) may spawn the Python bot swarm when `START_BOT_SWARM=1`. That path must be able to **`import web3`** (same deps as [`timecurve-bot`](../../bots/timecurve/README.md)). This is **QA tooling**, not onchain authority. On **PEP 668** hosts, a bare `pip install` without a venv can fail silently until swarm start; the script preflights and the README documents venv + `--user --break-system-packages` fallback ([issue #50](https://gitlab.com/PlasticDigits/yieldomega/-/issues/50)). **`SKIP_ANVIL_RICH_STATE=1` + default `buyCooldownSec`** used to **freeze `block.timestamp`** under pure automine while every wallet slept ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)): the stack now starts Anvil with **`--block-time`** when it launches the node for the swarm and documents **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** / **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** for dense buys. **Referral buys ([issue #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94)):** swarm registers a shared code from HD index **27** (unless `YIELDOMEGA_SWARM_REFERRALS=0`) and sets **`YIELDOMEGA_REFERRAL_CODE`** for worker `buy` paths — [`swarm_runner.py`](../../bots/timecurve/src/timecurve_bot/swarm_runner.py). | Manual: README install + stack script; [§ Bot swarm + Anvil timing — #99](#bot-swarm-anvil-interval-mining-issue-99); [`skills/verify-yo-bot-swarm-local-anvil/SKILL.md`](../../skills/verify-yo-bot-swarm-local-anvil/SKILL.md); [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) |

### Wallet connect UX (issue #58)

Same intent as the **Frontend — wallet modal** table row: production hosts should set **`VITE_WALLETCONNECT_PROJECT_ID`** so WalletConnect (and SafePal mobile via RainbowKit’s connector) work. Details: [wallet-connection.md](../frontend/wallet-connection.md).

<a id="keyboard-focus-visible-wcag-247-gitlab-97"></a>

### Keyboard focus visible — WCAG 2.4.7 (GitLab #97)

**Intent:** [GitLab #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97) — keyboard users must see **where focus is** when tabbing (WCAG 2.4.7 Focus Visible, Level AA). Focus moves correctly but was **invisible** when RainbowKit’s **`[data-rk] .iekbcc5 { outline: none }`** (specificity **0,2,0**) overrode unscoped **`button:focus-visible`** (**0,1,1**).

**Invariant:** Global **`index.css`** defines matching **`:focus-visible`** outlines using **`var(--yo-focus-ring)`**, and duplicates the same selector list under **`[data-rk]`** so wallet modal / account chrome shows the same ring as the rest of the app. **`[tabindex]:not([tabindex="-1"])`** covers custom focusable widgets; **`tabindex="-1"`** stays programmatic-only without a misleading ring policy. Prefer **`:focus-visible`** over **`:focus`** so pointer clicks do not flash an outline.

**Docs:** [design.md — Accessibility and UX](../frontend/design.md#accessibility-and-ux), [wallet-connection.md — configuration invariants](../frontend/wallet-connection.md#configuration-invariants). **Play checklist:** [`skills/verify-yo-focus-visible-a11y/SKILL.md`](../../skills/verify-yo-focus-visible-a11y/SKILL.md).

<a id="anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87"></a>

### Anvil E2E Playwright — concurrency and pay-mode selectors (issue #87)

**Intent:** [GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87) — `bash scripts/e2e-anvil.sh` runs **one** Anvil, **one** preview server, and **`e2e/anvil-*.spec.ts`** with **`ANVIL_E2E=1`**. `test.describe.configure({ mode: "serial" })` inside a file does **not** prevent **other** spec files from running in parallel, so a multi-worker run can interleave **writes** to the same chain and account. **Invariant:** when **`ANVIL_E2E=1`**, use **`workers: 1`** and disable **`fullyParallel`** for Playwright. **Pay mode:** E2E selects ETH (or other assets) via **`getByTestId("timecurve-simple-paywith-eth")`** (and siblings **`…-cl8y`**, **`…-usdm`**) on the buy panel, matching Simple + Arena **toggle** UI. **Do not** reintroduce `input[name="timecurve-pay-with"]` without restoring that markup. **Play skill:** [`skills/verify-yo-e2e-anvil/SKILL.md`](../../skills/verify-yo-e2e-anvil/SKILL.md).

<a id="frontend-single-chain-wagmi-issue-81"></a>

### Frontend single-chain wagmi (issue #81)

**Intent:** [GitLab #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81) — browsing with the wallet on **local Anvil** must not trigger background JSON-RPC to **Ethereum mainnet** defaults (e.g. **`https://eth.merkle.io`** via viem transports). **Invariant:** declare **one** wagmi chain — the env-driven [`configuredChain()`](../../frontend/src/lib/chain.ts). **Default** when `VITE_CHAIN_ID` / `VITE_RPC_URL` are unset: **31337** + **`http://127.0.0.1:8545`**. **Manual verification:** DevTools **Network** filter `merkle` → **0** requests after load on `http://127.0.0.1:5173/timecurve/arena` with stack + wallet on 31337. **Automated:** [`frontend/src/lib/chain.test.ts`](../../frontend/src/lib/chain.test.ts) (`resolveChainRpcConfig` defaults). **Play skill:** [`skills/verify-yo-local-wagmi-single-chain/SKILL.md`](../../skills/verify-yo-local-wagmi-single-chain/SKILL.md).

<a id="frontend-wallet-chain-write-gating-issue-95"></a>

### Frontend wallet chain write gate (issue #95)

**Intent:** [GitLab #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) — a connected wallet can still be left on **another** EVM chain while the header shows **Wrong Network**. The app must **not** open wallet submits with calldata built from this build’s deployment addresses unless **`useChainId()`** matches [`configuredTargetChainId()`](../../frontend/src/lib/chain.ts) (**`VITE_CHAIN_ID`** rules; default **Anvil 31337**). **Invariant:** `chainMismatchWriteMessage(useChainId())` **aborts** before **`writeContract` / approvals** in **`useTimeCurveSaleSession`** and **`useTimeCurveArenaModel`** (buy, WarBow, post-end **`runVoid`**); overlays + **`wallet_switchEthereumChain`** CTA (**`SwitchToTargetChainButton`**) gate Simple buy, Arena buy hub + standings + WarBow, **`/referrals`** register panel, **`/vesting`** claim. **Automated:** [`frontend/src/lib/chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts). **Play skill:** [`skills/verify-yo-chain-write-network/SKILL.md`](../../skills/verify-yo-chain-write-network/SKILL.md). **`/kumbaya`** / **`/sir`** outbound venue links remain **outside** this gate (#95 scoped to in-app ABI writes).

### Business rules (narrative, for reviewers)

- **TimeCurve + TimeMath + `ICharmPrice`:** **CHARM quantity** per buy is bounded by an **exponential daily envelope** (same `TimeMath.currentMinBuy` factor on a reference WAD): onchain **min CHARM** = `0.99e18 × scale` and **max CHARM** = `10e18 × scale` (ratio **10 / 0.99** always). **Per-CHARM price** in the accepted asset is **decoupled** and comes from **`ICharmPrice`** (default **`LinearCharmPrice`**: `base + dailyIncrement × elapsed / 1 day`). **Gross spend** = `charmWad × priceWad / 1e18`. Buys extend the deadline (or apply the **under-13m → 15m remaining** hard reset) up to **`timerCapSec`**. When the sale ends, participants **`redeemCharms`** once for a pro-rata share of launched tokens using **`totalCharmWeight`** in the denominator; **reserve** podium slots (**last buy, time booster, defended streak**) and **WarBow Battle Points** (separate PvP layer) update per [`docs/product/primitives.md`](../product/primitives.md). Each buy routes the **full gross** accepted asset through **`FeeRouter`** (five sinks — see fee doc). Referral incentives add **CHARM weight** (as a fraction of **`charmWad`**) without reserve rebates. **`acceptedAsset` must be a standard ERC20** (no fee-on-transfer / rebasing): accounting uses the computed `amount`, not balance deltas. **Issue #55:** `redeemCharms` / paying non-zero `distributePrizes` (CL8Y reserve to winners) and sale-time **`buyFeeRoutingEnabled`** (`buy` + WarBow **CL8Y** steal/revenge/guard) are **gated by `onlyOwner` flags** until operators enable them ([final signoff runbook](../operations/final-signoff-and-value-movement.md)). **`distributePrizes`** remains **permissionless** but reverts if the owner has not enabled reserve podium payouts and the pool balance is non-zero; empty-pool no-op behavior is unchanged. **Redemption intent:** **DOUB per CHARM** falls as the sale progresses (fixed sale pool, growing `totalCharmWeight`); **implied CL8Y per DOUB** from **`totalRaised / totalTokensForSale`** rises with each buy; **excluding referral**, the **CL8Y value of DOUB per CHARM** does not decrease — see [primitives — redemption economics](../product/primitives.md#timecurve-redemption-cl8y-density-no-referral).
- **RabbitTreasury + BurrowMath:** Users deposit the reserve asset during an **open** epoch and receive DOUB (credited to **redeemable** backing). **`receiveFee`** increases **total** backing but splits gross inflows into **burn** (sink transfer) and **protocol-owned** backing—no DOUB is minted. **Withdraw** burns DOUB and pays users from **redeemable** backing using `min(nominal, pro-rata)` on that bucket, a **health-linked efficiency** curve, an optional **epoch cooldown**, and a **withdrawal fee** that recycles into protocol-owned backing. **Epoch finalization** uses **total** backing (redeemable + protocol) inside `BurrowMath.coverageWad` so treasury strength reflects accumulated CL8Y. Math is fuzzed and cross-checked against Python reference and simulations where applicable.
- **FeeRouter + FeeMath:** Sink weights are validated to sum to 10_000 bps; distribution uses integer division with **remainder assigned to the last sink** so no dust remains in the router. Governance roles control sink updates.
- **DoubPresaleVesting:** Beneficiary list and per-address allocations are **immutable** after deploy. The constructor rejects **duplicate or zero addresses**, **zero individual allocations**, **length mismatches**, **`vestingDuration == 0`**, and **`requiredTotalAllocation != sum(amounts)`**. Only **`Ownable` owner** may call **`startVesting` once**, after **`DOUB.balanceOf(vesting) >= totalAllocated`**. Vesting math: **`cliff = allocation × 3000 / 10000`**, **`linearCap = allocation - cliff`**, **`linearReleased = linearCap × min(elapsed, duration) / duration`** for **`elapsed = t - vestingStart`**; **`vested = min(allocation, cliff + linearReleased)`** once **`t >= vestingStart`**. **`claim`** is **nonReentrant** and cannot exceed **`vested - claimed`**. **`claim` order:** **`NotStarted` → `ClaimsNotEnabled` → `NotBeneficiary`** (issue #55: **`setClaimsEnabled(true)`** is required for DOUB transfers). Enumeration via **`beneficiaryCount` / `beneficiaryAt` / `isBeneficiary`** wraps OpenZeppelin **`EnumerableSet.AddressSet`**.
- **LeprechaunNFT:** Series are created with a max supply; only the minter role can mint; trait structs are stored onchain for indexer/UI derivation.
- **Indexer:** Log decoding must match Solidity event layouts; persistence must survive duplicate delivery (`ON CONFLICT`); on reorg, rows strictly after the common ancestor block are removed and the chain pointer is reset ([REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md)).
- **Frontend helpers:** User-supplied addresses and indexer base URLs are normalized so RPC and HTTP clients see stable values.
- **Kumbaya routing:** See [integrations/kumbaya.md](../integrations/kumbaya.md) for environment runbooks and the **fail closed / path encoding / integrator parity** invariants. Unit coverage: [`kumbayaRoutes.test.ts`](../../frontend/src/lib/kumbayaRoutes.test.ts).
- **TimeCurve sale phase (UI):** Off-chain only **interprets** onchain `saleStart` / `deadline` / `ended` and must not split “now” between the **hero timer** and **`derivePhase`** when the **indexer** provides `chain-timer` — see [timecurve-views — Chain time and sale phase](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48) and [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48).
- **Arena WarBow hero actions (UI):** Hero steal candidates are convenience rows only; the selected target still flows through live `battlePoints` / `stealsReceivedOnDay` reads and `describeStealPreflight` before signing. Guard and revenge CTAs share the same wrong-chain and `buyFeeRoutingEnabled` write gates as the detailed WarBow section — see [timecurve-views — Arena WarBow hero actions](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) and [issue #101](https://gitlab.com/PlasticDigits/yieldomega/-/issues/101).
- **Arena sniper-shark cutout (UI):** Visual art remains non-authoritative and sparse: one decorative shark on the Arena buy panel, no shark in global chrome or neutral operator surfaces — see [timecurve-views — Arena sniper-shark cutout](../frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80) and [issue #80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80).

---

<a id="timecurve-arena-warbow-hero-actions-issue-101"></a>

### TimeCurve Arena WarBow hero actions (issue #101)

**Intent:** WarBow actions should be obvious at first glance on
`/timecurve/arena` without making the frontend authoritative for PvP rules.

| Invariant | Check |
|-----------|-------|
| **Hero visibility** | `PageHeroArcadeBanner` renders `WarbowHeroActions` with wallet context and **Steal / Guard / Revenge** controls before the detailed `WarbowSection`. |
| **Steal candidate source** | Candidates are deduped from `warbowLadderPodium()` and `/v1/timecurve/warbow/leaderboard`; indexer rows are only discovery hints. |
| **Onchain eligibility remains final** | Selecting a candidate writes `stealVictimInput`, which triggers the existing live contract reads for victim BP and `stealsReceivedOnDay`; `describeStealPreflight` and wallet simulation still gate the action. |
| **Write barriers** | Hero WarBow controls sit under `ChainMismatchWriteBarrier`; submit functions also abort on `chainMismatchWriteMessage` and `buyFeeRoutingEnabled === false`. |
| **Empty state** | No suggested target renders a clear empty state and leaves the manual address path in `WarbowSection` available. |

**Automated:** [`WarbowHeroActions.test.tsx`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.test.tsx).
**Docs / play:** [timecurve-views — issue #101](../frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md).

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

**Doc:** [timecurve-views — Indexer offline (issue #96)](../frontend/timecurve-views.md#indexer-offline-ux-issue-96) · play checklist [`skills/verify-yo-indexer-offline-ux/SKILL.md`](../../skills/verify-yo-indexer-offline-ux/SKILL.md).

<a id="timecurve-simple-stake-redeemed-issue-90"></a>

### TimeCurve Simple — stake panel after `redeemCharms` (issue #90)

After **`charmsRedeemed(address)`** is true, **`charmWeight`** still reflects the wallet’s historical allocation (**`redeemCharms`** does not zero weight — [`TimeCurve.sol`](../../contracts/src/TimeCurve.sol)), so the **Your stake at launch** panel must read as **settled**, not an unfilled claim:

| Invariant | Check |
|-----------|--------|
| **Redeemed DOUB row** | Show **`totalTokensForSale × charmWeight ÷ totalCharmWeight`** (matches **`redeemCharms`** **`tokenOut`**); sourced from **`expectedTokenFromCharms`** in [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) when **`phase === 'saleEnded'`**. |
| **CL8Y-at-launch tile** | **Dim + strikethrough** on the projection + **(redeemed)** on the label; **do not** replace CL8Y with DOUB-only “worth” copy (*issue #90 option B rejected*: mixed ETH/USDM/CL8Y pay rails keep anchoring semantics CL8Y-native for the historical projection). |
| **Settled chrome** | Header **`actions`**: check pictogram + **`PageBadge`** label **Settled** (`tone="live"`) — [`TimeCurveStakeAtLaunchSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.tsx). |

**Doc:** [timecurve-views — stake redeemed](../frontend/timecurve-views.md#timecurve-simple-stake-redeemed-issue-90) · [`TimeCurveStakeAtLaunchSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx) · [issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90) · play checklist [`skills/verify-yo-timecurve-stake-redeemed-ui/SKILL.md`](../../skills/verify-yo-timecurve-stake-redeemed-ui/SKILL.md).

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

**Doc:** [timecurve-views — Buy CHARM fresh bounds](../frontend/timecurve-views.md#buy-charm-submit-fresh-bounds-issue-82) · [kumbaya.md](../integrations/kumbaya.md#issue-65-single-tx-router) · [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) · play checklist [`skills/verify-yo-timecurve-buy-charm-submit/SKILL.md`](../../skills/verify-yo-timecurve-buy-charm-submit/SKILL.md).

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
| Visual QA | Run the play checklist in [`skills/verify-yo-sniper-shark-ui/SKILL.md`](../../skills/verify-yo-sniper-shark-ui/SKILL.md); confirm it does not crowd bunny/leprechaun hierarchy on Home, Simple, and Arena. |

**Automated coverage:** frontend typecheck / lint / build smoke. Full crowding
and hierarchy verification is visual QA.

### TimeCurve — single-tx Kumbaya `buyViaKumbaya` (issue #66)

When **Simple** or **Arena** pay mode is **ETH** or **USDM** and **`TimeCurve.timeCurveBuyRouter()`** is **non-zero**, the buy path calls **`TimeCurveBuyRouter.buyViaKumbaya`** (same **packed path** and **slippage** as the two-step flow); **`plantWarBowFlag`** matches the **`buy` / `buyFor`** opt-in ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). **Zero** onchain buy router → legacy **two-step** only. **CL8Y** direct **`buy`** does not use the buy router. **Anvil E2E:** `scripts/lib/anvil_deploy_dev.sh` logs **TimeCurveBuyRouter**; `scripts/e2e-anvil.sh` may set **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`** for optional env/onchain parity checks. **Live Anvil buy-router scope (#65) automated via fork test:** [issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78) — `scripts/verify-timecurve-buy-router-anvil.sh` + [`VerifyTimeCurveBuyRouterAnvil.t.sol`](../../contracts/test/VerifyTimeCurveBuyRouterAnvil.t.sol). **Doc:** [kumbaya.md — single-tx](../integrations/kumbaya.md#issue-65-single-tx-router) · [issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66).

<a id="timecurvebuyrouter-anvil-verification-issue-78"></a>

### TimeCurveBuyRouter — Anvil verification (issue #78)

**Intent:** The [#65 / #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) **TimeCurveBuyRouter** path on Anvil (fixtures, `quoteExactOutput` vs `exactOutput`, `buyViaKumbaya`, `plantWarBowFlag` / WarBow, `setTimeCurveBuyRouter(0)` revert) is covered by a **one-command** script so the **scope checklist** is not deferred. **`start-local-anvil-stack.sh`** runs **`DeployDev`** only unless **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)); otherwise use **`e2e-anvil.sh`**, **`anvil_deploy_dev.sh`**, or **`YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/verify-timecurve-buy-router-anvil.sh`** to deploy **`DeployKumbayaAnvilFixtures`** and merge **`contracts.TimeCurveBuyRouter`** into [`contracts/deployments/local-anvil-registry.json`](../../contracts/deployments/local-anvil-registry.json) for the indexer ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

| Invariant | Check |
|----------|--------|
| **Preconditions** | Anvil **`--code-size-limit 524288`**; **TimeCurve** = **proxy**; sale **not** ended (use `SKIP_ANVIL_RICH_STATE=1` for default stack, or a fresh `DeployDev`). |
| **Script** | `bash scripts/verify-timecurve-buy-router-anvil.sh` sets **`YIELDOMEGA_FORK_VERIFY=1`** and runs **`forge test`** for [`VerifyTimeCurveBuyRouterAnvil.t.sol`](../../contracts/test/VerifyTimeCurveBuyRouterAnvil.t.sol) against **`FORK_URL`**. With **`YIELDOMEGA_DEPLOY_KUMBAYA=1`**, broadcasts **`DeployKumbayaAnvilFixtures`** when **`timeCurveBuyRouter()`** is zero. After a non-zero router, **jq-merges** **`contracts.TimeCurveBuyRouter`** into **`local-anvil-registry.json`** when present and merges **`VITE_KUMBAYA_*`** into **`frontend/.env.local`** when the deploy log supplies fixture addresses ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)). |
| **Local registry + indexer ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84))** | **`ADDRESS_REGISTRY_PATH`** must include **`contracts.TimeCurveBuyRouter`** matching **`cast call <TimeCurve> "timeCurveBuyRouter()(address)"`** after fixtures, or **`BuyViaKumbaya`** rows are **not** ingested ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). **Restart** the indexer after the verify script or **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** stack start so it reloads the registry. Optional one-shot stack: **`YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/start-local-anvil-stack.sh`**. Helpers: [`scripts/lib/kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh). |
| **Buy event `flagPlanted`** | The fork test uses **`warbowPendingFlagOwner`** (same **opt-in** semantics as the **`Buy`** event, [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)) instead of log decoding. |
| **CI / default `forge test`** | Without **`YIELDOMEGA_FORK_VERIFY`**, the test **no-ops** (passes) so `forge test` in CI is unchanged. |

**Play skill (third-party agents):** [`skills/verify-yo-timecurve-buy-router-anvil/SKILL.md`](../../skills/verify-yo-timecurve-buy-router-anvil/SKILL.md) · [issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78).

---

<a id="timecurve-post-end-gates-live-anvil-gitlab-79"></a>

### TimeCurve post-end gates — live Anvil (issue #79)

**Intent:** [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79) tracks a **deferred** live walkthrough for **#55** post-end gates (`redeemCharms`, `distributePrizes`) on an **ended** sale. Forge already covers the revert strings; this section ties **one-chain** `cast` evidence to a reproducible script.

| Invariant | Check |
|----------|--------|
| **Preconditions** | `TimeCurve.ended == true`; `charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` start **false** (after [DeployDev](../../contracts/script/DeployDev.s.sol)’s E2E convenience flags, the setup script [resets them](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79)); `prizesDistributed == false`; non-zero `acceptedAsset` balance of `podiumPool` (otherwise `distributePrizes` returns before the [reserve gate](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)). |
| **Setup (preferred)** | `ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh` — Part1 buys + shell warp + `SimulateAnvilRichStatePart2EndSaleOnly` only (see [anvil-rich-state.md](anvil-rich-state.md#post-end-gate-walkthrough-issue-55--79)). |
| **Script** | `bash scripts/verify-timecurve-post-end-gates-anvil.sh` (rows: charm gate revert → owner on → redeem; reserve gate revert → owner on → `distributePrizes`). |

**Play skill (third-party agents):** [`skills/verify-yo-timecurve-post-end-gates/SKILL.md`](../../skills/verify-yo-timecurve-post-end-gates/SKILL.md).

**CL8Y surplus (issue #70):** After `buyFor`, any **CL8Y** remaining on the router (exact-output dust / rounding, or accidental pre-seed on the router) is **`safeTransfer`’d to `cl8yProtocolTreasury`** — not refunded to the buyer. Constructor requires a **non-zero** treasury address. **`Cl8ySurplusToProtocol`** event. Tests: [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) `test_buyViaKumbaya_preseed_cl8y_surplus_routes_to_protocol_treasury`. [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70) · [CL8Y flow audit](../onchain/cl8y-flow-audit.md).

---

<a id="referrals-page-visual-issue-64"></a>

### Referrals `/referrals` visual surface and E2E (issue #64)

**Intent:** The dedicated referrals surface ([`ReferralsPage.tsx`](../../frontend/src/pages/ReferralsPage.tsx) + [`ReferralRegisterSection.tsx`](../../frontend/src/pages/referrals/ReferralRegisterSection.tsx)) must stay usable for **link capture docs**, **registry reads** (from `VITE_REFERRAL_REGISTRY_ADDRESS` or `TimeCurve.referralRegistry()`), **wallet-gated register**, and **post-register share links** with copy-to-clipboard. **Copy UX** must not be silent: success shows an obvious **inline banner** plus button **Copied!**; clipboard **unsupported or denied** shows an error `StatusMessage` ([issue #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)). **Authority** for codes and burns stays on **`ReferralRegistry`** + **`TimeCurve`** — see [product/referrals.md](../product/referrals.md).

**Launch-plan / F-11 (issue #91):** The **`YO-DOUB-Launch-UX-Flows`** **F-11** checklist and [`launchplan-timecurve.md`](../../launchplan-timecurve.md#6-under-construction-frontend) must **not** classify **`/referrals`** as **`UnderConstruction`**. That route is a **first-class** shipping surface alongside TimeCurve; placeholders remain **`/rabbit-treasury`** and **`/collection`** until their milestones.

**Browser storage (issue #85):** Pending capture (`?ref=` / path) uses **`yieldomega.ref.v1`** in **`localStorage` + `sessionStorage`**. Post-register “my code” cache for share-link UX uses **`yieldomega.myrefcode.v1.<walletLowercase>`** in **`localStorage` only** — do not conflate with R7 pending-key checks. Table + payloads: [product/referrals.md — referral browser storage keys](../product/referrals.md#referral-browser-storage-keys).

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

**Play skill (agents walking the checklist):** [`skills/verify-yo-referrals-surface/SKILL.md`](../../skills/verify-yo-referrals-surface/SKILL.md) · GitLab [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64).

<a id="referrals-leaderboard-and-earnings-issue-94"></a>

### Referrals — indexer leaderboard + wallet earnings (issue #94)

**Intent:** `/referrals` may show an **indexer-backed referrer leaderboard** and a **per-wallet CHARM summary** without fabricating metrics. Ranks and sums must come from **`idx_timecurve_referral_applied`** / the HTTP routes in [product/referrals.md — dashboard §](../product/referrals.md#referrals-dashboard-issue-94). **CL8Y / USDM / ETH “notional”** lines on the page are **illustrative** (current `currentPricePerCharmWad` × combined indexed referral CHARM, plus fallback pay-asset multipliers) — not tax, legal, or treasury advice.

| Invariant | Meaning |
|-----------|---------|
| Leaderboard ordering | **`GET /v1/referrals/referrer-leaderboard`** sorts by **Σ `referrer_amount`** descending. |
| Wallet row | **`GET /v1/referrals/wallet-charm-summary`** returns string integer **wei** totals for referrer vs referee CHARM splits. |
| Schema | Indexer **`x-schema-version`** bumped with new routes (see `indexer/src/api.rs`). |

**Implementation:** [`ReferralLeaderboardSection.tsx`](../../frontend/src/pages/referrals/ReferralLeaderboardSection.tsx), [`ReferralProgramEarningsSection.tsx`](../../frontend/src/pages/referrals/ReferralProgramEarningsSection.tsx), [`ReferralConnectedWalletSection.tsx`](../../frontend/src/pages/referrals/ReferralConnectedWalletSection.tsx); API: [`indexerApi.ts`](../../frontend/src/lib/indexerApi.ts). **Local swarm:** `timecurve-bot swarm` registers a shared code from HD index **`27`** when **`YIELDOMEGA_SWARM_REFERRALS≠0`** and sets **`YIELDOMEGA_REFERRAL_CODE`** for worker buys — [`swarm_layout.py`](../../bots/timecurve/src/timecurve_bot/swarm_layout.py), [`referral_bootstrap.py`](../../bots/timecurve/src/timecurve_bot/referral_bootstrap.py).

---

<a id="timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68"></a>

### TimeCurve frontend — Album 1 BGM + SFX bus (issue #68) and BGM resume (issue #71)

**Intent:** One **Web Audio** graph serves **Blockie Hills** BGM (streaming MP3) and decoded **SFX** buses. **#68** shipped autoplay attempt, gesture unlock, mix prefs in **`yieldomega:audio:v1:prefs`**, and TimeCurve / global UI wiring. **#71** adds **playback resume**: same key namespace, **`playbackState`** JSON, **track id** reconciliation if the manifest changes, **7-day** staleness (offset only), **≥4s** coalesced writes while playing, and synchronous flush on **pause**, **skip**, **natural `ended`**, **`visibilitychange` → hidden**, **`pagehide` / `beforeunload`**.

| Invariant | Meaning | Automated / manual |
|-----------|---------|-------------------|
| Graph + buses | `WebAudioMixer`: `bgmGain` + `sfxGain` → `masterGain` → destination | Code review |
| Autoplay + unlock | Matches #68: first pointer may unlock + start BGM | Manual Chromium / Firefox |
| **Resume offset** | After **`loadedmetadata`**, apply saved **`currentTime`** before **`play()`** so autoplay-blocked sessions still resume on first gesture | Manual |
| **Throttle** | No periodic **localStorage** writes faster than **`AUDIO_PLAYBACK_PERIODIC_SAVE_MS`** (~4s) during steady playback | Manual timer or unit gate (`createMinIntervalGate`) |
| **Skip / end** | Next track always starts at **0:00** in storage and on element | Manual |
| **Dock title** | Initial React **`trackIndex`** reads **`loadAudioPlaybackState`** in sync with **`WebAudioMixer`** hydrate | Manual refresh mid-album |

**Unit tests:** [`audioPlaybackState.test.ts`](../../frontend/src/audio/audioPlaybackState.test.ts) (`normalizePlaybackState`, save/load, stale TTL, throttle gate), [`albumPlaylist.test.ts`](../../frontend/src/audio/albumPlaylist.test.ts) (`id` + `durationSec` on tracks).

**Play skill (agents):** [`skills/verify-yo-album-bgm-resume/SKILL.md`](../../skills/verify-yo-album-bgm-resume/SKILL.md) · GitLab [#71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71).

**Product / UX doc:** [sound-effects-recommendations §8](../frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) · GitLab [#68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68).

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
| **Launch-anchor 1.2× rule** | **Product invariant (DOUB/CL8Y locked LP):** `DoubLPIncentives` seeds DOUB/CL8Y locked liquidity at **1.2× the per-CHARM clearing price**, so a participant's CHARM is projected to be worth **`charmWeightWad × pricePerCharmWad × 1.2 / 1e18`** CL8Y wei at launch. **Worked example:** if the final buyer pays `2 CL8Y` for `1 CHARM` and `1 CHARM` redeems for `100 DOUB`, those `100 DOUB` are worth **`2 × 1.2 = 2.4 CL8Y`** at launch — the DOUB count drops out because dilution and pricing are dual sides of the same anchor. The number is **non-decreasing** during the sale because the per-CHARM price (e.g. `LinearCharmPrice`) is non-decreasing in elapsed time, so participant-facing UX should **show CL8Y-at-launch and hide the DOUB count**. | Helpers: [`launchLiquidityAnchorWad`](../../frontend/src/lib/timeCurvePodiumMath.ts), [`participantLaunchValueCl8yWei`](../../frontend/src/lib/timeCurvePodiumMath.ts); tests: `frontend/src/lib/timeCurvePodiumMath.test.ts` (`launch-anchor invariant: launch price = final per-CHARM price × 1.2`); policy: [`docs/onchain/fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md), [`contracts/src/sinks/DoubLPIncentives.sol`](../../contracts/src/sinks/DoubLPIncentives.sol), [`launchplan-timecurve.md`](../../launchplan-timecurve.md) |
| Sale start | `startSale` transitions once | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): `test_startSale`, `test_startSale_reverts_twice`, `test_startSale_insufficient_launched_tokens_reverts` |
| Happy-path buy | Valid buy updates CHARM weight and `totalRaised` | `test_buy_basic` |
| **`buyFor` / companion router (issue #65)** | Only **`timeCurveBuyRouter`** may call **`buyFor`**; CL8Y **`transferFrom(payer)`** with payer = router; CHARM weight, WarBow, cooldown, referrals use **`buyer`**. Immutable **`TimeCurveBuyRouter`**: recomputes gross CL8Y from TimeCurve views, validates packed path (CL8Y first, WETH or `stableToken` last), **`exactOutput`**, then **`buyFor`**. | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol) (`test_buyFor_*`); [`TimeCurveBuyRouter.t.sol`](../../contracts/test/TimeCurveBuyRouter.t.sol) |
| Per-wallet buy cooldown | Second buy before `nextBuyAllowedAt` reverts **`"TimeCurve: buy cooldown"`**; boundary at `nextBuyAllowedAt` succeeds; wallets independent | [`TimeCurve.t.sol`](../../contracts/test/TimeCurve.t.sol): cooldown / boundary / two-wallet tests; handler respects cooldown in [`TimeCurveInvariant.t.sol`](../../contracts/test/TimeCurveInvariant.t.sol) |
| **DeployDev buy cooldown env** <a id="deploydev-buy-cooldown-env-issue-88"></a> | **`DeployDev`** must still default to **`buyCooldownSec = 300`** when QA flags are unset. Optional **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** → initializer uses **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** default **1** (seconds). Optional explicit **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** in either branch (**must be &gt; 0** — **`TimeCurve`** rejects zero at init). Resolver is single-source in [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol). | [`DeployDevBuyCooldown.t.sol`](../../contracts/test/DeployDevBuyCooldown.t.sol) (`test_readBuyCooldownSec_env_resolution_matrix`, `test_constants_match_documented_defaults`) |
| **Bot swarm + Anvil interval mining + cooldown guidance** <a id="bot-swarm-anvil-interval-mining-issue-99"></a> | [GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99): With **`SKIP_ANVIL_RICH_STATE=1`**, **`START_BOT_SWARM`** defaults **on**. **Per-wallet `buyCooldownSec`** (default **300**) + **pure automine** (**no txs ⇒ no new blocks ⇒ frozen `block.timestamp`**) stalled bots that **`sleep` until `nextBuyAllowedAt`**. **Mitigations (local only):** (1) [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) starts Anvil with **`--block-time`** when it spawns the node (**`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC`**, default **12**; **`0`** disables interval mining). (2) Operators should set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** when they want **dense** continuous **`Buy`** traffic without long wall-clock gaps — see [#88](#deploydev-buy-cooldown-env-issue-88). **Non-Anvil / production bot code is unchanged** (no auto `evm_increaseTime`). Reusing a **pre-existing** RPC on the swarm port skips **`--block-time`** — script warns. | Manual + script header; play checklist [`skills/verify-yo-bot-swarm-local-anvil/SKILL.md`](../../skills/verify-yo-bot-swarm-local-anvil/SKILL.md); [e2e-anvil.md — swarm + chain time](e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99) |
| Min / max gross spend monotonic | `currentMinBuyAmount` / `currentMaxBuyAmount` increase with time (envelope × price) | `test_minBuy_grows_over_time` |
| CHARM bounds ratio | `10 × minCharm` and `0.99 × maxCharm` match within **floor-division slack** (shared envelope factor) | `test_charmBounds_ratio_10_over_099_fuzz` |
| CHARM bounds exponential scale | Min/max CHARM ~20%/day with canonical `growthRateWad` | `test_charmBounds_scale_approx_20_percent_per_day` |
| Purchase bounds (CHARM WAD) | Each buy in `[currentCharmBoundsWad.min, .max]` | `test_buy_below_minBuy_reverts`, `test_buy_above_cap_reverts`, `test_buy_charmWad_in_bounds_fuzz` |
| **`currentCharmBoundsWad` degenerate storage ([issue #73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73))** | If **`initialMinBuy == 0`** (uninitialized **implementation** / wrong storage), **`currentCharmBoundsWad`** returns the **base CHARM band** **`(0.99e18, 10e18)`** instead of **panic 0x12** (div-by-zero in `_charmBounds`). **Initialized proxy** behavior is unchanged. | `test_currentCharmBoundsWad_zero_initialMinBuy_returns_base_envelope` |
| Spend formula | `amount = charmWad × pricePerCharmWad / WAD`; `totalRaised` += `amount` | `test_buy_charmWad_in_bounds_fuzz`, `test_linear_price_per_charm_independent_of_envelope` |
| Linear price schedule | `LinearCharmPrice.priceWad` matches `base + daily×elapsed/86400`; monotone in `elapsed` | [`LinearCharmPrice.t.sol`](../../contracts/test/LinearCharmPrice.t.sol): `test_priceWad_linear_matches_formula_fuzz`, `test_priceWad_monotonic_in_elapsed_fuzz`, `test_constructor_zero_base_reverts` |
| Price decoupled from envelope | With `growthRateWad = 0`, CHARM bounds flat while `currentPricePerCharmWad` still ramps linearly | `test_linear_price_per_charm_independent_of_envelope` |
| Timer extension capped | Extended deadline respects `timerCapSec` | `test_timer_extends_on_buy`, `test_timer_cap_fuzz` |
| Sale state machine | No buy before start / after end / after timer expiry | `test_buy_not_started_reverts`, `test_buy_after_end_reverts`, `test_buy_after_timer_expires_reverts` |
| `endSale` gating | Not before start; not twice | `test_endSale_not_started_reverts`, `test_endSale_already_ended_reverts` |
| End + redemption | Sale can end; user redeems once | `test_endSale_and_claim`, `test_redeemCharms_reverts_before_end`, `test_double_redeem_reverts` |
| **Value-movement gates (issue #55)** | `buy` + WarBow CL8Y + `redeemCharms` + non-zero `distributePrizes` respect `onlyOwner` flags; [`DeployDev`](../../contracts/script/DeployDev.s.sol) enables post-end flags for local E2E; **post-end `cast` walkthrough** for disabled-gate reverts: [issue #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79), `ANVIL_RICH_END_SALE_ONLY=1` + [`verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) | `test_redeemCharms_reverts_while_charm_redemption_disabled`, `test_distributePrizes_reverts_while_reserve_podium_payouts_disabled`, `test_buy_reverts_when_sale_interactions_disabled`, `test_warbow_cl8y_burns_revert_when_sale_interactions_disabled`; [final-signoff runbook](../operations/final-signoff-and-value-movement.md) |
| **`distributePrizes` execution (issue #70)** | **`TimeCurve.distributePrizes`** is **`onlyOwner`** (manual review of the **execution** tx, not only `reservePodiumPayoutsEnabled`). Non-owner reverts. | `test_distributePrizes_reverts_for_non_owner` |
| Redemption rounding | Integer redeem can be zero (tiny sale supply vs raised) | `test_redeemCharms_nothing_to_redeem_reverts` |
| Fees to router | Buy path pulls from buyer and routes via `FeeRouter` | `test_fees_routed_on_buy` |
| Same-block call order | Last-buyer podium reflects sequential buy order (Foundry single-tx context; aligns with tx-index ordering) | `test_sameBlock_buyOrder_lastBuyerReflectsSecondCall` |
| Podium payout liveness | Empty **podium pool** does **not** set `prizesDistributed`; funded pool can pay later | `test_distributePrizes_empty_vault_is_retryable`, `test_distributePrizes_dust_pool_is_retryable` |
| Podium payout happy path | Podium pool balance decreases after distribution; flag set | `test_distributePrizes_reduces_vault_and_sets_flag` |
| **Podium push auth (issue #70)** | Production: **`PodiumPool.setPrizePusher(TimeCurve)`** once; then **`payPodiumPayout`** only accepts **`msg.sender == prizePusher`** (legacy **`DISTRIBUTOR_ROLE`** path when `prizePusher` unset — tests / migration). | [`FeeSinks.t.sol`](../../contracts/test/FeeSinks.t.sol): `test_podiumPool_payPodiumPayout_prize_pusher_wins_over_distributor_role` |
| Constructor sanity | Non-zero asset, router, `launchedToken`, `podiumPool`, **`ICharmPrice`** | `test_constructor_zero_acceptedAsset_reverts`, `test_constructor_zero_feeRouter_reverts`, `test_constructor_zero_launchedToken_reverts`, `test_constructor_zero_podiumPool_reverts`, `test_constructor_zero_charmPrice_reverts` |
| Referral CHARM | Full gross to router; referee + referrer CHARM from `charmWad`; **`plantWarBowFlag` passthrough** on `buy(charmWad, codeHash, plant)` ([issue #77](https://gitlab.com/PlasticDigits/yieldomega/-/issues/77)) | [`TimeCurveReferral.t.sol`](../../contracts/test/TimeCurveReferral.t.sol): `test_buy_with_referral_charms_and_full_gross_to_fee_router`, `test_buy_self_referral_reverts`, `test_buy_invalid_code_reverts`, `test_referral_buy_with_plant_false_does_not_plant`, `test_referral_buy_with_plant_true_plants` |
| Referral path capture (read client) | `?ref=` and allowed path shapes normalize with `ReferralRegistry` rules; reserved app path segments are not treated as codes | [`referralPathCapture.test.ts`](../../frontend/src/lib/referralPathCapture.test.ts) |
| **Referrals `/referrals` surface (issue #64, #85, #86, launch F-11 #91, #94)** | Branded shell + registry section invariants: either resolvable registry (reads + register UX) or explicit **unconfigured** messaging; pending `?ref=` / path capture stays consistent with [product/referrals.md](../product/referrals.md). **`/referrals`** is **not** documented as **`UnderConstruction`** in [`launchplan-timecurve.md`](../../launchplan-timecurve.md) [**F-11** / `YO-DOUB-Launch-UX-Flows.md`](../../YO-DOUB-Launch-UX-Flows.md). **Storage keys ([issue #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)):** pending **`yieldomega.ref.v1`** (local + session) vs my-code **`yieldomega.myrefcode.v1.<wallet>`** (local only). **Share-link copy ([issue #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86)):** visible success/error feedback, not silent no-ops. **Indexer leaderboard + wallet CHARM ([issue #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94)):** `GET /v1/referrals/referrer-leaderboard` / `GET /v1/referrals/wallet-charm-summary` + `/referrals` panels stay aligned with [product dashboard §](../product/referrals.md#referrals-dashboard-issue-94). | [§ Referrals page visual — issue #64](#referrals-page-visual-issue-64); [§ Referrals leaderboard + earnings — issue #94](#referrals-leaderboard-and-earnings-issue-94); [`referrals-surface.spec.ts`](../../frontend/e2e/referrals-surface.spec.ts); [`anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts) |
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

**WarBow CL8Y burns — user-driven, sink-exact (issue #70)** — *Approved policy exception: public **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** pull CL8Y from the caller and forward **fixed WAD** amounts to **`0x…dEaD`** in the same transaction; **`claimWarBowFlag`** has no CL8Y leg.* Fuzz / regression: [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) (`testFuzz_warbow_guard_burn_exact_to_sink`, `testFuzz_warbow_steal_burn_exact_to_sink`, `testFuzz_warbow_revenge_burn_exact_to_sink`). Play skill: [`skills/play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md). [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70) · [CL8Y flow audit](../onchain/cl8y-flow-audit.md).

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

<a id="presale-vesting-frontend-gitlab-92"></a>

### Presale vesting frontend — `/vesting` (GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Hidden route** | `/vesting` is **not** listed in `RootLayout` primary nav — participants open a **direct URL** only (issue comment: PlasticDigits). | [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx) |
| **Proxy address** | `VITE_DOUB_PRESALE_VESTING_ADDRESS` must be the **ERC-1967 proxy**, not an implementation row from `run-latest.json` (same rule as other UUPS cores — [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). | [`addresses.ts`](../../frontend/src/lib/addresses.ts), [`frontend/.env.example`](../../frontend/.env.example) |
| **`DeployDev` wiring** | Local `DeployDev` deploys a **dev-only** two-beneficiary vesting (Anvil **#0** + **#1**), **180-day** duration, mints DOUB to the contract, **`setClaimsEnabled(true)`**, **`startVesting()`**, logs **`DoubPresaleVesting:`** for stack scripts. **Production mainnet:** do **not** assume claims are enabled at deploy — follow [final signoff](../operations/final-signoff-and-value-movement.md). | [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) |
| **Schedule UX** | Page states **30% / 70%** cliff + linear, shows **vestingStart** and **vestingStart + vestingDuration** in **local timezone** and **UTC**, and surfaces **allocation / claimed / claimable** for the connected wallet. | [`PresaleVestingPage.tsx`](../../frontend/src/pages/PresaleVestingPage.tsx), [presale-vesting.md](../frontend/presale-vesting.md) |
| **Claim** | `claim` CTA disabled when `claimable == 0`, `!claimsEnabled`, or wallet not a beneficiary; matches onchain `claim` revert order (`NotStarted` → `ClaimsNotEnabled` → `NotBeneficiary` — [issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)). | [`DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol) |

**Play checklist (3rd-party agents):** [`skills/verify-yo-presale-vesting/SKILL.md`](../../skills/verify-yo-presale-vesting/SKILL.md). **Anvil E2E:** [`anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts) via [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh).

<a id="canonical-fee-sinks-mobile-gitlab-93"></a>

### Canonical fee sinks — mobile address affordance + readable protocol labels (GitLab [#93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93))

| Invariant | Meaning | Evidence |
|-----------|---------|----------|
| **Mobile address link** | Viewports **≤479px** (`matchMedia max-width: 479px`): each **full** EVM address (`0x` + 40 hex) in the global **Canonical fee sinks** panel and related trust rows shows **`0x`** + **first four** + **ellipsis** + **last four** characters; the link lands on **`{VITE_EXPLORER_BASE_URL}/address/{addr}`** (default **`https://mega.etherscan.io`**; trailing slash stripped), same contract as tx links ([GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)). Wider viewports show the **full** hex. Invalid addresses render as monospace text without a link. | [`MegaScannerAddressLink.tsx`](../../frontend/src/components/MegaScannerAddressLink.tsx), [`explorerAddressUrl`](../../frontend/src/lib/explorer.ts), [`abbreviateAddressEnds`](../../frontend/src/lib/addressFormat.ts), [`FeeTransparency.tsx`](../../frontend/src/components/FeeTransparency.tsx) |
| **Operator-readable names** | KV labels that mirror **Solidity** getters use **spaced title case**: `WARBOW_FLAG_SILENCE_SEC` → *Warbow Flag Silence Sec*; `warbowPendingFlagOwner` → *Warbow Pending Flag Owner*; multi-token rows like `charmPrice basePriceWad` → *Charm Price · …*. Prose phrases such as *seconds remaining* stay unchanged (`humanizeKvLabel` heuristics). | [`humanizeIdentifier.ts`](../../frontend/src/lib/humanizeIdentifier.ts), [`TimeCurveProtocolPage.tsx`](../../frontend/src/pages/TimeCurveProtocolPage.tsx), [`TimeCurveSections.tsx`](../../frontend/src/pages/timecurve/TimeCurveSections.tsx), [`humanizeIdentifier.test.ts`](../../frontend/src/lib/humanizeIdentifier.test.ts) |

**Play checklist (3rd-party agents):** [`skills/verify-yo-fee-sinks-mobile/SKILL.md`](../../skills/verify-yo-fee-sinks-mobile/SKILL.md). **Spec:** [`timecurve-views.md` — global footer fee sinks](../frontend/timecurve-views.md#global-footer-fee-sinks-mobile-issue-93).

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

**Play checklist (3rd-party agents):** [`skills/verify-yo-canonical-address-explorer/SKILL.md`](../../skills/verify-yo-canonical-address-explorer/SKILL.md). **Spec:** [`wallet-connection.md` — explorer env](../frontend/wallet-connection.md#block-explorer-base-url-gitlab-98).

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
| TimeCurve `ledgerSecIntForPhase` + `derivePhase` | Prefers hero `chainNowSec` over block time when set; state machine for Simple + Arena | [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts) (issue [#48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48), [view doc](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48)) |
| Presale vesting display helpers | `formatDoubHuman` + `dualWallClockLines` for `/vesting` | [`presaleVestingFormat.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingFormat.test.ts) ([issue #92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)) |
| Fee sinks labels + abbreviated addresses + explorer URL helpers | `humanizeKvLabel` · `explorerAddressUrl` / `megaEtherscanAddressUrl` · `abbreviateAddressEnds` for **42-char** hex | [`humanizeIdentifier.test.ts`](../../frontend/src/lib/humanizeIdentifier.test.ts), [`explorer.test.ts`](../../frontend/src/lib/explorer.test.ts), [`megaEtherscan.test.ts`](../../frontend/src/lib/megaEtherscan.test.ts), [`addressFormat.test.ts`](../../frontend/src/lib/addressFormat.test.ts) ([issue #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93), [issue #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)) |

### TimeCurve frontend: sale phase and hero timer

Narrative for [timecurve-views — Single source of truth](../frontend/timecurve-views.md#single-source-of-truth-invariants): the **state badge**, **phase narrative**, and **pre-start window** on Simple, plus **Arena** `phaseFlags`, must not disagree with the **indexer-anchored hero countdown** because `wagmi`’s `latestBlock` timestamp lags. **Unit tests** above cover the pure `ledgerSecIntForPhase` + `derivePhase` helpers; **E2E** does not start Anvil in CI (see [strategy — Stage 1](strategy.md#stage-1--unit-tests)).

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
| [FeeSinks.t.sol](../../contracts/test/FeeSinks.t.sol) | 7 | `FeeSink` withdraw access + zero `to`; `PodiumPool.payPodiumPayout` auth + zero winner + **prizePusher** vs `DISTRIBUTOR_ROLE` ([issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) |
| [TimeCurveWarBowCl8yBurns.t.sol](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) | 3 | Fuzz: WarBow CL8Y burn amounts match constants to burn sink ([issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) |
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
