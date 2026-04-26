// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAudioEngine } from "./useAudioEngine";

const GLYPH = {
  play: "\u25B6",
  pause: "\u23F8",
  skip: "\u23ED",
  soundOn: "\u{1F50A}",
  muted: "\u{1F507}",
  chevronRight: "\u25B8",
  chevronDown: "\u25BE",
} as const;

const ALBUM_DISPLAY_NAME = "Blockie Hills";
const TICKER_PAUSE_MS = 1000;
/** Horizontal scroll speed for the collapsed ticker (px/s). */
const TICKER_SCROLL_SPEED = 42;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function buildTickerLine(unlocked: boolean, trackTitle: string): string {
  if (!unlocked) {
    return `${ALBUM_DISPLAY_NAME} — Tap anywhere or ▶ if autoplay was blocked`;
  }
  return `${ALBUM_DISPLAY_NAME} — ${trackTitle}`;
}

/**
 * Floating BGM + mix dock (GitLab #68): fixed top-right bubble; header mute +
 * collapsible track / volume controls. Collapsed header shows a horizontal
 * album — track ticker (pauses at scroll ends) when the line overflows.
 */
export function AlbumPlayerBar() {
  const a = useAudioEngine();
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const tickerOuterRef = useRef<HTMLDivElement>(null);
  const tickerInnerRef = useRef<HTMLDivElement>(null);
  const [tickerLayoutBump, setTickerLayoutBump] = useState(0);

  const tickerText = buildTickerLine(a.unlocked, a.currentTrack.title);

  useLayoutEffect(() => {
    if (detailsOpen) return;
    const outer = tickerOuterRef.current;
    const inner = tickerInnerRef.current;
    if (!outer || !inner) return;
    const apply = () => {
      const delta = Math.max(0, inner.scrollWidth - outer.clientWidth);
      inner.style.setProperty("--ticker-delta", `${delta}px`);
    };
    apply();
    void document.fonts?.ready?.then(() => {
      apply();
      setTickerLayoutBump((n) => n + 1);
    });
  }, [detailsOpen, tickerText, a.unlocked, a.currentTrack.title]);

  useEffect(() => {
    if (detailsOpen) return;

    const inner = tickerInnerRef.current;
    const outer = tickerOuterRef.current;
    if (!inner || !outer) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReduced) {
      inner.style.transform = "";
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;

    const runLoop = async () => {
      while (!signal.aborted) {
        const delta = Math.max(0, inner.scrollWidth - outer.clientWidth);
        inner.style.transform = "translateX(0)";
        if (delta <= 0) {
          try {
            await sleep(400, signal);
          } catch {
            return;
          }
          continue;
        }

        try {
          await sleep(TICKER_PAUSE_MS, signal);
        } catch {
          return;
        }
        if (signal.aborted) return;

        const scrollMs = Math.min(14_000, Math.max(900, (delta / TICKER_SCROLL_SPEED) * 1000));
        const anim = inner.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${-delta}px)` },
          ],
          { duration: scrollMs, easing: "linear", fill: "forwards" },
        );
        try {
          await anim.finished;
        } catch {
          anim.cancel();
          return;
        }
        anim.cancel();
        if (signal.aborted) return;

        try {
          await sleep(TICKER_PAUSE_MS, signal);
        } catch {
          return;
        }
        inner.style.transform = "translateX(0)";
      }
    };

    let raf = 0;
    raf = requestAnimationFrame(() => {
      void runLoop();
    });

    let resizeDebounce: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeDebounce);
      resizeDebounce = window.setTimeout(() => {
        setTickerLayoutBump((n) => n + 1);
      }, 120);
    });
    ro.observe(outer);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(resizeDebounce);
      ac.abort();
      ro.disconnect();
      inner.getAnimations().forEach((x) => x.cancel());
      inner.style.transform = "";
    };
  }, [detailsOpen, tickerText, a.unlocked, a.currentTrack.title, tickerLayoutBump]);

  return (
    <aside
      className="album-player-dock"
      data-sfx-ignore="true"
      aria-label="Background music"
    >
      <div className="album-player">
        <div className="album-player__head">
          {detailsOpen ? (
            <span className="album-player__badge">{ALBUM_DISPLAY_NAME}</span>
          ) : (
            <div
              className="album-player__ticker"
              ref={tickerOuterRef}
              aria-label={tickerText}
              title={tickerText}
            >
              <div className="album-player__ticker-inner" ref={tickerInnerRef}>
                {tickerText}
              </div>
            </div>
          )}
          <div className="album-player__head-actions">
            <button
              type="button"
              className={`album-player__icon-btn album-player__icon-btn--head${
                a.masterMuted ? " album-player__icon-btn--muted" : ""
              }`}
              onClick={() => a.setMasterMuted(!a.masterMuted)}
              aria-pressed={a.masterMuted}
              aria-label={a.masterMuted ? "Unmute all" : "Mute all"}
              title={a.masterMuted ? "Unmute all" : "Mute all"}
            >
              {a.masterMuted ? GLYPH.muted : GLYPH.soundOn}
            </button>
            <button
              type="button"
              className="album-player__icon-btn album-player__icon-btn--head album-player__collapse-toggle"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((v) => !v)}
              aria-label={detailsOpen ? "Hide track and volume controls" : "Show track and volume controls"}
              title={detailsOpen ? "Hide details" : "Show details"}
            >
              {detailsOpen ? GLYPH.chevronDown : GLYPH.chevronRight}
            </button>
          </div>
        </div>
        <div
          id={detailsId}
          className="album-player__details"
          hidden={!detailsOpen}
        >
          <div className="album-player__title-row">
            <div className="album-player__transport-inline" role="group" aria-label="Playback">
              <button
                type="button"
                className="album-player__icon-btn"
                onClick={() => void a.toggleBgm()}
                aria-pressed={a.bgmPlaying}
                aria-label={a.bgmPlaying ? "Pause music" : "Play music"}
                title={a.bgmPlaying ? "Pause" : "Play"}
              >
                {a.bgmPlaying ? GLYPH.pause : GLYPH.play}
              </button>
              <button
                type="button"
                className="album-player__icon-btn"
                onClick={() => a.skipBgm()}
                aria-label="Next track"
                title="Next track"
              >
                {GLYPH.skip}
              </button>
            </div>
            <span className="album-player__title" title={a.currentTrack.title}>
              {a.unlocked ? a.currentTrack.title : "Tap anywhere or ▶ if autoplay was blocked"}
            </span>
          </div>
          <label className="album-player__vol">
            <span className="album-player__vol-label">Music</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(a.bgmPermille / 10)}
              onChange={(e) => a.setBgmPermille(Number(e.target.value) * 10)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(a.bgmPermille / 10)}
              aria-label="Music volume percent"
            />
          </label>
          <label className="album-player__vol">
            <span className="album-player__vol-label">Effects</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(a.sfxPermille / 10)}
              onChange={(e) => a.setSfxPermille(Number(e.target.value) * 10)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(a.sfxPermille / 10)}
              aria-label="Effects volume percent"
            />
          </label>
        </div>
      </div>
    </aside>
  );
}
