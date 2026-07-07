// SPDX-License-Identifier: AGPL-3.0-only

/** Shown after a successful clipboard write on the buy result card (#365). */
export const ARENA_BUY_RESULT_COPY_SUCCESS = "Copied to clipboard!";

/** Clipboard API missing (non-secure context, very old browsers). */
export const ARENA_BUY_RESULT_COPY_UNSUPPORTED =
  "Could not copy — select the text manually or use a secure (https) context.";

/** `writeText` rejected (permission denied, etc.). */
export const ARENA_BUY_RESULT_COPY_REJECTED = "Could not copy — select the text manually.";

export const ARENA_BUY_RESULT_COPY_BANNER_MS = 2_600;
