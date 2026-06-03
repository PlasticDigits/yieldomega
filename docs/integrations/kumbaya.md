# Kumbaya integration (Time Arena v2)

> **Arena v2 (canonical):** [`TimeArenaBuyRouter`](../../contracts/src/arena/TimeArenaBuyRouter.sol) — ETH / USDm / reserve **CL8Y** → Kumbaya **`exactOutput`** → **DOUB** → **`TimeArena.buyFor`** ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)). **DOUB** direct entry uses **`TimeArena.buy`** (no router). Verify: `bash scripts/verify-time-arena-buy-router-anvil.sh` · invariants **`INV-TIME-ARENA-BUY-ROUTER`** · play skill [`skills/play-time-arena-doub/SKILL.md`](../../skills/play-time-arena-doub/SKILL.md).

This document is the **in-repo source of truth** for how Yieldomega uses **Kumbaya** (Uniswap v3–compatible DEX on MegaETH) for **optional** multi-asset Arena entry while settlement remains in **DOUB**. Legacy v1 CL8Y sale routing is retired ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

**Related code:** [`TimeArenaBuyRouter.sol`](../../contracts/src/arena/TimeArenaBuyRouter.sol), [`AnvilKumbayaFixture.sol`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol), [`DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol), [`frontend/src/lib/timeArenaKumbayaSingleTx.ts`](../../frontend/src/lib/timeArenaKumbayaSingleTx.ts), [`frontend/src/lib/kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts), [`scripts/verify-time-arena-buy-router-anvil.sh`](../../scripts/verify-time-arena-buy-router-anvil.sh) (canonical; legacy delegate script **`verify-timecurve-buy-router-anvil.sh`** forwards here).

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

- **`PayWithAsset` / `VITE_KUMBAYA_USDM`:** In code and env we use **`usdm`** as the label for “pay with a **configured stable** token” on the **DOUB ← WETH ← stable** path.
- **MegaETH mainnet:** The stable we pin in defaults is **USDm** (MegaUSD, symbol **USDm** on the default token list) — see `kumbayaRoutes.ts` and the table below.
- **MegaETH testnet:** The default token list does not ship a **USDm** row; **USDM pay mode** requires an explicit **`VITE_KUMBAYA_USDM`** (and verified pool liquidity to WETH and DOUB). Testnet lists **USDC** / **USDT**; use whichever your deployment actually pools — **quotes will fail** if no pool exists for the chosen fee tiers.

---

<a id="arena-v2-buy-router-gitlab-251"></a>

## Time Arena buy router (GitLab [#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251))

| Pay asset | Path | Onchain entry |
|-----------|------|-----------------|
| **DOUB** | wallet → `TimeArena` | `buy(charmWad)` / `buy(charmWad, codeHash)` |
| **CL8Y** | reserve CL8Y → DOUB (single-hop) | `TimeArenaBuyRouter.buyViaKumbaya` **`PAY_CL8Y`** |
| **ETH** | WETH → DOUB | `buyViaKumbaya` **`PAY_ETH`** (`msg.value` → WETH) |
| **USDm** | stable → WETH → DOUB | `buyViaKumbaya` **`PAY_STABLE`** |

**Single-tx router ([issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65), [#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)):** Immutable **`TimeArenaBuyRouter`** (wired by **`TimeArena.setTimeArenaBuyRouter`**) runs **`exactOutput`** into the gross **DOUB** for `charmWad`, then **`TimeArena.buyFor(msg.sender, …)`** so CHARM weight, WarBow, cooldown, and referrals accrue to the participant. **`buyFor`** is **only** callable from the designated router (zero disables). **Refunds:** ETH / stable repay only marginal unused balances after the swap ([#117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117)). **DOUB** dust → **`doubSurplusRecipient`** (AdminSellVault). The router emits **`BuyViaKumbaya`** for indexer ingest when **`TimeArenaBuyRouter`** is in **`ADDRESS_REGISTRY`** ([#67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

**Arena gates:** **`buyViaKumbaya`** reverts when the arena is not started, **`paused`**, or past **`deadline()`** — checked **before** **`exactOutput`** (no wasted swap gas on a closed arena).

**Frontend:** Onchain **`timeArenaBuyRouter`** is authoritative; optional **`VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER`** must **match** when set (**fail closed** — see `resolveTimeArenaBuyRouterForKumbayaSingleTx` in [`kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts)). Zero router → DOUB-only / direct paths for non-DOUB pay are blocked with a routing error.

**Invariants:** gross DOUB = `charmWad × charmPriceWad / 1e18`; **`exactOutput` `amountOut`** equals that gross; stable ingress balance-delta parity ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)); **`swapDeadline`** checked against **`block.timestamp`** before swap ([#83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)). Map: **`INV-TIME-ARENA-BUY-ROUTER`**.

**ERC-20 `approve` sizing ([GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)):** WETH / USDM → swap router and USDM → **`TimeArenaBuyRouter`** use quoted **`maxIn`** — not unlimited allowance. [wallet-connection §143](../frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143) · `INV-ERC20-APPROVAL-143`.

**Submit-time `charmWad` + DOUB amount ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)):** Kumbaya **3%** slippage applies to the **swap input** leg only. **`TimeArena`** enforces **`charmWad` ∈ `currentCharmBoundsWad`** at tx time. The UI re-reads bounds and price before submit ([`readFreshTimeArenaBuySizing`](../../frontend/src/lib/timeArenaBuySubmitSizing.ts)). See [arena-views.md](../frontend/arena-views.md).

**Swap deadline vs `block.timestamp` ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)):** **`swapDeadline`** for **`exactOutput`** and **`buyViaKumbaya`** is **`latest` head `block.timestamp` + 600s** (via [`fetchSwapDeadlineUnixSec`](../../frontend/src/lib/timeArenaKumbayaSwap.ts)), not **`Date.now()`**, so Anvil **time warps** do not make the deadline **before** inclusion-time chain time. Helpers: [`swapDeadlineUnixSecFromChainTimestamp`](../../frontend/src/lib/timeArenaKumbayaSwap.ts). **Test map:** invariants — issue #83.

**Local verify:** `bash scripts/verify-time-arena-buy-router-anvil.sh` (does **not** restart a running Anvil unless RPC is down). Sets `YIELDOMEGA_VERIFY_NO_ANVIL_RESTART=1` to fail instead of starting a new node.

<a id="qa-anvil-time-warp-and-swap-deadline-issue-83"></a>

### QA: Anvil time warp and swap deadline (issue #83)

Some automation **advances chain time** with **`cast rpc anvil_increaseTime`** while the browser wall clock is unchanged. That is useful for **optional** [`anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) post-end drills, but breaks Kumbaya **`Expired()`** when deadlines used wall time only — **Option A** (chain-aligned deadline in the app) is the default fix.

**Where `anvil_increaseTime` is used in this repo**

| Entrypoint | Calls `anvil_increaseTime`? | Notes |
|------------|------------------------------|--------|
| [`contracts/script/anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) | **Yes** — optional legacy simulation / post-end narrative | [anvil-rich-state.md](../testing/anvil-rich-state.md); **not** required for Arena v2 QA ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)). |
| [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) | **Indirectly** when it runs **`anvil_rich_state.sh`** (default unless **`SKIP_ANVIL_RICH_STATE=1`**) | Set **`SKIP_ANVIL_RICH_STATE=1`** for a **live arena** with **unwarped** chain time (Kumbaya / indexer manual runs). |
| **`scripts/e2e-anvil.sh`**, **`scripts/lib/anvil_deploy_dev.sh`**, **`verify-time-arena-buy-router-anvil.sh`** | **No** rich-state warp in the normal path | Canonical Kumbaya router verification without Part2 time jumps. |
| **`ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh`** | **Yes** | Post-end gate setup only — do not chain ahead of in-session **`buyViaKumbaya`** on the same RPC. |

**Ordering (no code path change)**

1. **Fresh Anvil:** stop the node or reset, re-run **`DeployDev`** / **`anvil_deploy_dev.sh`** — chain time returns near wall clock.
2. **Skip rich state:** `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` so **`anvil_rich_state.sh`** never runs.
3. **Evidence before warp:** run **`buyViaKumbaya`** / indexer checks **before** any script that calls **`anvil_increaseTime`** in the same RPC session.

Cross-links: [issue #75](https://gitlab.com/PlasticDigits/yieldomega/-/issues/75) (indexer `entry_pay_asset`), [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) (submit-time sizing).

**Hard limits (honest scope):**

- Routing assumes **v3-style** `exactOutput` / `quoteExactOutput` and **packed paths** built in `kumbayaRoutes.ts`. **UniversalRouter** paths are **not** the same ABI surface as our local Anvil fixture; production uses **SwapRouter02 + QuoterV2** per integrator-kit.
- **SwapRouter ABI (MegaETH):** Kumbaya’s deployed router implements **`IV3SwapRouter`** from `@kumbaya_xyz/swap-router-contracts` — swap calldata **does not** include a `deadline` field inside `exactOutput` / `exactOutputSingle` (unlike legacy Uniswap SwapRouter02). **`TimeArenaBuyRouter`** enforces **`swapDeadline`** before calling the router; single-hop ETH/USDM paths use **`exactOutputSingle`**, multi-hop stable paths use **`exactOutput`**. Wrong struct layout reverts immediately (~200 gas) with a generic `execution reverted`.
- **Pools must exist** for **DOUB/WETH** and (for stable mode) **stable/WETH** at the configured **fee tiers** (`VITE_KUMBAYA_FEE_*` or defaults). Missing pools → failed quotes / swaps — **not** a protocol bug.
- **MegaETH mainnet (4326) fee tiers:** Kumbaya’s live **DOUB/WETH** pool is **0.01% (100)**; **USDm/WETH** is **0.3% (3000)**. Defaults in `kumbayaRoutes.ts` match those tiers. **ETH and USDM** quotes use `quoteExactOutputSingle` hops only — production QuoterV2 `quoteExactOutput(bytes)` reverts (`toAddress_outOfBounds`). Submit paths re-read `currentCharmPriceWad` for gross DOUB and apply a small headroom BPS before quoting `maxIn`.
- **CHARM** is minted only via **`TimeArena.buy`** / **`buyFor`** after DOUB is available to the contract; Kumbaya only supplies **DOUB** to the router.

---

## Invariants (must hold)

| Invariant | Meaning |
|-----------|---------|
| **Fail closed** | Unknown `chainId` or missing router/quoter/WETH → **no** silent fallback; `resolveKumbayaRouting` returns an error and the UI blocks non-DOUB pay when the buy router is unset. |
| **Same arena semantics** | After swap, **`buyFor`** uses the same **`TimeArena`** path as direct DOUB; fee routing and CHARM accounting are unchanged. |
| **Path direction** | `buildV3PathExactOutput` encodes **tokenOut → … → tokenIn** (Uniswap `exactOutput` convention). |
| **Integrator parity** | For MegaETH **4326** / **6343**, router and quoter addresses **match** [integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit) unless overridden by env for a deliberate fork test. |
| **Anvil ≠ prod math** | `AnvilKumbayaRouter` uses **constant-product** math for local testing only — see [local-swap-testing.md](../testing/local-swap-testing.md). |
| **Single-tx gross DOUB** | `TimeArenaBuyRouter` recomputes gross spend from **`currentCharmPriceWad`** × `charmWad` and sets **`exactOutput` amountOut** to that value. |
| **Single-tx availability** | UI uses **`timeArenaBuyRouter` onchain**; optional **`VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER`** must **match** when set. Zero router → no ETH/USDM/CL8Y router path ([#66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)). |
| **Swap deadline** | **`swapDeadline`** on **`buyViaKumbaya`** follows **latest head `block.timestamp` + 600s** (not wall clock); the Kumbaya router swap leg has **no** in-struct deadline ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)). |

---

## Environment runbooks

### Localnet (Anvil)

<a id="localnet-anvil"></a>

1. **Kumbaya fixtures + buy router:** `bash scripts/e2e-anvil.sh` and `scripts/lib/anvil_deploy_dev.sh` run **`DeployDev`** then **`DeployKumbayaAnvilFixtures`**, and export **`VITE_KUMBAYA_*`**. The one-shot stack script **`scripts/start-local-anvil-stack.sh`** runs **`DeployDev`** only by default; set **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** to run **`DeployKumbayaAnvilFixtures`** at stack start, write **`contracts.TimeArenaBuyRouter`** into [`contracts/deployments/local-anvil-registry.json`](../../contracts/deployments/local-anvil-registry.json), and merge the same **`VITE_KUMBAYA_*`** block into **`frontend/.env.local`** as e2e ([#84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)). If you deploy fixtures **later** (e.g. `YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/verify-time-arena-buy-router-anvil.sh`), that script **merges** the buy-router address into the registry so the **indexer** can ingest **`BuyViaKumbaya`** — **restart the indexer** after the merge. Indexer: **missing** `TimeArenaBuyRouter` in the registry → **`BuyViaKumbaya` is not ingested**; do not write the **zero address** as a stand-in ([`indexer/src/config.rs`](../../indexer/src/config.rs)). **Literal line merge ([#154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154)):** [`scripts/lib/kumbaya_env_set_line.py`](../../scripts/lib/kumbaya_env_set_line.py) via [`kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh) — **`INV-KUMBAYA-ENV-154`**.
2. **TimeArenaBuyRouter checklist:** with Anvil on **`RPC_URL`**, arena **live** (`paused == false`, started), run `bash scripts/verify-time-arena-buy-router-anvil.sh`. Use `YIELDOMEGA_DEPLOY_KUMBAYA=1` the first time to broadcast fixtures. See **`INV-TIME-ARENA-BUY-ROUTER`** and [local-swap-testing.md](../testing/local-swap-testing.md).
3. `cast call` the swap router, run Playwright E2E per [e2e-anvil.md](../testing/e2e-anvil.md).
4. **Mocked:** Fixture router is **not** Kumbaya production bytecode.

### Testnet (MegaETH 6343)

1. From integrator-kit **`megaETH-testnet.json`**: set **`VITE_KUMBAYA_WETH`**, **`VITE_KUMBAYA_SWAP_ROUTER`**, **`VITE_KUMBAYA_QUOTER`** (or rely on baked-in defaults in `kumbayaRoutes.ts`).
2. Set **`VITE_KUMBAYA_USDM`** to a **stable that has v3 liquidity** to WETH and a path to **DOUB** (deploy-specific). Confirm fee tiers with on-chain pool config or Kumbaya tooling.
3. Smoke: **quote → swap → `buyViaKumbaya` or DOUB `buy`** on public RPC before enabling USDM mode in a hosted build.

### Mainnet (MegaETH 4326)

1. Confirm **SwapRouter02**, **QuoterV2**, **WETH9** against integrator-kit **`megaETH-mainnet.json`**.
2. Confirm **USDm** (or your chosen stable) against [default-token-list](https://github.com/Kumbaya-xyz/default-token-list) for chain **4326**.
3. Wire **`TimeArenaBuyRouter`** via **`TimeArena.setTimeArenaBuyRouter`**; set **`VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER`** and update **`indexer/address-registry.megaeth-mainnet.json`** (`TimeArenaBuyRouter` + `abiHashesSha256`) before restarting the production indexer.
4. Run **quote → swap → buy** smoke with small notional; monitor slippage and deadline settings in Arena session hooks.

---

<a id="admin-sell-vault-gitlab-249"></a>

## AdminSellVault DOUB → USDM ([GitLab #249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249))

Arena v2 routes **30%** of each DOUB **`buy`** to **`AdminSellVault`**. Governance calls **`sellDoubToUsdm(minOut)`** (`onlyOwner`) to swap the vault balance via a configured **Kumbaya `exactInputSingle`** router into **USDM** for **`adminAccount`**.

| Layer | Reference |
|-------|-----------|
| Onchain | [`AdminSellVault.sol`](../../contracts/src/arena/AdminSellVault.sol) · routing [#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249) / [fee-routing § admin liquidation](../onchain/fee-routing-and-governance.md) |
| Forge | [`AdminSellVault.t.sol`](../../contracts/test/AdminSellVault.t.sol) — mock **`exactInputSingle`** + [`AnvilMockUSDM`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol) (distinct from **`AnvilKumbayaRouter`** `exactOutput` used by **`TimeArenaBuyRouter`**) |
| Invariant | **`INV-ADMIN-SELL-VAULT-249`** · [invariants](../testing/invariants-and-business-logic.md) |

---

## See also

- [Local swap testing (issue #41)](../testing/local-swap-testing.md)
- [E2E Anvil + Playwright](../testing/e2e-anvil.md)
- [Business logic / test map — Kumbaya row](../testing/invariants-and-business-logic.md)
- GitLab [issue #41](https://gitlab.com/PlasticDigits/yieldomega/-/issues/41) (initial routing), [issue #46](https://gitlab.com/PlasticDigits/yieldomega/-/issues/46) (docs + integrator alignment), [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) (single-tx buy router + `buyFor`), [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67) (indexer: `BuyViaKumbaya` + `/v1/arena/buys` enrichment), [issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83) (Kumbaya swap deadline aligned to chain time; QA warp table above), [issue #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117) (audit **M‑02**: net ETH/stable refunds on buy router; invariants §117), [issue #251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251) (TimeArenaBuyRouter), [issue #270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270) (Anvil fixture deploy)
