---
name: yieldomega-guardrails
description: Apply Yieldomega repository guardrails for agent work. Arena v2 — read arena spec, keep logic onchain, AGPL, testing strategy, indexer ingest, wallet modal.
---

# Yieldomega guardrails (Arena v2)

Before substantive changes in this repository:

1. Read `docs/agent-phases.md` for the matching phase, then [`docs/product/time-arena.md`](../../docs/product/time-arena.md) (canonical Arena v2 spec · [#240](https://gitlab.com/PlasticDigits/yieldomega/-/issues/240)) and [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md) for implementation detail. Contributor invariants: [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md) (Arena v2 only — legacy TimeCurve/FeeRouter docs removed [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263)).
2. Respect `LICENSE` and `docs/licensing.md` (AGPL-3.0 default).
3. **Onchain authority:** `TimeArena`, `PodiumVaults`, `AdminSellVault`, `Doubloon`, `ReferralRegistry`. Indexer and frontend are derived only.
4. **Testing:** Follow `docs/testing/strategy.md`; run relevant `forge test`, `cargo test`, and frontend tests when touching each layer.
5. **Indexer:** One SQL transaction per block ([#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140)); decode/persist arena `Buy` / `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` when registry includes `TimeArena`. Production env guards ([#142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142), [#156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156)).
6. **DOUB buy routing:** 40% active + 30% seed + 30% admin per buy — [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol); Forge `ArenaPrizeRouting.t.sol` / `TimeArena.t.sol`.
6a. **Manual podium top-up ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)):** `topUpPodiumPools` — 100% to eight prize vaults (10:7.5 active:seed per category), **no** admin take; **`PodiumPoolsToppedUp`**; indexer [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262).
6b. **XP buy gas ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)):** cached `level` + `xpTowardNext`; max 5 level-ups/buy; timer epoch rolls must not clear progression — [`ArenaXp.applyXpGain`](../../contracts/src/arena/libraries/ArenaXp.sol).
6c. **CRED buy + first-buy bonus ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)):** `buyWithCred` burns `charmWad × 100e18 / 1e18`; first `_finishBuy` per wallet schedules **150 CRED** in `epochFixedCredBonus[lastBuyEpoch+1]`; `pendingCred` / `claimCred` include fixed bonus.
7. **ERC-20 ingress:** Balance-delta parity on DOUB pulls ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
8. **DeployDev / DeployProduction:** Arena v2 scripts — [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol), [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol); registry + ops ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)).
9. **Frontend env:** `VITE_TIME_ARENA_ADDRESS`, `VITE_PODIUM_VAULTS_ADDRESS`, `VITE_ADMIN_SELL_VAULT_ADDRESS`; primary route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)); indexer **`GET /v1/arena/*`** ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).
9b. **CRED buy UI ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)):** `buyWithCred` via pay picker; burn from onchain `CRED_PER_CHARM_WAD` — [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts); optional `VITE_PLAY_CRED_ADDRESS`.
10. **Wallet / chain:** Single-chain wagmi ([#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)); wrong-network write gating ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)).
11. **Bots:** [`bots/timearena/`](../../bots/timearena/README.md) — retarget to `TimeArena` proxy; venv + PEP 668 per README.
12. **Retired (do not reintroduce):** Collectible NFT layer ([#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)), Rabbit/Burrow ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)), TimeCurve sale-end/redemption/presale ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)), FeeRouter five-sink CL8Y ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). WarBow returns in [#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252).

Play skills (participants): [`skills/README.md`](../../skills/README.md) — `play-active-time-arena`, `play-time-arena-doub`, `play-time-arena-warbow`.

Prefer small, reviewable diffs.
