// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from "react";
import { AudioEngineContext, type AudioEngineApi } from "./audioEngineContext";

export function useAudioEngine(): AudioEngineApi {
  const v = useContext(AudioEngineContext);
  if (!v) {
    throw new Error("useAudioEngine must be used within AudioEngineProvider");
  }
  return v;
}
