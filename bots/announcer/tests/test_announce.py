# SPDX-License-Identifier: AGPL-3.0-only
"""Offline decode/format tests — no network, no env required."""
import json
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
    assert "LEVEL UP!" not in msg


def test_build_buy_message_level_up_banner():
    market = {"doub_usd_wad": 10**18, "total_prize_pool_doub_wad": 0}
    msg = announce.build_buy_message(
        announce.decode_buy(_synth_buy_log()), "0x" + "ab" * 32, market, new_level=2,
    )
    assert msg.startswith("\U0001F389 <b>LEVEL UP!</b> Now level 2")
    assert "\U0001F7E2 <b>TimeArena BUY</b>" in msg


def test_build_buy_message_first_buy_level_one():
    msg = announce.build_buy_message(
        announce.decode_buy(_synth_buy_log()), "0x" + "ab" * 32, None, new_level=1,
    )
    assert msg.startswith("\U0001F389 <b>LEVEL UP!</b> Now level 1")


def test_decode_level_up_and_first_buy():
    buyer = "0x000000000000000000000000000000000000dEaD"
    level_log = {
        "topics": [announce.TOPIC_LEVEL_UP, "0x" + "0" * 24 + buyer[2:]],
        "data": "0x" + f"{2:064x}",
        "transactionHash": "0x" + "aa" * 32,
    }
    first_log = {
        "topics": [
            announce.TOPIC_FIRST_BUY_CRED_SCHEDULED,
            "0x" + "0" * 24 + buyer[2:],
            "0x" + f"{5:064x}",
        ],
        "data": "0x" + f"{1100 * 10**18:064x}",
        "transactionHash": "0x" + "bb" * 32,
    }
    assert announce.decode_level_up(level_log)["newLevel"] == 2
    hints = announce.build_tx_level_hints([level_log, first_log])
    assert announce.resolve_new_level(buyer, level_log["transactionHash"], hints) == 2
    assert announce.resolve_new_level(buyer, first_log["transactionHash"], hints) == 1
    assert announce.resolve_new_level(buyer, "0x" + "cc" * 32, hints) is None


def test_doub_wei_to_usd_indexed_and_fallback():
    assert announce.doub_wei_to_usd(250 * 10**18, 10**18) == announce.Decimal("250")
    assert announce.doub_wei_to_usd(100 * 10**18, None) == announce.Decimal("98")


def test_sum_all_prize_pools():
    podiums = {
        "rows": [
            {
                "active_pool_balance_doub_wad": "700",
                "seed_pool_balance_doub_wad": "200",
                "future_pool_balance_doub_wad": "100",
            },
            {
                "active_pool_balance_doub_wad": "0",
                "seed_pool_balance_doub_wad": "0",
                "future_pool_balance_doub_wad": "0",
            },
            {
                "active_pool_balance_doub_wad": "1400",
                "seed_pool_balance_doub_wad": "400",
                "future_pool_balance_doub_wad": "200",
            },
            {
                "active_pool_balance_doub_wad": "350",
                "seed_pool_balance_doub_wad": "100",
                "future_pool_balance_doub_wad": "50",
            },
        ],
        "buy_routing": {
            "epoch_tranches": [
                {"slot": "current", "pool_total_doub_wad": "2450"},
                {"slot": "next", "pool_total_doub_wad": "700"},
                {"slot": "future", "pool_total_doub_wad": "350"},
            ],
        },
    }
    assert announce._sum_all_prize_pools(podiums) == 3500
    assert announce._sum_all_prize_pools({"rows": podiums["rows"]}) == 3500


def test_fetch_market_snapshot_parses_spot_price(monkeypatch):
    calls = []

    def fake_get(path):
        calls.append(path)
        if path == "/v1/arena/doub-spot-price":
            return {"doub_usd_wad": str(10**18), "usdm_per_doub_wad": "1000000"}
        if path == "/v1/arena/podiums":
            return {
                "rows": [{
                    "active_pool_balance_doub_wad": "200",
                    "seed_pool_balance_doub_wad": "80",
                    "future_pool_balance_doub_wad": "20",
                }],
                "buy_routing": {"epoch_tranches": [{"pool_total_doub_wad": "300"}]},
            }
        raise AssertionError(path)

    monkeypatch.setattr(announce, "_indexer_get", fake_get)
    announce._market_cache["at"] = 0.0
    snap = announce.fetch_market_snapshot()
    assert snap["doub_usd_wad"] == 10**18
    assert snap["total_prize_pool_doub_wad"] == 300
    assert calls == ["/v1/arena/doub-spot-price", "/v1/arena/podiums"]


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


def _synth_podium_epoch_rolled_log():
    first = "0xeff850382506d409baefb6511b1f975f4d277a06"
    second = "0xc46b15f4b56489a16f561c22d5f0ba8bdca80650"
    third = "0x3fe42f1a6ff5d30a70d15a45663d907c3ab8a42e"
    pool = 7 * 10**18
    words = [int(first, 16), int(second, 16), int(third, 16), pool]
    data = "0x" + "".join(f"{w:064x}" for w in words)
    return {
        "topics": [
            announce.TOPIC_PODIUM_EPOCH_ROLLED,
            "0x" + f"{1:064x}",
            "0x" + f"{1:064x}",
        ],
        "data": data,
        "transactionHash": "0x" + "ef" * 32,
    }


def test_decode_podium_epoch_rolled_roundtrip():
    log = _synth_podium_epoch_rolled_log()
    d = announce.decode_podium_epoch_rolled(log)
    assert d["category"] == 1
    assert d["epoch"] == 1
    assert d["settledEpoch"] == 0
    assert d["first"] == "0xeff850382506d409baefb6511b1f975f4d277a06"
    assert d["second"] == "0xc46b15f4b56489a16f561c22d5f0ba8bdca80650"
    assert d["third"] == "0x3fe42f1a6ff5d30a70d15a45663d907c3ab8a42e"
    assert d["poolPaid"] == 7 * 10**18


def test_payout_shares_matches_contract_math():
    pool = 5_093_514_288_876_076_050_555_741
    first, second, third = announce.payout_shares(pool)
    assert first == pool * 4 // 7
    assert second == pool * 2 // 7
    assert third == pool - first - second
    assert first + second + third == pool


def test_build_podium_settled_message_contains_places_and_tx():
    market = {"doub_usd_wad": 10**18, "total_prize_pool_doub_wad": 0}
    msg = announce.build_podium_settled_message(
        announce.decode_podium_epoch_rolled(_synth_podium_epoch_rolled_log()),
        "0x" + "ef" * 32,
        market,
    )
    assert "Time Booster epoch 0 settled" in msg
    assert "0xeff8…7a06" in msg
    assert "0xc46b…0650" in msg
    assert "0x3fe4…a42e" in msg
    assert "settlement tx" in msg
    assert "ef" * 32 in msg


def test_build_podium_settled_message_empty_slots():
    log = _synth_podium_epoch_rolled_log()
    d = announce.decode_podium_epoch_rolled(log)
    d = {**d, "second": announce.ZERO_ADDR, "third": announce.ZERO_ADDR, "poolPaid": 0}
    msg = announce.build_podium_settled_message(d, "0x" + "aa" * 32, None)
    assert "—" in msg
    assert "Pool paid:" not in msg


def test_countdown_threshold_for_remaining():
    thresholds = [10, 30, 60, 300, 600]
    assert announce._countdown_threshold_for_remaining(597, thresholds) == 600
    assert announce._countdown_threshold_for_remaining(298, thresholds) == 300
    assert announce._countdown_threshold_for_remaining(55, thresholds) == 60
    assert announce._countdown_threshold_for_remaining(25, thresholds) == 30
    assert announce._countdown_threshold_for_remaining(8, thresholds) == 10
    assert announce._countdown_threshold_for_remaining(601, thresholds) is None


def test_countdown_header_emojis_escalate():
    assert "\U0001F6A8" in announce._countdown_header_emojis(10)
    assert "\U0001F525" in announce._countdown_header_emojis(30)
    assert announce._countdown_header_emojis(600) == "\u23F0"


def test_build_podium_countdown_message():
    row = {
        "winners": [
            "0xeff850382506d409baefb6511b1f975f4d277a06",
            "0xc46b15f4b56489a16f561c22d5f0ba8bdca80650",
            announce.ZERO_ADDR,
        ],
        "prize_places_doub_wad": [str(4 * 10**18), str(2 * 10**18), "0"],
        "active_pool_balance_doub_wad": str(7 * 10**18),
    }
    market = {"doub_usd_wad": 10**18}
    msg = announce.build_podium_countdown_message("Last Buy", 10, row, market)
    assert "10s Left On Last Buy!" in msg
    assert "0xeff8…7a06" in msg
    assert "4.00 DOUB" in msg
    assert "Prize pool:" in msg


def test_check_podium_countdowns_fires_once(monkeypatch):
    sent = []
    monkeypatch.setattr(announce, "tg_send", lambda m: sent.append(m))
    monkeypatch.setattr(announce, "fetch_arena_timers", lambda: {
        "block_timestamp_sec": "1000",
        "podium_deadlines_sec": ["1550", "0", "0", "0"],
        "podium_timer_armed": [True, False, False, False],
        "podium_epochs": ["3", "0", "0", "0"],
    })
    monkeypatch.setattr(announce, "fetch_podiums_rows", lambda: {
        "sale_ended": False,
        "rows": [{
            "category": "Last Buy",
            "category_index": 0,
            "winners": ["0xeff850382506d409baefb6511b1f975f4d277a06"],
            "prize_places_doub_wad": [str(10**18), "0", "0"],
            "active_pool_balance_doub_wad": str(3 * 10**18),
        }],
    })
    announced = set()
    announce.check_podium_countdowns(announced, {"doub_usd_wad": None})
    assert len(sent) == 1
    assert "10 Minutes Left On Last Buy!" in sent[0]
    assert "0:3:1550:600" in announced
    announce.check_podium_countdowns(announced, {"doub_usd_wad": None})
    assert len(sent) == 1


def test_check_podium_countdowns_refires_after_timer_reset(monkeypatch):
    sent = []
    timers = {
        "block_timestamp_sec": "1000",
        "podium_deadlines_sec": ["1550", "0", "0", "0"],
        "podium_timer_armed": [True, False, False, False],
        "podium_epochs": ["3", "0", "0", "0"],
    }
    podiums = {
        "sale_ended": False,
        "rows": [{
            "category": "Last Buy",
            "category_index": 0,
            "winners": ["0xeff850382506d409baefb6511b1f975f4d277a06"],
            "prize_places_doub_wad": [str(10**18), "0", "0"],
            "active_pool_balance_doub_wad": str(3 * 10**18),
        }],
    }
    monkeypatch.setattr(announce, "tg_send", lambda m: sent.append(m))
    monkeypatch.setattr(announce, "fetch_arena_timers", lambda: timers)
    monkeypatch.setattr(announce, "fetch_podiums_rows", lambda: podiums)
    announced = set()
    announce.check_podium_countdowns(announced, {"doub_usd_wad": None})
    assert len(sent) == 1
    assert "0:3:1550:600" in announced
    # Buy hard-resets timer: same epoch, new deadline, back in the 10m band.
    timers["podium_deadlines_sec"] = ["2200", "0", "0", "0"]
    timers["block_timestamp_sec"] = "1650"  # 550s left → 10 Minutes band again
    announce.check_podium_countdowns(announced, {"doub_usd_wad": None})
    assert len(sent) == 2
    assert "10 Minutes Left On Last Buy!" in sent[1]
    assert "0:3:2200:600" in announced
    assert "0:3:1550:600" not in announced


def test_load_cursor_includes_countdown_keys(tmp_path, monkeypatch):
    path = tmp_path / "cursor.json"
    path.write_text(json.dumps({
        "last_scanned_block": 99,
        "recent_ids": ["a"],
        "podium_countdown_announced": ["0:1:1700:60"],
    }))
    monkeypatch.setattr(announce, "CURSOR_FILE", path)
    block, recent, countdown = announce.load_cursor()
    assert block == 99
    assert recent == {"a"}
    assert countdown == {"0:1:1700:60"}
