## Summary

<!-- What changed, why, and how reviewers should think about risk (user-visible vs internal). -->

## Related issues

<!-- Closes #NNN · Related to #NNN · none -->

## Layers touched

Check every layer this MR modifies (delete unchecked lines):

- [ ] **contracts** (`contracts/`)
- [ ] **indexer** (`indexer/`)
- [ ] **frontend** (`frontend/`)
- [ ] **scripts / devops** (`scripts/`, `.cursor/`, CI)
- [ ] **docs only** (no runtime behavior change)
- [ ] **bots** (`bots/`)

## Verification

For **each touched layer**, add one row: *item → command → PASS / FAIL / SKIP*.

Use the **smallest** check that proves the change — do not require Docker, Postgres, or Vite unless this MR touches those layers. Command reference: [`AGENTS.md` § Cloud agent verification](../../AGENTS.md#cloud-agent-verification-when-to-run-what) · [`docs/testing/ci.md`](../../docs/testing/ci.md).

| Layer | Command | Result |
|-------|---------|--------|
| | | |

**Common commands (copy rows as needed):**

| Layer | Command |
|-------|---------|
| contracts | `cd contracts && forge test` |
| contracts (static) | Slither workflow / local `slither` (high-severity gate) |
| indexer | `cd indexer && cargo clippy --all-targets -- -D warnings && cargo test` |
| indexer + arena | `bash scripts/verify-wallet-profile-anvil.sh` |
| frontend | `cd frontend && npm run typecheck && npm run lint && npm test` |
| Anvil deploy / `KEY_EVM_*` / seed | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh` (**must PASS**, not SKIP) |
| Postgres (Cloud VM) | `bash scripts/verify-cloud-postgres.sh` |
| Docker (full stack only) | `bash scripts/verify-docker-cloud-agent.sh` |
| Playwright Anvil E2E | `bash scripts/e2e-anvil.sh` |
| Doc gates | `bash scripts/check-doc-anchors.sh` (+ retired-term / arena-naming scripts if docs touched) |

## Licensing & compliance

- [ ] New or changed **original** files remain **AGPL-3.0** (or exception is called out below).
- [ ] No incompatible third-party code added without `NOTICE` / maintainer approval.
- [ ] **Network-facing** changes (indexer API, deployed frontend) — Corresponding Source / AGPL obligations considered ([`docs/licensing.md`](../../docs/licensing.md)).

<!-- Licensing exceptions or AGPL notes for reviewers: -->

## Notes for reviewers

<!-- Breaking changes, deploy/migration steps, invariant IDs (INV-*), manual Rabby QA, screenshots. -->

## Author checklist

- [ ] Diff is scoped to the stated problem (no drive-by refactors).
- [ ] Arena v2 guardrails respected when touching product code ([`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md)).
- [ ] Dev keys are **Anvil-only**; no secrets committed ([`scripts/lib/evm_dev_keys.sh`](../../scripts/lib/evm_dev_keys.sh)).
