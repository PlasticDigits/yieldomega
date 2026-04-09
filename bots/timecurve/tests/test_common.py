# SPDX-License-Identifier: AGPL-3.0-only
"""Pure helpers from strategies.common (no chain)."""

from timecurve_bot.strategies.common import WAD


def test_wad_constant() -> None:
    assert WAD == 10**18
