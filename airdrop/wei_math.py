"""Integer wei helpers (bash cannot compare uint256 values)."""

from __future__ import annotations


def int_gt(a: str | int, b: str | int) -> bool:
    return int(a) > int(b)


def int_lt(a: str | int, b: str | int) -> bool:
    return int(a) < int(b)


def int_gte(a: str | int, b: str | int) -> bool:
    return int(a) >= int(b)
