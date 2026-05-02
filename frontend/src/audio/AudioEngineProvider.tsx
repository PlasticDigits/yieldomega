// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { BLOCKIE_HILLS_PLAYLIST } from "./albumPlaylist";
import { loadAudioPlaybackState } from "./audioPlaybackState";
import { AudioEngineContext, type AudioEngineApi } from "./audioEngineContext";
import { loadAudioPrefs, saveAudioPrefs, type AudioPrefsV1 } from "./audioPreferences";
import { playGameSfx, registerGameAudioEngine } from "./playGameSfx";
import { WebAudioMixer } from "./WebAudioMixer";

function WalletConnectSfx() {
  const { isConnected } = useAccount();
  const prev = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (prev.current === false && isConnected) {
      playGameSfx("charmed_confirm", { gainMul: 0.88 });
    }
    prev.current = isConnected;
  }, [isConnected]);
  return null;
}

function sfxUiTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  if (el.closest('[data-sfx-ignore="true"]')) return false;
  if (el.closest("input, textarea, select")) return false;
  return Boolean(
    el.closest(
      "button, [role='button'], a.nav-link, a.timecurve-subnav__link, a.brand-link, a.footer-link-pill",
    ),
  );
}

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AudioPrefsV1>(() => loadAudioPrefs());
  const [unlocked, setUnlocked] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(() =>
    typeof window !== "undefined" ? loadAudioPlaybackState(BLOCKIE_HILLS_PLAYLIST).trackIndex : 0,
  );
  const mixerRef = useRef<WebAudioMixer | null>(null);

  if (!mixerRef.current) {
    mixerRef.current = new WebAudioMixer(loadAudioPrefs());
  }
  const mixer = mixerRef.current;

  useEffect(() => {
    mixer.setCallbacks({
      onTrackChange: (_t, idx) => setTrackIndex(idx),
      onPlayingChange: (p) => setBgmPlaying(p),
    });
  }, [mixer]);

  useEffect(() => {
    mixer.applyPrefs(prefs);
    saveAudioPrefs(prefs);
  }, [mixer, prefs]);

  useEffect(() => {
    registerGameAudioEngine(mixer);
    return () => registerGameAudioEngine(null);
  }, [mixer]);

  const unlockedRef = useRef(false);
  useEffect(() => {
    unlockedRef.current = unlocked;
  }, [unlocked]);

  const unlockInFlight = useRef(false);

  const prefetchCommonSfx = useCallback(() => {
    return mixer.prefetchSfx([
      "ui_button_click",
      "charmed_confirm",
      "coin_hit_shallow",
      "peer_buy_distant",
      "timer_heartbeat_calm",
      "timer_heartbeat_urgent",
      "warbow_twang",
    ]);
  }, [mixer]);

  const unlockFromGesture = useCallback(async () => {
    if (unlockedRef.current || unlockInFlight.current) return;
    unlockInFlight.current = true;
    try {
      await mixer.unlock();
      await prefetchCommonSfx();
      if (!mixer.isBgmPlaying()) {
        await mixer.playBgm();
      }
      unlockedRef.current = true;
      setUnlocked(true);
    } finally {
      unlockInFlight.current = false;
    }
  }, [mixer, prefetchCommonSfx]);

  /** Try BGM on load; browsers usually block until a gesture — then {@link unlockFromGesture} starts BGM. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await mixer.playBgm();
      if (cancelled) return;
      if (mixer.isBgmPlaying() && !unlockedRef.current) {
        unlockedRef.current = true;
        setUnlocked(true);
        void prefetchCommonSfx();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mixer, prefetchCommonSfx]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const ui = sfxUiTarget(e.target);
      if (!unlockedRef.current && !ui) {
        void unlockFromGesture();
        return;
      }
      if (!unlockedRef.current && ui) {
        void (async () => {
          await unlockFromGesture();
          const btn = (e.target as Element).closest("button");
          const disabled = btn instanceof HTMLButtonElement && btn.disabled;
          playGameSfx("ui_button_click", { gainMul: disabled ? 0.48 : 0.82 });
        })();
        return;
      }
      if (unlockedRef.current && ui) {
        const btn = (e.target as Element).closest("button");
        const disabled = btn instanceof HTMLButtonElement && btn.disabled;
        playGameSfx("ui_button_click", { gainMul: disabled ? 0.48 : 0.82 });
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [unlockFromGesture]);

  const api = useMemo<AudioEngineApi>(() => {
    const currentTrack = BLOCKIE_HILLS_PLAYLIST[trackIndex] ?? BLOCKIE_HILLS_PLAYLIST[0];
    return {
      unlocked,
      bgmPlaying,
      currentTrack,
      bgmPermille: prefs.bgmPermille,
      sfxPermille: prefs.sfxPermille,
      masterMuted: prefs.masterMuted,
      bgmMuted: prefs.bgmMuted,
      sfxMuted: prefs.sfxMuted,
      toggleBgm: () => {
        void (async () => {
          if (!unlockedRef.current) {
            await unlockFromGesture();
          }
          if (mixer.isBgmPlaying()) {
            mixer.pauseBgm();
          } else {
            await mixer.playBgm();
          }
        })();
      },
      skipBgm: () => mixer.skipBgmNext(),
      setBgmPermille: (n: number) =>
        setPrefs((p) => ({
          ...p,
          bgmPermille: Math.max(0, Math.min(1000, Math.round(n))),
        })),
      setSfxPermille: (n: number) =>
        setPrefs((p) => ({
          ...p,
          sfxPermille: Math.max(0, Math.min(1000, Math.round(n))),
        })),
      setMasterMuted: (v: boolean) => setPrefs((p) => ({ ...p, masterMuted: v })),
      setBgmMuted: (v: boolean) => setPrefs((p) => ({ ...p, bgmMuted: v })),
      setSfxMuted: (v: boolean) => setPrefs((p) => ({ ...p, sfxMuted: v })),
    };
  }, [mixer, unlockFromGesture, unlocked, bgmPlaying, trackIndex, prefs]);

  return (
    <AudioEngineContext.Provider value={api}>
      <WalletConnectSfx />
      {children}
    </AudioEngineContext.Provider>
  );
}
