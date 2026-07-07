// SPDX-License-Identifier: AGPL-3.0-only

import confetti from "canvas-confetti";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GlassPanel } from "@/components/glass";
import { type ArenaFeatureKey, markFeatureTutorialSeen } from "@/lib/arenaProgression";
import { levelUpCelebrationUnlockLine } from "@/lib/arenaLevelUpCelebration";

const CELEBRATION_PALETTE = ["#7ef1ff", "#2dd4a8", "#e8c04a", "#ffffff", "#4de7c8"];
const AUTO_DISMISS_MS = 3200;

type Props = {
  feature: ArenaFeatureKey | null;
  onDismiss: () => void;
};

export function LevelUpCelebrationPopover({ feature, onDismiss }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    onDismiss();
  }, [clearDismissTimer, onDismiss]);

  useEffect(() => {
    if (!feature) {
      return;
    }
    markFeatureTutorialSeen(feature);
    dismissTimerRef.current = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return clearDismissTimer;
  }, [feature, dismiss, clearDismissTimer]);

  useEffect(() => {
    if (!feature) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, feature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    confettiRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });
  }, []);

  useEffect(() => {
    if (!feature || prefersReducedMotion) {
      return;
    }
    const api = confettiRef.current;
    if (!api) {
      return;
    }
    api({
      disableForReducedMotion: true,
      particleCount: 48,
      spread: 62,
      startVelocity: 26,
      ticks: 160,
      scalar: 0.82,
      colors: CELEBRATION_PALETTE,
      origin: { x: 0.5, y: 0.42 },
    });
    const sideBurst = window.setTimeout(() => {
      api({
        disableForReducedMotion: true,
        particleCount: 22,
        angle: 62,
        spread: 48,
        startVelocity: 18,
        ticks: 120,
        scalar: 0.7,
        colors: CELEBRATION_PALETTE,
        origin: { x: 0.18, y: 0.58 },
      });
      api({
        disableForReducedMotion: true,
        particleCount: 22,
        angle: 118,
        spread: 48,
        startVelocity: 18,
        ticks: 120,
        scalar: 0.7,
        colors: CELEBRATION_PALETTE,
        origin: { x: 0.82, y: 0.58 },
      });
    }, 180);
    return () => window.clearTimeout(sideBurst);
  }, [feature, prefersReducedMotion]);

  if (!feature) {
    return null;
  }

  const unlockLine = levelUpCelebrationUnlockLine(feature);
  const reducedMotion = Boolean(prefersReducedMotion);

  const overlay = (
    <div
      className="level-up-celebration"
      data-testid="level-up-celebration"
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      {!reducedMotion && (
        <canvas
          ref={canvasRef}
          className="level-up-celebration__confetti"
          data-testid="level-up-celebration-confetti"
          aria-hidden
        />
      )}
      <button
        type="button"
        className="level-up-celebration__backdrop"
        aria-label="Dismiss level up celebration"
        data-testid="level-up-celebration-backdrop"
        onClick={dismiss}
      />
      <GlassPanel className="level-up-celebration__panel" tone="gold">
        <div
          className="level-up-celebration__content"
          data-testid="level-up-celebration-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Level up"
          aria-live="polite"
        >
          <div className="level-up-celebration__header">
            <p className="level-up-celebration__eyebrow">Level Up</p>
            <button
              type="button"
              className="level-up-celebration__close"
              aria-label="Close level up celebration"
              data-testid="level-up-celebration-close"
              onClick={dismiss}
            >
              ×
            </button>
          </div>
          <p className="level-up-celebration__unlock">{unlockLine}</p>
        </div>
      </GlassPanel>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }
  return createPortal(overlay, document.body);
}
