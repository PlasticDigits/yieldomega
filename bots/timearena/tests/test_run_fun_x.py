# SPDX-License-Identifier: AGPL-3.0-only
from unittest.mock import MagicMock, patch

import pytest

from timearena_bot import run_fun_x
from timearena_bot.fleet_env import FleetWallet


def _cfg(*, can_send: bool = True) -> MagicMock:
    cfg = MagicMock()
    cfg.can_submit_transactions.return_value = can_send
    return cfg


def test_run_fun_fleet_no_wallets_exits() -> None:
    with patch.object(run_fun_x, "load_fleet_wallets", return_value=()):
        with pytest.raises(SystemExit) as exc:
            run_fun_x.run_fun_fleet(cfg=_cfg())
    assert exc.value.code == 2


def test_run_fun_fleet_requires_send() -> None:
    wallet = FleetWallet(index=1, private_key="aaa", mean_sec=60.0)
    with patch.object(run_fun_x, "load_fleet_wallets", return_value=(wallet,)):
        with pytest.raises(SystemExit) as exc:
            run_fun_x.run_fun_fleet(cfg=_cfg(can_send=False))
    assert exc.value.code == 2


def test_run_fun_fleet_invalid_key_exits() -> None:
    wallet = FleetWallet(index=1, private_key="not-a-valid-key", mean_sec=60.0)
    with patch.object(run_fun_x, "load_fleet_wallets", return_value=(wallet,)):
        with pytest.raises(SystemExit) as exc:
            run_fun_x.run_fun_fleet(cfg=_cfg())
    assert exc.value.code == 2


def test_run_fun_fleet_supervisor_exits_when_worker_clean() -> None:
    wallet = FleetWallet(index=1, private_key="bbb", mean_sec=60.0)
    poll_state = {"n": 0}

    def _poll() -> int | None:
        poll_state["n"] += 1
        return None if poll_state["n"] == 1 else 0

    proc = MagicMock()
    proc.pid = 4242
    proc.poll.side_effect = _poll
    proc.stdout = iter(())
    proc.terminate = MagicMock()
    proc.kill = MagicMock()
    mock_account = MagicMock()
    mock_account.address = "0x0000000000000000000000000000000000000001"

    with patch.object(run_fun_x, "load_fleet_wallets", return_value=(wallet,)):
        with patch.object(run_fun_x.Account, "from_key", return_value=mock_account):
            with patch.object(run_fun_x, "_spawn_worker", return_value=proc):
                with patch.object(run_fun_x.time, "sleep", side_effect=lambda _s: None):
                    run_fun_x.run_fun_fleet(cfg=_cfg())

    proc.terminate.assert_not_called()
