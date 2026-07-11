# SPDX-License-Identifier: AGPL-3.0-only
"""WarBow setup helpers (mocked chain reads)."""

from unittest.mock import MagicMock, patch

import pytest
from eth_account import Account

from timearena_bot.config import BotConfig
from timearena_bot.strategies.warbow_setup import (
    WARBOW_MIN_LEVEL,
    ensure_level,
    player_level,
    seed_warbow_steal_band,
    steal_band_state,
)


def _cfg() -> BotConfig:
    return BotConfig(
        rpc_url="http://127.0.0.1:8545",
        chain_id=31337,
        private_key=Account.create().key.hex(),
        timearena_address="0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
        accepted_asset_address=None,
        address_file=None,
        poll_interval_sec=5.0,
        gas_multiplier=1.1,
        charm_wad_fun=0,
        charm_wad_shark=0,
        send_transactions=True,
        send_cli=True,
        allow_anvil_funding=False,
    )


def test_player_level_reads_contract() -> None:
    tc = MagicMock()
    tc.functions.level.return_value.call.return_value = 3
    assert player_level(tc, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") == 3


def test_steal_band_state_ok() -> None:
    tc = MagicMock()
    bp_calls: list[str] = []

    def _bp(addr: str) -> MagicMock:
        bp_calls.append(addr)
        val = 500 if bp_calls.count(addr) == 1 and len(bp_calls) == 1 else 100
        if len(bp_calls) == 1:
            val = 500
        elif len(bp_calls) == 2:
            val = 100
        m = MagicMock()
        m.call.return_value = val
        return m

    tc.functions.battlePoints.side_effect = _bp
    vbp, abp, ok = steal_band_state(
        tc,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
    )
    assert vbp == 500
    assert abp == 100
    assert ok is True


def test_steal_band_state_rejects_below_1x() -> None:
    tc = MagicMock()
    values = iter([99, 100])

    def _bp(_addr: str) -> MagicMock:
        m = MagicMock()
        m.call.return_value = next(values)
        return m

    tc.functions.battlePoints.side_effect = _bp
    _, _, ok = steal_band_state(
        tc,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
    )
    assert ok is False


def test_ensure_level_skips_when_already_at_target() -> None:
    tc = MagicMock()
    tc.functions.level.return_value.call.return_value = WARBOW_MIN_LEVEL
    w3 = MagicMock()
    acct = Account.create()
    with patch("timearena_bot.strategies.warbow_setup.buy") as buy_mock:
        ensure_level(w3, tc, acct, _cfg(), WARBOW_MIN_LEVEL)
        buy_mock.assert_not_called()


def test_seed_warbow_steal_band_calls_level_boost_and_attacker_min_buy() -> None:
    w3 = MagicMock()
    victim = Account.create()
    attacker = Account.create()
    tc = MagicMock()
    tc.functions.level.return_value.call.return_value = WARBOW_MIN_LEVEL

    with patch("timearena_bot.strategies.warbow_setup.ensure_level") as ensure_mock:
        with patch("timearena_bot.strategies.warbow_setup.boost_warbow_victim") as boost_mock:
            with patch("timearena_bot.strategies.warbow_setup.buy") as buy_mock:
                seed_warbow_steal_band(w3, tc, victim, attacker, _cfg())
                assert ensure_mock.call_count == 2
                boost_mock.assert_called_once()
                buy_mock.assert_called_once()
