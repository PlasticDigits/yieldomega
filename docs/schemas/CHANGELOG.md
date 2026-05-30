# Changelog: JSON schemas

All notable changes to **schema files in this directory** are documented here. Each schema carries its own **`schemaVersion`** semver inside validated JSON payloads; this file tracks **file-level** history and breaking vs additive edits.

Guidance for semver bumps (patch / minor / major) is summarized in [README.md](README.md) and [`../../schemas/archive/`](../../schemas/archive/) (retired [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)).

## [leprechaun-nft-metadata-v1.schema.json](../../schemas/archive/leprechaun-nft-metadata-v1.schema.json) (archived)

### 1.0.0 — 2026-03-23

- Initial draft JSON Schema (Draft 2020-12): required root keys `schemaVersion`, `series`, `traits`, `set`, `faction`, `bonus`, `synergy`, `agentSkills`.
- `traits`: `role`, `rarityTier`, `passiveEffectType` with documented string patterns and integer bounds.
- `set`: `setId`, `positionInSet`, `setSize`, `synergyThresholdCount`; optional `requiredSiblingTokenIds`.
- `faction`: `factionId`; optional `seasonalSeriesId`, `seasonStartUnix`, `seasonEndUnix`.
- `bonus`: `category` enum, `valueRaw`, optional `scale`, `valueCapRaw`.
- `synergy`: `tags` array (bounded length).
- `agentSkills`: required booleans `tradable`, `lendable`, `factionLocked`, `requiresHumanSignature`; optional `soulbound`, `metadataMutableByOwner`.
