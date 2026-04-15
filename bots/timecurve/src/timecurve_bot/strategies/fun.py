# SPDX-License-Identifier: AGPL-3.0-only
"""Low-pressure exploratory buy at current min CHARM (conservative)."""

from __future__ import annotations

import random
import time

from timecurve_bot.actions import account_from_config, approve_if_needed, buy, print_dry
from timecurve_bot.config import BotConfig
from timecurve_bot.strategies.common import (
    APPROVE_LARGE,
    asset_amount_for_charm,
    charm_bounds,
    charm_for_buy,
    loop_mean_sec,
)
from web3 import Web3
from web3.contract import Contract


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract) -> None:
    send = cfg.can_submit_transactions()
    lo, _hi = charm_bounds(tc)
    charm = cfg.charm_wad_fun if cfg.charm_wad_fun > 0 else lo
    need = asset_amount_for_charm(tc, charm)
    print(f"fun: loop min-CHARM buys; mean inter-arrival={loop_mean_sec('YIELDOMEGA_FUN_MEAN_SEC', '45')}s")
    print(f"fun: charmWad={charm} (~asset {need} wei at current price)")
    if not cfg.private_key:
        print_dry("fun", "set YIELDOMEGA_PRIVATE_KEY and --send to execute")
        return
    acct = account_from_config(cfg.private_key)
    if not send:
        print_dry("fun", f"would approve + loop buys for account {acct.address}")
        return
    approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)
    mean = loop_mean_sec("YIELDOMEGA_FUN_MEAN_SEC", "45")
    while True:
        if bool(tc.functions.ended().call()):
            print("fun: sale ended; stopping.")
            return
        desired = cfg.charm_wad_fun if cfg.charm_wad_fun > 0 else charm_bounds(tc)[0]
        charm = charm_for_buy(tc, desired)
        need2 = asset_amount_for_charm(tc, charm)
        print(f"fun: buy charmWad={charm} (~asset {need2} wei)")
        try:
            buy(w3, tc, acct, charm, gas_multiplier=cfg.gas_multiplier, send=True)
        except Exception as e:
            print(f"fun: buy failed ({e!s}); retrying on next interval")
        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)
