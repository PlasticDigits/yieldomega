# Arena v2 product primitives

**Status:** Arena v2 replaces the v1 launchpad sale, Rabbit Treasury / Burrow, the legacy collectible NFT layer, and the legacy five-sink CL8Y fee model. Full redeploy; **no backwards compatibility** with v1 addresses.

Parent epic: [GitLab #238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

## Spend asset and buy

- Participants **`buy(charmWad)`** on **`TimeArena`** (DOUB pull) or **`buyWithCred(charmWad)`** (burn **100 CRED per 1e18 CHARM** — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)).
- DOUB payment: `doubOwed = charmWad × effectiveCharmPriceWad() / 1e18`.
- **Production launch:** epoch-0 anchor from **Kumbaya TWAP** on **DOUB/CL8Y** + **CL8Y/WETH** (+ **WETH/USDm** USD leg; ~**$1** DOUB notional per 1 CHARM; Sir **15m** — [#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)); each Last Buy hard reset re-anchors, then **+10%/day** until the next reset ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)). **`effectiveCharmPriceWad()`** is the buy-time price; storage **`charmPriceWad`** is the governance / fallback anchor. **Anvil / DeployDev:** **`1000e18`** baseline. Governance may **`setCharmPriceWad`** anytime. **`buyWithCred`** uses flat **100 CRED/CHARM** — no epoch pricing ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)).
- CHARM band: **0.99–10** CHARM (WAD). Ingress uses ERC-20 **balance-delta parity** ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
- **`TimeArenaBuyRouter`**: CL8Y / ETH / USDm → Kumbaya **`exactOutput`** → DOUB → **`buyFor`**.

**Buy energy ([#332](https://gitlab.com/PlasticDigits/yieldomega/-/issues/332)):** wallet pacing is onchain. Defaults are `buyChargeIntervalSec = 300`, base `maxBuyCharges = 5`, and `burstBuyCooldownSec = 15`. Effective wallet cap is `maxBuyCharges + level - 1` (L1 = 5, L5 = 9). Each successful `buy`, `buy(codeHash)`, `buyFor`, or `buyWithCred` spends one charge before token transfer/burn. `buyEnergyState(wallet)` returns current charges, effective cap, refill timestamps, and computed next buy time; `buyCooldownSec` remains a legacy ABI mirror of the 300s interval.

## Timers (Last Buy + four podiums)

| Category | Index | Timer storage | Extension / reset |
|----------|-------|---------------|-------------------|
| Last Buy | 0 | `deadline` (= `podiumDeadline[0]`) | **+120s**, **780s → 900s**, **24h** initial, **96h** cap |
| Time Booster | 1 | `podiumDeadline[1]` | **+60s**, **240s → 300s**, **12h** initial, **48h** cap |
| Defended Streak | 2 | `podiumDeadline[2]` | **+90s**, **510s → 600s**, **18h** initial, **72h** cap |
| WarBow | 3 | `podiumDeadline[3]` | **+300s**, **3300s → 3600s**, **48h** initial, **192h** cap |

Onchain table: [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol) ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)). **Scoring hooks** (Time Booster totals, Defended Streak, WarBow BP) use **Last Buy** timer only; per-category params govern prize settlement deadlines.

**Epoch arm model ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)):** Per category, settlement timers are **unarmed** after `startArena()` and after each `rollPodiumEpoch(cat)` until the **first qualifying buy** in that epoch (level-gated per [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)): L1 arms Last Buy; L2+ Time Booster; L3+ Defended Streak; L4+ WarBow. First arm sets `podiumDeadline[cat] = now + podiumInitialTimerSec[cat]` then applies that buy’s extension / hard-reset band. Unarmed epochs **do not** autoroll. Indexer exposes `podium_timer_armed[]` on `GET /v1/arena/timers` (schema ≥ 2.17.0); play UI shows **awaiting first buy** until armed.

Each qualifying **buy** extends **all armed** podium deadlines for categories the buyer unlocks. Timers **diverge** when categories roll on different schedules ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)).

- **`lastBuyEpoch`** increments on Last Buy **hard reset**; emits **`LastBuyEpochStarted`**. Permissionless **`rollPodiumEpoch(0)`** after expiry settles Last Buy prizes but does **not** bump `lastBuyEpoch` (CHARM/CRED epochs roll only on hard reset).
- **`podiumEpoch[cat]`** increments on **`rollPodiumEpoch(cat)`** when the timer is **armed** and `block.timestamp > podiumDeadline[cat]`.
- Arena is **always live** when not **`paused`** — no `endSale` or `redeemCharms`.

## Podium settlement

On **`rollPodiumEpoch(category)`** (permissionless after deadline):

1. Snapshot top-3 (Last Buy: last-three buyers; others: live leaderboard).
2. Pay **4∶2∶1** from that category’s **active** DOUB pool.
3. Transfer **seed** pool balance → **active** pool for that category.
4. Increment **`podiumEpoch[cat]`**; clear live scores for that category only.
5. Emit **`PodiumEpochRolled`**.

**WarBow (cat 3):** steps 1–5 apply on **`rollPodiumEpoch`** / autoroll — on-chain top-3 from live BP leaderboard pays **4∶2∶1**; emits **`WarbowPodiumFinalized`**. Owner **`finalizeWarbowPodium`** is **superseded** (reverts) ([#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)). Live BP resets via **`warbowBpGeneration`** on roll.

**Always-live autoroll ([#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)):** When not **`paused`**, buys and WarBow actions call **`_autorollExpiredPodiums()`** before proceeding — any **armed** category with **`block.timestamp > podiumDeadline[cat]`** rolls in one tx (unarmed categories are skipped; [#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)). While **`paused`**, **`rollPodiumEpoch`** reverts and autoroll does not run (buy/WarBow revert at **`_requireLive()`** first) ([#349](https://gitlab.com/PlasticDigits/yieldomega/-/issues/349)).

## DOUB prize routing (per buy) — [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)

**100%** of paid DOUB routes to **four podium prize vaults** (**0%** admin take on buys). Each category receives **25%** of the buy; within each category the share splits **70% / 20% / 10%** to **`podiumEpoch[cat]`**, **`+1`**, **`+2`** pools (active / seed / future). Remainder wei: category split residue → **Last Buy (cat 0)** ([#313](https://gitlab.com/PlasticDigits/yieldomega/-/issues/313)); within-category residue → **+2 tranche** ([`ArenaBuyRouting.splitBuyAmount`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol)).

| Tranche | Pool | Share of category |
|---------|------|-------------------|
| Current epoch | `activePools[cat]` | 70% |
| Next epoch | `seedPools[cat]` | 20% |
| Epoch +2 | `futurePools[cat]` | 10% (absorbs remainder) |

On **`rollPodiumEpoch`**: pay active 4∶2∶1 (except WarBow auto-pay), then **`rollEpochTranches`** (future → seed → active). **`totalDoubRaised`** still records full **`received`** DOUB.

Events: **`PodiumEpochFunded(category, epoch, amount, pool)`** on buys; **`PodiumFunded` / `SeedFunded`** remain for **`topUpPodiumPools`** only. Indexer: **`GET /v1/arena/vault-funding/*`** ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267)) · **`INV-ARENA-PRIZE-ROUTING-300-*`** · [invariants §300](../testing/invariants-and-business-logic.md#arena-prize-routing-gitlab-300).

<a id="manual-podium-pool-top-up-gitlab-261"></a>

### Manual podium pool top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

**`topUpPodiumPools(amountDoubWad)`** — voluntary prize sponsorship only: pulls DOUB from **`msg.sender`**, routes **100%** across the eight vaults at the **same 10% : 7.5% active:seed ratio per category** as the buy prize slice (normalized over the donated amount), **zero** to **`AdminSellVault`**. Emits **`PodiumPoolsToppedUp`**. Does not mint CRED/XP, extend timers, or increment **`totalDoubRaised`**. AUDIT UI + indexer: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262).

## Play CRED + epoch CHARM

- **`PlayCred`**: non-transferable; **`MINTER_ROLE`** for TimeArena (+ optional **`CredGrantor`**).
- Each DOUB or CRED buy mints **35 CRED** (18 decimals) into the epoch accrual pool; holders claim **pro-rata** by **`charmWad[epoch][user]`** after that Last Buy epoch ends.
- **`claimCred(epoch)`** zeros epoch CHARM weight and transfers accrued CRED (pro-rata plus any **`epochFixedCredBonus`** for that epoch).
- **`buyWithCred`**: burns `charmWad × 100e18 / 1e18` CRED (no DOUB routing); also adds **35 CRED** to epoch pool — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268), [#311](https://gitlab.com/PlasticDigits/yieldomega/-/issues/311).
- **First buy ever** (DOUB or CRED, per wallet, not reset on timer hard-reset): schedules **`FIRST_BUY_CRED_BONUS = 1100e18`** claimable in **`lastBuyEpoch + 1`** after that buy completes (including same-tx hard-reset). Emits **`FirstBuyCredScheduled`**. **`buyCount`** tracks buys for podiums only; first-buy consumption is **`buyCount == 0`** before increment — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268), [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299).
- Referred **DOUB** buy: **5 CRED** flat to referrer and buyer (`REFERRAL_CRED_FLAT_WAD`; independent of epoch pool) — [#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272). **`buyWithCred`** has no referral path.

<a id="xp"></a>

## XP

- Per buy, **scaled by CHARM weight cleared** ([#304](https://gitlab.com/PlasticDigits/yieldomega/-/issues/304)): `xp = 1 + (charmWad - CHARM_MIN) * 9 / (CHARM_MAX - CHARM_MIN)` (integer floor; **1–10** at band ends — min band → 1 XP, max band → 10 XP).
- Level **L** requires cumulative XP; step **L→L+1**: `min(10 + (L-1)*5, 100)` XP (**L1 = 10** total to reach level 2).
- **Player level cap 5** ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)): `MAX_PLAYER_LEVEL = 5`; surplus XP at max level is **discarded** (`xpTowardNext` stays **0**). Views **`level`**, **`unlockedLevel`**, **`xp`**, **`xpTowardNext`**, **`xpToNextLevel`**. Onchain: [`ArenaXp`](../../contracts/src/arena/libraries/ArenaXp.sol); frontend: [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts), [`arenaProgression.ts`](../../frontend/src/lib/arenaProgression.ts).
- **Progressive unlocks (#299):** each buyer’s **level** gates **that wallet’s** buy side effects — L1 Last Buy only; L2 Time Booster timer/scoring; L3 Defended Streak; L4 WarBow timer/BP + steal/guard/revenge; L5 flag plant/cancel. Gating is per **buyer**, not per observer (a level-1 opponent’s buy only extends Last Buy). **`grandfatherProgression(address[])`** one-shot migration for pre-ship wallets with `buyCount > 0`.
- **Onboarding (#299):** `ONBOARDING_STARTER_CHARM_WAD = 10e18`; `FIRST_BUY_CRED_BONUS = 1100e18` (110% of starter `buyWithCred` burn) so two starter buys reach **level ≥ 2**.
- **Buy path ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)):** each buy adds charm XP to **`xpTowardNext`**, subtracts threshold XP on level-up, and applies **at most five** level-ups per buy; surplus progress carries to the next buy. **`levelFromXp` full recompute is not used on the hot path.**
- **Timer hard-reset / `lastBuyEpoch` roll** does **not** reset **`level`**, **`xpTowardNext`**, or lifetime **`xp`** — progression is independent of podium/timer state ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250)).

## WarBow (DOUB)

| Action | DOUB cost |
|--------|-----------|
| Steal | 1000e18 |
| Guard | 10000e18 |
| Steal-limit override | 50000e18 |
| Revenge | 1000e18 |
| Flag claim | 0 |

BP rules follow v1 [`primitives.md`](primitives.md) (buy bonuses including **streak-break** and **ambush** on qualifying buys ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)), steal band 2×–10×, flag plant/claim). All spends are **DOUB** pulls with balance-delta parity, then **100%** podium routing and **`totalDoubRaised`** increment — same split as **`buy`** ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)). **`claimWarBowFlag`** uses **`_requireLive()`** — blocked when **`paused`** (same as other WarBow writes).

## Routes (frontend)

- Primary play: **`/`** · AUDIT: **`/arena/protocol`** · referral capture: **`/arena/:code`** · legacy **`/arena`** / **`/timecurve`** → **`/`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256), [#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)). See [arena-views.md](../frontend/arena-views.md).

**On-chain podium ranking ([#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)):** WarBow top-3 is maintained incrementally via a global top-3 plus an off-podium top-3 buffer (≤6 addresses merged per BP update). Tie-break: equal BP ranks lower address higher. See [WarBow ranking benchmark § tradeoff](../testing/warbow-ranking-benchmark-312.md#6-address-tracking-tradeoff-gas-vs-accuracy) for gas/accuracy limits.

## Retired surfaces

- Collectible NFT layer — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)
- Rabbit Treasury / Burrow — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)
- v1 launchpad sale-end / redemption / presale — [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)
- Five-sink CL8Y routing — [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)
