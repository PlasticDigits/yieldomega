# Kumbaya integration (Time Arena v2 + legacy TimeCurve)

> **Arena v2 (canonical):** [`TimeArenaBuyRouter`](../../contracts/src/arena/TimeArenaBuyRouter.sol) — ETH / USDm / reserve **CL8Y** → Kumbaya **`exactOutput`** → **DOUB** → **`TimeArena.buyFor`** ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)). **DOUB** direct entry uses **`TimeArena.buy`** (no router). Verify: `bash scripts/verify-time-arena-buy-router-anvil.sh` · invariants **`INV-TIME-ARENA-BUY-ROUTER`** · play skill [`skills/play-time-arena-doub/SKILL.md`](../../skills/play-time-arena-doub/SKILL.md).

This document is the **in-repo source of truth** for how Yieldomega uses **Kumbaya** (Uniswap v3–compatible DEX on MegaETH) for **optional** multi-asset Arena entry while settlement remains in **DOUB**. Legacy **TimeCurve / CL8Y** sections below are retained for audit cross-links only ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

**Related code (Arena v2):** [`TimeArenaBuyRouter.sol`](../../contracts/src/arena/TimeArenaBuyRouter.sol), [`AnvilKumbayaFixture.sol`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol), [`DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol), [`frontend/src/lib/timeArenaKumbayaSingleTx.ts`](../../frontend/src/lib/timeArenaKumbayaSingleTx.ts), [`scripts/verify-time-arena-buy-router-anvil.sh`](../../scripts/verify-time-arena-buy-router-anvil.sh) (replaces `verify-timecurve-buy-router-anvil.sh`).

**Related code (legacy TimeCurve):** [`frontend/src/lib/kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts), [`scripts/lib/kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh), [`scripts/verify-timecurve-buy-router-anvil.sh`](../../scripts/verify-timecurve-buy-router-anvil.sh) (deprecated wrapper → arena script).

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

<a id="arena-v2-buy-router-gitlab-251"></a>

### Time Arena buy router (GitLab [#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251))

| Pay asset | Path | Onchain entry |
|-----------|------|-----------------|
| **DOUB** | wallet → `TimeArena` | `buy(charmWad)` / `buy(charmWad, codeHash)` |
| **CL8Y** | reserve CL8Y → DOUB (single-hop) | `TimeArenaBuyRouter.buyViaKumbaya` **`PAY_CL8Y`** |
| **ETH** | WETH → DOUB | `buyViaKumbaya` **`PAY_ETH`** (`msg.value` → WETH) |
| **USDm** | stable → WETH → DOUB | `buyViaKumbaya` **`PAY_STABLE`** |

**Invariants:** gross DOUB = `charmWad × charmPriceWad / 1e18`; **`exactOutput` `amountOut`** equals that gross; stable ingress balance-delta parity ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)); **`swapDeadline`** checked against **`block.timestamp`** before swap ([#83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)); DOUB dust → **`doubSurplusRecipient`** (AdminSellVault). **`buyFor`** only from registered router.

**Local verify:** `bash scripts/verify-time-arena-buy-router-anvil.sh` (does **not** restart a running Anvil unless RPC is down). Sets `YIELDOMEGA_VERIFY_NO_ANVIL_RESTART=1` to fail instead of starting a new node.

---

## Legacy TimeCurve product flow (ETH / stable → CHARM)

1. User chooses spend asset in TimeCurve UI (**CL8Y**, **ETH**, or **USDM** mode).
2. **CL8Y:** Direct `approve` + `TimeCurve.buy` — no DEX.
3. **ETH / USDM:** Frontend resolves **Kumbaya router + quoter + path** → **`exactOutput`** swap into **CL8Y** (amount = gross spend for the chosen CHARM) → `approve` **CL8Y** → `TimeCurve.buy` (same onchain buy as direct CL8Y).

<a id="issue-65-single-tx-router"></a>

### Optional: single-transaction protocol entry ([issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65))

The **`TimeCurveBuyRouter`** companion contract (immutable; wired by `TimeCurve.setTimeCurveBuyRouter`) performs **`exactOutput`** into **exactly** the TimeCurve gross CL8Y for `charmWad`, then calls **`TimeCurve.buyFor(msg.sender, charmWad, codeHash, plantWarBowFlag)`** so CHARM weight, WarBow, cooldown, and referrals accrue to the participant while CL8Y is pulled from the router. **`plantWarBowFlag`** is the same opt-in as direct **`buy`** ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). **`buyFor`** is **only** callable by the designated router address (zero disables). Pay modes: **`PAY_ETH`** (`msg.value` → WETH, path must end in WETH) and **`PAY_STABLE`** (`stableToken` pull + path must end in that token). **Refunds:** **ETH / stable** repay only the marginal unused balances (**post‑swap `balanceOf(this)` − snapshot before user funding**) so stranded donor deposits cannot subsidize callers ([GitLab #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117), audit M‑02 remediation). **CL8Y** dust after **`buyFor`** still routes exclusively to **`cl8yProtocolTreasury`** ([issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)). **Governance:** **`Ownable2Step`** **`owner`** may **`rescueETH`** / **`rescueERC20`** for dormant custody (multisig expectations mirror **TimeCurve** admin). **`DeployKumbayaAnvilFixtures`** sets **`initialOwner`** = **`deployer`** alongside treasury on local fixtures. The router emits **`BuyViaKumbaya(buyer, charmWad, grossCl8y, payKind)`** after `buyFor` for observability; the indexer stores it when the router address is listed in **`ADDRESS_REGISTRY`** (see [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)). **Invariant map:** `invariants §117`.

**Scheduled sale start ([issue #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)) — fail-fast live window ([issue #118](https://gitlab.com/PlasticDigits/yieldomega/-/issues/118)):** After **`startSaleAt(epoch)`**, **`buyViaKumbaya`** must enforce **`block.timestamp >= saleStart()`** **before** **`exactOutput`** (same **`TimeCurve`** live-window predicate family as **`buy`** / **`buyFor`**). Until live, it reverts **`TimeCurveBuyRouter__BadSalePhase`** so integrators avoid wasted swap gas (audit **L-01** in [`audits/audit_smartcontract_1777813071.md`](../../audits/audit_smartcontract_1777813071.md)). Spec ↔ tests: `invariants — INV-BUYROUTER-118`.

**Simple + Arena (issue #66):** when **`TimeCurve.timeCurveBuyRouter()`** is non-zero, the frontend issues **`buyViaKumbaya`** (same packed path + quoter slippage as the two-step flow) for **ETH** and **USDM** pay modes — **one onchain `buy` equivalent** in a single user transaction (USDM may still add a prior **`approve`** to the buy router if allowance is short). If the router is **zero**, the UI keeps the legacy **Kumbaya `exactOutput` → wallet CL8Y → `TimeCurve.buy`** path. **CL8Y** direct `buy` is unchanged. **Fail closed:** missing Kumbaya chain config, wrong path, or **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER` ≠ onchain** (when the env is set) surfaces as a **routing error** for non-CL8Y pay, not a silent fallback — see `resolveTimeCurveBuyRouterForKumbayaSingleTx` in [`kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts) and [`useArenaSaleSession.ts`](../../frontend/src/pages/arena/useArenaSaleSession.ts).

**ERC-20 `approve` sizing ([GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)):** **WETH** / **USDM → `swapRouter`** (two-step) and **USDM → `TimeCurveBuyRouter`** (single-tx, when a separate `approve` is needed) use the quoted **`maxIn`** for that leg — not unlimited allowance. **CL8Y → `TimeCurve`** defaults to **exact** gross per tx with an optional UI opt-in for unlimited — [wallet-connection §143](../frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143) · `INV-ERC20-APPROVAL-143`.

**Submit-time `charmWad` + CL8Y amount ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)):** Kumbaya **3%** slippage applies to the **swap input** leg only. **`TimeArena`** enforces **`charmWad` ∈ `currentCharmBoundsWad`** at tx time. The UI re-reads bounds and price before submit ([`readFreshTimeCurveBuySizing`](../../frontend/src/lib/timeArenaBuySubmitSizing.ts)). See [arena-views.md](../frontend/arena-views.md).

**Swap deadline vs `block.timestamp` ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)):** **`swapDeadline`** for **`exactOutput`** and **`buyViaKumbaya`** is **`latest` head `block.timestamp` + 600s** (via [`fetchSwapDeadlineUnixSec`](../../frontend/src/lib/timeArenaKumbayaSwap.ts)), not **`Date.now()`**, so Anvil **time warps** do not make the deadline **before** inclusion-time chain time. Helpers: [`swapDeadlineUnixSecFromChainTimestamp`](../../frontend/src/lib/timeArenaKumbayaSwap.ts). **Test map:** invariants — issue #83.

<a id="qa-anvil-time-warp-and-swap-deadline-issue-83"></a>

### QA: Anvil time warp and swap deadline (issue #83 — Option B)

Some automation **advances chain time** with **`cast rpc anvil_increaseTime`** while the browser wall clock is unchanged. That is **correct for post-end / rich-state scripts** but historically broke Kumbaya **`Expired()`** when deadlines used wall time only — **Option A** (chain-aligned deadline in the app) is now the default fix; **Option B** remains useful for **ordering** tests and for **stacks that do not ship the new frontend**.

**Where `anvil_increaseTime` is used in this repo**

| Entrypoint | Calls `anvil_increaseTime`? | Notes |
|------------|------------------------------|--------|
| [`contracts/script/anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) | **Yes** — `warp_to_at_least` / past **`TimeCurve.deadline`** for Part2 and variants | Documented in [anvil-rich-state.md](../testing/anvil-rich-state.md). |
| [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) | **Indirectly** when it runs **`anvil_rich_state.sh`** (default unless **`SKIP_ANVIL_RICH_STATE=1`**) | Set **`SKIP_ANVIL_RICH_STATE=1`** to keep a **live** sale and **unwarped** chain time for Kumbaya / indexer manual runs on the default stack. |
| **`scripts/e2e-anvil.sh`**, **`scripts/lib/anvil_deploy_dev.sh`**, `verify-timecurve-buy-router-anvil.sh` | **No** rich-state warp in the normal path | Use for **Kumbaya router** scope without Part2 time jumps. |
| **`ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh`** (post-end gate setup) | **Yes** | Intended for **ended** sale scripts — not for in-sale **`buyViaKumbaya`** evidence on the same session. |

**Option B — reset infra / ordering (no code path change)**

1. **Fresh Anvil:** stop the node, start a new process (or `anvil_reset` if your tooling supports it), re-run **`DeployDev`** / **`anvil_deploy_dev.sh`** as needed — chain time returns near wall clock.
2. **Skip rich state on the default stack:** `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` (or equivalent) so **`anvil_rich_state.sh`** never runs — **TimeCurve** stays in a **live** sale window without shell warps.
3. **Evidence before warp:** run **`buyViaKumbaya`** / indexer checks **before** any script that calls **`anvil_increaseTime`** in the same RPC session.
4. **Split automation:** do not chain **`anvil_rich_state.sh`** ahead of browser Kumbaya flows that must succeed on the same chain state unless the frontend includes the **#83** deadline behavior.

Cross-links: [issue #75](https://gitlab.com/PlasticDigits/yieldomega/-/issues/75) (indexer `entry_pay_asset`), [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) (submit-time sizing).

**Hard limits (honest scope):**

- Routing assumes **v3-style** `exactOutput` / `quoteExactOutput` and **packed paths** built in `kumbayaRoutes.ts`. **UniversalRouter** paths are **not** the same ABI surface as our local Anvil fixture; production uses **SwapRouter02 + QuoterV2** per integrator-kit.
- **SwapRouter ABI (MegaETH):** Kumbaya’s deployed router implements **`IV3SwapRouter`** from `@kumbaya_xyz/swap-router-contracts` — swap calldata **does not** include a `deadline` field inside `exactOutput` / `exactOutputSingle` (unlike legacy Uniswap SwapRouter02). **`TimeCurveBuyRouter`** enforces **`swapDeadline`** before calling the router; single-hop ETH/USDM paths use **`exactOutputSingle`**, multi-hop stable paths use **`exactOutput`**. Wrong struct layout reverts immediately (~200 gas) with a generic `execution reverted`.
- **Pools must exist** for **CL8Y/WETH** and (for stable mode) **stable/WETH** at the configured **fee tiers** (`VITE_KUMBAYA_FEE_*` or defaults). Missing pools → failed quotes / swaps — **not** a protocol bug.
- **MegaETH mainnet (4326) fee tiers:** Kumbaya’s live **CL8Y/WETH** pool is **0.01% (100)**; **USDm/WETH** is **0.3% (3000)**. Defaults in `kumbayaRoutes.ts` match those tiers. **ETH and USDM** quotes use `quoteExactOutputSingle` hops only — production QuoterV2 `quoteExactOutput(bytes)` reverts (`toAddress_outOfBounds`). Submit paths re-read `currentPricePerCharmWad` for gross CL8Y and apply a small headroom BPS before quoting `maxIn`.
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
| **Single-tx availability** | The UI uses **`timeCurveBuyRouter` onchain**; optional **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`** (build-time) must **match** that address if set. Zero router → two-step Kumbaya + `buy` only. ([issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)) |
| **Single-tx sale live** | **`buyViaKumbaya`** fails closed with **`BadSalePhase`** when **`block.timestamp < saleStart()`** (scheduled but not yet live — [#114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)) **before** touching **`kumbayaRouter`** ([#118](https://gitlab.com/PlasticDigits/yieldomega/-/issues/118)). |
| **Swap deadline** | **`swapDeadline`** on **`buyViaKumbaya`** follows **latest head `block.timestamp` + 600s** (not wall clock); the Kumbaya router swap leg has **no** in-struct deadline ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)). |

---

## Environment runbooks

### Localnet (Anvil)

<a id="localnet-anvil"></a>

1. **Kumbaya fixtures + buy router:** `bash scripts/e2e-anvil.sh` and `scripts/lib/anvil_deploy_dev.sh` run **`DeployDev`** then **`DeployKumbayaAnvilFixtures`**, and export **`VITE_KUMBAYA_*`**. The one-shot stack script **`scripts/start-local-anvil-stack.sh`** runs **`DeployDev`** only by default; set **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** to run **`DeployKumbayaAnvilFixtures`** at stack start, write **`contracts.TimeCurveBuyRouter`** into [`contracts/deployments/local-anvil-registry.json`](../../contracts/deployments/local-anvil-registry.json), and merge the same **`VITE_KUMBAYA_*`** block into **`frontend/.env.local`** as e2e ([issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)). If you use the default stack and deploy fixtures **later** (e.g. `YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/verify-timecurve-buy-router-anvil.sh`), that script **merges** the buy-router address into the registry (and full Kumbaya Vite lines when the deploy log is available) so the **indexer** can load **`TimeCurveBuyRouter`** from **`ADDRESS_REGISTRY_PATH`** — **restart the indexer** (or re-run the stack) after the merge. Indexer behavior: **missing or empty** `TimeCurveBuyRouter` in the registry → **`BuyViaKumbaya` is not ingested**; do not write the **zero address** as a stand-in (see [`indexer/src/config.rs`](../../indexer/src/config.rs) `index_addresses`). **Literal line merge ([GitLab #154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154)):** those **`VITE_*`** writes use [`scripts/lib/kumbaya_env_set_line.py`](../../scripts/lib/kumbaya_env_set_line.py) (invoked from [`kumbaya_local_anvil_env.sh`](../../scripts/lib/kumbaya_local_anvil_env.sh)) so **`KEY=value`** text is not reinterpreted by **`sed`** substitution rules — see **`INV-KUMBAYA-ENV-154`**.
2. **TimeCurveBuyRouter live checklist (issue #78):** with Anvil on **`RPC_URL`**, a **live** sale (`TimeCurve.ended() == false`), and **`YIELDOMEGA_TIMECURVE`** set to the **proxy** (or from `contracts/deployments/local-anvil-registry.json`), run `bash scripts/verify-timecurve-buy-router-anvil.sh`. Use `YIELDOMEGA_DEPLOY_KUMBAYA=1` the first time to broadcast fixtures. The script updates the local registry per [issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84). See invariants — issue #78 and [../testing/manual-qa-checklists.md#manual-qa-issue-78](../testing/manual-qa-checklists.md#manual-qa-issue-78).
3. `cast call` the swap router, run Playwright E2E per [e2e-anvil.md](../testing/e2e-anvil.md).
4. **Mocked:** Fixture router is **not** Kumbaya production bytecode.

### Testnet (MegaETH 6343)

1. From integrator-kit **`megaETH-testnet.json`**: set **`VITE_KUMBAYA_WETH`**, **`VITE_KUMBAYA_SWAP_ROUTER`**, **`VITE_KUMBAYA_QUOTER`** (or rely on baked-in defaults in `kumbayaRoutes.ts`).
2. Set **`VITE_KUMBAYA_USDM`** to a **stable that has v3 liquidity** to WETH and a path to **CL8Y** (deploy-specific). Confirm fee tiers with on-chain pool config or Kumbaya tooling.
3. Smoke: **quote → swap → buy** on public RPC before enabling USDM mode in a hosted build.

### Mainnet (MegaETH 4326) — `TimeCurveBuyRouter` upgrade

If **`buyViaKumbaya`** reverts with generic `execution reverted` while quotes look correct, redeploy **`TimeCurveBuyRouter`** (IV3 swap ABI fix) and call **`TimeCurve.setTimeCurveBuyRouter(newRouter)`** as **`owner()`**:

```bash
# From repo root — interactive (deployer + admin keys + Etherscan API key)
scripts/upgrade-timecurve-buy-router.sh
```

Deployer pays gas for **`new TimeCurveBuyRouter`**; admin **`0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`** wires the proxy. Then set **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`** to the new address and update **`indexer/address-registry.megaeth-mainnet.json`** (`TimeCurveBuyRouter` + `abiHashesSha256`) before restarting the production indexer. **Current mainnet router (IV3 ABI fix, May 2026):** `0x9F7B0Fd3ed1cA730E37882aC3644b9991cdCaed9`. See [`scripts/upgrade-timecurve-buy-router.sh`](../../scripts/upgrade-timecurve-buy-router.sh).

### Mainnet (MegaETH 4326)

1. Confirm **SwapRouter02**, **QuoterV2**, **WETH9** against integrator-kit **`megaETH-mainnet.json`**.
2. Confirm **USDm** (or your chosen stable) against [default-token-list](https://github.com/Kumbaya-xyz/default-token-list) for chain **4326**.
3. Verify **CL8Y** accepted-asset address from your **TimeCurve** deployment matches **`VITE_*`** / wallet reads.
4. Run the same **quote → swap → buy** smoke with small notional; monitor slippage and deadline settings in `useArenaSaleSession.ts`.

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
- GitLab [issue #41](https://gitlab.com/PlasticDigits/yieldomega/-/issues/41) (initial routing), [issue #46](https://gitlab.com/PlasticDigits/yieldomega/-/issues/46) (docs + integrator alignment), [issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65) (`TimeCurveBuyRouter` + `buyFor`), [issue #78](https://gitlab.com/PlasticDigits/yieldomega/-/issues/78) (Anvil `TimeCurveBuyRouter` verification script + fork test), [issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67) (indexer: `BuyViaKumbaya` + `/v1/arena/buys` enrichment), [issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83) (Kumbaya swap deadline aligned to chain time; QA warp / Option B table above), [issue #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117) (audit **M‑02**: net ETH/stable refunds + owner **`rescue*`** on `TimeCurveBuyRouter`; invariants §117)
