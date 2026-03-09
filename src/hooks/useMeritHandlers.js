// ─── useMeritHandlers ─────────────────────────────────────────────────────────
// Merit CRUD and award handlers. Extracted from App.jsx for maintainability.

import { useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * @param {{
 *   currentTeam: object | null,
 *   currentMembership: object | null,
 *   authUser: object | null,
 *   userProfile: object | null,
 *   teamMemberships: object[],
 *   teamMerits: object[],
 *   teamMeritEvents: object[],
 *   canEdit: boolean,
 *   canCreateMerit: boolean,
 *   canAward: boolean,
 *   memberRole: string,
 *   isPlatformAdmin: boolean,
 *   logAudit: (action: string, targetType: string, targetId: string, details?: object) => Promise<void>,
 *   t: (key: string) => string,
 * }} params
 * @returns {{
 *   canEditMerit: (merit: object) => boolean,
 *   handleCreateMerit: (name: string, points: number, categoryId?: string, logo?: string, shortDescription?: string, longDescription?: string, assignableBy?: string, tags?: string[], achievementTypes?: string[], domains?: string[], tier?: string | null, repeatable?: boolean) => Promise<void>,
 *   handleDeleteMerit: (meritId: string) => Promise<void>,
 *   handleRecoverMerit: (meritId: string, sampleEvent: object) => Promise<void>,
 *   handleUpdateMerit: (meritId: string, updates: object) => Promise<void>,
 *   handleAwardMerit: (membershipId: string, meritId: string, evidence?: string) => Promise<void>,
 *   handleRevokeMerit: (eventId: string) => Promise<void>,
 *   handleEditMeritEvent: (eventId: string, updates: { points: number, evidence: string }) => Promise<void>,
 * }}
 */
export function useMeritHandlers({
  currentTeam,
  currentMembership,
  authUser,
  userProfile,
  teamMemberships,
  teamMerits,
  teamMeritEvents,
  canEdit,
  canCreateMerit,
  canAward,
  memberRole,
  isPlatformAdmin,
  logAudit,
  t,
}) {
  const canEditMerit = useCallback((merit) => {
    if (canEdit) return true;
    if (memberRole === 'leader' && currentMembership?.categoryId && merit?.categoryId === currentMembership.categoryId) return true;
    return false;
  }, [canEdit, memberRole, currentMembership?.categoryId]);

  const handleCreateMerit = useCallback(async (name, points, categoryId, logo, shortDescription, longDescription, assignableBy = 'leader', tags = [], achievementTypes = [], domains = [], tier = null, repeatable = true, familyIds = [], knowledgeAreaIds = [], logoColor = '') => {
    if (!currentTeam) { alert('No team selected.'); return; }
    if (!canCreateMerit) { alert('No permission to create logros.'); return; }
    if (memberRole === 'leader' && !isPlatformAdmin) {
      if (!categoryId || categoryId !== currentMembership?.categoryId) {
        alert(t('leader_create_merit_category_only') || 'Como Líder, solo puedes crear logros para tu área asignada.');
        return;
      }
    }
    try {
      await addDoc(collection(db, 'merits'), {
        teamId: currentTeam.id,
        name,
        points:           Number(points),
        categoryId:       categoryId       || null,
        logo:             logo             || 'trophy',
        shortDescription: shortDescription || '',
        longDescription:  longDescription  || '',
        assignableBy:     assignableBy     || 'leader',
        tags:             Array.isArray(tags) ? tags.filter(Boolean) : [],
        achievementTypes: Array.isArray(achievementTypes) ? achievementTypes.filter(Boolean) : [],
        domains:          Array.isArray(domains) ? domains.filter(Boolean) : [],
        tier:             tier || null,
        repeatable:       repeatable !== false,
        familyIds:        Array.isArray(familyIds) ? familyIds.filter(Boolean) : [],
        knowledgeAreaIds: Array.isArray(knowledgeAreaIds) ? knowledgeAreaIds.filter(Boolean) : [],
        logoColor:        logoColor || null,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[Logro] Firestore error:', err);
      alert(`No se pudo guardar el logro: ${err.message}\n\nVerifica las reglas de Firestore en FIREBASE_SETUP.md.`);
    }
  }, [currentTeam, canCreateMerit, memberRole, currentMembership?.categoryId, isPlatformAdmin, t]);

  const handleDeleteMerit = useCallback(async (meritId) => {
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit || !canEditMerit(merit)) return;
    await deleteDoc(doc(db, 'merits', meritId));
  }, [teamMerits, canEditMerit]);

  const handleRecoverMerit = useCallback(async (meritId, sampleEvent) => {
    if (!currentTeam || !canCreateMerit) return;
    if (!sampleEvent?.meritId || !sampleEvent?.meritName) {
      alert(t('merit_recover_no_data') || 'No hay datos suficientes para recuperar este logro.');
      return;
    }
    try {
      await setDoc(doc(db, 'merits', meritId), {
        teamId:         currentTeam.id,
        name:           sampleEvent.meritName,
        points:         Number(sampleEvent.points) || 100,
        categoryId:     null,
        logo:           sampleEvent.meritLogo || 'trophy',
        logoColor:      sampleEvent.meritLogoColor || null,
        shortDescription: '',
        longDescription:  '',
        assignableBy:   'leader',
        tags:           [],
        achievementTypes: [],
        domains:        [],
        tier:           null,
        repeatable:     true,
        createdAt:      serverTimestamp(),
      });
    } catch (err) {
      console.error('[Logro] Recover error:', err);
      alert(t('merit_recover_failed') || `No se pudo recuperar: ${err.message}`);
    }
  }, [currentTeam, canCreateMerit, t]);

  const handleUpdateMerit = useCallback(async (meritId, updates) => {
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit || !canEditMerit(merit)) return;
    try {
      await updateDoc(doc(db, 'merits', meritId), {
        name:             updates.name             ?? merit.name,
        points:           Number(updates.points ?? merit.points),
        categoryId:       updates.categoryId       ?? merit.categoryId ?? null,
        logo:             updates.logo             ?? merit.logo ?? 'trophy',
        shortDescription: updates.shortDescription ?? merit.shortDescription ?? '',
        longDescription:  updates.longDescription  ?? merit.longDescription ?? '',
        assignableBy:     updates.assignableBy     ?? merit.assignableBy ?? 'leader',
        tags:             Array.isArray(updates.tags) ? updates.tags.filter(Boolean) : (merit.tags || []),
        achievementTypes: Array.isArray(updates.achievementTypes) ? updates.achievementTypes.filter(Boolean) : (merit.achievementTypes || []),
        domains:          Array.isArray(updates.domains) ? updates.domains.filter(Boolean) : (merit.domains || []),
        tier:             updates.tier ?? merit.tier ?? null,
        repeatable:       updates.repeatable !== undefined ? updates.repeatable !== false : merit.repeatable !== false,
        familyIds:        Array.isArray(updates.familyIds) ? updates.familyIds.filter(Boolean) : (merit.familyIds || []),
        knowledgeAreaIds: Array.isArray(updates.knowledgeAreaIds) ? updates.knowledgeAreaIds.filter(Boolean) : (merit.knowledgeAreaIds || []),
        logoColor:        updates.logoColor !== undefined ? (updates.logoColor || null) : (merit.logoColor ?? null),
      });
    } catch (err) {
      console.error('[Logro] Update Firestore error:', err);
      alert(`No se pudo actualizar el logro: ${err.message}`);
    }
  }, [teamMerits, canEditMerit]);

  const handleAwardMerit = useCallback(async (membershipId, meritId, evidence) => {
    if (!currentTeam || !canAward) return;
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit) return;
    const allowed = merit.assignableBy || 'leader';
    const canAssign = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || memberRole === allowed;
    if (!canAssign) {
      alert(`Solo un ${allowed === 'leader' ? 'Líder' : allowed === 'teamAdmin' ? 'Team Admin' : 'Faculty Advisor'} puede otorgar este logro.`);
      return;
    }
    if (!canEdit && memberRole === 'leader' && !isPlatformAdmin) {
      if (merit.categoryId && merit.categoryId !== currentMembership?.categoryId) {
        alert('Como Líder, solo puedes otorgar logros dentro de tu categoría asignada.');
        return;
      }
    }
    if (memberRole === 'leader' && !isPlatformAdmin) {
      const targetMember = teamMemberships.find((mm) => mm.id === membershipId);
      if (targetMember && currentMembership?.categoryId && targetMember.categoryId !== currentMembership.categoryId) {
        alert(t('merit_leader_area_only') || 'Como Líder, solo puedes otorgar reconocimiento a miembros de tu área.');
        return;
      }
    }
    if (membershipId === currentMembership?.id && !isPlatformAdmin) {
      alert(t('merit_self_award_error') || 'No puedes otorgarte logros a ti mismo.');
      return;
    }
    if (merit.repeatable === false) {
      const alreadyAwarded = teamMeritEvents.some(
        (e) => e.type === 'award' && e.meritId === meritId && e.membershipId === membershipId
      );
      if (alreadyAwarded) {
        alert(t('merit_award_once_error') || 'Este logro solo se puede otorgar una vez por persona. Ya fue otorgado a este miembro.');
        return;
      }
    }
    await addDoc(collection(db, 'meritEvents'), {
      teamId:               currentTeam.id,
      membershipId,
      meritId,
      meritName:            merit.name,
      meritLogo:            merit.logo || 'trophy',
      meritLogoColor:       merit.logoColor || null,
      points:               merit.points,
      type:                 'award',
      evidence:             evidence || '',
      createdByUserId:      authUser?.uid             || null,
      createdByMembershipId: currentMembership?.id    || null,
      awardedByUserId:      authUser?.uid             || null,
      awardedByName:        userProfile?.displayName   || authUser?.email || '—',
      createdAt:            serverTimestamp(),
    });
  }, [currentTeam, canAward, canEdit, currentMembership, authUser, userProfile, teamMerits, teamMemberships, teamMeritEvents, memberRole, isPlatformAdmin, t]);

  const handleRevokeMerit = useCallback(async (eventId) => {
    if (!canEdit) return;
    const evt = teamMeritEvents.find((e) => e.id === eventId);
    if (!evt || evt.type !== 'award') return;
    await deleteDoc(doc(db, 'meritEvents', eventId));
    await logAudit('revoke_merit', 'meritEvent', eventId, { meritName: evt.meritName, membershipId: evt.membershipId });
  }, [canEdit, teamMeritEvents, logAudit]);

  const handleEditMeritEvent = useCallback(async (eventId, { points, evidence }) => {
    if (!isPlatformAdmin) return;
    await updateDoc(doc(db, 'meritEvents', eventId), {
      points:       Number(points),
      evidence:     evidence || '',
      editedByUserId: authUser?.uid,
      editedAt:     serverTimestamp(),
    });
  }, [isPlatformAdmin, authUser?.uid]);

  return {
    canEditMerit,
    handleCreateMerit,
    handleDeleteMerit,
    handleRecoverMerit,
    handleUpdateMerit,
    handleAwardMerit,
    handleRevokeMerit,
    handleEditMeritEvent,
  };
}
