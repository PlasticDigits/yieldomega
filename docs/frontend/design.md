# Frontend design (Vite static)

## Goals

- **Static site** built with **Vite**, deployable to **CDN or IPFS** without a trusted application server.
- **Wallet-native** flows: users sign transactions; the frontend **does not** hold custody.
- **Reads** primarily from the **indexer** for rich UX, with **direct RPC** where appropriate for single-call reads or wallet estimates.

## Pages (illustrative)

- **TimeCurve** — live timer, min buy curve, buy flow, **three** reserve **podium** leaderboards, and **WarBow Ladder** (Battle Points + PvP actions: steal, guard, revenge, flag claim). Use **indexer** for history / battle feed and **RPC** for authoritative live views (`battlePoints`, `warbowPendingFlagOwner`, `warbowGuardUntil`, revenge pointers, steals-per-day reads).
- **Rabbit Treasury** — deposit/withdraw flows, epoch charts, faction standings.
- **Collection** — Leprechaun NFT gallery, set progress, trait filters for humans and agents.
- **Governance links** — pointers to CL8Y interfaces (external or embedded read-only).

## Data sources

| Data type | Preferred source |
|-----------|------------------|
| Historical buys, leaderboards | Indexer API |
| Live timer / sale phase | Contract `view` via RPC or indexer |
| NFT metadata | Contract + tokenURI resolution policy |
| Gas estimation | MegaETH RPC (`eth_estimateGas`) |

## Accessibility and UX

- Clear **network indicator** (chain id).
- **Human-readable** errors from reverts where possible (`cast` / viem decoding patterns TBD).
- Avoid **dark patterns** that obscure fees or timer rules.

### Amount display (`AmountDisplay`)

- **User-facing rule:** show **only human-readable** forms—full decimal (via `formatUnits`) and a **compact** abbreviation (significant figures with `k` / `m` / `b` / `t` / scientific notation as in `compactNumberFormat.ts`).
- **Do not** render smallest-unit integers (wei, raw WAD strings) in product UI. The onchain integer is still the source passed into the component; conversion stays encapsulated in `AmountDisplay` / shared format helpers.
- **Exceptions:** developer-only tooling or copy-paste debug surfaces (if any) must be explicitly labeled—not the default `AmountDisplay` path.

### Timestamps (`UnixTimestampDisplay`)

- **User-facing rule:** show **only human-readable** instants—**locale** date/time (`formatUnixSec`) and **UTC ISO-8601** (`formatUnixSecIsoUtc`). Do not render raw unix second integers in product UI.
- The unix value remains the onchain/RPC input; conversion stays in `UnixTimestampDisplay` / `formatAmount.ts`.

### Basis points (fee routing)

- Onchain and policy weights are stored as **basis points** (10_000 = 100%). In UI, show **`formatBpsAsPercent`** (e.g. `30.00%`), not raw `bps` integers.
- Indexer mirror fields that store structured JSON (`*_sinks_json`, `shares_json`) must be **parsed and summarized** for display—do not show raw JSON strings or blobs to users.

### Plain integers (`formatLocaleInteger`)

- For **non-token** whole numbers (gas estimates, block heights, seconds-long timers, buy counts), use **`formatLocaleInteger`** in `formatAmount.ts` so digits are grouped per locale.
- Do **not** use it for wei/WAD token amounts or CHARM weight — those use `AmountDisplay` / `formatCompactFromRaw`.
- Indexer rows that expose raw transfer amounts should still be formatted with **`formatCompactFromRaw`** (and an assumed decimals value documented at the call site if the API does not carry token metadata).

### WarBow Ladder (UX)

- Frame as **adversarial PvP**, not a passive “activity” board: explain **2× BP rule** for steals, **UTC-day** steal cap + optional **50 CL8Y** bypass, **guard** (10 CL8Y → 1% drain), **revenge** window and **single** pending stealer, **flag** silence and **when** the **2×** BP penalty applies (only after silence elapses).
- Break down **Battle Points** sources from **`Buy`** fields: base, timer-reset bonus, clutch (`< 30s` remaining), streak-break, ambush; plus flag claim / penalty events.
- Show **eligibility and revert reasons** before users sign (read contract state + simulate where possible).

## Security posture

- **No private keys** in the client.
- **Address allowlists** for “official” contracts should be **versioned** and **checksum-validated**.
- Treat indexer responses as **untrusted** for **high-stakes** actions: optionally cross-check critical view calls.

## Build and license

- **TypeScript** recommended; bundling via Vite.
- New **original** frontend source: **AGPL-3.0** alongside dependency licenses.

---

**Agent phase:** [Phase 13 — Frontend design (Vite static)](../agent-phases.md#phase-13)
