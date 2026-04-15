// SPDX-License-Identifier: AGPL-3.0-only

import blockies from "ethereum-blockies";
import { useLayoutEffect, useRef } from "react";

type Props = {
  address: string;
  /** Display width/height in CSS pixels (canvas is generated slightly larger then scaled down for crisp edges). */
  size?: number;
  className?: string;
  title?: string;
};

function normalizedSeed(address: string): string {
  const t = address.trim().toLowerCase();
  if (t.startsWith("0x") && t.length >= 4) return t;
  if (/^[0-9a-f]+$/i.test(t) && t.length >= 4) return `0x${t}`;
  return t;
}

/**
 * Ethereum-style blocky identicon (same family as MetaMask / Etherscan), seeded by the wallet address.
 */
export function WalletBlockie({ address, size = 36, className, title }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seed = normalizedSeed(address);
    el.replaceChildren();

    const grid = 8;
    const scale = Math.max(3, Math.ceil(size / grid));
    const canvas = blockies.create({
      seed,
      size: grid,
      scale,
    });
    // Do not set canvas width/height after create(): resetting those attributes clears the bitmap
    // (ethereum-blockies already sets dimensions and draws in renderIcon).
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.flexShrink = "0";
    el.appendChild(canvas);

    return () => {
      el.replaceChildren();
    };
  }, [address, size]);

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
