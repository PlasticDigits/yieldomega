# SPDX-License-Identifier: AGPL-3.0-only
from __future__ import annotations

from web3.contract import Contract

WAD = 10**18
# Large approval for local dev (not uint256 max to avoid some tooling quirks).
APPROVE_LARGE = 10**40


def asset_amount_for_charm(tc: Contract, charm_wad: int) -> int:
    price = int(tc.functions.currentPricePerCharmWad().call())
    return (charm_wad * price) // WAD


def charm_bounds(tc: Contract) -> tuple[int, int]:
    lo, hi = tc.functions.currentCharmBoundsWad().call()
    return int(lo), int(hi)
