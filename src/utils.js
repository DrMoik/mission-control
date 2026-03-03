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

// ── Bilingual field helpers ────────────────────────────────────────────────────
// Bilingual fields are stored as { en: string, es: string }.
// UI is Spanish-only for now; these helpers remain for backward-compat with stored data.

/**
 * Returns the localised string for a bilingual field.
 * Falls back to the other language if the preferred one is empty,
 * and to the raw string value for backward-compatible plain strings.
 *
 * @param {string | {en:string, es:string} | null | undefined} field
 * @param {'en'|'es'} lang
 */
export const getL = (field, lang = 'es') => {
  if (!field) return '';
  if (typeof field === 'string') return field;            // backward compat
  return field[lang] || field[lang === 'en' ? 'es' : 'en'] || '';
};

/**
 * Normalises a value to a bilingual object { en, es }.
 * Plain strings are copied to both languages.
 */
export const toL = (value) => {
  if (!value) return { en: '', es: '' };
  if (typeof value === 'string') return { en: value, es: value };
  return { en: value.en || '', es: value.es || '' };
};

/**
 * On creation: if one language slot is empty, copy from the other.
 * Ensures the user doesn't accidentally save a blank translation.
 */
export const fillL = (field) => {
  const l = toL(field);
  return { en: l.en || l.es, es: l.es || l.en };
};

/**
 * Ensures a value is a string for display. Handles bilingual objects {en, es}
 * and plain strings. Use when rendering values that might come from Firestore
 * as either format (avoids React error #31).
 */
export const ensureString = (val, lang = 'es') => {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && ('en' in val || 'es' in val)) return getL(val, lang);
  return String(val);
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
