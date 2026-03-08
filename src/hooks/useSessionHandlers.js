// ─── useSessionHandlers ───────────────────────────────────────────────────────
// Community Sessions CRUD and attendance. Extracted for maintainability.

import { useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * @param {{
 *   currentTeam: object | null,
 *   currentMembership: object | null,
 *   authUser: object | null,
 *   userProfile: object | null,
 *   canEdit: boolean,
 *   canEditTools: boolean,
 * }} params
 * @returns {{
 *   handleCreateSession: (opts: object) => Promise<void>,
 *   handleUpdateSession: (sessionId: string, updates: object) => Promise<void>,
 *   handleDeleteSession: (sessionId: string) => Promise<void>,
 *   handleSaveAttendance: (sessionId: string, attendance: { membershipId: string, attended: boolean }[]) => Promise<void>,
 *   fetchAttendance: (sessionId: string) => Promise<object[]>,
 * }}
 */
export function useSessionHandlers({
  currentTeam,
  currentMembership,
  authUser,
  userProfile,
  canEdit,
  canEditTools,
}) {
  const canManageSessions = canEdit || canEditTools;

  const handleCreateSession = useCallback(
    async ({
      title,
      sessionClass,
      sessionType,
      scheduledAt,
      durationMinutes,
      description,
      categoryId,
    }) => {
      if (!currentTeam || !authUser || !canManageSessions) return;
      await addDoc(collection(db, 'teamSessions'), {
        teamId:          currentTeam.id,
        categoryId:      categoryId || null,
        title:           (title || '').trim(),
        sessionClass:    sessionClass || 'work',
        sessionType:     sessionType || 'other',
        scheduledAt:     scheduledAt ? new Date(scheduledAt) : serverTimestamp(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        description:     (description || '').trim() || null,
        notes:           null,
        artifactUrls:    [],
        meritId:         null,
        meritPoints:     null,
        createdBy:       authUser.uid,
        createdAt:       serverTimestamp(),
        lastEditedBy:    userProfile?.displayName || authUser?.email || '—',
        lastEditedAt:    serverTimestamp(),
      });
    },
    [currentTeam, authUser, userProfile, canManageSessions],
  );

  const handleUpdateSession = useCallback(
    async (sessionId, updates) => {
      if (!currentTeam || !authUser || !canManageSessions) return;
      const payload = { ...updates };
      if (payload.scheduledAt && !(payload.scheduledAt instanceof Date)) {
        payload.scheduledAt = new Date(payload.scheduledAt);
      }
      if (payload.durationMinutes !== undefined) {
        payload.durationMinutes = payload.durationMinutes ? Number(payload.durationMinutes) : null;
      }
      payload.lastEditedBy = userProfile?.displayName || authUser?.email || '—';
      payload.lastEditedAt = serverTimestamp();
      await updateDoc(doc(db, 'teamSessions', sessionId), payload);
    },
    [currentTeam, authUser, userProfile, canManageSessions],
  );

  const handleDeleteSession = useCallback(
    async (sessionId) => {
      if (!currentTeam || !canManageSessions) return;
      await deleteDoc(doc(db, 'teamSessions', sessionId));
    },
    [currentTeam, canManageSessions],
  );

  const fetchAttendance = useCallback(async (sessionId) => {
    if (!sessionId) return [];
    const snap = await getDocs(collection(db, 'teamSessions', sessionId, 'attendance'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, []);

  const handleSaveAttendance = useCallback(
    async (sessionId, attendance) => {
      if (!currentTeam || !authUser || !canManageSessions) return;
      const batch = writeBatch(db);
      const attRef = collection(db, 'teamSessions', sessionId, 'attendance');
      for (const { membershipId, attended } of attendance) {
        if (!membershipId) continue;
        const docRef = doc(attRef, membershipId);
        batch.set(docRef, {
          membershipId,
          attended: Boolean(attended),
          recordedAt:  serverTimestamp(),
          recordedBy:  authUser.uid,
        });
      }
      await batch.commit();
    },
    [currentTeam, authUser, canManageSessions],
  );

  return {
    handleCreateSession,
    handleUpdateSession,
    handleDeleteSession,
    handleSaveAttendance,
    fetchAttendance,
    canManageSessions,
  };
}
