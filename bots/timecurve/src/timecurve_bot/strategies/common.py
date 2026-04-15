# SPDX-License-Identifier: AGPL-3.0-only
from __future__ import annotations

import os

from web3.contract import Contract


def loop_mean_sec(env_name: str, default: str) -> float:
    """Mean seconds between loop iterations (used with exponential backoff like rando)."""
    raw = os.getenv(env_name, default).strip()
    return max(1.0, float(raw))

WAD = 10**18
# Large approval for local dev (not uint256 max to avoid some tooling quirks).
APPROVE_LARGE = 10**40


def asset_amount_for_charm(tc: Contract, charm_wad: int) -> int:
    price = int(tc.functions.currentPricePerCharmWad().call())
    return (charm_wad * price) // WAD


def charm_bounds(tc: Contract) -> tuple[int, int]:
    lo, hi = tc.functions.currentCharmBoundsWad().call()
    return int(lo), int(hi)


def charm_for_buy(tc: Contract, desired: int) -> int:
    """Clamp desired CHARM to current bounds; if at min, nudge up slightly.

    Auto-mined blocks advance `block.timestamp`, so min/max grow between read and inclusion.
    Buying exactly the prior `lo` often reverts with `TimeCurve: below min charms`.
    """
    lo, hi = charm_bounds(tc)
    c = max(lo, min(desired, hi))
    if c == lo and lo < hi:
        bump = max(1, (hi - lo) // 10_000)
        c = min(hi, lo + bump)
    return c
