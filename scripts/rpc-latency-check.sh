#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Compare JSON-RPC latency and rough network path to MegaETH RPC endpoints.
#
# Usage (repo root):
#   bash scripts/rpc-latency-check.sh
#   bash scripts/rpc-latency-check.sh -n 20 https://custom.example/rpc
#
# Defaults: MegaETH public mainnet + GlobalStake mainnet (indexer fallback).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_AGENT="${RPC_LATENCY_USER_AGENT:-yieldomega-rpc-latency-check/1.0}"
SAMPLES=15
RUN_MTR=1

DEFAULT_ENDPOINTS=(
  "megaeth_public|https://mainnet.megaeth.com/rpc"
  "globalstake|https://rpc-megaeth-mainnet.globalstake.io"
)

usage() {
  cat <<'EOF'
Usage: scripts/rpc-latency-check.sh [options] [label|url ...]

Options:
  -n N          JSON-RPC samples per method (default: 15)
  -q            Quick mode: 5 samples, skip mtr
  --no-mtr      Skip mtr path probes
  -h, --help    Show this help

Arguments:
  Optional entries as  label|https://host/path  or bare https://host/path
  (bare URLs use the hostname as the label).

Environment:
  RPC_LATENCY_USER_AGENT   User-Agent header (MegaETH public RPC may 403 without one)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n)
      SAMPLES="${2:?-n requires a number}"
      shift 2
      ;;
    -q)
      SAMPLES=5
      RUN_MTR=0
      shift
      ;;
    --no-mtr)
      RUN_MTR=0
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "[rpc-latency-check] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

ENDPOINTS=()
if [[ $# -gt 0 ]]; then
  while [[ $# -gt 0 ]]; do
    ENDPOINTS+=("$1")
    shift
  done
else
  ENDPOINTS=("${DEFAULT_ENDPOINTS[@]}")
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[rpc-latency-check] missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python3

print_dns() {
  local host="$1"
  echo "  DNS A:"
  if command -v dig >/dev/null 2>&1; then
    dig +short "$host" A 2>/dev/null | sed 's/^/    /' || true
  else
    getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u | sed 's/^/    /' || true
  fi
}

print_geo() {
  local ip="$1"
  python3 - "$ip" <<'PY'
import json, sys, urllib.request

ip = sys.argv[1]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "yieldomega-rpc-latency-check/1.0"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())

for url in (f"https://ipinfo.io/{ip}/json", f"https://ipapi.co/{ip}/json/"):
    try:
        d = fetch(url)
        if "ipapi.co" in url:
            city, region, country = d.get("city"), d.get("region"), d.get("country_name")
            org = d.get("org") or d.get("asn") or ""
        else:
            city, region, country = d.get("city"), d.get("region"), d.get("country")
            org = d.get("org") or ""
        loc = ", ".join(p for p in (city, region, country) if p)
        suffix = f" ({org})" if org else ""
        print(f"    {ip}: {loc}{suffix}" if loc else f"    {ip}:{suffix or ' (geo unknown)'}")
        break
    except Exception:
        continue
else:
    print(f"    {ip}: (geo lookup skipped)")
PY
}

run_mtr() {
  local host="$1"
  if [[ "$RUN_MTR" != 1 ]]; then
    return 0
  fi
  if ! command -v mtr >/dev/null 2>&1; then
    echo "  mtr: not installed (skip)"
    return 0
  fi
  echo "  mtr (10 cycles, may take ~15s):"
  mtr -rwzc 10 "$host" 2>/dev/null | tail -12 | sed 's/^/    /' || echo "    (mtr failed)"
}

print_ingress_headers() {
  local url="$1"
  echo "  Ingress (response headers):"
  local hdr_file
  hdr_file="$(mktemp)"
  local http_code
  http_code="$(curl -sS -o /dev/null -D "$hdr_file" -w '%{http_code}' --max-time 15 \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "User-Agent: ${USER_AGENT}" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' || echo "000")"
  if [[ "$http_code" == "000" ]]; then
    echo "    (request failed)"
    rm -f "$hdr_file"
    return 0
  fi
  RPC_LATENCY_HDR_FILE="$hdr_file" RPC_LATENCY_HTTP_CODE="$http_code" python3 <<'PY'
import os, re

path = os.environ["RPC_LATENCY_HDR_FILE"]
code = os.environ["RPC_LATENCY_HTTP_CODE"]
raw = open(path, encoding="utf-8", errors="replace").read()
headers = {}
for line in raw.splitlines():
    if ":" in line and not line.lower().startswith("http/"):
        k, v = line.split(":", 1)
        headers[k.strip().lower()] = v.strip()

def show(key):
    v = headers.get(key)
    if v:
        print(f"    {key}: {v}")

show("server")
show("cf-ray")
show("cf-cache-status")
show("via")
show("x-upstream-addr")
show("x-request-time")
print(f"    http: {code}")

cf_ray = headers.get("cf-ray", "")
if cf_ray and "-" in cf_ray:
    colo = cf_ray.rsplit("-", 1)[-1]
    print(f"    cloudflare_edge_pop: {colo}  (your nearest CF PoP — NOT the Miami core/sequencer)")
elif headers.get("server", "").lower().startswith("cloudflare"):
    print("    cloudflare: yes (origin IP hidden behind anycast)")

upstream = headers.get("x-upstream-addr", "")
if upstream:
    print(f"    provider_internal_upstream: {upstream}  (private hop — still not public sequencer IP)")

first_ip = os.environ.get("RPC_LATENCY_FIRST_IP", "")
if first_ip:
    if re.match(r"^(104\.(1[6-9]|2[0-9]|3[01])\.|172\.6[4-9]\.|172\.7[01]\.)", first_ip):
        print("    dns_target: Cloudflare anycast (cannot see origin datacenter from DNS)")
    else:
        print("    dns_target: non-Cloudflare — provider edge IP (may be closer to their MegaETH uplink)")
PY
  rm -f "$hdr_file"
}

print_colocation_notes() {
  cat <<'EOF'

[colocation] Seeing "behind Cloudflare"
  mainnet.megaeth.com (and dRPC) terminate at Cloudflare. There is no supported
  way to learn the sequencer/origin IP from DNS, traceroute, or cf-ray — cf-ray
  only names YOUR edge PoP (e.g. ICN, NRT, MIA).

  MegaETH documents RPC in Miami, FL (Developer FAQ). For lowest submit latency:
    1. Run this script from each candidate region (Miami/South FL, us-east-1, …).
    2. Prefer endpoints with the lowest p50 for eth_chainId AND your write path
       (realtime_sendRawTransaction / eth_sendRawTransactionSync).
    3. Direct provider hosts (e.g. GlobalStake) show their edge, not the sequencer;
       compare several providers from the same VM.
    4. Competitive sequencer-adjacent access is planned via "proximity markets"
       (MiCA whitepaper) — ask MegaETH ops for dedicated ingress if you need it.

  Docs: https://docs.megaeth.com/developer-docs/faq
EOF
}

curl_timing_once() {
  local url="$1"
  curl -sS -o /dev/null \
    -w 'connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total} http:%{http_code}\n' \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "User-Agent: ${USER_AGENT}" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
}

rpc_benchmark() {
  local label="$1"
  local url="$2"
  local host
  host="$(python3 -c "from urllib.parse import urlparse; print(urlparse('${url}').hostname or '')")"

  echo ""
  echo "================================================================"
  echo "${label}"
  echo "  ${url}"
  echo "================================================================"

  if [[ -z "$host" ]]; then
    echo "  invalid URL (no host)" >&2
    return 1
  fi

  print_dns "$host"

  local first_ip=""
  if command -v dig >/dev/null 2>&1; then
    first_ip="$(dig +short "$host" A 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
  fi
  if [[ -n "$first_ip" ]]; then
    echo "  Geo (first A record):"
    print_geo "$first_ip"
  fi

  RPC_LATENCY_FIRST_IP="${first_ip:-}" print_ingress_headers "$url"

  run_mtr "$host"

  echo "  curl eth_chainId (3 runs):"
  local i line
  for i in 1 2 3; do
    line="$(curl_timing_once "$url")"
    echo "    run${i} ${line}"
    sleep 0.15
  done

  echo "  JSON-RPC stats (${SAMPLES} samples each):"
  RPC_LATENCY_URL="$url" RPC_LATENCY_SAMPLES="$SAMPLES" RPC_LATENCY_USER_AGENT="$USER_AGENT" python3 <<'PY'
import json, os, statistics, time, urllib.error, urllib.request

url = os.environ["RPC_LATENCY_URL"]
samples = int(os.environ["RPC_LATENCY_SAMPLES"])
ua = os.environ["RPC_LATENCY_USER_AGENT"]
headers = {"Content-Type": "application/json", "User-Agent": ua}

def post(method):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": []}).encode()
    req = urllib.request.Request(url, data=body, headers=headers)
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=30) as resp:
        cf_ray = resp.headers.get("cf-ray", "")
        payload = json.loads(resp.read())
    ms = (time.perf_counter() - t0) * 1000
    return ms, payload, cf_ray

for method in ("eth_chainId", "eth_blockNumber"):
    times = []
    cf_rays = []
    err = None
    for _ in range(samples):
        try:
            ms, payload, cf_ray = post(method)
            if "error" in payload:
                err = payload["error"]
                break
            times.append(ms)
            if cf_ray:
                cf_rays.append(cf_ray)
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}: {e.reason}"
            break
        except Exception as e:
            err = str(e)
            break
        time.sleep(0.08)
    if err:
        print(f"    {method}: ERROR {err}")
        continue
    if not times:
        print(f"    {method}: no samples")
        continue
    s = sorted(times)
    p95 = s[max(0, int(0.95 * len(s)) - 1)]
    print(
        f"    {method}: min={min(times):.0f}ms p50={statistics.median(times):.0f}ms "
        f"avg={statistics.mean(times):.0f}ms p95={p95:.0f}ms max={max(times):.0f}ms"
    )
    if method == "eth_chainId" and cf_rays:
        ray = cf_rays[0]
        colo = ray.rsplit("-", 1)[-1] if "-" in ray else "?"
        print(f"    cf-ray (sample): {ray}  (edge PoP: {colo})")
PY
}

echo "[rpc-latency-check] host: $(hostname)  samples=${SAMPLES}  user-agent=${USER_AGENT}"

for entry in "${ENDPOINTS[@]}"; do
  label=""
  url=""
  if [[ "$entry" == *"|"* ]]; then
    label="${entry%%|*}"
    url="${entry#*|}"
  else
    url="$entry"
    label="$(python3 -c "from urllib.parse import urlparse; print(urlparse('${url}').hostname or 'rpc')")"
  fi
  rpc_benchmark "$label" "$url"
done

print_colocation_notes
echo ""
echo "[rpc-latency-check] done"
