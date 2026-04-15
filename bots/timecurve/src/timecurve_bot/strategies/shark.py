# SPDX-License-Identifier: AGPL-3.0-only
"""Aggressive timing-oriented behavior: max CHARM buy; optional Anvil warp into hard-reset band."""

from __future__ import annotations

import random
import time

from timecurve_bot.actions import account_from_config, approve_if_needed, buy, print_dry
from timecurve_bot.config import BotConfig
from timecurve_bot.rpc import anvil_increase_time, ensure_anvil_cheat_allowed
from timecurve_bot.strategies.common import (
    APPROVE_LARGE,
    asset_amount_for_charm,
    charm_bounds,
    charm_for_buy,
    loop_mean_sec,
)
from web3 import Web3
from web3.contract import Contract

# TIMER_RESET_BELOW_REMAINING_SEC = 780 (13m) in contract
_RESET_BAND_SEC = 780


def run(
    w3: Web3,
    cfg: BotConfig,
    tc: Contract,
    asset: Contract,
    *,
    warp_reset: bool = False,
) -> None:
    send = cfg.can_submit_transactions()
    mean = loop_mean_sec("YIELDOMEGA_SHARK_MEAN_SEC", "60")
    print(f"shark: loop max-CHARM buys; warp_reset={warp_reset}; mean inter-arrival={mean}s")

    if not cfg.private_key:
        print_dry("shark", "set YIELDOMEGA_PRIVATE_KEY and --send to execute")
        return
    acct = account_from_config(cfg.private_key)
    if warp_reset:
        ensure_anvil_cheat_allowed(cfg, w3)

    lo, hi = charm_bounds(tc)
    charm = cfg.charm_wad_shark if cfg.charm_wad_shark > 0 else hi
    need = asset_amount_for_charm(tc, charm)
    print(f"shark: charmWad={charm} (~asset {need} wei)")

    if not send:
        print_dry("shark", f"would approve + loop buys for {acct.address}")
        return
    approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    while True:
        if bool(tc.functions.ended().call()):
            print("shark: sale ended; stopping.")
            return
        if warp_reset:
            latest = w3.eth.get_block("latest")
            now = int(latest["timestamp"])
            dl = int(tc.functions.deadline().call())
            rem = dl - now
            if rem > _RESET_BAND_SEC:
                jump = rem - 600
                print(f"Anvil: increase time by {jump}s (remaining was {rem}s, target ~600s)")
                anvil_increase_time(w3, jump)
        desired = cfg.charm_wad_shark if cfg.charm_wad_shark > 0 else charm_bounds(tc)[1]
        charm = charm_for_buy(tc, desired)
        need2 = asset_amount_for_charm(tc, charm)
        print(f"shark: buy charmWad={charm} (~asset {need2} wei)")
        try:
            buy(w3, tc, acct, charm, gas_multiplier=cfg.gas_multiplier, send=True)
        except Exception as e:
            print(f"shark: buy failed ({e!s}); retrying on next interval")
        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)
