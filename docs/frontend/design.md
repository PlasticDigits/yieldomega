# Frontend design (Vite static)

## Goals

- **Static site** built with **Vite**, deployable to **CDN or IPFS** without a trusted application server.
- **Wallet-native** flows: users sign transactions; the frontend **does not** hold custody.
- **Reads** primarily from the **indexer** for rich UX, with **direct RPC** where appropriate for single-call reads or wallet estimates.

## Pages (illustrative)

- **Time Arena (`/arena`)** — unified participant command console at route **`/arena`** ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256), [#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291)); legacy **`/timecurve`** redirects here ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Renders through [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) → [`ArenaSimplePage`](../../frontend/src/pages/arena/ArenaSimplePage.tsx):
  - **Last Buy countdown** — [`ArenaTimerHero`](../../frontend/src/pages/arena/ArenaTimerHero.tsx) in the primary console column (largest timer; RPC/indexer deadline).
  - **Inline CHARM buy** — text entry, slider, min/max, pay picker, and direct **Buy CHARM** CTA in the primary column; no modal-first buy flow.
  - **Decision row** — live CHARM price in DOUB, 0.99–10 CHARM buy range, and DOUB-buy CRED yield.
  - **Secondary podium timers** — [`ArenaTimerChips`](../../frontend/src/pages/arena/ArenaTimerChips.tsx) in the operations rail (Time Booster · Defended Streak · WarBow).
  - **Buy hub** — DOUB-primary toggle plus ETH / USDM / Play CRED paths ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)).
  - **Four podiums** — [`ArenaSimplePodiumSection`](../../frontend/src/pages/arena/ArenaSimplePodiumSection.tsx) (epoch id + live rankings via `GET /v1/arena/podiums` or RPC).
  - **CHARM + Play CRED** — [`ArenaCharmCredCard`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) (epoch CHARM, accruing + claimable CRED; **`claimCred(endedEpoch)`**).
  - **WarBow PvP** — [`ArenaWarbowHeroPanel`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) (steal / guard / revenge with DOUB cost pills).
  - **`/arena/protocol`** — operator AUDIT view via [`ArenaProtocolPage`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) (`TimeArena`, vault reads, live buy ticker, gated donate-pools sponsorship action).
  - See [`docs/frontend/arena-views.md`](./arena-views.md) for the layout contract and indexer/RPC invariants.
- **Rabbit Treasury (retired Arena v2)** — historical only; do not route new user flows through Rabbit Treasury / Burrow.
- **Collection (retired [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241))** — removed; primary route is **`/arena`**.
- **Governance links** — pointers to CL8Y interfaces (external or embedded read-only).

## Data sources

| Data type | Preferred source |
|-----------|------------------|
| Historical buys, leaderboards | Indexer API |
| Live timer / podium deadlines | Contract `view` via RPC or indexer `GET /v1/arena/timers` |
| NFT metadata | Contract + tokenURI resolution policy |
| Gas estimation | MegaETH RPC (`eth_estimateGas`) |

## Accessibility and UX

- Clear **network indicator** (chain id).
- **Human-readable** errors from reverts where possible (`cast` / viem decoding patterns TBD).
- Avoid **dark patterns** that obscure fees or timer rules.
- **Global header layout** — decorative header art must never cover navigation
  labels or hit targets. The `RootLayout` mascot reserves a desktop/landscape
  gutter in [`index.css`](../../frontend/src/index.css), becomes
  `pointer-events: none`, and is hidden at the existing mobile breakpoint
  ([GitLab #171](https://gitlab.com/PlasticDigits/yieldomega/-/issues/171),
  `INV-FRONTEND-171-HEADER-MASCOT`).
- **Keyboard focus (WCAG 2.4.7)** — Interactive controls use **`:focus-visible`** rings via **`--yo-focus-ring`** in [`index.css`](../../frontend/src/index.css). App-level selectors are mirrored under **`[data-rk]`** so RainbowKit’s reset (`outline: none` on modal controls) does not hide focus during Tab navigation ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97), [`wallet-connection.md`](./wallet-connection.md), [invariants — #97](../testing/invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97)). Play checklist: [`../testing/manual-qa-checklists.md#manual-qa-issue-97`](../testing/manual-qa-checklists.md#manual-qa-issue-97).
<a id="home-product-card-grid-gitlab-198"></a>

- **Home product card grid** — homepage cards use a stretched CSS Grid row contract:
  `.home-cta-grid` owns equal implicit rows, `.home-cta-grid__item` is a flex
  wrapper, and `.home-cta-card` fills the item. This keeps Time Arena, Rabbit
  Treasury, Collection, Referrals, Kumbaya, and Sir cards visually aligned even
  when blurbs differ in length. At tablet widths, the grid reflows to two
  `minmax(0, 22rem)` columns before returning to three columns at desktop width,
  so iPad Mini / Air viewports do not clip the right-side card or media
  ([GitLab #198](https://gitlab.com/PlasticDigits/yieldomega/-/issues/198),
  [GitLab #201](https://gitlab.com/PlasticDigits/yieldomega/-/issues/201),
  `INV-FRONTEND-198-HOME-CARDS`,
  manual QA [`#198`](../testing/manual-qa-checklists.md#manual-qa-issue-198)).

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

- Frame as **adversarial PvP**, not a passive “activity” board: explain **2× BP rule** for steals, **UTC-day** steal cap + optional **50,000 DOUB** bypass, **guard** (10,000 DOUB → 1% drain), **revenge** window and **single** pending stealer, **flag** silence and **when** the **2×** BP penalty applies (only after silence elapses).
- Break down **Battle Points** sources from **`Buy`** fields: base, timer-reset bonus, clutch (`< 30s` remaining), streak-break, ambush; plus flag claim / penalty events.
- Show **eligibility and revert reasons** before users sign (read contract state + simulate where possible).

## Art assets and theming

<a id="cyberminimalist-glass-app-shell-gitlab-290"></a>

### Cyberminimalist glass app shell (GitLab #290)

The approved platform direction is a **cyberminimalist command console**:
dark tactical surfaces, thin glass borders, compact action-first copy, and
consistent Yield Omega character/token branding. Global tokens live in
[`frontend/src/index.css`](../../frontend/src/index.css) as semantic `--yo-*`
variables; legacy class names and aliases may remain for compatibility, but new
visual work should consume the semantic tokens and shared primitives.

- Shared chrome: [`RootLayout`](../../frontend/src/layout/RootLayout.tsx) keeps
  route decisions compact (`Time Arena`, `Referrals`, wallet/network/music).
- Wallet chrome: [`AppProviders`](../../frontend/src/providers/AppProviders.tsx)
  uses a dark RainbowKit theme aligned to the console accent palette.
- Arena route IA: [`ArenaSubnav`](../../frontend/src/pages/arena/ArenaSubnav.tsx)
  exposes **BUY** and **AUDIT** as the visible decisions. Mechanics belong in
  `title` / `aria-label` tooltips or action-adjacent states, not default body
  paragraphs.
- Arena production surface ([#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291)):
  **`arena-command-console`** is the single `/arena` layout. The old static
  concept mock must not be mounted above the live Arena stack. Last Buy and
  inline CHARM buy controls are primary; CHARM/CRED state, secondary timers,
  and WarBow are secondary operations.
- AUDIT production surface ([#293](https://gitlab.com/PlasticDigits/yieldomega/-/issues/293)):
  `/arena/protocol` uses the same cyberminimalist glass system for a compact
  state/routing/activity console. Visible copy should be short; detailed
  mechanics belong in tooltips, `aria-label`s, and status cards. Participant
  rows use wallet profile actions; contract/vault rows keep blockie address
  treatment plus explorer links.
- Copy must match current TimeArena rules from
  [`time-arena.md`](../product/time-arena.md) and
  [`arena-v2.md`](../product/arena-v2.md): always-live when unpaused, DOUB /
  Play CRED CHARM buys, four podiums, WarBow PvP, and AUDIT reads. Do not
  reintroduce TimeCurve sale-end, PvE, redemption, or launchpad framing.

Evidence: [`INV-FRONTEND-290-CYBER-GLASS-SHELL`](../testing/invariants-and-business-logic.md#frontend-cyberminimalist-glass-shell-gitlab-290).

<a id="shared-frontend-primitives-gitlab-294"></a>

### Shared frontend primitives (GitLab #294)

Shared UX primitives carry the approved cyberminimalist glass direction across
`/arena`, `/arena/protocol`, `/referrals`, and secondary routes without changing
onchain, indexer, or wallet behavior:

- [`AddressInline`](../../frontend/src/components/AddressInline.tsx) is the
  canonical participant/contract identity row: blockie plus **last six hex
  digits** by default. Participant rows with `onOpenProfile` open
  [`WalletProfileModal`](../../frontend/src/components/WalletProfileModal.tsx);
  contract/vault/referral rows keep explorer links.
- [`Modal`](../../frontend/src/components/ui/Modal.tsx) and
  `WalletProfileModal` use the same dark glass hierarchy. Keep modal titles
  compact, keep explorer links secondary, and keep mechanics in `title` /
  `aria-label` / action-adjacent state instead of long paragraphs.
- [`ChainMismatchWriteBarrier`](../../frontend/src/components/ChainMismatchWriteBarrier.tsx)
  must remain visible and actionable with
  [`SwitchToTargetChainButton`](../../frontend/src/components/SwitchToTargetChainButton.tsx);
  the overlay blocks writes until the wallet chain matches the configured target
  ([wallet gating #95](wallet-connection.md#wrong-network-write-gating-issue-95)).
- [`EmptyDataPlaceholder`](../../frontend/src/components/EmptyDataPlaceholder.tsx),
  [`StatusMessage`](../../frontend/src/components/ui/StatusMessage.tsx),
  [`AmountDisplay`](../../frontend/src/components/AmountDisplay.tsx), and
  [`IndexerStatusBar`](../../frontend/src/components/IndexerStatusBar.tsx)
  stay phrasing-safe where needed, use human-readable amounts/status only, and
  consume `--yo-*` glass tokens.

Evidence: [`INV-FRONTEND-294-SHARED-PRIMITIVES`](../testing/invariants-and-business-logic.md#frontend-shared-primitives-gitlab-294) · manual QA [§294](../testing/manual-qa-checklists.md#manual-qa-issue-294) · `SharedUxPrimitives.test.tsx`.

The cyberminimalist palette in `frontend/src/index.css` is supported by a curated raster pack under
[`frontend/public/art/`](../../frontend/public/art/README.md). Assets are
organized into **purpose-named subfolders** so each consumer maps to one
shape constraint:

- `cutouts/` — transparent PNG mascot poses (hero, podium, banner cutouts).
- `scenes/` — wide JPG backplates for `PageHero` (`sceneSrc` prop) and the
  `LaunchCountdown` scene backdrop.
- `icons/` — 256px square PNG pictograms used inside `PageBadge` (status,
  phase), `IndexerStatusBar`, `ArenaSubnav`, and the WarBow legend.
- `public/tokens/` — canonical **CHARM / CL8Y / DOUB / ETH / USDM** logos and
  the **MegaETH** mark, served as `/tokens/…` and centralized in
  [`tokenMedia.ts`](../../frontend/src/lib/tokenMedia.ts) (see
  [`frontend/public/art/README.md`](../../frontend/public/art/README.md)
  **Canonical token marks**). Legacy `art/icons/token-*.png` rasters remain
  for replicate-art pipelines, not new product wiring for those tickers.
- `cursors/` — 32px PNG bitmap cursors wired through `index.css`
  (`.btn-primary`, `.btn-secondary--critical`, `input[type="range"]`).
- `social/` — OG / Twitter / favicon source rasters consumed by
  `frontend/index.html` and `frontend/vite.config.ts`.
- `motion/` — reference frames for animation experiments (must respect
  `prefers-reduced-motion`).

When a component references a new asset, **list the consumer in
`frontend/public/art/README.md`** so renames or regenerations stay in
lock-step. After [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)
TimeCurve page retirement, confirm consumers with `rg "/art/" frontend/src` and
keep README links on `pages/arena/*` surfaces — gate
**`INV-FRONTEND-286-ART-README`**, `bash scripts/check-art-readme-consumers.sh`
([#286](https://gitlab.com/PlasticDigits/yieldomega/-/issues/286);
[§286 anchor](./design.md#art-readme-consumer-links-gitlab-286)). Asset slots that are referenced by component code but not yet
filled live in [`missing-art-assets.md`](./missing-art-assets.md) so
[`scripts/replicate-art/`](../../scripts/replicate-art/) can complete the
pack via the same generation pipeline used for
[issue #45](https://gitlab.com/PlasticDigits/yieldomega/-/issues/45) and follow-ups such as
[issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57) (`issue57_batch.py`).

The textual label in any badge / icon component remains the **a11y source
of truth**; pictograms are decorative (`alt=""` + `aria-hidden`).

<a id="art-readme-consumer-links-gitlab-286"></a>

### Art README consumer links (GitLab #286)

[`frontend/public/art/README.md`](../../frontend/public/art/README.md) is the
canonical map of raster consumers. After v1 TimeCurve pages were removed
([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)), **“Used by”**
markdown links must target live files under `frontend/src/pages/arena/` (and other
shipped routes) — not deleted `TimeCurve*.tsx` paths. Automated check:
**`INV-FRONTEND-286-ART-README`** · `bash scripts/check-art-readme-consumers.sh` ·
[invariants §286](../testing/invariants-and-business-logic.md#frontend-art-readme-consumer-links-gitlab-286).

<a id="placeholder-split-panels-gitlab-163"></a>

### Placeholder split panels (GitLab #163)

**`UnderConstruction`** and **`ThirdPartyDexPage`** place a scene raster inside **`.placeholder-figure`** on the left of a **two-column** **`.split-layout`**. CSS Grid stretches row items to the **taller** track by default; the **`<img>`** keeps **intrinsic** block size, which used to leave **empty bordered space** below the art on **wide** and **landscape** viewports. **`INV-FRONTEND-163`:** **`index.css`** scopes **`.split-layout > .placeholder-figure`** with **`align-self: start`**, **`width: 100%`**, **`max-width: min(42rem, 100%)`**, **`min-width: 0`**. Contributor checklist: [`../testing/manual-qa-checklists.md#manual-qa-issue-163`](../testing/manual-qa-checklists.md#manual-qa-issue-163); Vitest parity: [`placeholderSplitLayoutCss.test.ts`](../../frontend/src/lib/placeholderSplitLayoutCss.test.ts).

## Security posture

- **No private keys** in the client.
- **Address allowlists** for “official” contracts should be **versioned** and **checksum-validated**.
- Treat indexer responses as **untrusted** for **high-stakes** actions: optionally cross-check critical view calls.

## Build and license

- **TypeScript** recommended; bundling via Vite.
- New **original** frontend source: **AGPL-3.0** alongside dependency licenses.

---

**Agent phase:** [Phase 13 — Frontend design (Vite static)](../agent-phases.md#phase-13)
