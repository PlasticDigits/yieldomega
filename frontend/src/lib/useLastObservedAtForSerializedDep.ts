// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Records `Date.now()` whenever `serializedDep` changes (e.g. serialized CL8Y bigint).
 * Use for “last updated” affordances on derived USD lines ([GitLab #192](https://gitlab.com/PlasticDigits/yieldomega/-/issues/192)).
 */
export function useLastObservedAtForSerializedDep(serializedDep: string | undefined): number | undefined {
  const prev = useRef<string | undefined>(undefined);
  const [at, setAt] = useState<number | undefined>(() => {
    if (serializedDep === undefined) {
      return undefined;
    }
    prev.current = serializedDep;
    return Date.now();
  });

  useLayoutEffect(() => {
    if (serializedDep === undefined) {
      prev.current = undefined;
      setAt(undefined);
      return;
    }
    if (prev.current !== serializedDep) {
      prev.current = serializedDep;
      setAt(Date.now());
    }
  }, [serializedDep]);

  return serializedDep === undefined ? undefined : at;
}
