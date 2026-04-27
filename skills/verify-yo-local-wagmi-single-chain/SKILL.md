---
name: verify-yo-local-wagmi-single-chain
description: Verify local Anvil browsing does not trigger stray Ethereum mainnet JSON-RPC (GitLab issue #81). Use when validating wagmi chain config after frontend or env changes on the local stack.
---

# Verify local wagmi stays single-chain (issue #81)

**Related:** [GitLab #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81), [`docs/frontend/wallet-connection.md`](../../docs/frontend/wallet-connection.md), [invariants — single-chain wagmi](../../docs/testing/invariants-and-business-logic.md#frontend-single-chain-wagmi-issue-81).

## Why

The dapp declares **one** wagmi chain ([`configuredChain()`](../../frontend/src/lib/chain.ts)). Extra chains (e.g. Ethereum mainnet) caused viem default transports to probe public RPCs such as **`https://eth.merkle.io`**, producing CORS noise and unnecessary third-party requests during local QA.

## Checklist

1. **Stack:** From repo root, `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` (or your usual Anvil + indexer path). Confirm `frontend/.env.local` has **`VITE_CHAIN_ID=31337`** and **`VITE_RPC_URL`** pointing at local Anvil if the script wrote it.
2. **Frontend:** `cd frontend && npm run dev`, open `http://127.0.0.1:5173/timecurve/arena` (or `/timecurve`).
3. **Wallet:** Connect an account on chain **31337** (e.g. Anvil account #0 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`).
4. **Network tab:** Filter by **`merkle`** or **`eth.merkle`** → expect **no** requests (or **0** failed preflights to that host).
5. **Console:** Expect **no** repeated CORS errors referencing **`eth.merkle.io`** on page load.

## Defaults (no `.env`)

If **`VITE_CHAIN_ID`** / **`VITE_RPC_URL`** are unset, the build defaults to **Anvil `31337`** and **`http://127.0.0.1:8545`** — same mental model as local stack scripts.
