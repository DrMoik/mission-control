// ─── OverviewView ─────────────────────────────────────────────────────────────
// Public landing page for each team.  Shows editable tagline, rich-text fields,
// and live KPI tiles.
//
// All text fields are bilingual ({ en, es }).  The active UI language is shown
// in read-mode; both are editable in the form.  KPI labels are also bilingual;
// the value field stays monolingual (it's usually a number or short code).

import React, { useState } from 'react';
import LangContext             from '../i18n/LangContext.js';
import { BilingualField }      from '../components/ui/index.js';
import { getL, toL, fillL, ensureString } from '../utils.js';

export default function OverviewView({ team, teamMemberships, teamMeritEvents, teamModules, canEdit, onSave }) {
  const { t, lang } = React.useContext(LangContext);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(null);

  const ov = team?.overview || {};

  const startEdit = () => {
    setDraft({
      tagline:    toL(ov.tagline),
      about:      toL(ov.about),
      history:    toL(ov.history),
      objectives: toL(ov.objectives),
      kpis:       (ov.kpis || []).map((k) => ({ label: toL(k.label), value: k.value || '' })),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    // fillL ensures that if one language was left empty, it gets a copy of the other
    await onSave({
      tagline:    fillL(draft.tagline),
      about:      fillL(draft.about),
      history:    fillL(draft.history),
      objectives: fillL(draft.objectives),
      kpis:       draft.kpis.map((k) => ({ label: fillL(k.label), value: k.value })),
    });
    setEditing(false);
  };

  const addKpi    = () => setDraft((d) => ({ ...d, kpis: [...d.kpis, { label: { en: '', es: '' }, value: '' }] }));
  const updateKpiLabel = (i, v) =>
    setDraft((d) => ({ ...d, kpis: d.kpis.map((k, idx) => idx === i ? { ...k, label: v } : k) }));
  const updateKpiValue = (i, v) =>
    setDraft((d) => ({ ...d, kpis: d.kpis.map((k, idx) => idx === i ? { ...k, value: v } : k) }));
  const removeKpi = (i) => setDraft((d) => ({ ...d, kpis: d.kpis.filter((_, idx) => idx !== i) }));

  const activeMembers = teamMemberships.filter((m) => m.status === 'active').length;
  const totalPoints   = teamMeritEvents.reduce((s, e) => s + (e.points || 0), 0);

  // ── Edit form ──────────────────────────────────────────────────────────────
  if (editing && draft) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('edit_overview')}</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
            <button onClick={handleSave} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
          </div>
        </div>

        <BilingualField
          label={t('tagline')}
          value={draft.tagline}
          onChange={(v) => setDraft((d) => ({ ...d, tagline: v }))}
          placeholder={{ en: 'e.g. Building tomorrow\'s engineers, today.', es: 'p.ej. Formando a los ingenieros del mañana.' }}
        />

        {[
          ['about',      t('about'),      4],
          ['history',    t('history'),    3],
          ['objectives', t('objectives'), 3],
        ].map(([field, label, rows]) => (
          <BilingualField
            key={field}
            label={label}
            value={draft[field]}
            onChange={(v) => setDraft((d) => ({ ...d, [field]: v }))}
            multiline
            rows={rows}
          />
        ))}

        {/* KPIs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">{t('kpis')}</label>
            <button onClick={addKpi} className="text-xs text-emerald-400 underline">{t('add_kpi')}</button>
          </div>
          {draft.kpis.map((kpi, i) => (
            <div key={i} className="mb-3 bg-slate-800/60 rounded-lg p-3 space-y-2">
              <BilingualField
                label={t('kpi_label')}
                value={kpi.label}
                onChange={(v) => updateKpiLabel(i, v)}
                placeholder={{ en: 'e.g. Competition wins', es: 'p.ej. Victorias en competencia' }}
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 w-20 shrink-0">{t('kpi_value')}</label>
                <input value={kpi.value} onChange={(e) => updateKpiValue(i, e.target.value)}
                  placeholder="e.g. 3 / 42%"
                  className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                <button onClick={() => removeKpi(i)} className="text-red-400 text-xs px-2 hover:text-red-300 shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  const tagline    = getL(ov.tagline,    lang);
  const about      = getL(ov.about,      lang);
  const history    = getL(ov.history,    lang);
  const objectives = getL(ov.objectives, lang);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{ensureString(team?.name, lang)}</h2>
          {tagline && <p className="text-slate-300 italic mt-1 text-lg">"{tagline}"</p>}
        </div>
        {canEdit && (
          <button onClick={startEdit}
            className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300 transition-colors">
            {t('edit_overview')}
          </button>
        )}
      </div>

      {/* Live stats */}
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
        {(ov.kpis || []).map((kpi, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide truncate">{getL(kpi.label, lang)}</div>
            <div className="text-2xl font-bold mt-1">{ensureString(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* Text sections */}
      {[[t('about'), about], [t('history'), history], [t('objectives'), objectives]].map(([label, text]) =>
        text ? (
          <div key={label}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>
        ) : null,
      )}

      {!about && !history && !objectives && !tagline && (
        canEdit ? (
          <>
            <p className="text-slate-400 text-sm mb-4">{t('no_overview')}</p>
            <button onClick={startEdit} className="text-xs bg-emerald-500 text-black font-semibold px-4 py-2 rounded">
              {t('edit_overview')}
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-sm">{t('no_overview')}</p>
        )
      )}
    </div>
  );
}
