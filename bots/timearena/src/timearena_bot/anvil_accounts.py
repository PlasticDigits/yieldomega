# SPDX-License-Identifier: AGPL-3.0-only
"""Default Anvil mnemonic + BIP44 paths — matches `anvil` dev accounts (test junk mnemonic)."""

from __future__ import annotations

from eth_account import Account

# Same mnemonic Foundry Anvil prints on startup (local dev only).
_DEFAULT_MNEMONIC = "test test test test test test test test test test test junk"
_DEFAULT_PATH_PREFIX = "m/44'/60'/0'/0"


def _ensure_hdwallet() -> None:
    Account.enable_unaudited_hdwallet_features()


def private_key_hex(index: int) -> str:
    """Hex private key (no 0x) for Anvil account `index` (same as `anvil` account list order)."""
    if index < 0:
        raise ValueError("account index must be non-negative")
    _ensure_hdwallet()
    path = f"{_DEFAULT_PATH_PREFIX}/{index}"
    acct = Account.from_mnemonic(_DEFAULT_MNEMONIC, account_path=path)
    return acct.key.hex()


def address_at(index: int) -> str:
    """Checksummed address for Anvil account `index`."""
    _ensure_hdwallet()
    path = f"{_DEFAULT_PATH_PREFIX}/{index}"
    acct = Account.from_mnemonic(_DEFAULT_MNEMONIC, account_path=path)
    return acct.address
