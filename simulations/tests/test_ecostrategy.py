import random
import unittest
from dataclasses import replace

from ecostrategy.constants import (
    SECONDS_PER_DAY,
    WARBOW_FLAG_CLAIM_BP,
    WARBOW_FLAG_SILENCE_SEC,
    WARBOW_MAX_STEALS_PER_DAY,
    WARBOW_STEAL_DRAIN_BPS,
)
from ecostrategy.fee_routing import fee_router_five_shares
from ecostrategy.scenarios import (
    _simulate_sale,
    run_scenario_a,
    run_scenario_b,
    run_scenario_c,
    run_scenario_d,
    run_scenario_e,
    run_scenario_f,
)
from ecostrategy.warbow_pvp import (
    WarBowWorld,
    warbow_revenge_drain_bp,
    warbow_steal_drain_bp,
)
from timecurve_sim.model import canonical_timecurve_params


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

    def test_utc_rollover_fourth_steal_without_bypass(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 100
        w.bp[1] = 10_000
        t0 = float(SECONDS_PER_DAY) - 1.0
        for _ in range(3):
            self.assertTrue(w.try_steal(0, 1, t0, pay_bypass_if_needed=False))
        self.assertFalse(w.try_steal(0, 1, t0, pay_bypass_if_needed=False))
        t1 = float(SECONDS_PER_DAY)
        self.assertTrue(w.try_steal(0, 1, t1, pay_bypass_if_needed=False))

    def test_flag_interrupt_after_silence_applies_penalty(self) -> None:
        w = WarBowWorld(3)
        w.bp[0] = 5000
        w.bp[1] = 200
        w.plant_flag_after_buy(0, 0.0, True)
        t = float(WARBOW_FLAG_SILENCE_SEC) + 1.0
        pen = w.apply_interrupting_buy(1, t)
        self.assertEqual(pen, WARBOW_FLAG_CLAIM_BP * 2)
        self.assertEqual(w.flag_penalties_applied, 1)

    def test_flag_interrupt_before_silence_clears_without_penalty(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 5000
        w.plant_flag_after_buy(0, 0.0, True)
        pen = w.apply_interrupting_buy(1, 10.0)
        self.assertEqual(pen, 0)
        self.assertEqual(w.flag_penalties_applied, 0)
        self.assertIsNone(w.pending_flag_owner)

    def test_flag_claim_awards_bp(self) -> None:
        w = WarBowWorld(2)
        w.bp[0] = 100
        w.plant_flag_after_buy(0, 0.0, True)
        self.assertTrue(w.try_claim_flag(0, float(WARBOW_FLAG_SILENCE_SEC) + 0.1))
        self.assertEqual(w.bp[0], 100 + WARBOW_FLAG_CLAIM_BP)
        self.assertEqual(w.flag_claims_succeeded, 1)


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
        # Paired runs must not share one after_tick closure (GitLab #169): guard_once leader_guarded is per-run.
        self.assertEqual(
            int(d.metrics["buy_first_warbow_guards"]),
            int(d.metrics["pvp_first_warbow_guards"]),
        )

    def test_scenario_d_warbow_guards_parity_seed_42(self) -> None:
        """Regression: shared after_tick used to leave pvp_first with zero guards (issue #169)."""
        d = run_scenario_d(seed=42, population=240, horizon_sec=28_800.0)
        self.assertEqual(
            int(d.metrics["buy_first_warbow_guards"]),
            int(d.metrics["pvp_first_warbow_guards"]),
        )

    def test_scenario_e_receive_fee_books_coverage(self) -> None:
        e = run_scenario_e(seed=11, population=1)
        self.assertEqual(e.scenario, "E")
        self.assertGreater(float(e.metrics["burrow_coverage_delta_receive_minus_direct"]), 0.0)
        self.assertGreater(float(e.metrics["launch_anchor_cl8y_per_charm_at_clearing"]), 0.0)

    def test_simulate_sale_buy_cooldown_reduces_buys_vs_short_cooldown(self) -> None:
        seed = 9
        short = replace(canonical_timecurve_params(), buy_cooldown_sec=1.0)
        long_cd = replace(canonical_timecurve_params(), buy_cooldown_sec=10_000.0)
        m_short = _simulate_sale(
            short,
            random.Random(seed),
            population=40,
            dt_sec=5.0,
            arrival_rate=0.35,
            horizon_sec=8000.0,
            max_steps=50_000,
            whale_frac=0.1,
            small_frac=0.6,
            world=WarBowWorld(40),
            charm_weight_mult=lambda _i: 1.0,
            after_tick=None,
        )
        m_long = _simulate_sale(
            long_cd,
            random.Random(seed),
            population=40,
            dt_sec=5.0,
            arrival_rate=0.35,
            horizon_sec=8000.0,
            max_steps=50_000,
            whale_frac=0.1,
            small_frac=0.6,
            world=WarBowWorld(40),
            charm_weight_mult=lambda _i: 1.0,
            after_tick=None,
        )
        self.assertGreater(int(m_short["total_buys"]), int(m_long["total_buys"]))

    def test_simulate_sale_utc_offset_in_metrics(self) -> None:
        off = float(SECONDS_PER_DAY) - 400.0
        p = canonical_timecurve_params()
        m = _simulate_sale(
            p,
            random.Random(3),
            population=20,
            dt_sec=15.0,
            arrival_rate=0.08,
            horizon_sec=900.0,
            max_steps=5000,
            whale_frac=0.1,
            small_frac=0.5,
            world=WarBowWorld(20),
            charm_weight_mult=lambda _i: 1.0,
            after_tick=None,
            start_unix_offset_sec=off,
        )
        self.assertEqual(float(m["sim_start_unix_offset_sec"]), off)
        self.assertGreater(float(m["sale_horizon_sec_used"]), off)

    def test_scenario_f_operator_metrics(self) -> None:
        f = run_scenario_f(
            seed=4,
            population=80,
            horizon_sec=4000.0,
            wallets_per_operator=10,
            operator_capital=200_000.0,
        )
        self.assertEqual(f.scenario, "F")
        self.assertIn("operator_spend_share", f.metrics)
        self.assertIn("operator_bp_share", f.metrics)
        self.assertGreater(float(f.metrics["operator_spend_share"]), 0.0)
        self.assertEqual(int(f.metrics["operator_wallet_count"]), 10)


if __name__ == "__main__":
    unittest.main()
