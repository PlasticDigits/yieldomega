import unittest

from bounded_formulas.model import BurrowParams, BurrowState
from bounded_formulas.scenarios import run_all_scenarios


class TestScenarios(unittest.TestCase):
    def test_all_scenarios_pass(self):
        initial = BurrowState(R=1_000_000.0, S=1_000_000.0, e=1.0)
        p = BurrowParams()
        results = run_all_scenarios(initial=initial, p=p)
        for r in results:
            self.assertTrue(r.passed, msg=f"{r.name}: {r.error}")


if __name__ == "__main__":
    unittest.main()
