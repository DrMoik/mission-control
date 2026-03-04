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

// ── Week (Monday–Sunday) helpers ──────────────────────────────────────────
// All in local time so week boundaries don't shift with timezone.

/** Format a Date as YYYY-MM-DD in local time (no UTC shift). */
export function dateToLocalYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the Monday of the week for the given date (or today) as YYYY-MM-DD in local time. Week = Monday–Sunday. */
export function getMondayOfWeekLocal(date = new Date()) {
  const d = new Date(date.getTime());
  const day = d.getDay() || 7; // Sun=0 → 7 so Monday=1
  d.setDate(d.getDate() - (day - 1));
  return dateToLocalYYYYMMDD(d);
}

/**
 * Normalize a stored weekOf (YYYY-MM-DD, any day of week) to the Monday of that week in local time.
 * Use this when matching weekly statuses so entries saved as e.g. "2026-03-03" (Tuesday) match the
 * current week Monday "2026-03-02". Parses with local date parts to avoid UTC/Timezone quirks.
 */
export function normalizeWeekOfToMonday(weekOfStr) {
  if (!weekOfStr || typeof weekOfStr !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(weekOfStr.trim());
  if (!match) return '';
  const [, y, m, day] = match;
  const month = parseInt(m, 10) - 1;
  const dateNum = parseInt(day, 10);
  if (month < 0 || month > 11 || dateNum < 1 || dateNum > 31) return '';
  const d = new Date(Number(y), month, dateNum);
  return getMondayOfWeekLocal(d);
}

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

// ── Image compression for Firestore (1MB doc limit) ──────────────────────────

/** Max bytes per image to stay under Firestore doc limit. */
const MAX_IMAGE_BYTES = 120000;

/**
 * Compresses a data URL if it exceeds maxBytes. Returns original if not a data URL
 * or if already small enough. Uses canvas resize + JPEG quality reduction.
 */
export async function compressDataUrlIfNeeded(dataUrl, maxBytes = MAX_IMAGE_BYTES) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
  if (dataUrl.length <= maxBytes * 1.4) return dataUrl; // base64 ~1.37× raw bytes
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      let quality = 0.82;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxBytes * 1.4 && quality > 0.4) {
        quality -= 0.12;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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
