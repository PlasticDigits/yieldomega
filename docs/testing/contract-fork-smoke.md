# Contract fork smoke (optional MegaETH / public RPC)

**Maintainer policy (issue #6):** Live RPC fork checks are **opt-in** only. Default **push/PR** CI runs `forge test` **without** any fork URL, so [`contracts/test/TimeCurveFork.t.sol`](../../contracts/test/TimeCurveFork.t.sol) **no-ops** (passes immediately). That keeps the default branch **deterministic** and avoids **rate limits**, **RPC outages**, and **nondeterministic** failures.

## What the test does

When `FORK_URL` is a non-empty string, the test calls `vm.createSelectFork(url)` and asserts `block.chainid` and `block.number` are positive — a minimal **connectivity / execution** smoke against the target chain.

## Local runbook

From the repo root (or `contracts/`):

```bash
cd contracts
export FORK_URL="https://carrot.megaeth.com/rpc"   # testnet example; confirm current URL in MegaETH docs
FOUNDRY_PROFILE=ci forge test --match-contract TimeCurveForkTest -vv
```

Named endpoints from [`contracts/foundry.toml`](../../contracts/foundry.toml) (`megaeth`, `megaeth_testnet`) are for **`forge script` / `--fork-url`** ergonomics; this test reads **`FORK_URL` from the environment** only. You can set:

```bash
export FORK_URL="https://carrot.megaeth.com/rpc"
```

or the mainnet RPC label target from `foundry.toml` if you accept that network’s policy and limits.

Do **not** commit RPC URLs with API keys; use a local `.env` (see [`contracts/.env.example`](../../contracts/.env.example)) or CI secrets.

## CI mapping

| Trigger | Fork smoke against live RPC? |
|--------|------------------------------|
| **`unit-tests`** workflow (push/PR) | **No** — `FORK_URL` unset → test no-ops. |
| **`contract-fork-smoke`** workflow | **Yes** — **`workflow_dispatch` only**; supply RPC via workflow input and/or repository secret `FORK_URL`. Fails fast if neither is set. |

**Scheduled runs** are **not** enabled on the default workflow: a maintainer may add `schedule:` to [`.github/workflows/contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml) if they accept RPC dependency and rate-limit risk for that cadence.

## Related

- [Continuous integration](ci.md) — full workflow map.
- [Testing strategy — Stage 1](strategy.md#stage-1--unit-tests) — contracts unit gate.
- [`contracts/README.md` — MegaETH RPC](../../contracts/README.md#megaeth-rpc-testnet-and-mainnet).

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
