# SPDX-License-Identifier: AGPL-3.0-only
import os

import pytest

from timearena_bot.fleet_env import load_fleet_wallets


def test_load_fleet_wallets_empty() -> None:
    assert load_fleet_wallets(environ={}) == ()


def test_load_fleet_wallets_single() -> None:
    env = {
        "KEY_1": "feedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface",
        "MEAN_1": "1800",
    }
    wallets = load_fleet_wallets(environ=env)
    assert len(wallets) == 1
    assert wallets[0].index == 1
    assert wallets[0].mean_sec == 1800.0
    assert wallets[0].private_key.startswith("feedface")


def test_load_fleet_wallets_strips_0x_prefix() -> None:
    env = {
        "KEY_1": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "MEAN_1": "45",
    }
    wallets = load_fleet_wallets(environ=env)
    assert wallets[0].private_key == "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"


def test_load_fleet_wallets_multiple_consecutive() -> None:
    env = {
        "KEY_1": "aaa",
        "MEAN_1": "1200",
        "KEY_2": "bbb",
        "MEAN_2": "2400",
        "KEY_3": "ccc",
        "MEAN_3": "1800",
    }
    wallets = load_fleet_wallets(environ=env)
    assert [(w.index, w.private_key, w.mean_sec) for w in wallets] == [
        (1, "aaa", 1200.0),
        (2, "bbb", 2400.0),
        (3, "ccc", 1800.0),
    ]


def test_load_fleet_wallets_stops_at_first_missing_key() -> None:
    env = {
        "KEY_1": "aaa",
        "MEAN_1": "100",
        "KEY_3": "ccc",
        "MEAN_3": "300",
    }
    wallets = load_fleet_wallets(environ=env)
    assert len(wallets) == 1


def test_load_fleet_wallets_missing_mean_raises() -> None:
    with pytest.raises(ValueError, match="MEAN_2"):
        load_fleet_wallets(environ={"KEY_1": "a", "MEAN_1": "1", "KEY_2": "b"})


def test_load_fleet_wallets_invalid_mean_raises() -> None:
    with pytest.raises(ValueError, match="MEAN_1"):
        load_fleet_wallets(environ={"KEY_1": "a", "MEAN_1": "not-a-number"})


def test_load_fleet_wallets_mean_floor_at_one() -> None:
    wallets = load_fleet_wallets(environ={"KEY_1": "a", "MEAN_1": "0.2"})
    assert wallets[0].mean_sec == 1.0


def test_load_fleet_wallets_from_os_environ(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KEY_1", "keyone")
    monkeypatch.setenv("MEAN_1", "900")
    wallets = load_fleet_wallets()
    assert wallets[0].private_key == "keyone"
