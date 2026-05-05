"""FeeRouter-style 5-sink split matching `FeeRouter.distributeFees` + `FeeMath.bpsShare`."""

from __future__ import annotations

BPS_DENOM = 10_000


def fee_router_five_shares(amount: float, weights_bps: tuple[int, int, int, int, int]) -> tuple[float, ...]:
    """First four sinks use floor(amount * w / 10000); last sink gets remainder (float, scenario-only)."""
    if len(weights_bps) != 5:
        raise ValueError("expected five sink weights")
    if sum(weights_bps) != BPS_DENOM:
        raise ValueError("weights must sum to 10000 bps")
    shares: list[float] = []
    remaining = float(amount)
    for i in range(4):
        sh = (amount * weights_bps[i]) / BPS_DENOM
        shares.append(sh)
        remaining -= sh
    shares.append(remaining)
    return tuple(shares)
