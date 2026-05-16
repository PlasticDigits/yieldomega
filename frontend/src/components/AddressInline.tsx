// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent } from "react";
import { isAddress, zeroAddress } from "viem";
import { WalletBlockie } from "@/components/WalletBlockie";
import { addressTailHex, shortAddress, type WalletFormatShort } from "@/lib/addressFormat";
import { explorerAddressUrl } from "@/lib/explorer";

export type AddressInlineProps = {
  address: string | undefined;
  /** When set, used for the text beside the blockie; otherwise {@link shortAddress}. */
  formatWallet?: WalletFormatShort;
  /**
   * When set, label is the last `tailHexDigits` hex characters (no `0x`). Overrides `formatWallet`
   * for valid 20-byte `0x` addresses (e.g. compact timer / podium chips).
   */
  tailHexDigits?: number;
  fallback?: string;
  /** Blockie canvas size in CSS pixels. */
  size?: number;
  className?: string;
  labelClassName?: string;
  /**
   * When true (default), valid non-zero addresses link to the configured block explorer
   * (`VITE_EXPLORER_BASE_URL`, default MegaETH Etherscan).
   */
  explorer?: boolean;
  /** Use on parent click surfaces so explorer navigation does not bubble (e.g. live-buy row). */
  onExplorerLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Wallet / contract address with an ethereum-blockies identicon (same family
 * as MetaMask) plus a compact text label and optional explorer link (GitLab #98).
 */
export function AddressInline({
  address,
  formatWallet,
  tailHexDigits,
  fallback = "—",
  size = 20,
  className,
  labelClassName,
  explorer = true,
  onExplorerLinkClick,
}: AddressInlineProps) {
  const raw = address?.trim();
  if (!raw || !isAddress(raw as `0x${string}`) || raw.toLowerCase() === zeroAddress.toLowerCase()) {
    return <span className={labelClassName ?? "mono"}>{fallback}</span>;
  }
  const tailLabel =
    tailHexDigits != null && tailHexDigits > 0 ? addressTailHex(raw, tailHexDigits) : "";
  const label =
    tailLabel !== ""
      ? tailLabel
      : formatWallet
        ? formatWallet(raw, fallback)
        : shortAddress(raw, fallback);
  const href = explorer ? explorerAddressUrl(raw) : undefined;

  const labelSpan = (
    <span className={["mono", "address-inline__label", labelClassName].filter(Boolean).join(" ")}>{label}</span>
  );

  const cluster = (
    <>
      <WalletBlockie address={raw} size={size} className="address-inline__blockie" title={raw} />
      {labelSpan}
    </>
  );

  const wrapClass = ["address-inline", className].filter(Boolean).join(" ");

  if (href) {
    return (
      <span className={wrapClass}>
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="address-inline__link cursor-external-link"
          aria-label={`View address on block explorer (opens in new tab): ${raw}`}
          onClick={onExplorerLinkClick}
        >
          {cluster}
        </a>
      </span>
    );
  }

  return (
    <span className={wrapClass} title={raw}>
      {cluster}
    </span>
  );
}
