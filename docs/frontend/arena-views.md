# Arena frontend (`/arena`)

Primary participant surface: [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) at route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)).

## Env

| Variable | Role |
|----------|------|
| `VITE_TIME_ARENA_ADDRESS` | `TimeArena` proxy |
| `VITE_PODIUM_VAULTS_ADDRESS` | Podium vaults |
| `VITE_ADMIN_SELL_VAULT_ADDRESS` | Admin sell vault |
| `VITE_INDEXER_URL` | Optional `GET /v1/arena/*` reads (no `/v1/arena/*` — [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)) |
| `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | Optional — must match `TimeArena.timeArenaBuyRouter()` when set ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)); legacy alias `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` |
| `VITE_PLAY_CRED_ADDRESS` | Optional PlayCred override when `TimeArena.playCred()` read fails ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| `VITE_CHAIN_ID` / `VITE_RPC_URL` | Wagmi target chain |

## Indexer reads

- `GET /v1/arena/timers` — four podium deadlines + Last Buy epoch
- `GET /v1/arena/buys` — recent buys
- `GET /v1/arena/wallet/{address}/stats` — participant profile aggregates ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255); schema **≥ 2.4.0**)
- `GET /v1/arena/podium-pool-donations` — donate-pools AUDIT card ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

<a id="wallet-profile-modal-gitlab-258"></a>

## Wallet profile modal (GitLab [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258))

Participant addresses on **`/arena`** and **`/arena/protocol`** open **`WalletProfileModal`** via **`AddressInline` `onOpenProfile`** (not block explorer). Stats: **`GET /v1/arena/wallet/{address}/stats`**. Modal includes **View on explorer** as a secondary link.

| Surface | Component |
|---------|-----------|
| Play — podium winners, last timer extension | [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) → [`ArenaSimplePage.tsx`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) |
| AUDIT — live buy ticker, donate-pools recent donors | [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) → [`ArenaLiveBuysActivitySection.tsx`](../../frontend/src/pages/arena/ArenaLiveBuysActivitySection.tsx), [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) |
| Live-buy row primitives (hero strip + all-buys modal) | [`LiveBuyRow.tsx`](../../frontend/src/pages/arena/LiveBuyRow.tsx) |

Invariants: **`INV-FRONTEND-258-WALLET-PROFILE`** in [invariants](../testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258). Contracts-only explorer links remain on [`MegaScannerAddressLink.tsx`](../../frontend/src/components/MegaScannerAddressLink.tsx).

<a id="protocol-donate-pools-gitlab-262"></a>

## Protocol — donate pools (AUDIT)

Route: **`/arena/protocol`** (AUDIT sub-nav; legacy **`/arena/protocol`** redirects — [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Component: [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) · **`data-testid="arena-protocol-donate-pools"`**.

- Required disclosure (always visible, non-dismissible): donating boosts prizes but **does not** benefit the donor.
- Write path: DOUB **`approve`** + **`topUpPodiumPools(amount)`** on `TimeArena` ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)), gated by **`ChainMismatchWriteBarrier`**.
- Read path: indexer totals, per-wallet summary when connected, recent donations list (wallet profile modal [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)).
- Indexer unset/offline: **`EmptyDataPlaceholder`** — no fake zeros ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)).

Invariants: **`INV-FRONTEND-262-DONATE-POOLS`** · **`INV-INDEXER-262-DONATE-POOLS`** in [invariants](../testing/invariants-and-business-logic.md#arena-podium-pool-donations-gitlab-262).

## Pay modes

Toggle buttons: **`data-testid="arena-paywith-cl8y"`** (DOUB), **`arena-paywith-cred`** (Play CRED burn — [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)), **`arena-paywith-eth`**, **`arena-paywith-usdm`**. CRED: read **`playCred()`** + **`CRED_PER_CHARM_WAD`** ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)), wallet **`balanceOf`**, submit **`buyWithCred(charmWad)`** — burn helper [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts). ETH/USDM single-tx **`buyViaKumbaya`** when **`timeArenaBuyRouter`** is non-zero ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Operator pause: **`TimeArena.paused`** only (no `buyFeeRoutingEnabled`).

## Wallet / chain

Wrong-network write gating: [wallet-connection.md](wallet-connection.md). Session drift on multi-step buys: [invariants §144](../testing/invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144).

## E2E

`bash scripts/e2e-anvil.sh` — `e2e/anvil-arena-*.spec.ts`, **`ANVIL_E2E=1`**, single worker ([#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

**Product rules:** [arena-v2.md](../product/arena-v2.md) · **Invariants:** [invariants-and-business-logic.md](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
