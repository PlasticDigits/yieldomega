---
name: verify-yo-timecurve-stake-redeemed-ui
description: Verify TimeCurve Simple "Your stake at launch" after redeemCharms (GitLab #90) — redeemed DOUB row, struck CL8Y projection, Settled header chrome; rejects misleading DOUB-only replacement for "worth at launch".
---

# Verify — TimeCurve Simple stake panel after redemption (issue #90)

Use after changes to [`TimeCurveStakeAtLaunchSection`](../../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.tsx), [`useTimeCurveSaleSession`](../../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts), or related CSS (`timecurve-simple__stake-*`).

## Preconditions

- Wallet has **`charmWeight > 0`**, sale **ended** (`endSale()`), **`charmRedemptionEnabled`** true ([issue #55](../../../docs/operations/final-signoff-and-value-movement.md)).
- Call **`redeemCharms()`** successfully so **`charmsRedeemed(wallet) === true`** (DOUB received).

## Checklist

1. Navigate to **`/timecurve`** (Simple). **Settlement** CTA reads **Already redeemed** (existing behavior).
2. **Your stake at launch** shows **Settled** badge + green check in the **section header** (right side, `section-heading__actions`).
3. **Redeemed** row lists **DOUB** amount consistent with onchain formula **`totalTokensForSale × charmWeight ÷ totalCharmWeight`** (compare Protocol raw reads or wallet DOUB delta at redeem tx — rounding must match contract integer division).
4. **Worth at launch ≈** CL8Y value is **dimmed / struck through** and labeled **(redeemed)** — the historical CL8Y projection remains visible as context; it must **not** be replaced by DOUB-only copy as “worth at launch” (mixed CL8Y / ETH / USDM pay rails — see [issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90)).
5. Optional: **`data-testid="timecurve-simple-stake-redeemed-doub"`** present when redeemed.

## Evidence + docs

- Frontend spec: [`docs/frontend/timecurve-views.md`](../../../docs/frontend/timecurve-views.md#timecurve-simple-stake-redeemed-issue-90)
- Invariants map: [`docs/testing/invariants-and-business-logic.md`](../../../docs/testing/invariants-and-business-logic.md#timecurve-simple-stake-redeemed-issue-90)
- Unit tests: [`frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx`](../../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx)
