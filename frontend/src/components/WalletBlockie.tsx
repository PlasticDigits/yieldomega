// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect, useRef } from "react";
import { getWalletBlockieSourceCanvas } from "@/lib/walletBlockieCanvas";

type Props = {
  address: string;
  /** Display width/height in CSS pixels (canvas is generated at a fixed source size then scaled). */
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Ethereum-style blocky identicon (same family as MetaMask / Etherscan), seeded by the wallet address.
 */
export function WalletBlockie({ address, size = 36, className, title }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();

    const canvas = getWalletBlockieSourceCanvas(address);
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.flexShrink = "0";
    canvas.style.imageRendering = "pixelated";
    el.appendChild(canvas);

    return () => {
      el.replaceChildren();
    };
  }, [address]);

  return (
    <span
      ref={ref}
      className={className}
      title={title ?? address}
      aria-hidden
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}
