---
name: yieldomega-guardrails
description: Apply Yieldomega repository guardrails for agent work. Arena v2 — read arena spec, keep logic onchain, AGPL, testing strategy, indexer ingest, wallet modal.
---

# Yieldomega guardrails (Arena v2)

Before substantive changes in this repository:

1. Read `docs/agent-phases.md` for the matching phase, then [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md) for Arena v2 economics (epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238)). Contributor invariants: [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md) (Arena v2 only — legacy TimeCurve/FeeRouter docs removed [#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263)).
2. Respect `LICENSE` and `docs/licensing.md` (AGPL-3.0 default).
3. **Onchain authority:** `TimeArena`, `PodiumVaults`, `AdminSellVault`, `Doubloon`, `ReferralRegistry`. Indexer and frontend are derived only.
4. **Testing:** Follow `docs/testing/strategy.md`; run relevant `forge test`, `cargo test`, and frontend tests when touching each layer.
5. **Indexer:** One SQL transaction per block ([#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140)); decode/persist arena `Buy` / `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` when registry includes `TimeArena`. Production env guards ([#142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142), [#156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156)).
6. **DOUB buy routing:** 40% active + 30% seed + 30% admin per buy — [`ArenaBuyRouting`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol); Forge `ArenaPrizeRouting.t.sol` / `TimeArena.t.sol`.
6b. **XP buy gas ([#265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265)):** cached `level` + `xpTowardNext`; max 5 level-ups/buy; timer epoch rolls must not clear progression — [`ArenaXp.applyXpGain`](../../contracts/src/arena/libraries/ArenaXp.sol).
7. **ERC-20 ingress:** Balance-delta parity on DOUB pulls ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
8. **DeployDev:** [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) deploys `TimeArena` + vaults only (no Leprechaun, Rabbit, FeeRouter, TimeCurve launchpad). Dev chain allowlist [#141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141).
9. **Frontend env:** `VITE_TIME_ARENA_ADDRESS`, `VITE_PODIUM_VAULTS_ADDRESS`, `VITE_ADMIN_SELL_VAULT_ADDRESS`; primary route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)); indexer **`GET /v1/arena/*`** ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).
10. **Wallet / chain:** Single-chain wagmi ([#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)); wrong-network write gating ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)).
11. **Bots:** [`bots/timearena/`](../../bots/timearena/README.md) — retarget to `TimeArena` proxy; venv + PEP 668 per README.
12. **Retired (do not reintroduce):** Leprechaun ([#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)), Rabbit/Burrow ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)), TimeCurve sale-end/redemption/presale ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)), FeeRouter five-sink CL8Y ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). WarBow returns in [#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252).

Play skills (participants): [`skills/README.md`](../../skills/README.md) — `play-active-time-arena`, `play-time-arena-doub`, `play-time-arena-warbow`.

Prefer small, reviewable diffs.
