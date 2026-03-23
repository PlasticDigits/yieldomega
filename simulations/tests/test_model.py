import math
import unittest

from bounded_formulas.model import BurrowParams, BurrowState, assert_epoch_invariants, clip, coverage, epoch_step, multiplier


class TestModel(unittest.TestCase):
    def test_clip(self):
        self.assertEqual(clip(1.5, 0.0, 1.0), 1.0)
        self.assertEqual(clip(-1.0, 0.0, 1.0), 0.0)

    def test_coverage_bounds(self):
        p = BurrowParams()
        self.assertEqual(coverage(0.0, 1.0, 1.0, p), 0.0)
        self.assertEqual(coverage(1e12, 1.0, 1e-30, p), p.c_max)

    def test_multiplier_saturates(self):
        p = BurrowParams()
        self.assertGreaterEqual(multiplier(0.0, p), p.m_min - 0.01)
        self.assertLessEqual(multiplier(0.0, p), p.m_max)
        self.assertAlmostEqual(multiplier(100.0, p), p.m_max, places=5)

    def test_epoch_step_invariants(self):
        p = BurrowParams()
        s = BurrowState(R=1e6, S=1e6, e=1.0)
        before = s.copy()
        s2, m = epoch_step(s, p)
        self.assertIs(s2, s)
        assert_epoch_invariants(before, s2, p, m)
        self.assertGreater(s2.e, 0)

    def test_no_nan_after_many_steps(self):
        p = BurrowParams()
        s = BurrowState(R=100.0, S=100.0, e=1.0)
        for _ in range(500):
            before = s.copy()
            s, metrics = epoch_step(s, p)
            assert_epoch_invariants(before, s, p, metrics)
            self.assertFalse(math.isnan(metrics["C"]))


if __name__ == "__main__":
    unittest.main()
