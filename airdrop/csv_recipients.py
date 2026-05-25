"""Shared parsing for airdrop CSV files (address,amount per line)."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_ZERO_ADDRESS = "0x" + "0" * 40


@dataclass(frozen=True)
class RecipientRow:
    line_no: int
    address: str
    amount: Decimal
    amount_wei: int


def parse_amount_wei(raw: str) -> tuple[Decimal, int]:
    value = raw.strip()
    if not value:
        raise ValueError("empty amount")
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"invalid amount: {raw!r}") from exc
    if amount <= 0:
        raise ValueError(f"amount must be positive: {raw!r}")
    wei = int(amount * Decimal(10**18))
    if wei <= 0:
        raise ValueError(f"amount rounds to zero: {raw!r}")
    return amount, wei


def normalize_address(raw: str) -> str:
    address = raw.strip()
    if not _ADDRESS_RE.match(address):
        raise ValueError(f"invalid address (expected 0x + 40 hex): {raw!r}")
    if address.lower() == _ZERO_ADDRESS:
        raise ValueError("zero address")
    return address.lower()


def parse_recipient_csv(path: Path) -> tuple[list[RecipientRow], list[str]]:
    """Parse every data row; return (valid rows, error messages with line numbers)."""
    rows: list[RecipientRow] = []
    errors: list[str] = []

    with path.open(newline="", encoding="utf-8") as handle:
        for line_no, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                parsed = next(csv.reader([line]))
                if len(parsed) != 2:
                    raise ValueError(f"expected address,amount — got {raw_line!r}")
                address = normalize_address(parsed[0])
                amount, amount_wei = parse_amount_wei(parsed[1])
                rows.append(
                    RecipientRow(
                        line_no=line_no,
                        address=address,
                        amount=amount,
                        amount_wei=amount_wei,
                    )
                )
            except ValueError as exc:
                errors.append(f"line {line_no}: {exc}")

    if not rows and not errors:
        errors.append(f"{path.name}: no recipients (empty or comments only)")

    return rows, errors


def load_recipient_rows(path: Path) -> list[RecipientRow]:
    rows, errors = parse_recipient_csv(path)
    if errors:
        raise ValueError(errors[0] if len(errors) == 1 else f"{len(errors)} errors; first: {errors[0]}")
    if not rows:
        raise ValueError(f"{path}: no recipients (empty or comments only)")
    return rows


def load_recipients(path: Path) -> tuple[list[str], list[int]]:
    """Return parallel address and wei arrays (for disperse)."""
    rows = load_recipient_rows(path)
    return [r.address for r in rows], [r.amount_wei for r in rows]
