// ─── AdminView ────────────────────────────────────────────────────────────────
// Admin-only tab to edit team dropdown options: Majors/Careers, Semesters,
// Personality tags, Collab suggestions, Merit types/domains/tiers.

import React, { useState, useEffect } from 'react';
import LangContext from '../i18n/LangContext.js';
import {
  CAREER_OPTIONS, SEMESTER_OPTIONS, PERSONALITY_TAGS, COLLAB_TAG_SUGGESTIONS,
  MERIT_ACHIEVEMENT_TYPES, MERIT_DOMAINS, MERIT_TIERS,
} from '../constants.js';

const parseList = (s, allowEmpty = false) =>
  (s || '').split(/[,\n]+/).map((x) => x.trim()).filter((x) => allowEmpty || x.length > 0);

export default function AdminView({
  team,
  onSaveCareers,
  onSaveSemesters,
  onSavePersonalityTags,
  onSaveCollabSuggestions,
  onSaveMeritTags,
  onSaveMeritTiers,
  t,
}) {
  const { t: tCtx } = React.useContext(LangContext);
  const tFn = t || tCtx;
  const [saving, setSaving] = useState(null);

  if (!team) return null;

  const careerOptions = team.careerOptions?.length ? team.careerOptions : CAREER_OPTIONS;
  const semesterOptions = team.semesterOptions?.length ? team.semesterOptions : SEMESTER_OPTIONS;
  const personalityTags = team.personalityTags?.length ? team.personalityTags : PERSONALITY_TAGS;
  const collabSuggestions = team.collabTagSuggestions?.length ? team.collabTagSuggestions : COLLAB_TAG_SUGGESTIONS;
  const achievementTypes = team.achievementTypes?.length ? team.achievementTypes : MERIT_ACHIEVEMENT_TYPES;
  const domains = team.domains?.length ? team.domains : MERIT_DOMAINS;
  const meritTiers = team.meritTiers?.length ? team.meritTiers : MERIT_TIERS;

  const save = async (key, fn, value) => {
    setSaving(key);
    try {
      await fn(value);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-200">{tFn('admin_tab_title') || 'Admin — Dropdown options'}</h2>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-medium">
          {tFn('admin_only') || 'Admin only'}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {tFn('admin_tab_help') || 'Edit the options shown in dropdowns across the app. One per line or comma-separated. Click Save on each section to apply.'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('admin_careers_majors') || 'Careers / Majors'}</h3>
          <label className="text-[11px] font-semibold text-slate-400 block">{tFn('admin_careers_majors') || 'Careers / Majors'}</label>
          <p className="text-[10px] text-slate-500">{tFn('admin_empty_ok') || 'Include empty line for "not set" option.'}</p>
          <textarea
            key="careers"
            defaultValue={(careerOptions || []).join(', ')}
            id="admin-careers"
            rows={3}
            placeholder="Mechanical Engineering, Computer Science, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-careers');
              save('careers', onSaveCareers, parseList(el?.value || '', true));
            }}
            disabled={saving === 'careers'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'careers' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('admin_semesters') || 'Semesters'}</h3>
          <label className="text-[11px] font-semibold text-slate-400 block">{tFn('admin_semesters') || 'Semesters'}</label>
          <textarea
            key="semesters"
            defaultValue={(semesterOptions || []).join(', ')}
            id="admin-semesters"
            rows={3}
            placeholder="1st, 2nd, Graduate, Faculty, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-semesters');
              save('semesters', onSaveSemesters, parseList(el?.value || '', true));
            }}
            disabled={saving === 'semesters'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'semesters' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('admin_personality_tags') || 'Personality tags'}</h3>
          <textarea
            key="personality"
            defaultValue={(personalityTags || []).join(', ')}
            id="admin-personality"
            rows={2}
            placeholder="ptag_creative, ptag_analytical, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-personality');
              save('personality', onSavePersonalityTags, parseList(el?.value || ''));
            }}
            disabled={saving === 'personality'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'personality' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('admin_collab_suggestions') || 'Collaboration tag suggestions'}</h3>
          <textarea
            key="collab"
            defaultValue={(collabSuggestions || []).join(', ')}
            id="admin-collab"
            rows={3}
            placeholder="Python, CAD, OpenCV, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-collab');
              save('collab', onSaveCollabSuggestions, parseList(el?.value || ''));
            }}
            disabled={saving === 'collab'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'collab' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('merit_attr_types') || 'Merit achievement types'}</h3>
          <textarea
            key="types"
            defaultValue={(achievementTypes || []).join(', ')}
            id="admin-types"
            rows={2}
            placeholder="technical, leadership, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-types');
              const arr = parseList(el?.value || '');
              if (arr.length === 0) { alert(tFn('platform_config_min_one') || 'At least one value required.'); return; }
              save('types', () => onSaveMeritTags(arr, domains), arr);
            }}
            disabled={saving === 'types'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'types' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('merit_attr_domains') || 'Merit domains'}</h3>
          <textarea
            key="domains"
            defaultValue={(domains || []).join(', ')}
            id="admin-domains"
            rows={2}
            placeholder="software, hardware, ..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-domains');
              const arr = parseList(el?.value || '');
              if (arr.length === 0) { alert(tFn('platform_config_min_one') || 'At least one value required.'); return; }
              save('domains', () => onSaveMeritTags(achievementTypes, arr), arr);
            }}
            disabled={saving === 'domains'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'domains' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400">{tFn('admin_merit_tiers') || 'Merit tiers'}</h3>
          <textarea
            key="tiers"
            defaultValue={(meritTiers || []).join(', ')}
            id="admin-tiers"
            rows={1}
            placeholder="bronze, silver, gold"
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              const el = document.getElementById('admin-tiers');
              save('tiers', onSaveMeritTiers, parseList(el?.value || ''));
            }}
            disabled={saving === 'tiers'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
          >
            {saving === 'tiers' ? tFn('saving') || 'Saving…' : tFn('save')}
          </button>
        </section>
      </div>
    </div>
  );
}
