# SPDX-License-Identifier: AGPL-3.0-only
"""Exercise WarBow steal path: high-BP victim, low-BP attacker (second key)."""

from __future__ import annotations

import os
import random
import time

from timearena_bot.actions import (
    account_from_config,
    approve_if_needed,
    print_dry,
    warbow_steal,
)
from timearena_bot.config import BotConfig
from timearena_bot.strategies.common import APPROVE_LARGE, asset_amount_for_charm, charm_bounds, loop_mean_sec, sale_ended
from timearena_bot.strategies.warbow_setup import (
    WARBOW_MIN_LEVEL,
    player_level,
    seed_warbow_steal_band,
    steal_band_state,
)
from web3 import Web3
from web3.contract import Contract

# Anvil account #1 — local dev only; override with YIELDOMEGA_PVP_VICTIM_PRIVATE_KEY
_DEFAULT_VICTIM_PK = (
    "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
)


def _ensure_doub_balance(asset: Contract, address: str, min_wei: int, label: str) -> None:
    bal = int(asset.functions.balanceOf(Web3.to_checksum_address(address)).call())
    if bal < min_wei:
        raise RuntimeError(
            f"{label} DOUB balance {bal} < {min_wei}; swarm bootstrap must fund wallets (no minter on attacker)"
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
        f"pvp: loop victim {victim.address} buys + attacker {attacker.address} warbowSteal "
        f"(level ≥ {WARBOW_MIN_LEVEL}, 2×–10× BP band); mean inter-cycle={mean}s"
    )

    if not send:
        print_dry("pvp", "would fund victim buys then warbowSteal from attacker (loop)")
        return

    lo, hi = charm_bounds(tc)
    min_need = asset_amount_for_charm(tc, lo)
    max_need = asset_amount_for_charm(tc, hi)
    _ensure_doub_balance(asset, victim.address, max_need * 8, "victim")
    _ensure_doub_balance(asset, attacker.address, max_need * 8 + int(tc.functions.WARBOW_STEAL_DOUB().call()), "attacker")

    approve_if_needed(w3, asset, victim, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)
    approve_if_needed(w3, asset, attacker, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    while True:
        if sale_ended(w3, tc):
            print("pvp: sale ended; stopping.")
            return

        try:
            atk_lvl = player_level(tc, attacker.address)
            vic_lvl = player_level(tc, victim.address)
            if atk_lvl < WARBOW_MIN_LEVEL or vic_lvl < WARBOW_MIN_LEVEL:
                print(f"pvp: leveling (victim L{vic_lvl}, attacker L{atk_lvl}) → L{WARBOW_MIN_LEVEL}+")
            seed_warbow_steal_band(w3, tc, victim, attacker, cfg)

            vbp, abp, ok = steal_band_state(tc, victim.address, attacker.address)
            print(f"pvp: BP before steal victim={vbp} attacker={abp} (attacker L{player_level(tc, attacker.address)})")
            if not ok:
                raise RuntimeError(
                    f"steal band not met (need victim BP in [2×, 10×] attacker BP; got {vbp} vs {abp})"
                )

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
