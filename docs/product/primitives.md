# Product primitives

## Arena v2 (canonical)

**Time Arena** economics — DOUB buys, four podium timers, 100% podium vault routing (25% × 4 · 70/20/10 epoch tranches), epoch CRED, XP, DOUB WarBow — are specified in [`arena-v2.md`](arena-v2.md). Automated invariant map: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md) (section **TimeArena v2** · GitLab [#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).

Epic: [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238). Documentation cleanup of retired v1 launchpad prose: [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263).

## Shared mechanics (still deployed)

### Per-wallet buy energy (`TimeArena`) — GitLab #332

- **`buyChargeIntervalSec`** defaults to **300** seconds: each wallet earns one buy charge every 5 minutes.
- **`maxBuyCharges`** defaults to **5**. A wallet that idles for at least 25 minutes can spend up to five stored moves.
- **`burstBuyCooldownSec`** defaults to **15** seconds and must be **> 0**. A wallet with charges still cannot buy again inside this short gap.
- **`buyEnergyState(buyer)`** is the canonical wallet read for current charges, next charge timestamp, and next allowed buy timestamp. **`nextBuyAllowedAt(buyer)`** is a computed compatibility view. **`buyCooldownSec`** remains as a legacy ABI mirror of the charge interval.
- Reverts: **`TimeArena: no buy charges`** when exhausted, **`TimeArena: burst cooldown`** inside the short gap. Long-run default pacing remains one buy per 5 minutes per wallet.
- **Local `DeployDev` only:** shorten pacing via **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`**, **`YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC`**, **`YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC`**, and/or compatibility **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** — [`DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol), [e2e-anvil.md § #88](../testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88).

### Referrals

[`referrals.md`](referrals.md) — registration burn, link capture, leaderboard, ordering disclosure ([#121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121)).

### Presale vesting

[`DoubPresaleVesting`](../../contracts/src/vesting/DoubPresaleVesting.sol) — schedule and claims; UI at **`/vesting`** ([presale-vesting.md](../frontend/presale-vesting.md), GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)).

## Retired (do not reintroduce in docs or agents)

v1 launchpad sale lifecycle (`endSale`, `redeemCharms`, `distributePrizes`), five-sink CL8Y routing, **Rabbit/Burrow**, **collectible NFT layer** — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244) ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). Contract sources may remain in-tree for history; **Arena v2** is the operator and agent authority.

---

**Agent phase:** [Phase 6](../agent-phases.md#phase-6) · **Play skills:** [`skills/README.md`](../../skills/README.md)
