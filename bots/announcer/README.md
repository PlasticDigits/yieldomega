# TimeArena buy-announcement bot (`bots/announcer`)

Read-only watcher that posts a Telegram message for each TimeArena **`Buy`** (and,
optionally, **`ArenaStarted`**) on MegaETH mainnet. Sibling to the play swarm in
[`bots/timearena`](../timearena/) — but this one **only reads**: no private key, signs
nothing, cannot spend.

Built for an always-on edge box (e.g. a Jetson): **pure Python stdlib**, no `web3`, no
`pip`, no venv. Needs only **outbound** HTTPS to the RPC, `indexer.yieldomega.com`, and
`api.telegram.org`. No inbound ports.

## What it watches

- **TimeArena** proxy `0xba39cea0e5ef6808d8cb926c722877480049e0ee`, chain **4326** — from
  [`indexer/address-registry.megaeth-mainnet.json`](../../indexer/address-registry.megaeth-mainnet.json).
- Events: `Buy(address indexed buyer, uint256 charmWad, uint256 doubPaid, uint256 newDeadline,
  uint256 totalDoubRaisedAfter, uint256 buyIndex, uint256 actualSecondsAdded, bool timerHardReset,
  bool paidWithCred)` and `ArenaStarted(uint256,uint256)`.
- Source: `eth_getLogs` polling (topic-filtered), block-range splitting for RPC caps, and a
  persisted cursor (`announce-cursor.json`) for restart safety.

MegaETH public RPC returns **403** without a `User-Agent`; the bot sets one and falls back to
`megaeth.drpc.org` / `rpc-megaeth-mainnet.globalstake.io`.

## Configure

Copy `.env.example` to `.env` (gitignored) and set at least:

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | BotFather token (**secret** — never commit) |
| `TELEGRAM_CHAT_ID`   | Target chat id (negative for groups) |
| `TELEGRAM_MESSAGE_THREAD_ID` | Forum **topic** id (e.g. **Ω Flow**). Without this, Telegram routes posts to **General**. |
| `MEGAETH_RPC_URL` / `MEGAETH_RPC_FALLBACKS` | RPC endpoints (MegaETH mainnet defaults) |
| `TIME_ARENA_ADDRESS` | TimeArena proxy (defaults to the mainnet registry address) |
| `ANNOUNCE_START_BLOCK` | Optional: first-run start block; otherwise starts at current head |
| `MIN_DOUB` | Optional: skip buys under this DOUB amount |
| `INDEXER_URL` | Yieldomega indexer base URL — `GET /v1/arena/doub-spot-price` for DOUB→USD and `GET /v1/arena/podiums` for live prize pools (default `https://indexer.yieldomega.com`) |
| `INDEXER_CACHE_SEC` | Cache indexer market snapshot TTL in seconds (default `30`) |

## Run

```bash
python3 announce.py --selftest              # offline: prints a sample message + decode check
set -a; source .env; set +a
python3 announce.py                         # foreground
```

Handy first-run env toggles: `DRY_RUN=1` (log instead of send), `STARTUP_PING=1`
(post "watcher online"), `SEND_TEST_ON_START=1` (post one sample buy to verify formatting).

## Deploy (Docker / Coolify)

Read-only stdlib bot — no `pip`, no private key. **Build context:** `bots/announcer`
(Coolify default when the Dockerfile lives in that directory).

```bash
cd bots/announcer
docker build -t yieldomega-announcer .
docker run --rm \
  -v announcer-data:/data \
  -e TELEGRAM_BOT_TOKEN=… \
  -e TELEGRAM_CHAT_ID=… \
  yieldomega-announcer
```

`CURSOR_FILE` defaults to `/data/announce-cursor.json` in the image (mount a volume at `/data`
so restarts do not re-announce old buys). Set other vars from [`.env.example`](.env.example) with
`-e` as needed (`MEGAETH_RPC_URL`, `ANNOUNCE_START_BLOCK`, `STARTUP_PING`, etc.).

**Coolify:** create a **Dockerfile** application — Dockerfile path
[`bots/announcer/Dockerfile`](Dockerfile), **base directory / build context** =
`bots/announcer`. Add a **persistent storage** mount at `/data`. Set `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID` in the UI (mark the token as a secret). No public domain or exposed port
(background worker only). Disable HTTP health checks.

## Deploy (systemd, 24/7)

`deploy/timearena-buybot.service` is a template — set `User=`, `WorkingDirectory=`,
`EnvironmentFile=`, and the `ExecStart` path, then:

```bash
sudo cp deploy/timearena-buybot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now timearena-buybot
journalctl -u timearena-buybot -f
```

## Forum topics (Ω Flow vs General)

If the target group has **Topics** enabled, set `TELEGRAM_MESSAGE_THREAD_ID` to the **Ω Flow**
topic id. Without it, `sendMessage` lands in **General** even when `TELEGRAM_CHAT_ID` is correct.

To find the topic id: post any message in **Ω Flow**, then call `getUpdates` on the bot token
(or inspect the message in a client that shows raw fields) and copy `message_thread_id` from
that message. Restart the bot after setting the env var.

## Test group → public

Point `TELEGRAM_CHAT_ID` at a **private** test group first (it will echo early bot buys before
the public open — keep it locked down). At public open, change `TELEGRAM_CHAT_ID` to the public
group and `systemctl restart`. For a clean slate from the open block, set `ANNOUNCE_START_BLOCK`
and remove `announce-cursor.json` before restart.

## Notes

- Secrets live only in `.env` (chmod 600) / the systemd `EnvironmentFile` — `.env.example` ships
  empty. If a token leaks, `/revoke` it in BotFather.
- Read-only by design: it holds no key and can only read logs + send Telegram messages.
