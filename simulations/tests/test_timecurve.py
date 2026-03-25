"""Unit tests for TimeCurve simulation mechanics."""

from __future__ import annotations

import unittest

from timecurve_sim.model import (
    TimeCurveParams,
    canonical_timecurve_params,
    clamp_spend,
    min_buy_at,
    next_sale_end,
)


def _sample_params(**kwargs: float) -> TimeCurveParams:
    defaults = dict(
        daily_growth_frac=0.01,
        min_buy_0=10.0,
        purchase_cap_mult=10.0,
        extension_sec=120.0,
        timer_cap_from_now_sec=96 * 3600.0,
        initial_timer_sec=3600.0,
    )
    defaults.update(kwargs)
    return TimeCurveParams(**defaults)  # type: ignore[arg-type]


class TestTimeCurveModel(unittest.TestCase):
    def test_min_buy_monotone(self) -> None:
        p = _sample_params()
        a = min_buy_at(0.0, p)
        b = min_buy_at(86400.0, p)
        c = min_buy_at(10 * 86400.0, p)
        self.assertAlmostEqual(a, 10.0)
        self.assertGreater(b, a)
        self.assertGreater(c, b)

    def test_daily_growth_25_percent(self) -> None:
        p = _sample_params(daily_growth_frac=0.25, min_buy_0=100.0)
        one_day = min_buy_at(86400.0, p)
        self.assertAlmostEqual(one_day, 125.0, places=6)

    def test_next_sale_end_cap(self) -> None:
        p = _sample_params(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            purchase_cap_mult=10.0,
            extension_sec=3600.0,
            timer_cap_from_now_sec=7200.0,
            initial_timer_sec=1000.0,
        )
        now = 100.0
        end = 500.0
        new_end = next_sale_end(now, end, p)
        self.assertLessEqual(new_end, now + p.timer_cap_from_now_sec)
        self.assertGreater(new_end, end)

    def test_clamp_spend_continuous(self) -> None:
        p = _sample_params(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            purchase_cap_mult=5.0,
            extension_sec=120.0,
            timer_cap_from_now_sec=3600.0,
            initial_timer_sec=600.0,
        )
        t = 0.0
        x = clamp_spend(3.7, t, p)
        self.assertAlmostEqual(x, 3.7)
        y = clamp_spend(100.0, t, p)
        self.assertAlmostEqual(y, 5.0)

    def test_canonical_params_match_deploy_docs(self) -> None:
        p = canonical_timecurve_params()
        self.assertEqual(p.extension_sec, 120.0)
        self.assertEqual(p.initial_timer_sec, 86400.0)
        self.assertEqual(p.timer_cap_from_now_sec, 96 * 3600.0)
        self.assertAlmostEqual(p.daily_growth_frac, 0.25)

    def test_hybrid_early_leg_linear(self) -> None:
        p = TimeCurveParams(
            daily_growth_frac=0.25,
            min_buy_0=1.0,
            purchase_cap_mult=10.0,
            extension_sec=120.0,
            timer_cap_from_now_sec=96 * 3600.0,
            initial_timer_sec=86400.0,
            hybrid_linear_days=4.0,
            hybrid_tail_daily_frac=0.40,
        )
        self.assertAlmostEqual(min_buy_at(2 * 86400.0, p), 1.5)
        self.assertAlmostEqual(min_buy_at(4 * 86400.0, p), 2.0)


if __name__ == "__main__":
    unittest.main()
