// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ARENA_BUY_EFFECT_TOAST_DISMISS_MS,
  ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE,
  ARENA_BUY_EFFECT_TOAST_STAGGER_MS,
  type ArenaBuyEffectToast,
} from "@/pages/arena/arenaBuyEffectToastLines";

type Props = {
  toasts: readonly ArenaBuyEffectToast[];
  onDismiss: (id: string) => void;
  reduceMotion?: boolean;
};

function toastToneClass(line: string): string {
  if (line.includes("->") && line.includes("Level")) {
    return "arena-buy-effect-toast--level";
  }
  if (line.includes("BP")) {
    return "arena-buy-effect-toast--warbow";
  }
  if (line.toLowerCase().includes("flag")) {
    return "arena-buy-effect-toast--flag";
  }
  if (line.startsWith("+") && line.endsWith("xp")) {
    return "arena-buy-effect-toast--xp";
  }
  if (line.endsWith("s") && line.startsWith("+")) {
    return "arena-buy-effect-toast--timer";
  }
  return "";
}

function ArenaBuyEffectToastItem({
  toast,
  index,
  reduceMotion,
  onDismiss,
}: {
  toast: ArenaBuyEffectToast;
  index: number;
  reduceMotion: boolean;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const delayMs = reduceMotion
      ? ARENA_BUY_EFFECT_TOAST_DISMISS_MS
      : ARENA_BUY_EFFECT_TOAST_DISMISS_MS + index * ARENA_BUY_EFFECT_TOAST_STAGGER_MS;
    const timeoutId = window.setTimeout(() => onDismiss(toast.id), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [index, onDismiss, reduceMotion, toast.id]);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.98 },
        transition: {
          duration: 0.22,
          delay: index * (ARENA_BUY_EFFECT_TOAST_STAGGER_MS / 1000),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };

  return (
    <motion.div
      className={[
        "arena-buy-effect-toast",
        toastToneClass(toast.line),
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="arena-buy-effect-toast"
      role="status"
      {...motionProps}
    >
      {toast.line}
    </motion.div>
  );
}

/** Compact glass toast stack for post-buy effect feedback on the play route (#337). */
export function ArenaEffectToastStack({ toasts, onDismiss, reduceMotion }: Props) {
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion ?? Boolean(systemReducedMotion);
  const visible = toasts.slice(-ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE);
  if (visible.length === 0) return null;

  const stack = (
    <div
      className="arena-effect-toast-stack"
      aria-live="polite"
      aria-label="Buy effects"
      data-testid="arena-buy-effect-toast-stack"
    >
      <AnimatePresence initial={false}>
        {visible.map((toast, index) => (
          <ArenaBuyEffectToastItem
            key={toast.id}
            toast={toast}
            index={index}
            reduceMotion={motionReduced}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  if (typeof document === "undefined") return stack;
  return createPortal(stack, document.body);
}
