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
/** Collapsed ticker + details title when the audio graph is not yet running (BGM stays paused until ▶). */
const LOCKED_PLAYER_HEADLINE = "Tap a control or ▶ to unlock (music starts paused)";
/** Pause (ms) at the **start** of each cycle before scrolling (then again at end). */
const TICKER_PAUSE_MS = 1500;
/** Horizontal scroll speed for the collapsed ticker (px/s); lower = slower. */
const TICKER_SCROLL_SPEED = 22 / 1.2;

/**
 * Text width minus ticker viewport. Prefer {@link measureEl} (fixed off-screen
 * probe) — the visible inner node is often flex-clamped so its width matches
 * the strip and overflow reads as 0.
 */
function measureTickerOverflowPx(
  outer: HTMLElement,
  measureEl: HTMLElement | null,
  inner: HTMLElement,
): number {
  outer.scrollLeft = 0;
  const viewport = outer.clientWidth;
  if (viewport <= 0) return 0;

  let contentW = measureEl?.offsetWidth ?? 0;
  if (contentW <= viewport + 0.5) {
    contentW = Math.max(contentW, inner.offsetWidth, inner.scrollWidth);
    const br = inner.getBoundingClientRect().width;
    if (Number.isFinite(br) && br > 0) {
      contentW = Math.max(contentW, br);
    }
    try {
      const range = document.createRange();
      range.selectNodeContents(inner);
      const rw = range.getBoundingClientRect().width;
      if (Number.isFinite(rw) && rw > 0) {
        contentW = Math.max(contentW, rw);
      }
    } catch {
      /* ignore */
    }
  }

  return Math.max(0, Math.ceil(contentW - viewport));
}

function nativeTickerScrollRangePx(outer: HTMLElement): number {
  return Math.max(0, Math.ceil(outer.scrollWidth - outer.clientWidth));
}

function animateScrollLeftLinear(
  el: HTMLElement,
  target: number,
  durationMs: number,
  signal: AbortSignal,
): Promise<void> {
  const startLeft = el.scrollLeft;
  const delta = target - startLeft;
  if (durationMs <= 0 || Math.abs(delta) < 0.5) {
    el.scrollLeft = target;
    return Promise.resolve();
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const frame = (now: number) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const u = Math.min(1, (now - t0) / durationMs);
      el.scrollLeft = startLeft + delta * u;
      if (u >= 1) {
        el.scrollLeft = target;
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function animateTranslateInnerLinear(
  el: HTMLElement,
  shiftPx: number,
  durationMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (shiftPx <= 0 || durationMs <= 0) {
    el.style.transform = "";
    return Promise.resolve();
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const frame = (now: number) => {
      if (signal.aborted) {
        el.style.transform = "";
        resolve();
        return;
      }
      const u = Math.min(1, (now - t0) / durationMs);
      el.style.transform = `translateX(${-shiftPx * u}px)`;
      if (u >= 1) {
        el.style.transform = `translateX(${-shiftPx}px)`;
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

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
    return `${ALBUM_DISPLAY_NAME} — ${LOCKED_PLAYER_HEADLINE}`;
  }
  return `${ALBUM_DISPLAY_NAME} — ${trackTitle}`;
}

type AlbumPlayerBarProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Floating BGM + mix dock (GitLab #68): standalone by default; RootLayout can
 * control visibility from the shell header music button.
 */
export function AlbumPlayerBar({ open, onOpenChange }: AlbumPlayerBarProps = {}) {
  const a = useAudioEngine();
  const detailsId = useId();
  const controlled = open !== undefined;
  const [uncontrolledDetailsOpen, setUncontrolledDetailsOpen] = useState(false);
  const visible = controlled ? open : true;
  const detailsOpen = controlled ? Boolean(open) : uncontrolledDetailsOpen;
  const setDetailsOpen = (next: boolean | ((value: boolean) => boolean)) => {
    const resolved = typeof next === "function" ? next(detailsOpen) : next;
    if (controlled) {
      onOpenChange?.(resolved);
      return;
    }
    setUncontrolledDetailsOpen(resolved);
  };

  const tickerOuterRef = useRef<HTMLDivElement>(null);
  const tickerInnerRef = useRef<HTMLDivElement>(null);
  const tickerMeasureRef = useRef<HTMLSpanElement>(null);

  const tickerText = buildTickerLine(a.unlocked, a.currentTrack.title);

  useLayoutEffect(() => {
    if (!visible) return;
    if (detailsOpen) return;
    const outer = tickerOuterRef.current;
    const inner = tickerInnerRef.current;
    if (!outer || !inner) return;
    const apply = () => {
      const delta = measureTickerOverflowPx(outer, tickerMeasureRef.current, inner);
      inner.style.setProperty("--ticker-delta", `${delta}px`);
    };
    apply();
    void document.fonts?.ready?.then(() => {
      apply();
    });
  }, [detailsOpen, tickerText, visible]);

  useEffect(() => {
    if (!visible) return;
    if (detailsOpen) return;

    const inner = tickerInnerRef.current;
    const outer = tickerOuterRef.current;
    const measureEl = tickerMeasureRef.current;
    if (!inner || !outer) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReduced) {
      outer.scrollLeft = 0;
      inner.style.transform = "";
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;

    const runLoop = async () => {
      await doubleRaf();
      if (signal.aborted) return;

      while (!signal.aborted) {
        outer.scrollLeft = 0;
        inner.style.transform = "";

        let overflow = measureTickerOverflowPx(outer, measureEl, inner);
        let scrollRange = nativeTickerScrollRangePx(outer);
        if (overflow <= 0 && scrollRange <= 0) {
          await doubleRaf();
          overflow = measureTickerOverflowPx(outer, measureEl, inner);
          scrollRange = nativeTickerScrollRangePx(outer);
        }

        const useScroll = scrollRange > 0;
        const travel = useScroll ? scrollRange : overflow;

        if (travel <= 0) {
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

        overflow = measureTickerOverflowPx(outer, measureEl, inner);
        scrollRange = nativeTickerScrollRangePx(outer);
        const useScroll2 = scrollRange > 0;
        const travel2 = useScroll2 ? scrollRange : overflow;
        if (travel2 <= 0) continue;

        const scrollMs = Math.min(18_000, Math.max(1200, (travel2 / TICKER_SCROLL_SPEED) * 1000));
        if (useScroll2) {
          await animateScrollLeftLinear(outer, scrollRange, scrollMs, signal);
        } else {
          await animateTranslateInnerLinear(inner, overflow, scrollMs, signal);
        }
        if (signal.aborted) return;

        try {
          await sleep(TICKER_PAUSE_MS, signal);
        } catch {
          return;
        }
        outer.scrollLeft = 0;
        inner.style.transform = "";
      }
    };

    /** Infinite loop until unmount / deps change (aborted). ResizeObserver only
     * refreshes `--ticker-delta`; it must not restart this effect. */
    void runLoop();

    let resizeDebounce: number | undefined;
    const scheduleMeasurementRefresh = () => {
      window.clearTimeout(resizeDebounce);
      resizeDebounce = window.setTimeout(() => {
        const delta = measureTickerOverflowPx(outer, measureEl, inner);
        inner.style.setProperty("--ticker-delta", `${delta}px`);
      }, 120);
    };
    const ro = new ResizeObserver(scheduleMeasurementRefresh);
    ro.observe(outer);

    return () => {
      window.clearTimeout(resizeDebounce);
      ac.abort();
      ro.disconnect();
      outer.scrollLeft = 0;
      inner.style.transform = "";
    };
  }, [detailsOpen, tickerText, visible]);

  if (!visible) {
    return null;
  }

  return (
    <aside
      id="album-player-dock"
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
              dir="ltr"
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
            <span className="album-player__title" title={a.unlocked ? a.currentTrack.title : LOCKED_PLAYER_HEADLINE}>
              {a.unlocked ? a.currentTrack.title : LOCKED_PLAYER_HEADLINE}
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
        <span ref={tickerMeasureRef} className="album-player__ticker-measure" aria-hidden>
          {tickerText}
        </span>
      </div>
    </aside>
  );
}
