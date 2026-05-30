# SPDX-License-Identifier: AGPL-3.0-only
"""Read-only TimeArena snapshot from chain (authoritative). Derived fields are labeled."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from web3 import Web3
from web3.contract import Contract

from timecurve_bot.strategies.common import CHARM_MAX_WAD, CHARM_MIN_WAD

# TimeArena category indices (see TimeArena.sol CAT_*)
CAT_LAST_BUY = 0
CAT_TIME_BOOSTER = 1
CAT_DEFENDED_STREAK = 2
CAT_WARBOW = 3

# UX order: Last Buy, WarBow, Defended Streak, Time Booster
PODIUM_DISPLAY_ORDER: Tuple[int, ...] = (CAT_LAST_BUY, CAT_WARBOW, CAT_DEFENDED_STREAK, CAT_TIME_BOOSTER)


@dataclass(frozen=True)
class PodiumRow:
    category: int
    category_label: str
    winners: Tuple[str, str, str]
    values: Tuple[int, int, int]


@dataclass(frozen=True)
class SaleSnapshot:
    block_number: int
    block_timestamp: int
    chain_id: int
    arena_start: int
    deadline: int
    paused: bool
    remaining_sec: int
    last_buy_epoch: int
    min_charm_wad: int
    max_charm_wad: int
    charm_price_wad: int
    podiums: Tuple[PodiumRow, PodiumRow, PodiumRow, PodiumRow]


def _podium_label(cat: int) -> str:
    return {
        CAT_LAST_BUY: "last_buy",
        CAT_WARBOW: "warbow",
        CAT_TIME_BOOSTER: "time_booster",
        CAT_DEFENDED_STREAK: "defended_streak",
    }.get(cat, f"cat_{cat}")


def fetch_sale_snapshot(w3: Web3, tc: Contract, chain_id: int) -> SaleSnapshot:
    latest = w3.eth.get_block("latest")
    ts = int(latest["timestamp"])
    bn = int(latest["number"])

    arena_start = int(tc.functions.arenaStart().call())
    deadline = int(tc.functions.deadline().call())
    paused = bool(tc.functions.paused().call())
    remaining = max(0, deadline - ts) if not paused and arena_start > 0 else 0
    last_buy_epoch = int(tc.functions.lastBuyEpoch().call())
    price = int(tc.functions.charmPriceWad().call())

    podiums: List[PodiumRow] = []
    for c in PODIUM_DISPLAY_ORDER:
        w, v = tc.functions.podium(c).call()
        podiums.append(
            PodiumRow(
                category=c,
                category_label=_podium_label(c),
                winners=tuple(str(x) for x in w),
                values=tuple(int(x) for x in v),
            )
        )

    return SaleSnapshot(
        block_number=bn,
        block_timestamp=ts,
        chain_id=chain_id,
        arena_start=arena_start,
        deadline=deadline,
        paused=paused,
        remaining_sec=remaining,
        last_buy_epoch=last_buy_epoch,
        min_charm_wad=CHARM_MIN_WAD,
        max_charm_wad=CHARM_MAX_WAD,
        charm_price_wad=price,
        podiums=(podiums[0], podiums[1], podiums[2], podiums[3]),
    )


def format_snapshot_human(s: SaleSnapshot, *, rpc_url: str, time_arena: str) -> str:
    lines = [
        f"RPC: {rpc_url}",
        f"Block: {s.block_number}  time: {s.block_timestamp}",
        f"TimeArena: {time_arena}",
        f"Arena: started={s.arena_start} paused={s.paused} deadline={s.deadline} remaining_sec={s.remaining_sec}",
        f"lastBuyEpoch={s.last_buy_epoch}",
        f"CHARM bounds (wad): min={s.min_charm_wad} max={s.max_charm_wad}  charmPriceWad={s.charm_price_wad}",
        "Podiums (onchain DOUB prize state):",
    ]
    for p in s.podiums:
        lines.append(
            f"  [{p.category_label}] " + ", ".join(f"{w}:{v}" for w, v in zip(p.winners, p.values))
        )
    return "\n".join(lines)
