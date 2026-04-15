# SPDX-License-Identifier: AGPL-3.0-only
"""Exercise WarBow steal path: high-BP victim, low-BP attacker (second key)."""

from __future__ import annotations

import os
import random
import time

from timecurve_bot.actions import (
    account_from_config,
    approve_if_needed,
    buy,
    mint_mock_reserve,
    print_dry,
    warbow_steal,
)
from timecurve_bot.config import BotConfig
from timecurve_bot.strategies.common import APPROVE_LARGE, asset_amount_for_charm, charm_bounds, charm_for_buy, loop_mean_sec
from web3 import Web3
from web3.contract import Contract

# Anvil account #1 — local dev only; override with YIELDOMEGA_PVP_VICTIM_PRIVATE_KEY
_DEFAULT_VICTIM_PK = (
    "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
)


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract) -> None:
    send = cfg.can_submit_transactions()
    atk_pk = cfg.private_key
    vic_pk = os.getenv("YIELDOMEGA_PVP_VICTIM_PRIVATE_KEY", _DEFAULT_VICTIM_PK).strip()
    if vic_pk.startswith("0x"):
        vic_pk = vic_pk[2:]

    if not atk_pk:
        print_dry("pvp", "set YIELDOMEGA_PRIVATE_KEY (attacker) and --send")
        return

    attacker = account_from_config(atk_pk)
    victim = account_from_config(vic_pk)
    if attacker.address == victim.address:
        print("pvp: attacker and victim keys must differ.")
        return

    mean = loop_mean_sec("YIELDOMEGA_PVP_MEAN_SEC", "120")
    print(
        f"pvp: loop victim {victim.address} buys + attacker {attacker.address} steals; "
        f"mean inter-cycle={mean}s"
    )

    if not send:
        print_dry("pvp", "would fund victim buys then warbowSteal from attacker (loop)")
        return

    while True:
        if bool(tc.functions.ended().call()):
            print("pvp: sale ended; stopping.")
            return

        try:
            mint_mock_reserve(
                w3,
                asset,
                attacker,
                victim.address,
                10**30,
                gas_multiplier=cfg.gas_multiplier,
                send=True,
            )
            mint_mock_reserve(
                w3,
                asset,
                attacker,
                attacker.address,
                10**22,
                gas_multiplier=cfg.gas_multiplier,
                send=True,
            )

            approve_if_needed(w3, asset, victim, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)
            for i in range(3):
                lo, hi = charm_bounds(tc)
                charm = charm_for_buy(tc, hi if i < 2 else lo)
                need = asset_amount_for_charm(tc, charm)
                bal = int(asset.functions.balanceOf(victim.address).call())
                if bal < need:
                    print(f"Victim balance too low ({bal}); mint failed?")
                    raise RuntimeError("victim underfunded")

                buy(w3, tc, victim, charm, gas_multiplier=cfg.gas_multiplier, send=True)

            vbp = int(tc.functions.battlePoints(victim.address).call())
            abp = int(tc.functions.battlePoints(attacker.address).call())
            print(f"BP before steal: victim={vbp} attacker={abp}")
            if vbp < 2 * max(abp, 1):
                print("Onchain 2x rule may revert steal; add more victim buys or reset Anvil.")
                raise RuntimeError("2x rule not met")

            approve_if_needed(w3, asset, attacker, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)
            warbow_steal(
                w3,
                tc,
                attacker,
                victim.address,
                False,
                gas_multiplier=cfg.gas_multiplier,
                send=True,
            )
        except Exception as e:
            print(f"pvp: cycle failed ({e!s}); retrying after delay")
            time.sleep(min(30.0, mean))
            continue

        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)
