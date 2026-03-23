# Licensing

## Default license: GNU AGPL-3.0

Original work contributed to this repository is intended to be released under the **GNU Affero General Public License v3.0** (AGPL-3.0). The full text is in the repository root [LICENSE](../LICENSE).

### Why AGPL

The project includes **network-facing components** (for example a Rust indexer or HTTP APIs that expose derived chain data). AGPL-3.0 requires that users who interact with a **modified** version over a network can obtain the corresponding source. That aligns with a mission to keep consumer gamefi infrastructure **transparent, forkable, and inspectable**, including when it runs as a service.

### What AGPL does not replace

- **Smart contracts** deployed on MegaETH are public bytecode; AGPL governs **repository** artifacts (source trees, scripts, indexer, frontend).
- **Third-party dependencies** (Foundry, Rust crates, npm packages) remain under their own licenses. A future `NOTICE` or `third-party/` listing should be maintained when implementation begins.

### Contributor expectations

See the repository root [CONTRIBUTING.md](../CONTRIBUTING.md). If the project later adds a **Contributor License Agreement** or **Developer Certificate of Origin (DCO)**, this document should link to it.

### Interpreting “open source” for agents and operators

Operators who run the indexer or host a modified frontend must comply with AGPL obligations (source offer, license preservation, etc.). Documentation and agent skills should **not** advise circumventing license terms.

---

**Agent phase:** [Phase 2 — Licensing and compliance posture](agent-phases.md#phase-2)
