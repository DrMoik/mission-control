// ─── OverviewView ─────────────────────────────────────────────────────────────
// Public landing page for each team.  Shows editable tagline, rich-text fields,
// and live KPI tiles.
//
// All text fields are bilingual ({ en, es }).  The active UI language is shown
// in read-mode; both are editable in the form.  KPI labels are also bilingual;
// the value field stays monolingual (it's usually a number or short code).

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { t, lang } from '../strings.js';
import { BilingualField }      from '../components/ui/index.js';
import { getL, toL, fillL, ensureString } from '../utils.js';
import { ROLE_LABELS } from '../constants.js';

export default function OverviewView({ team, teamMemberships, teamMeritEvents, teamModules, teamCategories = [], canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(null);
  const [showPointsDetail, setShowPointsDetail] = useState(false);

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
  const avgPointsPerMember = activeMembers > 0 ? Math.round(totalPoints / activeMembers) : 0;

  // Points per member (for breakdowns)
  const pointsByMember = useMemo(() => {
    const map = {};
    teamMeritEvents.forEach((e) => {
      if (e.type === 'award') map[e.membershipId] = (map[e.membershipId] || 0) + (e.points || 0);
    });
    return map;
  }, [teamMeritEvents]);

  // Avg points by area (categoryId)
  const avgByArea = useMemo(() => {
    const active = teamMemberships.filter((m) => m.status === 'active');
    const byCat = {};
    active.forEach((m) => {
      const catId = m.categoryId || '_global';
      if (!byCat[catId]) byCat[catId] = { sum: 0, count: 0 };
      byCat[catId].sum += pointsByMember[m.id] || 0;
      byCat[catId].count += 1;
    });
    return Object.entries(byCat).map(([catId, { sum, count }]) => ({
      categoryId: catId === '_global' ? null : catId,
      avg: count > 0 ? Math.round(sum / count) : 0,
      count,
    }));
  }, [teamMemberships, pointsByMember]);

  // Avg points by level (rookie, junior, senior, leader — NO faculty)
  const avgByLevel = useMemo(() => {
    const levels = ['rookie', 'junior', 'senior', 'leader'];
    const active = teamMemberships.filter((m) => m.status === 'active');
    const byRole = {};
    levels.forEach((r) => { byRole[r] = { sum: 0, count: 0 }; });
    active.forEach((m) => {
      const role = levels.includes(m.role) ? m.role : null;
      if (role) {
        byRole[role].sum += pointsByMember[m.id] || 0;
        byRole[role].count += 1;
      }
    });
    return levels.map((role) => ({
      role,
      avg: byRole[role].count > 0 ? Math.round(byRole[role].sum / byRole[role].count) : 0,
      count: byRole[role].count,
    }));
  }, [teamMemberships, pointsByMember]);

  // Standard deviation and distribution (points per active member)
  const { stdDev, distribution } = useMemo(() => {
    const active = teamMemberships.filter((m) => m.status === 'active');
    const values = active.map((m) => pointsByMember[m.id] || 0);
    const n = values.length;
    const mean = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;
    const variance = n > 1
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    // Distribution buckets: 0, 1-50, 51-100, 101-200, 201-500, 501+
    const buckets = [
      { label: '0', min: 0, max: 0 },
      { label: '1–50', min: 1, max: 50 },
      { label: '51–100', min: 51, max: 100 },
      { label: '101–200', min: 101, max: 200 },
      { label: '201–500', min: 201, max: 500 },
      { label: '501+', min: 501, max: Infinity },
    ];
    const dist = buckets.map((b) => ({
      ...b,
      count: values.filter((v) => v >= b.min && v <= b.max).length,
    }));

    return { stdDev: Math.round(stdDev * 10) / 10, distribution: dist };
  }, [teamMemberships, pointsByMember]);

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
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-sm hover:border-slate-600/50 transition-colors">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('total_members')}</div>
          <div className="text-2xl font-bold mt-1 text-slate-100">{activeMembers}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowPointsDetail(true)}
          className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-sm hover:border-slate-600/50 hover:border-emerald-600/50 transition-colors text-left w-full cursor-pointer group"
        >
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('avg_points_per_member')}</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{avgPointsPerMember}</div>
          <div className="text-[10px] text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{t('click_for_details')}</div>
        </button>
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-sm hover:border-slate-600/50 transition-colors">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{t('nav_academy')}</div>
          <div className="text-2xl font-bold mt-1 text-slate-100">{teamModules.length}</div>
        </div>
        {(ov.kpis || []).map((kpi, i) => (
          <div key={i} className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-sm hover:border-slate-600/50 transition-colors">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide truncate">{getL(kpi.label, lang)}</div>
            <div className="text-2xl font-bold mt-1 text-slate-100">{ensureString(kpi.value)}</div>
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

      {/* Points detail modal */}
      {showPointsDetail && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowPointsDetail(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700">
              <h3 className="font-bold text-lg">{t('avg_points_per_member')}</h3>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{avgPointsPerMember} pts</p>
              <div className="flex gap-4 mt-2 text-sm text-slate-400">
                <span>{t('std_deviation')}: <span className="font-mono text-slate-300">{stdDev}</span></span>
              </div>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('points_distribution')}</h4>
                <div className="space-y-1.5 mb-4">
                  {distribution.map(({ label, count }) => {
                    const maxCount = Math.max(...distribution.map((d) => d.count), 1);
                    const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-14 shrink-0">{label} pts</span>
                        <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-emerald-600/60 rounded transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-300 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('avg_points_by_area')}</h4>
                <div className="space-y-2">
                  {avgByArea.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('no_categories')}</p>
                  ) : (
                    avgByArea.map(({ categoryId, avg, count }) => {
                      const cat = categoryId ? teamCategories.find((c) => c.id === categoryId) : null;
                      const name = categoryId ? ensureString(cat?.name, lang) : (t('unassigned') || 'Sin área');
                      return (
                        <div key={categoryId || '_'} className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
                          <span className="text-sm text-slate-200">{name}</span>
                          <span className="text-sm font-mono text-emerald-400">{avg} pts <span className="text-slate-500 font-normal">({count})</span></span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('avg_points_by_level')}</h4>
                <div className="space-y-2">
                  {avgByLevel.map(({ role, avg, count }) => (
                    <div key={role} className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
                      <span className="text-sm text-slate-200">{ROLE_LABELS[role] || role}</span>
                      <span className="text-sm font-mono text-emerald-400">{avg} pts <span className="text-slate-500 font-normal">({count})</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowPointsDetail(false)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                {t('merit_detail_close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
