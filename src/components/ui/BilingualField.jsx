// ─── BilingualField ───────────────────────────────────────────────────────────
// A form field that shows a single input for the current UI language.
// When interface is in English, only EN is shown; when in Spanish, only ES.
// Data is still stored as { en, es } — the other language keeps its value.
//
// Props
// ─────
//  label?        — optional section label
//  value         — { en: string, es: string } or plain string (auto-converted)
//  onChange      — called with { en, es } on every keystroke
//  multiline?    — render <textarea> instead of <input>
//  rows?         — textarea rows (default 3)
//  placeholder?  — applied to the visible input (string or { en, es })
//  maxLength?    — applied to the input
//  required?     — marks with required indicator
//  className?    — extra classes on the outer wrapper

import React, { useRef, useEffect } from 'react';
import { lang } from '../../strings.js';
import { toL } from '../../utils.js';

// Auto-grow textarea: height expands with content
function AutoGrowTextarea({ value, onChange, placeholder, maxLength, className, rows }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.max(ref.current.scrollHeight, rows * 24)}px`;
  }, [value, rows]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  );
}

// Auto-grow input: width expands with content (min 12ch)
function AutoGrowInput({ value, onChange, placeholder, maxLength, className }) {
  const len = (value || '').length;
  const w = Math.max(12, Math.min(len + 2, 72));
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
      size={w}
      style={{ minWidth: `${w}ch`, width: '100%' }}
    />
  );
}

export default function BilingualField({
  label, value, onChange, multiline = false, rows = 3,
  placeholder, maxLength, required, className = '',
}) {
  const val = toL(value);

  const ph = (l) => {
    if (!placeholder) return '';
    if (typeof placeholder === 'string') return placeholder;
    return placeholder[l] || '';
  };

  const handleChange = (text) => onChange({ ...val, [lang]: text });

  const fieldCls = 'w-full min-w-0 px-3 py-2 bg-slate-900 border border-emerald-600 rounded text-sm resize-none transition-colors';

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <span className="text-xs text-slate-400">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</span>
      )}
      {multiline ? (
        <AutoGrowTextarea
          value={val[lang]}
          onChange={handleChange}
          placeholder={ph(lang)}
          maxLength={maxLength}
          className={fieldCls}
          rows={rows}
        />
      ) : (
        <AutoGrowInput
          value={val[lang]}
          onChange={handleChange}
          placeholder={ph(lang)}
          maxLength={maxLength}
          className={fieldCls}
        />
      )}
    </div>
  );
}
