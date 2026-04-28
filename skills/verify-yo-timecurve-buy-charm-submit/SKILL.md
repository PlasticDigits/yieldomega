---
name: verify-yo-timecurve-buy-charm-submit
description: Manual QA for TimeCurve buy submit-time CHARM sizing (GitLab #82) — fresh bounds read, 99.5% max / 100.5% min margins, CL8Y + single-tx Kumbaya — for agents verifying the Simple and Arena buy panels on a live-ticking chain.
---

# Verify YO TimeCurve buy CHARM submit (issue #82)

Use this after changes to [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts), [`useTimeCurveArenaModel`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx), [`timeCurveBuySubmitSizing.ts`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts), or [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts).

**Authoritative invariants:** [invariants — submit-time CHARM sizing](../../docs/testing/invariants-and-business-logic.md#timecurve-buy-charm-submit-fresh-bounds-issue-82) · [timecurve-views — Buy CHARM fresh bounds](../../docs/frontend/timecurve-views.md#buy-charm-submit-fresh-bounds-issue-82) · [kumbaya.md — single-tx + #82 note](../../docs/integrations/kumbaya.md#issue-65-single-tx-router) · [invariants — Kumbaya swap deadline / Anvil warp (#83)](../../docs/testing/invariants-and-business-logic.md#timecurve-kumbaya-swap-deadline-chain-time-issue-83).

## Preconditions

- **Anvil** (or any chain) with **TimeCurve proxy**, sale **live** (`ended == false`), wallet with **CL8Y** (and **ETH** / **USDM** if testing Kumbaya).
- For **single-tx `buyViaKumbaya`**: deploy **Kumbaya fixtures** and set **`VITE_KUMBAYA_*`** so `timeCurveBuyRouter()` is non-zero (see [`verify-yo-timecurve-buy-router-anvil`](../verify-yo-timecurve-buy-router-anvil/SKILL.md)).

## Checklist

1. **CL8Y direct (`buy`)** — Simple (`/timecurve`) and Arena: drag the slider to a **non-integer** CHARM near the **upper** end of the band; **BUY CHARM** (include an **approve** step if prompted). Expect **success** or a **clear in-panel error**, not a bare **“Execution reverted for an unknown reason”** without follow-up text.
2. **Lower band edge** — Repeat near the **minimum** CHARM (e.g. ~1.0 CHARM on Path A): expect success or clear copy; an occasional **retry** (one block or tiny slider nudge) can still be needed if inclusion drifts past both margins.
3. **ETH (or USDM) single-tx** — Same near-max **and** spot-check near-min CHARM behavior; confirm the tx uses **`charmWad`** consistent with the **post-refresh** band (no revert solely from stale `charmWad` vs `currentCharmBoundsWad`).
4. **Slider vs calldata** — After submit, onchain **CHARM weight** should match **≤** the pre-sign displayed CHARM when the band tightened (slightly **lower** CHARM is acceptable; **invalid** revert from **above max** is not).
5. **Unit tests** — `frontend`: `npx vitest run src/lib/timeCurveBuySubmitSizing.test.ts src/lib/revertMessage.test.ts src/lib/timeCurveKumbayaSwap.test.ts`.
6. **Warped Anvil (optional, #83)** — On a chain where **`anvil_increaseTime`** already ran (e.g. post-**`anvil_rich_state`**), ETH/USDM **single-tx** or **two-step** Kumbaya buy should **not** revert **`AnvilKumbayaRouter` `Expired()`** solely from deadline encoding; if it does, confirm the build includes [#83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83) or follow [kumbaya.md — Option B](../../docs/integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83) (fresh node / `SKIP_ANVIL_RICH_STATE=1` / evidence before warp).

## Agent phase

[Phase 20 — Play / participation](../../docs/agent-phases.md#phase-20) for participant-facing verification; contributors align with [Phase 14 — Testing](../../docs/agent-phases.md#phase-14).
