---
name: verify-yo-fee-sinks-mobile
description: Verify canonical fee sinks footer and protocol trust addresses on mobile — explorer address links (VITE_EXPLORER_BASE_URL / mega.etherscan.io) + abbreviated display and humanized WarBow / camelCase labels (GitLab #93, #98).
---

# Verify — canonical fee sinks mobile + protocol labels (GitLab #93)

Play this after frontend changes that touch **`FeeTransparency`**, **`MegaScannerAddressLink`**, or **`humanizeKvLabel`**.

## Preconditions

- **`VITE_FEE_ROUTER_ADDRESS`** set so the footer panel loads sink rows (`frontend/.env.local`).
- Optional: **`VITE_INDEXER_URL`** for “Recent SinksUpdated” / fee distribution lines (actor + token addresses).

## Checklist

1. **Wide viewport (≥480px CSS width)**  
   - Footer **Canonical fee sinks**: each sink shows **full** destination `0x…` as a **link**. Hover `title` shows full address.  
   - Link target is **`{VITE_EXPLORER_BASE_URL or https://mega.etherscan.io}/address/`** + address (same base as **tx** links; [GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)).  
   - **`/timecurve/protocol`**: Wired contracts + FeeRouter sink rows match the same address link behavior.

2. **Narrow viewport (≤479px, e.g. iPhone 12 preset 390×844)**  
   - Same rows show **`0x`** + **four** characters + **…** + **four** trailing characters (no mid-string clip without ellipsis).  
   - Tapping the abbreviated control still opens the **configured** explorer origin (**`VITE_EXPLORER_BASE_URL`**, default **mega.etherscan.io**).  
   - List rows **wrap** (`flex-wrap`) so the abbreviated link is not trapped off-screen.

3. **Protocol labels**  
   - On **`/timecurve/protocol`** (and Arena **Raw contract** accordion), identifiers like **`WARBOW_FLAG_SILENCE_SEC`** read as **Warbow Flag Silence Sec**; **`warbowPendingFlagOwner`** as **Warbow Pending Flag Owner**.  
   - Prose labels like **seconds remaining** stay **unchanged**.

4. **Regression**  
   - Indexer mirror lines in **`FeeTransparency`** still show **`TxHash`** Explorer links driven by **`VITE_EXPLORER_BASE_URL`** (defaults to mega for tx paths) — unchanged by address links.

## Spec ↔ automation

| Doc | Automated |
|-----|-----------|
| [timecurve-views.md — Global footer fee sinks](../../../docs/frontend/timecurve-views.md#global-footer-fee-sinks-mobile-issue-93) · [invariants — #93](../../../docs/testing/invariants-and-business-logic.md#canonical-fee-sinks-mobile-gitlab-93) · [#98](../../../docs/testing/invariants-and-business-logic.md#canonical-address-display-gitlab-98) | [`humanizeIdentifier.test.ts`](../../../frontend/src/lib/humanizeIdentifier.test.ts) · [`explorer.test.ts`](../../../frontend/src/lib/explorer.test.ts) · [`megaEtherscan.test.ts`](../../../frontend/src/lib/megaEtherscan.test.ts) · [`addressFormat.test.ts`](../../../frontend/src/lib/addressFormat.test.ts) |

GitLab: [issue #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93).
