# SPDX-License-Identifier: AGPL-3.0-only
"""Grow defended-streak stats: repeated buys under 15m remaining (on-chain time only)."""

from __future__ import annotations

import random
import time

from timecurve_bot.actions import account_from_config, approve_if_needed, buy, print_dry
from timecurve_bot.config import BotConfig
from timecurve_bot.strategies.common import APPROVE_LARGE, asset_amount_for_charm, charm_bounds, charm_for_buy, loop_mean_sec
from web3 import Web3
from web3.contract import Contract

_WINDOW = 900


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract, *, steps: int = 3) -> None:
    send = cfg.can_submit_transactions()
    if not cfg.private_key:
        print_dry("defender", "set YIELDOMEGA_PRIVATE_KEY and --send")
        return
    acct = account_from_config(cfg.private_key)

    mean = loop_mean_sec("YIELDOMEGA_DEFENDER_MEAN_SEC", "90")
    print(
        f"defender: loop cycles of {steps} qualifying buys under {_WINDOW}s remaining "
        f"(min CHARM each step); mean inter-cycle={mean}s"
    )

    if not send:
        print_dry("defender", f"would loop buys from {acct.address} x{steps} per cycle")
        return

    approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    while True:
        if bool(tc.functions.ended().call()):
            print("defender: sale ended; stopping.")
            return
        latest = w3.eth.get_block("latest")
        now = int(latest["timestamp"])
        dl = int(tc.functions.deadline().call())
        rem = dl - now
        if rem >= _WINDOW:
            print(
                f"defender: remaining {rem}s >= {_WINDOW}s; waiting for on-chain time to enter "
                f"<{_WINDOW}s window (no dev RPC time warp)"
            )
            time.sleep(15)
            continue
        for i in range(steps):
            if bool(tc.functions.ended().call()):
                print("defender: sale ended; stopping.")
                return
            latest = w3.eth.get_block("latest")
            now = int(latest["timestamp"])
            dl = int(tc.functions.deadline().call())
            rem = dl - now
            if rem >= _WINDOW:
                print(f"defender: step {i + 1}: remaining {rem}s — need <{_WINDOW}s; retrying outer cycle")
                break
            lo, _hi = charm_bounds(tc)
            charm = charm_for_buy(tc, lo)
            need = asset_amount_for_charm(tc, charm)
            bal = int(asset.functions.balanceOf(acct.address).call())
            if bal < need:
                print(f"Insufficient CL8Y balance {bal} < {need}; mint from deployer or fund account.")
                return
            try:
                buy(w3, tc, acct, charm, gas_multiplier=cfg.gas_multiplier, send=True)
            except Exception as e:
                print(f"defender: buy failed ({e!s}); restarting cycle")
                break
            streak = int(tc.functions.activeDefendedStreak(acct.address).call())
            best = int(tc.functions.bestDefendedStreak(acct.address).call())
            print(f"  after buy: activeDefendedStreak={streak} bestDefendedStreak={best}")
        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)
