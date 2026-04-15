# SPDX-License-Identifier: AGPL-3.0-only
"""Web3 HTTP provider and optional Anvil-only JSON-RPC helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

if TYPE_CHECKING:
    from timecurve_bot.config import BotConfig


def make_web3(rpc_url: str) -> Web3:
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 120}))
    try:
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    except Exception:
        pass
    if not w3.is_connected():
        raise ConnectionError(f"Could not connect to RPC: {rpc_url}")
    return w3


def assert_chain_id(w3: Web3, expected: int) -> None:
    got = w3.eth.chain_id
    if int(got) != int(expected):
        raise ValueError(f"Chain id mismatch: RPC reports {got}, config expects {expected}.")


def anvil_increase_time(w3: Web3, seconds: int) -> None:
    # Foundry Anvil JSON-RPC (see https://book.getfoundry.sh/reference/anvil/)
    w3.provider.make_request("anvil_increaseTime", [seconds])  # type: ignore[union-attr]
    w3.provider.make_request("anvil_mine", [])  # type: ignore[union-attr]


def anvil_mine(w3: Web3, blocks: int = 1) -> None:
    for _ in range(max(1, blocks)):
        w3.provider.make_request("anvil_mine", [])  # type: ignore[union-attr]


def anvil_set_balance(w3: Web3, address: str, balance_wei: int) -> None:
    """Foundry Anvil: set native ETH balance (local dev only)."""
    w3.provider.make_request(  # type: ignore[union-attr]
        "anvil_setBalance",
        [Web3.to_checksum_address(address), hex(int(balance_wei))],
    )


def ensure_anvil_cheat_allowed(cfg: BotConfig, w3: Web3) -> None:
    if not cfg.allow_anvil_cheat:
        raise ValueError("This action needs --allow-anvil-cheat (local Anvil only; never on public RPC).")
    if int(cfg.chain_id) != 31337:
        raise ValueError("Anvil cheats are only allowed when YIELDOMEGA_CHAIN_ID=31337 (got {}).".format(cfg.chain_id))
    assert_chain_id(w3, cfg.chain_id)
