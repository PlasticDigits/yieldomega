"""Unit tests for TimeCurve simulation mechanics."""

from __future__ import annotations

import unittest

from timecurve_sim.model import (
    TimeCurveParams,
    canonical_timecurve_params,
    clamp_spend,
    extend_deadline_or_reset_below_threshold,
    min_buy_at,
    next_sale_end,
    process_defended_streak_sim,
    warbow_buy_bp_delta,
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

    def test_extend_deadline_or_reset_below_13m(self) -> None:
        p = _sample_params(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            extension_sec=120.0,
            timer_cap_from_now_sec=96 * 3600.0,
            initial_timer_sec=3600.0,
        )
        now = 1_000.0
        end = now + 600.0  # 10m remaining → hard reset toward 15m
        new_end, did_hard = extend_deadline_or_reset_below_threshold(now, end, p)
        self.assertTrue(did_hard)
        self.assertAlmostEqual(new_end, now + 900.0)

    def test_extend_deadline_above_13m_extends(self) -> None:
        p = _sample_params(
            daily_growth_frac=0.0,
            min_buy_0=1.0,
            extension_sec=120.0,
            timer_cap_from_now_sec=96 * 3600.0,
            initial_timer_sec=3600.0,
        )
        now = 1_000.0
        end = now + 800.0  # > 13m remaining… 800 > 780? 800 is 13m20s - actually 800 > 780 so extend branch
        new_end, did_hard = extend_deadline_or_reset_below_threshold(now, end, p)
        self.assertFalse(did_hard)
        self.assertAlmostEqual(new_end, end + 120.0)

    def test_warbow_buy_bp_delta_base_and_clutch(self) -> None:
        active = [0, 0, 0]
        sb, amb, rest = warbow_buy_bp_delta(
            25.0, False, ds_last_idx=None, active_streak=active, buyer_idx=0
        )
        self.assertEqual(sb, 0)
        self.assertEqual(amb, 0)
        self.assertEqual(rest, 250 + 150)  # base + clutch (<30s)

    def test_process_defended_streak_increments_same_wallet(self) -> None:
        active = [0, 0]
        best = [0, 0]
        ds = process_defended_streak_sim(
            0, 100.0, 50.0, None, active, best
        )
        self.assertEqual(ds, 0)
        self.assertEqual(active[0], 1)
        ds2 = process_defended_streak_sim(
            0, 100.0, 40.0, 0, active, best
        )
        self.assertEqual(ds2, 0)
        self.assertEqual(active[0], 2)


if __name__ == "__main__":
    unittest.main()
