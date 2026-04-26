// SPDX-License-Identifier: AGPL-3.0-only

import { createContext } from "react";
import type { AlbumTrack } from "./albumPlaylist";

export type AudioEngineApi = {
  unlocked: boolean;
  bgmPlaying: boolean;
  currentTrack: AlbumTrack;
  bgmPermille: number;
  sfxPermille: number;
  masterMuted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
  toggleBgm: () => void;
  skipBgm: () => void;
  setBgmPermille: (n: number) => void;
  setSfxPermille: (n: number) => void;
  setMasterMuted: (v: boolean) => void;
  setBgmMuted: (v: boolean) => void;
  setSfxMuted: (v: boolean) => void;
};

export const AudioEngineContext = createContext<AudioEngineApi | null>(null);
