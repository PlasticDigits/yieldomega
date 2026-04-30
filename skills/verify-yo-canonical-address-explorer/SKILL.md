---
name: verify-yo-canonical-address-explorer
description: Verify AddressInline blockie + explorer links share VITE_EXPLORER_BASE_URL with tx hashes; live-buy row interaction vs address link (GitLab #98).
---

# Verify — canonical address display + explorer links (GitLab #98)

Play this after frontend changes that touch **`AddressInline`**, **`explorer.ts`**, **`LiveBuyRow`**, or **`MegaScannerAddressLink`**.

## Preconditions

- Dev server or staging build with indexer mocks optional.
- Optional: set **`VITE_EXPLORER_BASE_URL`** in `frontend/.env.local` to a non-default origin to confirm **both** short tx links and **address** links use the same base.

## Checklist

1. **`AddressInline` surfaces** (TimeCurve Simple recent buys, Arena wallets, `/referrals`, protocol rows that use the component):  
   - Each valid non-zero address shows **blockie** + **truncated label** inside one **link** (`target="_blank"`, new tab).  
   - Hover / focus: sensible underline on label; **decorative** blockie not read as separate control (`aria-hidden` on canvas wrapper).  
   - **`0x000…000`** or garbage → **—** (or fallback), **no** `href`.

2. **Explorer URLs**  
   - Default build: address links open **`https://mega.etherscan.io/address/0x…`**.  
   - With **`VITE_EXPLORER_BASE_URL=https://explorer.example/`**, address + **tx** links share that origin (`/address/…`, `/tx/…`).

3. **Live buys row (`LiveBuyRow`)**  
   - **Buyer** link opens explorer; **clicking** the **rest** of the row (meter, ticks) still opens **buy details** (no nested `<button>` around `<a>`).  
   - **Tab**: focus row → Enter/Space opens details; Tab to buyer link → activates explorer.  
   - **tx** link on the row still opens **transaction** explorer.

4. **Fee sinks / protocol monospace links** (`MegaScannerAddressLink`)  
   - Same **`VITE_EXPLORER_BASE_URL`** contract as **`AddressInline`** (see also [`verify-yo-fee-sinks-mobile`](../../skills/verify-yo-fee-sinks-mobile/SKILL.md)).

5. **Regression**  
   - **`TxHash`** component unchanged path semantics (`/tx/`), with `rel` including **noopener**.

## Spec ↔ automation

| Doc | Automated |
|-----|-----------|
| [wallet-connection.md — explorer env](../../../docs/frontend/wallet-connection.md#block-explorer-base-url-gitlab-98) · [invariants — #98](../../../docs/testing/invariants-and-business-logic.md#canonical-address-display-gitlab-98) | [`explorer.test.ts`](../../../frontend/src/lib/explorer.test.ts) · [`megaEtherscan.test.ts`](../../../frontend/src/lib/megaEtherscan.test.ts) · [`timecurve-live-buys-modals.spec.ts`](../../../frontend/e2e/timecurve-live-buys-modals.spec.ts) |

GitLab: [issue #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98).
