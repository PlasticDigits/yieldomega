#!/usr/bin/env python3
"""FFI helper: export first N CSV rows as JSON for Forge tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from csv_recipients import load_recipients


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: export_batch.py <csv> <n>", file=sys.stderr)
        raise SystemExit(2)
    path = Path(sys.argv[1])
    n = int(sys.argv[2])
    recipients, amounts_wei = load_recipients(path)
    n = min(n, len(recipients))
    sys.stdout.write(
        json.dumps(
            {
                "recipients": recipients[:n],
                "amountsWei": [str(a) for a in amounts_wei[:n]],
            }
        )
    )


if __name__ == "__main__":
    main()
