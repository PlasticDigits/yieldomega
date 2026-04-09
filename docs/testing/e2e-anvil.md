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
| Gas model | Classic EVM-style gas in Foundry | MegaEVM: compute + storage gas, different minima and limits |
| `eth_estimateGas` / simulation | Matches Anvil, not MegaEVM | Use chain RPC for realistic limits |
| Block time | Manual or instant mining; not ~1s streams | Fast blocks; indexer lag / reorg assumptions differ |
| Wallet UX | wagmi **`mock`** connector (when `VITE_E2E_MOCK_WALLET=1`) forwards RPC; not a real browser wallet | WalletConnect, mobile wallets, network add flows |
| Precompiles / fork height | Anvil default | Confirm against MegaETH docs for your target |

**Phase B (wallet writes)** — [`frontend/e2e/anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts): TimeCurve **buy** via the wagmi **`mock`** connector (`VITE_E2E_MOCK_WALLET=1` in [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh)). Rabbit Treasury **deposit** is not covered in Playwright while that page is an under-construction placeholder ([`launchplan-timecurve.md`](../../launchplan-timecurve.md)); use `cast` against devnet per the Stage 2 runbook. This is **not** MetaMask or WalletConnect. See [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration).

**Collection** — [`frontend/e2e/anvil-collection.spec.ts`](../../frontend/e2e/anvil-collection.spec.ts) asserts the placeholder **under construction** state during the TimeCurve launch milestone (not NFT reads).

## Environment contract (build time)

Vite inlines `VITE_*` at **build** time. For Anvil:

| Variable | Example |
|----------|---------|
| `VITE_CHAIN_ID` | `31337` (Anvil default) |
| `VITE_RPC_URL` | `http://127.0.0.1:8545` (or your port) |
| `VITE_TIMECURVE_ADDRESS` | From `forge script` deploy output |
| `VITE_RABBIT_TREASURY_ADDRESS` | Same |
| `VITE_LEPRECHAUN_NFT_ADDRESS` | Same |
| `VITE_E2E_MOCK_WALLET` | `1` for Phase B wallet-write tests (wagmi mock connector) |

Optional: `VITE_INDEXER_URL` — set only if you want to manually verify indexer-backed panels (e.g. recent mints on Collection); the automated Anvil Playwright specs do **not** assert indexer responses.

Deterministic example addresses from a previous deploy (regenerate if deploy order changes): [`contracts/deployments/stage2-anvil-registry.json`](../../contracts/deployments/stage2-anvil-registry.json).

## How to run (one command)

From the repository root (requires Foundry: `anvil`, `forge`, `cast` on `PATH`; [`contracts/README.md`](../../contracts/README.md) dependency installs). The script sets `FOUNDRY_OUT` to `contracts/out-e2e-anvil` so `forge build` can write artifacts even when the default `contracts/out/` directory is not writable.

```bash
bash scripts/e2e-anvil.sh
```

This starts Anvil, deploys with `DeployDev`, builds the frontend with the right `VITE_*` values, sets `ANVIL_E2E=1`, and runs Playwright against the Anvil-backed tests.

From `frontend/` you can also run:

```bash
npm run test:e2e:anvil
```

## How to run (manual)

1. Start Anvil: `anvil --host 127.0.0.1 --port 8545`
2. Deploy: `cd contracts && forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url http://127.0.0.1:8545`
3. Copy logged addresses into env (or export `VITE_*` in the shell).
4. `cd frontend && npm ci && npm run build` with those variables set.
5. `ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1 npm run test:e2e -- e2e/anvil-*.spec.ts` (or `bash scripts/e2e-anvil.sh`)

## Relationship to CI

The default **`playwright-e2e`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) runs `npm run build && npm run test:e2e` **without** a chain. That job is a **fast UI smoke** (routes, nav).

**Anvil-backed** specs are **skipped** unless `ANVIL_E2E=1` is set, so default PR CI stays green without Foundry + Anvil.

**Optional workflow:** [`.github/workflows/e2e-anvil.yml`](../../.github/workflows/e2e-anvil.yml) — `workflow_dispatch` only; runs `scripts/e2e-anvil.sh` (Foundry + Anvil + Playwright). **Not** a merge blocker; use for release candidates or infra validation.

## Related

- [`scripts/anvil-export-bot-env.sh`](../../scripts/anvil-export-bot-env.sh) — same `DeployDev` deploy as this flow; writes `bots/timecurve/.env.local` for the `timecurve-bot` CLI ([`bots/timecurve/README.md`](../../bots/timecurve/README.md)).
- [Anvil same-block drill](anvil-same-block-drill.md) — ordering tests with `anvil_mine`, not Playwright.
- [operations/stage2-run-log.md](../operations/stage2-run-log.md) — full-stack smoke checklist.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
