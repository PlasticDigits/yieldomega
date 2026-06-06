# Arena frontend (`/arena`)

Primary participant surface: [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) at route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)). Legacy **`/timecurve`** redirects here ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Arena DOM/CSS and public art paths use **`arena-*`** naming ([#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280)) — **`INV-FRONTEND-280-ARENA-CSS-NAMING`**, `bash scripts/check-arena-naming.sh`.

<a id="arena-css-naming-gitlab-280"></a>

## Arena CSS & public art naming (GitLab [#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280))

| Area | Convention | Examples |
|------|------------|----------|
| Simple agent footer | `arena-simple-agent-card` · `data-testid="arena-simple-agent-card"` | [`ArenaSimpleAgentCard.tsx`](../../frontend/src/pages/arena/ArenaSimpleAgentCard.tsx) |
| Protocol AUDIT | `arena-protocol-page`, `arena-protocol-raise-card` | [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) · scene `/art/scenes/arena-protocol.jpg` |
| Buy projected effects | `arena-buy-projected-effects*` | [`ArenaBuyProjectedEffects.tsx`](../../frontend/src/pages/arena/ArenaBuyProjectedEffects.tsx) |
| Podium pictograms | `/art/icons/arena-podium-*.png` | [`ArenaSimplePodiumSection.tsx`](../../frontend/src/pages/arena/ArenaSimplePodiumSection.tsx), [`arenaUi.tsx`](../../frontend/src/pages/arena/arenaUi.tsx) |
| Scenes | `arena-simple.jpg`, `arena-arena.jpg`, `arena-protocol.jpg` | [`ArenaTimerHero.tsx`](../../frontend/src/pages/arena/ArenaTimerHero.tsx), `index.css` buy-panel backplate |

**Unchanged:** `/timecurve` → `/arena` redirects in [`LaunchGate.tsx`](../../src/app/LaunchGate.tsx). **Do not** rename onchain revert substrings in [`revertMessage.ts`](../../src/lib/revertMessage.ts).

<a id="unified-arena-page-gitlab-256"></a>

## Unified arena page (GitLab [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

| Surface | Component | Notes |
|---------|-----------|--------|
| Last Buy countdown | [`ArenaTimerHero`](../../frontend/src/pages/arena/ArenaTimerHero.tsx) inside [`ArenaSimplePage`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) | Primary timer; RPC/indexer deadline |
| Secondary podium timers | [`ArenaTimerChips`](../../frontend/src/pages/arena/ArenaTimerChips.tsx) | Time Booster · Defended Streak · WarBow (`podiumDeadline[1..3]`) |
| Buy hub | [`ArenaSimplePage`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) buy panel | DOUB-primary toggle (`arena-paywith-cl8y` → **DOUB** label on v2); ETH / USDM / CRED ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| Four podiums | [`ArenaSimplePodiumSection`](../../frontend/src/pages/arena/ArenaSimplePodiumSection.tsx) | Epoch id + live rankings via `GET /v1/arena/podiums` or RPC `podium` + `podiumEpoch` ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) |
| CHARM + Play CRED | [`ArenaCharmCredCard`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) | Current Last Buy epoch, epoch CHARM, accruing + claimable CRED; **`claimCred(endedEpoch)`** ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)) |
| WarBow PvP | [`ArenaWarbowHeroPanel`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) | Steal / guard / revenge with **`WARBOW_*_DOUB`** cost pills ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)) |
| AUDIT | [`ArenaProtocolPage`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) at **`/arena/protocol`** | Operator reads only — no separate “Arena advanced” route |

Global shell/design direction: [frontend design §290](./design.md#cyberminimalist-glass-app-shell-gitlab-290). Route-level copy stays compact: visible choices are **BUY** and **AUDIT**; mechanics live in tooltips, state rows, and action-adjacent feedback rather than default explanatory paragraphs.

Invariants: **`INV-FRONTEND-256-UNIFIED-ARENA`** · play skills [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md), [`skills/play-time-arena-warbow`](../../skills/play-time-arena-warbow/SKILL.md).

<a id="charm-cred-card-gitlab-257"></a>

## CHARM & Play CRED card (GitLab [#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257))

Component: [`ArenaCharmCredCard.tsx`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) · **`data-testid="arena-charm-cred-card"`**.

| Read / write | Onchain | UI |
|--------------|---------|-----|
| Last Buy epoch | `lastBuyEpoch()` | Current epoch id |
| Epoch CHARM | `epochCharmWad[lastBuyEpoch, wallet]` | Accruing weight this epoch |
| Pending CRED (active) | `pendingCred(wallet, lastBuyEpoch)` | Pro-rata preview while epoch is live |
| Claimable CRED | `pendingCred(wallet, lastBuyEpoch - 1)` when `lastBuyEpoch > 0` | Shown after hard reset; **Claim CRED** enabled when &gt; 0 |
| Claim | `claimCred(endedEpoch)` | **`data-testid="arena-charm-cred-claim"`**; requires `endedEpoch < lastBuyEpoch` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |

Claim helper: [`arenaCharmCredClaim.ts`](../../frontend/src/lib/arenaCharmCredClaim.ts). Empty / loading copy uses **`EmptyDataPlaceholder`** ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)). Invariant: **`INV-FRONTEND-257-CHARM-CRED-CARD`**. Play skill: [play-time-arena-doub § CRED claim](../../skills/play-time-arena-doub/SKILL.md).

## Env

| Variable | Role |
|----------|------|
| `VITE_TIME_ARENA_ADDRESS` | `TimeArena` proxy |
| `VITE_PODIUM_VAULTS_ADDRESS` | Podium vaults |
| `VITE_ADMIN_SELL_VAULT_ADDRESS` | Admin sell vault |
| `VITE_INDEXER_URL` | Optional Arena v2 reads: `GET /v1/arena/*` ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)); not legacy `/v1/timecurve/*` ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)) |
| `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | Optional — must match `TimeArena.timeArenaBuyRouter()` when set ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)); legacy alias `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` |
| `VITE_PLAY_CRED_ADDRESS` | Optional PlayCred override when `TimeArena.playCred()` read fails ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| `VITE_CHAIN_ID` / `VITE_RPC_URL` | Wagmi target chain |

## Indexer reads

- `GET /v1/arena/timers` — Last Buy deadline + four podium deadlines + epoch ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))
- `GET /v1/arena/podiums` — head `podium()` rows + indexed `epoch` per category
- `GET /v1/arena/buys` — recent buys
- `GET /v1/arena/wallet/{address}/stats` — participant profile aggregates (XP, buy count, WarBow steals; [#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255); schema **≥ 2.4.0**)
- `GET /v1/arena/podium-pool-donations` — donate-pools AUDIT card ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

<a id="wallet-profile-modal-gitlab-258"></a>

## Wallet profile modal (GitLab [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258))

Participant addresses on **`/arena`** and **`/arena/protocol`** open **`WalletProfileModal`** via **`AddressInline` `onOpenProfile`** (not block explorer). Stats: **`GET /v1/arena/wallet/{address}/stats`**. Modal includes **View on explorer** as a secondary link.

Modal sections (from indexer aggregates): **Overview**, **Podium wins**, **Spending**, **XP / Level**, **WarBow**, **Referrals**, **Fun facts**. Loading / error / indexer-unset states use shared placeholders ([#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)). Layout: [`WalletProfileModal.tsx`](../../frontend/src/components/WalletProfileModal.tsx), [`WalletProfileModalSections.tsx`](../../frontend/src/components/WalletProfileModalSections.tsx), [`walletProfileFormat.ts`](../../frontend/src/lib/walletProfileFormat.ts).

| Surface | Component |
|---------|-----------|
| Play — podium winners, last timer extension | [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) → [`ArenaSimplePage.tsx`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) |
| AUDIT — live buy ticker, donate-pools recent donors | [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) → [`ArenaLiveBuysActivitySection.tsx`](../../frontend/src/pages/arena/ArenaLiveBuysActivitySection.tsx), [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) |
| Live-buy row primitives (hero strip + all-buys modal) | [`LiveBuyRow.tsx`](../../frontend/src/pages/arena/LiveBuyRow.tsx) |

Invariants: **`INV-FRONTEND-258-WALLET-PROFILE`** · **`INV-INDEXER-282-ARENA-BUYS-SECONDS`** · **`INV-INDEXER-283-ARENA-BUYS-PARITY`** in [invariants](../testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258). Tests: `WalletProfileModalSections.test.tsx`, `walletProfileFormat.test.ts`, `indexerApi.test.ts` (buy row mapping including `log_index` / `new_deadline`). Hermetic smoke: `bash scripts/verify-wallet-profile-anvil.sh` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282), [#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)). Contracts-only explorer links remain on [`MegaScannerAddressLink.tsx`](../../frontend/src/components/MegaScannerAddressLink.tsx).

<a id="protocol-donate-pools-gitlab-262"></a>

## Protocol — donate pools (AUDIT)

Route: **`/arena/protocol`** (AUDIT sub-nav; legacy **`/arena/protocol`** redirects — [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Component: [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) · **`data-testid="arena-protocol-donate-pools"`**.

- Required disclosure (always visible, non-dismissible): donating boosts prizes but **does not** benefit the donor.
- Write path: DOUB **`approve`** + **`topUpPodiumPools(amount)`** on `TimeArena` ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)), gated by **`ChainMismatchWriteBarrier`**.
- Read path: indexer totals, per-wallet summary when connected, recent donations list (wallet profile modal [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)).
- Indexer unset/offline: **`EmptyDataPlaceholder`** — no fake zeros ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)).

Invariants: **`INV-FRONTEND-262-DONATE-POOLS`** · **`INV-INDEXER-262-DONATE-POOLS`** in [invariants](../testing/invariants-and-business-logic.md#arena-podium-pool-donations-gitlab-262).

## Pay modes

Toggle buttons: **`data-testid="arena-paywith-cl8y"`** (DOUB), **`arena-paywith-cred`** (Play CRED burn — [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)), **`arena-paywith-eth`**, **`arena-paywith-usdm`**. CRED: read **`playCred()`** + **`CRED_PER_CHARM_WAD`** ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)), wallet **`balanceOf`**, submit **`buyWithCred(charmWad)`** — burn helper [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts). ETH/USDM single-tx **`buyViaKumbaya`** when **`timeArenaBuyRouter`** is non-zero ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Operator pause: **`TimeArena.paused`** only — **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** · [invariants §264](../testing/invariants-and-business-logic.md#arena-frontend-pay-pause-gitlab-264).

## Wallet / chain

Wrong-network write gating: [wallet-connection.md](wallet-connection.md). Session drift on multi-step buys: [invariants §144](../testing/invariants-and-business-logic.md#arena-buy-wallet-session-drift-gitlab-144).

## E2E

`bash scripts/e2e-anvil.sh` — `e2e/anvil-arena-*.spec.ts`, **`ANVIL_E2E=1`**, single worker ([#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

**Product rules:** [arena-v2.md](../product/arena-v2.md) · **Invariants:** [invariants-and-business-logic.md](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
