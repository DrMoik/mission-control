// ─── useTaskHandlers ─────────────────────────────────────────────────────────
// Task CRUD and grading handlers. Extracted from App.jsx for maintainability.
// Supports multi-assignee tasks (assigneeMembershipIds) and legacy assigneeMembershipId.

import { useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TASK_GRADES, TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT, TASK_GRADE_POINTS_TEAM_DEFAULT } from '../constants.js';

/**
 * @param {{
 *   currentTeam: object | null,
 *   currentMembership: object | null,
 *   authUser: object | null,
 *   userProfile: object | null,
 *   teamMemberships: object[],
 *   teamTasks: object[],
 *   canEdit: boolean,
 *   memberRole: string,
 *   logAudit: (action: string, targetType: string, targetId: string, details?: object) => Promise<void>,
 * }} params
 * @returns {{
 *   canAssignTask: (assigneeMembershipId: string) => boolean,
 *   handleCreateTask: (opts: { assigneeMembershipId?: string, assigneeMembershipIds?: string[], title: string, description?: string, dueDate?: string }) => Promise<void>,
 *   handleRequestTaskReview: (taskId: string) => Promise<void>,
 *   handleGradeTask: (taskId: string, grade: string) => Promise<void>,
 *   handleCompleteTask: (taskId: string) => Promise<void>,
 *   handleDeleteTask: (taskId: string) => Promise<void>,
 *   handleSetBlocked: (taskId: string, reason: string) => Promise<void>,
 *   handleUnblockTask: (taskId: string) => Promise<void>,
 *   handleUpdateTask: (taskId: string, updates: object) => Promise<void>,
 * }}
 */
export function useTaskHandlers({
  currentTeam,
  currentMembership,
  authUser,
  userProfile,
  teamMemberships,
  teamTasks,
  canEdit,
  memberRole,
  logAudit,
}) {
  const canAssignTask = useCallback((assigneeMembershipId) => {
    if (!currentTeam || !authUser) return false;
    if (canEdit) return true;
    if (memberRole !== 'leader' || !currentMembership?.categoryId) return false;
    const assignee = teamMemberships.find((m) => m.id === assigneeMembershipId);
    return assignee?.categoryId === currentMembership.categoryId;
  }, [currentTeam, authUser, canEdit, memberRole, currentMembership?.categoryId, teamMemberships]);

  const handleCreateTask = useCallback(async ({ assigneeMembershipId, assigneeMembershipIds, title, description, dueDate }) => {
    if (!currentTeam || !currentMembership) return;
    const ids = Array.isArray(assigneeMembershipIds) && assigneeMembershipIds.length > 0
      ? assigneeMembershipIds
      : (assigneeMembershipId ? [assigneeMembershipId] : []);
    if (ids.length === 0) return;
    for (const id of ids) { if (!canAssignTask(id)) return; }
    await addDoc(collection(db, 'tasks'), {
      teamId:                 currentTeam.id,
      assigneeMembershipIds:  ids,
      assignedByMembershipId: currentMembership.id,
      assignedByName:         currentMembership.displayName || userProfile?.displayName || authUser?.email || '—',
      title:                  (title || '').trim(),
      description:            (description || '').trim() || null,
      dueDate:                dueDate || null,
      status:                 'pending',
      createdAt:              serverTimestamp(),
    });
  }, [currentTeam, currentMembership, authUser, userProfile, canAssignTask]);

  const handleRequestTaskReview = useCallback(async (taskId) => {
    if (!currentTeam || !authUser) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    if (!isAssignee || (task.status || 'pending') !== 'pending') return;
    await updateDoc(doc(db, 'tasks', taskId), {
      status:            'pending_review',
      requestedReviewAt: serverTimestamp(),
    });
  }, [currentTeam, authUser, currentMembership?.id, teamTasks]);

  const handleGradeTask = useCallback(async (taskId, grade) => {
    if (!currentTeam || !authUser || !currentMembership) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending_review') return;
    if (task.assignedByMembershipId !== currentMembership.id) return;
    if (!TASK_GRADES.includes(grade)) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const ptsInd = currentTeam.taskGradePointsIndividual || TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT;
    const ptsTeam = currentTeam.taskGradePointsTeam || TASK_GRADE_POINTS_TEAM_DEFAULT;
    const pointsPerMember = assigneeIds.length > 1
      ? (ptsTeam[grade] ?? 0)
      : (ptsInd[grade] ?? 0);
    await updateDoc(doc(db, 'tasks', taskId), {
      status:               'completed',
      grade,
      completedAt:          serverTimestamp(),
      gradedByMembershipId:  currentMembership.id,
    });
    const meritName = 'Tarea revisada';
    const evidence = `${(task.title || '').trim()} (${grade})`;
    const awardedByName = currentMembership.displayName || userProfile?.displayName || authUser?.email || '—';
    const taskScope = assigneeIds.length > 1 ? 'team' : 'individual';
    const meritEventsRef = collection(db, 'meritEvents');
    for (const membershipId of assigneeIds) {
      await addDoc(meritEventsRef, {
        teamId:                currentTeam.id,
        membershipId,
        meritId:               null,
        meritName,
        meritLogo:             'checked-shield',
        points:                pointsPerMember,
        type:                 'award',
        evidence,
        awardedByUserId:       authUser?.uid ?? null,
        awardedByName,
        taskId,
        taskCompletionScope:   taskScope,
        taskGrade:             grade,
        createdAt:            serverTimestamp(),
      });
    }
    if (canEdit) await logAudit('grade_task', 'task', taskId, { grade, membershipId: task.assigneeMembershipId || task.assigneeMembershipIds?.[0] });
  }, [currentTeam, currentMembership, authUser, userProfile, teamTasks, canEdit, logAudit]);

  const handleCompleteTask = useCallback(async (taskId) => {
    if (!currentTeam || !authUser) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAdmin = canEdit;
    if (!isAssignee && !isAdmin) return;
    await updateDoc(doc(db, 'tasks', taskId), {
      status:      'completed',
      completedAt: serverTimestamp(),
    });
  }, [currentTeam, authUser, currentMembership?.id, teamTasks, canEdit]);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (!currentTeam) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAdmin = canEdit;
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    if (!isAssignee && !isAdmin && !isAssigner) return;
    await deleteDoc(doc(db, 'tasks', taskId));
  }, [currentTeam, currentMembership?.id, teamTasks, canEdit]);

  const handleSetBlocked = useCallback(async (taskId, reason) => {
    if (!currentTeam || !authUser) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    if (!isAssignee || (task.status || 'pending') !== 'pending') return;
    await updateDoc(doc(db, 'tasks', taskId), {
      blocked:       true,
      blockedReason: (reason || '').trim() || null,
      blockedAt:     serverTimestamp(),
    });
  }, [currentTeam, authUser, currentMembership?.id, teamTasks]);

  const handleUnblockTask = useCallback(async (taskId) => {
    if (!currentTeam || !authUser) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!task.blocked) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    const canUnblock = isAssignee || isAssigner || canEdit;
    if (!canUnblock) return;
    await updateDoc(doc(db, 'tasks', taskId), {
      blocked:       false,
      blockedReason: null,
      blockedAt:     null,
    });
  }, [currentTeam, authUser, currentMembership?.id, teamTasks, canEdit]);

  const handleUpdateTask = useCallback(async (taskId, updates) => {
    if (!currentTeam || !authUser) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    if (!isAssignee && !isAssigner && !canEdit) return;
    const payload = {};
    if (updates.knowledgeAreaIds !== undefined) {
      payload.knowledgeAreaIds = Array.isArray(updates.knowledgeAreaIds) ? updates.knowledgeAreaIds.filter(Boolean) : [];
    }
    if (Object.keys(payload).length === 0) return;
    await updateDoc(doc(db, 'tasks', taskId), payload);
  }, [currentTeam, authUser, currentMembership?.id, teamTasks, canEdit]);

  return {
    canAssignTask,
    handleCreateTask,
    handleRequestTaskReview,
    handleGradeTask,
    handleCompleteTask,
    handleDeleteTask,
    handleSetBlocked,
    handleUnblockTask,
    handleUpdateTask,
  };
}
