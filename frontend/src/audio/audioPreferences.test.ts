// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bgmLinearGainFromPermille,
  loadAudioPrefs,
  saveAudioPrefs,
  sfxCurveGainFromPermille,
  type AudioPrefsV1,
} from "./audioPreferences";

describe("audioPreferences", () => {
  it("maps default BGM 25% to 0.25 linear gain (issue #68)", () => {
    expect(bgmLinearGainFromPermille(250)).toBeCloseTo(0.25, 5);
    expect(bgmLinearGainFromPermille(1000)).toBe(1);
  });

  it("applies a curve to SFX permille so mid values are gentler", () => {
    expect(sfxCurveGainFromPermille(500)).toBeCloseTo(0.25, 5);
    expect(sfxCurveGainFromPermille(1000)).toBe(1);
  });

  describe("localStorage", () => {
    const store: Record<string, string> = {};

    beforeEach(() => {
      vi.stubGlobal("window", {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
          removeItem: (k: string) => {
            delete store[k];
          },
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const k of Object.keys(store)) delete store[k];
    });

    it("defaults bgmUserWantsPlaying to false when missing from JSON", () => {
      saveAudioPrefs({
        bgmPermille: 100,
        sfxPermille: 500,
        masterMuted: true,
        bgmMuted: false,
        sfxMuted: true,
        bgmUserWantsPlaying: true,
      });
      const raw = window.localStorage.getItem("yieldomega:audio:v1:prefs");
      expect(raw).toBeTruthy();
      const o = JSON.parse(raw!) as Record<string, unknown>;
      delete o.bgmUserWantsPlaying;
      window.localStorage.setItem("yieldomega:audio:v1:prefs", JSON.stringify(o));
      const loaded = loadAudioPrefs();
      expect(loaded.bgmUserWantsPlaying).toBe(false);
    });

    it("round-trips bgmUserWantsPlaying", () => {
      const p: AudioPrefsV1 = {
        bgmPermille: 250,
        sfxPermille: 1000,
        masterMuted: false,
        bgmMuted: false,
        sfxMuted: false,
        bgmUserWantsPlaying: true,
      };
      saveAudioPrefs(p);
      expect(loadAudioPrefs().bgmUserWantsPlaying).toBe(true);
    });
  });
});
