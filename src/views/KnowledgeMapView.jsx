import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, User, Users } from 'lucide-react';
import { t, lang } from '../strings.js';
import { ensureString, getL } from '../utils.js';
import { useKnowledgeMap } from '../hooks/useKnowledgeMap.js';

const normalizeSearch = (value) =>
  ensureString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatCountLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

function ExpandButton({ expanded, onClick, title }) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

function FilterInput({ value, onChange, placeholder }) {
  return (
    <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
      <Search className="h-4 w-4 text-slate-500" strokeWidth={2} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

export default function KnowledgeMapView({
  memberships = [],
  moduleAttempts = [],
  modules = [],
  knowledgeAreas = [],
  onViewProfile,
}) {
  const [perspective, setPerspective] = useState('members');
  const [memberSearch, setMemberSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const { evidence, evidenceByMember, evidenceByArea } = useKnowledgeMap({
    teamModuleAttempts: moduleAttempts,
    teamModules: modules,
    knowledgeAreas,
    lang,
  });

  const membershipMap = useMemo(
    () => new Map(memberships.map((membership) => [membership.id, membership])),
    [memberships],
  );
  const areaMap = useMemo(
    () => new Map(knowledgeAreas.map((area) => [area.id, area])),
    [knowledgeAreas],
  );

  const moduleMap = useMemo(() => {
    return new Map(
      modules.map((module) => [
        module.id,
        {
          ...module,
          resolvedTitle: getL(module.title, lang) || module.name || 'Modulo',
        },
      ]),
    );
  }, [modules]);

  const toggleExpanded = (key) => {
    setExpandedRows((current) => ({ ...current, [key]: !current[key] }));
  };

  const memberRows = useMemo(() => {
    const memberQuery = normalizeSearch(memberSearch);
    const skillQuery = normalizeSearch(skillSearch);

    return memberships
      .map((membership) => {
        const memberEvidence = evidenceByMember[membership.id] || [];
        const byArea = new Map();

        memberEvidence.forEach((item) => {
          const area = areaMap.get(item.knowledgeAreaId);
          const areaName = area?.name || item.knowledgeAreaId;
          const current = byArea.get(item.knowledgeAreaId) || {
            areaId: item.knowledgeAreaId,
            areaName,
            modules: [],
            moduleIds: new Set(),
          };

          if (!current.moduleIds.has(item.moduleId)) {
            current.moduleIds.add(item.moduleId);
            current.modules.push({
              moduleId: item.moduleId,
              title: moduleMap.get(item.moduleId)?.resolvedTitle || item.sourceLabel,
              sourceId: item.sourceId,
            });
          }

          byArea.set(item.knowledgeAreaId, current);
        });

        const skills = Array.from(byArea.values())
          .map((item) => ({
            areaId: item.areaId,
            areaName: item.areaName,
            modules: item.modules.sort((a, b) => a.title.localeCompare(b.title)),
            moduleCount: item.modules.length,
          }))
          .sort((a, b) => a.areaName.localeCompare(b.areaName));

        return {
          membership,
          memberName: ensureString(membership.displayName, lang) || membership.userId || membership.id,
          skills,
          skillCount: skills.length,
          moduleCount: skills.reduce((sum, skill) => sum + skill.moduleCount, 0),
        };
      })
      .filter((row) => {
        if (selectedAreaId && !row.skills.some((skill) => skill.areaId === selectedAreaId)) return false;
        if (memberQuery && !normalizeSearch(row.memberName).includes(memberQuery)) return false;
        if (
          skillQuery &&
          !row.skills.some((skill) => normalizeSearch(skill.areaName).includes(skillQuery))
        ) return false;
        return row.skillCount > 0;
      })
      .sort((a, b) => {
        if (b.skillCount !== a.skillCount) return b.skillCount - a.skillCount;
        return a.memberName.localeCompare(b.memberName);
      });
  }, [memberships, evidenceByMember, areaMap, moduleMap, memberSearch, skillSearch, selectedAreaId]);

  const skillRows = useMemo(() => {
    const memberQuery = normalizeSearch(memberSearch);
    const skillQuery = normalizeSearch(skillSearch);

    return knowledgeAreas
      .map((area) => {
        const areaEvidence = evidenceByArea[area.id] || [];
        const byMember = new Map();

        areaEvidence.forEach((item) => {
          const membership = membershipMap.get(item.membershipId);
          if (!membership) return;

          const memberName = ensureString(membership.displayName, lang) || membership.userId || membership.id;
          const current = byMember.get(item.membershipId) || {
            membershipId: item.membershipId,
            memberName,
            membership,
            modules: [],
            moduleIds: new Set(),
          };

          if (!current.moduleIds.has(item.moduleId)) {
            current.moduleIds.add(item.moduleId);
            current.modules.push({
              moduleId: item.moduleId,
              title: moduleMap.get(item.moduleId)?.resolvedTitle || item.sourceLabel,
              sourceId: item.sourceId,
            });
          }

          byMember.set(item.membershipId, current);
        });

        const members = Array.from(byMember.values())
          .map((item) => ({
            membershipId: item.membershipId,
            memberName: item.memberName,
            membership: item.membership,
            modules: item.modules.sort((a, b) => a.title.localeCompare(b.title)),
            moduleCount: item.modules.length,
          }))
          .sort((a, b) => a.memberName.localeCompare(b.memberName));

        return {
          area,
          areaName: area.name,
          members,
          memberCount: members.length,
          moduleCount: members.reduce((sum, member) => sum + member.moduleCount, 0),
        };
      })
      .filter((row) => {
        if (selectedMemberId && !row.members.some((member) => member.membershipId === selectedMemberId)) return false;
        if (skillQuery && !normalizeSearch(row.areaName).includes(skillQuery)) return false;
        if (
          memberQuery &&
          !row.members.some((member) => normalizeSearch(member.memberName).includes(memberQuery))
        ) return false;
        return row.memberCount > 0;
      })
      .sort((a, b) => {
        if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
        return a.areaName.localeCompare(b.areaName);
      });
  }, [knowledgeAreas, evidenceByArea, membershipMap, moduleMap, memberSearch, skillSearch, selectedMemberId]);

  const visibleRows = perspective === 'members' ? memberRows : skillRows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t('nav_knowledge_map') || 'Mapa curricular'}</h2>
          <p className="max-w-3xl text-xs text-slate-500">
            {t('knowledge_map_hint') || 'Vista derivada solo de módulos aprobados. Puedes revisar skills por usuario y usuarios por skill sin saturar la pantalla.'}
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setPerspective('members')}
            className={`rounded-md px-3 py-2 text-sm transition ${perspective === 'members' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Skills por usuario
          </button>
          <button
            type="button"
            onClick={() => setPerspective('skills')}
            className={`rounded-md px-3 py-2 text-sm transition ${perspective === 'skills' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Usuarios por skill
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
        <div className="flex flex-wrap gap-2">
          <FilterInput
            value={memberSearch}
            onChange={setMemberSearch}
            placeholder="Filtrar por usuario"
          />
          <FilterInput
            value={skillSearch}
            onChange={setSkillSearch}
            placeholder="Filtrar por skill"
          />
          <select
            value={selectedAreaId}
            onChange={(event) => setSelectedAreaId(event.target.value)}
            className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300"
          >
            <option value="">Todas las skills</option>
            {knowledgeAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <select
            value={selectedMemberId}
            onChange={(event) => setSelectedMemberId(event.target.value)}
            className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300"
          >
            <option value="">Todos los usuarios</option>
            {memberships.map((membership) => (
              <option key={membership.id} value={membership.id}>
                {ensureString(membership.displayName, lang) || membership.userId || membership.id}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
            {formatCountLabel(memberRows.length, 'usuario visible', 'usuarios visibles')}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
            {formatCountLabel(skillRows.length, 'skill visible', 'skills visibles')}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
            {formatCountLabel(evidence.length, 'modulo aprobado registrado', 'modulos aprobados registrados')}
          </span>
        </div>
      </div>

      {knowledgeAreas.length === 0 ? (
        <div className="rounded-lg bg-slate-800 p-6 text-center text-sm text-slate-500">
          {t('knowledge_map_no_areas') || 'Configura las áreas de conocimiento en Admin para ver el mapa.'}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-lg bg-slate-800 p-6 text-center text-sm text-slate-500">
          {t('knowledge_map_no_evidence') || 'No hay módulos aprobados que coincidan con los filtros actuales.'}
        </div>
      ) : (
        <div className="space-y-3">
          {perspective === 'members'
            ? memberRows.map((row) => {
                const rowKey = `member:${row.membership.id}`;
                const expanded = !!expandedRows[rowKey];
                return (
                  <section key={row.membership.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                          <button
                            type="button"
                            onClick={() => onViewProfile?.(row.membership)}
                            className="truncate text-left font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            {row.memberName}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatCountLabel(row.skillCount, 'skill', 'skills')} y {formatCountLabel(row.moduleCount, 'modulo aprobado', 'modulos aprobados')}
                        </p>
                      </div>
                      <ExpandButton
                        expanded={expanded}
                        onClick={() => toggleExpanded(rowKey)}
                        title="Ver skills del usuario"
                      />
                    </div>
                    {expanded && (
                      <div className="border-t border-slate-700 bg-slate-900/60 px-4 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          {row.skills.map((skill) => (
                            <article key={skill.areaId} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-medium text-slate-200">{skill.areaName}</h3>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {formatCountLabel(skill.moduleCount, 'modulo', 'modulos')}
                                  </p>
                                </div>
                              </div>
                              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                                {skill.modules.map((module) => (
                                  <li key={module.sourceId} className="rounded-md bg-slate-900 px-2.5 py-2">
                                    {module.title}
                                  </li>
                                ))}
                              </ul>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })
            : skillRows.map((row) => {
                const rowKey = `skill:${row.area.id}`;
                const expanded = !!expandedRows[rowKey];
                return (
                  <section key={row.area.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                          <h3 className="truncate font-medium text-slate-100">{row.areaName}</h3>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatCountLabel(row.memberCount, 'usuario', 'usuarios')} y {formatCountLabel(row.moduleCount, 'modulo aprobado', 'modulos aprobados')}
                        </p>
                      </div>
                      <ExpandButton
                        expanded={expanded}
                        onClick={() => toggleExpanded(rowKey)}
                        title="Ver usuarios de la skill"
                      />
                    </div>
                    {expanded && (
                      <div className="border-t border-slate-700 bg-slate-900/60 px-4 py-3">
                        <div className="space-y-3">
                          {row.members.map((member) => (
                            <article key={member.membershipId} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => onViewProfile?.(member.membership)}
                                    className="text-left font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
                                  >
                                    {member.memberName}
                                  </button>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {formatCountLabel(member.moduleCount, 'modulo', 'modulos')}
                                  </p>
                                </div>
                              </div>
                              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                                {member.modules.map((module) => (
                                  <li key={module.sourceId} className="rounded-md bg-slate-900 px-2.5 py-2">
                                    {module.title}
                                  </li>
                                ))}
                              </ul>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
        </div>
      )}
    </div>
  );
}
