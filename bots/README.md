# Bots

Optional **client** tooling that talks to deployed contracts over JSON-RPC. Bots are **not** authoritative: game rules and balances live onchain; this code only reads state and optionally submits normal transactions.

## Packages

| Path | Description |
|------|-------------|
| [`timearena/`](timearena/) | Python CLI (`timearena-bot`) for **TimeArena** (Arena v2): `inspect`, strategy commands, and local Anvil swarm for UI/indexer dev. Env: `YIELDOMEGA_TIME_ARENA_ADDRESS`. |

Legacy `bots/timecurve/` was renamed in GitLab [#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245). Play skills: [`skills/README.md`](../skills/README.md).

## License

New code in this tree is under **AGPL-3.0** (see repository root `LICENSE`).
