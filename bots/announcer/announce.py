#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# TimeArena buy-announcement bot (yieldomega) — pure stdlib, READ-ONLY.
#
# Watches TimeArena `Buy`, optional `ArenaStarted`, and `PodiumEpochRolled` on MegaETH
# and posts a Telegram message for each. No private key, signs nothing,
# cannot spend. Only needs OUTBOUND https to the RPC and api.telegram.org.
#
# Run:   set -a; source announce.env; set +a; python3 announce.py
# Test:  python3 announce.py --selftest      (offline: prints a sample message)
from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 80
LOG = logging.getLogger("buybot")

# --- keccak256(event signature) topic0, precomputed (see repo ABI) ---
TOPIC_BUY = "0xbaf9a64575edd1ebb4308874e8680288c787f6741d8edc4d66ce61418bad169b"
TOPIC_ARENA_STARTED = "0x33789300e7043c21750457cc66f0c68d69dda90fedc0c70b1b6dcc38d16c94c5"
TOPIC_LEVEL_UP = "0x91e51c29e7e87a74ad3b8ccba98538970f50a4309242735467f41e27c6b0fbac"
TOPIC_FIRST_BUY_CRED_SCHEDULED = "0x135d669544c1a460dd7b5f82c47189c86898c39919d3f604f6d023b68c9849fd"
TOPIC_PODIUM_EPOCH_ROLLED = "0xa9b78eda30de684ae7f5f429efecdec822db196180c202cf5450da29f84776db"
WATCH_TOPICS = [
    TOPIC_BUY,
    TOPIC_ARENA_STARTED,
    TOPIC_LEVEL_UP,
    TOPIC_FIRST_BUY_CRED_SCHEDULED,
    TOPIC_PODIUM_EPOCH_ROLLED,
]
ZERO_ADDR = "0x0000000000000000000000000000000000000000"
PODIUM_LABELS = {0: "Last Buy", 1: "Time Booster", 2: "Defended Streak", 3: "WarBow"}


# ------------------------- env helpers -------------------------
def env(name, default=None):
    v = os.environ.get(name)
    return v.strip() if v and v.strip() else default


def env_int(name, default):
    v = env(name)
    return int(v, 0) if v is not None else default


def env_bool(name, default):
    v = env(name)
    return default if v is None else v.lower() in ("1", "true", "yes", "on")


def hexint(x):
    return x if isinstance(x, int) else int(x, 16)


# ------------------------- config -------------------------
# MegaETH public RPC returns 403 to requests without a User-Agent header.
USER_AGENT = env("HTTP_USER_AGENT", "yieldomega-buybot/1.0")
_DEFAULT_FALLBACKS = "https://megaeth.drpc.org,https://rpc-megaeth-mainnet.globalstake.io"
_rpc_primary = [u.strip() for u in env("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc").split(",") if u.strip()]
_rpc_fallback = [u.strip() for u in env("MEGAETH_RPC_FALLBACKS", _DEFAULT_FALLBACKS).split(",") if u.strip()]
RPC_URLS = list(dict.fromkeys(_rpc_primary + _rpc_fallback))  # dedupe, preserve order
CHAIN_ID = env_int("CHAIN_ID", 4326)
TIME_ARENA = env("TIME_ARENA_ADDRESS", "0xba39cea0e5ef6808d8cb926c722877480049e0ee").lower()
TG_TOKEN = env("TELEGRAM_BOT_TOKEN")
TG_CHAT = env("TELEGRAM_CHAT_ID")
TG_THREAD = env("TELEGRAM_MESSAGE_THREAD_ID")  # forum topic id, e.g. Ω Flow (omit → General)
EXPLORER_TX = env("EXPLORER_TX_BASE", "https://mega.etherscan.io/tx/")
EXPLORER_ADDR = env("EXPLORER_ADDRESS_BASE", "https://mega.etherscan.io/address/")
POLL_SEC = float(env("POLL_INTERVAL_SEC", "5"))
CONFIRMATIONS = env_int("CONFIRMATIONS", 2)
MAX_SPAN = env_int("MAX_BLOCK_SPAN", 800)
CURSOR_FILE = Path(env("CURSOR_FILE", "announce-cursor.json"))
DOUB_DECIMALS = env_int("DOUB_DECIMALS", 18)
CHARM_DECIMALS = env_int("CHARM_DECIMALS", 18)
MIN_DOUB = Decimal(env("MIN_DOUB", "0"))
ANNOUNCE_ARENA_STARTED = env_bool("ANNOUNCE_ARENA_STARTED", True)
ANNOUNCE_PODIUM_SETTLED = env_bool("ANNOUNCE_PODIUM_SETTLED", True)
START_BLOCK_ENV = env("ANNOUNCE_START_BLOCK")
DRY_RUN = env_bool("DRY_RUN", False)
SEND_TEST_ON_START = env_bool("SEND_TEST_ON_START", False)
STARTUP_PING = env_bool("STARTUP_PING", False)
HTTP_TIMEOUT = float(env("HTTP_TIMEOUT_SEC", "30"))
TG_MIN_INTERVAL = float(env("TELEGRAM_MIN_INTERVAL_SEC", "3.5"))  # ~<20 msgs/min group cap
INDEXER_URL = env("INDEXER_URL", "https://indexer.yieldomega.com").rstrip("/")
INDEXER_CACHE_SEC = float(env("INDEXER_CACHE_SEC", "30"))
DOUB_USD_FALLBACK = Decimal(env("DOUB_USD_FALLBACK", "0.98"))  # when indexer has no TWAP anchor yet

_market_cache: dict = {"at": 0.0, "doub_usd_wad": None, "total_prize_pool_doub_wad": 0}


# ------------------------- JSON-RPC -------------------------
_rpc_id = 0


def rpc(method, params):
    global _rpc_id
    _rpc_id += 1
    payload = json.dumps({"jsonrpc": "2.0", "id": _rpc_id, "method": method, "params": params}).encode()
    last = None
    for url in RPC_URLS:
        try:
            req = urllib.request.Request(url, data=payload,
                                         headers={"Content-Type": "application/json", "User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
                out = json.loads(r.read())
            if out.get("error"):
                raise RuntimeError(f"{method}: {out['error']}")
            return out["result"]
        except Exception as e:  # noqa: BLE001
            last = e
            LOG.warning("RPC %s via %s failed: %s", method, url, e)
    raise RuntimeError(f"all RPC endpoints failed for {method}: {last}")


def block_number():
    return hexint(rpc("eth_blockNumber", []))


def get_logs(lo, hi):
    return rpc("eth_getLogs", [{
        "fromBlock": hex(lo), "toBlock": hex(hi),
        "address": TIME_ARENA,
        "topics": [WATCH_TOPICS],
    }])


_RANGE_HINTS = ("range", "limit", "too large", "too many", "exceed", "more than", "block range", "-32005")


def get_logs_chunked(lo, hi):
    """Fetch [lo, hi] inclusive; split on range/size errors. Result unsorted."""
    out, stack = [], [(lo, hi)]
    while stack:
        a, b = stack.pop()
        if a > b:
            continue
        try:
            out.extend(get_logs(a, b))
        except Exception as e:  # noqa: BLE001
            if a == b or not any(k in str(e).lower() for k in _RANGE_HINTS):
                raise
            mid = (a + b) // 2
            stack.append((mid + 1, b))
            stack.append((a, mid))
    return out


# ------------------------- decode -------------------------
def _word(data_hex, i):
    return int(data_hex[i * 64:(i + 1) * 64], 16)


def decode_buy(log):
    d = log["data"][2:]
    return {
        "buyer": "0x" + log["topics"][1][-40:],
        "charmWad": _word(d, 0),
        "doubPaid": _word(d, 1),
        "newDeadline": _word(d, 2),
        "totalDoubRaisedAfter": _word(d, 3),
        "buyIndex": _word(d, 4),
        "actualSecondsAdded": _word(d, 5),
        "timerHardReset": bool(_word(d, 6)),
        "paidWithCred": bool(_word(d, 7)),
    }


def decode_arena_started(log):
    d = log["data"][2:]
    return {"startTimestamp": _word(d, 0), "initialDeadline": _word(d, 1)}


def _topic_addr(topics, i):
    return ("0x" + topics[i][-40:]).lower()


def decode_level_up(log):
    return {"player": _topic_addr(log["topics"], 1), "newLevel": _word(log["data"][2:], 0)}


def decode_first_buy_cred_scheduled(log):
    return {"buyer": _topic_addr(log["topics"], 1)}


def _data_addr(data_hex, i):
    return ("0x" + data_hex[i * 64 + 24:(i + 1) * 64]).lower()


def decode_podium_epoch_rolled(log):
    d = log["data"][2:]
    epoch = hexint(log["topics"][2])
    return {
        "category": hexint(log["topics"][1]),
        "epoch": epoch,
        "settledEpoch": max(epoch - 1, 0),
        "first": _data_addr(d, 0),
        "second": _data_addr(d, 1),
        "third": _data_addr(d, 2),
        "poolPaid": _word(d, 3),
    }


def payout_shares(pool):
    """4:2:1 split — mirrors ArenaPodiumSettlement.payoutShares."""
    if pool <= 0:
        return 0, 0, 0
    first = pool * 4 // 7
    second = pool * 2 // 7
    return first, second, pool - first - second


def build_tx_level_hints(logs):
    """Per-tx level-up signals from `LevelUp` and first-buy `FirstBuyCredScheduled` logs."""
    hints = {}
    for log in logs:
        topic0 = log["topics"][0].lower()
        tx = log["transactionHash"].lower()
        side = hints.setdefault(tx, {"level_ups": {}, "first_buys": set()})
        if topic0 == TOPIC_LEVEL_UP:
            lu = decode_level_up(log)
            side["level_ups"][lu["player"]] = lu["newLevel"]
        elif topic0 == TOPIC_FIRST_BUY_CRED_SCHEDULED:
            side["first_buys"].add(decode_first_buy_cred_scheduled(log)["buyer"])
    return hints


def resolve_new_level(buyer, tx_hash, hints):
    """New player level when a buy leveled up, or 1 on wallet first buy."""
    side = hints.get(tx_hash.lower(), {})
    buyer_l = buyer.lower()
    if buyer_l in side.get("level_ups", {}):
        return side["level_ups"][buyer_l]
    if buyer_l in side.get("first_buys", set()):
        return 1
    return None


# ------------------------- formatting -------------------------
def fmt_units(value_int, decimals, places=2):
    d = Decimal(value_int) / (Decimal(10) ** decimals)
    return f"{d.quantize(Decimal(10) ** -places):,.{places}f}"


def short_addr(a):
    return a[:6] + "…" + a[-4:]


def fmt_duration(secs):
    secs = int(secs)
    if secs < 60:
        return f"{secs}s"
    m, s = divmod(secs, 60)
    if m < 60:
        return f"{m}m {s}s"
    h, m = divmod(m, 60)
    return f"{h}h {m}m"


# ------------------------- indexer (USD / prize pool) -------------------------
def _indexer_get(path):
    url = f"{INDEXER_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
        return json.loads(r.read())


def _parse_wad(raw):
    if raw is None or raw == "" or raw == "0":
        return None
    try:
        v = int(raw, 0)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def doub_wei_to_usd(doub_wei, doub_usd_wad=None):
    """USD-notional for a DOUB wei amount — Kumbaya spot from doub-spot-price or static fallback."""
    if doub_wei <= 0:
        return Decimal(0)
    base = Decimal(doub_wei) / (Decimal(10) ** DOUB_DECIMALS)
    rate = (Decimal(doub_usd_wad) / (Decimal(10) ** 18)) if doub_usd_wad else DOUB_USD_FALLBACK
    return base * rate


def fmt_usd(doub_wei, doub_usd_wad=None):
    return f"{doub_wei_to_usd(doub_wei, doub_usd_wad).quantize(Decimal('0.01')):,.2f}"


_POOL_WAD_KEYS = (
    "active_pool_balance_doub_wad",
    "seed_pool_balance_doub_wad",
    "future_pool_balance_doub_wad",
)


def _sum_all_prize_pools(podiums):
    """Grand total DOUB across current + next + future epoch pools on all four podiums."""
    tranches = (podiums.get("buy_routing") or {}).get("epoch_tranches") or []
    if tranches:
        total = 0
        for tranche in tranches:
            wad = _parse_wad(tranche.get("pool_total_doub_wad"))
            if wad:
                total += wad
        return total
    total = 0
    for row in podiums.get("rows", []):
        for key in _POOL_WAD_KEYS:
            wad = _parse_wad(row.get(key))
            if wad:
                total += wad
    return total


def fetch_market_snapshot():
    """Cached doub_usd_wad (GET /v1/arena/doub-spot-price) + grand total prize pool (podiums)."""
    now = time.monotonic()
    if now - _market_cache["at"] < INDEXER_CACHE_SEC:
        return _market_cache
    doub_usd_wad = None
    total_prize_pool_doub_wad = 0
    try:
        spot = _indexer_get("/v1/arena/doub-spot-price")
        doub_usd_wad = _parse_wad(spot.get("doub_usd_wad"))
        podiums = _indexer_get("/v1/arena/podiums")
        total_prize_pool_doub_wad = _sum_all_prize_pools(podiums)
    except Exception as e:  # noqa: BLE001
        LOG.warning("Indexer market snapshot failed (%s): %s", INDEXER_URL, e)
        if _market_cache["at"] > 0:
            return _market_cache
    snap = {"at": now, "doub_usd_wad": doub_usd_wad, "total_prize_pool_doub_wad": total_prize_pool_doub_wad}
    _market_cache.update(snap)
    return snap


# ---- message templates (edit wording/emojis to taste) ----
def build_buy_message(b, txhash, market=None, new_level=None):
    charm = fmt_units(b["charmWad"], CHARM_DECIMALS)
    doub = fmt_units(b["doubPaid"], DOUB_DECIMALS)
    total = fmt_units(b["totalDoubRaisedAfter"], DOUB_DECIMALS)
    buyer = b["buyer"]
    doub_usd_wad = market.get("doub_usd_wad") if market else None
    lines = []
    if new_level is not None:
        lines.append(f"\U0001F389 <b>LEVEL UP!</b> Now level {int(new_level)}")
    lines.append("\U0001F7E2 <b>TimeArena BUY</b>")
    lines.append(
        f"\U0001F4B0 <b>{charm} CHARM</b> for <b>{doub} DOUB</b>" + (" <i>(Cred)</i>" if b["paidWithCred"] else ""),
    )
    if b["doubPaid"] > 0:
        worth = fmt_usd(b["doubPaid"], doub_usd_wad)
        lines.append(f"\U0001F4B5 <b>WORTH: ${worth} USD</b>")
    lines.extend([
        f"\U0001F464 <a href=\"{EXPLORER_ADDR}{buyer}\">{short_addr(buyer)}</a>",
        f"⏱ +{fmt_duration(b['actualSecondsAdded'])} on the clock · buy #{b['buyIndex']}",
        f"\U0001F3E6 Raised so far: <b>{total} DOUB</b>",
    ])
    if market and market.get("total_prize_pool_doub_wad", 0) > 0:
        prize_usd = fmt_usd(market["total_prize_pool_doub_wad"], doub_usd_wad)
        lines.append(f"\U0001F3C6 Total Prize Pool: <b>${prize_usd} USD</b>")
    if b["timerHardReset"]:
        lines.append("⚡ <b>TIMER HARD RESET</b>")
    lines.append(f"\U0001F517 <a href=\"{EXPLORER_TX}{txhash}\">view tx</a>")
    return "\n".join(lines)


def build_arena_started_message(_a):
    return ("\U0001F680 <b>The Arena is LIVE</b>\n"
            "The TimeArena buy window is open — every buy pushes the clock.\n"
            f"\U0001F517 <a href=\"{EXPLORER_ADDR}{TIME_ARENA}\">contract</a>")


def _fmt_podium_place_line(rank_emoji, addr, prize_wei, doub_usd_wad):
    if addr == ZERO_ADDR:
        return f"{rank_emoji} —"
    line = f'{rank_emoji} <a href="{EXPLORER_ADDR}{addr}">{short_addr(addr)}</a>'
    if prize_wei > 0:
        line += f" — <b>{fmt_units(prize_wei, DOUB_DECIMALS)} DOUB</b>"
        if doub_usd_wad:
            line += f" (${fmt_usd(prize_wei, doub_usd_wad)})"
    return line


def build_podium_settled_message(e, txhash, market=None):
    label = PODIUM_LABELS.get(e["category"], f"Podium {e['category']}")
    doub_usd_wad = market.get("doub_usd_wad") if market else None
    p1, p2, p3 = payout_shares(e["poolPaid"])
    lines = [
        f"\U0001F3C6 <b>{label} epoch {e['settledEpoch']} settled</b>",
        "",
        _fmt_podium_place_line("\U0001F947", e["first"], p1, doub_usd_wad),
        _fmt_podium_place_line("\U0001F948", e["second"], p2, doub_usd_wad),
        _fmt_podium_place_line("\U0001F949", e["third"], p3, doub_usd_wad),
    ]
    if e["poolPaid"] > 0:
        lines.append(f"\n\U0001F4B0 Pool paid: <b>{fmt_units(e['poolPaid'], DOUB_DECIMALS)} DOUB</b>")
        if doub_usd_wad:
            lines.append(f"(${fmt_usd(e['poolPaid'], doub_usd_wad)} USD)")
    lines.append(f"\n\U0001F517 <a href=\"{EXPLORER_TX}{txhash}\">settlement tx</a>")
    return "\n".join(lines)


# ------------------------- telegram -------------------------
_last_send = [0.0]


def tg_payload(text):
    payload = {"chat_id": TG_CHAT, "text": text,
               "parse_mode": "HTML", "disable_web_page_preview": True}
    if TG_THREAD:
        payload["message_thread_id"] = int(TG_THREAD, 0)
    return payload


def tg_send(text):
    if DRY_RUN or not TG_TOKEN or not TG_CHAT:
        LOG.info("[dry-run] %s", text.replace("\n", " | "))
        return
    wait = TG_MIN_INTERVAL - (time.monotonic() - _last_send[0])
    if wait > 0:
        time.sleep(wait)
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    body = json.dumps(tg_payload(text)).encode()
    for _ in range(5):
        try:
            req = urllib.request.Request(url, data=body,
                                         headers={"Content-Type": "application/json", "User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
                json.loads(r.read())
            _last_send[0] = time.monotonic()
            return
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            if e.code == 429:
                try:
                    retry = json.loads(raw).get("parameters", {}).get("retry_after", 5)
                except Exception:  # noqa: BLE001
                    retry = 5
                LOG.warning("Telegram 429; sleeping %ss", retry)
                time.sleep(retry + 1)
                continue
            LOG.error("Telegram %s: %s", e.code, raw)
            return
        except Exception as e:  # noqa: BLE001
            LOG.error("Telegram send error: %s", e)
            time.sleep(2)
    LOG.error("Telegram: gave up after retries")


# ------------------------- cursor -------------------------
def load_cursor():
    if CURSOR_FILE.is_file():
        try:
            d = json.loads(CURSOR_FILE.read_text())
            return int(d.get("last_scanned_block")), set(d.get("recent_ids", []))
        except Exception as e:  # noqa: BLE001
            LOG.warning("cursor read failed: %s", e)
    return None, set()


def save_cursor(last_block, recent_ids):
    tmp = CURSOR_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps({"last_scanned_block": last_block, "recent_ids": list(recent_ids)[-4000:]}))
    tmp.replace(CURSOR_FILE)


# ------------------------- selftest -------------------------
def selftest():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sample = {"buyer": "0x000000000000000000000000000000000000dEaD",
              "charmWad": 1500 * 10**18, "doubPaid": 250 * 10**18, "newDeadline": 1730000000,
              "totalDoubRaisedAfter": 1_000_000 * 10**18, "buyIndex": 42,
              "actualSecondsAdded": 45, "timerHardReset": True, "paidWithCred": False}
    market = {"doub_usd_wad": 10**18, "total_prize_pool_doub_wad": 4 * 350_000 * 10**18}
    print("---- sample buy message (level up) ----")
    print(build_buy_message(sample, "0x" + "ab" * 32, market, new_level=2))
    print("\n---- sample buy message (first buy) ----")
    print(build_buy_message(sample, "0x" + "cd" * 32, market, new_level=1))
    print("\n---- sample arena-started message ----")
    print(build_arena_started_message(None))
    podium = {
        "category": 1,
        "epoch": 1,
        "settledEpoch": 0,
        "first": "0xeff850382506d409baefb6511b1f975f4d277a06",
        "second": "0xc46b15f4b56489a16f561c22d5f0ba8bdca80650",
        "third": "0x3fe42f1a6ff5d30a70d15a45663d907c3ab8a42e",
        "poolPaid": 5_093_514 * 10**18,
    }
    print("\n---- sample podium-settled message ----")
    print(build_podium_settled_message(podium, "0x" + "ef" * 32, market))
    # round-trip: encode sample into a synthetic log and decode it back
    words = [sample["charmWad"], sample["doubPaid"], sample["newDeadline"], sample["totalDoubRaisedAfter"],
             sample["buyIndex"], sample["actualSecondsAdded"], 1, 0]
    data = "0x" + "".join(f"{w:064x}" for w in words)
    log = {"topics": [TOPIC_BUY, "0x" + "0" * 24 + sample["buyer"][2:]], "data": data}
    dec = decode_buy(log)
    assert dec["charmWad"] == sample["charmWad"] and dec["buyIndex"] == 42 and dec["timerHardReset"], dec
    assert dec["buyer"].lower() == sample["buyer"].lower(), dec
    print("\ndecode round-trip: OK")


# ------------------------- main loop -------------------------
def main():
    if "--selftest" in sys.argv:
        selftest()
        return
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not RPC_URLS:
        LOG.error("No MEGAETH_RPC_URL configured.")
        sys.exit(2)
    if not DRY_RUN and (not TG_TOKEN or not TG_CHAT):
        LOG.error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required (or set DRY_RUN=1).")
        sys.exit(2)
    try:
        cid = hexint(rpc("eth_chainId", []))
    except Exception as e:  # noqa: BLE001
        LOG.error("Startup RPC failed: %s", e)
        sys.exit(2)
    if cid != CHAIN_ID:
        LOG.error("Chain id mismatch: RPC reports %s, expected %s. Refusing to run.", cid, CHAIN_ID)
        sys.exit(2)

    last_scanned, recent_ids = load_cursor()
    head = block_number()
    if last_scanned is None:
        last_scanned = (int(START_BLOCK_ENV, 0) - 1) if START_BLOCK_ENV else head
        LOG.info("No cursor; starting from block %s (head=%s).", last_scanned + 1, head)
    LOG.info("Watching TimeArena %s on chain %s. Cursor=%s.", TIME_ARENA, CHAIN_ID, last_scanned)
    if TG_THREAD:
        LOG.info("Telegram forum topic: message_thread_id=%s", TG_THREAD)
    else:
        LOG.warning("TELEGRAM_MESSAGE_THREAD_ID unset — posts go to the group's General topic.")

    if STARTUP_PING:
        tg_send("\U0001F440 Buy watcher online — monitoring TimeArena.")
    if SEND_TEST_ON_START:
        s = {"buyer": "0x000000000000000000000000000000000000dEaD", "charmWad": 1234 * 10**18,
             "doubPaid": 789 * 10**17, "newDeadline": 0, "totalDoubRaisedAfter": 45678 * 10**18,
             "buyIndex": 1, "actualSecondsAdded": 45, "timerHardReset": False, "paidWithCred": False}
        tg_send(build_buy_message(s, "0x" + "11" * 32, fetch_market_snapshot()))

    while True:
        try:
            safe_head = block_number() - CONFIRMATIONS
            if safe_head <= last_scanned:
                time.sleep(POLL_SEC)
                continue
            collected, lo = [], last_scanned + 1
            while lo <= safe_head:
                hi = min(lo + MAX_SPAN - 1, safe_head)
                collected.extend(get_logs_chunked(lo, hi))
                lo = hi + 1
            collected.sort(key=lambda l: (hexint(l["blockNumber"]), hexint(l["logIndex"])))
            tx_level_hints = build_tx_level_hints(collected)
            for log in collected:
                lid = f'{log["transactionHash"]}:{hexint(log["logIndex"])}'
                if lid in recent_ids:
                    continue
                try:
                    topic0 = log["topics"][0].lower()
                    if topic0 == TOPIC_BUY:
                        b = decode_buy(log)
                        under_min = MIN_DOUB > 0 and (Decimal(b["doubPaid"]) / (Decimal(10) ** DOUB_DECIMALS)) < MIN_DOUB
                        if not under_min:
                            new_level = resolve_new_level(b["buyer"], log["transactionHash"], tx_level_hints)
                            tg_send(build_buy_message(
                                b, log["transactionHash"], fetch_market_snapshot(), new_level=new_level,
                            ))
                    elif topic0 == TOPIC_ARENA_STARTED and ANNOUNCE_ARENA_STARTED:
                        tg_send(build_arena_started_message(decode_arena_started(log)))
                    elif topic0 == TOPIC_PODIUM_EPOCH_ROLLED and ANNOUNCE_PODIUM_SETTLED:
                        tg_send(build_podium_settled_message(
                            decode_podium_epoch_rolled(log),
                            log["transactionHash"],
                            fetch_market_snapshot(),
                        ))
                except Exception as e:  # noqa: BLE001
                    LOG.error("handle log %s failed: %s", lid, e)
                recent_ids.add(lid)
            last_scanned = safe_head
            if len(recent_ids) > 8000:
                recent_ids = set(list(recent_ids)[-4000:])
            save_cursor(last_scanned, recent_ids)
        except Exception as e:  # noqa: BLE001
            LOG.error("loop error: %s", e)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
