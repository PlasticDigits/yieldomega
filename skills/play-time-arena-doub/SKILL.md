---
name: play-time-arena-doub
description: Play TimeArena — DOUB buys, Last Buy timer, four podium categories. Arena v2 replaces TimeCurve launchpad.
---

# Play Time Arena (DOUB)

**Authority:** [`TimeArena`](../../contracts/src/arena/TimeArena.sol) onchain + [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md).

## Buy

- `buy(charmWad)` or `buy(charmWad, codeHash)` pulls **DOUB** = `charmWad × effectiveCharmPriceWad() / 1e18`. **Production (4326):** each Last Buy epoch **re-anchors** from **Kumbaya V3 TWAP**, then grows **+10%/day** until the next hard reset ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305) · **`INV-TIME-ARENA-EPOCH-CHARM-GROWTH`**). **Epoch-0 anchor** from TWAP (~**$1** DOUB notional per 1 CHARM — [#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303) · **`INV-TIME-ARENA-CHARM-TWAP-INIT`** · `bash scripts/compute-arena-charm-price-twap.sh`). **Anvil / DeployDev:** **`1000e18`** anchor baseline. Implied spend band: **`0.99×`–`10× effectiveCharmPriceWad()`**. Invariants: [**§246**](../../docs/testing/invariants-and-business-logic.md#timearena-core-gitlab-246) · [**§305**](../../docs/testing/invariants-and-business-logic.md#timearena-epoch-charm-price-gitlab-305) · [**§303**](../../docs/testing/invariants-and-business-logic.md#arena-charm-twap-init-gitlab-303).
- **`buyWithCred(charmWad)`** burns Play CRED (no approve); `/arena` UI ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) — [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts). Onchain burn: **100 CRED / 1e18 CHARM** ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268) · [`INV-TIME-ARENA-CRED-BURN-BUY`](../../docs/testing/invariants-and-business-logic.md#timearena-cred-buy-gitlab-268)); verify: `bash scripts/verify-cred-buy-anvil.sh`.
- **ETH / USDM:** `TimeArenaBuyRouter.buyViaKumbaya` → Kumbaya `exactOutput` → DOUB → `buyFor` when `timeArenaBuyRouter` is set ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), UI [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). **CL8Y** reserve → DOUB via router **`PAY_CL8Y`** (contract + Forge; UI `/arena` **`cl8y`** pay mode is direct **DOUB**). Local Anvil: `bash scripts/e2e-anvil.sh` or `YIELDOMEGA_DEPLOY_KUMBAYA=1` + [`DeployKumbayaAnvilFixtures.s.sol`](../../contracts/script/DeployKumbayaAnvilFixtures.s.sol) ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)); verify with `bash scripts/verify-time-arena-buy-router-anvil.sh` (fork matrix: `VerifyTimeArenaBuyRouterAnvil.t.sol`).
- Each buy routes **100%** of DOUB to four podium tracks: **25%** per category, split **70% / 20% / 10%** across current and next two epochs ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300) · [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol) · **`INV-ARENA-PRIZE-ROUTING-300-*`** · [invariants §300](../../docs/testing/invariants-and-business-logic.md#arena-prize-routing-gitlab-300)). **0%** admin take on buys ([#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314) retires **`AdminSellVault`** from deploy).
- **XP:** **1–10 per buy, scaled by CHARM weight** (`xpForCharm(charmWad)` — min band 1 XP, max band 10 XP); same for DOUB and CRED paths — [`ArenaXp`](../../contracts/src/arena/libraries/ArenaXp.sol) / [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts) ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250), [#304](https://gitlab.com/PlasticDigits/yieldomega/-/issues/304) · **`INV-TIME-ARENA-XP-CHARM-SCALE`** · [invariants §304](../../docs/testing/invariants-and-business-logic.md#timearena-xp-charm-scale-gitlab-304)). Buy path: cached **`level`** + **`xpTowardNext`**, max **5** level-ups/buy — [`applyXpGain`](../../contracts/src/arena/libraries/ArenaXp.sol) ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265) · [`INV-TIME-ARENA-XP-GAS`](../../docs/testing/invariants-and-business-logic.md#timearena-xp-gas-gitlab-265)).
- Onchain: **`PodiumEpochFunded(category, epoch, amount, pool)`** per buy tranche (12 events typical for 1000 DOUB). Indexer: [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) + [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300) · **`GET /v1/arena/vault-funding/*`** (`kind=podium_epoch`, `target_epoch`) · `bash scripts/verify-vault-funding-anvil.sh`.
- **First buy ever** (this wallet): schedules **150 CRED** for the **next** `lastBuyEpoch` (DOUB or CRED path); one-time — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268) · [`INV-TIME-ARENA-FIRST-BUY-CRED-BONUS`](../../docs/testing/invariants-and-business-logic.md#timearena-cred-buy-gitlab-268) · [manual QA §268](../../docs/testing/manual-qa-checklists.md#manual-qa-issue-268).
- **Referral (DOUB only):** valid `codeHash` on `buy(charmWad, codeHash)` mints **5 CRED** each to referrer and buyer (`REFERRAL_CRED_FLAT_WAD`); not tied to the **35 CRED** epoch pool; **`buyWithCred`** has no referral path — [#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272) · [`INV-REFERRAL-272-FLAT-CRED`](../../docs/testing/invariants-and-business-logic.md#referral-flat-cred-gitlab-272) · `bash scripts/verify-referral-flat-cred-anvil.sh`.
- **Pause:** `TimeArena.paused` only — **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** · [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264).
- **CL8Y unlimited approve (optional):** `/arena` checkbox stores **`yieldomega.erc20.cl8yArenaUnlimited.v1`**; legacy v1 key still honored on read ([#277](https://gitlab.com/PlasticDigits/yieldomega/-/issues/277) · **`INV-FRONTEND-277-*`** · [wallet-connection §143](../../docs/frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143)).

## Play CRED yield + claim ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248))

- Each **DOUB** buy adds **35 CRED** to `epochCredPool[lastBuyEpoch]`; pro-rata by `epochCharmWad[epoch][user] / epochCharmTotal[epoch]`.
- **`buyWithCred`**: burns CRED, accrues epoch CHARM weight, **does not** add to the epoch CRED pool.
- **`claimCred(epoch)`** when `epoch < lastBuyEpoch`: mints pro-rata share + any `epochFixedCredBonus`; zeros epoch CHARM for that wallet.
- **`/arena` UI ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)):** [`ArenaCharmCredCard`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) — claim **`lastBuyEpoch - 1`** after hard reset · [arena-views §257](../../docs/frontend/arena-views.md#charm-cred-card-gitlab-257).
- Invariants: [`INV-TIME-ARENA-CRED-*`](../../docs/testing/invariants-and-business-logic.md#timearena-cred-buy-gitlab-268), [`PlayCred.t.sol`](../../contracts/test/PlayCred.t.sol).

## Donate to pools (optional sponsorship)

- `topUpPodiumPools(amountDoubWad)` — permissionless DOUB **`transferFrom`**; **100%** to the eight prize vaults using the same **10% : 7.5%** active:seed ratio per category as the buy prize slice, **no** admin take ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)).
- Does **not** mint CRED/XP, extend timers, or count toward buy stats. Invariants: [**§261**](../../docs/testing/invariants-and-business-logic.md#arena-podium-pool-topup-gitlab-261). AUDIT UI + indexer history: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · [arena-views § donate-pools](../../docs/frontend/arena-views.md#protocol-donate-pools-gitlab-262).

## Timer

Per-category **prize settlement** deadlines (`podiumDeadline[cat]`, `podiumEpoch[cat]`). One buy extends **all four** by category-specific rules ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)):

| Cat | Podium | Extension | Hard reset | Initial |
|-----|--------|-----------|------------|---------|
| 0 | Last Buy | +120s | 780s → 900s | 24h |
| 1 | Time Booster | +60s | 240s → 300s | 12h |
| 2 | Defended Streak | +90s | 510s → 600s | 18h |
| 3 | WarBow | +300s | 3300s → 3600s | 48h |

Onchain: [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol). **Scoring** (Time Booster totals, Defended Streak, WarBow BP clutch/reset) uses **Last Buy (cat 0)** timer only — not other podium bands ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271) comment). Verify: `bash scripts/verify-podium-timers-anvil.sh` · [invariants §271](../../docs/testing/invariants-and-business-logic.md#timearena-podium-timers-gitlab-271) · [manual QA §271](../../docs/testing/manual-qa-checklists.md#manual-qa-issue-271).

- **`lastBuyEpoch`** increments on Last Buy hard reset (CHARM/CRED epoch); independent of other podium rolls ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)).
- **`rollPodiumEpoch(cat)`** after expiry settles that category only — [arena-v2 § timers](../../docs/product/arena-v2.md#timers-last-buy--four-podiums) · [invariants §271](../../docs/testing/invariants-and-business-logic.md#timearena-podium-timers-gitlab-271).

## Not in v1 removal batch

- **WarBow** — returns on DOUB in [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252).
- **Play CRED claim** — [GitLab #248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248); **CRED pay UI** — [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269). See **Play CRED yield + claim** in this skill.

## Participant profiles ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258))

On **`/arena`** and **`/arena/protocol`**, click any participant wallet on live buy rows or podium rankings to open **`WalletProfileModal`** — stats from **`GET /v1/arena/wallet/{address}/stats`** (Overview, Podium wins, Spending, XP/Level, WarBow, Referrals, Fun facts). The “Just +Ns by …” timer chip needs **`actual_seconds_added`** on **`GET /v1/arena/buys`** ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)); buy detail and stable list keys need **`new_deadline`**, **`buy_index`**, **`log_index`**, **`block_timestamp`** ([#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)): `bash scripts/verify-wallet-profile-anvil.sh`. Invariants: [**`INV-FRONTEND-258-WALLET-PROFILE`**](../../docs/testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258), [**`INV-INDEXER-282-ARENA-BUYS-SECONDS`**](../../docs/testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258), [**`INV-INDEXER-283-ARENA-BUYS-PARITY`**](../../docs/testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258) · [arena-views § wallet-profile](../../docs/frontend/arena-views.md#wallet-profile-modal-gitlab-258).

## Retired

TimeCurve `endSale`, `redeemCharms`, linear CL8Y price, Rabbit Treasury, collectible NFT layer — see epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).
