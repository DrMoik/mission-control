// ─── useSessionHandlers ───────────────────────────────────────────────────────
// Community Sessions CRUD and attendance. Extracted for maintainability.

import { useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { SESSION_ATTENDANCE_POINTS_DEFAULT, SYSTEM_MERIT_NAMES } from '../constants.js';

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
      shortDescription,
      longDescription,
      place,
      categoryId,
      grantsPoints,
      meritPoints,
    }) => {
      if (!currentTeam || !authUser || !canManageSessions) return;
      const desc = (description || '').trim();
      const short = (shortDescription || desc || '').trim() || null;
      const long = (longDescription || desc || '').trim() || null;
      await addDoc(collection(db, 'teamSessions'), {
        teamId:          currentTeam.id,
        categoryId:      categoryId || null,
        title:           (title || '').trim(),
        sessionClass:    sessionClass || 'work',
        sessionType:     sessionType || 'other',
        scheduledAt:     scheduledAt ? new Date(scheduledAt) : serverTimestamp(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        place:           (place || '').trim() || null,
        shortDescription: short,
        longDescription: long,
        description:     desc || short || null,
        notes:           null,
        artifactUrls:    [],
        meritId:         null,
        grantsPoints:    Boolean(grantsPoints),
        meritPoints:     grantsPoints ? Number(meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT) : null,
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
      const sessionRef = doc(db, 'teamSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const session = sessionSnap.data();
      const shouldGrantPoints = Boolean(session.grantsPoints);
      const meritPoints = Number(session.meritPoints) || SESSION_ATTENDANCE_POINTS_DEFAULT;
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

      const meritEventsRef = collection(db, 'meritEvents');
      const existingSnap = await getDocs(
        query(
          meritEventsRef,
          where('teamId', '==', currentTeam.id),
          where('meritName', '==', SYSTEM_MERIT_NAMES.sessionAttendance),
          where('evidence', '==', `session_attendance:${sessionId}`),
        ),
      );

      if (shouldGrantPoints) {

        const existingByMembership = new Map(
          existingSnap.docs.map((item) => [item.data().membershipId, { id: item.id, ...item.data() }]),
        );

        for (const { membershipId, attended } of attendance) {
          if (!membershipId) continue;
          const existing = existingByMembership.get(membershipId);

          if (attended && !existing) {
            const eventRef = doc(meritEventsRef);
            batch.set(eventRef, {
              teamId:          currentTeam.id,
              membershipId,
              meritId:         null,
              meritName:       SYSTEM_MERIT_NAMES.sessionAttendance,
              meritLogo:       'calendar',
              points:          meritPoints,
              type:            'award',
              evidence:        `session_attendance:${sessionId}`,
              autoAward:       true,
              systemGiven:     true,
              awardedByUserId: authUser.uid,
              awardedByName:   userProfile?.displayName || authUser?.email || '—',
              createdAt:       serverTimestamp(),
            });
          }

          if (!attended && existing) {
            batch.delete(doc(meritEventsRef, existing.id));
          }
        }
      } else {
        existingSnap.docs.forEach((item) => {
          batch.delete(doc(meritEventsRef, item.id));
        });
      }

      await batch.commit();
    },
    [currentTeam, authUser, userProfile, canManageSessions],
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
