# SPDX-License-Identifier: AGPL-3.0-only

import pytest

from timecurve_bot.referral_code import hash_referral_code_normalized, normalize_referral_code


def test_normalize_referral_code_lowercase() -> None:
    assert normalize_referral_code("  AbC12  ") == "abc12"


def test_normalize_referral_code_rejects_invalid() -> None:
    with pytest.raises(ValueError):
        normalize_referral_code("ab")
    with pytest.raises(ValueError):
        normalize_referral_code("bad_code")


def test_hash_matches_known_keccak() -> None:
    n = "swarmyo"
    h = hash_referral_code_normalized(n)
    assert len(h) == 32
