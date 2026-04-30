// SPDX-License-Identifier: AGPL-3.0-only

import { isAddress, zeroAddress } from "viem";
import { WalletBlockie } from "@/components/WalletBlockie";
import { shortAddress, type WalletFormatShort } from "@/lib/addressFormat";

export type AddressInlineProps = {
  address: string | undefined;
  /** When set, used for the text beside the blockie; otherwise {@link shortAddress}. */
  formatWallet?: WalletFormatShort;
  fallback?: string;
  /** Blockie canvas size in CSS pixels. */
  size?: number;
  className?: string;
  labelClassName?: string;
};

/**
 * Wallet / contract address with an ethereum-blockies identicon (same family
 * as MetaMask) plus a compact text label.
 */
export function AddressInline({
  address,
  formatWallet,
  fallback = "—",
  size = 20,
  className,
  labelClassName,
}: AddressInlineProps) {
  const raw = address?.trim();
  if (!raw || !isAddress(raw as `0x${string}`) || raw.toLowerCase() === zeroAddress.toLowerCase()) {
    return <span className={labelClassName ?? "mono"}>{fallback}</span>;
  }
  const label = formatWallet ? formatWallet(raw, fallback) : shortAddress(raw, fallback);
  return (
    <span className={["address-inline", className].filter(Boolean).join(" ")} title={raw}>
      <WalletBlockie address={raw} size={size} className="address-inline__blockie" title={raw} />
      <span className={["mono", "address-inline__label", labelClassName].filter(Boolean).join(" ")}>{label}</span>
    </span>
  );
}
