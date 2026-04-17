# SPDX-License-Identifier: AGPL-3.0-only

from web3 import Web3

from timecurve_bot.anvil_extra_addresses import (
    merge_funded_recipients,
    parse_extra_funded_addresses,
)


def test_parse_extra_funded_addresses_empty() -> None:
    assert parse_extra_funded_addresses(None) == []
    assert parse_extra_funded_addresses("") == []
    assert parse_extra_funded_addresses("  \n") == []


def test_parse_extra_funded_addresses_comma_and_space() -> None:
    a = "0x1111111111111111111111111111111111111111"
    b = "0x2222222222222222222222222222222222222222"
    got = parse_extra_funded_addresses(f"{a}, {b}")
    assert len(got) == 2
    assert got[0] == Web3.to_checksum_address(a)
    assert got[1] == Web3.to_checksum_address(b)


def test_parse_skips_invalid_and_dedupes_by_parse_order() -> None:
    a = "0x1111111111111111111111111111111111111111"
    raw = f"{a}, not-an-address, {a}"
    got = parse_extra_funded_addresses(raw)
    assert len(got) == 1


def test_merge_funded_recipients_dedupes_with_base() -> None:
    base_a = Web3.to_checksum_address("0x1111111111111111111111111111111111111111")
    extra_same = Web3.to_checksum_address("0x1111111111111111111111111111111111111111")
    other = Web3.to_checksum_address("0x3333333333333333333333333333333333333333")
    merged, n_new = merge_funded_recipients([base_a], [extra_same, other])
    assert n_new == 1
    assert len(merged) == 2
    assert merged[1] == other
