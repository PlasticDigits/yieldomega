# SPDX-License-Identifier: AGPL-3.0-only
"""sale_ended() must not treat deadline==0 as ended (TimeArena pre-first-buy / post-roll)."""

from unittest.mock import MagicMock

from timearena_bot.strategies.common import sale_ended


def _tc(*, paused: bool = False, arena_start: int = 1, deadline: int = 0) -> MagicMock:
    tc = MagicMock()
    tc.functions.paused().call.return_value = paused
    tc.functions.arenaStart().call.return_value = arena_start
    tc.functions.deadline().call.return_value = deadline
    return tc


def test_sale_not_ended_when_deadline_zero_and_arena_started() -> None:
    w3 = MagicMock()
    w3.eth.get_block.return_value = {"timestamp": 1_700_000_000}
    assert sale_ended(w3, _tc(deadline=0)) is False


def test_sale_ended_when_paused() -> None:
    w3 = MagicMock()
    assert sale_ended(w3, _tc(paused=True, deadline=0)) is True


def test_sale_ended_when_arena_not_started() -> None:
    w3 = MagicMock()
    assert sale_ended(w3, _tc(arena_start=0, deadline=0)) is True


def test_sale_ended_when_past_armed_deadline() -> None:
    w3 = MagicMock()
    w3.eth.get_block.return_value = {"timestamp": 1_700_000_100}
    assert sale_ended(w3, _tc(deadline=1_700_000_000)) is True


def test_sale_not_ended_when_before_armed_deadline() -> None:
    w3 = MagicMock()
    w3.eth.get_block.return_value = {"timestamp": 1_700_000_000}
    assert sale_ended(w3, _tc(deadline=1_700_000_100)) is False
