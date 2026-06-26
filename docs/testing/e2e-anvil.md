# Anvil-backed end-to-end (E2E) tests

This document describes **Playwright E2E tests that exercise the frontend against a local [Anvil](https://book.getfoundry.sh/reference/anvil/) node** with contracts deployed via [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol). It complements [strategy.md](strategy.md) and [ci.md](ci.md).

<a id="forge-dev-scripts-chain-allowlist-gitlab-141"></a>

**`forge script` chain guard ([GitLab #141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141)):** `DeployDev` and related dev scripts in [`contracts/script/`](../../contracts/script/) revert unless the RPC’s chain id is **31337** (this E2E path), **6343**, or **6342** — see [`DevOnlyChainGuard.sol`](../../contracts/script/DevOnlyChainGuard.sol) and [foundry-and-megaeth.md § dev-only scripts](../contracts/foundry-and-megaeth.md#dev-only-forge-script-entrypoints-chain-allowlist-gitlab-141). Pointing the same `forge script` at MegaETH **mainnet (4326)** fails fast by design.

**Full-stack manual QA** (Postgres + indexer + **`npm run dev`**, no Playwright): [`qa-local-full-stack.md`](qa-local-full-stack.md) and [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) ([GitLab #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104); orchestrator **`--help`** — [GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105); **Vite cleanup / traps** — [GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)).

## What this is for

- **Regression of the dapp stack**: static build + `vite preview` + browser hitting **real JSON-RPC** reads (`wagmi` / viem) against contracts you just deployed.
- **Vanilla EVM semantics**: Foundry’s Anvil implements a standard EVM execution model for local development.

<a id="indexer-first-vs-minimal-e2e-gitlab-301"></a>

### Indexer-first vs minimal E2E ([GitLab #301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301), [#322](https://gitlab.com/PlasticDigits/yieldomega/-/issues/322))

| Mode | Indexer | Arena display | Command |
|------|---------|---------------|---------|
| **Minimal** (default) | Omitted (`VITE_INDEXER_URL` empty) | Degraded banner; podiums/timers/sale head empty — **no** hidden browser RPC polling | `bash scripts/e2e-anvil.sh` |
| **Indexer-first E2E** | Spawned by script; URL inlined at build | Live podiums + timer epoch from `GET /v1/arena/*` | `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` |
| **Full stack (manual QA)** | Running + URL in `frontend/.env.local` | Same as production display path | `bash scripts/start-qa-local-full-stack.sh` · `bash scripts/verify-podium-live-anvil.sh` |

**Default Playwright specs** (`scripts/e2e-anvil.sh`): `e2e/anvil-arena-*.spec.ts` and **`e2e/anvil-referrals.spec.ts`** ([#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)). With **`YIELDOMEGA_E2E_INDEXER=1`**, also runs **`e2e/anvil-indexer-first.spec.ts`** (indexer status bar + protocol podiums + timer epoch).

Production requires **`VITE_INDEXER_URL`**. Minimal E2E documents the degraded path; indexer-first E2E is optional and needs Postgres (native `:5433` or Docker `yieldomega-pg`). Policy: [arena-views §301](../frontend/arena-views.md#indexer-first-display-gitlab-301) · CI split: [ci.md §322](ci.md#gitlab-github-ci-split-gitlab-322).

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

**Phase B (wallet writes)** — [`frontend/e2e/anvil-arena-03-wallet-writes.spec.ts`](../../frontend/e2e/anvil-arena-03-wallet-writes.spec.ts): **`/arena`** DOUB **buy** via the wagmi **`mock`** connector (`VITE_E2E_MOCK_WALLET=1` in [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh)). Post-buy effect toasts ([#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337)) assert `arena-buy-effect-toast`. The **ETH pay** case selects **`data-testid="arena-paywith-eth"`** when `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` (or legacy `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`) is set after Kumbaya + **`TimeArenaBuyRouter`** deploy ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)); currently **`test.fixme`** — onchain path is covered by **`VerifyTimeArenaBuyRouterAnvil.t.sol`** ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)). This is **not** MetaMask or WalletConnect. See [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration).

**#331 play-feel visual UX ([GitLab #340](https://gitlab.com/PlasticDigits/yieldomega/-/issues/340))** — [`frontend/e2e/anvil-arena-05-play-feel.spec.ts`](../../frontend/e2e/anvil-arena-05-play-feel.spec.ts): XP hero prominence, carousel navigation, next-tier level locks ([#334](https://gitlab.com/PlasticDigits/yieldomega/-/issues/334)), WarBow on play, L1-no-celebration sad path ([#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)), first-visit WYWA omission ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338) sad). With **`YIELDOMEGA_E2E_INDEXER=1`**: WYWA modal after buy + reload, wallet profile level history ([#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336)). Run: `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/anvil-arena-*.spec.ts` after `bash scripts/e2e-anvil.sh` (or indexer-first: `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh`).

**Transition E2E ([GitLab #350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350))** — [`frontend/e2e/anvil-arena-06-transitions.spec.ts`](../../frontend/e2e/anvil-arena-06-transitions.spec.ts): indexer-first podium timer expiry → **`rollPodiumEpoch`** → **`epoch-advanced`** UX + epoch increment; leaderboard refresh after roll; Last Buy hard reset → claim-ready **`arena-charm-cred-claim`**. Parent gap [#342](https://gitlab.com/PlasticDigits/yieldomega/-/issues/342) P2 #10. Invariant **`INV-FRONTEND-342-TRANSITION-E2E`**. Requires **`YIELDOMEGA_E2E_INDEXER=1`** (picked up by `e2e/anvil-arena-*.spec.ts` glob). Spec only: `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/anvil-arena-06-transitions.spec.ts` after `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` (or full suite: `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh`).

**Wrong-network / Rabby (required for full PASS):** The mock connector cannot change `chainId`. For [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) and issue paths such as [#277](https://gitlab.com/PlasticDigits/yieldomega/-/issues/277) **#7**, use Rabby — [`rabby-cloud-agent-qa.md`](rabby-cloud-agent-qa.md) · `bash scripts/verify-rabby-chain-mismatch.sh` · [`.cursor/skills/rabby-cloud-verification/SKILL.md`](../../.cursor/skills/rabby-cloud-verification/SKILL.md).

**Collection** — removed; placeholder routes are covered by [`frontend/e2e/surface-shells.spec.ts`](../../frontend/e2e/surface-shells.spec.ts) (non-Anvil UI smoke).

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
| `VITE_REFERRAL_REGISTRY_ADDRESS` | Referral registry proxy |
| `VITE_E2E_MOCK_WALLET` | `1` for Phase B wallet-write tests (wagmi mock connector). **`npm run build` refuses this flag** unless `ANVIL_E2E=1` ([GitLab #327](https://gitlab.com/PlasticDigits/yieldomega/-/issues/327)); `vite dev` is unaffected. |
| `VITE_KUMBAYA_WETH`, `VITE_KUMBAYA_USDM`, `VITE_KUMBAYA_SWAP_ROUTER`, `VITE_KUMBAYA_QUOTER` | Optional — set when Kumbaya fixtures run ([#41](https://gitlab.com/PlasticDigits/yieldomega/-/issues/41)) |
| `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | ETH pay-mode E2E; must match onchain `timeArenaBuyRouter` ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). **`e2e-anvil.sh` defaults `YIELDOMEGA_DEPLOY_KUMBAYA=1`** ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)); set `YIELDOMEGA_DEPLOY_KUMBAYA=0` to skip fixtures (ETH test skipped). Also sets legacy `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`. |
| **`DeployDev` buy energy ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88), [#332](https://gitlab.com/PlasticDigits/yieldomega/-/issues/332))** | Defaults: **300** s charge interval, **5** base max charges (effective cap adds `level - 1`), **15** s burst gap on **`TimeArena`**. For dense QA: **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or **`YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC`**, **`YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC`**, **`YIELDOMEGA_ANVIL_MAX_BUY_CHARGES`**. Compatibility: **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** sets the charge interval. See [§ Buy energy](#anvil-deploydev-buy-cooldown-gitlab-88). |
| **Bot swarm + interval mining ([GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99))** | **`start-local-anvil-stack.sh`** may pass **`anvil --block-time`** when **`START_BOT_SWARM=1`**. Pair with short cooldown for dense **`TimeArena`** buys. [§ Bot swarm](#bot-swarm-anvil-chain-time-gitlab-99). |
| **Standalone `run_swarm` ([GitLab #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102))** | [`bots/timearena/README.md`](../../bots/timearena/README.md) — sync env from `frontend/.env.local`, **`YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`**, optional **`YIELDOMEGA_SWARM_REFERRALS=0`**. |

<a id="anvil-deploydev-buy-cooldown-gitlab-88"></a>

### Anvil `DeployDev` buy energy ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88), [#332](https://gitlab.com/PlasticDigits/yieldomega/-/issues/332))

**Problem:** production-like **`buyChargeIntervalSec = 300`** plus **`burstBuyCooldownSec = 15`** can slow dense same-wallet manual QA.

**Flags (process environment, read by [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) via [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol)):**

| Variable | Effect |
|----------|--------|
| *(unset)* | **`buyChargeIntervalSec = 300`**, base **`maxBuyCharges = 5`**, **`burstBuyCooldownSec = 15`**. |
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | Defaults charge interval and burst gap to **1** when their explicit vars are unset (still **&gt; 0** for **`TimeArena`** init). |
| **`YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC`** | Explicit charge refill interval seconds (**must be &gt; 0**). |
| **`YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC`** | Explicit burst gap seconds (**must be &gt; 0**). |
| **`YIELDOMEGA_ANVIL_MAX_BUY_CHARGES`** | Explicit stored charge cap (**must be &gt; 0**). |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** | Compatibility alias for **`YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC`**. |

**Examples:**

```bash
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/start-local-anvil-stack.sh
YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC=2 YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC=1 YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/e2e-anvil.sh
```

**Do not** set pacing values to **0** — `DeployDev` and **`TimeArena`** reject zero interval, zero cap, and zero burst gap.

Focused gate: `bash scripts/verify-buy-energy-anvil.sh`.

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

**Sanity check:** `make check-frontend-env` (or `bash scripts/check-frontend-vite-env.sh`) verifies Arena v2 addresses (`VITE_TIME_ARENA_ADDRESS`, vaults, admin vault, referral registry), `VITE_RPC_URL`, and `VITE_CHAIN_ID` ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) — no `VITE_TIMECURVE_ADDRESS`). Restart `npm run dev` after changing `.env.local`.

Deterministic example addresses from a previous deploy (regenerate if deploy order changes): [`contracts/deployments/stage2-anvil-registry.json`](../../contracts/deployments/stage2-anvil-registry.json).

## How to run (one command)

From the repository root (requires Foundry: `anvil`, `forge`, `cast` on `PATH`; [`contracts/README.md`](../../contracts/README.md) dependency installs). The script sets `FOUNDRY_OUT` to `contracts/out-e2e-anvil` so `forge build` can write artifacts even when the default `contracts/out/` directory is not writable.

```bash
bash scripts/e2e-anvil.sh
```

Default Playwright specs: `e2e/anvil-arena-*.spec.ts` and `e2e/anvil-referrals.spec.ts` ([#322](https://gitlab.com/PlasticDigits/yieldomega/-/issues/322)).

**Indexer-first mode** (Postgres + indexer + `VITE_INDEXER_URL` at build time):

```bash
YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh
```

Runs the default suite plus [`anvil-indexer-first.spec.ts`](../../frontend/e2e/anvil-indexer-first.spec.ts) (live indexer status + protocol podiums + timer epoch). Requires host Postgres ([`bootstrap-cloud-postgres-native.sh`](../../scripts/bootstrap-cloud-postgres-native.sh) on Cloud VMs) or Docker `yieldomega-pg`. Override indexer port with `INDEXER_PORT` (default **3100**).

This starts Anvil, deploys with `DeployDev`, builds the frontend with the right `VITE_*` values, sets `ANVIL_E2E=1`, and runs Playwright against the Anvil-backed tests.

<a id="anvil-dev-wallet-seed-gitlab-281"></a>

### Anvil dev-wallet seed ([GitLab #281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281))

After **`DeployDev`**, [`scripts/seed-evm-dev-wallets-anvil.sh`](../../scripts/seed-evm-dev-wallets-anvil.sh) (via [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh) when **`YIELDOMEGA_SEED_EVM_DEV_WALLETS=1`**, default) funds **`KEY_EVM_1..3`** / **`ADDR_EVM_1..3`** with native ETH + DOUB + Play CRED (+ mock CL8Y).

| Topic | Behavior |
|-------|----------|
| **Minter key** | **`DEPLOYER_PK`** → **`PRIVATE_KEY`** → Anvil account #0 default — **same order as [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol)**. **Not** **`KEY_EVM_1`** (recipient addresses only). |
| **Extra minter** | When seed minter address ≠ deploy broadcaster, deploy sets **`YIELDOMEGA_SEED_MINTER_ADDRESS`** and **`DeployDev`** grants **`MINTER_ROLE`** on DOUB + PlayCred (dev chains only). |
| **Idempotent** | Skips ERC-20 mint when balance already ≥ target; safe to run seed twice or re-deploy on the same Anvil. |
| **Guards** | Loopback RPC only; chain id **31337** / **6342** / **6343**; never logs private keys. |
| **Disable seed** | **`YIELDOMEGA_SEED_EVM_DEV_WALLETS=0`** — Playwright mock wallet E2E still passes. |

**Verify (Foundry only, no Docker):**

```bash
bash scripts/verify-evm-dev-wallet-seed-anvil.sh
```

**Troubleshooting — `AccessControlUnauthorizedAccount` / `MINTER_ROLE missing`:**

1. Align **`PRIVATE_KEY`** (DeployDev broadcaster) with the key used to seed — or set explicit **`DEPLOYER_PK`** to an address that received **`MINTER_ROLE`**.
2. If **`KEY_EVM_1..3`** are Cloud secrets **different** from the deploy key, re-run deploy via **`anvil_deploy_dev.sh`** (it auto-sets **`YIELDOMEGA_SEED_MINTER_ADDRESS`** when needed) or export **`DEPLOYER_PK`** matching **`PRIVATE_KEY`**.
3. Confirm **`DOUB`** / **`CRED`** env vars match the **latest** DeployDev log (stale addresses after re-deploy).
4. Seed refuses non-loopback RPC — intentional (**local dev only**).

Invariants: **`INV-DEPLOY-281-DEV-WALLET-SEED`**, **`INV-DEPLOY-281-EXTRA-MINTER`** — [invariants §259](invariants-and-business-logic.md#arena-v2-deploy-gitlab-259).

<a id="anvil-deploy-dev-caller-scope-gitlab-289"></a>

### DeployDev caller scope ([GitLab #289](https://gitlab.com/PlasticDigits/yieldomega/-/issues/289))

**`yieldomega_anvil_deploy_dev`** ([`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh)) runs DeployDev (+ optional Kumbaya + dev-wallet seed) but does **not** set **`TA`**, **`DOUB`**, **`CRED`**, or Kumbaya vars in the caller shell. After deploy, callers that need addresses must call:

```bash
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"
# When YIELDOMEGA_DEPLOY_KUMBAYA=1:
yieldomega_export_kumbaya_addrs_from_log "${DEPLOY_LOG}"
```

Do **not** rely on caller-scope **`DOUB`** / **`TA`** surviving a second deploy without re-exporting from that deploy’s log (or saving addresses before the second call).

| Check | Command |
|-------|---------|
| Hermetic export API | `bash scripts/test-anvil-deploy-caller-scope.sh` |
| Double deploy + seed | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh` |

Invariants: **`INV-DEPLOY-289-NO-CALLER-LEAK`**, **`INV-DEPLOY-289-EXPORT-API`** — [invariants §289](invariants-and-business-logic.md#anvil-deploy-dev-caller-scope-gitlab-289).

### Anvil E2E concurrency ([GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87))

<a id="anvil-e2e-concurrency-gitlab-87"></a>

`scripts/e2e-anvil.sh` uses **one** Anvil and **one** mock wallet. **`e2e/anvil-*.spec.ts`** files **mutate chain state** (arena buys, referrals, vesting). **Playwright multi-worker** can run different spec **files** in parallel and cause nonce / state races.

When **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) sets **`workers: 1`** and **`fullyParallel: false`**. The default **CI** Playwright job (`npm run test:e2e` **without** `ANVIL_E2E`) is UI-only and may use **5** workers for speed.

**Arena pay-mode E2E:** The buy panel on **`/arena`** uses **toggle buttons** for DOUB (`data-testid="arena-paywith-cl8y"` for legacy hook stability), ETH, USDM, and CRED when Play CRED is configured. Stable hooks: **`data-testid="arena-paywith-{cl8y,eth,usdm,cred}"`**. Anvil wallet-write specs ([anvil-arena-03-wallet-writes.spec.ts](../../frontend/e2e/anvil-arena-03-wallet-writes.spec.ts), [anvil-arena-04-cred-buy.spec.ts](../../frontend/e2e/anvil-arena-04-cred-buy.spec.ts)) use those test ids.

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
5. `ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1 npm run test:e2e -- e2e/anvil-arena-*.spec.ts e2e/anvil-referrals.spec.ts` (or `bash scripts/e2e-anvil.sh`)

## Relationship to CI

The default **`playwright-e2e`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) runs `npm run build && npm run test:e2e` **without** a chain. That job is a **fast UI smoke** (routes, nav).

**Anvil-backed** specs are **skipped** unless `ANVIL_E2E=1` is set, so default PR CI stays green without Foundry + Anvil.

<a id="production-mock-wallet-build-gate-gitlab-327"></a>

### Production mock-wallet build gate ([GitLab #327](https://gitlab.com/PlasticDigits/yieldomega/-/issues/327))

`frontend/vite.config.ts` aborts **`vite build`** / **`npm run build`** when `VITE_E2E_MOCK_WALLET=1` would be inlined, with a clear error — unless **`ANVIL_E2E=1`** (set by [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) before its production build). **`vite dev`** and the Anvil dev auto-mock path (`useAnvilDevMockWallet` without `VITE_E2E_MOCK_WALLET`) are unchanged.

| Check | Command |
|-------|---------|
| Gate (expect fail) | `cd frontend && VITE_E2E_MOCK_WALLET=1 npm run build` |
| Deploy script guard | `bash scripts/check-frontend-vite-env.sh --production` |
| Rabby / CDN build | `bash scripts/qa/build-frontend-for-rabby.sh` (no mock in `dist`) |
| CI regression | `unit-tests` → **`frontend-test`** job — mock-wallet build step |

**Optional workflow:** [`.github/workflows/e2e-anvil.yml`](../../.github/workflows/e2e-anvil.yml) — `workflow_dispatch` only; runs `scripts/e2e-anvil.sh` (Foundry + Anvil + Playwright). **Not** a merge blocker; use for release candidates or infra validation.

<a id="anvil-e2e-trap-and-mock-cl8y-extract-gitlab-279"></a>

### Troubleshooting — EXIT trap and MockReserveCl8y seed ([GitLab #279](https://gitlab.com/PlasticDigits/yieldomega/-/issues/279))

| Symptom | Cause | Fix |
|---------|--------|-----|
| Script exits abruptly **before Playwright** (no Playwright summary) | EXIT trap used `kill "${PREVIEW_PID:-0}"` / `kill "${ANVIL_PID:-0}"` — **`kill 0`** signals the whole process group when PIDs are unset | Fixed in `scripts/e2e-anvil.sh`: guarded cleanup via `_yieldomega_kill_pid_if_set` ([`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh)) |
| **`CL8Y` empty** after DeployDev with mock reserve | Legacy log line `MockReserveCl8y deployed (dev only):` did not match the `Label:` extractor; some Foundry builds split the address onto the next line | `DeployDev.s.sol` logs **`MockReserveCl8y:`**; [`_yieldomega_resolve_mock_cl8y_addr`](../../scripts/lib/anvil_deploy_dev.sh) falls back to `contracts/broadcast/DeployDev.s.sol/31337/run-latest.json` |
| Seed step fails silently | `set -e` + trap ran before stderr flushed | `yieldomega_anvil_deploy_dev` checks `seed-evm-dev-wallets-anvil.sh` exit code and prints **`CL8Y=`** context |
| Seed **`AccessControlUnauthorizedAccount`** on Cloud Agent | Cursor **`KEY_EVM_*`** secrets override Anvil account #0–#2 | `e2e-anvil.sh` **`unset`s** `KEY_EVM_*` before deploy so seed targets default Anvil addresses |

**Hermetic regressions (no Anvil):** `bash scripts/verify-e2e-anvil-trap.sh` · `bash scripts/test-anvil-deploy-cl8y-extract.sh` · `bash scripts/test-anvil-deploy-caller-scope.sh` (CI **`scripts-smoke`**).

**Invariant map:** [`INV-ANVIL-E2E-279-TRAP`](invariants-and-business-logic.md#anvil-e2e-trap-and-mock-cl8y-gitlab-279) · [`INV-ANVIL-E2E-279-CL8Y-EXTRACT`](invariants-and-business-logic.md#anvil-e2e-trap-and-mock-cl8y-gitlab-279).

<a id="verify-anvil-script-helpers-gitlab-324"></a>

### Indexer-backed verify script helpers ([GitLab #324](https://gitlab.com/PlasticDigits/yieldomega/-/issues/324))

Indexer smoke scripts (`verify-podium-live-anvil.sh`, `verify-wallet-profile-anvil.sh`, `verify-indexer-reorg-anvil.sh`, …) share bootstrap via:

| Script | Issue | Focus |
|--------|-------|--------|
| `verify-indexer-reorg-anvil.sh` | [#351](https://gitlab.com/PlasticDigits/yieldomega/-/issues/351) | Live reorg: `find_common_ancestor` + rollback + re-ingest; level history vs on-chain level |

| Module | Role |
|--------|------|
| [`verify_anvil_common.sh`](../../scripts/lib/verify_anvil_common.sh) | Port-scoped `pkill`, Anvil spawn/wait, `anvil_send`, cooldown warp, guarded PID cleanup |
| [`verify_indexer_stack.sh`](../../scripts/lib/verify_indexer_stack.sh) | DeployDev export, local registry JSON, Postgres app DB reset, indexer spawn, `/v1/status` wait |

Callers set **`VERIFY_SCRIPT_PREFIX`** so log lines keep script-specific prefixes for MR checklists. **`yieldomega_verify_boot_indexer_stack`** composes the full Anvil → deploy → PG → indexer path; scripts add scenario-specific buys/assertions afterward.

**Not in CI** (local/manual only — rejected [#309](https://gitlab.com/PlasticDigits/yieldomega/-/issues/309)). Hermetic lib smoke: `bash scripts/test-verify-anvil-lib.sh`. Legacy v1 **`verify-timecurve-post-end-gates-anvil.sh`** removed (Arena v2 incompatible).

## Related

- [`scripts/anvil-export-bot-env.sh`](../../scripts/anvil-export-bot-env.sh) — writes bot env from the same `DeployDev` deploy ([`bots/timearena/README.md`](../../bots/timearena/README.md)).
- [Anvil same-block drill](anvil-same-block-drill.md) — ordering tests with `anvil_mine`, not Playwright.
- [operations/stage2-run-log.md](../operations/stage2-run-log.md) — full-stack smoke checklist.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
