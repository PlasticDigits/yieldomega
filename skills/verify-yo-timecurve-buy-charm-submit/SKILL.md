---
name: verify-yo-timecurve-buy-charm-submit
description: Manual QA for TimeCurve buy submit-time CHARM sizing (GitLab #82) — fresh bounds read, 99.5% max slack, CL8Y + single-tx Kumbaya — for agents verifying the Simple and Arena buy panels on a live-ticking chain.
---

# Verify YO TimeCurve buy CHARM submit (issue #82)

Use this after changes to [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts), [`useTimeCurveArenaModel`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx), [`timeCurveBuySubmitSizing.ts`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts), or [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts).

**Authoritative invariants:** [invariants — submit-time CHARM sizing](../../docs/testing/invariants-and-business-logic.md#timecurve-buy-charm-submit-fresh-bounds-issue-82) · [timecurve-views — Buy CHARM fresh bounds](../../docs/frontend/timecurve-views.md#buy-charm-submit-fresh-bounds-issue-82) · [kumbaya.md — single-tx + #82 note](../../docs/integrations/kumbaya.md#issue-65-single-tx-router).

## Preconditions

- **Anvil** (or any chain) with **TimeCurve proxy**, sale **live** (`ended == false`), wallet with **CL8Y** (and **ETH** / **USDM** if testing Kumbaya).
- For **single-tx `buyViaKumbaya`**: deploy **Kumbaya fixtures** and set **`VITE_KUMBAYA_*`** so `timeCurveBuyRouter()` is non-zero (see [`verify-yo-timecurve-buy-router-anvil`](../verify-yo-timecurve-buy-router-anvil/SKILL.md)).

## Checklist

1. **CL8Y direct (`buy`)** — Simple (`/timecurve`) and Arena: drag the slider to a **non-integer** CHARM near the **upper** end of the band; **BUY CHARM** (include an **approve** step if prompted). Expect **success** or a **clear in-panel error**, not a bare **“Execution reverted for an unknown reason”** without follow-up text.
2. **ETH (or USDM) single-tx** — Same near-max CHARM behavior; confirm the tx uses **`charmWad`** consistent with the **post-refresh** band (no revert solely from stale `charmWad` vs `currentCharmBoundsWad`).
3. **Slider vs calldata** — After submit, onchain **CHARM weight** should match **≤** the pre-sign displayed CHARM when the band tightened (slightly **lower** CHARM is acceptable; **invalid** revert from **above max** is not).
4. **Unit tests** — `frontend`: `npx vitest run src/lib/timeCurveBuySubmitSizing.test.ts src/lib/revertMessage.test.ts`.

## Agent phase

[Phase 20 — Play / participation](../../docs/agent-phases.md#phase-20) for participant-facing verification; contributors align with [Phase 14 — Testing](../../docs/agent-phases.md#phase-14).
