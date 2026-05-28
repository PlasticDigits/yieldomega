# SPDX-License-Identifier: AGPL-3.0-only
"""Web3 HTTP provider and optional one-shot Anvil dev funding (chain 31337 only)."""

from __future__ import annotations

from typing import Sequence

from web3 import Web3
from web3.contract import Contract
from web3.middleware import ExtraDataToPOAMiddleware

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


def _anvil_set_balance(w3: Web3, address: str, balance_wei: int) -> None:
    w3.provider.make_request(  # type: ignore[union-attr]
        "anvil_setBalance",
        [Web3.to_checksum_address(address), hex(int(balance_wei))],
    )


def anvil_dev_bootstrap_funding_if_enabled(
    cfg: BotConfig,
    w3: Web3,
    *,
    deployer_pk: str,
    asset: Contract,
    recipient_addresses: Sequence[str],
    mint_wei: int,
    eth_wei_per_address: int,
    gas_multiplier: float,
    skip_mint: bool,
) -> None:
    """
    Once at startup: `anvil_setBalance` for gas + optional mock reserve mint to each recipient.

    No-op unless `cfg.allow_anvil_funding` is true. Only chain 31337 (local Anvil) — mainnet bots must
    never enable this flag.
    """
    if not cfg.allow_anvil_funding:
        return
    if int(cfg.chain_id) != 31337:
        raise ValueError(
            "Anvil dev funding is only allowed when YIELDOMEGA_CHAIN_ID=31337 (local Anvil). "
            "Do not set YIELDOMEGA_ALLOW_ANVIL_FUNDING on mainnet."
        )
    from timecurve_bot.actions import account_from_config, mint_mock_reserve

    deployer = account_from_config(deployer_pk)
    for addr in recipient_addresses:
        _anvil_set_balance(w3, addr, eth_wei_per_address)
    if skip_mint:
        return
    for addr in recipient_addresses:
        mint_mock_reserve(
            w3,
            asset,
            deployer,
            Web3.to_checksum_address(addr),
            mint_wei,
            gas_multiplier=gas_multiplier,
            send=True,
        )
