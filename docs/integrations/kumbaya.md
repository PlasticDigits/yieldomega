# Kumbaya integration (TimeCurve entry)

This document is the **in-repo source of truth** for how Yieldomega uses **Kumbaya** (Uniswap v3–compatible DEX on MegaETH) for **optional** TimeCurve entry with **ETH** or a **chain stable** while the sale still settles in **CL8Y**. It satisfies [GitLab issue #46](https://gitlab.com/PlasticDigits/yieldomega/-/issues/46) cross-linking and deployment expectations.

**Related code:** [`frontend/src/lib/kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts), [`frontend/src/pages/timecurve/useTimeCurveSaleSession.ts`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts), [`contracts/script/DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol), [`contracts/src/TimeCurveBuyRouter.sol`](../../contracts/src/TimeCurveBuyRouter.sol), [`scripts/lib/anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh), [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs) / [`indexer/src/persist.rs`](../../indexer/src/persist.rs) (`BuyViaKumbaya` + [`ADDRESS_REGISTRY` `TimeCurveBuyRouter`](../../indexer/src/config.rs) — [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

**Contributor guardrails:** When changing routing or env contracts, follow [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) and [testing strategy](../testing/strategy.md).

---

## Upstream references (canonical addresses and ABIs)

| Resource | Role |
|----------|------|
| [Kumbaya-xyz/integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit) | **Authoritative** deployed **SwapRouter02**, **QuoterV2**, **WETH9**, factory, and `poolInitCodeHash` for MegaETH **mainnet (4326)** and **testnet (6343)** — see `addresses/megaETH-mainnet.json` and `addresses/megaETH-testnet.json`. |
| [Kumbaya-xyz/default-token-list](https://github.com/Kumbaya-xyz/default-token-list) | Curated **token addresses** (e.g. **USDm** on mainnet). Use for the **stable** leg when it is not part of the integrator `contracts` map. |
| NPM packages (`@kumbaya_xyz/*`) | Listed in the integrator-kit README — SDKs and contract packages for routing and pool math. |

**Drift control:** Static defaults in `kumbayaRoutes.ts` for public chain IDs are copied from integrator-kit **at the time of the last doc update**; before production deploys, **re-diff** against the current `addresses/*.json` on `main` of the integrator-kit repo. Any mismatch should be a deliberate PR, not silent drift.

---

## Naming: “USDM” in this repo vs Kumbaya tokens

- **`PayWithAsset` / `VITE_KUMBAYA_USDM`:** In code and env we use **`usdm`** as the label for “pay with a **configured stable** token” on the **CL8Y ← WETH ← stable** path.
- **MegaETH mainnet:** The stable we pin in defaults is **USDm** (MegaUSD, symbol **USDm** on the default token list) — see `kumbayaRoutes.ts` and the table below.
- **MegaETH testnet:** The default token list does not ship a **USDm** row; **USDM pay mode** requires an explicit **`VITE_KUMBAYA_USDM`** (and verified pool liquidity to WETH and CL8Y). Testnet lists **USDC** / **USDT**; use whichever your deployment actually pools — **quotes will fail** if no pool exists for the chosen fee tiers.

---

## Product flow (ETH / stable → CHARM)

1. User chooses spend asset in TimeCurve UI (**CL8Y**, **ETH**, or **USDM** mode).
2. **CL8Y:** Direct `approve` + `TimeCurve.buy` — no DEX.
3. **ETH / USDM:** Frontend resolves **Kumbaya router + quoter + path** → **`exactOutput`** swap into **CL8Y** (amount = gross spend for the chosen CHARM) → `approve` **CL8Y** → `TimeCurve.buy` (same onchain buy as direct CL8Y).

<a id="issue-65-single-tx-router"></a>

### Optional: single-transaction protocol entry ([issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65))

The **`TimeCurveBuyRouter`** companion contract (immutable; wired by `TimeCurve.setTimeCurveBuyRouter`) performs **`exactOutput`** into **exactly** the TimeCurve gross CL8Y for `charmWad`, then calls **`TimeCurve.buyFor(msg.sender, charmWad, codeHash, plantWarBowFlag)`** so CHARM weight, WarBow, cooldown, and referrals accrue to the participant while CL8Y is pulled from the router. **`plantWarBowFlag`** is the same opt-in as direct **`buy`** ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). **`buyFor`** is **only** callable by the designated router address (zero disables). Pay modes: **`PAY_ETH`** (`msg.value` → WETH, path must end in WETH) and **`PAY_STABLE`** (`stableToken` pull + path must end in that token). The UI may keep the two-step flow; the router is for integrators and wallets that want **one signature**. The router emits **`BuyViaKumbaya(buyer, charmWad, grossCl8y, payKind)`** after `buyFor` for observability; the indexer stores it when the router address is listed in **`ADDRESS_REGISTRY`** (see [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

**Hard limits (honest scope):**

- Routing assumes **v3-style** `exactOutput` / `quoteExactOutput` and **packed paths** built in `kumbayaRoutes.ts`. **UniversalRouter** paths are **not** the same ABI surface as our local Anvil fixture; production uses **SwapRouter02 + QuoterV2** per integrator-kit.
- **Pools must exist** for **CL8Y/WETH** and (for stable mode) **stable/WETH** at the configured **fee tiers** (`VITE_KUMBAYA_FEE_*` or defaults). Missing pools → failed quotes / swaps — **not** a protocol bug.
- **CHARM** is minted only via **`TimeCurve.buy`** after CL8Y is available to the contract; Kumbaya only supplies **CL8Y** to the user’s wallet.

---

## Invariants (must hold)

| Invariant | Meaning |
|-----------|---------|
| **Fail closed** | Unknown `chainId` or missing router/quoter/WETH → **no** silent fallback; `resolveKumbayaRouting` returns an error and the UI blocks non-CL8Y pay. |
| **Same sale semantics** | After swap, **`buy`** uses the same **`TimeCurve`** path as Arena / direct CL8Y; gross fee routing and CHARM accounting are unchanged. |
| **Path direction** | `buildV3PathExactOutput` encodes **tokenOut → … → tokenIn** (Uniswap `exactOutput` convention). |
| **Integrator parity** | For MegaETH **4326** / **6343**, router and quoter addresses **match** [integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit) unless overridden by env for a deliberate fork test. |
| **Anvil ≠ prod math** | `AnvilKumbayaRouter` uses **constant-product** math for local testing only — see [local-swap-testing.md](../testing/local-swap-testing.md). |
| **Single-tx gross CL8Y** | `TimeCurveBuyRouter` recomputes gross spend from **`currentPricePerCharmWad`** × `charmWad` (same as `TimeCurve`) and sets **`exactOutput` amountOut** to that value so the swap cannot under-fill the subsequent `buyFor`. |

---

## Environment runbooks

### Localnet (Anvil)

1. Run **`scripts/start-local-anvil-stack.sh`** or **`bash scripts/e2e-anvil.sh`** — deploys **`DeployKumbayaAnvilFixtures`** after `DeployDev` and exports **`VITE_KUMBAYA_*`** (see [`anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh)).
2. Verify: `cast call` router, run Playwright E2E per [e2e-anvil.md](../testing/e2e-anvil.md).
3. **Mocked:** Fixture router is **not** Kumbaya production bytecode.

### Testnet (MegaETH 6343)

1. From integrator-kit **`megaETH-testnet.json`**: set **`VITE_KUMBAYA_WETH`**, **`VITE_KUMBAYA_SWAP_ROUTER`**, **`VITE_KUMBAYA_QUOTER`** (or rely on baked-in defaults in `kumbayaRoutes.ts`).
2. Set **`VITE_KUMBAYA_USDM`** to a **stable that has v3 liquidity** to WETH and a path to **CL8Y** (deploy-specific). Confirm fee tiers with on-chain pool config or Kumbaya tooling.
3. Smoke: **quote → swap → buy** on public RPC before enabling USDM mode in a hosted build.

### Mainnet (MegaETH 4326)

1. Confirm **SwapRouter02**, **QuoterV2**, **WETH9** against integrator-kit **`megaETH-mainnet.json`**.
2. Confirm **USDm** (or your chosen stable) against [default-token-list](https://github.com/Kumbaya-xyz/default-token-list) for chain **4326**.
3. Verify **CL8Y** accepted-asset address from your **TimeCurve** deployment matches **`VITE_*`** / wallet reads.
4. Run the same **quote → swap → buy** smoke with small notional; monitor slippage and deadline settings in `useTimeCurveSaleSession.ts`.

---

## See also

- [Local swap testing (issue #41)](../testing/local-swap-testing.md)
- [E2E Anvil + Playwright](../testing/e2e-anvil.md)
- [Business logic / test map — Kumbaya row](../testing/invariants-and-business-logic.md)
- GitLab [issue #41](https://gitlab.com/PlasticDigits/yieldomega/-/issues/41) (initial routing), [issue #46](https://gitlab.com/PlasticDigits/yieldomega/-/issues/46) (docs + integrator alignment), [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) (`TimeCurveBuyRouter` + `buyFor`), [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67) (indexer: `BuyViaKumbaya` + `/v1/timecurve/buys` enrichment)
