"""Raise milestone tracking."""

from __future__ import annotations

import random
import unittest

from timecurve_sim.model import TimeCurveParams
from timecurve_sim.raise_milestone_sim import RAISE_MILESTONES, aggregate_runs, run_sale_tracked


class TestRaiseMilestone(unittest.TestCase):
    def test_no_buys_no_milestones(self) -> None:
        p = TimeCurveParams(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            purchase_cap_mult=10.0,
            extension_sec=120.0,
            timer_cap_from_now_sec=96 * 3600.0,
            initial_timer_sec=3600.0,
        )
        rng = random.Random(0)
        o = run_sale_tracked(p, rng=rng, arrival_rate=0.0, dt_sec=1.0, population=5, num_day_buckets=5)
        self.assertEqual(o.total_buys, 0)
        self.assertEqual(o.total_raised, 0.0)
        for m in RAISE_MILESTONES:
            self.assertIsNone(o.milestone_first_sec[m])

    def test_aggregate_empty(self) -> None:
        self.assertEqual(aggregate_runs([])["num_seeds"], 0)


if __name__ == "__main__":
    unittest.main()
