# SPDX-License-Identifier: AGPL-3.0-only
"""Offline decode/format tests — no network, no env required."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import announce  # noqa: E402


def _synth_buy_log():
    words = [1500 * 10**18, 250 * 10**18, 1730000000, 1_000_000 * 10**18, 42, 45, 1, 0]
    data = "0x" + "".join(f"{w:064x}" for w in words)
    buyer = "0x000000000000000000000000000000000000dEaD"
    return {"topics": [announce.TOPIC_BUY, "0x" + "0" * 24 + buyer[2:]], "data": data, "buyer": buyer}


def test_decode_buy_roundtrip():
    log = _synth_buy_log()
    d = announce.decode_buy(log)
    assert d["charmWad"] == 1500 * 10**18
    assert d["doubPaid"] == 250 * 10**18
    assert d["newDeadline"] == 1730000000
    assert d["totalDoubRaisedAfter"] == 1_000_000 * 10**18
    assert d["buyIndex"] == 42
    assert d["actualSecondsAdded"] == 45
    assert d["timerHardReset"] is True
    assert d["paidWithCred"] is False
    assert d["buyer"].lower() == log["buyer"].lower()


def test_decode_arena_started():
    data = "0x" + f"{1730000000:064x}" + f"{1730003600:064x}"
    d = announce.decode_arena_started({"data": data})
    assert d["startTimestamp"] == 1730000000
    assert d["initialDeadline"] == 1730003600


def test_fmt_units():
    assert announce.fmt_units(1500 * 10**18, 18) == "1,500.00"
    assert announce.fmt_units(789 * 10**17, 18) == "78.90"
    assert announce.fmt_units(0, 18) == "0.00"


def test_fmt_duration():
    assert announce.fmt_duration(45) == "45s"
    assert announce.fmt_duration(90) == "1m 30s"
    assert announce.fmt_duration(3661) == "1h 1m"


def test_short_addr():
    assert announce.short_addr("0x000000000000000000000000000000000000dEaD") == "0x0000…dEaD"


def test_build_buy_message_contains_key_fields():
    market = {"doub_usd_wad": 10**18, "total_prize_pool_doub_wad": 1_400_000 * 10**18}
    msg = announce.build_buy_message(announce.decode_buy(_synth_buy_log()), "0x" + "ab" * 32, market)
    assert "1,500.00 CHARM" in msg
    assert "250.00 DOUB" in msg
    assert "WORTH: $250.00 USD" in msg
    assert "Total Prize Pool:" in msg
    assert "$1,400,000.00 USD" in msg
    assert "buy #42" in msg
    assert "TIMER HARD RESET" in msg


def test_doub_wei_to_usd_indexed_and_fallback():
    assert announce.doub_wei_to_usd(250 * 10**18, 10**18) == announce.Decimal("250")
    assert announce.doub_wei_to_usd(100 * 10**18, None) == announce.Decimal("98")


def test_sum_active_prize_pools():
    podiums = {"rows": [
        {"active_pool_balance_doub_wad": "100"},
        {"active_pool_balance_doub_wad": "200"},
        {"active_pool_balance_doub_wad": "0"},
        {},
    ]}
    assert announce._sum_active_prize_pools(podiums) == 300


def test_build_buy_message_skips_worth_for_zero_doub():
    log = _synth_buy_log()
    b = announce.decode_buy(log)
    b = {**b, "doubPaid": 0, "paidWithCred": True}
    msg = announce.build_buy_message(b, "0x" + "ab" * 32, {"doub_usd_wad": 10**18, "total_prize_pool_doub_wad": 0})
    assert "WORTH:" not in msg


def test_tg_payload_forum_topic(monkeypatch):
    monkeypatch.setattr(announce, "TG_CHAT", "-100123")
    monkeypatch.setattr(announce, "TG_THREAD", "42")
    payload = announce.tg_payload("hello")
    assert payload["chat_id"] == "-100123"
    assert payload["message_thread_id"] == 42


def test_tg_payload_no_topic(monkeypatch):
    monkeypatch.setattr(announce, "TG_CHAT", "-100123")
    monkeypatch.setattr(announce, "TG_THREAD", None)
    payload = announce.tg_payload("hello")
    assert "message_thread_id" not in payload
