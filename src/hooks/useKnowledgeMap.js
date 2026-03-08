// ─── useKnowledgeMap ───────────────────────────────────────────────────────────
// Derives knowledge evidence client-side from modules, tasks, and merit events.
// Four types: learned, applied, recognized, inferred.
// No persistence — all derived. Evidence stays inspectable and tied to real sources.

import { useMemo } from 'react';
import { getL } from '../utils.js';

/** Evidence types. inferred = derived from 2+ of learned/applied/recognized. */
export const KNOWLEDGE_EVIDENCE_TYPES = ['learned', 'applied', 'recognized', 'inferred'];

/**
 * @param {{
 *   teamMemberships: object[],
 *   teamMeritEvents: object[],
 *   teamTasks: object[],
 *   teamModuleAttempts: object[],
 *   teamMerits: object[],
 *   teamModules: object[],
 *   knowledgeAreas: { id: string, name: string }[],
 *   lang?: string,
 * }} params
 * @returns {{
 *   evidence: Array<{ membershipId: string, knowledgeAreaId: string, type: 'learned'|'applied'|'recognized'|'inferred', source: string, sourceId: string, sourceIds?: string[], sourceLabel: string }>,
 *   evidenceByMember: Record<string, typeof evidence>,
 *   evidenceByArea: Record<string, typeof evidence>,
 *   getEvidenceForMember: (membershipId: string) => typeof evidence,
 *   getEvidenceForArea: (knowledgeAreaId: string) => typeof evidence,
 * }}
 */
export function useKnowledgeMap({
  teamMemberships = [],
  teamMeritEvents = [],
  teamTasks = [],
  teamModuleAttempts = [],
  teamMerits = [],
  teamModules = [],
  knowledgeAreas = [],
  lang = 'es',
}) {
  return useMemo(() => {
    const evidence = [];
    const areaIds = new Set(knowledgeAreas.map((a) => a.id));

    const getModuleTitle = (mod) => getL(mod?.title, lang) || mod?.name || 'Módulo';
    const getTaskTitle = (task) => getL(task?.title, lang) || task?.name || 'Tarea';
    const getMeritName = (merit) => merit?.name || 'Logro';

    // ── Learned: approved module attempts, module has knowledgeAreaIds ─────────
    for (const att of teamModuleAttempts) {
      if (att.status !== 'approved' || !att.membershipId || !att.moduleId) continue;
      const mod = teamModules.find((m) => m.id === att.moduleId);
      const areaIdsMod = mod?.knowledgeAreaIds;
      if (!Array.isArray(areaIdsMod) || areaIdsMod.length === 0) continue;
      for (const areaId of areaIdsMod) {
        if (!areaIds.has(areaId)) continue;
        evidence.push({
          membershipId: att.membershipId,
          knowledgeAreaId: areaId,
          type: 'learned',
          source: 'moduleAttempt',
          sourceId: att.id,
          sourceLabel: getModuleTitle(mod),
        });
      }
    }

    // ── Applied: completed tasks with knowledgeAreaIds, assignees ─────────────
    for (const task of teamTasks) {
      if (task.status !== 'completed') continue;
      const areaIdsTask = task.knowledgeAreaIds;
      const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
      if (!Array.isArray(areaIdsTask) || areaIdsTask.length === 0 || assigneeIds.length === 0) continue;
      for (const membershipId of assigneeIds) {
        for (const areaId of areaIdsTask) {
          if (!areaIds.has(areaId)) continue;
          evidence.push({
            membershipId,
            knowledgeAreaId: areaId,
            type: 'applied',
            source: 'task',
            sourceId: task.id,
            sourceLabel: getTaskTitle(task),
          });
        }
      }
    }

    // ── Recognized: merit events (award), merit has knowledgeAreaIds ────────────
    for (const evt of teamMeritEvents) {
      if (evt.type !== 'award' || !evt.membershipId || !evt.meritId) continue;
      const merit = teamMerits.find((m) => m.id === evt.meritId);
      const areaIdsMerit = merit?.knowledgeAreaIds;
      if (!Array.isArray(areaIdsMerit) || areaIdsMerit.length === 0) continue;
      for (const areaId of areaIdsMerit) {
        if (!areaIds.has(areaId)) continue;
        evidence.push({
          membershipId: evt.membershipId,
          knowledgeAreaId: areaId,
          type: 'recognized',
          source: 'meritEvent',
          sourceId: evt.id,
          sourceLabel: getMeritName(merit),
        });
      }
    }

    // ── Inferred: member+area has 2+ of learned/applied/recognized ──────────────
    const byMemberArea = {};
    for (const e of evidence) {
      if (e.type === 'inferred') continue;
      const key = `${e.membershipId}:${e.knowledgeAreaId}`;
      if (!byMemberArea[key]) byMemberArea[key] = [];
      byMemberArea[key].push(e);
    }
    for (const [key, items] of Object.entries(byMemberArea)) {
      const types = new Set(items.map((i) => i.type));
      if (types.size < 2) continue;
      const [membershipId, knowledgeAreaId] = key.split(':');
      const sourceIds = items.map((i) => i.sourceId);
      const sourceLabels = [...new Set(items.map((i) => i.sourceLabel))];
      evidence.push({
        membershipId,
        knowledgeAreaId,
        type: 'inferred',
        source: 'derived',
        sourceId: sourceIds[0],
        sourceIds,
        sourceLabel: sourceLabels.join('; '),
      });
    }

    // Index by member and by area
    const evidenceByMember = {};
    const evidenceByArea = {};
    for (const e of evidence) {
      (evidenceByMember[e.membershipId] = evidenceByMember[e.membershipId] || []).push(e);
      (evidenceByArea[e.knowledgeAreaId] = evidenceByArea[e.knowledgeAreaId] || []).push(e);
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
  }, [
    teamMemberships,
    teamMeritEvents,
    teamTasks,
    teamModuleAttempts,
    teamMerits,
    teamModules,
    knowledgeAreas,
    lang,
  ]);
}
