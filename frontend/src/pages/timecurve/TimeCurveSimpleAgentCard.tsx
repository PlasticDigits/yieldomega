// SPDX-License-Identifier: AGPL-3.0-only

import { IndexerStatusBar } from "@/components/IndexerStatusBar";
import { ReferralsFooterPendingPill } from "@/components/ReferralsFooterPendingPill";
import { FeeTransparency } from "@/components/FeeTransparency";
import { addresses, governanceUrl, indexerBaseUrl, parseHexAddress } from "@/lib/addresses";
import { resolveChainRpcConfig } from "@/lib/chain";
import { PODIUM_CONTRACT_CATEGORY_INDEX, PODIUM_LABELS } from "@/pages/timecurve/podiumCopy";

/** Public GitHub mirror (`main`). Paths match the GitLab monorepo layout. */
const GH_MAIN = "https://github.com/PlasticDigits/yieldomega/blob/main";
const GH_RAW = "https://raw.githubusercontent.com/PlasticDigits/yieldomega/main";

function ghBlob(path: string) {
  return `${GH_MAIN}/${path}`;
}

function ghRaw(path: string) {
  return `${GH_RAW}/${path}`;
}

const PLAY_SKILLS_SIMPLE: { label: string; path: string }[] = [
  { label: "play-timecurve-doubloon (buys, redeem, referrals)", path: "skills/play-timecurve-doubloon/SKILL.md" },
  { label: "play-timecurve-warbow (BP, steal, guard, flag)", path: "skills/play-timecurve-warbow/SKILL.md" },
  { label: "script-with-timecurve-local (RPC vs indexer time)", path: "skills/script-with-timecurve-local/SKILL.md" },
];

const CONTRIBUTOR_SKILL = {
  label: "yieldomega-guardrails",
  path: ".cursor/skills/yieldomega-guardrails/SKILL.md",
};

const DOCS_SIMPLE: { label: string; path: string }[] = [
  { label: "TimeCurve primitives (four podiums, timer, WarBow)", path: "docs/product/primitives.md" },
  { label: "TimeCurve frontend views (phase, Kumbaya, audio)", path: "docs/frontend/timecurve-views.md" },
  { label: "Kumbaya single-tx buy + router", path: "docs/integrations/kumbaya.md" },
  { label: "Invariants index (INV-*)", path: "docs/testing/invariants-and-business-logic.md" },
];

const INDEXER_ROUTES_SIMPLE = `GET /v1/timecurve/chain-timer
GET /v1/timecurve/podiums
GET /v1/timecurve/buys
GET /v1/timecurve/warbow/leaderboard
GET /v1/timecurve/warbow/battle-feed`;

/** `TimeCurve.podium(uint8)` category indices (see `CAT_*` view functions onchain). */
const PODIUM_CAT_ONCHAIN = {
  lastBuy: 0,
  timeBooster: 1,
  defendedStreak: 2,
  warbow: 3,
} as const;

/** Raw GitHub URLs baked into Python snippets (copy-paste safe; matches `ghRaw` in this module). */
const PY_DEFAULT_TIMECURVE_ABI_URL = `${GH_RAW}/frontend/public/abis/TimeCurve.json`;
const PY_DEFAULT_BUY_ROUTER_ABI_URL = `${GH_RAW}/frontend/public/abis/TimeCurveBuyRouter.json`;

const PY_ABI_BOOTSTRAP = `import json
import os
import urllib.request
from pathlib import Path
from web3 import Web3

# MegaETH mainnet production — indexer/address-registry.megaeth-mainnet.json (chain 4326)
MEGAETH_MAINNET_CHAIN_ID = 4326
DEFAULT_RPC_URL = "https://mainnet.megaeth.com/rpc"
DEFAULT_TIMECURVE_ABI_URL = "${PY_DEFAULT_TIMECURVE_ABI_URL}"
DEFAULT_BUY_ROUTER_ABI_URL = "${PY_DEFAULT_BUY_ROUTER_ABI_URL}"
TIMECURVE = Web3.to_checksum_address("0x1b68bb6789baeba4bd28f53c10b52dbe1ef2bf71")
TIMECURVE_BUY_ROUTER_ADDR = Web3.to_checksum_address("0xb09542acae355c5ea42345522d403c1742c75b61")


def _fetch_json_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": "yieldomega-timecurve-sketch"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def _abi_from_raw(raw):
    return raw["abi"] if isinstance(raw, dict) and "abi" in raw else raw


def load_timecurve_abi():
    path = os.environ.get("TIMECURVE_ABI_JSON", "").strip()
    if path:
        raw = json.loads(Path(path).read_text())
    else:
        url = os.environ.get("TIMECURVE_ABI_URL", DEFAULT_TIMECURVE_ABI_URL)
        raw = _fetch_json_url(url)
    return _abi_from_raw(raw)


TIME_CURVE_ABI = load_timecurve_abi()`;

/** Shared Python: CL8Y approve → TimeCurve.buy*, or Kumbaya single-tx buyViaKumbaya; WarBow CL8Y burns. */
const PY_SKETCH_SHARED = `# --- approvals + routing (sketch; simulate on your fork first) ---
# Contract addresses default to MegaETH mainnet production (see PY_ABI_BOOTSTRAP). Forks: ALLOW_CHAIN_MISMATCH=1.
# PRIVATE_KEY required. RPC_URL defaults to MegaETH public JSON-RPC; override for other providers.
# TimeCurve ABI: downloaded from GitHub raw unless TIMECURVE_ABI_JSON (local file) or TIMECURVE_ABI_URL is set.
# CL8Y: approve acceptedAsset → TimeCurve for gross CL8Y (price × charmWad / WAD), then buy.
#   ERC20_APPROVE_UNLIMITED=true → approve 2**256-1 (some tokens reject; omit for exact headroom).
#   BUY_APPROVE_SLIPPAGE_BPS (default 100) pads the approve amount when not unlimited.
# Kumbaya single-tx: PAY_MODE=ROUTER_ETH | ROUTER_STABLE (router address baked for mainnet; ABI downloaded by default),
#   KUMBAYA_PATH (0x-packed exactOutput path: CL8Y first token …), KUMBAYA_AMOUNT_IN_MAXIMUM (swap cap),
#   ROUTER_ETH: KUMBAYA_MSG_VALUE_WEI (defaults to KUMBAYA_AMOUNT_IN_MAXIMUM) for msg.value.
#   ROUTER_STABLE: approve deployment stableToken → router for KUMBAYA_AMOUNT_IN_MAXIMUM before each buy.
# Referrals / flag: REFERRAL_CODE_HASH (bytes32 hex or empty), PLANT_WARBOW_FLAG=true|false.
# Swap deadline: chain head timestamp + KUMBAYA_SWAP_DEADLINE_SEC (default 600) — see docs/integrations/kumbaya.md.
_ROUTER_ABI_CACHE = None


def require_expected_chain(w3):
    if int(os.environ.get("ALLOW_CHAIN_MISMATCH", "0")) == 1:
        return
    cid = w3.eth.chain_id
    if cid != MEGAETH_MAINNET_CHAIN_ID:
        raise SystemExit(
            "chain_id %s != mainnet %s — point RPC_URL at MegaETH 4326 or set ALLOW_CHAIN_MISMATCH=1 on forks"
            % (cid, MEGAETH_MAINNET_CHAIN_ID)
        )


def buy_router_abi():
    global _ROUTER_ABI_CACHE
    if _ROUTER_ABI_CACHE is None:
        path = os.environ.get("TIMECURVE_BUY_ROUTER_ABI_JSON", "").strip()
        if path:
            raw = json.loads(Path(path).read_text())
        else:
            url = os.environ.get("TIMECURVE_BUY_ROUTER_ABI_URL", DEFAULT_BUY_ROUTER_ABI_URL)
            raw = _fetch_json_url(url)
        _ROUTER_ABI_CACHE = _abi_from_raw(raw)
    return _ROUTER_ABI_CACHE


WAD = 10**18
MAX_UINT = 2**256 - 1
ERC20_ABI = json.loads(
    """[{"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}]"""
)


def _nonce(w3, me):
    return w3.eth.get_transaction_count(me)


def _sign_send(w3, acct, tx):
    raw = w3.eth.account.sign_transaction(tx, acct.key).raw_transaction
    return w3.eth.send_raw_transaction(raw).hex()


def gross_cl8y_for_charm(tc, charm_wad):
    p = int(tc.functions.currentPricePerCharmWad().call())
    return (int(charm_wad) * p) // WAD


def ensure_erc20_allowance(erc20, owner, spender, min_required, acct, w3, me):
    if int(erc20.functions.allowance(owner, spender).call()) >= min_required:
        return
    unlimited = os.environ.get("ERC20_APPROVE_UNLIMITED", "false").lower() == "true"
    slip = int(os.environ.get("BUY_APPROVE_SLIPPAGE_BPS", "100"))
    approve_amt = MAX_UINT if unlimited else min_required + (min_required * slip // 10000)
    tx = erc20.functions.approve(spender, approve_amt).build_transaction(
        {"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id}
    )
    print("erc20 approve", spender, _sign_send(w3, acct, tx))


def referral_code_hash():
    ref = os.environ.get("REFERRAL_CODE_HASH", "").strip()
    if not ref or ref.lower() == "0x" + 64 * "0":
        return bytes(32)
    return Web3.to_bytes(hexstr=ref if ref.startswith("0x") else "0x" + ref)


def plant_warbow_flag():
    return os.environ.get("PLANT_WARBOW_FLAG", "false").lower() == "true"


def exec_timecurve_buy(tc, tc_addr, acct, w3, me, charm_wad):
    tc_addr = Web3.to_checksum_address(tc_addr)
    pay = os.environ.get("PAY_MODE", "CL8Y").upper()
    h32 = referral_code_hash()
    plant = plant_warbow_flag()
    if pay == "CL8Y":
        cl8y = Web3.to_checksum_address(tc.functions.acceptedAsset().call())
        tok = w3.eth.contract(address=cl8y, abi=ERC20_ABI)
        g = gross_cl8y_for_charm(tc, charm_wad)
        ensure_erc20_allowance(tok, me, tc_addr, g, acct, w3, me)
        if h32 != bytes(32):
            fn = tc.functions.buy(int(charm_wad), h32, plant)
        elif plant:
            fn = tc.functions.buy(int(charm_wad), True)
        else:
            fn = tc.functions.buy(int(charm_wad))
        tx = fn.build_transaction({"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id})
        return _sign_send(w3, acct, tx)
    r_abi = buy_router_abi()
    rt_addr = TIMECURVE_BUY_ROUTER_ADDR
    rt = w3.eth.contract(address=rt_addr, abi=r_abi)
    path = bytes.fromhex(os.environ["KUMBAYA_PATH"][2:])
    max_in = int(os.environ["KUMBAYA_AMOUNT_IN_MAXIMUM"])
    dl = int(w3.eth.get_block("latest")["timestamp"]) + int(os.environ.get("KUMBAYA_SWAP_DEADLINE_SEC", "600"))
    if pay in ("ROUTER_ETH", "ETH"):
        pay_k = int(rt.functions.PAY_ETH().call())
        val = int(os.environ.get("KUMBAYA_MSG_VALUE_WEI", str(max_in)))
        tx = rt.functions.buyViaKumbaya(int(charm_wad), h32, plant, pay_k, dl, max_in, path).build_transaction(
            {"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id, "value": val}
        )
        return _sign_send(w3, acct, tx)
    if pay in ("ROUTER_STABLE", "STABLE"):
        st = Web3.to_checksum_address(rt.functions.stableToken().call())
        stok = w3.eth.contract(address=st, abi=ERC20_ABI)
        ensure_erc20_allowance(stok, me, rt_addr, max_in, acct, w3, me)
        pay_k = int(rt.functions.PAY_STABLE().call())
        tx = rt.functions.buyViaKumbaya(int(charm_wad), h32, plant, pay_k, dl, max_in, path).build_transaction(
            {"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id}
        )
        return _sign_send(w3, acct, tx)
    raise SystemExit("PAY_MODE must be CL8Y, ROUTER_ETH, or ROUTER_STABLE")


def ensure_cl8y_for_timecurve_burn(tc, acct, w3, me, min_cl8y):
    tc_addr = Web3.to_checksum_address(tc.address)
    cl8y = Web3.to_checksum_address(tc.functions.acceptedAsset().call())
    tok = w3.eth.contract(address=cl8y, abi=ERC20_ABI)
    ensure_erc20_allowance(tok, me, tc_addr, int(min_cl8y), acct, w3, me)`;

const PY_LAST_BUY = `# Last Buy reserve podium — loop: buy only when <30s remain AND you are not already
# in any of the three rotating last-buy slots (podium(0) winners). CL8Y approve or Kumbaya router (PAY_MODE).
${PY_ABI_BOOTSTRAP}
${PY_SKETCH_SHARED}
import time

if not os.environ.get("PRIVATE_KEY"):
    raise SystemExit("PRIVATE_KEY required (never commit it)")
RPC_URL = os.environ.get("RPC_URL", DEFAULT_RPC_URL).strip()
w3 = Web3(Web3.HTTPProvider(RPC_URL))
require_expected_chain(w3)
acct = w3.eth.account.from_key(os.environ["PRIVATE_KEY"])
tc = w3.eth.contract(address=TIMECURVE, abi=TIME_CURVE_ABI)
me = Web3.to_checksum_address(acct.address)

def chain_ts():
    return int(w3.eth.get_block("latest")["timestamp"])

def nonzero(addr):
    return addr and int(addr, 16) != 0

def on_last_buy_podium(winners):
    return any(nonzero(w) and Web3.to_checksum_address(w).lower() == me.lower() for w in winners)

POLL = float(os.environ.get("POLL_SEC", "3"))

while True:
    if tc.functions.ended().call():
        print("sale ended — exiting"); break
    now = chain_ts()
    dl = int(tc.functions.deadline().call())
    if now >= dl:
        print("deadline passed — exiting"); break
    rem = dl - now
    winners, _ = tc.functions.podium(0).call()
    if on_last_buy_podium(winners):
        time.sleep(POLL); continue
    if rem > 30:
        time.sleep(min(POLL, max(1.0, rem - 25.0))); continue
    cool = int(tc.functions.nextBuyAllowedAt(me).call())
    if now < cool:
        time.sleep(min(POLL, cool - now + 1)); continue
    _min, max_wad = tc.functions.currentCharmBoundsWad().call()
    h = exec_timecurve_buy(tc, TIMECURVE, acct, w3, me, max_wad)
    print("last-buy sent", h); time.sleep(POLL)`;

const PY_WARBOW = `# WarBow ladder — loop: prefer revenge vs BP #1 ("head") when a window is open; else steal head if 2× rule passes.
# Head: INDEXER_URL + /v1/timecurve/warbow/leaderboard?limit=1 (live) else warbowLadderPodium().
# CL8Y approve to TimeCurve for each burn (revenge 1e18 / steal 1e18 + optional 50e18 bypass). buyFeeRoutingEnabled must be on for WarBow writes.
# Daily steal caps: WARBOW_STEAL_BYPASS=true if needed.
${PY_ABI_BOOTSTRAP}
${PY_SKETCH_SHARED}
import time
import urllib.request

if not os.environ.get("PRIVATE_KEY"):
    raise SystemExit("PRIVATE_KEY required (never commit it)")
RPC_URL = os.environ.get("RPC_URL", DEFAULT_RPC_URL).strip()
w3 = Web3(Web3.HTTPProvider(RPC_URL))
require_expected_chain(w3)
acct = w3.eth.account.from_key(os.environ["PRIVATE_KEY"])
tc = w3.eth.contract(address=TIMECURVE, abi=TIME_CURVE_ABI)
me = Web3.to_checksum_address(acct.address)
base = os.environ.get("INDEXER_URL", "").rstrip("/")

def ts():
    return int(w3.eth.get_block("latest")["timestamp"])

def head_addr():
    if base:
        url = base + "/v1/timecurve/warbow/leaderboard?limit=1"
        with urllib.request.urlopen(url, timeout=15) as r:
            j = json.loads(r.read().decode())
        items = j.get("items") or []
        if items:
            return Web3.to_checksum_address(items[0]["buyer"])
    win, _ = tc.functions.warbowLadderPodium().call()
    h = win[0]
    if not h or int(h, 16) == 0:
        return None
    return Web3.to_checksum_address(h)

def send(fn_tx):
    raw = w3.eth.account.sign_transaction(fn_tx, acct.key).raw_transaction
    return w3.eth.send_raw_transaction(raw).hex()

POLL = float(os.environ.get("POLL_SEC", "8"))

while True:
    if tc.functions.ended().call():
        print("sale ended — exiting"); break
    if int(w3.eth.get_block("latest")["timestamp"]) > int(tc.functions.deadline().call()):
        time.sleep(POLL); continue
    head = head_addr()
    if head is None or head.lower() == me.lower():
        time.sleep(POLL); continue
    now = ts()
    exp = int(tc.functions.warbowPendingRevengeExpiryExclusive(me, head).call())
    if exp != 0 and now < exp:
        need = int(tc.functions.WARBOW_REVENGE_BURN_WAD().call())
        ensure_cl8y_for_timecurve_burn(tc, acct, w3, me, need)
        tx = tc.functions.warbowRevenge(head).build_transaction(
            {"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id}
        )
        print("revenge head", send(tx)); time.sleep(POLL); continue
    abp = int(tc.functions.battlePoints(me).call())
    hbp = int(tc.functions.battlePoints(head).call())
    if abp > 0 and hbp >= 2 * abp:
        bypass = os.environ.get("WARBOW_STEAL_BYPASS", "false").lower() == "true"
        need = int(tc.functions.WARBOW_STEAL_BURN_WAD().call())
        if bypass:
            need += int(tc.functions.WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD().call())
        ensure_cl8y_for_timecurve_burn(tc, acct, w3, me, need)
        tx = tc.functions.warbowSteal(head, bypass).build_transaction(
            {"from": me, "nonce": _nonce(w3, me), "chainId": w3.eth.chain_id}
        )
        print("steal head", send(tx))
    else:
        print("skip head: bp", abp, "head_bp", hbp, "rev_exp", exp)
    time.sleep(POLL)`;

const PY_DEFENDED_STREAK = `# Defended Streak — loop: when no wallet has bought for 5m (indexer), buy until your best streak >= top podium value.
# Set INDEXER_URL. Buys use CL8Y approve or PAY_MODE=ROUTER_* (same env as other sketches). See docs/integrations/kumbaya.md for paths / caps.
${PY_ABI_BOOTSTRAP}
${PY_SKETCH_SHARED}
import time
import urllib.request

if not os.environ.get("PRIVATE_KEY"):
    raise SystemExit("PRIVATE_KEY required (never commit it)")
RPC_URL = os.environ.get("RPC_URL", DEFAULT_RPC_URL).strip()
w3 = Web3(Web3.HTTPProvider(RPC_URL))
require_expected_chain(w3)
acct = w3.eth.account.from_key(os.environ["PRIVATE_KEY"])
tc = w3.eth.contract(address=TIMECURVE, abi=TIME_CURVE_ABI)
me = Web3.to_checksum_address(acct.address)
base = os.environ.get("INDEXER_URL", "").rstrip("/")
SILENCE = int(os.environ.get("DEFENDED_SILENCE_SEC", "300"))
POLL = float(os.environ.get("POLL_SEC", "10"))

def chain_ts():
    return int(w3.eth.get_block("latest")["timestamp"])

def last_buy_age():
    if not base:
        return None
    url = base + "/v1/timecurve/buys?limit=1"
    with urllib.request.urlopen(url, timeout=15) as r:
        j = json.loads(r.read().decode())
    items = j.get("items") or []
    if not items:
        return None
    tsb = items[0].get("block_timestamp")
    if tsb is None:
        return None
    return chain_ts() - int(tsb)

while True:
    if tc.functions.ended().call():
        print("sale ended — exiting"); break
    now = chain_ts()
    dl = int(tc.functions.deadline().call())
    if now >= dl:
        print("deadline passed — exiting"); break
    win, vals = tc.functions.podium(2).call()
    top = max((int(v) for v in vals), default=0)
    mine = int(tc.functions.bestDefendedStreak(me).call())
    if top > 0 and mine >= top:
        print("best streak already at/above podium top", mine, top); time.sleep(POLL); continue
    age = last_buy_age()
    if age is None:
        print("set INDEXER_URL (or fix buys row timestamps) to enforce 5m silence"); time.sleep(POLL); continue
    if age < SILENCE:
        time.sleep(POLL); continue
    cool = int(tc.functions.nextBuyAllowedAt(me).call())
    if now < cool:
        time.sleep(min(POLL, cool - now + 1)); continue
    _min, max_wad = tc.functions.currentCharmBoundsWad().call()
    h = exec_timecurve_buy(tc, TIMECURVE, acct, w3, me, max_wad)
    print("defended-streak buy", h); time.sleep(POLL)`;

const PY_TIME_BOOSTER = `# Time Booster — loop: buy while round time left < 3 minutes AND you are not already #1 on podium(1).
# CL8Y approve to TimeCurve or Kumbaya router (PAY_MODE, KUMBAYA_* envs) per docs/integrations/kumbaya.md.
${PY_ABI_BOOTSTRAP}
${PY_SKETCH_SHARED}
import time

if not os.environ.get("PRIVATE_KEY"):
    raise SystemExit("PRIVATE_KEY required (never commit it)")
RPC_URL = os.environ.get("RPC_URL", DEFAULT_RPC_URL).strip()
w3 = Web3(Web3.HTTPProvider(RPC_URL))
require_expected_chain(w3)
acct = w3.eth.account.from_key(os.environ["PRIVATE_KEY"])
tc = w3.eth.contract(address=TIMECURVE, abi=TIME_CURVE_ABI)
me = Web3.to_checksum_address(acct.address)

def chain_ts():
    return int(w3.eth.get_block("latest")["timestamp"])

POLL = float(os.environ.get("POLL_SEC", "5"))
BOOST_REM_MAX = int(os.environ.get("TIME_BOOSTER_MAX_REM_SEC", "180"))  # 3 minutes

while True:
    if tc.functions.ended().call():
        print("sale ended — exiting"); break
    now = chain_ts()
    dl = int(tc.functions.deadline().call())
    if now >= dl:
        print("deadline passed — exiting"); break
    rem = dl - now
    win, vals = tc.functions.podium(1).call()
    first = win[0]
    if first and int(first, 16) != 0 and Web3.to_checksum_address(first).lower() == me.lower():
        time.sleep(POLL); continue
    if rem > BOOST_REM_MAX:
        time.sleep(min(POLL, max(1.0, rem - BOOST_REM_MAX + 5))); continue
    cool = int(tc.functions.nextBuyAllowedAt(me).call())
    if now < cool:
        time.sleep(min(POLL, cool - now + 1)); continue
    _min, max_wad = tc.functions.currentCharmBoundsWad().call()
    h = exec_timecurve_buy(tc, TIMECURVE, acct, w3, me, max_wad)
    print("time-booster buy", h); time.sleep(POLL)`;

function envAddresses(): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  const routerOpt = parseHexAddress(import.meta.env.VITE_KUMBAYA_TIMECURVE_BUY_ROUTER);
  const map: Record<string, `0x${string}` | undefined> = {
    "VITE_TIMECURVE_ADDRESS": addresses.timeCurve,
    "VITE_REFERRAL_REGISTRY_ADDRESS": addresses.referralRegistry,
  };
  for (const [key, v] of Object.entries(map)) {
    if (v) entries.push({ key, value: v });
  }
  if (routerOpt) {
    entries.push({
      key: "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER (optional; must match onchain router)",
      value: routerOpt,
    });
  }
  return entries;
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className="app-footer-agent__dd-mono">{v}</dd>
    </>
  );
}

/**
 * Collapsed agent orientation for `/timecurve` (Simple). The global footer is
 * hidden on this route so first-time buyers are not overwhelmed; this `<details>`
 * restores skills, contract/indexer hints, and sketch scripts when expanded.
 */
export function TimeCurveSimpleAgentCard() {
  const gov = governanceUrl();
  const indexer = indexerBaseUrl();
  const chain = resolveChainRpcConfig(import.meta.env.VITE_CHAIN_ID, import.meta.env.VITE_RPC_URL);
  const rpc = import.meta.env.VITE_RPC_URL?.trim() || "(default transport)";
  const addrs = envAddresses();

  const podiumRows = PODIUM_LABELS.map((label, i) => ({
    label,
    onchainCategory: PODIUM_CONTRACT_CATEGORY_INDEX[i],
  }));

  const abisBase = `${import.meta.env.BASE_URL}abis`;
  const abiTimeCurveApp = `${abisBase}/TimeCurve.json`;
  const abiBuyRouterApp = `${abisBase}/TimeCurveBuyRouter.json`;

  return (
    <details className="app-footer-agent timecurve-simple-agent-card" data-testid="timecurve-simple-agent-card">
      <summary className="app-footer-agent__summary">
        <span className="app-footer-agent__summary-title">AGENT CARD: TimeCurve Simple</span>
        <span className="app-footer-agent__summary-hint">
          Expand for podium mechanics, skills, indexer routes, and Python sketches.
        </span>
      </summary>
      <div className="app-footer-agent__body">
        <article className="app-footer-agent__article" lang="en">
          <h3 className="app-footer-agent__h">What this page shows (onchain authority)</h3>
          <p className="app-footer-agent__p">
            <strong>Timer + phase</strong> follow <code className="app-footer-agent__code-inline">saleStart</code>,{" "}
            <code className="app-footer-agent__code-inline">deadline</code>, <code className="app-footer-agent__code-inline">ended</code>{" "}
            and the indexer <code className="app-footer-agent__code-inline">chain-timer</code> when configured (
            <a href={ghBlob("docs/frontend/timecurve-views.md")} target="_blank" rel="noreferrer">
              timecurve-views
            </a>
            , issue 48). <strong>Buy</strong> uses <code className="app-footer-agent__code-inline">TimeCurve.buy</code> /
            referral hash variant, or <code className="app-footer-agent__code-inline">TimeCurveBuyRouter.buyViaKumbaya</code> for
            ETH/USDM. <strong>CHARM weight</strong> and <strong>DOUB redemption</strong> after end use{" "}
            <code className="app-footer-agent__code-inline">charmWeight</code> / <code className="app-footer-agent__code-inline">redeemCharms</code>.{" "}
            <strong>Reserve podiums</strong> pay CL8Y from the podium pool after <code className="app-footer-agent__code-inline">endSale</code> +{" "}
            <code className="app-footer-agent__code-inline">distributePrizes</code> (gated — see issue #55).
          </p>

          <h4 className="app-footer-agent__h">
            Four podium rows → <code className="app-footer-agent__code-inline">podium(uint8)</code>
          </h4>
          <p className="app-footer-agent__p">
            UI order maps to fixed category bytes: Last Buy = {PODIUM_CAT_ONCHAIN.lastBuy}, WarBow = {PODIUM_CAT_ONCHAIN.warbow},
            Defended Streak = {PODIUM_CAT_ONCHAIN.defendedStreak}, Time Booster = {PODIUM_CAT_ONCHAIN.timeBooster}. Helpers{" "}
            <code className="app-footer-agent__code-inline">CAT_LAST_BUYERS()</code>,{" "}
            <code className="app-footer-agent__code-inline">CAT_WARBOW()</code>, etc., return the same indices.
          </p>
          <ul className="app-footer-agent__list">
            {podiumRows.map((row) => (
              <li key={row.label}>
                <strong>{row.label}</strong> → <code className="app-footer-agent__code-inline">podium({row.onchainCategory})</code>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">
            High-signal <code className="app-footer-agent__code-inline">TimeCurve</code> calls
          </h4>
          <p className="app-footer-agent__p">
            <strong>Reads:</strong> <code className="app-footer-agent__code-inline">currentCharmBoundsWad</code>,{" "}
            <code className="app-footer-agent__code-inline">currentPricePerCharmWad</code>,{" "}
            <code className="app-footer-agent__code-inline">nextBuyAllowedAt</code>,{" "}
            <code className="app-footer-agent__code-inline">battlePoints</code>,{" "}
            <code className="app-footer-agent__code-inline">totalEffectiveTimerSecAdded</code>,{" "}
            <code className="app-footer-agent__code-inline">bestDefendedStreak</code>,{" "}
            <code className="app-footer-agent__code-inline">buyFeeRoutingEnabled</code>.{" "}
            <strong>Writes:</strong> <code className="app-footer-agent__code-inline">buy</code>,{" "}
            <code className="app-footer-agent__code-inline">claimWarBowFlag</code>, WarBow trio,{" "}
            <code className="app-footer-agent__code-inline">endSale</code>, <code className="app-footer-agent__code-inline">redeemCharms</code>,{" "}
            <code className="app-footer-agent__code-inline">distributePrizes</code>. Decode rich{" "}
            <code className="app-footer-agent__code-inline">Buy</code> events for timer and BP fields.
          </p>

          <h4 className="app-footer-agent__h">Play skills (raw Markdown)</h4>
          <ul className="app-footer-agent__list">
            {PLAY_SKILLS_SIMPLE.map((s) => (
              <li key={s.path}>
                <a href={ghBlob(s.path)} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
            <li>
              <a href={ghBlob("skills/README.md")} target="_blank" rel="noreferrer">
                skills/README.md
              </a>{" "}
              — full play + contributor index
            </li>
          </ul>

          <h4 className="app-footer-agent__h">Contributor agents (repo edits)</h4>
          <ul className="app-footer-agent__list">
            <li>
              <a href={ghBlob(CONTRIBUTOR_SKILL.path)} target="_blank" rel="noreferrer">
                {CONTRIBUTOR_SKILL.label}
              </a>
            </li>
          </ul>

          <h4 className="app-footer-agent__h">Canonical docs</h4>
          <ul className="app-footer-agent__list">
            {DOCS_SIMPLE.map((d) => (
              <li key={d.path}>
                <a href={ghBlob(d.path)} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">Indexer routes used on Simple</h4>
          <pre className="app-footer-agent__route-block">{INDEXER_ROUTES_SIMPLE}</pre>

          <h4 className="app-footer-agent__h">Python sketches (not financial advice)</h4>
          <p className="app-footer-agent__p">
            By default each sketch <strong>downloads</strong> the published{" "}
            <code className="app-footer-agent__code-inline">TimeCurve</code> /{" "}
            <code className="app-footer-agent__code-inline">TimeCurveBuyRouter</code> ABI JSON from{" "}
            <code className="app-footer-agent__code-inline">main</code> on GitHub (same files as below); set{" "}
            <code className="app-footer-agent__code-inline">TIMECURVE_ABI_JSON</code> /{" "}
            <code className="app-footer-agent__code-inline">TIMECURVE_BUY_ROUTER_ABI_JSON</code> to use a local Forge artifact (
            <code className="app-footer-agent__code-inline">contracts/out/TimeCurve.sol/TimeCurve.json</code>{" "}
            <code className="app-footer-agent__code-inline">abi</code> field) instead. Contract addresses in the snippets are{" "}
            <strong>MegaETH mainnet production</strong> (ERC-1967 <code className="app-footer-agent__code-inline">TimeCurve</code> proxy +{" "}
            <code className="app-footer-agent__code-inline">TimeCurveBuyRouter</code> from{" "}
            <a href={ghBlob("indexer/address-registry.megaeth-mainnet.json")} target="_blank" rel="noreferrer">
              indexer/address-registry.megaeth-mainnet.json
            </a>
            , chain <code className="app-footer-agent__code-inline">4326</code>). Only{" "}
            <code className="app-footer-agent__code-inline">PRIVATE_KEY</code> is required in env;{" "}
            <code className="app-footer-agent__code-inline">RPC_URL</code> defaults to the public MegaETH JSON-RPC. Forks / other
            chains: set <code className="app-footer-agent__code-inline">ALLOW_CHAIN_MISMATCH=1</code>. Always simulate, respect
            allowances, cooldowns, and Kumbaya deadlines (
            <a href={ghBlob("docs/integrations/kumbaya.md")} target="_blank" rel="noreferrer">
              kumbaya.md
            </a>
            ). Each loop includes the same <strong>shared Python header</strong> for{" "}
            <code className="app-footer-agent__code-inline">PAY_MODE=CL8Y</code> (approve gross spend then{" "}
            <code className="app-footer-agent__code-inline">buy</code>), or{" "}
            <code className="app-footer-agent__code-inline">ROUTER_ETH</code> /{" "}
            <code className="app-footer-agent__code-inline">ROUTER_STABLE</code> for{" "}
            <code className="app-footer-agent__code-inline">buyViaKumbaya</code> with the env vars listed in that header; WarBow ticks pre-approve CL8Y for the burn <code className="app-footer-agent__code-inline">TimeCurve</code> pulls.
          </p>
          <p className="app-footer-agent__p">
            <strong>Download ABI JSON</strong> (mirrors <code className="app-footer-agent__code-inline">main</code>):
          </p>
          <ul className="app-footer-agent__list">
            <li>
              <strong>TimeCurve</strong> —{" "}
              <a href={abiTimeCurveApp} download="TimeCurve.json">
                this app
              </a>
              ,{" "}
              <a href={ghRaw("frontend/public/abis/TimeCurve.json")} target="_blank" rel="noreferrer">
                raw GitHub
              </a>
              ,{" "}
              <a href={ghBlob("frontend/public/abis/TimeCurve.json")} target="_blank" rel="noreferrer">
                repo path
              </a>
            </li>
            <li>
              <strong>TimeCurveBuyRouter</strong> (single-tx Kumbaya) —{" "}
              <a href={abiBuyRouterApp} download="TimeCurveBuyRouter.json">
                this app
              </a>
              ,{" "}
              <a href={ghRaw("frontend/public/abis/TimeCurveBuyRouter.json")} target="_blank" rel="noreferrer">
                raw GitHub
              </a>
              ,{" "}
              <a href={ghBlob("frontend/public/abis/TimeCurveBuyRouter.json")} target="_blank" rel="noreferrer">
                repo path
              </a>
            </li>
          </ul>
          <p className="app-footer-agent__p">
            <strong>1 — Last Buy</strong>
          </p>
          <pre className="app-footer-agent__route-block">{PY_LAST_BUY}</pre>
          <p className="app-footer-agent__p">
            <strong>2 — WarBow (BP ladder)</strong>
          </p>
          <pre className="app-footer-agent__route-block">{PY_WARBOW}</pre>
          <p className="app-footer-agent__p">
            <strong>3 — Defended streak</strong>
          </p>
          <pre className="app-footer-agent__route-block">{PY_DEFENDED_STREAK}</pre>
          <p className="app-footer-agent__p">
            <strong>4 — Time booster</strong>
          </p>
          <pre className="app-footer-agent__route-block">{PY_TIME_BOOSTER}</pre>

          <h4 className="app-footer-agent__h">This build (env)</h4>
          <dl className="app-footer-agent__dl">
            <dt>Chain id (configured)</dt>
            <dd>{chain.id}</dd>
            <dt>VITE_RPC_URL</dt>
            <dd className="app-footer-agent__dd-break">{rpc}</dd>
            <dt>Indexer base URL</dt>
            <dd>{indexer ?? "(unset — podiums fall back to RPC)"}</dd>
          </dl>
          {addrs.length > 0 ? (
            <>
              <h4 className="app-footer-agent__h">Resolved addresses</h4>
              <dl className="app-footer-agent__dl">
                {addrs.map((a) => (
                  <FragmentRow key={a.key} k={a.key} v={a.value} />
                ))}
              </dl>
            </>
          ) : null}
        </article>

        <div className="app-footer__row app-footer__row--after-agent">
          <IndexerStatusBar />
          <ReferralsFooterPendingPill />
          {gov ? (
            <a href={gov} target="_blank" rel="noreferrer" className="footer-link-pill">
              Governance / CL8Y
            </a>
          ) : null}
        </div>
        <div className="data-panel data-panel--footer">
          <h3 className="h-footer">Canonical fee sinks (read-only)</h3>
          <FeeTransparency />
        </div>
      </div>
    </details>
  );
}
