"""Onchain mirrors vs scenario-only approximations for EcoStrategy simulations (GitLab #161).

Cross-links: [`audits/audit_ecostrategy_1777969776.md`](../../audits/audit_ecostrategy_1777969776.md),
[`simulations/README.md`](../README.md), [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md#ecostrategy-audit-scenarios-gitlab-161).
"""

from __future__ import annotations

# ── Mirrored from `contracts/src/TimeCurve.sol` (WarBow ladder) ───────────────
SECONDS_PER_DAY = 86400

WARBOW_STEAL_DRAIN_BPS = 1000  # 10%
WARBOW_STEAL_DRAIN_GUARDED_BPS = 100  # 1%
WARBOW_MAX_STEALS_PER_DAY = 3
WARBOW_REVENGE_WINDOW_SEC = 24 * 3600
WARBOW_GUARD_DURATION_SEC = 6 * 3600

# Buy-path BP increments — kept in sync with `timecurve_sim.model` / `TimeCurve.sol`
WARBOW_BASE_BUY_BP = 250
WARBOW_TIMER_RESET_BONUS_BP = 500
WARBOW_CLUTCH_BONUS_BP = 150
WARBOW_STREAK_BREAK_MULT_BP = 100
WARBOW_AMBUSH_BONUS_BP = 200

# Referral / presale CHARM weight (product narrative — not enforced in `WarBowWorld`)
REFERRAL_REFEREE_BPS = 500  # 5% buyer
REFERRAL_REFERRER_BPS = 500  # 5% referrer
PRESALE_CHARM_WEIGHT_BPS = 1500  # +15% buyer weight when beneficiary

MIRRORED_FROM_CONTRACT = {
    "TimeCurve.WARBOW_STEAL_DRAIN_BPS": WARBOW_STEAL_DRAIN_BPS,
    "TimeCurve.WARBOW_STEAL_DRAIN_GUARDED_BPS": WARBOW_STEAL_DRAIN_GUARDED_BPS,
    "TimeCurve.WARBOW_MAX_STEALS_PER_DAY": WARBOW_MAX_STEALS_PER_DAY,
    "TimeCurve.WARBOW_REVENGE_WINDOW_SEC": WARBOW_REVENGE_WINDOW_SEC,
    "TimeCurve.WARBOW_GUARD_DURATION_SEC": WARBOW_GUARD_DURATION_SEC,
    "TimeCurve — 2× steal eligibility": "victim_bp >= 2 * attacker_bp",
    "ReferralRegistry — CHARM weight add-ons (audit M-01 narrative)": (
        f"+{REFERRAL_REFEREE_BPS / 100:g}% referee + {REFERRAL_REFERRER_BPS / 100:g}% referrer"
    ),
    "DoubPresaleVesting beneficiary — `PRESALE_CHARM_WEIGHT_BPS`": PRESALE_CHARM_WEIGHT_BPS,
}

APPROXIMATIONS_AND_SCENARIO_ONLY = [
    "Poisson arrivals, synthetic wallet budgets, and fixed observation horizons are not onchain.",
    "No mempool ordering: buys and WarBow actions apply in arbitrary intra-tick order inside each dt step.",
    "CL8Y burn budgets for steals/guard/revenge are not modeled; bypass burns when daily caps hit are assumed affordable when `pay_bypass_if_needed` is enabled.",
    "`UTC day` uses `int(timestamp // 86400)` like `block.timestamp / SECONDS_PER_DAY` onchain.",
    "Scenario B stacks referee + referrer + presale bonuses at 125% of paid CHARM for the same buy — models "
    "audit M-01 common-control stacking; not a separate onchain validation.",
]
