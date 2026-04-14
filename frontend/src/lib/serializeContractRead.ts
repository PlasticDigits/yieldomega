// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Wagmi read shapes often contain `bigint` in `result`. React 19 dev tooling may call
 * `JSON.stringify` on component props, which throws on BigInt — serialize at boundaries.
 */

export type SerializableContractRead = {
  status: "success" | "failure";
  result?: string;
};

function stringifyReadResult(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function serializeContractRead(
  read: { status: string; result?: unknown } | undefined,
): SerializableContractRead | undefined {
  if (!read) {
    return undefined;
  }
  if (read.status !== "success") {
    return { status: "failure", result: undefined };
  }
  if (read.result === undefined) {
    return { status: "success", result: undefined };
  }
  return { status: "success", result: stringifyReadResult(read.result) };
}
