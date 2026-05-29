# Arena frontend (`/arena`)

Primary participant surface: [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) at route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)).

## Env

| Variable | Role |
|----------|------|
| `VITE_TIME_ARENA_ADDRESS` | `TimeArena` proxy |
| `VITE_PODIUM_VAULTS_ADDRESS` | Podium vaults |
| `VITE_ADMIN_SELL_VAULT_ADDRESS` | Admin sell vault |
| `VITE_INDEXER_URL` | Optional `GET /v1/arena/*` reads |
| `VITE_CHAIN_ID` / `VITE_RPC_URL` | Wagmi target chain |

## Indexer reads

- `GET /v1/arena/timers` — four podium deadlines + Last Buy epoch
- `GET /v1/arena/buys` — recent buys
- `GET /v1/arena/wallet-stats` — XP, buy count (when wired)

## Pay modes

Toggle buttons: **`data-testid="arena-paywith-cl8y"`**, **`arena-paywith-eth`**, **`arena-paywith-usdm`**. ETH/USDM may route via Kumbaya + **`TimeArenaBuyRouter`** when configured ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).

## Wallet / chain

Wrong-network write gating: [wallet-connection.md](wallet-connection.md). Session drift on multi-step buys: [invariants §144](../testing/invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144).

## E2E

`bash scripts/e2e-anvil.sh` — `e2e/anvil-arena-*.spec.ts`, **`ANVIL_E2E=1`**, single worker ([#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

**Product rules:** [arena-v2.md](../product/arena-v2.md) · **Invariants:** [invariants-and-business-logic.md](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
