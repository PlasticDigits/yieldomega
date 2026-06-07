# Arena v2 product primitives

**Status:** Arena v2 replaces the v1 launchpad sale, Rabbit Treasury / Burrow, the legacy collectible NFT layer, and the legacy five-sink CL8Y fee model. Full redeploy; **no backwards compatibility** with v1 addresses.

Parent epic: [GitLab #238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

## Spend asset and buy

- Participants **`buy(charmWad)`** on **`TimeArena`** (DOUB pull) or **`buyWithCred(charmWad)`** (burn **100 CRED per 1e18 CHARM** — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)).
- DOUB payment: `doubOwed = charmWad × charmPriceWad / 1e18`.
- Default **`charmPriceWad = 1000e18`** (1000 DOUB per 1e18 CHARM). Governance may **`setCharmPriceWad`**.
- CHARM band: **0.99–10** CHARM (WAD). Ingress uses ERC-20 **balance-delta parity** ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
- **`TimeArenaBuyRouter`**: CL8Y / ETH / USDm → Kumbaya **`exactOutput`** → DOUB → **`buyFor`**.

## Timers (Last Buy + four podiums)

| Category | Index | Timer storage | Extension / reset |
|----------|-------|---------------|-------------------|
| Last Buy | 0 | `deadline` (= `podiumDeadline[0]`) | **+120s**, **780s → 900s**, **24h** initial, **96h** cap |
| Time Booster | 1 | `podiumDeadline[1]` | **+60s**, **240s → 300s**, **12h** initial, **48h** cap |
| Defended Streak | 2 | `podiumDeadline[2]` | **+90s**, **510s → 600s**, **18h** initial, **72h** cap |
| WarBow | 3 | `podiumDeadline[3]` | **+300s**, **3300s → 3600s**, **48h** initial, **192h** cap |

Onchain table: [`ArenaPodiumTimerConfig`](../../contracts/src/arena/libraries/ArenaPodiumTimerConfig.sol) ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)). **Scoring hooks** (Time Booster totals, Defended Streak, WarBow BP) use **Last Buy** timer only; per-category params govern prize settlement deadlines.

Each qualifying **buy** extends **all four** podium deadlines. Timers **diverge** when categories roll on different schedules ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)).

- **`lastBuyEpoch`** increments on Last Buy **hard reset**; emits **`LastBuyEpochStarted`**. Permissionless **`rollPodiumEpoch(0)`** after expiry settles Last Buy prizes but does **not** bump `lastBuyEpoch` (CHARM/CRED epochs roll only on hard reset).
- **`podiumEpoch[cat]`** increments on **`rollPodiumEpoch(cat)`** when `block.timestamp > podiumDeadline[cat]`.
- Arena is **always live** when not **`paused`** — no `endSale` or `redeemCharms`.

## Podium settlement

On **`rollPodiumEpoch(category)`** (permissionless after deadline):

1. Snapshot top-3 (Last Buy: last-three buyers; others: live leaderboard).
2. Pay **4∶2∶1** from that category’s **active** DOUB pool.
3. Transfer **seed** pool balance → **active** pool for that category.
4. Increment **`podiumEpoch[cat]`**; clear live scores for that category only.
5. Emit **`PodiumEpochRolled`**.

**WarBow (cat 3):** steps 1 and 3–5 apply; step 2 (auto 4∶2∶1 pay) is **skipped** — owner **`finalizeWarbowPodium(epoch, …)`** pays that epoch’s pool ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)). Live BP resets via **`warbowBpGeneration`** on roll.

## DOUB prize routing (per buy)

| Destination | Bps | Notes |
|-------------|-----|--------|
| Each of 4 **active** podium pools | 1000 (10% each) | 40% total |
| Each of 4 **seed** podium pools | 750 (7.5% each) | 30% total |
| **`AdminSellVault`** | 3000 (30%) | Integer remainder |

Events: **`PodiumFunded`**, **`SeedFunded`**, **`AdminVaultFunded`**. Indexer ingest + **`GET /v1/arena/vault-funding/*`**: [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) · [invariants §267](../testing/invariants-and-business-logic.md#arena-vault-funding-gitlab-267).

<a id="manual-podium-pool-top-up-gitlab-261"></a>

### Manual podium pool top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

**`topUpPodiumPools(amountDoubWad)`** — voluntary prize sponsorship only: pulls DOUB from **`msg.sender`**, routes **100%** across the eight vaults at the **same 10% : 7.5% active:seed ratio per category** as the buy prize slice (normalized over the donated amount), **zero** to **`AdminSellVault`**. Emits **`PodiumPoolsToppedUp`**. Does not mint CRED/XP, extend timers, or increment **`totalDoubRaised`**. AUDIT UI + indexer: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262).

## Play CRED + epoch CHARM

- **`PlayCred`**: non-transferable; **`MINTER_ROLE`** for TimeArena (+ optional **`CredGrantor`**).
- Each DOUB buy mints **35 CRED** (18 decimals) into the epoch accrual pool; holders claim **pro-rata** by **`charmWad[epoch][user]`** after that Last Buy epoch ends.
- **`claimCred(epoch)`** zeros epoch CHARM weight and transfers accrued CRED (pro-rata plus any **`epochFixedCredBonus`** for that epoch).
- **`buyWithCred`**: burns `charmWad × 100e18 / 1e18` CRED (no DOUB routing, no epoch pool accrual) — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268).
- **First buy ever** (DOUB or CRED, per wallet, not reset on timer hard-reset): schedules **150 CRED** claimable in **`lastBuyEpoch + 1`** after that buy completes (including same-tx hard-reset). Emits **`FirstBuyCredScheduled`**. **`buyCount`** tracks buys for podiums only; first-buy consumption is **`buyCount == 0`** before increment — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268).
- Referred **DOUB** buy: **5 CRED** flat to referrer and buyer (`REFERRAL_CRED_FLAT_WAD`; independent of epoch pool) — [#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272). **`buyWithCred`** has no referral path.

<a id="xp"></a>

## XP

- Per buy: `xp = 1 + (charmWad - CHARM_MIN) * 9 / (CHARM_MAX - CHARM_MIN)` (integer floor; **1–10** at band ends).
- Level **L** requires cumulative XP; step **L→L+1**: `min(20 + (L-1)*5, 100)` XP (**L1 = 20** total to reach level 2).
- **Player level cap 5** ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)): `MAX_PLAYER_LEVEL = 5`; surplus XP **banks** in **`xpTowardNext`** at max level. Views **`level`**, **`unlockedLevel`**, **`xp`**, **`xpTowardNext`**, **`xpToNextLevel`**. Onchain: [`ArenaXp`](../../contracts/src/arena/libraries/ArenaXp.sol); frontend: [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts), [`arenaProgression.ts`](../../frontend/src/lib/arenaProgression.ts).
- **Progressive unlocks (#299):** buyer **level** gates **their** buy side effects — L1 Last Buy only; L2 Time Booster timer/scoring; L3 Defended Streak; L4 WarBow timer/BP + steal/guard/revenge; L5 flag plant/cancel. Other players’ buys always run full mechanics. **`grandfatherProgression(address[])`** one-shot migration for pre-ship wallets with `buyCount > 0`.
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

BP rules follow v1 [`primitives.md`](primitives.md) (buy bonuses, steal band 2×–10×, flag plant/claim). All spends are **DOUB** pulls with balance-delta parity.

## Retired surfaces

- Collectible NFT layer — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)
- Rabbit Treasury / Burrow — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)
- v1 launchpad sale-end / redemption / presale — [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)
- Five-sink CL8Y routing — [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)
