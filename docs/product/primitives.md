# Product primitives

## Arena v2 (canonical)

**Time Arena** economics — DOUB buys, four podium timers, 40/30/30 vault routing, epoch CRED, XP, DOUB WarBow — are specified in [`arena-v2.md`](arena-v2.md). Automated invariant map: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md) (section **TimeArena v2** · GitLab [#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).

Epic: [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Documentation cleanup of retired v1 launchpad prose: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263).

## Shared mechanics (still deployed)

### Per-wallet buy cooldown (`TimeArena`)

- **`buyCooldownSec`** is set at **`TimeArena`** initialization (production default **300** seconds; must be **> 0**). After each successful buy, **`nextBuyAllowedAt[buyer] = block.timestamp + buyCooldownSec`**. Reverts with **`TimeArena: buy cooldown`** when too soon.
- **Local `DeployDev` only:** shorten cooldown via **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** and/or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** — [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol), [e2e-anvil.md § #88](../testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88).

### Referrals

[`referrals.md`](referrals.md) — registration burn, link capture, leaderboard, ordering disclosure ([#121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121)).

### Presale vesting

[`DoubPresaleVesting`](../../contracts/src/vesting/DoubPresaleVesting.sol) — schedule and claims; UI at **`/vesting`** ([presale-vesting.md](../frontend/presale-vesting.md), GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)).

## Retired (do not reintroduce in docs or agents)

v1 **TimeCurve** sale lifecycle (`endSale`, `redeemCharms`, `distributePrizes`), **FeeRouter** five-sink CL8Y routing, **Rabbit/Burrow**, **collectible NFT layer** — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244) ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). Contract sources may remain in-tree for history; **Arena v2** is the operator and agent authority.

---

**Agent phase:** [Phase 6](../agent-phases.md#phase-6) · **Play skills:** [`skills/README.md`](../../skills/README.md)
