# Fee routing and governance

**On this page:** [Fee sinks](#fee-sinks) · [TimeCurve split](#timecurve-fee-distribution-canonical) · [Governance actors](#governance-actors) · [Authority cross-walk](#authority-cross-walk) · [Post-update invariants](#post-update-invariants) · [Anti-patterns](#anti-patterns-to-avoid) · [Events](#events-and-observability)

## Objectives

- Every primitive **generates fees**; routing should **fund productive treasuries** and prizes while keeping rules **onchain and legible**.
- **Governance over ecosystem expansion** should sit **primarily with CL8Y**, not a separate TimeCurve-token DAO ([../product/vision.md](../product/vision.md)).

Implementation detail for **where** fees land onchain (treasury contracts, routers) lives in [treasury-contracts.md](treasury-contracts.md). **Who** may change routing parameters is in [Governance actors](#governance-actors). **Checks** that should hold after updates are in [Post-update invariants](#post-update-invariants).

<a id="timecurve-fee-distribution-canonical"></a>

## TimeCurve fee distribution (canonical)

Fees routed from **TimeCurve** (and the same split applies wherever this policy is referenced as the launch default) are allocated as follows. Percentages are of the **routed fee** after any immutable protocol carve-outs (if any). **Weights must sum to 100%** — see [invariant: TimeCurve split totals](#invariant-timecurve-split-totals).

| Destination | Share |
|-------------|-------|
| **DOUB liquidity (LP)** | **30%** |
| **Rabbit Treasury** ([Burrow](../product/rabbit-treasury.md), **DOUB** / reserve layer) | **20%** |
| **Prizes** | **35%** |
| **CL8Y buy-and-burn** | **15%** |

Basis points (illustrative): **3000** / **2000** / **3500** / **1500** = **10000**.

The **30% DOUB LP** slice should land at **`DoubLPIncentives`** (working name; **TODO** finalize in [treasury-contracts.md](treasury-contracts.md)). Implementation may use **separate receiving addresses** per row (for example **RabbitTreasury** for the 20% share, prize vaults, **CL8YProtocolTreasury** for buy-and-burn); the split is **policy** and must be **emitted on change** ([Events and observability](#events-and-observability), [invariant: events](#invariant-parameter-change-events)).

**Prize bucket (35%)** funds **TimeCurve** prize categories defined in [product/primitives.md](../product/primitives.md), including **1st, 2nd, and 3rd** placements per category. **Team preference:** distribute prizes in **DOUB** (and route that slice accordingly) rather than only USDm or raw launch assets; internal per-category weights remain **governance-set** with onchain events — authority in [Governance actors](#governance-actors) ([Prize pool internal weights](#governance-prize-internal-weights)).

<a id="fee-sinks"></a>

### Fee sinks (canonical TimeCurve)

Each row is a **fee sink**: a destination that receives a share of the **TimeCurve** routed fee (after [immutable carve-outs](#invariant-carve-out-layering), if any). **Weight** = share of that routed layer. **Destination** = configured receiver address(es) for that sink’s flow.

| Fee sink | Share | Example onchain receiver | Who may change weight or destination |
|----------|-------|--------------------------|--------------------------------------|
| **DOUB liquidity (LP)** | 30% | **`DoubLPIncentives`** ([treasury-contracts.md](treasury-contracts.md)) | **[CL8Y](#governance-fee-split-weights)** — fee split / routing parameters (timelock + vote or delegated process TBD). |
| **Rabbit Treasury** | 20% | **RabbitTreasury** ([treasury-contracts.md](treasury-contracts.md), [rabbit-treasury.md](../product/rabbit-treasury.md)) | **[CL8Y](#governance-fee-split-weights)** — same as above for the **TimeCurve** fee slice; **repricing** and other Burrow knobs are a separate class ([Rabbit Treasury repricing](#governance-rabbit-repricing)). |
| **Prizes** | 35% | Prize vaults (per implementation) | **Top-level 35% weight and prize routing address(es):** **[CL8Y](#governance-fee-split-weights)**. **Weights inside the bucket** (per category, etc.): **[CL8Y or delegated sub-governance](#governance-prize-internal-weights)**. |
| **CL8Y buy-and-burn** | 15% | **CL8YProtocolTreasury** ([treasury-contracts.md](treasury-contracts.md)) | **[CL8Y](#governance-fee-split-weights)** — same fee split / routing surface. |

Related checks: [Post-update invariants](#post-update-invariants). **Other products** may define **additional** sinks and schedules; those must be documented per contract ([Other products](#other-products)).

## Other products

Fees from **Rabbit Treasury activity** (deposits, withdrawals, game flows), **secondary markets**, or other modules may use **different** schedules; document those per contract. The table above is the **TimeCurve launch** default unless superseded by a governance vote with full transparency — see [invariant: module schedule match](#invariant-module-schedule-match).

<a id="governance-actors"></a>

## Governance actors

This section states **intent**. Exact onchain roles (multisig, governor contract, module registry) are implementation details.

<a id="governance-fee-split-weights"></a>

### Fee split weights and TimeCurve sink destinations

**Intended governor:** **CL8Y** (timelock + vote or delegated process TBD).

**Scope:** **Weights** (shares) and **destination addresses** for each row in the [canonical TimeCurve fee sinks](#fee-sinks). This is the single intended authority surface for changing how much of the routed fee goes to each sink **and** where that sink’s share is sent, unless explicitly delegated elsewhere with transparent scope.

<a id="governance-timecurve-numeric"></a>

### TimeCurve numeric policy

**Intended governor:** **CL8Y** or explicitly delegated sub-governance with transparent scope.

**Scope:** Growth, caps, timer, and other numeric **TimeCurve** policy **other than** the four-way fee sink split (which is [Fee split weights and TimeCurve sink destinations](#governance-fee-split-weights)).

<a id="governance-prize-internal-weights"></a>

### Prize pool internal weights

**Intended governor:** **CL8Y** or explicitly delegated sub-governance with transparent scope.

**Scope:** Per-category (or other internal) shares **inside** the [35% prize bucket](#fee-sinks). Must remain consistent with [invariant: prize sub-weights](#invariant-prize-sub-weights).

<a id="governance-rabbit-repricing"></a>

### Rabbit Treasury repricing parameters

**Intended governor:** **CL8Y** or limited admin with caps and delays.

**Scope:** Burrow repricing and related knobs — distinct from the **TimeCurve** fee **slice** routed to Rabbit Treasury ([fee sink registry](#fee-sinks)).

<a id="nft-collection-issuance-new-series"></a>

### NFT collection issuance (new series)

**Intended governor:** **CL8Y** or authorized minter contract governed by CL8Y.

### Parameter classes (at a glance)

| Parameter class | Section |
|-----------------|---------|
| Fee split weights + TimeCurve sink destinations | [Fee split weights and TimeCurve sink destinations](#governance-fee-split-weights) |
| TimeCurve numeric policy (non–fee-split) | [TimeCurve numeric policy](#governance-timecurve-numeric) |
| Prize pool internal weights | [Prize pool internal weights](#governance-prize-internal-weights) |
| Rabbit Treasury repricing | [Rabbit Treasury repricing parameters](#governance-rabbit-repricing) |
| NFT collection issuance | [NFT collection issuance](#nft-collection-issuance-new-series) |

**Immutable protocol carve-outs** (if any) are **not** governed through the fee-split surface: they are fixed by design ([invariant: carve-out layering](#invariant-carve-out-layering)).

<a id="authority-cross-walk"></a>

### Authority cross-walk (fee sinks → governor)

| Fee sink | Change **weight** (share of routed fee) | Change **destination** (receiver for that sink) |
|----------|----------------------------------------|--------------------------------------------------|
| DOUB LP | [Fee split weights](#governance-fee-split-weights) → **CL8Y** | [Fee split weights](#governance-fee-split-weights) → **CL8Y** |
| Rabbit Treasury (TimeCurve slice) | [Fee split weights](#governance-fee-split-weights) → **CL8Y** | [Fee split weights](#governance-fee-split-weights) → **CL8Y** |
| Prizes (top-level bucket) | [Fee split weights](#governance-fee-split-weights) → **CL8Y** | [Fee split weights](#governance-fee-split-weights) → **CL8Y** |
| Prizes (internal category split) | [Prize pool internal weights](#governance-prize-internal-weights) | N/A (distribution **within** the bucket; receiver strategy follows product rules) |
| CL8Y buy-and-burn | [Fee split weights](#governance-fee-split-weights) → **CL8Y** | [Fee split weights](#governance-fee-split-weights) → **CL8Y** |

<a id="post-update-invariants"></a>

## Post-update invariants

Plain-language checks that should hold **after any** fee-routing or related parameter update (and after governance-bound delays execute, if applicable). Align testing posture with [../testing/strategy.md](../testing/strategy.md) and risk framing in [security-and-threat-model.md](security-and-threat-model.md).

**Invariant index:** [TimeCurve split totals](#invariant-timecurve-split-totals) · [No invalid weights](#invariant-non-negative-weights) · [Carve-out layering](#invariant-carve-out-layering) · [Destinations match policy](#invariant-destination-policy) · [Prize sub-weights](#invariant-prize-sub-weights) · [No hidden fee paths](#invariant-no-hidden-paths) · [Parameter change events](#invariant-parameter-change-events) · [Governance bounds](#invariant-governance-bounds) · [Module schedule match](#invariant-module-schedule-match)

<a id="invariant-timecurve-split-totals"></a>

### Invariant: TimeCurve split totals

The four [canonical TimeCurve sinks](#fee-sinks) are non-negative shares of the **routed fee** layer and **sum to 100%** (or **10,000** basis points) within the project’s chosen integer rounding rules.

<a id="invariant-non-negative-weights"></a>

### Invariant: No invalid weights

No sink has a negative share; any **documented cap** per sink or parameter class is respected.

<a id="invariant-carve-out-layering"></a>

### Invariant: Carve-out layering

**Immutable protocol carve-outs** (if any) are applied **before** the mutable split. The **100%** rule applies to the **remaining routed fee** after carve-outs, not to gross fees in a way that double-counts or omits the carved layer.

<a id="invariant-destination-policy"></a>

### Invariant: Destinations match policy

Each non-zero sink’s configured **destination** matches the intended receiver class in this doc and [treasury-contracts.md](treasury-contracts.md) (e.g. LP incentives vs player reserve vs protocol treasury vs prize vaults). **No silent retargeting** to unrelated EOAs or commingled wallets unless explicitly allowed by governance policy and documented.

<a id="invariant-prize-sub-weights"></a>

### Invariant: Prize sub-weights

Weights for **per-category** (or other internal) allocation **inside** the [35% prize bucket](#fee-sinks) sum to **100% of that bucket’s allocation** (or a documented reserved remainder), and do **not** change the **top-level** four-way split unless the **fee split weights** governor explicitly updates that layer.

<a id="invariant-no-hidden-paths"></a>

### Invariant: No hidden fee paths

There is **no parallel hidden path** for the same fee stream: all routing for that stream is reflected in the same onchain configuration and events indexers consume. (Contrast [Anti-patterns](#anti-patterns-to-avoid).)

<a id="invariant-parameter-change-events"></a>

### Invariant: Parameter change events

Every material parameter change emits an **event** with **old value**, **new value**, and **actor address**, per [Events and observability](#events-and-observability).

<a id="invariant-governance-bounds"></a>

### Invariant: Governance bounds

Updates respect **timelocks**, **caps**, and **delays** where this stack’s docs require them (e.g. [treasury-contracts.md](treasury-contracts.md) delays on user-economics knobs; mid-sale governance risk in [security-and-threat-model.md](security-and-threat-model.md)).

<a id="invariant-module-schedule-match"></a>

### Invariant: Module schedule match

Any module that claims to follow the **TimeCurve launch default** exposes a live schedule that matches [the canonical table](#timecurve-fee-distribution-canonical) unless a **fully transparent** governance vote has superseded it ([Other products](#other-products)).

## Anti-patterns to avoid

- **Hidden fee paths** that are not emitted as events — contradicts [invariant: no hidden paths](#invariant-no-hidden-paths) and [invariant: parameter change events](#invariant-parameter-change-events).
- **Unbounded admin keys** that can drain user deposits without timelock or onchain notice — see [security-and-threat-model.md](security-and-threat-model.md) and [invariant: governance bounds](#invariant-governance-bounds).
- **Parallel DAO** for TimeCurve that contradicts CL8Y’s ecosystem mandate **without** an explicit community decision — see [Objectives](#objectives) and [../product/vision.md](../product/vision.md).

## Events and observability

Any parameter change must emit **events** containing old value, new value, and actor address. Indexers depend on this for agent-safe monitoring ([../indexer/design.md](../indexer/design.md)). This requirement is restated as [invariant: parameter change events](#invariant-parameter-change-events).

## See also

- [Treasury contracts](treasury-contracts.md) — addresses, roles, delays
- [Security and threat model](security-and-threat-model.md) — governance timing, accounting risk; links here from [Fee routing checks](security-and-threat-model.md#fee-routing-checks)
- [Product primitives](../product/primitives.md) — TimeCurve prizes and events
- [Indexer design](../indexer/design.md) — event consumption ([Purpose](../indexer/design.md#purpose) cites routing events)
- [Testing strategy](../testing/strategy.md) — maps contract tests to these invariants

---

**Agent phase:** [Phase 9 — Fee routing and governance](../agent-phases.md#phase-9)
