"""Tests for TimeCurve duration simulation (timer runs to completion)."""

from __future__ import annotations

import random
import unittest

from timecurve_sim.duration_study import (
    RAISE_MILESTONES,
    deploy_dev_params,
    run_sale_to_completion,
    run_sale_with_raise_milestones,
)
from timecurve_sim.model import TimeCurveParams


class TestDurationStudy(unittest.TestCase):
    def test_no_arrivals_ends_at_initial_timer(self) -> None:
        p = TimeCurveParams(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            purchase_cap_mult=10.0,
            extension_sec=60.0,
            timer_cap_from_now_sec=96 * 3600.0,
            initial_timer_sec=3600.0,
        )
        rng = random.Random(0)
        o = run_sale_to_completion(p, rng=rng, arrival_rate=0.0, dt_sec=1.0, population=10)
        self.assertEqual(o.total_buys, 0)
        self.assertAlmostEqual(o.duration_sec, 3600.0, delta=2.0)

    def test_raise_milestones_order(self) -> None:
        rng = __import__("random").Random(123)
        p = deploy_dev_params()
        t = run_sale_with_raise_milestones(
            p,
            rng=rng,
            dt_sec=30.0,
            arrival_rate=0.2,
            budget_scale=5.0,
            max_wall_sec=86400.0 * 30.0,
        )
        prev = -1.0
        for m in RAISE_MILESTONES:
            ts = t.first_crossing_sec.get(m)
            if ts is not None:
                self.assertGreaterEqual(ts, prev)
                prev = ts

    def test_deploy_dev_params_positive(self) -> None:
        p = deploy_dev_params()
        self.assertEqual(p.min_buy_0, 1.0)
        self.assertEqual(p.initial_timer_sec, 86400.0)
        self.assertEqual(p.extension_sec, 120.0)
        self.assertEqual(p.timer_cap_from_now_sec, 96 * 3600.0)


if __name__ == "__main__":
    unittest.main()
