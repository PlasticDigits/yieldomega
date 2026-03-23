import unittest

from bounded_formulas.comeback import faction_scores


class TestComeback(unittest.TestCase):
    def test_comeback_caps_trailing(self):
        deposits = [100.0, 10.0, 10.0]
        scores, meta = faction_scores(deposits, eta=1e6, B_comeback=50.0)
        self.assertEqual(len(scores), 3)
        self.assertLessEqual(meta["comeback"][1], 50.0 + 1e-6)
        self.assertLessEqual(meta["comeback"][2], 50.0 + 1e-6)
        self.assertEqual(meta["comeback"][0], 0.0)

    def test_leader_stays_high_baseline(self):
        deposits = [1000.0, 1.0, 1.0]
        scores, _meta = faction_scores(deposits)
        self.assertGreater(scores[0], scores[1])


if __name__ == "__main__":
    unittest.main()
