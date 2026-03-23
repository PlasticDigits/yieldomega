# Fee routing and governance

## Objectives

- Every primitive **generates fees**; routing should **fund productive treasuries** and prizes while keeping rules **onchain and legible**.
- **Governance over ecosystem expansion** should sit **primarily with CL8Y**, not a separate TimeCurve-token DAO ([../product/vision.md](../product/vision.md)).

## Illustrative fee destinations

Fees from TimeCurve, Rabbit Treasury activity, and secondary markets (where applicable) may route to any combination of:

1. **CL8Y buy-and-burn** — programmatic support for CL8Y token policy as defined by CL8Y governance.
2. **CL8Y liquidity** — protocol-owned or instructed liquidity provisions.
3. **Prizes** — TimeCurve and seasonal competitions; distributions per onchain rules.
4. **Rabbit Treasury** — player-facing reserve game layer ([../product/rabbit-treasury.md](../product/rabbit-treasury.md)).
5. **CL8Y-governed ecosystem treasury** — grants, new games, consumer goods, tools.

**Weights** (basis points or normalized integers) should **sum to 100%** of the routed portion after any immutable protocol carve-outs (if any).

## Governance actors

| Parameter class | Intended governor |
|-----------------|-------------------|
| Fee split weights | **CL8Y** (timelock + vote or delegated process TBD) |
| TimeCurve numeric policy (growth, caps, timer) | **CL8Y** or explicitly delegated sub-governance with transparent scope |
| Rabbit Treasury repricing parameters | **CL8Y** or limited admin with caps and delays |
| NFT collection issuance (new series) | **CL8Y** or authorized minter contract governed by CL8Y |

The exact onchain roles (multisig, governor contract, module registry) are implementation details; this document states **intent**.

## Anti-patterns to avoid

- **Hidden fee paths** that are not emitted as events.
- **Unbounded admin keys** that can drain user deposits without timelock or onchain notice.
- **Parallel DAO** for TimeCurve that contradicts CL8Y’s ecosystem mandate **without** an explicit community decision.

## Events and observability

Any parameter change must emit **events** containing old value, new value, and actor address. Indexers depend on this for agent-safe monitoring ([../indexer/design.md](../indexer/design.md)).

---

**Agent phase:** [Phase 9 — Fee routing and governance](../agent-phases.md#phase-9)
