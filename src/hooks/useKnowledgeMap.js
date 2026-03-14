import { useMemo } from 'react';
import { getL } from '../utils.js';

/**
 * Derives knowledge evidence only from approved module attempts.
 * Each evidence record represents a member proving a skill by completing a module
 * linked to a knowledge area.
 */
export function useKnowledgeMap({
  teamModuleAttempts = [],
  teamModules = [],
  knowledgeAreas = [],
  lang = 'es',
}) {
  return useMemo(() => {
    const areaIds = new Set(knowledgeAreas.map((area) => area.id));
    const moduleMap = new Map(teamModules.map((module) => [module.id, module]));
    const evidence = [];
    const dedupe = new Set();

    for (const attempt of teamModuleAttempts) {
      if (attempt.status !== 'approved' || !attempt.membershipId || !attempt.moduleId) continue;

      const module = moduleMap.get(attempt.moduleId);
      const moduleAreaIds = Array.isArray(module?.knowledgeAreaIds) ? module.knowledgeAreaIds : [];
      if (moduleAreaIds.length === 0) continue;

      const sourceLabel = getL(module?.title, lang) || module?.name || 'Modulo';
      for (const knowledgeAreaId of moduleAreaIds) {
        if (!areaIds.has(knowledgeAreaId)) continue;

        const key = `${attempt.membershipId}:${knowledgeAreaId}:${attempt.id}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);

        evidence.push({
          membershipId: attempt.membershipId,
          knowledgeAreaId,
          source: 'moduleAttempt',
          sourceId: attempt.id,
          sourceLabel,
          moduleId: attempt.moduleId,
          completedAt: attempt.reviewedAt || attempt.updatedAt || attempt.createdAt || null,
        });
      }
    }

    const evidenceByMember = {};
    const evidenceByArea = {};
    for (const item of evidence) {
      (evidenceByMember[item.membershipId] = evidenceByMember[item.membershipId] || []).push(item);
      (evidenceByArea[item.knowledgeAreaId] = evidenceByArea[item.knowledgeAreaId] || []).push(item);
    }

    const getEvidenceForMember = (membershipId) => evidenceByMember[membershipId] || [];
    const getEvidenceForArea = (knowledgeAreaId) => evidenceByArea[knowledgeAreaId] || [];

    return {
      evidence,
      evidenceByMember,
      evidenceByArea,
      getEvidenceForMember,
      getEvidenceForArea,
    };
  }, [teamModuleAttempts, teamModules, knowledgeAreas, lang]);
}
