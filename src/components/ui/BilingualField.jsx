// ─── BilingualField ───────────────────────────────────────────────────────────
// A reusable form field that shows two side-by-side (or stacked on mobile)
// inputs: one for English, one for Spanish.
//
// Props
// ─────
//  label?        — optional section label above both fields
//  value         — { en: string, es: string } or plain string (auto-converted)
//  onChange      — called with { en, es } on every keystroke
//  multiline?    — render <textarea> instead of <input>
//  rows?         — textarea rows (default 3)
//  placeholder?  — applied to both inputs (can be a string or { en, es })
//  maxLength?    — applied to both inputs
//  required?     — marks EN and ES with the required indicator
//  className?    — extra classes on the outer wrapper
//
// The current UI language (from LangContext) is highlighted with a slightly
// brighter border so the user knows which one they're "working in".

import React, { useRef, useEffect } from 'react';
import LangContext from '../../i18n/LangContext.js';
import { toL }     from '../../utils.js';

const LANG_LABELS = { en: 'EN 🇺🇸', es: 'ES 🇲🇽' };

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

export default function BilingualField({
  label, value, onChange, multiline = false, rows = 3,
  placeholder, maxLength, required, className = '',
}) {
  const { lang } = React.useContext(LangContext);
  const val       = toL(value);

  const ph = (l) => {
    if (!placeholder) return '';
    if (typeof placeholder === 'string') return placeholder;
    return placeholder[l] || '';
  };

  const handleChange = (l, text) => onChange({ ...val, [l]: text });

  const fieldCls = (l) =>
    `w-full min-w-0 px-3 py-2 bg-slate-900 border rounded text-sm resize-none transition-colors ${
      lang === l ? 'border-emerald-600' : 'border-slate-600'
    }`;

  const renderInput = (l) =>
    multiline ? (
      <AutoGrowTextarea
        value={val[l]}
        onChange={(text) => handleChange(l, text)}
        placeholder={ph(l)}
        maxLength={maxLength}
        className={fieldCls(l)}
        rows={rows}
      />
    ) : (
      <input
        value={val[l]}
        onChange={(e) => handleChange(l, e.target.value)}
        placeholder={ph(l)}
        maxLength={maxLength}
        className={fieldCls(l)}
        size={Math.max(12, (val[l]?.length || 0) + 2)}
        style={{ width: '100%', minWidth: '8ch' }}
      />
    );

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <span className="text-xs text-slate-400">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</span>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {['en', 'es'].map((l) => (
          <div key={l}>
            <div className={`text-[10px] font-semibold mb-0.5 ${lang === l ? 'text-emerald-400' : 'text-slate-500'}`}>
              {LANG_LABELS[l]}
            </div>
            {renderInput(l)}
          </div>
        ))}
      </div>
    </div>
  );
}
