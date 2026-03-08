// ─── useContributionPath ───────────────────────────────────────────────────────
// Derives contribution tendencies from merits, tasks, modules. Pattern-based.
// No persistence. All logic in contributionPathRules.js.

import { useMemo } from 'react';
import { evaluateTendency, selectTendencies } from '../contributionPathRules.js';

const TENDENCY_ORDER = [
  'technical_specialist',
  'project_leader',
  'systems_integrator',
  'mentor_educator',
  'community_builder',
  'researcher_innovator',
];

/**
 * @param {{
 *   membershipId: string,
 *   teamMerits: object[],
 *   teamMeritEvents: object[],
 *   teamTasks: object[],
 *   teamModules: object[],
 *   teamModuleAttempts: object[],
 *   meritFamilies: { id: string, name: string }[],
 *   knowledgeEvidence?: Array<{ membershipId: string, knowledgeAreaId: string, type: string, source: string, sourceId: string }>,
 * }} params
 * @returns {{
 *   tendencies: Array<{ id: string, labelKey: string, phrase: string, evidence: { meritEventIds: string[], taskIds: string[], moduleIds: string[] } }>,
 *   evidenceByTendency: Record<string, { phrase: string, meritEventIds: string[], taskIds: string[], moduleIds: string[] }>,
 * }}
 */
export function useContributionPath({
  membershipId,
  teamMerits = [],
  teamMeritEvents = [],
  teamTasks = [],
  teamModules = [],
  teamModuleAttempts = [],
  meritFamilies = [],
  knowledgeEvidence = [],
}) {
  return useMemo(() => {
    if (!membershipId) return { tendencies: [], evidenceByTendency: {} };

    const myMeritEvents = teamMeritEvents.filter(
      (e) => e.membershipId === membershipId && e.type === 'award',
    );
    const getAssigneeIds = (t) =>
      t.assigneeMembershipIds ?? (t.assigneeMembershipId ? [t.assigneeMembershipId] : []);
    const myTasksAsAssigner = teamTasks.filter((t) => t.assignedByMembershipId === membershipId);
    const myTasksAsAssignee = teamTasks.filter((t) =>
      getAssigneeIds(t).includes(membershipId),
    );
    const myModuleAttempts = teamModuleAttempts.filter(
      (a) => a.membershipId === membershipId && a.status === 'approved',
    );
    const myKnowledgeEvidence = knowledgeEvidence.filter((e) => e.membershipId === membershipId);

    const ctx = {
      myMeritEvents,
      myTasksAsAssigner,
      myTasksAsAssignee,
      myModuleAttempts,
      merits: teamMerits,
      modules: teamModules,
      meritFamilies,
      knowledgeEvidence: myKnowledgeEvidence,
    };

    const results = TENDENCY_ORDER.map((id) => ({
      id,
      labelKey: `path_${id}`,
      ...evaluateTendency(id, ctx),
    }));

    const selected = selectTendencies(results);

    const tendencies = selected.map((r) => ({
      id: r.id,
      labelKey: r.labelKey,
      phrase: r.phrase,
      evidence: r.evidence,
    }));

    const evidenceByTendency = {};
    tendencies.forEach((t) => {
      evidenceByTendency[t.id] = {
        phrase: t.phrase,
        meritEventIds: t.evidence.meritEventIds || [],
        taskIds: t.evidence.taskIds || [],
        moduleIds: t.evidence.moduleIds || [],
      };
    });

    return { tendencies, evidenceByTendency };
  }, [
    membershipId,
    teamMerits,
    teamMeritEvents,
    teamTasks,
    teamModules,
    teamModuleAttempts,
    meritFamilies,
    knowledgeEvidence,
  ]);
}
