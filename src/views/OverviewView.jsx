// ─── OverviewView ─────────────────────────────────────────────────────────────
// Public landing page for each team.  Shows editable tagline, rich-text fields,
// and live KPI tiles.  Admins can edit; everyone else reads.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';

/**
 * @param {{
 *   team:              object,    – current team document
 *   teamMemberships:   object[],  – all memberships in this team
 *   teamMeritEvents:   object[],  – all merit events (for points total)
 *   teamModules:       object[],  – all academy modules (count)
 *   canEdit:           boolean,
 *   onSave:            function(overview) → Promise
 * }} props
 */
export default function OverviewView({ team, teamMemberships, teamMeritEvents, teamModules, canEdit, onSave }) {
  const { t } = React.useContext(LangContext);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(null);

  const ov = team?.overview || {};

  const startEdit = () => {
    setDraft({
      tagline:    ov.tagline    || '',
      about:      ov.about      || '',
      history:    ov.history    || '',
      objectives: ov.objectives || '',
      kpis:       ov.kpis ? [...ov.kpis.map((k) => ({ ...k }))] : [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(draft);
    setEditing(false);
  };

  const addKpi    = () => setDraft((d) => ({ ...d, kpis: [...d.kpis, { label: '', value: '' }] }));
  const updateKpi = (i, field, val) =>
    setDraft((d) => ({ ...d, kpis: d.kpis.map((k, idx) => idx === i ? { ...k, [field]: val } : k) }));
  const removeKpi = (i) => setDraft((d) => ({ ...d, kpis: d.kpis.filter((_, idx) => idx !== i) }));

  const activeMembers = teamMemberships.filter((m) => m.status === 'active').length;
  const totalPoints   = teamMeritEvents.reduce((s, e) => s + (e.points || 0), 0);

  // ── Edit form ──
  if (editing && draft) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('edit_overview')}</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
            <button onClick={handleSave} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('tagline')}</label>
          <input value={draft.tagline} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
            placeholder="e.g. Building tomorrow's engineers, today." />
        </div>

        {[['about', t('about')], ['history', t('history')], ['objectives', t('objectives')]].map(([field, label]) => (
          <div key={field}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <textarea rows={field === 'about' ? 4 : 3}
              value={draft[field]}
              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
              placeholder="…" />
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">{t('kpis')}</label>
            <button onClick={addKpi} className="text-xs text-emerald-400 underline">{t('add_kpi')}</button>
          </div>
          {draft.kpis.map((kpi, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={kpi.label} onChange={(e) => updateKpi(i, 'label', e.target.value)}
                placeholder={t('kpi_label')}
                className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
              <input value={kpi.value} onChange={(e) => updateKpi(i, 'value', e.target.value)}
                placeholder={t('kpi_value')}
                className="w-28 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
              <button onClick={() => removeKpi(i)} className="text-red-400 text-xs px-2 hover:text-red-300">✕</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── View mode ──
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{team?.name}</h2>
          {ov.tagline && <p className="text-slate-300 italic mt-1 text-lg">"{ov.tagline}"</p>}
        </div>
        {canEdit && (
          <button onClick={startEdit}
            className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300 transition-colors">
            {t('edit_overview')}
          </button>
        )}
      </div>

      {/* Live stats tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('total_members')}</div>
          <div className="text-2xl font-bold mt-1">{activeMembers}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('total_points_earned')}</div>
          <div className="text-2xl font-bold mt-1">{Math.max(0, totalPoints)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('nav_academy')}</div>
          <div className="text-2xl font-bold mt-1">{teamModules.length}</div>
        </div>
        {/* Custom KPIs */}
        {(ov.kpis || []).map((kpi, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide truncate">{kpi.label}</div>
            <div className="text-2xl font-bold mt-1">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Text sections */}
      {[
        [t('about'), ov.about],
        [t('history'), ov.history],
        [t('objectives'), ov.objectives],
      ].map(([label, text]) =>
        text ? (
          <div key={label}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>
        ) : null,
      )}

      {!ov.about && !ov.history && !ov.objectives && !ov.tagline && (
        <>
          {canEdit ? (
            <>
              <p className="text-slate-400 text-sm mb-4">{t('no_overview')}</p>
              <button onClick={startEdit}
                className="text-xs bg-emerald-500 text-black font-semibold px-4 py-2 rounded">
                {t('edit_overview')}
              </button>
            </>
          ) : (
            <p className="text-slate-500 text-sm">{t('no_overview')}</p>
          )}
        </>
      )}
    </div>
  );
}
