# SPDX-License-Identifier: AGPL-3.0-only
from timecurve_bot.anvil_accounts import private_key_hex


def test_anvil_account0_matches_foundry_default() -> None:
    assert private_key_hex(0) == "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
