# Arena v2 product primitives

**Status:** Arena v2 replaces the TimeCurve launchpad, Rabbit Treasury / Burrow, Leprechaun NFTs, and the legacy FeeRouter five-sink CL8Y model. Full redeploy; **no backwards compatibility** with v1 addresses.

Parent epic: [GitLab #238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

## Spend asset and buy

- Participants **`buy(charmWad)`** on **`TimeArena`**.
- Payment is **DOUB** (`Doubloon`): `doubOwed = charmWad × charmPriceWad / 1e18`.
- Default **`charmPriceWad = 1000e18`** (1000 DOUB per 1e18 CHARM). Governance may **`setCharmPriceWad`**.
- Ingress uses ERC-20 **balance-delta parity** ([GitLab #123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).

## Last Buy timer

- Reuses [`TimeMath`](../../contracts/src/libraries/TimeMath.sol): **+120s** extension per buy, **13m → 15m** hard-reset band, **24h** initial deadline, **96h** cap (deploy-configurable).
- **`lastBuyEpoch`** increments on each hard reset; emits **`LastBuyEpochStarted`**.
- Arena is **always live** when not **`paused`** — no `endSale`, `redeemCharms`, or linear CL8Y price schedule.

## DOUB prize routing (per buy)

| Destination | Bps | Notes |
|-------------|-----|--------|
| Each of 4 **active** podium pools | 1000 (10% each) | 40% total |
| Each of 4 **seed** podium pools | 750 (7.5% each) | 30% total |
| **`AdminSellVault`** | 3000 (30%) | Remainder from integer split |

Events: **`PodiumFunded`**, **`SeedFunded`**, **`AdminVaultFunded`**.

## Four podium categories

Same v1 reserve categories (last buy, WarBow BP leader, defended streak, time booster). **WarBow PvP on DOUB** returns in [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252); removed in the #241–#245 removal batch.

## Out of scope in this doc (follow-up issues)

- Play CRED ledger, epoch CHARM, claim ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248))
- XP levels ([#250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250))
- **`TimeArenaBuyRouter`** pay rails ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251))
- Indexer arena schema ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))
- Unified frontend ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

## Retired surfaces

- Leprechaun NFT — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)
- Rabbit Treasury / Burrow — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)
- TimeCurve sale-end / redemption / presale / LP seed — [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)
- FeeRouter CL8Y sinks — [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)
