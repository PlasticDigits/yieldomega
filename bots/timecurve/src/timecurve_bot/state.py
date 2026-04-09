# SPDX-License-Identifier: AGPL-3.0-only
"""Read-only sale snapshot from chain (authoritative). Derived fields are labeled."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from web3 import Web3
from web3.contract import Contract

# Reserve podium categories (match contract / docs/product/primitives.md)
CAT_LAST_BUY = 0
CAT_TIME_BOOSTER = 1
CAT_DEFENDED_STREAK = 2


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
    sale_start: int
    deadline: int
    ended: bool
    remaining_sec: int
    total_raised: int
    total_charm_weight: int
    min_charm_wad: int
    max_charm_wad: int
    price_per_charm_wad: int
    warbow_winners: Tuple[str, str, str]
    warbow_values: Tuple[int, int, int]
    flag_owner: str
    flag_plant_at: int
    podiums: Tuple[PodiumRow, PodiumRow, PodiumRow]


def _podium_label(cat: int) -> str:
    return {
        CAT_LAST_BUY: "last_buy",
        CAT_TIME_BOOSTER: "time_booster",
        CAT_DEFENDED_STREAK: "defended_streak",
    }.get(cat, f"cat_{cat}")


def fetch_sale_snapshot(w3: Web3, tc: Contract, chain_id: int) -> SaleSnapshot:
    latest = w3.eth.get_block("latest")
    ts = int(latest["timestamp"])
    bn = int(latest["number"])

    sale_start = int(tc.functions.saleStart().call())
    deadline = int(tc.functions.deadline().call())
    ended = bool(tc.functions.ended().call())
    remaining = max(0, deadline - ts) if not ended and sale_start > 0 else 0

    tr = int(tc.functions.totalRaised().call())
    tcw = int(tc.functions.totalCharmWeight().call())
    min_c, max_c = tc.functions.currentCharmBoundsWad().call()
    price = int(tc.functions.currentPricePerCharmWad().call())

    podiums: List[PodiumRow] = []
    for c in (CAT_LAST_BUY, CAT_TIME_BOOSTER, CAT_DEFENDED_STREAK):
        w, v = tc.functions.podium(c).call()
        podiums.append(
            PodiumRow(
                category=c,
                category_label=_podium_label(c),
                winners=tuple(str(x) for x in w),
                values=tuple(int(x) for x in v),
            )
        )

    ww, wv = tc.functions.warbowLadderPodium().call()
    fo = tc.functions.warbowPendingFlagOwner().call()
    fp = int(tc.functions.warbowPendingFlagPlantAt().call())

    return SaleSnapshot(
        block_number=bn,
        block_timestamp=ts,
        chain_id=chain_id,
        sale_start=sale_start,
        deadline=deadline,
        ended=ended,
        remaining_sec=remaining,
        total_raised=tr,
        total_charm_weight=tcw,
        min_charm_wad=int(min_c),
        max_charm_wad=int(max_c),
        price_per_charm_wad=price,
        warbow_winners=tuple(str(x) for x in ww),
        warbow_values=tuple(int(x) for x in wv),
        flag_owner=str(fo),
        flag_plant_at=fp,
        podiums=(podiums[0], podiums[1], podiums[2]),
    )


def format_snapshot_human(s: SaleSnapshot, *, rpc_url: str, timecurve: str) -> str:
    lines = [
        f"RPC: {rpc_url}",
        f"Block: {s.block_number}  time: {s.block_timestamp}",
        f"TimeCurve: {timecurve}",
        f"Sale: started={s.sale_start} ended={s.ended} deadline={s.deadline} remaining_sec={s.remaining_sec}",
        f"Raised (raw): {s.total_raised}  totalCharmWeight: {s.total_charm_weight}",
        f"CHARM bounds (wad): min={s.min_charm_wad} max={s.max_charm_wad}  pricePerCharmWad={s.price_per_charm_wad}",
        "Reserve podiums (onchain; reserve prizes — not WarBow BP):",
    ]
    for p in s.podiums:
        lines.append(
            f"  [{p.category_label}] " + ", ".join(f"{w}:{v}" for w, v in zip(p.winners, p.values))
        )
    lines.append("WarBow ladder top-3 (Battle Points — display only):")
    lines.append("  " + ", ".join(f"{w}:{v}" for w, v in zip(s.warbow_winners, s.warbow_values)))
    lines.append(f"Flag pending owner={s.flag_owner} plant_at={s.flag_plant_at}")
    return "\n".join(lines)
