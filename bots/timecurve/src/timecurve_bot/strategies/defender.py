# SPDX-License-Identifier: AGPL-3.0-only
"""Grow defended-streak stats: repeated buys under 15m remaining (uses Anvil time warp locally)."""

from __future__ import annotations

from timecurve_bot.actions import account_from_config, approve_if_needed, buy, print_dry
from timecurve_bot.config import BotConfig
from timecurve_bot.rpc import anvil_increase_time, ensure_anvil_cheat_allowed
from timecurve_bot.strategies.common import APPROVE_LARGE, asset_amount_for_charm, charm_bounds
from web3 import Web3
from web3.contract import Contract

_WINDOW = 900


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract, *, steps: int = 3) -> None:
    ensure_anvil_cheat_allowed(cfg, w3)
    send = cfg.can_submit_transactions()
    if not cfg.private_key:
        print_dry("defender", "set YIELDOMEGA_PRIVATE_KEY and --send")
        return
    acct = account_from_config(cfg.private_key)

    print(f"defender: {steps} qualifying buys under {_WINDOW}s remaining (min CHARM each step)")

    if not send:
        print_dry("defender", f"would warp timer + buy from {acct.address} x{steps}")
        return

    approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    for i in range(steps):
        latest = w3.eth.get_block("latest")
        now = int(latest["timestamp"])
        dl = int(tc.functions.deadline().call())
        if bool(tc.functions.ended().call()):
            print("Sale ended; stop defender loop.")
            return
        rem = dl - now
        if rem >= _WINDOW:
            jump = rem - 600
            print(f"step {i + 1}: warp +{jump}s (remaining {rem}s -> ~600s)")
            anvil_increase_time(w3, max(1, jump))
        lo, _hi = charm_bounds(tc)
        charm = lo
        need = asset_amount_for_charm(tc, charm)
        bal = int(asset.functions.balanceOf(acct.address).call())
        if bal < need:
            print(f"Insufficient CL8Y balance {bal} < {need}; mint from deployer or fund account.")
            return
        buy(w3, tc, acct, charm, gas_multiplier=cfg.gas_multiplier, send=True)
        streak = int(tc.functions.activeDefendedStreak(acct.address).call())
        best = int(tc.functions.bestDefendedStreak(acct.address).call())
        print(f"  after buy: activeDefendedStreak={streak} bestDefendedStreak={best}")
