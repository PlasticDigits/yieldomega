# Pause and final signoff before DOUB claims and CL8Y distribution

**Status:** Design and inventory (GitLab [#55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)) — this document records **gated operations**, **proposed** policy defaults for implementation planning, and **order-of-operations** checklists. **Onchain code changes** are tracked via follow-up issues/MRs, not in #55.

**See also:** [Fee routing and governance — authority](../onchain/fee-routing-and-governance.md) · [PARAMETERS.md](../../contracts/PARAMETERS.md) · [Testing invariants — pause / signoff](../testing/invariants-and-business-logic.md#pause-and-final-signoff-design-gitlab-55) · [play-timecurve-doubloon — participant messaging](../../skills/README.md)

---

## Purpose

Add an **onchain and/or operational** gate so that, for **CL8Y and DOUB issuance and distribution** in this repository’s contracts, the system does **not** complete **user-facing money movement** (tokens leaving treasury-like contracts to end users) until a **defined final signoff** (multisig, timelock, or explicit onchain call) is recorded.

**Out of scope for “signoff” in this design doc:** governance politicking; legal/compliance signoff; anything not represented by a **deployed** role or **documented** operational checklist step.

---

## 1) Gated surfaces (inventory)

The following tables name **what can move value**, **where**, and **repo-proposed** treatment for a future implementation. Rows marked **TBD (product)** need an explicit product decision before coding.

### DOUB — user-facing claims

| Path | Contract | What moves | Proposed default (pending governance) | Open if different |
|------|----------|------------|----------------------------------------|-------------------|
| Presale vesting | `DoubPresaleVesting` — `claim()` | DOUB → beneficiaries | **Two-step money path:** (1) ops fund contract + `startVesting()` (vesting clock); (2) **separate** signoff **unblocks `claim()`** (e.g. `Pausable` on `claim` only, or `claimsEnabled` after multisig). | Signoff *before* `startVesting` only (no clock until funded + approved) is stricter; document if chosen. |
| CHARM → DOUB (sale) | `TimeCurve` — `redeemCharms()` | DOUB → buyers after `endSale` | **Same policy class as presale** (no user DOUB until final signoff), but **independent** onchain control (different contract / timelock). | Join presale and redemption to **one** multisig “distribution live” if product prefers a single switch. |

### CL8Y — “distribution” (several meanings)

| Path | Where | What moves | Proposed default (pending product) | Open if different |
|------|-------|------------|-------------------------------------|-------------------|
| Per-buy fee routing | `TimeCurve.buy` → `FeeRouter` → sinks | CL8Y from buyers to LP, burn, `PodiumPool`, Rabbit, etc. | **TBD (product):** (A) **Pause all `buy`** while CL8Y routing is disallowed, or (B) allow buys but **pause subset of sinks** / router (only if design prevents bypass and ordering grief). | If sale must stay open, document which sinks are still allowed and how rounding/remainder is handled. |
| Podium (reserve prizes) | `TimeCurve.distributePrizes()` | CL8Y from `PodiumPool` to winners | **In the signoff set** for “no CL8Y to winners until signoff” — gate this call or the underlying reserve payout path. | If prizes may pay before other gates, document exception explicitly. |
| CL8Y token / DAO treasury | External / out of repo | Genesis, airdrops, team unlocks | **Out of this repo** unless a contract is added; document in deploy runbooks only. | N/A here |

**Rabbit Treasury** (`RabbitTreasury`) already uses **`Pausable`** for **deposit/withdraw** — a **separate** concern from TimeCurve presale/DOUB redemption/CL8Y podium **unless** product folds Burrow into the same “go-live” ceremony. State **in** or **out** in the mainnet runbook when cutting implementation.

---

## 2) Authoritative signoff — suggested order of operations (example)

This is a **template** for operators; **actual** multisig names and block heights belong in [`stage3-mainnet-operator-runbook.md`](stage3-mainnet-operator-runbook.md) and [`deployment-checklist.md`](deployment-checklist.md) per environment.

1. **Bytecode + registry** — Deployed addresses and **ABI hashes** match audited artifacts ([`export_abi_hashes.sh`](../../contracts/script/export_abi_hashes.sh)).
2. **DOUB positioning** — TimeCurve sale bucket, `DoubPresaleVesting` funding, LP seed per [`PARAMETERS.md`](../../contracts/PARAMETERS.md) and [`launchplan-timecurve.md`](../../launchplan-timecurve.md).
3. **Start vesting (optional early)** — `DoubPresaleVesting.startVesting()` if policy allows the **clock** to start before user claims (see table above).
4. **Final signoff (governance event)** — Record onchain: e.g. timelock execution, `unpause` / `enableClaims` / `enableDistribution` / `unpause` TimeCurve, as designed in follow-up implementation.
5. **User-facing money movement** — `claim()`, `redeemCharms()`, `distributePrizes()` (and `buy` if unpaused) per deploy configuration.

**Invariant (design):** For any gated path, **read-only** views and **events** should allow indexers/frontend to show **“awaiting final signoff”** vs **live** (exact fields/events are implementation work).

---

## 3) Contract and test ownership (for implementation MRs)

| Area | Likely work | Tests / docs to extend |
|------|-------------|-------------------------|
| `DoubPresaleVesting` | Pause/flag on `claim` only, or `claimsEnabled` + role | `DoubPresaleVesting.t.sol`, [invariants](../testing/invariants-and-business-logic.md#doubpresalevesting) |
| `TimeCurve` | Scoped `Pausable` or latches for `buy` / `redeemCharms` / `distributePrizes` | `TimeCurve.t.sol`, `TimeCurveInvariant.t.sol` |
| `FeeRouter` + sinks | Only if “pause routing without pausing all of TimeCurve” | `FeeRouter*.t.sol`, security review for bypass |
| Indexer / frontend | New events/fields | `decoder.rs`, `persist.rs`, `useTimeCurveSaleSession`, ABIs |
| Deploy | Initial paused state, roles | `DeployDev.s.sol` pattern, `deployments/*.json` |

---

## 4) Suggested child deliverables (GitLab / MR scope)

When implementation starts, split work so each MR has clear ownership:

1. **Contracts + Foundry** — Gate behavior + invariants in `invariants-and-business-logic.md`.
2. **Indexer + frontend** — User-visible “paused / await signoff” and failed-tx copy.
3. **Ops** — Update [`stage3-mainnet-operator-runbook.md`](stage3-mainnet-operator-runbook.md) with the exact mainnet sequence.

---

## 5) Invariants (design time)

These **must** hold after implementation; they are also listed in [testing invariants — pause / signoff](../testing/invariants-and-business-logic.md#pause-and-final-signoff-design-gitlab-55).

- **G1 (explicit gate):** No gated function completes user-facing token transfer without the designed **signoff** state (revert or zero payout).
- **G2 (no shadow mint):** Pausing `claim` / `redeemCharms` / prize payout does **not** create alternate user pulls of the same DOUB/CL8Y in-repo without a documented path.
- **G3 (observability):** Indexer-backed UX can distinguish **“not started”** vs **“awaiting signoff”** vs **“live”** from chain (or from documented events + storage).
- **G4 (scope clarity):** `RabbitTreasury` deposit/withdraw pause is **separate** unless explicitly linked in the runbook.
- **G5 (fee bypass):** If only **subset** of fee sinks is pausable, the design document **bypass and ordering** risks in `FeeRouter` (see [#55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55) §2).

---

**Agent / contributor link:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) (pause/signoff and testing expectations).

**Participant agents:** [skills index](../../skills/README.md) and [`play-timecurve-doubloon`](../../skills/play-timecurve-doubloon/SKILL.md) — use chain reads for pause/signoff; do not treat docs as a substitute for deployment state.
