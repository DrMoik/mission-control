// ─── AdminView ────────────────────────────────────────────────────────────────
// Admin-only tab. Organized into:
//   • PERFIL — Carreras, Semestres, Etiquetas de personalidad (dict tag:texto mostrado), Sugerencias de colaboración
//   • LOGROS Y MÉRITOS — Tipos, dominios, niveles, Puntos de logros del sistema (Actualización semanal, Perfil completo, 50 actualizaciones) — retroactivo
//   • TAREAS — Puntos por calificación (retroactivo)

import React, { useState } from 'react';
import { t } from '../strings.js';
import {
  CAREER_OPTIONS, SEMESTER_OPTIONS, PERSONALITY_TAGS_DEFAULT,
  COLLAB_TAG_SUGGESTIONS, MERIT_DOMAINS, MERIT_TIERS,
  MERIT_FAMILIES_DEFAULT, KNOWLEDGE_AREAS_DEFAULT, SKILL_DICTIONARY_DEFAULT, SKILL_TYPES,
  TASK_GRADES, TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT, TASK_GRADE_POINTS_TEAM_DEFAULT,
  SYSTEM_MERIT_POINTS_DEFAULT, ADMIN_PLACEHOLDERS,
} from '../constants.js';

const parseList = (s, allowEmpty = false) =>
  (s || '').split(/[,\n]+/).map((x) => x.trim()).filter((x) => allowEmpty || x.length > 0);

/** Parse "key: label" lines into { key: label }. Legacy: plain keys use default label. */
function parsePersonalityDict(s) {
  const out = {};
  (s || '').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const colon = trimmed.indexOf(':');
    if (colon >= 0) {
      const key = trimmed.slice(0, colon).trim();
      const label = trimmed.slice(colon + 1).trim();
      if (key) out[key] = label || key;
    } else {
      out[trimmed] = PERSONALITY_TAGS_DEFAULT[trimmed] || trimmed;
    }
  });
  return out;
}

/** Serialize dict to "key: label" lines. */
function serializePersonalityDict(dict) {
  if (!dict || typeof dict !== 'object') return '';
  if (Array.isArray(dict)) {
    return dict.map((k) => `${k}: ${PERSONALITY_TAGS_DEFAULT[k] || k}`).join('\n');
  }
  return Object.entries(dict).map(([k, v]) => `${k}: ${v}`).join('\n');
}

/** Parse "id: name" or "id: name — description" lines into { id, name, description? }[]. */
function parseFamiliesOrAreas(s, withDescription = false) {
  return (s || '').split('\n').map((line) => {
    const t = line.trim();
    if (!t) return null;
    const dashIdx = t.indexOf(' — ');
    const colonIdx = t.indexOf(': ');
    let id, name, description;
    if (withDescription && dashIdx >= 0) {
      const beforeDash = t.slice(0, dashIdx).trim();
      description = t.slice(dashIdx + 3).trim();
      if (colonIdx >= 0 && colonIdx < dashIdx) {
        id = beforeDash.slice(0, colonIdx).trim().replace(/\s+/g, '_') || beforeDash;
        name = beforeDash.slice(colonIdx + 2).trim();
      } else {
        id = beforeDash.replace(/\s+/g, '_');
        name = beforeDash;
      }
    } else if (colonIdx >= 0) {
      id = t.slice(0, colonIdx).trim().replace(/\s+/g, '_') || t;
      name = t.slice(colonIdx + 2).trim();
    } else {
      id = t.replace(/\s+/g, '_');
      name = t;
    }
    if (!id || !name) return null;
    return withDescription ? { id, name, description: description || '' } : { id, name };
  }).filter(Boolean);
}

/** Serialize families to "id: name — description" lines. */
function serializeFamilies(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((x) => (x.description ? `${x.id}: ${x.name} — ${x.description}` : `${x.id}: ${x.name}`)).join('\n');
}

/** Serialize knowledge areas to "id: name" lines. */
function serializeKnowledgeAreas(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((x) => `${x.id}: ${x.name}`).join('\n');
}

/** Parse "id: label: type" lines into { id, label, type }[]. */
function parseSkillDictionary(s) {
  return (s || '').split('\n').map((line) => {
    const t = line.trim();
    if (!t) return null;
    const parts = t.split(':').map((p) => p.trim());
    const id = (parts[0] || '').replace(/\s+/g, '_');
    const label = parts[1] || id;
    const type = SKILL_TYPES.includes(parts[2]) ? parts[2] : 'technical';
    if (!id || !label) return null;
    return { id, label, type };
  }).filter(Boolean);
}

/** Serialize skill dictionary to "id: label: type" lines. */
function serializeSkillDictionary(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((s) => `${s.id}: ${s.label}: ${s.type || 'technical'}`).join('\n');
}

export default function AdminView({
  team,
  onSaveCareers,
  onSaveSemesters,
  onSavePersonalityTags,
  onSaveCollabSuggestions,
  onSaveMeritTags,
  onSaveMeritTiers,
  onSaveMeritFamilies,
  onSaveKnowledgeAreas,
  onSaveSkillDictionary,
  skillProposals = [],
  memberships = [],
  onApproveSkillProposal,
  onRejectSkillProposal,
  onSaveSystemMeritPoints,
  onSaveTaskGradePoints,
  t: tProp,
}) {
  const tFn = tProp || t;
  const [saving, setSaving] = useState(null);

  if (!team) return null;

  const careerOptions = team.careerOptions?.length ? team.careerOptions : CAREER_OPTIONS;
  const semesterOptions = team.semesterOptions?.length ? team.semesterOptions : SEMESTER_OPTIONS;
  const personalityTagsRaw = team.personalityTags;
  const personalityTags = (() => {
    if (personalityTagsRaw && typeof personalityTagsRaw === 'object' && !Array.isArray(personalityTagsRaw) && Object.keys(personalityTagsRaw).length > 0) return personalityTagsRaw;
    if (Array.isArray(personalityTagsRaw) && personalityTagsRaw.length > 0) {
      return Object.fromEntries(personalityTagsRaw.map((k) => [k, PERSONALITY_TAGS_DEFAULT[k] || k]));
    }
    return PERSONALITY_TAGS_DEFAULT;
  })();
  const collabSuggestions = team.collabTagSuggestions?.length ? team.collabTagSuggestions : COLLAB_TAG_SUGGESTIONS;
  const domains = team.domains?.length ? team.domains : MERIT_DOMAINS;
  const meritTiers = team.meritTiers?.length ? team.meritTiers : MERIT_TIERS;
  const meritFamilies = team.meritFamilies?.length ? team.meritFamilies : MERIT_FAMILIES_DEFAULT;
  const knowledgeAreas = team.knowledgeAreas?.length ? team.knowledgeAreas : KNOWLEDGE_AREAS_DEFAULT;
  const skillDictionary = team.skillDictionary?.length ? team.skillDictionary : SKILL_DICTIONARY_DEFAULT;
  const systemPoints = {
    weeklyUpdate:    team?.pointsPerWeeklyUpdate ?? SYSTEM_MERIT_POINTS_DEFAULT.weeklyUpdate,
    profileComplete: team?.pointsPerProfileComplete ?? SYSTEM_MERIT_POINTS_DEFAULT.profileComplete,
    milestone50:     team?.pointsPerMilestone50 ?? SYSTEM_MERIT_POINTS_DEFAULT.milestone50,
  };
  const taskGradeIndividual = team.taskGradePointsIndividual && Object.keys(team.taskGradePointsIndividual).length
    ? team.taskGradePointsIndividual
    : TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT;
  const taskGradeTeam = team.taskGradePointsTeam && Object.keys(team.taskGradePointsTeam).length
    ? team.taskGradePointsTeam
    : TASK_GRADE_POINTS_TEAM_DEFAULT;

  const save = async (key, fn, value) => {
    setSaving(key);
    try {
      await fn(value);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-8 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-200">{tFn('admin_tab_title') || 'Admin'}</h2>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-medium">
          {tFn('admin_only') || 'Solo admin'}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {tFn('admin_tab_help') || 'Edita las opciones de los menús. Un valor por línea o separados por coma. Guarda en cada sección para aplicar. Los puntos de logros del sistema (Actualización semanal, Perfil completo, 50 actualizaciones) y de tareas revisadas se aplican retroactivamente a todos los eventos existentes.'}
      </p>

      {/* ═══════════ PERFIL — opciones del formulario de perfil de miembro ═══════════ */}
      <div className="border-l-4 border-emerald-600/50 pl-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">{tFn('admin_section_profile') || 'Perfil'}</h3>
        <p className="text-[11px] text-slate-500 mb-4">{tFn('admin_section_profile_hint') || 'Opciones del formulario de perfil: carreras, semestres, etiquetas de personalidad (diccionario tag:texto mostrado), sugerencias de colaboración.'}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_careers_majors') || 'Carreras / Majors'}</h4>
            <p className="text-[10px] text-slate-500">{tFn('admin_empty_ok') || 'Línea vacía = opción "no definido".'}</p>
            <textarea
              key="careers"
              defaultValue={(careerOptions || []).join(', ')}
              id="admin-careers"
              rows={3}
              placeholder={ADMIN_PLACEHOLDERS.careers}
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
              {saving === 'careers' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_semesters') || 'Semestres'}</h4>
            <textarea
              key="semesters"
              defaultValue={(semesterOptions || []).join(', ')}
              id="admin-semesters"
              rows={3}
              placeholder={ADMIN_PLACEHOLDERS.semesters}
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
              {saving === 'semesters' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_personality_tags') || 'Etiquetas de personalidad'}</h4>
            <p className="text-[10px] text-slate-500">{tFn('admin_personality_hint') || 'Diccionario: etiqueta : texto mostrado. Una por línea. Ej: ptag_creative: Creativo/a. El tag se guarda; el texto es cómo se renderiza.'}</p>
            <textarea
              key="personality"
              defaultValue={serializePersonalityDict(personalityTags)}
              id="admin-personality"
              rows={5}
              placeholder={ADMIN_PLACEHOLDERS.personality}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 font-mono"
            />
            <button
              onClick={() => {
                const el = document.getElementById('admin-personality');
                save('personality', onSavePersonalityTags, parsePersonalityDict(el?.value || ''));
              }}
              disabled={saving === 'personality'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'personality' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_collab_suggestions') || 'Sugerencias de colaboración'}</h4>
            <textarea
              key="collab"
              defaultValue={(collabSuggestions || []).join(', ')}
              id="admin-collab"
              rows={3}
              placeholder={ADMIN_PLACEHOLDERS.collab}
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
              {saving === 'collab' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>
        </div>
      </div>

      {/* ═══════════ LOGROS Y MÉRITOS — dominios, niveles, familias, puntos automáticos ═══════════ */}
      <div className="border-l-4 border-amber-600/50 pl-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">{tFn('admin_section_merits') || 'Logros y méritos'}</h3>
        <p className="text-[11px] text-slate-500 mb-4">{tFn('admin_section_merits_hint') || 'Dominios, niveles, familias de mérito y puntos de logros automáticos (Actualización semanal, Perfil completo, 50 actualizaciones). Al guardar los puntos del sistema se aplican retroactivamente a todos los eventos existentes.'}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('merit_attr_domains') || 'Áreas / dominios'}</h4>
            <textarea
              key="domains"
              defaultValue={(domains || []).join(', ')}
              id="admin-domains"
              rows={2}
              placeholder={ADMIN_PLACEHOLDERS.domains}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
            />
            <button
              onClick={() => {
                const el = document.getElementById('admin-domains');
                const arr = parseList(el?.value || '');
                if (arr.length === 0) { alert(tFn('platform_config_min_one') || 'Se requiere al menos un valor.'); return; }
                save('domains', () => onSaveMeritTags(arr), arr);
              }}
              disabled={saving === 'domains'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'domains' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_merit_tiers') || 'Niveles de mérito'}</h4>
            <textarea
              key="tiers"
              defaultValue={(meritTiers || []).join(', ')}
              id="admin-tiers"
              rows={1}
              placeholder={ADMIN_PLACEHOLDERS.tiers}
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
              {saving === 'tiers' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_merit_families') || 'Familias de mérito'}</h4>
            <p className="text-[10px] text-slate-500">{tFn('admin_merit_families_hint') || 'Una por línea: id: nombre o id: nombre — descripción. Para inferencia de trayectorias.'}</p>
            <textarea
              key="families"
              defaultValue={serializeFamilies(meritFamilies)}
              id="admin-families"
              rows={5}
              placeholder="technical: Técnico — Agrupa logros técnicos"
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
            />
            <button
              onClick={() => {
                const el = document.getElementById('admin-families');
                save('families', onSaveMeritFamilies, parseFamiliesOrAreas(el?.value || '', true));
              }}
              disabled={saving === 'families'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'families' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_knowledge_areas') || 'Áreas de conocimiento'}</h4>
            <p className="text-[10px] text-slate-500">{tFn('admin_knowledge_areas_hint') || 'Una por línea: id: nombre. Para el mapa de conocimientos.'}</p>
            <textarea
              key="knowledgeAreas"
              defaultValue={serializeKnowledgeAreas(knowledgeAreas)}
              id="admin-knowledge-areas"
              rows={4}
              placeholder="ros: ROS\ncontrol: Teoría de control"
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
            />
            <button
              onClick={() => {
                const el = document.getElementById('admin-knowledge-areas');
                save('knowledgeAreas', onSaveKnowledgeAreas, parseFamiliesOrAreas(el?.value || '', false));
              }}
              disabled={saving === 'knowledgeAreas'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'knowledgeAreas' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

          {onSaveSkillDictionary && (
            <section className="bg-slate-800 rounded-xl p-4 space-y-3 lg:col-span-2">
              <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_skill_dictionary') || 'Diccionario de habilidades'}</h4>
              <p className="text-[10px] text-slate-500">{tFn('admin_skill_dictionary_hint') || 'Una por línea: id: etiqueta: tipo. Tipos: technical, learning, support, collaboration. Para perfil de colaboración.'}</p>
              <textarea
                key="skillDictionary"
                defaultValue={serializeSkillDictionary(skillDictionary)}
                id="admin-skill-dictionary"
                rows={8}
                placeholder="ros: ROS: technical\nstress_management: Manejo del estrés: support"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
              />
              <button
                onClick={() => {
                  const el = document.getElementById('admin-skill-dictionary');
                  save('skillDictionary', onSaveSkillDictionary, parseSkillDictionary(el?.value || ''));
                }}
                disabled={saving === 'skillDictionary'}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
              >
                {saving === 'skillDictionary' ? tFn('saving') || 'Guardando…' : tFn('save')}
              </button>
            </section>
          )}

          {skillProposals.filter((p) => (p.status || 'pending') === 'pending').length > 0 && (
            <section className="bg-slate-800 rounded-xl p-4 space-y-3 lg:col-span-2">
              <h4 className="text-sm font-semibold text-amber-400">{tFn('admin_skill_proposals') || 'Propuestas de habilidades'}</h4>
              <p className="text-[10px] text-slate-500">{tFn('admin_skill_proposals_hint') || 'Los miembros proponen habilidades que no están en el catálogo. Aprueba para agregarlas a Áreas de conocimiento.'}</p>
              <div className="space-y-2">
                {skillProposals.filter((p) => (p.status || 'pending') === 'pending').map((p) => {
                  const proposer = memberships.find((m) => m.id === p.proposedByMembershipId);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-900/60 rounded border border-slate-600">
                      <div>
                        <span className="text-sm text-slate-200 font-medium">{p.label || p.proposedLabel}</span>
                        {p.proposedType && <span className="text-[10px] text-slate-500 ml-1">({p.proposedType})</span>}
                        {proposer && <span className="text-[10px] text-slate-500 ml-2">— {proposer.displayName || '?'}</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onApproveSkillProposal?.(p.id)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2 py-1 rounded"
                        >
                          {tFn('approve') || 'Aprobar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectSkillProposal?.(p.id)}
                          className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 px-2 py-1 rounded"
                        >
                          {tFn('reject') || 'Rechazar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="bg-slate-800 rounded-xl p-4 space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_system_merit_points') || 'Puntos de logros del sistema'}</h4>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-medium">{tFn('admin_retroactive') || 'Retroactivo'}</span>
            </div>
            <p className="text-[11px] text-slate-500">{tFn('admin_system_merit_hint') || 'Actualización semanal, Perfil completo, 50 actualizaciones. Al guardar se actualizan el equipo y todos los meritEvents existentes con los nuevos puntos.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">{tFn('admin_system_weekly') || 'Actualización semanal'}</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={systemPoints.weeklyUpdate}
                  id="admin-system-weekly"
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">{tFn('admin_system_profile') || 'Perfil completo'}</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={systemPoints.profileComplete}
                  id="admin-system-profile"
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">{tFn('admin_system_milestone') || '50 actualizaciones'}</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={systemPoints.milestone50}
                  id="admin-system-milestone"
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!onSaveSystemMeritPoints) return;
                const weekly = Math.max(0, parseInt(document.getElementById('admin-system-weekly')?.value || '0', 10) || 0);
                const profile = Math.max(0, parseInt(document.getElementById('admin-system-profile')?.value || '0', 10) || 0);
                const milestone = Math.max(0, parseInt(document.getElementById('admin-system-milestone')?.value || '0', 10) || 0);
                save('systemMerit', onSaveSystemMeritPoints, { weeklyUpdate: weekly, profileComplete: profile, milestone50: milestone });
              }}
              disabled={saving === 'systemMerit'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'systemMerit' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>

        </div>
      </div>

      {/* ═══════════ TAREAS — flujo Solicitar Revisión ═══════════ */}
      <div className="border-l-4 border-pink-600/50 pl-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">{tFn('admin_section_tasks') || 'Tareas'}</h3>
        <p className="text-[11px] text-slate-500 mb-4">{tFn('admin_section_tasks_hint') || 'Puntos por calificación en el flujo "Solicitar Revisión". Al guardar se aplican retroactivamente a todos los eventos existentes.'}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-slate-800 rounded-xl p-4 space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-emerald-400">{tFn('admin_task_grade_points') || 'Puntos por tarea revisada'}</h4>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-medium">{tFn('admin_retroactive') || 'Retroactivo'}</span>
            </div>
            <p className="text-[11px] text-slate-500">{tFn('admin_task_grade_points_hint') || 'Individual = 1 asignado. Equipo = 2+ asignados. Se aplican retroactivamente.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-xs font-semibold text-slate-400 mb-2">{tFn('admin_task_grade_individual') || 'Individual'}</h5>
                <div className="flex flex-wrap gap-3">
                  {TASK_GRADES.map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-400 capitalize">{tFn(`task_grade_${g}`) || g}</label>
                      <input
                        type="number"
                        min="0"
                        defaultValue={taskGradeIndividual[g] ?? 0}
                        id={`admin-task-ind-${g}`}
                        className="w-14 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-xs font-semibold text-slate-400 mb-2">{tFn('admin_task_grade_team') || 'Equipo (por miembro)'}</h5>
                <div className="flex flex-wrap gap-3">
                  {TASK_GRADES.map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-400 capitalize">{tFn(`task_grade_${g}`) || g}</label>
                      <input
                        type="number"
                        min="0"
                        defaultValue={taskGradeTeam[g] ?? 0}
                        id={`admin-task-team-${g}`}
                        className="w-14 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                const individual = {};
                const team = {};
                TASK_GRADES.forEach((g) => {
                  const indEl = document.getElementById(`admin-task-ind-${g}`);
                  const teamEl = document.getElementById(`admin-task-team-${g}`);
                  individual[g] = Math.max(0, parseInt(indEl?.value || '0', 10) || 0);
                  team[g] = Math.max(0, parseInt(teamEl?.value || '0', 10) || 0);
                });
                save('taskGrade', onSaveTaskGradePoints, { individual, team });
              }}
              disabled={saving === 'taskGrade'}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded"
            >
              {saving === 'taskGrade' ? tFn('saving') || 'Guardando…' : tFn('save')}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
