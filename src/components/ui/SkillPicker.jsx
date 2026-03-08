// ─── SkillPicker ──────────────────────────────────────────────────────────────
// Search-first multi-select for skills from skillDictionary.
// Filters by allowedTypes; no match → propose new skill.
//
// Props:
//   label         — field label
//   value         — string[] (skill IDs)
//   onChange      — (ids: string[]) => void
//   skills        — { id, label, type }[] from team skillDictionary
//   allowedTypes  — string[] e.g. ['technical','learning','support','collaboration']
//   onProposeSkill — (label: string, type: string) => void
//   placeholder?  — input placeholder

import React, { useState, useRef, useEffect } from 'react';
import { t } from '../../strings.js';

const MAX_SUGGESTIONS = 10;

export default function SkillPicker({
  label,
  value = [],
  onChange,
  skills = [],
  allowedTypes = ['technical', 'learning', 'support', 'collaboration'],
  onProposeSkill,
  placeholder = '',
}) {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [proposeType, setProposeType] = useState('technical');
  const containerRef = useRef(null);

  const selectedIds = new Set(Array.isArray(value) ? value : []);
  const allowed = new Set(allowedTypes || []);

  const filteredSkills = React.useMemo(() => {
    const available = skills.filter(
      (s) => s && s.id && s.label && allowed.has(s.type) && !selectedIds.has(s.id),
    );
    const q = (input || '').trim().toLowerCase();
    const matches = q
      ? available.filter(
          (s) =>
            (s.label || '').toLowerCase().includes(q) || (s.id || '').toLowerCase().includes(q),
        )
      : available;
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [skills, input, value, allowedTypes]);

  const canPropose = (input || '').trim().length > 0 && filteredSkills.length === 0 && onProposeSkill;

  const addById = (id) => {
    if (selectedIds.has(id)) return;
    onChange([...value, id]);
    setInput('');
    setShowDropdown(false);
    setHighlightIndex(0);
  };

  const addFromProposal = () => {
    const labelText = input.trim();
    if (!labelText || !onProposeSkill) return;
    onProposeSkill(labelText, proposeType);
    setInput('');
    setShowDropdown(false);
  };

  const remove = (id) => onChange(value.filter((x) => x !== id));

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown) {
        if (canPropose && highlightIndex === filteredSkills.length) {
          addFromProposal();
        } else if (filteredSkills[highlightIndex]) {
          addById(filteredSkills[highlightIndex].id);
        }
      }
      return;
    }
    if (e.key === 'Backspace' && !input && value.length > 0) remove(value[value.length - 1]);
    const totalOptions = filteredSkills.length + (canPropose ? 1 : 0);
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
    const shouldShow =
      isFocused &&
      ((input.length > 0 || filteredSkills.length > 0) && (filteredSkills.length > 0 || canPropose));
    setShowDropdown(!!shouldShow);
    setHighlightIndex(0);
  }, [isFocused, input, filteredSkills.length, canPropose]);

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

  const getSkillLabel = (id) => skills.find((s) => s.id === id)?.label || id;

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {label && <span className="text-xs text-slate-400">{label}</span>}
      <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-2 py-1.5 bg-slate-900 border border-slate-600 rounded focus-within:border-emerald-600 transition-colors">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-200 text-xs px-2 py-0.5 rounded-full border border-emerald-700/50"
          >
            {getSkillLabel(id)}
            <button
              type="button"
              onClick={() => remove(id)}
              className="text-emerald-400 hover:text-red-400 leading-none transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setShowDropdown(filteredSkills.length > 0 || canPropose);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none text-slate-200 placeholder:text-slate-600"
        />
      </div>
      {showDropdown && (filteredSkills.length > 0 || canPropose) && (
        <div className="absolute top-full left-0 right-0 mt-0.5 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
          {filteredSkills.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addById(s.id);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex justify-between items-center ${
                i === highlightIndex ? 'bg-emerald-900/50 text-emerald-200' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{s.label}</span>
              <span className="text-[10px] text-slate-500">{s.type}</span>
            </button>
          ))}
          {canPropose && (
            <div className="border-t border-slate-600">
              <div className="flex gap-1 px-3 py-1">
                <select
                  value={proposeType}
                  onChange={(e) => setProposeType(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[10px] bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300"
                >
                  <option value="technical">{t('skill_type_technical') || 'Técnico'}</option>
                  <option value="learning">{t('skill_type_learning') || 'Aprendizaje'}</option>
                  <option value="support">{t('skill_type_support') || 'Apoyo'}</option>
                  <option value="collaboration">{t('skill_type_collaboration') || 'Colaboración'}</option>
                </select>
              </div>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addFromProposal();
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  highlightIndex === filteredSkills.length
                    ? 'bg-amber-900/50 text-amber-200'
                    : 'text-amber-300/90 hover:bg-slate-700'
                }`}
              >
                {t('skill_propose_new') || 'Proponer nueva habilidad'}: {input.trim()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
