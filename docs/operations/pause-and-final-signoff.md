# Pause and final signoff (Arena v2)

**Status:** Implemented — Arena v2 uses **`TimeArena.paused`** as the single user-facing money-movement gate ([GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55), [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

**See also:** [Arena v2 DOUB routing](../onchain/fee-routing-and-governance.md) · [final signoff](final-signoff-and-value-movement.md) · [PARAMETERS.md](../../contracts/PARAMETERS.md) · [invariants](../testing/invariants-and-business-logic.md) · [play-time-arena-doub](../../skills/play-time-arena-doub/SKILL.md)

---

## Purpose

Ensure **user-facing token movement** in arena contracts does not proceed until governance is ready, and provide a **single emergency halt** without redeploying.

**Out of scope:** legal/compliance signoff; off-repo CL8Y treasury airdrops; retired v1 player reserve (**`RetiredV1Treasury`**) unless explicitly linked in a migration runbook.

---

## 1) Gated surfaces (Arena v2)

| Path | Contract | What moves | Control |
|------|----------|------------|---------|
| DOUB buy (direct) | `TimeArena.buy` | DOUB → podium vaults + admin vault | **`paused`** |
| CRED buy | `TimeArena.buyWithCred` | Burns CRED; same DOUB routing | **`paused`** |
| ETH / USDm entry | `TimeArenaBuyRouter.buyViaKumbaya` → `buyFor` | Swap → DOUB → arena split | **`paused`** on arena |
| WarBow DOUB spends | `warbowSteal`, `warbowRevenge`, `warbowActivateGuard`, `warbowStealLimitOverride` | DOUB from caller | **`paused`** |
| WarBow flag claim | `claimWarBowFlag` | No DOUB spend | **`paused`** (`_requireLive()` — same gate as buys and WarBow spends) |
| Referral registration | `ReferralRegistry.registerCode` | CL8Y user → burn | Always live |
| Podium roll / WarBow finalize | `rollPodiumEpoch`, `finalizeWarbowPodium` | DOUB vault → winners | Permissionless liveness |

There is **no** separate latch for charm redemption, fee-router distribution, or post-sale CL8Y podium payout — those were retired v1 surfaces ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

---

## 2) Suggested order of operations (example)

Template for operators; exact multisig steps belong in [`deployment-checklist.md`](deployment-checklist.md) per environment.

1. **Bytecode + registry** — Deployed addresses and ABI hashes match audited artifacts.
2. **Indexer + frontend** — Registry keys wired; **`VITE_TIME_ARENA_ADDRESS`** and peers match onchain proxies.
3. **`startArena()`** — Owner starts timers (or **`START_ARENA=1`** at deploy).
4. **Go live** — **`paused == false`**; users can buy and spend DOUB on WarBow actions.
5. **Emergency halt** — Owner **`setPaused(true)`**; frontend disables pay CTAs (**`INV-FRONTEND-264-ARENA-PAY-PAUSE`**).

---

## 3) Contract and test ownership

| Area | Control | Tests / docs |
|------|---------|--------------|
| `TimeArena` | `setPaused`, `startArena`, UUPS | `TimeArena.t.sol`, `DevStackIntegration.t.sol` |
| `TimeArenaBuyRouter` | Optional; inherits arena pause via `buyFor` | `TimeArenaBuyRouter.t.sol`, `verify-time-arena-buy-router-anvil.sh` |
| Indexer / frontend | Reflect `paused` + arena events | `decoder.rs`, `useArenaSaleSession`, E2E `anvil-arena-*.spec.ts` |
| Deploy | `DeployDev` / `DeployProduction` | [`deployment-guide.md`](deployment-guide.md) |

---

## 4) Invariants

- **G1 (explicit gate):** When **`paused`**, gated functions revert; no shadow alternate user pull of the same DOUB in-repo.
- **G2 (observability):** Indexer and frontend distinguish **paused** vs **live** from chain reads.
- **G3 (scope clarity):** Retired v1 **`RetiredV1Treasury`** pause is separate unless a runbook explicitly links it.

---

**Agent / contributor link:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md)

**Participant agents:** [skills index](../../skills/README.md) and [`play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md) — use chain reads for **`paused`** on **`TimeArena`**; do not treat docs as a substitute for deployment state.
