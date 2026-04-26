// SPDX-License-Identifier: AGPL-3.0-only

import { useId, useState } from "react";
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

/**
 * Floating BGM + mix dock (GitLab #68): fixed top-right bubble; header mute +
 * collapsible track / volume controls.
 */
export function AlbumPlayerBar() {
  const a = useAudioEngine();
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <aside
      className="album-player-dock"
      data-sfx-ignore="true"
      aria-label="Background music"
    >
      <div className="album-player">
        <div className="album-player__head">
          <span className="album-player__badge">Blockie Hills</span>
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
