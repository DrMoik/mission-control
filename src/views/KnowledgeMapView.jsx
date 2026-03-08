// ─── KnowledgeMapView ─────────────────────────────────────────────────────────
// Evidence-based view: who has learned, applied, or been recognized for each
// knowledge area. All derived client-side; no persisted summaries.
// MVP shows learned, applied, recognized; inferred in hook but hidden in UI.

import React, { useState, useMemo } from 'react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { useKnowledgeMap } from '../hooks/useKnowledgeMap.js';

const EVIDENCE_TYPE_LABELS = {
  learned:    { short: '📚', label: 'Aprendido' },
  applied:    { short: '🔧', label: 'Aplicado' },
  recognized: { short: '🏆', label: 'Reconocido' },
  inferred:   { short: '🔗', label: 'Inferido' },
};

export default function KnowledgeMapView({
  memberships = [],
  meritEvents = [],
  tasks = [],
  moduleAttempts = [],
  merits = [],
  modules = [],
  knowledgeAreas = [],
  onViewProfile,
}) {
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const { evidence } = useKnowledgeMap({
    teamMemberships: memberships,
    teamMeritEvents: meritEvents,
    teamTasks: tasks,
    teamModuleAttempts: moduleAttempts,
    teamMerits: merits,
    teamModules: modules,
    knowledgeAreas,
    lang,
  });

  const areasForFilter = [{ id: '', name: t('knowledge_map_all_areas') || 'Todas las áreas' }, ...knowledgeAreas];
  const typeOptions = [
    { id: '', label: t('knowledge_map_all_types') || 'Todos los tipos' },
    { id: 'learned', label: EVIDENCE_TYPE_LABELS.learned.label },
    { id: 'applied', label: EVIDENCE_TYPE_LABELS.applied.label },
    { id: 'recognized', label: EVIDENCE_TYPE_LABELS.recognized.label },
  ];

  const filteredEvidence = useMemo(() => {
    let out = evidence;
    if (areaFilter) out = out.filter((e) => e.knowledgeAreaId === areaFilter);
    if (typeFilter) out = out.filter((e) => e.type === typeFilter);
    return out;
  }, [evidence, areaFilter, typeFilter]);

  const rowsByMemberArea = useMemo(() => {
    const map = {};
    for (const e of filteredEvidence) {
      const key = `${e.membershipId}:${e.knowledgeAreaId}`;
      if (!map[key]) {
        map[key] = { membershipId: e.membershipId, knowledgeAreaId: e.knowledgeAreaId, items: [] };
      }
      map[key].items.push(e);
    }
    return Object.values(map);
  }, [filteredEvidence]);

  const getMemberName = (membershipId) => {
    const m = memberships.find((x) => x.id === membershipId);
    return ensureString(m?.displayName, lang) || m?.userId || membershipId || '—';
  };

  const getAreaName = (areaId) => knowledgeAreas.find((a) => a.id === areaId)?.name || areaId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">{t('nav_knowledge_map') || 'Mapa de conocimientos'}</h2>
      </div>

      <p className="text-xs text-slate-500">
        {t('knowledge_map_hint') || 'Evidencia derivada de módulos aprobados, tareas completadas y logros otorgados. Cada fila muestra las fuentes.'}
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
        >
          {areasForFilter.map((a) => (
            <option key={a.id || '_all'} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
        >
          {typeOptions.map((o) => (
            <option key={o.id || '_all'} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {knowledgeAreas.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-500 text-sm">
          {t('knowledge_map_no_areas') || 'Configura las áreas de conocimiento en Admin para ver el mapa.'}
        </div>
      ) : rowsByMemberArea.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-500 text-sm">
          {t('knowledge_map_no_evidence') || 'No hay evidencia aún. Completa módulos, tareas con áreas etiquetadas, o recibe logros con áreas.'}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-3 py-2 text-slate-400 font-medium">{t('member') || 'Miembro'}</th>
                <th className="px-3 py-2 text-slate-400 font-medium">{t('merit_attr_knowledge_areas') || 'Área'}</th>
                <th className="px-3 py-2 text-slate-400 font-medium">{t('knowledge_map_evidence_types') || 'Tipos'}</th>
                <th className="px-3 py-2 text-slate-400 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {rowsByMemberArea.map((row) => {
                const key = `${row.membershipId}:${row.knowledgeAreaId}`;
                const isExpanded = expandedRow === key;
                const typesShown = [...new Set(row.items.filter((i) => i.type !== 'inferred').map((i) => i.type))];
                return (
                  <React.Fragment key={key}>
                    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onViewProfile?.(memberships.find((m) => m.id === row.membershipId))}
                          className="text-emerald-400 hover:text-emerald-300 underline text-left"
                        >
                          {getMemberName(row.membershipId)}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{getAreaName(row.knowledgeAreaId)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {typesShown.map((type) => (
                            <span
                              key={type}
                              className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300"
                              title={EVIDENCE_TYPE_LABELS[type]?.label}
                            >
                              {EVIDENCE_TYPE_LABELS[type]?.short} {EVIDENCE_TYPE_LABELS[type]?.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setExpandedRow(isExpanded ? null : key)}
                          className="text-slate-500 hover:text-slate-300"
                          title={t('knowledge_map_view_sources') || 'Ver fuentes'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 bg-slate-900/80 border-b border-slate-700 text-[11px]">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-400 mb-1">{t('knowledge_map_sources') || 'Fuentes:'}</div>
                            {row.items.map((item) => (
                              <div key={`${item.source}-${item.sourceId}`} className="flex gap-2">
                                <span className="text-slate-500 shrink-0">{EVIDENCE_TYPE_LABELS[item.type]?.short} {EVIDENCE_TYPE_LABELS[item.type]?.label}:</span>
                                <span className="text-slate-300">{item.sourceLabel}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
