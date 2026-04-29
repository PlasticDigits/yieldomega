---
name: verify-yo-presale-vesting
description: QA `/vesting` (DoubPresaleVesting) for agents — hidden route, env proxy address, 30%/180-day reads, dual timezone clock, claim CTA vs claimsEnabled — GitLab #92.
---

# Verify — presale vesting (`/vesting`)

Use when validating **DOUB presale vesting UX** after deploy or when helping a participant confirm **proxy** env and **onchain** schedule reads.

## Preconditions

- `VITE_DOUB_PRESALE_VESTING_ADDRESS` points at the **ERC-1967 proxy** (not an implementation row from `run-latest.json` — [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).
- RPC + chain id match the deployment (`VITE_RPC_URL`, `VITE_CHAIN_ID`).
- For **Anvil + DeployDev**: run [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) or [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) so the vesting line is in the environment.

## Checklist

1. **Hidden nav:** Open the home page — **`/vesting`** is **not** a primary nav item; navigation via **URL only** (issue #92 comment).
2. **Direct URL:** `…/vesting` loads without redirect; heading **Presale vesting** is visible.
3. **Contract block:** Vesting proxy address and **DOUB `token()`** render as read-only hex.
4. **Schedule:** Copy mentions **30%** at start + **70%** linear; **linear duration** matches `vestingDuration()` (seconds, with days hint).
5. **Dual clock:** After `startVesting`, **start** and **end** timestamps show **Local** and **UTC** lines.
6. **Wallet:** Connect a beneficiary wallet — **Your allocation**, **Claimed to date**, **Claimable now** match `cast call` / explorer reads.
7. **Claims gate:** If `claimsEnabled` is `false`, **Claim** is disabled and/or messaging references operational signoff ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)).
8. **Claim path:** When `claimsEnabled` and `claimable > 0`, **Claim DOUB** submits `claim()` and balances update after confirmation.

## Evidence pointers

- Contributor: [docs/frontend/presale-vesting.md](../../docs/frontend/presale-vesting.md), [invariants — § GitLab #92](../../docs/testing/invariants-and-business-logic.md#presale-vesting-frontend-gitlab-92).
- Automated (Anvil): [`frontend/e2e/anvil-presale-vesting.spec.ts`](../../frontend/e2e/anvil-presale-vesting.spec.ts) via `bash scripts/e2e-anvil.sh`.

## Related

- [`DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol)
- [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) — logs **`DoubPresaleVesting:`** for local QA
