# JSON schemas (onchain metadata)

This folder holds **machine-readable outlines** for authoritative gameplay metadata (for example Leprechaun NFT JSON that is stored onchain, hashed, or pinned behind a verifiable URI). Schemas are **draft parameters** until product and engineering sign off; contract encoding comes after that.

**Host and path vs JSON shape:** The schema defines the **structure and keys** of metadata JSON. **Where** that JSON is served (URL prefix from `LeprechaunNFT.baseURI`, CDN, IPFS gateway, etc.) can change when admins call `setBaseURI` without changing the onchain trait tuple — see [product — Metadata URI trust model](../product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json) and [GitLab #125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125).

**Start here for docs navigation:** [../README.md](../README.md) — the top-level documentation map lists architecture, product, indexer, and agent docs.

## Artifacts

| Schema file | Purpose |
|-------------|---------|
| [leprechaun-nft-metadata-v1.schema.json](leprechaun-nft-metadata-v1.schema.json) | Draft JSON Schema for Leprechaun NFT gameplay fields: `traits`, `set`, `faction`, `bonus`, `synergy`, `agentSkills`; root `schemaVersion` (semver). |

## Changelog

**[CHANGELOG.md](CHANGELOG.md)** records **schema shape** changes (semver of the JSON contract, not the NFT collection). Use it when bumping `schemaVersion` in payloads or planning indexer migrations.

## Related product and integration docs

- Product context and versioning expectations: [../product/leprechaun-nfts.md](../product/leprechaun-nfts.md)
- Indexer migration and multi-version acceptance: [../indexer/design.md](../indexer/design.md)
- Agents and metadata hints: [../agents/metadata-and-skills.md](../agents/metadata-and-skills.md)

---

**Agent phase:** [Phase 8 — Leprechaun NFTs and onchain metadata schema](../agent-phases.md#phase-8)
