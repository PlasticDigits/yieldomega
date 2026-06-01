# Presale DOUB — instant distribution (`sendNow`)

MegaETH mainnet policy: pay the **21.5M DOUB** presale bucket to vesting beneficiaries **in full**, without cliff/linear vesting. Onchain path: UUPS upgrade `DoubPresaleVesting`, then owner **`sendNow()`**.

**Authoritative addresses:** [`indexer/address-registry.megaeth-mainnet.json`](../../indexer/address-registry.megaeth-mainnet.json).

| Contract | Proxy (4326) |
|----------|----------------|
| **DOUB** (`Doubloon`) | `0xc3654B4f879937B767aFBB64B7C230FF436d2342` |
| **DoubPresaleVesting** | `0xB4128c9f52dC345aD13680973146b23f5383dda0` |
| **Owner** (`owner()`) | CL8Y manager `0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c` |

**CHARM +15%** is unrelated to these DOUB wallets: the presale CHARM beneficiary registry (`0x6bfe055e767bF777a963157a6AEdE2F1e3eE2107`) may point at a **different** wallet list than DOUB vesting allocations. Boost list ≠ vesting claim list for wallet #1.

---

## Beneficiaries and amounts (onchain today)

Reads from live proxy storage (`allocationOf`); sums to **`totalAllocated` = 21_500_000 DOUB**.

| Beneficiary (vesting / DOUB recipient) | DOUB (whole tokens) | `allocationOf` (wei) |
|----------------------------------------|---------------------|----------------------|
| `0x0965a4Ce0e6eDDd87eA8F6cF73a8462b8B47fc7D` | **10_000_000** | `10000000000000000000000000` |
| `0x7fb70BC1d5D30945f64a91B4a9C84792dfA9403b` | **4_000_000** | `4000000000000000000000000` |
| `0x45999a8Dd96b4df3AadBC395669b2b0928a7aF17` | **5_000_000** | `5000000000000000000000000` |
| `0x6186290B28D511bFF971631c916244A9fC539cfE` | **2_000_000** | `2000000000000000000000000` |
| `0x212D17402321BD15D092A3444766649d00c5A9F4` | **500_000** | `500000000000000000000000` |
| **Total** | **21_500_000** | `21500000000000000000000000` |

**Pre-flight (RPC):**

```bash
export RPC_URL='https://mainnet.megaeth.com/rpc'
VEST='0xB4128c9f52dC345aD13680973146b23f5383dda0'
DOUB='0xc3654B4f879937B767aFBB64B7C230FF436d2342'

cast call $VEST 'totalAllocated()(uint256)' --rpc-url $RPC_URL
cast call $DOUB 'balanceOf(address)(uint256)' $VEST --rpc-url $RPC_URL
cast call $VEST 'presaleDistributed()(bool)' --rpc-url $RPC_URL
cast call $VEST 'vestingStart()(uint256)' --rpc-url $RPC_URL
```

Expect **`balanceOf(vesting) >= totalAllocated`**, **`presaleDistributed == false`**, **`vestingStart == 0`** before `sendNow`.

---

## What `sendNow()` does

- **`onlyOwner`**, **once**: transfers **`allocationOf[b] − claimedOf[b]`** to each beneficiary, sets **`claimedOf[b] = allocationOf[b]`**, sets **`presaleDistributed = true`**.
- Emits **`Claimed(beneficiary, amount)`** per payout (indexer-friendly) and **`PresaleDistributedNow(totalSent, recipientsPaid)`**.
- Afterward: **`startVesting`**, beneficiary **`claim`**, and **`reduceAllocationsUniformBps`** revert **`DoubVesting__AlreadyDistributed`**.
- Does **not** require **`startVesting`**, **`claimsEnabled`**, or a schedule.

Implementation: [`contracts/src/vesting/DoubPresaleVesting.sol`](../../contracts/src/vesting/DoubPresaleVesting.sol).

---

## Step 1 — Build and test (offchain)

From repo root:

```bash
cd contracts
forge test --match-contract DoubPresaleVestingTest -vv
forge build
```

---

## Step 2 — Deploy new implementation (MegaETH 4326)

Use the **same** compiler profile as production ([`contracts/foundry.toml`](../../contracts/foundry.toml)). **Do not** deploy a new proxy; only the **logic** contract.

```bash
cd contracts
export ETHERSCAN_API_KEY='…'   # never commit

forge create src/vesting/DoubPresaleVesting.sol:DoubPresaleVesting \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --chain 4326 \
  --broadcast \
  --verify \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --interactive
```

Record **`Deployed to: 0x…`** as **`NEW_IMPL`**.

Optional verify-only if deploy succeeded without verification:

```bash
forge verify-contract <NEW_IMPL> src/vesting/DoubPresaleVesting.sol:DoubPresaleVesting \
  --chain 4326 \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --watch
```

**Storage layout:** new code **appends** `presaleDistributed` before `__gap`; existing proxy storage is unchanged. Upgrade calldata is **`0x`** (no reinitializer).

Confirm implementation slot after upgrade:

```bash
cast storage 0xB4128c9f52dC345aD13680973146b23f5383dda0 \
  0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
  --rpc-url https://mainnet.megaeth.com/rpc
```

Last 20 bytes of the word = **`NEW_IMPL`**.

Update [root `README.md`](../../README.md) **Verified `DoubPresaleVesting` implementation** line when publishing.

---

## Step 3 — UUPS upgrade the live proxy

From repo root (signer = **`owner()`** on the vesting proxy):

```bash
scripts/uups-upgrade-doub-presale-vesting-mainnet.sh <NEW_IMPL>
```

Manual equivalent:

```bash
cast send 0xB4128c9f52dC345aD13680973146b23f5383dda0 \
  "upgradeToAndCall(address,bytes)" <NEW_IMPL> 0x \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --interactive
```

If MegaETH gas estimation fails, set **`CAST_GAS_LIMIT`** and pass through the script env (see [`foundry-and-megaeth.md`](../contracts/foundry-and-megaeth.md)).

**Smoke read** after upgrade (implementation address must expose `sendNow`):

```bash
cast call 0xB4128c9f52dC345aD13680973146b23f5383dda0 \
  'presaleDistributed()(bool)' --rpc-url https://mainnet.megaeth.com/rpc
# false
```

---

## Step 4 — Distribute (`sendNow`)

Single transaction from **`owner()`** (CL8Y manager multisig / EOA that holds `owner()`):

```bash
cast send 0xB4128c9f52dC345aD13680973146b23f5383dda0 \
  'sendNow()' \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --interactive
```

---

## Step 5 — Post-distribution checks

```bash
VEST='0xB4128c9f52dC345aD13680973146b23f5383dda0'
DOUB='0xc3654B4f879937B767aFBB64B7C230FF436d2342'
RPC='https://mainnet.megaeth.com/rpc'

cast call $VEST 'presaleDistributed()(bool)' --rpc-url $RPC
cast call $DOUB 'balanceOf(address)(uint256)' $VEST --rpc-url $RPC

# Each beneficiary — balance should match allocation table
for w in \
  0x0965a4Ce0e6eDDd87eA8F6cF73a8462b8B47fc7D \
  0x7fb70BC1d5D30945f64a91B4a9C84792dfA9403b \
  0x45999a8Dd96b4df3AadBC395669b2b0928a7aF17 \
  0x6186290B28D511bFF971631c916244A9fC539cfE \
  0x212D17402321BD15D092A3444766649d00c5A9F4
do
  echo "$w"
  cast call $DOUB 'balanceOf(address)(uint256)' "$w" --rpc-url $RPC
  cast call $VEST 'claimedOf(address)(uint256)' "$w" --rpc-url $RPC
done
```

**Expected:** `presaleDistributed == true`, vesting contract DOUB balance **0** (or only stray dust if someone transferred DOUB in later), each wallet **`claimedOf == allocationOf`**, five **`Claimed`** events in the upgrade tx receipt.

**`/vesting` UI:** beneficiaries will see **zero claimable**; full balance is already in their wallets. Optional comms: presale paid via **`sendNow`**, not the cliff/linear schedule.

**Excess DOUB** sent to the vesting contract after `sendNow` may be **`rescueERC20`**’d by owner (`reserve` is 0 once all rows are marked claimed).

---

## Order of operations (summary)

| # | Action | Who |
|---|--------|-----|
| 1 | `forge test` / audit commit | Engineering |
| 2 | `forge create` → **`NEW_IMPL`** | Deployer EOA (verified on explorer) |
| 3 | `upgradeToAndCall(NEW_IMPL, 0x)` on **proxy** | **`owner()`** |
| 4 | `sendNow()` on **proxy** | **`owner()`** |
| 5 | Balance / event checks | Ops |

**Do not** call `startVesting()` if using instant distribution — it is blocked after `sendNow` anyway, and unnecessary before.

---

## Related docs

- [Deployment guide — presale vesting env](deployment-guide.md#complete-exports-megaeth-contracts-deploy)
- [Final signoff gates](final-signoff-and-value-movement.md) — `claimsEnabled` / `startVesting` are obsolete for this presale path once `sendNow` runs
- [Frontend presale vesting](../frontend/presale-vesting.md)
