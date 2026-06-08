// SPDX-License-Identifier: AGPL-3.0-only

import { AddressInline } from "@/components/AddressInline";

type Props = {
  address: string;
  className?: string;
  tailHexDigits?: number;
  size?: number;
  fallback?: string;
  onOpenProfile?: (address: string) => void;
};

/** Blockie + last-six player identity row. */
export function PlayerIdentity({
  address,
  className,
  tailHexDigits = 6,
  size = 14,
  fallback = "—",
  onOpenProfile,
}: Props) {
  return (
    <AddressInline
      address={address}
      className={className}
      tailHexDigits={tailHexDigits}
      size={size}
      fallback={fallback}
      onOpenProfile={onOpenProfile}
    />
  );
}
