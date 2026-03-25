// SPDX-License-Identifier: AGPL-3.0-only

import { useReadContracts } from "wagmi";
import { addresses } from "@/lib/addresses";
import { feeRouterReadAbi } from "@/lib/abis";

const LABELS = ["DOUB LP", "Rabbit Treasury", "Prizes", "CL8Y buy-and-burn"];

export function FeeTransparency() {
  const fr = addresses.feeRouter;
  const { data, isPending, isError } = useReadContracts({
    contracts: fr
      ? ([0, 1, 2, 3] as const).map((i) => ({
          address: fr,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)],
        }))
      : [],
    query: { enabled: Boolean(fr) },
  });

  if (!fr) {
    return (
      <p className="muted">
        Fee router: set <code>VITE_FEE_ROUTER_ADDRESS</code> to show sink destinations.
      </p>
    );
  }

  if (isPending) {
    return <p className="muted">Loading fee router…</p>;
  }
  if (isError || !data) {
    return <p className="muted">Could not read fee router.</p>;
  }

  return (
    <ul className="fee-sink-list">
      {data.map((row, i) => {
        if (row.status !== "success" || row.result === undefined) {
          return null;
        }
        const [dest, bps] = row.result as readonly [`0x${string}`, number];
        return (
          <li key={i}>
            <strong>{LABELS[i] ?? `Sink ${i}`}</strong>: {bps} bps →{" "}
            <span className="mono">{dest}</span>
          </li>
        );
      })}
    </ul>
  );
}
