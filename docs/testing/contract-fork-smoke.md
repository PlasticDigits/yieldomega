# Contract fork smoke (optional MegaETH / public RPC)

**Maintainer policy (issue #6):** Live RPC fork checks are **opt-in** only. Default **push/PR** CI runs `forge test` **without** any fork URL. [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) (`TimeArenaForkTest`, [GitLab #275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275)) **no-ops** when `FORK_URL` is unset. This keeps the default branch **deterministic** and avoids **rate limits**, **RPC outages**, and **nondeterministic** failures.

## What the test does

| Test | When it runs |
|------|----------------|
| `test_fork_smoke_chainIdAndBlock` | `FORK_URL` non-empty → `vm.createSelectFork(url)`; asserts `block.chainid` and `block.number` > 0 |
| `test_fork_smoke_timeArenaHeadState` | Same fork + non-zero `TIME_ARENA_FORK_ADDRESS` with bytecode → reads `paused()` and `deadline()` on `TimeArena` |

Skips (early return, still green) when `FORK_URL` is unset, `TIME_ARENA_FORK_ADDRESS` is unset/zero, or the address has no code (mainnet registry placeholder until [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259) deploy).

## Local runbook

From the repo root:

```bash
bash scripts/verify-contract-fork-smoke.sh
```

The script always runs the **no-op** path (`FORK_URL` unset). Export `FORK_URL` first to also exercise live RPC connectivity in the same run.

Manual equivalent from `contracts/`:

```bash
cd contracts
export FORK_URL="https://carrot.megaeth.com/rpc"   # testnet example; confirm current URL in MegaETH docs
FOUNDRY_PROFILE=ci forge test --match-contract TimeArenaForkTest -vv
```

Named endpoints from [`contracts/foundry.toml`](../../contracts/foundry.toml) (`megaeth`, `megaeth_testnet`) are for **`forge script` / `--fork-url`** ergonomics; fork smoke tests read **`FORK_URL` from the environment** only. You can set:

```bash
export FORK_URL="https://carrot.megaeth.com/rpc"
```

or the mainnet RPC label target from `foundry.toml` if you accept that network’s policy and limits.

Do **not** commit RPC URLs with API keys; use a local `.env` (see [`contracts/.env.example`](../../contracts/.env.example)) or CI secrets.

## CI mapping

| Trigger | Fork smoke against live RPC? |
|--------|------------------------------|
| **`unit-tests`** workflow (push/PR) | **No** — `FORK_URL` unset → fork smoke tests no-op. |
| **`contract-fork-smoke`** workflow | **Yes** — **`workflow_dispatch` only**; supply RPC via workflow input and/or repository secret `FORK_URL`. Fails fast if neither is set. |

**Scheduled runs** are **not** enabled on the default workflow: a maintainer may add `schedule:` to [`.github/workflows/contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml) if they accept RPC dependency and rate-limit risk for that cadence.

## Related

- **`INV-CONTRACTS-275-FORK-SMOKE`** — [invariants — Contract fork smoke](invariants-and-business-logic.md#contract-fork-smoke-optional-gitlab-275)
- [Continuous integration](ci.md) — full workflow map.
- [Testing strategy — Stage 1](strategy.md#stage-1--unit-tests) — contracts unit gate.
- [`contracts/README.md` — MegaETH RPC](../../contracts/README.md#megaeth-rpc-testnet-and-mainnet).

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)
