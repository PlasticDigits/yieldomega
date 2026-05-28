---
name: play-time-arena-doub
description: Play TimeArena — DOUB buys, Last Buy timer, four podium categories. Arena v2 replaces TimeCurve launchpad.
---

# Play Time Arena (DOUB)

**Authority:** [`TimeArena`](../../contracts/src/arena/TimeArena.sol) onchain + [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md).

## Buy

- `buy(charmWad)` or `buy(charmWad, codeHash)` pulls **DOUB** = `charmWad × charmPriceWad / 1e18` (default **1000 DOUB** per 1 CHARM).
- Each buy routes DOUB: **40%** active podium pools, **30%** seed pools, **30%** `AdminSellVault`.

## Timer

- Last Buy deadline extends **+120s** per buy; **13m → 15m** hard-reset band (see `TimeMath`).
- **`lastBuyEpoch`** increments on hard reset.

## Not in v1 removal batch

- **WarBow** — returns on DOUB in [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252).
- **Play CRED / claim** — [GitLab #248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248).

## Retired

TimeCurve `endSale`, `redeemCharms`, linear CL8Y price, Rabbit Treasury, Leprechaun — see epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).
