// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import type { SerializableContractRead } from "@/lib/serializeContractRead";

export type StatDisplayCtx = {
  isPending: boolean;
  /** When omitted, treated as connected (caller-only wallet gates pass `false`). */
  isConnected?: boolean;
};

type LabelPack = {
  loading?: string;
  missing?: string;
  connect?: string;
};

function ph(text: string): ReactNode {
  return <EmptyDataPlaceholder>{text}</EmptyDataPlaceholder>;
}

/**
 * Maps a serialized wagmi-style read into either the success renderer or an explicit empty state.
 */
export function statFromContractRead(
  read: SerializableContractRead | undefined,
  ctx: StatDisplayCtx,
  options: {
    requireWallet?: boolean;
    mapSuccess: (result: string) => ReactNode;
    labels?: LabelPack;
  },
): ReactNode {
  const { requireWallet = false, mapSuccess, labels = {} } = options;
  const loading = labels.loading ?? "Loading…";
  const missing = labels.missing ?? "No data yet";
  const connect = labels.connect ?? "Connect a wallet to see this.";
  const isConnected = ctx.isConnected ?? true;

  if (requireWallet && !isConnected) {
    return ph(connect);
  }
  const pending = ctx.isPending;
  if (!read) {
    return ph(pending ? loading : missing);
  }
  if (read.status === "success" && read.result !== undefined) {
    return mapSuccess(read.result);
  }
  return ph(pending ? loading : missing);
}

/** For optional string payloads resolved outside `SerializableContractRead` (e.g. indexer merge). */
export function statFromOptionalString(
  value: string | undefined,
  ctx: Pick<StatDisplayCtx, "isPending">,
  options: {
    mapSuccess: (raw: string) => ReactNode;
    labels?: Pick<LabelPack, "loading" | "missing">;
  },
): ReactNode {
  const { mapSuccess, labels = {} } = options;
  const loading = labels.loading ?? "Loading…";
  const missing = labels.missing ?? "No data yet";
  if (value !== undefined) {
    return mapSuccess(value);
  }
  return ph(ctx.isPending ? loading : missing);
}
