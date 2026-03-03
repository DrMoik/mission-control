// ─── TagInput ─────────────────────────────────────────────────────────────────
// Chip-style tag editor.
//
// Props
// ─────
//  label?       — optional label above the tag area
//  value        — string[]  (the current list of tags)
//  onChange     — called with the new string[]
//  placeholder? — ghost text in the text input
//  maxTags?     — maximum number of tags (default: unlimited)
//
// UX:  press Enter or comma to add a tag; click ✕ on a chip to remove it.

import React, { useState } from 'react';

export default function TagInput({ label, value = [], onChange, placeholder = 'Add tag…', maxTags }) {
  const [input, setInput] = useState('');

  const add = () => {
    const tag = input.trim().toLowerCase().replace(/,/g, '');
    if (!tag) return;
    if (value.includes(tag)) { setInput(''); return; }
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, tag]);
    setInput('');
  };

  const remove = (tag) => onChange(value.filter((t) => t !== tag));

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && value.length > 0) remove(value[value.length - 1]);
  };

  return (
    <div className="space-y-1">
      {label && <span className="text-xs text-slate-400">{label}</span>}
      <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-2 py-1.5 bg-slate-900 border border-slate-600 rounded focus-within:border-emerald-600 transition-colors">
        {value.map((tag) => (
          <span key={tag}
            className="inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-200 text-xs px-2 py-0.5 rounded-full border border-emerald-700/50">
            {tag}
            <button type="button" onClick={() => remove(tag)}
              className="text-emerald-400 hover:text-red-400 leading-none transition-colors">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none text-slate-200 placeholder:text-slate-600"
        />
      </div>
      <p className="text-[10px] text-slate-600">Enter / comma to add · Backspace to remove last</p>
    </div>
  );
}
