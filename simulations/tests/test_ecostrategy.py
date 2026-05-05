import unittest

from ecostrategy.constants import WARBOW_MAX_STEALS_PER_DAY, WARBOW_STEAL_DRAIN_BPS
from ecostrategy.fee_routing import fee_router_five_shares
from ecostrategy.scenarios import run_scenario_a, run_scenario_b, run_scenario_c, run_scenario_d, run_scenario_e
from ecostrategy.warbow_pvp import (
    WarBowWorld,
    warbow_revenge_drain_bp,
    warbow_steal_drain_bp,
)


class TestWarBowWorld(unittest.TestCase):
    def test_two_x_rule_blocks_steal(self) -> None:
        w = WarBowWorld(3)
        w.bp[0] = 100
        w.bp[1] = 150  # 150 < 2 * 100
        self.assertFalse(w.can_steal(0, 1, 0.0))
        w.bp[1] = 200
        self.assertTrue(w.can_steal(0, 1, 0.0))

    def test_steal_drain_matches_bps(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 50
        w.bp[1] = 2000
        take = warbow_steal_drain_bp(2000, guarded=False)
        self.assertEqual(take, (2000 * WARBOW_STEAL_DRAIN_BPS) // 10_000)
        ok = w.try_steal(0, 1, 1.0)
        self.assertTrue(ok)
        self.assertEqual(w.bp[1], 2000 - take)
        self.assertEqual(w.bp[0], 50 + take)

    def test_guard_reduces_drain(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 100
        w.bp[1] = 1000
        w.try_guard(1, 0.0)
        self.assertTrue(0.0 < w.guard_until[1])
        d_ung = warbow_steal_drain_bp(1000, guarded=False)
        d_g = warbow_steal_drain_bp(1000, guarded=True)
        self.assertLess(d_g, d_ung)

    def test_daily_limit_blocks_without_bypass(self) -> None:
        w = WarBowWorld(3)
        day = WarBowWorld.utc_day(0.0)
        w.steals_committed[(0, day)] = WARBOW_MAX_STEALS_PER_DAY
        w.bp[0] = 100
        w.bp[1] = 400
        self.assertFalse(w.try_steal(0, 1, 0.0, pay_bypass_if_needed=False))

    def test_revenge_moves_bp_from_stealer(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 100
        w.bp[1] = 5000
        w.try_steal(0, 1, 100.0, pay_bypass_if_needed=True)
        sbp_before = w.bp[0]
        take_rev = warbow_revenge_drain_bp(sbp_before)
        self.assertTrue(w.try_revenge(1, 0, 200.0))
        self.assertEqual(w.bp[0], max(0, sbp_before - take_rev))


class TestFeeRouterFiveSinks(unittest.TestCase):
    def test_shares_sum_to_gross_and_rabbit_is_remainder(self) -> None:
        g = 10_000.0
        w = (3000, 4000, 2000, 0, 1000)
        s = fee_router_five_shares(g, w)
        self.assertEqual(len(s), 5)
        self.assertAlmostEqual(sum(s), g, places=9)
        self.assertAlmostEqual(s[0], 3000.0, places=9)
        self.assertAlmostEqual(s[1], 4000.0, places=9)
        self.assertAlmostEqual(s[2], 2000.0, places=9)
        self.assertAlmostEqual(s[3], 0.0, places=9)
        self.assertAlmostEqual(s[4], 1000.0, places=9)

    def test_bps_weights_must_sum_10000(self) -> None:
        with self.assertRaises(ValueError):
            fee_router_five_shares(1.0, (3000, 4000, 2000, 0, 500))


class TestEcoScenarios(unittest.TestCase):
    def test_scenarios_finish_and_b_weight_stack(self) -> None:
        pop = 96
        h = 3600.0
        b = run_scenario_b(seed=7, population=pop, horizon_sec=h)
        a = run_scenario_a(seed=7, population=pop, horizon_sec=h)
        self.assertGreater(float(b.metrics["gini_charm_weight"]), 0.0)
        self.assertGreaterEqual(int(a.metrics["total_buys"]), 0)

    def test_scenario_c_records_pvp_events(self) -> None:
        c = run_scenario_c(seed=1, population=120, horizon_sec=4000.0, steal_prob=0.9)
        self.assertGreaterEqual(int(c.metrics["warbow_steals"]), 0)
        self.assertIn("warbow_flags_planted", c.metrics)

    def test_scenario_d_ordering_branches(self) -> None:
        d = run_scenario_d(seed=3, population=80, horizon_sec=2000.0, plant_flag_prob=0.2)
        self.assertEqual(d.scenario, "D")
        self.assertIn("buy_first_bp_leader_idx", d.metrics)
        self.assertIn("pvp_first_bp_leader_idx", d.metrics)
        self.assertIn("ordering_bp_leader_idx_match", d.metrics)

    def test_scenario_e_receive_fee_books_coverage(self) -> None:
        e = run_scenario_e(seed=11, population=1)
        self.assertEqual(e.scenario, "E")
        self.assertGreater(float(e.metrics["burrow_coverage_delta_receive_minus_direct"]), 0.0)
        self.assertGreater(float(e.metrics["launch_anchor_cl8y_per_charm_at_clearing"]), 0.0)


if __name__ == "__main__":
    unittest.main()
