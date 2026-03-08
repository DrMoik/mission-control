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
import MyCommitmentsCard       from '../components/MyCommitmentsCard.jsx';
import { getL, toL, fillL, ensureString } from '../utils.js';
import { ROLE_LABELS } from '../constants.js';

// ── SVG histogram (vertical bars, dynamic bins, matches slate/emerald aesthetic)
function PointsHistogram({ distribution }) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);
  const w = 320;
  const h = 160;
  const pad = { top: 8, right: 8, bottom: 28, left: 28 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const n = distribution.length;
  const barGap = 2;
  const barW = n > 0 ? (chartW - barGap * (n - 1)) / n : 0;

  return (
    <div className="w-full max-w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={pad.left}
            y1={pad.top + chartH * (1 - frac)}
            x2={pad.left + chartW}
            y2={pad.top + chartH * (1 - frac)}
            stroke="rgb(51 65 85 / 0.4)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        ))}
        {/* Bars */}
        {distribution.map(({ label, count }, i) => {
          const barH = maxCount > 0 ? (count / maxCount) * chartH : 0;
          const x = pad.left + i * (barW + barGap);
          const y = pad.top + chartH - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, count > 0 ? 2 : 0)}
                rx={2}
                ry={2}
                fill="rgb(16 185 129 / 0.6)"
                className="transition-all"
              />
            </g>
          );
        })}
        {/* X-axis labels */}
        {distribution.map(({ label }, i) => {
          const x = pad.left + i * (barW + barGap) + barW / 2;
          return (
            <text
              key={i}
              x={x}
              y={h - 6}
              textAnchor="middle"
              fill="rgb(148 163 184)"
              style={{ fontSize: 10 }}
            >
              {label}
            </text>
          );
        })}
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const val = Math.round(maxCount * frac);
          return (
            <text
              key={frac}
              x={pad.left - 6}
              y={pad.top + chartH * (1 - frac) + 3}
              textAnchor="end"
              fill="rgb(100 116 139)"
              style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            >
              {val}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function OverviewView({ team, teamMemberships, teamMeritEvents, teamModules, teamCategories = [], teamTasks = [], teamWeeklyStatuses = [], currentMembership, canEdit, onSave, onNavigateTasks, onNavigateProfile, tsToDate }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(null);
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [statsViewMode, setStatsViewMode] = useState('global'); // 'global' | 'area' | 'status'
  const [statsSubFilter, setStatsSubFilter] = useState(''); // categoryId when area, role when status

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

  // Avg points by area (categoryId). Excludes unassigned (no category).
  const avgByArea = useMemo(() => {
    const active = teamMemberships.filter((m) => m.status === 'active');
    const byCat = {};
    active.forEach((m) => {
      const catId = m.categoryId || '_global';
      if (!byCat[catId]) byCat[catId] = { sum: 0, count: 0 };
      byCat[catId].sum += pointsByMember[m.id] || 0;
      byCat[catId].count += 1;
    });
    return Object.entries(byCat)
      .filter(([catId]) => catId !== '_global') // exclude unassigned
      .map(([catId, { sum, count }]) => ({
        categoryId: catId,
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

  // Filtered members for stats (global, by area, or by status/role)
  const filteredMembers = useMemo(() => {
    const active = teamMemberships.filter((m) => m.status === 'active');
    if (statsViewMode === 'global') return active;
    if (statsViewMode === 'area' && statsSubFilter)
      return active.filter((m) => m.categoryId === statsSubFilter);
    if (statsViewMode === 'status' && statsSubFilter)
      return active.filter((m) => m.role === statsSubFilter);
    return []; // area/status mode but no sub-filter selected
  }, [teamMemberships, statsViewMode, statsSubFilter]);

  // Standard deviation and distribution for the filtered group
  // Uses Freedman-Diaconis rule for dynamic bin width; falls back to Sturges when IQR=0
  const { stdDev, distribution, avgFiltered } = useMemo(() => {
    const values = filteredMembers.map((m) => pointsByMember[m.id] || 0).filter((v) => v >= 0);
    const n = values.length;
    const mean = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;
    const variance = n > 1
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    // Dynamic binning: Freedman-Diaconis or Sturges
    const sorted = [...values].sort((a, b) => a - b);
    const dataMin = sorted[0] ?? 0;
    const dataMax = sorted[n - 1] ?? 0;
    const dataRange = dataMax - dataMin;

    let numBins = 6;
    if (n >= 4) {
      const q1Idx = Math.floor(n * 0.25);
      const q3Idx = Math.floor(n * 0.75);
      const iqr = (sorted[q3Idx] ?? dataMax) - (sorted[q1Idx] ?? dataMin);
      const fdWidth = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : 0;
      if (fdWidth > 0 && dataRange > 0) {
        numBins = Math.max(4, Math.min(15, Math.ceil(dataRange / fdWidth)));
      } else {
        numBins = Math.max(4, Math.min(12, Math.ceil(Math.log2(n) + 1)));
      }
    }

    const binWidth = dataRange > 0 ? dataRange / numBins : 1;

    const dist = [];
    for (let i = 0; i < numBins; i++) {
      const min = dataMin + i * binWidth;
      const max = dataMin + (i + 1) * binWidth;
      const count = values.filter((v) => {
        if (binWidth <= 0) return i === 0;
        const idx = Math.min(numBins - 1, Math.max(0, Math.floor((v - dataMin) / binWidth)));
        return idx === i;
      }).length;
      const label = numBins === 1 || dataRange === 0
        ? String(Math.round(dataMin))
        : `${Math.round(min)}–${Math.round(max)}`;
      dist.push({ min, max, label, count });
    }

    return {
      stdDev: Math.round(stdDev * 10) / 10,
      distribution: dist,
      avgFiltered: n > 0 ? Math.round(mean) : 0,
    };
  }, [filteredMembers, pointsByMember]);

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
          <h2 className="text-2xl font-bold text-slate-100">{ensureString(team?.name, lang)}</h2>
          {tagline && <p className="text-slate-300 italic mt-1 text-lg">"{tagline}"</p>}
        </div>
        {canEdit && (
          <button onClick={startEdit}
            className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300 transition-colors">
            {t('edit_overview')}
          </button>
        )}
      </div>

      {/* My commitments (responsibility dashboard) */}
      {currentMembership && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <MyCommitmentsCard
              tasks={teamTasks}
              weeklyStatuses={teamWeeklyStatuses}
              currentMembership={currentMembership}
              tsToDate={tsToDate}
              onNavigateTasks={onNavigateTasks}
              onNavigateProfile={onNavigateProfile}
            />
          </div>
        </div>
      )}

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
          onClick={() => { setShowPointsDetail(false); setStatsViewMode('global'); setStatsSubFilter(''); }}
        >
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="font-bold text-lg text-slate-100">{t('avg_points_per_member')}</h3>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={statsViewMode}
                    onChange={(e) => {
                      setStatsViewMode(e.target.value);
                      setStatsSubFilter('');
                    }}
                    className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="global">{t('stats_view_global')}</option>
                    <option value="area">{t('stats_view_area')}</option>
                    <option value="status">{t('stats_view_status')}</option>
                  </select>
                  {statsViewMode === 'area' && (
                    <select
                      value={statsSubFilter}
                      onChange={(e) => setStatsSubFilter(e.target.value)}
                      className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="">{t('stats_select_area')}</option>
                      {avgByArea.map(({ categoryId, count }) => {
                        const cat = teamCategories.find((c) => c.id === categoryId);
                        return (
                          <option key={categoryId} value={categoryId}>
                            {ensureString(cat?.name, lang)} ({count})
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {statsViewMode === 'status' && (
                    <select
                      value={statsSubFilter}
                      onChange={(e) => setStatsSubFilter(e.target.value)}
                      className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="">{t('stats_select_status')}</option>
                      {avgByLevel.map(({ role, count }) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role] || role} ({count})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {filteredMembers.length > 0 ? (
                <>
                  <p className="text-2xl font-bold text-emerald-400">{avgFiltered} pts</p>
                  <div className="flex gap-4 mt-2 text-sm text-slate-400">
                    <span>{t('std_deviation')}: <span className="font-mono text-slate-300">{stdDev}</span></span>
                    <span className="text-slate-500">({filteredMembers.length})</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 py-2">
                  {statsViewMode === 'global' ? t('stats_no_members') : (statsViewMode === 'area' ? t('stats_select_area') : t('stats_select_status'))}
                </p>
              )}
            </div>
            {filteredMembers.length > 0 && (
              <div className="p-5">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('points_distribution')}</h4>
                <PointsHistogram distribution={distribution} />
              </div>
            )}
            <div className="p-5 border-t border-slate-700">
              <button
                type="button"
                onClick={() => { setShowPointsDetail(false); setStatsViewMode('global'); setStatsSubFilter(''); }}
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
