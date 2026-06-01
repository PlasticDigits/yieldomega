# Anvil-backed end-to-end (E2E) tests

This document describes **Playwright E2E tests that exercise the frontend against a local [Anvil](https://book.getfoundry.sh/reference/anvil/) node** with contracts deployed via [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol). It complements [strategy.md](strategy.md) and [ci.md](ci.md).

<a id="forge-dev-scripts-chain-allowlist-gitlab-141"></a>

**`forge script` chain guard ([GitLab #141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141)):** `DeployDev` and related dev scripts in [`contracts/script/`](../../contracts/script/) revert unless the RPC’s chain id is **31337** (this E2E path), **6343**, or **6342** — see [`DevOnlyChainGuard.sol`](../../contracts/script/DevOnlyChainGuard.sol) and [foundry-and-megaeth.md § dev-only scripts](../contracts/foundry-and-megaeth.md#dev-only-forge-script-entrypoints-chain-allowlist-gitlab-141). Pointing the same `forge script` at MegaETH **mainnet (4326)** fails fast by design.

**Full-stack manual QA** (Postgres + indexer + **`npm run dev`**, no Playwright): [`qa-local-full-stack.md`](qa-local-full-stack.md) and [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) ([GitLab #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104); orchestrator **`--help`** — [GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105); **Vite cleanup / traps** — [GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)).

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
| **Contract code size / local gas** | [`e2e-anvil.sh`](../../scripts/e2e-anvil.sh) starts Anvil with **`--code-size-limit 524288`** (512 KiB = **0x80000**; Anvil’s parser is decimal-only, so hex is rejected) and deploys with **`forge script … --code-size-limit 524288`** via [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh) (Forge’s pre-broadcast simulation enforces EIP-170 separately). [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) additionally starts Anvil with **`--gas-limit ${YIELDOMEGA_ANVIL_GAS_LIMIT:-60000000}`** so the full `DeployDev` broadcast fits on current Foundry builds. A **plain** `anvil` / **`forge script` without the flag** defaults to **EIP-170 0x6000** (~24 KiB) and **30M** local block gas. | [Contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits) — 512 KiB runtime, 536 KiB initcode |
| Gas model | Classic EVM-style gas in Foundry | MegaEVM: compute + storage gas, different minima and limits |
| `eth_estimateGas` / simulation | Matches Anvil, not MegaEVM | Use chain RPC for realistic limits |
| Block time | **`e2e-anvil.sh`**: instant / per-tx mining. **`start-local-anvil-stack.sh`** with **`START_BOT_SWARM=1`**: defaults **`anvil --block-time 12`** ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)) so idle chain time advances — [§ Bot swarm + chain time](#bot-swarm-anvil-chain-time-gitlab-99). Plain `anvil` without flags: instant. | Fast blocks; indexer lag / reorg assumptions differ |
| Wallet UX | wagmi **`mock`** connector (when `VITE_E2E_MOCK_WALLET=1`) forwards RPC; not a real browser wallet | WalletConnect, mobile wallets, network add flows |
| Precompiles / fork height | Anvil default | Confirm against MegaETH docs for your target |

**Phase B (wallet writes)** — [`frontend/e2e/anvil-arena-wallet-writes.spec.ts`](../../frontend/e2e/anvil-arena-wallet-writes.spec.ts): **`/arena`** DOUB **buy** via the wagmi **`mock`** connector (`VITE_E2E_MOCK_WALLET=1` in [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh)). The **ETH pay** case selects **`data-testid="arena-paywith-eth"`** when `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` (or legacy `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`) is set after Kumbaya + **`TimeArenaBuyRouter`** deploy ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). This is **not** MetaMask or WalletConnect. See [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration).

**Collection** — [`frontend/e2e/anvil-collection.spec.ts`](../../frontend/e2e/anvil-collection.spec.ts) asserts placeholder **under construction** routes (not NFT reads).

**Referrals `/referrals` (issue #64)** — [`frontend/e2e/anvil-referrals.spec.ts`](../../frontend/e2e/anvil-referrals.spec.ts): mock wallet registers a code and asserts share-link copy UX. See [`referrals.md`](../product/referrals.md) and [manual QA — #64](manual-qa-checklists.md#manual-qa-issue-64).

## Environment contract (build time)

Vite inlines `VITE_*` at **build** time. For Anvil:

| Variable | Example / notes |
|----------|-----------------|
| `VITE_CHAIN_ID` | `31337` (Anvil default) |
| `VITE_RPC_URL` | `http://127.0.0.1:8545` (or your port) |
| `VITE_TIME_ARENA_ADDRESS` | **`TimeArena`** proxy from `DeployDev` (required for **`/arena`**) |
| `VITE_PODIUM_VAULTS_ADDRESS` | Podium vaults proxy |
| `VITE_ADMIN_SELL_VAULT_ADDRESS` | Admin sell vault proxy |
| `VITE_TIMECURVE_ADDRESS` | **Legacy alias** — `e2e-anvil.sh` sets this to the same proxy as **`VITE_TIME_ARENA_ADDRESS`** for reads still keyed on the old env name |
| `VITE_REFERRAL_REGISTRY_ADDRESS` | Referral registry proxy |
| `VITE_DOUB_PRESALE_VESTING_ADDRESS` | Optional **`DoubPresaleVesting`** proxy when deployed; no **`/vesting`** route ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)) |
| `VITE_E2E_MOCK_WALLET` | `1` for Phase B wallet-write tests (wagmi mock connector) |
| `VITE_KUMBAYA_WETH`, `VITE_KUMBAYA_USDM`, `VITE_KUMBAYA_SWAP_ROUTER`, `VITE_KUMBAYA_QUOTER` | Optional — set when Kumbaya fixtures run ([#41](https://gitlab.com/PlasticDigits/yieldomega/-/issues/41)) |
| `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | ETH pay-mode E2E; must match onchain `timeArenaBuyRouter` ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). **`e2e-anvil.sh` defaults `YIELDOMEGA_DEPLOY_KUMBAYA=1`** ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)); set `YIELDOMEGA_DEPLOY_KUMBAYA=0` to skip fixtures (ETH test skipped). Also sets legacy `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`. |
| **`DeployDev` buy cooldown ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88))** | Default **300** s on **`TimeArena`**. For multi-buy QA: **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** (**&gt; 0**). See [§ Buy cooldown](#anvil-deploydev-buy-cooldown-gitlab-88) and [`manual-qa-checklists.md#manual-qa-issue-88`](manual-qa-checklists.md#manual-qa-issue-88). |
| **Bot swarm + interval mining ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99))** | **`start-local-anvil-stack.sh`** may pass **`anvil --block-time`** when **`START_BOT_SWARM=1`**. Pair with short cooldown for dense **`TimeArena`** buys. [§ Bot swarm](#bot-swarm-anvil-chain-time-gitlab-99). |
| **Standalone `run_swarm` ([GitLab #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102))** | [`bots/timearena/README.md`](../../bots/timearena/README.md) — sync env from `frontend/.env.local`, **`YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`**, optional **`YIELDOMEGA_SWARM_REFERRALS=0`**. |

<a id="anvil-deploydev-buy-cooldown-gitlab-88"></a>

### Anvil `DeployDev` buy cooldown ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88))

**Problem:** default **`buyCooldownSec = 300`** makes consecutive buys from the same wallet impractical for manual QA.

**Flags (process environment, read by [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) via [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol)):**

| Variable | Effect |
|----------|--------|
| *(unset)* | **`buyCooldownSec = 300`** (unchanged production-like dev default). |
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | Defaults **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** to **1** when unset (still **&gt; 0** for **`TimeArena`** init). |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** (numeric) | Explicit seconds (**must be &gt; 0**). When **`YIELDOMEGA_DEPLOY_NO_COOLDOWN` ≠ 1**, unset behavior defaults to **300**; when **`= 1`**, unset defaults to **1**. |

**Examples:**

```bash
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/start-local-anvil-stack.sh
YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=2 YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/e2e-anvil.sh
```

**Do not** set **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=0`** — `DeployDev` and **`TimeArena`** reject zero cooldown.

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

**Play checklist:** [`manual-qa-checklists.md#manual-qa-issue-99`](manual-qa-checklists.md#manual-qa-issue-99).

<a id="standalone-bot-swarm-run_swarm-without-the-full-stack-gitlab-102"></a>

### Standalone bot swarm — `run_swarm()` without the full stack ([GitLab #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102))

**Checklist:** [`bots/timearena/README.md`](../../bots/timearena/README.md): **`frontend/.env.local`** → **`sync-bot-env-from-frontend.sh`** → repo-root **`cwd`** → **`YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`** → optional **`YIELDOMEGA_SWARM_REFERRALS=0`** → swarm entrypoint documented in the bot README.

**Wrapper:** [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) with **`START_BOT_SWARM=1`** summarizes referral bootstrap **on vs off** and passes through **`YIELDOMEGA_SWARM_REFERRALS`** from the shell.

Set `VITE_INDEXER_URL` to the indexer base URL (e.g. `http://127.0.0.1:3100`). [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) writes this into `frontend/.env.local` when you use the one-shot stack. With `START_BOT_SWARM=1` (default when `SKIP_ANVIL_RICH_STATE=1`), install **`bots/timearena`** deps per [`bots/timearena/README.md`](../../bots/timearena/README.md) (PEP 668 section). For **continuous buys**, set **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** ([§ Bot swarm](#bot-swarm-anvil-chain-time-gitlab-99)).

For **minimal** Anvil Playwright only, `VITE_INDEXER_URL` can be omitted; the automated Anvil specs do **not** assert indexer responses.

**Sanity check:** `make check-frontend-env` (or `bash scripts/check-frontend-vite-env.sh`) verifies Arena v2 addresses (`VITE_TIME_ARENA_ADDRESS`, vaults, admin vault, referral registry), legacy `VITE_TIMECURVE_ADDRESS` alias, `VITE_RPC_URL`, and `VITE_CHAIN_ID`. Restart `npm run dev` after changing `.env.local`.

Deterministic example addresses from a previous deploy (regenerate if deploy order changes): [`contracts/deployments/stage2-anvil-registry.json`](../../contracts/deployments/stage2-anvil-registry.json).

## How to run (one command)

From the repository root (requires Foundry: `anvil`, `forge`, `cast` on `PATH`; [`contracts/README.md`](../../contracts/README.md) dependency installs). The script sets `FOUNDRY_OUT` to `contracts/out-e2e-anvil` so `forge build` can write artifacts even when the default `contracts/out/` directory is not writable.

```bash
bash scripts/e2e-anvil.sh
```

This starts Anvil, deploys with `DeployDev`, builds the frontend with the right `VITE_*` values, sets `ANVIL_E2E=1`, and runs Playwright against the Anvil-backed tests.

### Anvil E2E concurrency ([GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))

<a id="anvil-e2e-concurrency-gitlab-87"></a>

`scripts/e2e-anvil.sh` uses **one** Anvil and **one** mock wallet. **`e2e/anvil-*.spec.ts`** files **mutate chain state** (arena buys, referrals, vesting). **Playwright multi-worker** can run different spec **files** in parallel and cause nonce / state races.

When **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) sets **`workers: 1`** and **`fullyParallel: false`**. The default **CI** Playwright job (`npm run test:e2e` **without** `ANVIL_E2E`) is UI-only and may use **5** workers for speed.

**Arena pay-mode E2E:** The buy panel on **`/arena`** uses **toggle buttons** for CL8Y / ETH / USDM, with stable hooks **`data-testid="arena-paywith-{cl8y,eth,usdm}"`**. Anvil wallet-write specs ([anvil-arena-wallet-writes.spec.ts](../../frontend/e2e/anvil-arena-wallet-writes.spec.ts)) use those test ids.

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

- [`scripts/anvil-export-bot-env.sh`](../../scripts/anvil-export-bot-env.sh) — writes bot env from the same `DeployDev` deploy ([`bots/timearena/README.md`](../../bots/timearena/README.md)).
- [Anvil same-block drill](anvil-same-block-drill.md) — ordering tests with `anvil_mine`, not Playwright.
- [operations/stage2-run-log.md](../operations/stage2-run-log.md) — full-stack smoke checklist.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
