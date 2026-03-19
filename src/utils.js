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

// ── Week (Sunday–Saturday) helpers ────────────────────────────────────────
// All in local time so week boundaries don't shift with timezone.
// Weeks begin on Sunday (first day).

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

/**
 * Extract human-readable label from a domain string.
 * Supports "id: label" format (e.g. "physical: Componente físico" → "Componente físico").
 * Plain strings are returned as-is.
 */
export function domainToLabel(s) {
  if (!s || typeof s !== 'string') return '';
  const idx = s.indexOf(': ');
  return idx >= 0 ? s.slice(idx + 2).trim() : s;
}

/** Format a Date as YYYY-MM-DD in local time (no UTC shift). */
export function dateToLocalYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the Sunday of the week for the given date (or today) as YYYY-MM-DD in local time. Week = Sunday–Saturday. */
export function getSundayOfWeekLocal(date = new Date()) {
  const d = new Date(date.getTime());
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  d.setDate(d.getDate() - day);
  return dateToLocalYYYYMMDD(d);
}

/**
 * Normalize a stored weekOf (YYYY-MM-DD, any day of week) to the Sunday of that week in local time.
 * Use this when matching weekly statuses so entries saved as e.g. "2026-03-05" (Wednesday) match the
 * current week Sunday "2026-03-02". Parses with local date parts to avoid UTC/Timezone quirks.
 */
export function normalizeWeekOfToSunday(weekOfStr) {
  if (!weekOfStr || typeof weekOfStr !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(weekOfStr.trim());
  if (!match) return '';
  const [, y, m, day] = match;
  const month = parseInt(m, 10) - 1;
  const dateNum = parseInt(day, 10);
  if (month < 0 || month > 11 || dateNum < 1 || dateNum > 31) return '';
  const d = new Date(Number(y), month, dateNum);
  return getSundayOfWeekLocal(d);
}

/** @deprecated Use getSundayOfWeekLocal. Alias for backward compatibility. */
export function getMondayOfWeekLocal(date = new Date()) {
  return getSundayOfWeekLocal(date);
}

/** @deprecated Use normalizeWeekOfToSunday. Alias for backward compatibility. */
export function normalizeWeekOfToMonday(weekOfStr) {
  return normalizeWeekOfToSunday(weekOfStr);
}

/** Returns true if weekOf (YYYY-MM-DD) falls in current or previous week (Sunday–Saturday). */
export function isWeekEligibleForPoints(weekOf) {
  const sunday = normalizeWeekOfToSunday(weekOf);
  if (!sunday) return false;
  const thisSunday = getSundayOfWeekLocal();
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const lastSunday = getSundayOfWeekLocal(d);
  return sunday === thisSunday || sunday === lastSunday;
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

/** Max bytes per image to stay under Firestore 1MB doc limit. Same for all members. */
const MAX_IMAGE_BYTES = 120000;

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
      for (const maxDim of [400, 320, 256, 128, 96, 64, 48, 32]) {
        const result = tryOutput(maxDim, 0.75);
        if (result.length <= limit) {
          resolve(result);
          return;
        }
      }
      resolve(tryOutput(32, 0.1));
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

// Domains where CORS fails but image loads without it — load without crossOrigin so it displays;
// Apply will fall back to original URL (canvas tainted).
const NO_CORS_IMAGE_HOSTS = ['redd.it', 'reddit.com', 'i.redd.it', 'external-preview.redd.it'];
export function isNoCorsImageHost(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return NO_CORS_IMAGE_HOSTS.some((h) => host.includes(h));
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

export function getGoogleDriveFileId(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const directMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  if (directMatch) return directMatch[1];
  const openMatch = trimmed.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];
  const ucMatch = trimmed.match(/\/uc\?.*?[?&]id=([^&]+)/);
  if (ucMatch) return ucMatch[1];
  return '';
}

export function toGoogleDrivePreviewUrl(url) {
  if (!url) return '';
  if (url.includes('/preview')) return url;
  const fileId = getGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
}

export function toGoogleDriveOpenUrl(url) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const fileId = getGoogleDriveFileId(url);
    return fileId ? `https://drive.google.com/file/d/${fileId}/view` : url;
  }
  return url;
}

export function toGoogleDriveDownloadUrl(url) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const fileId = getGoogleDriveFileId(url);
    return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
  }
  return url;
}

// ── Profile completion (for responsibility dashboard) ──────────────────────────

const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNonEmptyBilingual = (v) => {
  if (!v) return false;
  const es = (typeof v === 'string' ? v : (v.es || '')).trim();
  const en = (typeof v === 'string' ? v : (v.en || '')).trim();
  return es.length > 0 || en.length > 0;
};
const hasTagList = (arr) => Array.isArray(arr) && arr.some((t) => ensureString(t).trim().length > 0);
const hasCulture = (m) => {
  const hasListen = Array.isArray(m.whatIListenTo) && m.whatIListenTo.some((it) =>
    (typeof it === 'string' ? it : it?.title || '').trim().length > 0);
  const hasBook = hasTagList(m.bookThatMarkedMe);
  const hasIdea = hasTagList(m.ideaThatMotivatesMe);
  const hasQuote = hasTagList(m.quoteThatMovesMe);
  return hasListen || hasBook || hasIdea || hasQuote || isNonEmptyStr(m.songOnRepeatTitle);
};

/** Returns { percentage, completed, total, missing } for profile completion indicator. */
export function computeProfileCompletion(membership) {
  if (!membership) return { percentage: 0, completed: 0, total: 17, missing: [] };
  const m = membership;
  const checks = [
    ['displayName', isNonEmptyStr(m.displayName), 'displayName'],
    ['email', isNonEmptyStr(m.email), 'email'],
    ['bio', isNonEmptyBilingual(m.bio), 'bio'],
    ['hobbies', isNonEmptyBilingual(m.hobbies, getL), 'hobbies'],
    ['career', isNonEmptyStr(m.career), 'career'],
    ['semester', isNonEmptyStr(m.semester), 'semester'],
    ['university', isNonEmptyStr(m.university), 'university'],
    ['currentObjective', isNonEmptyBilingual(m.currentObjective), 'currentObjective'],
    ['currentChallenge', isNonEmptyBilingual(m.currentChallenge), 'currentChallenge'],
    ['collab', ((Array.isArray(m.helpNeedsAreas) && m.helpNeedsAreas.length > 0) || hasTagList(m.lookingForHelpIn)) &&
      ((Array.isArray(m.helpOfferAreas) && m.helpOfferAreas.length > 0) || hasTagList(m.iCanHelpWith)) &&
      ((Array.isArray(m.learnAreas) && m.learnAreas.length > 0) || hasTagList(m.skillsToLearnThisSemester)) &&
      ((Array.isArray(m.teachAreas) && m.teachAreas.length > 0) || hasTagList(m.skillsICanTeach)), 'collab'],
    ['funFact', isNonEmptyBilingual(m.funFact), 'funFact'],
    ['personalityTag', isNonEmptyStr(m.personalityTag), 'personalityTag'],
    ['birthdate', isNonEmptyStr(m.birthdate) && m.birthdate.trim().length >= 5, 'birthdate'],
    ['culture', hasCulture(m), 'culture'],
  ];
  const completed = checks.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([,, key]) => key);
  const total = checks.length;
  return { percentage: total > 0 ? Math.round((completed / total) * 100) : 0, completed, total, missing };
}

/** Spanish labels for profile completion fields (used in missing-fields message). */
const PROFILE_FIELD_LABELS = {
  displayName: 'nombre',
  email: 'correo electrónico',
  bio: 'bio',
  hobbies: 'pasatiempos',
  career: 'carrera',
  semester: 'semestre',
  university: 'universidad',
  currentObjective: 'objetivo',
  currentChallenge: 'reto',
  collab: 'etiquetas de colaboración (4)',
  funFact: 'dato curioso',
  personalityTag: 'etiqueta de personalidad',
  birthdate: 'fecha de nacimiento',
  culture: 'cultura (libro/idea/cita/música)',
};

/**
 * Returns an array of Spanish labels for profile fields that are missing/invalid.
 * Mirrors the validation logic used for the "Perfil completo" merit in App.jsx.
 * @param {Object} payload - Profile payload (merged updates + membership)
 * @returns {string[]} Spanish labels for missing fields
 */
export function getProfileMissingFieldsLabels(payload) {
  if (!payload) return [];
  const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
  const isNonEmptyBilingual = (v) => {
    const es = ensureString(getL(v, 'es')).trim();
    const en = ensureString(getL(v, 'en')).trim();
    return es.length > 0 || en.length > 0;
  };
  const hasNonEmptyTagList = (arr) =>
    Array.isArray(arr) && arr.some((t) => ensureString(t).trim().length > 0);
  const hasAreas = (arr) => Array.isArray(arr) && arr.length > 0;
  const hasCulture = (() => {
    const hasListen = Array.isArray(payload.whatIListenTo) && payload.whatIListenTo.some((it) => {
      if (typeof it === 'string') return it.trim().length > 0;
      return (it?.title || '').trim().length > 0;
    });
    const hasBook = Array.isArray(payload.bookThatMarkedMe) && payload.bookThatMarkedMe.some((t) => ensureString(t).trim().length > 0);
    const hasIdea = Array.isArray(payload.ideaThatMotivatesMe) && payload.ideaThatMotivatesMe.some((t) => ensureString(t).trim().length > 0);
    const hasQuote = Array.isArray(payload.quoteThatMovesMe) && payload.quoteThatMovesMe.some((t) => ensureString(t).trim().length > 0);
    const hasLegacySong = isNonEmptyString(payload.songOnRepeatTitle);
    return hasListen || hasBook || hasIdea || hasQuote || hasLegacySong;
  })();

  const hasBirthdate = isNonEmptyString(payload.birthdate) && payload.birthdate.trim().length >= 5;
  const hasCollab =
    (hasAreas(payload.helpNeedsAreas) || hasNonEmptyTagList(payload.lookingForHelpIn)) &&
    (hasAreas(payload.helpOfferAreas) || hasNonEmptyTagList(payload.iCanHelpWith)) &&
    (hasAreas(payload.learnAreas) || hasNonEmptyTagList(payload.skillsToLearnThisSemester)) &&
    (hasAreas(payload.teachAreas) || hasNonEmptyTagList(payload.skillsICanTeach));

  const checks = [
    ['displayName', isNonEmptyString(payload.displayName)],
    ['email', isNonEmptyString(payload.email)],
    ['bio', isNonEmptyBilingual(payload.bio)],
    ['hobbies', isNonEmptyBilingual(payload.hobbies)],
    ['career', isNonEmptyString(payload.career)],
    ['semester', isNonEmptyString(payload.semester)],
    ['university', isNonEmptyString(payload.university)],
    ['currentObjective', isNonEmptyBilingual(payload.currentObjective)],
    ['currentChallenge', isNonEmptyBilingual(payload.currentChallenge)],
    ['collab', hasCollab],
    ['funFact', isNonEmptyBilingual(payload.funFact)],
    ['personalityTag', isNonEmptyString(payload.personalityTag)],
    ['birthdate', hasBirthdate],
    ['culture', hasCulture],
  ];
  return checks.filter(([, ok]) => !ok).map(([key]) => PROFILE_FIELD_LABELS[key] || key);
}

/**
 * Joins an array of Spanish labels with ", " and " y " before the last item.
 * @example formatMissingFieldsList(['bio', 'objetivo']) → "bio y objetivo"
 * @example formatMissingFieldsList(['bio', 'objetivo', 'fecha de nacimiento']) → "bio, objetivo y fecha de nacimiento"
 */
export function formatMissingFieldsList(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1);
  return `${rest.join(', ')} y ${last}`;
}
