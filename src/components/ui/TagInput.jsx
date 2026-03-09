// ─── TagInput ─────────────────────────────────────────────────────────────────
// Chip-style tag editor with autocomplete dropdown to avoid duplicate entries.
//
// Props
// ─────
//  label?       — optional label above the tag area
//  value        — string[]  (or array of {en,es} from Firestore — normalized for display)
//  onChange     — called with the new string[]
//  placeholder? — ghost text in the text input
//  maxTags?     — maximum number of tags (default: unlimited)
//  suggestions? — string[]  existing tags from team (dropdown to avoid typos/duplicates)
//
// UX:  type to see dropdown; click or Enter to add from suggestion; Enter/comma adds custom tag.

import React, { useState, useRef, useEffect } from 'react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';

export default function TagInput({ label, value = [], onChange, placeholder = 'Add tag…', maxTags, suggestions = [] }) {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);

  const toStr = (t) => ensureString(t, lang);
  const sameTag = (a, b) => toStr(a).toLowerCase() === toStr(b).toLowerCase();

  // Filter suggestions: match input, exclude already selected
  const filteredSuggestions = React.useMemo(() => {
    const q = input.trim().toLowerCase();
    const existing = value.map((t) => toStr(t).toLowerCase());
    return suggestions
      .map((s) => (typeof s === 'string' ? s : toStr(s)))
      .filter((s) => s && !existing.includes(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 12);
  }, [suggestions, input, value, lang]);

  const addFromInput = () => {
    const tag = input.trim().replace(/,/g, '');
    if (!tag) return;
    if (value.some((t) => sameTag(t, tag))) { setInput(''); setShowDropdown(false); return; }
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, tag]);
    setInput('');
    setShowDropdown(false);
  };

  const addFromSuggestion = (suggestion) => {
    if (value.some((t) => sameTag(t, suggestion))) return;
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, suggestion]);
    setInput('');
    setShowDropdown(false);
    setHighlightIndex(0);
  };

  const remove = (tag) => onChange(value.filter((t) => !sameTag(t, tag)));

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (showDropdown && filteredSuggestions.length > 0) {
        addFromSuggestion(filteredSuggestions[highlightIndex]);
      } else {
        addFromInput();
      }
      return;
    }
    if (e.key === 'Backspace' && !input && value.length > 0) remove(value[value.length - 1]);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIndex(0);
    }
  };

  useEffect(() => {
    setShowDropdown(input.length > 0 && filteredSuggestions.length > 0);
    setHighlightIndex(0);
  }, [input, filteredSuggestions.length]);

  // Click outside to close dropdown
  useEffect(() => {
    const onDocClick = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {label && <span className="text-xs text-slate-400">{label}</span>}
      <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-2 py-1.5 bg-slate-900 border border-slate-600 rounded focus-within:border-emerald-600 transition-colors">
        {value.map((tag, i) => {
          const str = toStr(tag);
          const key = str || `tag-${i}`;
          return (
            <span key={key}
              className="inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-200 text-xs px-2 py-0.5 rounded-full border border-emerald-700/50">
              {str}
              <button type="button" onClick={() => remove(tag)}
                className="text-emerald-400 hover:text-red-400 leading-none transition-colors">×</button>
            </span>
          );
        })}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => input.length > 0 && filteredSuggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKey}
          onBlur={() => setTimeout(() => addFromInput(), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none text-slate-200 placeholder:text-slate-600"
        />
      </div>
      {showDropdown && filteredSuggestions.length > 0 && (
        <div className="dropdown-in absolute top-full left-0 right-0 mt-0.5 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-40 overflow-y-auto py-1">
          {filteredSuggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addFromSuggestion(s); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === highlightIndex ? 'bg-emerald-900/50 text-emerald-200' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-600">{suggestions.length > 0 ? t('tag_input_hint_suggestions') : t('tag_input_hint')}</p>
    </div>
  );
}
