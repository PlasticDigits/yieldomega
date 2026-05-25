# DOUB airdrop (batch disperse)

Batch-send DOUB (or any ERC-20) to many wallets in one transaction using [`DoubAirdrop`](../contracts/src/DoubAirdrop.sol) (disperse.app-style).

## CSV format

Place recipient lists in this folder as `*.csv` (gitignored except `*.example.csv`):

```text
{address},{amount}
```

- **address** — checksummed or lowercase `0x` + 40 hex
- **amount** — token amount in **whole DOUB units** (18 decimals applied automatically), e.g. `1000` or `1000.5`
- Lines starting with `#` and blank lines are ignored

Example: [`recipients.example.csv`](./recipients.example.csv). Production list: [`doub.csv`](./doub.csv) (gitignored).

## Validate before sending

```bash
python3 airdrop/validate.py                    # default: airdrop/doub.csv
python3 airdrop/validate.py airdrop/my-list.csv
python3 airdrop/validate.py --show-duplicates  # list duplicate wallets if any
```

Checks every row: `0x` + 40 hex address (non-zero), positive DOUB amount, no duplicate addresses (unless `--allow-duplicates`). Prints **total spend** in DOUB and wei.

## Deployed `DoubAirdrop`

| Network | Chain ID | Address |
| -------- | -------- | ------- |
| MegaETH mainnet | `4326` | [`0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d`](https://mega.etherscan.io/address/0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d) |

Default for scripts and env:

```bash
export DOUB_AIRDROP_ADDRESS=0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d
```

## Deploy the contract (other chains)

From `contracts/`:

```bash
forge create src/DoubAirdrop.sol:DoubAirdrop --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

On non-mainnet networks, set `DOUB_AIRDROP_ADDRESS` to the address you deployed.

## Run an airdrop

**Recommended:** [`run-doub-airdrop.sh`](./run-doub-airdrop.sh) — MegaETH defaults, validates CSV, **505 rows/tx**, hidden key prompt on broadcast (same pattern as [`scripts/deploy-megaeth-contracts.sh`](../scripts/deploy-megaeth-contracts.sh)).

```bash
# From repo root — preview cast commands (no key)
airdrop/run-doub-airdrop.sh --dry-run

# Approve DOUB only (hidden key once)
airdrop/run-doub-airdrop.sh --approve-only

# Send all batches (hidden key; auto-approves if allowance is low)
airdrop/run-doub-airdrop.sh --broadcast
```

The script checks balance, approves the full CSV total to `DoubAirdrop` when needed, then asks you to type **`YES`** before sending **8** transactions for `doub.csv`.

**If a batch reverts with `execution reverted` and allowance was 0:** older script versions skipped `approve` because bash cannot compare wei values above 2⁶³. Re-run on the current script, or run `airdrop/run-doub-airdrop.sh --approve-only` first.

**Private key safety:** `cast` requires `--private-key`; the scripts append it at runtime but only print `<redacted>` in echoed commands. Avoid screen recording during broadcast. If scrollback shows a full key from an older `disperse.py` run, rotate that key.

**Lower-level** (key in env — avoid on shared machines):

```bash
export RPC_URL=https://mainnet.megaeth.com/rpc
export DOUB_TOKEN=0xc3654B4f879937B767aFBB64B7C230FF436d2342
export DOUB_AIRDROP_ADDRESS=0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d
export PRIVATE_KEY=0x...   # not used by run-doub-airdrop.sh

python3 airdrop/disperse.py airdrop/doub.csv --dry-run
python3 airdrop/disperse.py airdrop/doub.csv --broadcast
```

Default chunking is **505** recipients per tx (`--max-rows 0` disables chunking).

### Batch size (MegaETH mainnet probes, 2026-05)

Measured with [`probe_megaeth_batch.py`](./probe_megaeth_batch.py) (live `cast call` + balance override on `doub.csv` wallets — sampled **25/25 had zero DOUB**) and [`contracts/test/DoubAirdropMegaethFork.t.sol`](../contracts/test/DoubAirdropMegaethFork.t.sol) (mainnet fork gas).

| Probe | Result |
|--------|--------|
| Live RPC `eth_call` simulation | **505 recipients OK**; **510+** returns HTTP **413 payload too large** on `https://mainnet.megaeth.com/rpc` (~32 KiB calldata cap), not an onchain revert |
| Fork gas (`forge test … --fork-url megaeth --ffi`) | **1000 → ~26.1M gas**, **1500 → ~39.2M**, **2000 → ~52.3M** — all succeed on fork (well under 10B gas / 200M compute caps) |
| Docs state-growth limit (1,000 new slots / tx) | **Not hit in these probes**; **505 new slots simulated OK**, so the cap is **> 505** if it applies to this pattern. **1000+ cannot be simulated** on the public RPC due to 413; confirm with one small funded mainnet tx before the full drop |

**Planning `doub.csv` (3,850 rows):**

- **`disperse.py` default (`--max-rows 505`)** → **8 transactions** for `doub.csv`
- If your wallet RPC accepts larger calldata, try **`--max-rows 1000`** (or higher) on a **small test batch** first after a funded mainnet probe tx

```bash
# Live simulation sweep (needs airdrop/.venv)
python3 -m venv airdrop/.venv && airdrop/.venv/bin/pip install eth_abi eth_utils "eth-hash[pycryptodome]"
FOUNDRY_DISABLE_NIGHTLY_WARNING=1 airdrop/.venv/bin/python airdrop/probe_megaeth_batch.py

# Fork gas (from contracts/)
FOUNDRY_DISABLE_NIGHTLY_WARNING=1 forge test --match-contract DoubAirdropMegaethFork --fork-url megaeth -vv --ffi
```

## Manual `cast` (small lists)

```bash
doub approve "$DOUB_AIRDROP_ADDRESS" "$(cast --from-wei 350e18)" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

cast send "$DOUB_AIRDROP_ADDRESS" \
  "disperseToken(address,address[],uint256[])" \
  "$DOUB_TOKEN" \
  "[0xAlice,0xBob]" \
  "[$(cast --to-wei 100),$(cast --to-wei 250)]" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```
