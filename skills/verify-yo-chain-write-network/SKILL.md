---
name: verify-yo-chain-write-network
description: Verify GitLab #95 wrong-network write gating — wallet chainId must match VITE_CHAIN_ID (default Anvil 31337) before Buy CHARM / WarBow / referrals register / vesting claim; overlays + switch-network CTA + submit preflight guards.
---

# Verify — chain write network (#95)

Participant / QA checklist for [GitLab #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95): the app must **not** send calldata built from this deployment’s env when MetaMask (or another wallet) is on **another** `chainId`.

## Preconditions

1. Local stack or preview with a known **`VITE_CHAIN_ID`** (`frontend/.env.local` or CI build). Default dev: **31337** (`resolveChainRpcConfig` when unset — see [`frontend/.env.example`](../../frontend/.env.example)).
2. A wallet that can switch to **at least two** chains (e.g. Anvil **31337** and **BNB** or **Ethereum mainnet**).

## Manual steps

1. Connect on the **correct** target chain → **`/timecurve`**: **Buy CHARM** behaves as before (no overlay). Same for **`/timecurve/arena`** buy hub when the sale is active.
2. Switch the wallet extension to a **wrong** chain (still connected to the app):
   - **`/timecurve`**: buy/redemption panel shows a **Wrong network** overlay, **Switch to …** CTA (`data-testid="switch-to-target-chain"`), and **`timecurve-simple-chain-write-gate`**.
   - **`/timecurve/arena`**: buy hub + standings/WarBow gated (`timecurve-arena-buy-chain-write-gate`, `timecurve-arena-standings-chain-write-gate`, `timecurve-arena-warbow-chain-write-gate`).
   - **`/referrals`**: **Register a code** gated (`referrals-register-chain-write-gate`); **Reward parameters** reads stay visible.
   - **`/vesting`**: beneficiary + **Claim DOUB** gated (`presale-vesting-chain-write-gate`).
3. Use **Switch to …** (or the wallet’s native network switcher) → return to **`VITE_CHAIN_ID`** → overlays disappear and writes work again.
4. **Out of scope:** **`/kumbaya`** and **`/sir`** are outbound venue links only (not #95-gated ABI writes from this app).

## Automated / code references

- **`chainMismatchWriteMessage`:** [`frontend/src/lib/chainMismatchWriteGuard.ts`](../../frontend/src/lib/chainMismatchWriteGuard.ts) + tests in [`chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts).
- **UI:** [`ChainMismatchWriteBarrier`](../../frontend/src/components/ChainMismatchWriteBarrier.tsx), [`SwitchToTargetChainButton`](../../frontend/src/components/SwitchToTargetChainButton.tsx).
- **Docs:** [`docs/frontend/wallet-connection.md`](../../docs/frontend/wallet-connection.md#wrong-network-write-gating-issue-95), [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md#wrong-network-write-gating-issue-95), [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95).
