// ─── UTILITIES ────────────────────────────────────────────────────────────────
// Pure helper functions with no side-effects or external dependencies.

import { ROLE_RANK } from './constants.js';

// ── Role helpers ──────────────────────────────────────────────────────────────

/** Returns the numeric rank of a role string (higher = more privileged). */
export const rankOf = (r) => ROLE_RANK[r] ?? -1;

/**
 * Returns true if `role` is at least as privileged as `min`.
 * @example atLeast('senior', 'rookie') // true
 */
export const atLeast = (role, min) => rankOf(role) >= rankOf(min);

// ── Firestore timestamp helpers ───────────────────────────────────────────────

/**
 * Converts a Firestore Timestamp, a plain Date, or a millisecond number
 * to a JavaScript Date object.  Returns epoch (Jan 1, 1970) if the value
 * is falsy so consumers don't need to null-check.
 */
export const tsToDate = (ts) => {
  if (!ts) return new Date(0);
  if (typeof ts.toDate === 'function') return ts.toDate();
  return new Date(ts);
};

// ── Media helpers ─────────────────────────────────────────────────────────────

/**
 * Converts a YouTube or Vimeo watch URL into its embeddable iframe src.
 * Returns the original URL unchanged if it's already an embed URL or
 * if it can't be parsed.
 */
export function toEmbedUrl(url) {
  if (!url) return '';
  // Already an embed URL — leave it alone
  if (url.includes('/embed/') || url.includes('player.vimeo')) return url;
  // YouTube: https://www.youtube.com/watch?v=ID  or  https://youtu.be/ID
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo: https://vimeo.com/123456789
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  // Unknown URL — return as-is
  return url;
}
