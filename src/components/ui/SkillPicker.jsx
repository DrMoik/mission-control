// ─── SkillPicker ──────────────────────────────────────────────────────────────
// Search-first multi-select for canonical skills (knowledgeAreas).
// Uses team taxonomy; no match → propose new skill.
//
// Props:
//   label         — field label
//   value         — string[] (knowledgeArea IDs)
//   onChange      — (ids: string[]) => void
//   knowledgeAreas — { id, name }[] from team config
//   onProposeSkill — (label: string) => Promise<void> | void
//   placeholder?  — input placeholder

import React, { useState, useRef, useEffect } from 'react';
import { t } from '../../strings.js';

const MAX_SUGGESTIONS = 10;

export default function SkillPicker({
  label,
  value = [],
  onChange,
  knowledgeAreas = [],
  onProposeSkill,
  placeholder = '',
}) {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);

  const selectedIds = new Set(Array.isArray(value) ? value : []);

  // Filter taxonomy: on focus/empty show first N; when typing filter by name/id
  const filteredSuggestions = React.useMemo(() => {
    const q = (input || '').trim().toLowerCase();
    const available = knowledgeAreas.filter((a) => a && a.id && a.name && !selectedIds.has(a.id));
    const matches = q
      ? available.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      : available;
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [knowledgeAreas, input, selectedIds]);

  const canPropose = (input || '').trim().length > 0 && filteredSuggestions.length === 0 && onProposeSkill;

  const addById = (id) => {
    if (selectedIds.has(id)) return;
    onChange([...value, id]);
    setInput('');
    setShowDropdown(false);
    setHighlightIndex(0);
  };

  const addFromProposal = () => {
    const label = input.trim();
    if (!label || !onProposeSkill) return;
    onProposeSkill(label);
    setInput('');
    setShowDropdown(false);
  };

  const remove = (id) => onChange(value.filter((x) => x !== id));

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown) {
        if (canPropose && highlightIndex === filteredSuggestions.length) {
          addFromProposal();
        } else if (filteredSuggestions[highlightIndex]) {
          addById(filteredSuggestions[highlightIndex].id);
        }
      }
      return;
    }
    if (e.key === 'Backspace' && !input && value.length > 0) remove(value[value.length - 1]);
    const totalOptions = filteredSuggestions.length + (canPropose ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, totalOptions - 1));
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
    const shouldShow = isFocused && ((input.length > 0 || filteredSuggestions.length > 0) && (filteredSuggestions.length > 0 || canPropose));
    setShowDropdown(!!shouldShow);
    setHighlightIndex(0);
  }, [isFocused, input, filteredSuggestions.length, canPropose]);

  useEffect(() => {
    const onDocClick = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const getAreaName = (id) => knowledgeAreas.find((a) => a.id === id)?.name || id;

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {label && <span className="text-xs text-slate-400">{label}</span>}
      <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-2 py-1.5 bg-slate-900 border border-slate-600 rounded focus-within:border-emerald-600 transition-colors">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-200 text-xs px-2 py-0.5 rounded-full border border-emerald-700/50"
          >
            {getAreaName(id)}
            <button type="button" onClick={() => remove(id)} className="text-emerald-400 hover:text-red-400 leading-none transition-colors">
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setShowDropdown(filteredSuggestions.length > 0 || canPropose);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none text-slate-200 placeholder:text-slate-600"
        />
      </div>
      {showDropdown && (filteredSuggestions.length > 0 || canPropose) && (
        <div className="absolute top-full left-0 right-0 mt-0.5 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
          {filteredSuggestions.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addById(a.id); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === highlightIndex ? 'bg-emerald-900/50 text-emerald-200' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              {a.name}
            </button>
          ))}
          {canPropose && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addFromProposal(); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors border-t border-slate-600 ${
                highlightIndex === filteredSuggestions.length ? 'bg-amber-900/50 text-amber-200' : 'text-amber-300/90 hover:bg-slate-700'
              }`}
            >
              {t('skill_propose_new') || 'Proponer nueva habilidad'}: {input.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
