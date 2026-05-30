# Glossary and shared vocabulary

Terms below are used consistently across product, architecture, and agent prompts.

## Organizations and layers

- **CL8Y DAO** — Long-term governance and capital allocation for the wider ecosystem. Funds expansion into fully onchain games, consumer goods, tools, and cyclical digital economic activity.

- **CL8Y treasury** — Protocol- or DAO-controlled treasury used for liquidity programs, ecosystem grants, burns where policy requires, and aligned missions.

## Primitives (Arena v2)

- **TimeArena** — Onchain arena where participants buy with **DOUB**, extend a **Last Buy** countdown, and compete for podium prizes. Each buy splits proceeds **40%** active podium · **30%** seed podium · **30%** admin sell vault ([arena-v2](product/arena-v2.md)). No launchpad sale-end, CHARM redemption, or legacy **FeeRouter** sinks.

- **PodiumVaults** — Holds active and seed podium balances funded per buy.

- **AdminSellVault** — Receives the admin slice of each DOUB buy for later distribution policy.

- **ReferralRegistry** — Onchain referral codes; **ReferralApplied** on buys attributes referrer/referee CHARM bonuses ([referrals](product/referrals.md)).

## Retired primitives (do not reintroduce)

- **TimeCurve launchpad** — Legacy CL8Y bonding-curve sale with `endSale`, `redeemCharms`, **PodiumPool** payouts, and **FeeRouter** routing. Removed in epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238).

- **retired v1 player reserve (GitLab #242)** — Retired player treasury layer ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)).

- **Leprechaun NFTs** — Retired collectible layer ([#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)).

## Assets and naming

- **CL8Y** — Ecosystem reserve/governance token; still used for **ReferralRegistry** registration burns where applicable.

- **DOUB (Doubloon)** — Fungible token spent in **TimeArena** buys and routed to prize vaults.

## Technical

- **MegaETH / MegaEVM** — MegaETH L2; MegaEVM is the execution environment. See [research/megaeth.md](research/megaeth.md).

- **Indexer** — Rust + Postgres service that follows chain history, decodes events, and serves read-optimized APIs. Not authoritative for game outcomes.

- **Fully onchain** — Critical arena rules are enforced by contracts; offchain components do not decide winners, balances, or fund movements.

---

**Agent phase:** [Phase 1 — Glossary and shared vocabulary](agent-phases.md#phase-1)
