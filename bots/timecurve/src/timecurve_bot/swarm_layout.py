# SPDX-License-Identifier: AGPL-3.0-only
"""Fixed HD wallet indices for `timecurve-bot swarm` (3× each strategy + 3 rando)."""

from __future__ import annotations

# Need indices 0..26 inclusive → anvil --accounts 30
SEED_LOCAL_SLOTS: tuple[tuple[int, int, int], ...] = (
    (0, 1, 2),
    (3, 4, 5),
    (6, 7, 8),
)
DEFENDER_INDICES: tuple[int, ...] = (9, 10, 11)
FUN_INDICES: tuple[int, ...] = (12, 13, 14)
SHARK_INDICES: tuple[int, ...] = (15, 16, 17)
# (attacker, victim) pairs — must be disjoint addresses
PVP_PAIRS: tuple[tuple[int, int], ...] = ((18, 19), (20, 21), (22, 23))
RANDO_INDICES: tuple[int, ...] = (24, 25, 26)

MIN_ANVIL_ACCOUNTS = 30

ALL_FUNDED_INDICES: tuple[int, ...] = tuple(
    sorted(
        set(
            [i for t in SEED_LOCAL_SLOTS for i in t]
            + list(DEFENDER_INDICES)
            + list(FUN_INDICES)
            + list(SHARK_INDICES)
            + [i for p in PVP_PAIRS for i in p]
            + list(RANDO_INDICES)
        )
    )
)
