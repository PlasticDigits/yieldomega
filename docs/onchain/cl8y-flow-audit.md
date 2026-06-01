# CL8Y flow audit — retired (v1 historical)

> **Retired:** This audit covered **retired v1** launchpad / five-sink **CL8Y** paths removed in [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243) / [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244). **Arena v2** arena economics use **DOUB** buys and vault splits, not in-app CL8Y fee routing. Historical findings (2026-05) enumerated public fee distribution, launchpad CL8Y ingress, and podium CL8Y payouts — hardened in [#70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70), [#117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117), [#122](https://gitlab.com/PlasticDigits/yieldomega/-/issues/122); full audit text in git history before [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274).

**Canonical Arena v2 routing:** [fee-routing-and-governance.md](fee-routing-and-governance.md) — 40% active + 30% seed + 30% admin per **`TimeArena.buy`**.

**Remaining CL8Y touchpoints (production):**

| Surface | Role |
|---------|------|
| **`ReferralRegistry.registerCode`** | User CL8Y → burn (not app-custodied) |
| **`TimeArenaBuyRouter.buyViaKumbaya`** | Kumbaya swap uses reserve CL8Y as `exactOutput` token; post-swap DOUB enters **`TimeArena`** ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)) |
| **External CL8Y / USDM** | **`AdminSellVault.sellDoubToUsdm`** — owner-only DOUB → USDM liquidation |
