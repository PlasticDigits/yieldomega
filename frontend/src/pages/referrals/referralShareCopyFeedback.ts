// SPDX-License-Identifier: AGPL-3.0-only

/** Shown after a successful clipboard write (GitLab #86). */
export const REFERRAL_COPY_SUCCESS_BANNER = "Copied to clipboard!";

/** Clipboard API missing (non-secure context, very old browsers). */
export const REFERRAL_COPY_ERROR_UNSUPPORTED =
  "Could not copy — select the link manually or use a secure (https) context.";

/** `writeText` rejected (permission denied, etc.). */
export const REFERRAL_COPY_ERROR_REJECTED =
  "Could not copy — select the link manually.";

export const REFERRAL_COPY_BANNER_MS = 2_600;
