# SPDX-License-Identifier: AGPL-3.0-only
"""Poisson-process inter-arrival buys with uniform random CHARM in [min, max] (live sale testing)."""

from __future__ import annotations

import random
import time

from timecurve_bot.actions import account_from_config, approve_if_needed, buy, print_dry
from timecurve_bot.config import BotConfig
from timecurve_bot.strategies.common import APPROVE_LARGE, asset_amount_for_charm, charm_bounds, charm_for_buy, loop_mean_sec
from web3 import Web3
from web3.contract import Contract


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract) -> None:
    """Buy loop: wait ~Exp(1/μ) between attempts (Poisson arrivals at rate 1/μ); CHARM uniform in [lo, hi]."""
    send = cfg.can_submit_transactions()
    mean = loop_mean_sec("YIELDOMEGA_RANDO_MEAN_SEC", "45")
    print(f"rando: Poisson process mean inter-arrival={mean}s; CHARM uniform in current [min,max] bounds")

    if not cfg.private_key:
        print_dry("rando", "set YIELDOMEGA_PRIVATE_KEY and --send to execute")
        return
    acct = account_from_config(cfg.private_key)
    if not send:
        lo, hi = charm_bounds(tc)
        print_dry("rando", f"would loop buys for {acct.address} with random charm in [{lo}, {hi}]")
        return

    approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    while True:
        if bool(tc.functions.ended().call()):
            print("rando: sale ended; stopping.")
            return
        # Exponential inter-arrival times ⇔ Poisson counting process (homogeneous rate 1/mean).
        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)
        if bool(tc.functions.ended().call()):
            print("rando: sale ended; stopping.")
            return
        lo, hi = charm_bounds(tc)
        if lo > hi:
            print("rando: invalid charm bounds; stopping.")
            return
        raw = random.randint(lo, hi)
        charm = charm_for_buy(tc, raw)
        need = asset_amount_for_charm(tc, charm)
        bal = int(asset.functions.balanceOf(acct.address).call())
        if bal < need:
            print(f"rando: balance {bal} < need {need}; skipping buy (fund mock reserve).")
            continue
        print(f"rando: buy charmWad={charm} (~asset {need} wei)")
        try:
            buy(w3, tc, acct, charm, gas_multiplier=cfg.gas_multiplier, send=True)
        except Exception as e:
            print(f"rando: buy failed ({e!s}); retrying on next interval")
