# Local swap testing (Kumbaya / issue #41)

This note covers **multi-asset TimeCurve entry** (CL8Y, ETH, USDM) using the **Anvil fixture router** deployed next to `DeployDev`, and how **`VITE_KUMBAYA_*`** overrides work for local and testnet builds.

**Canonical integration doc (issue #46):** [integrations/kumbaya.md](../integrations/kumbaya.md) — upstream [integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit), **MegaETH** address parity, runbooks, and invariants.

## What gets deployed

1. **`DeployDev.s.sol`** — core game contracts (TimeCurve, mock CL8Y, etc.).
2. **`DeployKumbayaAnvilFixtures.s.sol`** — `AnvilWETH9`, `AnvilMockUSDM`, `AnvilKumbayaRouter` (combined **swap + quoter**), and **`TimeCurveBuyRouter`** (single-tx ETH/USDM → `exactOutput` → `TimeCurve.buyFor`; [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65)). The fixture router implements Uniswap-style **`exactOutput`** / **`quoteExactOutput`** with **v3 path encoding**; pool math is **constant-product** for local testing only, not production Uniswap v3. Multi-hop **`quoteExactOutput`** walks hops **from the CL8Y (output) end toward the spend token**, matching SwapRouter-style `exactOutput` (fixed alongside issue #65).

`scripts/lib/anvil_deploy_dev.sh` runs both scripts and parses logged addresses. **`start-local-anvil-stack.sh`** (full QA stack) runs **`DeployDev`** only; use **`e2e-anvil.sh`**, this deploy helper, or **`YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/verify-timecurve-buy-router-anvil.sh`** to register **`TimeCurveBuyRouter`** on that chain ([issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78), [kumbaya runbook](../integrations/kumbaya.md#localnet-anvil)).

## Frontend env (build-time)

| Variable | Purpose |
|----------|---------|
| `VITE_KUMBAYA_WETH` | Wrapped native token used in paths |
| `VITE_KUMBAYA_USDM` | USDM (or chain stable) for two-hop quotes |
| `VITE_KUMBAYA_SWAP_ROUTER` | Router `exactOutput` target |
| `VITE_KUMBAYA_QUOTER` | On Anvil this matches the router address; on prod, protocol QuoterV2 |
| `VITE_KUMBAYA_FEE_CL8Y_WETH` | Optional uint24 override (default from `kumbayaRoutes.ts` table) |
| `VITE_KUMBAYA_FEE_USDM_WETH` | Optional uint24 override |

Production / public testnet: add canonical addresses to the static table in `frontend/src/lib/kumbayaRoutes.ts` **or** supply all of the above via your deployment pipeline. Unsupported `chainId` values **fail closed** (no silent pool fallback).

## One-command E2E

From repo root:

```bash
bash scripts/e2e-anvil.sh
```

This exports `VITE_KUMBAYA_*` automatically after the fixture deploy.

## Registry JSON

Example shape for documenting Anvil output (regenerate after deploy): `contracts/deployments/kumbaya-anvil-registry.example.json` in-repo; copy to a non-committed file or CI artifact as needed.

## Testnet checklist

1. Obtain canonical **router**, **quoter**, **WETH**, **USDM**, and **fee tiers** from the Kumbaya protocol team.
2. Update `CHAIN_DEFAULTS` / env for the target `chainId` in `kumbayaRoutes.ts` or your secrets manager.
3. Run a manual **quote → swap → TimeCurve buy** on the target RPC before shipping.

## Related

- [integrations/kumbaya.md](../integrations/kumbaya.md) — testnet/mainnet vs integrator-kit, USDm naming
- [e2e-anvil.md](e2e-anvil.md) — Playwright + Anvil matrix
- GitLab issue #41 — product scope and acceptance criteria
- GitLab issue #46 — documentation and deployment alignment
