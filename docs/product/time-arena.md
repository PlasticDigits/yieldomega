# Time Arena — product primitives (Arena v2)

**Status:** Authoritative product spec for **TimeArena** — timers, CRED, prizes, XP, and WarBow. Replaces v1 **TimeCurve** launchpad semantics ([GitLab #240](https://gitlab.com/PlasticDigits/yieldomega/-/issues/240)).

Parent epic: [GitLab #238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

**Related docs:** [arena-v2.md](arena-v2.md) (implementation companion) · [primitives.md](primitives.md) (shared cooldown + referrals index) · [invariants § TimeArena v2](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260) · [frontend arena views](../frontend/arena-views.md) · Play skills: [`skills/README.md`](../../skills/README.md)

**Onchain authority:** [`TimeArena`](../../contracts/src/arena/TimeArena.sol), [`PodiumVaults`](../../contracts/src/arena/PodiumVaults.sol), [`AdminSellVault`](../../contracts/src/arena/AdminSellVault.sol), [`PlayCred`](../../contracts/src/tokens/PlayCred.sol), [`ReferralRegistry`](../../contracts/src/ReferralRegistry.sol).

---

## Spend asset and buy

- Participants **`buy(charmWad)`** on **`TimeArena`** (DOUB pull) or **`buyWithCred(charmWad)`** (burn **100 CRED per 1e18 CHARM** — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268); supersedes early “70 CRED per buy” drafts per issue #240 comment).
- DOUB payment: `doubOwed = charmWad × charmPriceWad / 1e18`.
- **CHARM price:** fixed **1000 DOUB / CHARM** (`charmPriceWad = 1000e18`) by default; governance may **`setCharmPriceWad`**. **Not** a bonding curve or linear launchpad price — v2 uses a flat admin-set rate.
- CHARM band: **0.99–10** CHARM (WAD). Ingress uses ERC-20 **balance-delta parity** ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
- **`TimeArenaBuyRouter`**: CL8Y / ETH / USDm → Kumbaya **`exactOutput`** → DOUB → **`buyFor`** ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).
- Arena is **always live** when not **`paused`** — **no** `endSale`, **`redeemCharms`**, or sale-end gates ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

---

## Timers — four independent podiums

Each podium category has its **own deadline** (`podiumDeadline[cat]`) and **epoch counter** (`podiumEpoch[cat]`). Epochs are **not synchronized** across categories — timers diverge when categories roll on different schedules.

Each qualifying **buy** extends **all four** podium deadlines (Last Buy uses the primary `deadline`; others via `_extendOtherPodiumTimers`).

| Podium | Cat | Initial timer | Extension on buy | Hard-reset if remaining below | Reset to |
|--------|-----|---------------|------------------|-------------------------------|----------|
| **Last Buy** (primary) | 0 | 24h | +120s (+2m) | 13m (780s) | 15m (900s) |
| **Defended Streak** | 2 | 18h | +90s (+1.5m) | 8.5m (510s) | 10m (600s) |
| **Time Booster** | 1 | 12h | +60s (+1m) | 4m (240s) | 5m (300s) |
| **WarBow** | 3 | 48h | +300s (+5m) | 55m (3300s) | 1h (3600s) |

**Last Buy epoch:** `lastBuyEpoch` increments on Last Buy **hard reset**; emits **`LastBuyEpochStarted`**. This drives epoch-scoped CHARM and CRED accrual (below).

**Podium epoch roll:** permissionless **`rollPodiumEpoch(category)`** when `block.timestamp > podiumDeadline[category]` ([#240 open decision #4](#resolved-open-decisions-gitlab-240), implementation [#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)). On roll: snapshot top-3, pay **4∶2∶1** from active pool, roll seed → active, increment `podiumEpoch[cat]`, clear that category’s live scores, emit **`PodiumEpochRolled`**.

**Timer cap:** Last Buy (and current deploy defaults) use a **96h** cap (`timerCapSec = 4 × 86400`); per-category caps may follow the same pattern when per-podium params land onchain.

<a id="onchain-timer-implementation-note"></a>

### Onchain implementation note

Current **`TimeArena`** bootstrap deploy ([`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol)) wires **shared** Last Buy timer params (`+120s`, 780s→900s hard reset, 24h initial) for **all four** categories. **Product target** is the per-podium table above; track divergence in Forge/invariant work before treating non–Last Buy hard-reset bands as enforced onchain.

---

## Buy economics (DOUB prize routing)

| Destination | Share | Notes |
|-------------|-------|--------|
| Each of 4 **active** podium pools | 10% | 40% total |
| Each of 4 **seed** podium pools | 7.5% | 30% total |
| **`AdminSellVault`** | 30% | Integer remainder |

**70% total to prizes** (40% active + 30% seed). Library: [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol). Events: **`PodiumFunded`**, **`SeedFunded`**, **`AdminVaultFunded`**. Indexer: **`GET /v1/arena/vault-funding/*`** ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267)).

<a id="manual-podium-pool-top-up-gitlab-261"></a>

### Manual podium pool top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

**`topUpPodiumPools(amountDoubWad)`** — voluntary sponsorship: **100%** to eight prize vaults at the same **10% : 7.5%** active:seed ratio per category; **zero** admin take. Emits **`PodiumPoolsToppedUp`**. Does not mint CRED/XP, extend timers, or bump **`totalDoubRaised`**.

---

## Play CRED + epoch CHARM

- **`PlayCred`**: non-transferable ERC-20; **`MINTER_ROLE`** for TimeArena (+ optional **`CredGrantor`**).
- **`buyWithCred(charmWad)`**: burns `charmWad × 100e18 / 1e18` CRED; min/max CHARM band applies; **no** DOUB routing and **no** epoch CRED pool accrual on CRED-only buys ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)).
- **CRED yield:** each **DOUB** buy adds **35 CRED** (18 decimals) to the current Last Buy epoch accrual pool (`epochCredPool[lastBuyEpoch]`).
- **Last Buy epoch CHARM:** `epochCharmWad[epoch][user]` and `epochCharmTotal[epoch]` track weight per epoch. On Last Buy hard reset → **`lastBuyEpoch`** increments; prior epoch becomes claimable.
- **`claimCred(epoch)`** (requires `epoch < lastBuyEpoch`): pro-rata share of `epochCredPool[epoch]` by `epochCharmWad`, plus any **`epochFixedCredBonus`**; zeros epoch CHARM weight onchain for that user/epoch.
- **First buy ever** (DOUB or CRED, per wallet): schedules **150 CRED** in **`epochFixedCredBonus[lastBuyEpoch + 1]`** — [#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268).

---

## XP

- Per buy: linear **1–10** XP from min→max CHARM: `xp = 1 + (charmWad - CHARM_MIN) * 9 / (CHARM_MAX - CHARM_MIN)` (integer floor). Library: [`ArenaXp`](../../contracts/src/arena/libraries/ArenaXp.sol); mirror: [`arenaXpMath.ts`](../../frontend/src/lib/arenaXpMath.ts) ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250)).
- Level **L→L+1** threshold: `min(20 + (L-1)×5, 100)` XP — **L1 requires 20 XP** total to reach level 2; steps increase by +5 until **100 XP/level** cap, then flat **100 XP/level** forever.
- Uncapped level; cached **`level`** + **`xpTowardNext`** on buy path ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)). Timer / epoch rolls **do not** reset XP ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250)).

---

## WarBow PvP (DOUB)

| Action | DOUB cost |
|--------|-----------|
| Steal | 1000e18 |
| Guard | 10000e18 |
| Revenge | 1000e18 |
| Steal-limit override (flag) | 50000e18 |
| Flag claim | 0 |

- Steal/guard/revenge/flag mechanics; BP buy bonuses, steal band **2×–10×**, flag plant/claim silence window.
- **WarBow scores reset** when the WarBow timer epoch ends (`rollPodiumEpoch(CAT_WARBOW)` clears live BP podium); indexer retains historical epochs for admin **`finalizeWarbowPodium(epoch, …)`** payout.

---

## Referrals

- **Existing codes preserved** via **`ReferralRegistry`**; registration burn remains **1 CL8Y** for continuity ([#240 open decision #2](#resolved-open-decisions-gitlab-240)).
- On referred **DOUB** buy: **5% CRED to referrer + 5% CRED to buyer**, each computed as **5% of the 35 CRED mint** for that buy — **not** CHARM weight ([#240 open decision #3](#resolved-open-decisions-gitlab-240)). See [referrals.md](referrals.md).

---

## Routes (frontend)

- Primary play route: **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)).
- Legacy **`/arena/*`** redirects to **`/arena/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)).

---

<a id="resolved-open-decisions-gitlab-240"></a>

## Resolved open decisions (GitLab #240)

| # | Question | Resolution |
|---|----------|------------|
| 1 | Revenge DOUB cost | **1000 DOUB** (same as steal) — `WARBOW_REVENGE_DOUB` |
| 2 | Referral registration burn | Keep **1 CL8Y** for existing-code continuity |
| 3 | CRED referral 5% basis | **5% of the 35 CRED mint** per side (`REFERRAL_CRED_BPS = 500`) |
| 4 | Podium settlement trigger | Permissionless **`rollPodiumEpoch(cat)`** after deadline (not auto on first post-expiry buy) |
| 5 | Route naming | **`/arena`** primary; **`/timecurve`** redirect (optional legacy alias) |

---

## Retired v1 surfaces (not Arena v2 behavior)

Do not document or reintroduce as live product rules:

- TimeCurve **`endSale`**, **`redeemCharms`**, linear/bonding CHARM price — [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)
- FeeRouter five-sink CL8Y routing — [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)
- Retired v1 player reserve — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)
- Collectible NFT layer — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)

---

**Agent phase:** [Phase 6 — Product primitives](../agent-phases.md#phase-6) · **Play track:** [Phase 20](../agent-phases.md#phase-20) · **Invariants:** [TimeArena v2](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
