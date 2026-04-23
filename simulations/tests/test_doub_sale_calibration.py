# SPDX-License-Identifier: AGPL-3.0-or-later
"""Unit tests for DOUB sale calibration helpers."""

from __future__ import annotations

import unittest

from doub_sale_calibration.core import (
    clearing_cl8y_per_doub,
    cumulative_mint_under_k,
    doub_per_charm_from_k,
    implied_launch_price_usd_per_doub,
    k_doub_per_cl8y,
    linear_price_wad,
    linear_raise_profile,
    referral_charm_weight_denominator_multiplier,
    sale_tranche_notional_usd,
)


class TestLinearPriceWad(unittest.TestCase):
    def test_matches_muldiv_pattern(self) -> None:
        base = 10**17
        inc = 10**16
        self.assertEqual(linear_price_wad(0, base, inc), base)
        self.assertEqual(linear_price_wad(86_400, base, inc), base + inc)
        self.assertEqual(linear_price_wad(43_200, base, inc), base + inc // 2)


class TestFdvAnchor(unittest.TestCase):
    def test_half_million_over_250m(self) -> None:
        p = implied_launch_price_usd_per_doub(fdv_usd=500_000.0, total_supply_tokens=250_000_000.0)
        self.assertAlmostEqual(p, 0.002, places=9)
        n = sale_tranche_notional_usd(launch_price_usd_per_doub=p, sale_tokens=200_000_000.0)
        self.assertAlmostEqual(n, 400_000.0, places=3)


class TestReferralSensitivity(unittest.TestCase):
    def test_endpoints(self) -> None:
        self.assertAlmostEqual(
            referral_charm_weight_denominator_multiplier(fraction_of_raise_from_referred_buys=0.0), 1.0
        )
        self.assertAlmostEqual(
            referral_charm_weight_denominator_multiplier(fraction_of_raise_from_referred_buys=1.0), 1.1
        )
        self.assertAlmostEqual(
            referral_charm_weight_denominator_multiplier(fraction_of_raise_from_referred_buys=0.8), 1.08
        )


class TestKModel(unittest.TestCase):
    def test_k_and_clearing(self) -> None:
        k = k_doub_per_cl8y(sale_tokens=200.0, total_raise_cl8y=1_000_000.0)
        self.assertAlmostEqual(k, 0.0002)
        c = clearing_cl8y_per_doub(total_raise_cl8y=1_000_000.0, sale_tokens=200.0)
        self.assertAlmostEqual(c, 5000.0)
        m = cumulative_mint_under_k(100.0, k_doub_per_cl8y=k)
        self.assertAlmostEqual(m, 0.02)
        d = doub_per_charm_from_k(k_doub_per_cl8y=200.0 / 1.0, price_cl8y_per_charm=0.5)
        self.assertAlmostEqual(d, 100.0)


class TestProfiles(unittest.TestCase):
    def test_linear_raise_endpoints(self) -> None:
        t, r = linear_raise_profile(duration_sec=100.0, total_raise_cl8y=50.0, steps=5)
        self.assertEqual(len(t), 5)
        self.assertAlmostEqual(t[-1], 100.0)
        self.assertAlmostEqual(r[-1], 50.0)
        self.assertAlmostEqual(r[0], 0.0)


if __name__ == "__main__":
    unittest.main()
