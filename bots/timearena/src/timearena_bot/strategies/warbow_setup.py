# SPDX-License-Identifier: AGPL-3.0-only
"""WarBow steal preconditions — mirrors ``TimeArena.t.sol`` ``_seedWarbowStealBand``."""

from __future__ import annotations

from eth_account.signers.local import LocalAccount

from timearena_bot.actions import buy
from timearena_bot.config import BotConfig
from timearena_bot.strategies.common import CHARM_MAX_WAD, charm_bounds, charm_for_buy
from web3 import Web3
from web3.contract import Contract

WARBOW_MIN_LEVEL = 4
VICTIM_BP_BOOST_BUYS = 4
_MAX_LEVEL_BUYS = 32


def player_level(tc: Contract, address: str) -> int:
    return int(tc.functions.level(Web3.to_checksum_address(address)).call())


def ensure_level(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    cfg: BotConfig,
    target: int = WARBOW_MIN_LEVEL,
) -> None:
    """Buy max CHARM until ``level(account) >= target`` (respects on-chain buy cooldown)."""
    target = max(1, min(5, int(target)))
    for _ in range(_MAX_LEVEL_BUYS):
        if player_level(tc, account.address) >= target:
            return
        buy(
            w3,
            tc,
            account,
            charm_for_buy(tc, CHARM_MAX_WAD),
            gas_multiplier=cfg.gas_multiplier,
            send=True,
        )
    raise RuntimeError(
        f"ensure_level: {account.address} stuck at level {player_level(tc, account.address)} "
        f"(target {target}) after {_MAX_LEVEL_BUYS} max-CHARM buys"
    )


def boost_warbow_victim(
    w3: Web3,
    tc: Contract,
    victim: LocalAccount,
    cfg: BotConfig,
    *,
    max_charm_buys: int = VICTIM_BP_BOOST_BUYS,
) -> None:
    """Accumulate victim WarBow BP (requires level ≥ 4 before calls grant BP)."""
    _, hi = charm_bounds(tc)
    for _ in range(max(1, max_charm_buys)):
        buy(
            w3,
            tc,
            victim,
            charm_for_buy(tc, hi),
            gas_multiplier=cfg.gas_multiplier,
            send=True,
        )


def seed_warbow_steal_band(
    w3: Web3,
    tc: Contract,
    victim: LocalAccount,
    attacker: LocalAccount,
    cfg: BotConfig,
) -> None:
    """Level both wallets, boost victim BP, give attacker minimal BP — 1×–50× steal band."""
    ensure_level(w3, tc, victim, cfg, WARBOW_MIN_LEVEL)
    boost_warbow_victim(w3, tc, victim, cfg)
    ensure_level(w3, tc, attacker, cfg, WARBOW_MIN_LEVEL)
    lo, _ = charm_bounds(tc)
    buy(
        w3,
        tc,
        attacker,
        charm_for_buy(tc, lo),
        gas_multiplier=cfg.gas_multiplier,
        send=True,
    )


def steal_band_state(tc: Contract, victim: str, attacker: str) -> tuple[int, int, bool]:
    vbp = int(tc.functions.battlePoints(Web3.to_checksum_address(victim)).call())
    abp = int(tc.functions.battlePoints(Web3.to_checksum_address(attacker)).call())
    ok = abp > 0 and vbp >= abp and vbp <= 50 * abp
    return vbp, abp, ok
