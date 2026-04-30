# Anvil-backed end-to-end (E2E) tests

This document describes **Playwright E2E tests that exercise the frontend against a local [Anvil](https://book.getfoundry.sh/reference/anvil/) node** with contracts deployed via [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol). It complements [strategy.md](strategy.md) and [ci.md](ci.md).

## What this is for

- **Regression of the dapp stack**: static build + `vite preview` + browser hitting **real JSON-RPC** reads (`wagmi` / viem) against contracts you just deployed.
- **Vanilla EVM semantics**: Foundry’s Anvil implements a standard EVM execution model for local development.

## What this is **not** for

Anvil E2E does **not** validate **MegaEVM** execution, **multidimensional gas** (compute vs storage), intrinsic gas floors, or production RPC behavior. Those require **MegaETH testnet** (or mainnet) checks and RPC-native `eth_estimateGas`. See [research/megaeth.md](../research/megaeth.md) and [contracts/README.md](../../contracts/README.md).

Do **not** treat a green Anvil E2E run as proof that transactions will estimate or execute identically on MegaETH.

## Known divergences (document in chain-touching tests)

When adding or editing specs under `frontend/e2e/` that depend on RPC or chain state, keep this list in mind and reference this file or [research/megaeth.md](../research/megaeth.md) in file-level comments so failures on testnet are not misread as pure UI bugs.

| Topic | Anvil / local | MegaETH |
|-------|-----------------|---------|
| **Contract code size** | [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh) starts Anvil with **`--code-size-limit 524288`** (512 KiB = **0x80000**; Anvil’s parser is decimal-only, so hex is rejected) and deploys with **`forge script … --code-size-limit 524288`** via [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh) (Forge’s pre-broadcast simulation enforces EIP-170 separately). A **plain** `anvil` / **`forge script` without the flag** defaults to **EIP-170 0x6000** (~24 KiB) | [Contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits) — 512 KiB runtime, 536 KiB initcode |
| Gas model | Classic EVM-style gas in Foundry | MegaEVM: compute + storage gas, different minima and limits |
| `eth_estimateGas` / simulation | Matches Anvil, not MegaEVM | Use chain RPC for realistic limits |
| Block time | **`e2e-anvil.sh`**: instant / per-tx mining. **`start-local-anvil-stack.sh`** with **`START_BOT_SWARM=1`**: defaults **`anvil --block-time 12`** ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)) so idle chain time advances — [§ Bot swarm + chain time](#bot-swarm-anvil-chain-time-gitlab-99). Plain `anvil` without flags: instant. | Fast blocks; indexer lag / reorg assumptions differ |
| Wallet UX | wagmi **`mock`** connector (when `VITE_E2E_MOCK_WALLET=1`) forwards RPC; not a real browser wallet | WalletConnect, mobile wallets, network add flows |
| Precompiles / fork height | Anvil default | Confirm against MegaETH docs for your target |

**Phase B (wallet writes)** — [`frontend/e2e/anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts): TimeCurve **buy** via the wagmi **`mock`** connector (`VITE_E2E_MOCK_WALLET=1` in [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh)). The **ETH pay** case selects **`data-testid="timecurve-simple-paywith-eth"`** (toggle buttons, not legacy radio inputs — [issue #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)), moves the spend slider, then waits for the **Buy CHARM** button to be enabled again after the Kumbaya quoter settles (UI **Refreshing quote…** gate — [issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56), [timecurve-views — Buy quote refresh](../frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56)). Rabbit Treasury **deposit** is not covered in Playwright while that page is an under-construction placeholder ([`launchplan-timecurve.md`](../../launchplan-timecurve.md)); use `cast` against devnet per the Stage 2 runbook. This is **not** MetaMask or WalletConnect. See [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration).

**Collection** — [`frontend/e2e/anvil-collection.spec.ts`](../../frontend/e2e/anvil-collection.spec.ts) asserts the placeholder **under construction** state during the TimeCurve launch milestone (not NFT reads).

**Referrals `/referrals` (issue #64)** — [`frontend/e2e/anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts): connected mock wallet registers a code, surfaces **Your share links**, and asserts **Copy** → clipboard for path + `?ref=` URLs. Complements CI-only [`referrals-surface.spec.ts`](../../frontend/e2e/referrals-surface.spec.ts). See [invariants — Referrals page visual](../testing/invariants-and-business-logic.md#referrals-page-visual-issue-64).

**Presale vesting `/vesting` (issue #92)** — [`frontend/e2e/anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts): mock wallet (Anvil #0) asserts **`PresaleVestingPage`** beneficiary panel + enabled **Claim DOUB** after `DeployDev`. See [presale-vesting.md](../frontend/presale-vesting.md), [invariants — § #92](../testing/invariants-and-business-logic.md#presale-vesting-frontend-gitlab-92).

## Environment contract (build time)

Vite inlines `VITE_*` at **build** time. For Anvil:

| Variable | Example / notes |
|----------|-----------------|
| `VITE_CHAIN_ID` | `31337` (Anvil default) |
| `VITE_RPC_URL` | `http://127.0.0.1:8545` (or your port) |
| `VITE_TIMECURVE_ADDRESS` | From `forge script` deploy output (required for TimeCurve page reads) |
| `VITE_RABBIT_TREASURY_ADDRESS` | Same |
| `VITE_LEPRECHAUN_NFT_ADDRESS` | Same |
| `VITE_FEE_ROUTER_ADDRESS` | Same — required for **fee sink / FeeRouter** UI (`FeeTransparency`) |
| `VITE_REFERRAL_REGISTRY_ADDRESS` | Same — referral flows that read the registry |
| `VITE_DOUB_PRESALE_VESTING_ADDRESS` | **`DoubPresaleVesting`** ERC-1967 **proxy** — hidden **`/vesting`** route (GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)); set by `DeployDev` log parse in [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) and [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh). |
| `VITE_E2E_MOCK_WALLET` | `1` for Phase B wallet-write tests (wagmi mock connector) |
| `VITE_KUMBAYA_WETH`, `VITE_KUMBAYA_USDM`, `VITE_KUMBAYA_SWAP_ROUTER`, `VITE_KUMBAYA_QUOTER` | Set by `scripts/e2e-anvil.sh` after `DeployKumbayaAnvilFixtures` (issue #41); see [local-swap-testing.md](local-swap-testing.md) and [integrations/kumbaya.md](../integrations/kumbaya.md) (issue #46, MegaETH vs Anvil). |
| `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER` | **Optional** copy of onchain `TimeCurve.timeCurveBuyRouter` (from **TimeCurveBuyRouter** in `DeployKumbayaAnvilFixtures`); set by `e2e-anvil.sh` when the address is parsed. Used only for **env vs onchain parity**; single-tx routing is driven by the onchain read ([issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)). |
| `timeCurveBuyRouter` on Anvil (not `e2e-anvil.sh`) | For a stack that only ran **`DeployDev`**, `timeCurveBuyRouter` is **0** until **`DeployKumbayaAnvilFixtures`**; automated fork verification: **`bash scripts/verify-timecurve-buy-router-anvil.sh`** (issue #78) — [invariants](../testing/invariants-and-business-logic.md#timecurvebuyrouter-anvil-verification-issue-78). |
| **`DeployDev` buy cooldown ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88))** | Default remains **300** s per wallet. For **multi-buy QA** on one wallet (checklists #38 / #39 / #82), set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** before **`forge script … DeployDev`** / **`start-local-anvil-stack.sh`** / **`e2e-anvil.sh`** so the initializer uses **1** s (or set **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** explicitly, **&gt; 0**). Invariants: [§ DeployDev buy cooldown env](../testing/invariants-and-business-logic.md#deploydev-buy-cooldown-env-issue-88); play checklist: [`manual-qa-checklists.md#manual-qa-issue-88`](manual-qa-checklists.md#manual-qa-issue-88). |
| **Bot swarm + Anvil interval mining ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99))** | When [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) **launches** Anvil with **`START_BOT_SWARM=1`**, it adds **`--block-time`** (default **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC=12`**, **`0`** = off). For a **dense** `Buy` feed, also set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** ([§ Buy cooldown](#anvil-deploydev-buy-cooldown-gitlab-88)). Details: [§ Bot swarm + chain time](#bot-swarm-anvil-chain-time-gitlab-99); [`manual-qa-checklists.md#manual-qa-issue-99`](manual-qa-checklists.md#manual-qa-issue-99). |
| **Swarm referrals + standalone `run_swarm` ([GitLab #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102))** | Export **`YIELDOMEGA_SWARM_REFERRALS=0`** before the stack or a manual swarm to skip shared referral bootstrap. **Without** `start-local-anvil-stack.sh`: use **repo-root** `cwd`, **`bash scripts/sync-bot-env-from-frontend.sh`**, **`YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`**, **`PYTHONPATH=bots/timecurve/src`** — full checklist in [`bots/timecurve/README.md`](../../bots/timecurve/README.md). The stack prints whether referrals are on or off when **`START_BOT_SWARM=1`**. See [§ Standalone bot swarm](#standalone-bot-swarm-run_swarm-without-the-full-stack-gitlab-102). |

<a id="anvil-deploydev-buy-cooldown-gitlab-88"></a>

### Anvil `DeployDev` buy cooldown ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88))

**Problem:** default **`buyCooldownSec = 300`** makes consecutive buys from the same wallet impractical for manual QA.

**Flags (process environment, read by [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) via [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol)):**

| Variable | Effect |
|----------|--------|
| *(unset)* | **`buyCooldownSec = 300`** (unchanged production-like dev default). |
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | Defaults **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** to **1** when that var is unset (still **&gt; 0** for `TimeCurve.initialize`). |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** (numeric) | Explicit seconds (**must be &gt; 0**). When **`YIELDOMEGA_DEPLOY_NO_COOLDOWN` ≠ 1**, unset behavior defaults to **300**; when **`= 1`**, unset defaults to **1**. |

**Examples:**

```bash
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/start-local-anvil-stack.sh
YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=2 YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/e2e-anvil.sh
```

**Do not** set **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=0`** — `DeployDev` reverts before broadcast; **`TimeCurve`** also rejects zero cooldown at init.

<a id="bot-swarm-anvil-chain-time-gitlab-99"></a>

### Bot swarm + Anvil chain time ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99))

**Repro (historical defaults):** `SKIP_ANVIL_RICH_STATE=1` enables the Python swarm by default. **`buyCooldownSec = 300`** ([§ Buy cooldown](#anvil-deploydev-buy-cooldown-gitlab-88)) plus **automine-only** Anvil meant **no blocks** mined while **all** swarm wallets **`sleep`** for cooldown ⇒ **`block.timestamp` froze**, so `_wait_until_buy_allowed` / defender timers never saw advancing chain time until an external tx mined a block.

**Shipped mitigations:**

| Mechanism | Details |
|-----------|---------|
| **Interval mining (`--block-time`)** | When [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) **starts** Anvil and **`START_BOT_SWARM=1`**, it passes **`anvil … --block-time <sec>`**. Default **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC=12`**; set to **`0`** to omit the flag (pure automine — not recommended for long swarm demos with default cooldown). Foundry flag: **`anvil -b` / `--block-time`** ([Anvil reference](https://book.getfoundry.sh/reference/anvil/)). |
| **Short cooldown for dense traffic** | Prefer **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or explicit **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** when you want **continuous `Buy` events** over many minutes without long per-wallet spacing — same flags as [§ Buy cooldown](#anvil-deploydev-buy-cooldown-gitlab-88). The stack prints a **note** when **`SKIP_ANVIL_RICH_STATE=1`**, swarm is on, and **neither** cooldown knob is set (default **300** s). |
| **Reusing an existing RPC** | If port **8545** (or **`ANVIL_PORT`**) is already bound, the script **cannot** retro-fit **`--block-time`**; it warns that chain time may freeze between txs. |

**Scope:** **No** change to bot Python on **non-31337** chains or production — issue **C** (`evm_increaseTime` in bots) was **not** implemented.

**Play checklist:** [`manual-qa-checklists.md#manual-qa-issue-99`](manual-qa-checklists.md#manual-qa-issue-99). **Invariants:** [§ #99 — Bot swarm + Anvil timing](invariants-and-business-logic.md#bot-swarm-anvil-interval-mining-issue-99).

<a id="standalone-bot-swarm-run_swarm-without-the-full-stack-gitlab-102"></a>

### Standalone bot swarm — `run_swarm()` without the full stack ([GitLab #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102))

**Checklist:** [`bots/timecurve/README.md`](../../bots/timecurve/README.md) (§ *Run `run_swarm()` without `start-local-anvil-stack.sh`*): **`frontend/.env.local`** → **`sync-bot-env-from-frontend.sh`** → repo-root **`cwd`** → **`YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`** → optional **`YIELDOMEGA_SWARM_REFERRALS=0`** → `python -c "… run_swarm()"` or **`timecurve-bot --allow-anvil-funding swarm`**. On **`load_config`** failure, `run_swarm()` prints a short hint (RPC / TimeCurve / dotenv paths).

**Wrapper:** [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) with **`START_BOT_SWARM=1`** summarizes referral bootstrap **on vs off** and passes through **`YIELDOMEGA_SWARM_REFERRALS`** from the shell.

Set `VITE_INDEXER_URL` to the indexer base URL (e.g. `http://127.0.0.1:3100`). [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) writes this into `frontend/.env.local` when you use the one-shot stack. With `START_BOT_SWARM=1` (default when `SKIP_ANVIL_RICH_STATE=1`), install **`bots/timecurve`** deps first; on **PEP 668** systems see [`bots/timecurve/README.md`](../../bots/timecurve/README.md) (PEP 668 section) — the stack script preflights `import web3` before spawning the swarm. For **continuous buys** over time, set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** (and see [§ Bot swarm + Anvil chain time](#bot-swarm-anvil-chain-time-gitlab-99)).

For **minimal** Anvil Playwright only, `VITE_INDEXER_URL` can be omitted; the automated Anvil specs do **not** assert indexer responses.

**Sanity check:** from repo root, `make check-frontend-env` (or `bash scripts/check-frontend-vite-env.sh`) verifies that merged `frontend/.env` + `frontend/.env.local` contain non-empty `VITE_TIMECURVE_ADDRESS`, `VITE_FEE_ROUTER_ADDRESS`, sibling deploy addresses, `VITE_RPC_URL`, and `VITE_CHAIN_ID`. Restart `npm run dev` after creating or changing `.env.local` so Vite reloads inlined vars.

Deterministic example addresses from a previous deploy (regenerate if deploy order changes): [`contracts/deployments/stage2-anvil-registry.json`](../../contracts/deployments/stage2-anvil-registry.json).

## How to run (one command)

From the repository root (requires Foundry: `anvil`, `forge`, `cast` on `PATH`; [`contracts/README.md`](../../contracts/README.md) dependency installs). The script sets `FOUNDRY_OUT` to `contracts/out-e2e-anvil` so `forge build` can write artifacts even when the default `contracts/out/` directory is not writable.

```bash
bash scripts/e2e-anvil.sh
```

This starts Anvil, deploys with `DeployDev`, builds the frontend with the right `VITE_*` values, sets `ANVIL_E2E=1`, and runs Playwright against the Anvil-backed tests.

### Anvil E2E concurrency ([GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))

<a id="anvil-e2e-concurrency-gitlab-87"></a>

`scripts/e2e-anvil.sh` uses **one** Anvil and **one** JSON-RPC account for the wagmi **mock** connector. The repo’s **`e2e/anvil-*.spec.ts`** files (TimeCurve, referrals, wallet writes) **mutate chain state** (buys, registrations, copy flows). **Playwright’s default multi-worker** schedule can run **different** spec **files** in parallel even when a file uses `test.describe.configure({ mode: "serial" })` — that setting only serializes **within** the file — which risks **nonce ordering**, **sale state**, and **referral** races unrelated to the code under test.

When **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) sets **`workers: 1`** and **`fullyParallel: false`**. The default **CI** Playwright job (`npm run test:e2e` **without** `ANVIL_E2E`) is UI-only and may use **5** workers for speed.

**TimeCurve pay-mode E2E:** The Simple and Arena UIs use **toggle buttons** for CL8Y / ETH / USDM, with stable hooks **`data-testid="timecurve-simple-paywith-{cl8y,eth,usdm}"`**. Anvil wallet-write specs (e.g. [anvil-wallet-writes.spec.ts](../../frontend/e2e/anvil-wallet-writes.spec.ts)) use those test ids — not legacy **`<input name="timecurve-pay-with">`**, which the UI no longer uses.

**Maps:** [invariants — Anvil E2E Playwright](invariants-and-business-logic.md#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87) · play checklist: [`manual-qa-checklists.md#manual-qa-issue-87`](manual-qa-checklists.md#manual-qa-issue-87).

From `frontend/` you can also run:

```bash
npm run test:e2e:anvil
```

## How to run (manual)

1. Start Anvil: `anvil --host 127.0.0.1 --port 8545 --code-size-limit 524288`
2. Deploy: `cd contracts && forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url http://127.0.0.1:8545 --code-size-limit 524288` (optional **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** for short per-wallet buy cooldown — [§ Buy cooldown](#anvil-deploydev-buy-cooldown-gitlab-88))
3. Copy logged addresses into env (or export `VITE_*` in the shell).
4. `cd frontend && npm ci && npm run build` with those variables set.
5. `ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1 npm run test:e2e -- e2e/anvil-*.spec.ts` (or `bash scripts/e2e-anvil.sh`)

## Relationship to CI

The default **`playwright-e2e`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) runs `npm run build && npm run test:e2e` **without** a chain. That job is a **fast UI smoke** (routes, nav).

**Anvil-backed** specs are **skipped** unless `ANVIL_E2E=1` is set, so default PR CI stays green without Foundry + Anvil.

**Optional workflow:** [`.github/workflows/e2e-anvil.yml`](../../.github/workflows/e2e-anvil.yml) — `workflow_dispatch` only; runs `scripts/e2e-anvil.sh` (Foundry + Anvil + Playwright). **Not** a merge blocker; use for release candidates or infra validation.

## Related

- [`scripts/anvil-export-bot-env.sh`](../../scripts/anvil-export-bot-env.sh) — same `DeployDev` deploy as this flow; writes `bots/timecurve/.env.local` for the `timecurve-bot` CLI ([`bots/timecurve/README.md`](../../bots/timecurve/README.md)). For manual QA on the same Anvil stack, add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`** (comma-separated `0x` addresses only) so `timecurve-bot swarm` one-shot funding includes your browser wallet alongside bot keys.
- [Anvil same-block drill](anvil-same-block-drill.md) — ordering tests with `anvil_mine`, not Playwright.
- [operations/stage2-run-log.md](../operations/stage2-run-log.md) — full-stack smoke checklist.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
