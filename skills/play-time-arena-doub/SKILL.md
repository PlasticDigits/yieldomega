---
name: play-time-arena-doub
description: Play TimeArena — DOUB buys, Last Buy timer, four podium categories. Arena v2 replaces TimeCurve launchpad.
---

# Play Time Arena (DOUB)

**Authority:** [`TimeArena`](../../contracts/src/arena/TimeArena.sol) onchain + [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md).

## Buy

- `buy(charmWad)` or `buy(charmWad, codeHash)` pulls **DOUB** = `charmWad × charmPriceWad / 1e18` (default **1000 DOUB** per 1 CHARM).
- **`buyWithCred(charmWad)`** burns Play CRED (no approve); `/arena` UI ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) — [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts). Onchain burn: **100 CRED / 1e18 CHARM** when [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268) is deployed.
- **ETH / USDM:** `TimeArenaBuyRouter.buyViaKumbaya` → Kumbaya `exactOutput` → DOUB → `buyFor` when `timeArenaBuyRouter` is set ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), UI [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Local Anvil: `bash scripts/e2e-anvil.sh` or `YIELDOMEGA_DEPLOY_KUMBAYA=1` + [`DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol) ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)); verify with `bash scripts/verify-time-arena-buy-router-anvil.sh`.
- Each buy routes DOUB: **40%** active podium pools, **30%** seed pools, **30%** `AdminSellVault` ([#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249) · [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol)).
- Admin may later **`sellDoubToUsdm`** on **`AdminSellVault`** (Kumbaya **`exactInputSingle`** on MegaETH; mock swap in Forge — [kumbaya §249](../../docs/integrations/kumbaya.md#admin-sell-vault-gitlab-249)).
- **XP:** 1–10 per buy from CHARM band; uncapped level — [`ArenaXp`](../../contracts/src/arena/libraries/ArenaXp.sol) / [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts) ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250)).
- Onchain: **`PodiumFunded`**, **`SeedFunded`**, **`AdminVaultFunded`** per buy. Indexer history + per-tx breakdown: [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) · **`GET /v1/arena/vault-funding/*`** · [invariants §267](../../docs/testing/invariants-and-business-logic.md#arena-vault-funding-gitlab-267).
- **First buy ever** (this wallet): schedules **150 CRED** for the **next** `lastBuyEpoch` (DOUB or CRED path); one-time — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268).
- **Pause:** `TimeArena.paused` — not legacy `buyFeeRoutingEnabled`.

## Play CRED yield + claim ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248))

- Each **DOUB** buy adds **35 CRED** to `epochCredPool[lastBuyEpoch]`; pro-rata by `epochCharmWad[epoch][user] / epochCharmTotal[epoch]`.
- **`buyWithCred`**: burns CRED, accrues epoch CHARM weight, **does not** add to the epoch CRED pool.
- **`claimCred(epoch)`** when `epoch < lastBuyEpoch`: mints pro-rata share + any `epochFixedCredBonus`; zeros epoch CHARM for that wallet.
- Invariants: [`INV-TIME-ARENA-CRED-*`](../../docs/testing/invariants-and-business-logic.md), [`PlayCred.t.sol`](../../contracts/test/PlayCred.t.sol).

## Donate to pools (optional sponsorship)

- `topUpPodiumPools(amountDoubWad)` — permissionless DOUB **`transferFrom`**; **100%** to the eight prize vaults using the same **10% : 7.5%** active:seed ratio per category as the buy prize slice, **no** admin take ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)).
- Does **not** mint CRED/XP, extend timers, or count toward buy stats. Invariants: [**§261**](../../docs/testing/invariants-and-business-logic.md#arena-podium-pool-topup-gitlab-261). AUDIT UI + indexer history: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · [arena-views § donate-pools](../../docs/frontend/arena-views.md#protocol-donate-pools-gitlab-262).

## Timer

- Last Buy deadline extends **+120s** per buy; **13m → 15m** hard-reset band (see `TimeMath`).
- **`lastBuyEpoch`** increments on hard reset.

## Not in v1 removal batch

- **WarBow** — returns on DOUB in [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252).
- **Play CRED claim** — [GitLab #248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248); **CRED pay UI** — [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269). See **Play CRED yield + claim** in this skill.

## Retired

TimeCurve `endSale`, `redeemCharms`, linear CL8Y price, Rabbit Treasury, collectible NFT layer — see epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).
