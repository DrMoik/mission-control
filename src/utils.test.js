// ─── utils.js tests ───────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  rankOf,
  atLeast,
  parseCalendarDate,
  formatBirthdateDisplay,
  dateToLocalYYYYMMDD,
  getMondayOfWeekLocal,
  normalizeWeekOfToMonday,
  getL,
  toL,
  fillL,
  ensureString,
  toEmbedUrl,
} from './utils.js';

describe('rankOf', () => {
  it('returns rank for valid roles', () => {
    expect(rankOf('aspirant')).toBeGreaterThanOrEqual(0);
    expect(rankOf('teamAdmin')).toBeGreaterThan(rankOf('aspirant'));
  });
  it('returns -1 for unknown role', () => {
    expect(rankOf('unknown')).toBe(-1);
  });
});

describe('atLeast', () => {
  it('returns true when role meets minimum', () => {
    expect(atLeast('senior', 'rookie')).toBe(true);
    expect(atLeast('leader', 'leader')).toBe(true);
  });
  it('returns false when role is below minimum', () => {
    expect(atLeast('rookie', 'leader')).toBe(false);
  });
});

describe('parseCalendarDate', () => {
  it('parses YYYY-MM-DD string in local time', () => {
    const d = parseCalendarDate('2025-03-15');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });
  it('strips timezone from ISO string', () => {
    const d = parseCalendarDate('2025-03-15T00:00:00.000Z');
    expect(d.getDate()).toBe(15);
  });
});

describe('formatBirthdateDisplay', () => {
  it('formats YYYY-MM-DD', () => {
    const s = formatBirthdateDisplay('2025-03-15');
    expect(s).toMatch(/15/);
    expect(s).toMatch(/marzo|March/);
  });
  it('returns empty for invalid', () => {
    expect(formatBirthdateDisplay('')).toBe('');
    expect(formatBirthdateDisplay(null)).toBe('');
  });
});

describe('getMondayOfWeekLocal', () => {
  it('returns YYYY-MM-DD format', () => {
    const m = getMondayOfWeekLocal(new Date('2025-03-15'));
    expect(m).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('normalizeWeekOfToMonday', () => {
  it('normalizes week string to Monday', () => {
    const m = normalizeWeekOfToMonday('2025-03-15');
    expect(m).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('returns empty for invalid', () => {
    expect(normalizeWeekOfToMonday('')).toBe('');
    expect(normalizeWeekOfToMonday('invalid')).toBe('');
  });
});

describe('getL', () => {
  it('returns string for plain string', () => {
    expect(getL('hello')).toBe('hello');
  });
  it('returns lang value for bilingual object', () => {
    expect(getL({ en: 'Hi', es: 'Hola' }, 'es')).toBe('Hola');
    expect(getL({ en: 'Hi', es: '' }, 'es')).toBe('Hi');
  });
});

describe('toL', () => {
  it('converts string to bilingual', () => {
    expect(toL('x')).toEqual({ en: 'x', es: 'x' });
  });
});

describe('fillL', () => {
  it('fills empty slot from other', () => {
    expect(fillL({ en: 'Hi', es: '' })).toEqual({ en: 'Hi', es: 'Hi' });
  });
});

describe('toEmbedUrl', () => {
  it('converts YouTube watch URL to embed', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123')).toContain('/embed/abc123');
  });
  it('returns empty for empty', () => {
    expect(toEmbedUrl('')).toBe('');
  });
});
