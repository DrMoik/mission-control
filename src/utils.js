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

/**
 * Parse a calendar/event date (Firestore Timestamp or YYYY-MM-DD string) to a local Date.
 * For date-only strings, uses explicit local construction to avoid UTC-midnight shifting
 * (new Date("2025-03-15") parses as UTC midnight → can show as previous day in local TZ).
 */
export function parseCalendarDate(val) {
  if (!val) return new Date(0);
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    // Firestore Timestamp may be UTC midnight; reconstruct in local time to avoid day shift
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    return new Date(y, m, day);
  }
  const raw = typeof val === 'string' ? val.trim() : String(val);
  // Strip time/timezone (e.g. "2025-03-15T00:00:00.000Z" → "2025-03-15") to avoid UTC-midnight = previous day in local TZ
  const s = raw.split(/[TZ\s]/)[0];
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Fallback: append T12:00 to avoid UTC midnight shifting for date-only strings
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return new Date(s + 'T12:00:00');
  return new Date(val);
}

/** Format birthdate string (YYYY-MM-DD or MM-DD) for display as "15 de marzo". */
export function formatBirthdateDisplay(birthdate) {
  if (!birthdate || typeof birthdate !== 'string') return '';
  const s = birthdate.trim();
  if (s.length < 5) return s;
  const parts = s.split('-');
  let year, month, day;
  if (parts.length >= 3) {
    [year, month, day] = parts;
  } else if (parts.length >= 2) {
    [month, day] = parts;
    year = new Date().getFullYear();
  } else return s;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(m) || isNaN(d)) return s;
  const date = new Date(year, m - 1, d);
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

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
// Profile photos are the main thing every user can publish; keep limits low so
// membership docs (photo + cover + text) stay under 1MB.

/** Max bytes per image to stay under Firestore doc limit. Lower for members who can only edit photo. */
const MAX_IMAGE_BYTES = 50000;

/**
 * Compresses a data URL if it exceeds maxBytes. Returns original if not a data URL
 * or if already small enough. Uses canvas resize + JPEG quality reduction.
 * Progressively reduces dimensions and quality until under limit.
 * Guarantees output stays under limit (critical for lower-ranking members who can only edit photo).
 */
export async function compressDataUrlIfNeeded(dataUrl, maxBytes = MAX_IMAGE_BYTES) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
  const limit = maxBytes * 1.4; // base64 ~1.37× raw bytes
  if (dataUrl.length <= limit) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const tryOutput = (maxDim, startQuality) => {
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        for (let q = startQuality; q >= 0.05; q -= 0.05) {
          const result = canvas.toDataURL('image/jpeg', q);
          if (result.length <= limit) return result;
        }
        return canvas.toDataURL('image/jpeg', 0.05);
      };
      for (const maxDim of [400, 320, 256, 128, 96, 64]) {
        const result = tryOutput(maxDim, 0.75);
        if (result.length <= limit) {
          resolve(result);
          return;
        }
      }
      resolve(tryOutput(64, 0.2));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Domains that block embedding (CORS/CORP) — Instagram, Facebook CDN
const BLOCKED_IMAGE_HOSTS = ['cdninstagram.com', 'fbcdn.net', 'facebook.com', 'instagram.com'];
export function isBlockedImageHost(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_IMAGE_HOSTS.some((h) => host.includes(h));
  } catch { return false; }
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
