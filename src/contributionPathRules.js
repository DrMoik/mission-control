// ─── Contribution Path Rules ───────────────────────────────────────────────────
// Centralized, inspectable inference logic for contribution tendencies.
// Pattern-based only; no numeric scores. All rules are explicit.

/** Merit family IDs that signal each tendency. Teams can override families in Admin. */
export const TENDENCY_MERIT_FAMILIES = {
  technical_specialist: ['technical'],
  project_leader:       ['leadership'],
  mentor_educator:      ['learning'],
  community_builder:    ['community'],
  researcher_innovator: ['innovation'],
  systems_integrator:   null, // Uses cross-family pattern, not a single family
};

/** Minimum thresholds for pattern-based qualification. Inspectable constants. */
export const THRESHOLDS = {
  projectLeaderMinTasksAsAssigner: 3,
  systemsIntegratorMinFamiliesWithMerits: 2,
  systemsIntegratorMinMeritsPerFamily: 2,
  systemsIntegratorMinTasksAsAssigner: 2,
  systemsIntegratorMinTasksAsAssignee: 2,
};

/**
 * Evaluates whether a tendency qualifies for a member based on evidence.
 * Each tendency has explicit, inspectable rules. Returns { qualifies, evidence, phrase }.
 *
 * @param {string} tendencyId
 * @param {object} ctx - { myMeritEvents, myTasksAsAssigner, myTasksAsAssignee, myModuleAttempts, merits, modules, meritFamilies, knowledgeEvidence }
 */
export function evaluateTendency(tendencyId, ctx) {
  const {
    myMeritEvents,
    myTasksAsAssigner,
    myTasksAsAssignee,
    myModuleAttempts,
    merits,
    modules,
    meritFamilies,
    knowledgeEvidence = [],
  } = ctx;

  const familyIds = new Set((meritFamilies || []).map((f) => f.id));
  const myMeritsByFamily = {};
  for (const evt of myMeritEvents) {
    if (evt.type !== 'award' || !evt.meritId) continue;
    const merit = merits.find((m) => m.id === evt.meritId);
    const fids = merit?.familyIds || [];
    for (const fid of fids) {
      if (!familyIds.has(fid)) continue;
      myMeritsByFamily[fid] = (myMeritsByFamily[fid] || []).concat(evt);
    }
  }

  const evidence = { meritEventIds: [], taskIds: [], moduleIds: [] };
  let phrase = '';

  switch (tendencyId) {
    case 'technical_specialist': {
      const techFamilies = TENDENCY_MERIT_FAMILIES.technical_specialist || [];
      const techMerits = techFamilies.flatMap((f) => myMeritsByFamily[f] || []);
      const appliedTasks = myTasksAsAssignee.filter((t) => Array.isArray(t.knowledgeAreaIds) && t.knowledgeAreaIds.length > 0);
      const appliedEvidence = knowledgeEvidence.filter((e) => e.type === 'applied');
      const learnedModules = myModuleAttempts
        .filter((a) => a.status === 'approved')
        .map((a) => modules.find((m) => m.id === a.moduleId))
        .filter((m) => m && Array.isArray(m.knowledgeAreaIds) && m.knowledgeAreaIds.length > 0);

      if (techMerits.length > 0) {
        evidence.meritEventIds.push(...techMerits.map((e) => e.id));
      }
      if (appliedTasks.length > 0) {
        evidence.taskIds.push(...appliedTasks.map((t) => t.id));
      }
      if (learnedModules.length > 0) {
        evidence.moduleIds.push(...learnedModules.map((m) => m.id).filter(Boolean));
      }

      const qualifies = techMerits.length > 0 || appliedTasks.length > 0 || (learnedModules.length > 0 && appliedEvidence.length > 0);
      if (qualifies) {
        const parts = [];
        if (techMerits.length > 0) parts.push(`Logros en área técnica`);
        if (appliedTasks.length > 0) parts.push(`aplicaste conocimientos en ${appliedTasks.length} tarea(s)`);
        if (learnedModules.length > 0 && appliedEvidence.length > 0) parts.push(`módulos aprobados y conocimiento aplicado`);
        phrase = parts.join('; ') + '.';
      }
      return { qualifies, evidence, phrase };
    }

    case 'project_leader': {
      const minAssigner = THRESHOLDS.projectLeaderMinTasksAsAssigner;
      const leadershipFamilies = TENDENCY_MERIT_FAMILIES.project_leader || [];
      const leadershipMerits = leadershipFamilies.flatMap((f) => myMeritsByFamily[f] || []);

      if (myTasksAsAssigner.length >= minAssigner) {
        evidence.taskIds.push(...myTasksAsAssigner.slice(0, 5).map((t) => t.id));
      }
      if (leadershipMerits.length > 0) {
        evidence.meritEventIds.push(...leadershipMerits.map((e) => e.id));
      }

      const qualifies =
        myTasksAsAssigner.length >= minAssigner ||
        leadershipMerits.length >= 2;
      if (qualifies) {
        if (myTasksAsAssigner.length >= minAssigner && leadershipMerits.length > 0) {
          phrase = `Has coordinado ${myTasksAsAssigner.length} tareas y recibido logros en liderazgo.`;
        } else if (myTasksAsAssigner.length >= minAssigner) {
          phrase = `Has coordinado ${myTasksAsAssigner.length} tareas como responsable.`;
        } else {
          phrase = `Reconocimientos en liderazgo (${leadershipMerits.length} logros).`;
        }
      }
      return { qualifies, evidence, phrase };
    }

    case 'systems_integrator': {
      const familiesWithEnough = Object.entries(myMeritsByFamily).filter(
        ([, evts]) => evts.length >= THRESHOLDS.systemsIntegratorMinMeritsPerFamily,
      );
      const hasAssigner = myTasksAsAssigner.length >= THRESHOLDS.systemsIntegratorMinTasksAsAssigner;
      const hasAssignee = myTasksAsAssignee.length >= THRESHOLDS.systemsIntegratorMinTasksAsAssignee;
      const crossRole = hasAssigner && hasAssignee;
      const crossFamily = familiesWithEnough.length >= THRESHOLDS.systemsIntegratorMinFamiliesWithMerits;

      if (crossFamily) {
        familiesWithEnough.forEach(([, evts]) => {
          evidence.meritEventIds.push(...evts.map((e) => e.id));
        });
      }
      if (crossRole) {
        evidence.taskIds.push(
          ...myTasksAsAssigner.slice(0, 3).map((t) => t.id),
          ...myTasksAsAssignee.slice(0, 3).map((t) => t.id),
        );
      } else if (crossFamily && (hasAssigner || hasAssignee)) {
        if (hasAssigner) evidence.taskIds.push(...myTasksAsAssigner.slice(0, 3).map((t) => t.id));
        if (hasAssignee) evidence.taskIds.push(...myTasksAsAssignee.slice(0, 3).map((t) => t.id));
      }

      const qualifies =
        (crossFamily && (crossRole || hasAssigner || hasAssignee)) ||
        (crossRole && familiesWithEnough.length >= 1);
      if (qualifies) {
        const areas = familiesWithEnough.map(([fid]) => {
          const fam = (meritFamilies || []).find((x) => x.id === fid);
          return fam?.name || fid;
        });
        phrase = areas.length > 0
          ? `Contribuyes en varias áreas: ${areas.join(', ')}.`
          : `Coordinación y ejecución: tareas como responsable y como asignado.`;
      }
      return { qualifies, evidence, phrase };
    }

    case 'mentor_educator': {
      const learningFamilies = TENDENCY_MERIT_FAMILIES.mentor_educator || [];
      const mentorMerits = learningFamilies.flatMap((f) => myMeritsByFamily[f] || []);
      const approvedModules = myModuleAttempts.filter((a) => a.status === 'approved');

      if (mentorMerits.length > 0) {
        evidence.meritEventIds.push(...mentorMerits.map((e) => e.id));
      }
      if (approvedModules.length > 0 && mentorMerits.length > 0) {
        evidence.moduleIds.push(...approvedModules.map((a) => a.moduleId).filter(Boolean));
      }

      const qualifies = mentorMerits.length > 0;
      if (qualifies) {
        phrase = mentorMerits.length > 0 && approvedModules.length > 0
          ? `Reconocimientos en mentoría y aprendizaje; ${approvedModules.length} módulo(s) aprobado(s).`
          : `Reconocimientos en mentoría y aprendizaje.`;
      }
      return { qualifies, evidence, phrase };
    }

    case 'community_builder': {
      const communityFamilies = TENDENCY_MERIT_FAMILIES.community_builder || [];
      const communityMerits = communityFamilies.flatMap((f) => myMeritsByFamily[f] || []);

      if (communityMerits.length > 0) {
        evidence.meritEventIds.push(...communityMerits.map((e) => e.id));
      }

      const qualifies = communityMerits.length >= 1;
      if (qualifies) {
        phrase = `Reconocimientos en comunidad (${communityMerits.length} logro(s)).`;
      }
      return { qualifies, evidence, phrase };
    }

    case 'researcher_innovator': {
      const innovationFamilies = TENDENCY_MERIT_FAMILIES.researcher_innovator || [];
      const innovationMerits = innovationFamilies.flatMap((f) => myMeritsByFamily[f] || []);
      const byArea = {};
      for (const e of knowledgeEvidence) {
        if (!byArea[e.knowledgeAreaId]) byArea[e.knowledgeAreaId] = { types: new Set(), taskIds: [], meritEventIds: [] };
        byArea[e.knowledgeAreaId].types.add(e.type);
        if (e.source === 'task' && e.sourceId) byArea[e.knowledgeAreaId].taskIds.push(e.sourceId);
        if (e.source === 'meritEvent' && e.sourceId) byArea[e.knowledgeAreaId].meritEventIds.push(e.sourceId);
      }
      const areasWithBoth = Object.values(byArea).filter((a) => a.types.has('applied') && a.types.has('recognized'));
      const hasAppliedAndRecognized = areasWithBoth.length > 0;

      if (innovationMerits.length > 0) {
        evidence.meritEventIds.push(...innovationMerits.map((e) => e.id));
      }
      if (hasAppliedAndRecognized) {
        const seenT = new Set(evidence.taskIds);
        const seenM = new Set(evidence.meritEventIds);
        areasWithBoth.forEach((a) => {
          a.taskIds.forEach((id) => { if (!seenT.has(id)) { seenT.add(id); evidence.taskIds.push(id); } });
          a.meritEventIds.forEach((id) => { if (!seenM.has(id)) { seenM.add(id); evidence.meritEventIds.push(id); } });
        });
      }

      const qualifies = innovationMerits.length > 0 || hasAppliedAndRecognized;
      if (qualifies) {
        phrase = innovationMerits.length > 0
          ? `Reconocimientos en innovación.`
          : `Conocimientos aplicados y reconocidos en las mismas áreas.`;
      }
      return { qualifies, evidence, phrase };
    }

    default:
      return { qualifies: false, evidence, phrase: '' };
  }
}

/**
 * Selection rule: choose up to 3 tendencies. Explicit, inspectable.
 * 1. All qualified tendencies (has evidence)
 * 2. Order by: (a) evidence types count DESC, (b) total evidence count DESC, (c) config order
 * 3. Take first 3
 */
export function selectTendencies(results) {
  const qualified = results.filter((r) => r.qualifies && hasEvidence(r.evidence));
  const evidenceTypesCount = (ev) => {
    let n = 0;
    if (ev.meritEventIds?.length) n++;
    if (ev.taskIds?.length) n++;
    if (ev.moduleIds?.length) n++;
    return n;
  };
  const evidenceCount = (ev) =>
    (ev.meritEventIds?.length || 0) + (ev.taskIds?.length || 0) + (ev.moduleIds?.length || 0);
  const order = ['technical_specialist', 'project_leader', 'systems_integrator', 'mentor_educator', 'community_builder', 'researcher_innovator'];
  qualified.sort((a, b) => {
    const typesA = evidenceTypesCount(a.evidence);
    const typesB = evidenceTypesCount(b.evidence);
    if (typesB !== typesA) return typesB - typesA;
    const countA = evidenceCount(a.evidence);
    const countB = evidenceCount(b.evidence);
    if (countB !== countA) return countB - countA;
    return (order.indexOf(a.id) || 99) - (order.indexOf(b.id) || 99);
  });
  return qualified.slice(0, 3);
}

function hasEvidence(ev) {
  return (ev.meritEventIds?.length || 0) + (ev.taskIds?.length || 0) + (ev.moduleIds?.length || 0) > 0;
}
