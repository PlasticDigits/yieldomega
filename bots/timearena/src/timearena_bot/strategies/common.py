# SPDX-License-Identifier: AGPL-3.0-only
from __future__ import annotations

import os

from web3 import Web3
from web3.contract import Contract


def loop_mean_sec(env_name: str, default: str) -> float:
    """Mean seconds between loop iterations (used with exponential backoff like rando)."""
    raw = os.getenv(env_name, default).strip()
    return max(1.0, float(raw))

WAD = 10**18
# TimeArena fixed CHARM envelope (matches TimeArena.sol CHARM_MIN_WAD / CHARM_MAX_WAD).
CHARM_MIN_WAD = 99 * 10**16
CHARM_MAX_WAD = 10 * 10**18
# Large approval for local dev (not uint256 max to avoid some tooling quirks).
APPROVE_LARGE = 10**40


def asset_amount_for_charm(tc: Contract, charm_wad: int) -> int:
    price = int(tc.functions.charmPriceWad().call())
    return (charm_wad * price) // WAD


def charm_bounds(tc: Contract) -> tuple[int, int]:
    del tc  # TimeArena uses fixed bounds; keep signature for strategy callers.
    return CHARM_MIN_WAD, CHARM_MAX_WAD


def sale_ended(w3: Web3, tc: Contract) -> bool:
    """True when TimeArena is paused, not started, or past the armed Last Buy deadline.

    ``deadline == 0`` means the Last Buy timer is not armed (pre-first-buy or after a
    podium roll). On-chain buys still succeed via ``_requireLive`` — do not treat that
    as sale ended (swarm bots otherwise exit before the first buy sets the timer).
    """
    if bool(tc.functions.paused().call()):
        return True
    if int(tc.functions.arenaStart().call()) == 0:
        return True
    deadline = int(tc.functions.deadline().call())
    if deadline == 0:
        return False
    head_ts = int(w3.eth.get_block("latest")["timestamp"])
    return head_ts > deadline


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
