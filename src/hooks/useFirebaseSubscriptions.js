// ─── useFirebaseSubscriptions ───────────────────────────────────────────────
// Real-time Firestore subscriptions for teams, memberships, and team data.
// Subscribes to all teams (public), user memberships, and selected team collections.

import { useState, useEffect } from 'react';
import { db } from '../firebase.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { tsToDate } from '../utils.js';
import { SYSTEM_MERIT_NAMES } from '../constants.js';

/**
 * @param {{ authUser: object | null, selectedTeamId: string | null }} params
 * @returns {{
 *   allTeams: object[],
 *   allTeamCategories: Record<string, object[]>,
 *   userMemberships: object[],
 *   teamMemberships: object[],
 *   teamCategories: object[],
 *   teamMerits: object[],
 *   teamMeritEvents: object[],
 *   teamModules: object[],
 *   teamModuleAttempts: object[],
 *   teamEvents: object[],
 *   teamSwots: object[],
 *   teamEisenhowers: object[],
 *   teamPughs: object[],
 *   teamBoards: object[],
 *   teamPosts: object[],
 *   teamComments: object[],
 *   teamMeetings: object[],
 *   teamGoals: object[],
 *   teamWeeklyStatuses: object[],
 *   teamFundingAccounts: object[],
 *   teamFundingEntries: object[],
 *   teamTasks: object[],
 *   userMembershipsReady: boolean,
 * }}
 */
export function useFirebaseSubscriptions({ authUser, selectedTeamId }) {
  const [allTeams, setAllTeams] = useState([]);
  const [allTeamCategories, setAllTeamCategories] = useState({});
  const [userMemberships, setUserMemberships] = useState([]);
  const [teamMemberships, setTeamMemberships] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [teamMerits, setTeamMerits] = useState([]);
  const [teamMeritEvents, setTeamMeritEvents] = useState([]);
  const [teamModules, setTeamModules] = useState([]);
  const [teamModuleAttempts, setTeamModuleAttempts] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [teamSwots, setTeamSwots] = useState([]);
  const [teamEisenhowers, setTeamEisenhowers] = useState([]);
  const [teamPughs, setTeamPughs] = useState([]);
  const [teamBoards, setTeamBoards] = useState([]);
  const [teamPosts, setTeamPosts] = useState([]);
  const [teamComments, setTeamComments] = useState([]);
  const [teamMeetings, setTeamMeetings] = useState([]);
  const [teamGoals, setTeamGoals] = useState([]);
  const [teamWeeklyStatuses, setTeamWeeklyStatuses] = useState([]);
  const [teamFundingAccounts, setTeamFundingAccounts] = useState([]);
  const [teamFundingEntries, setTeamFundingEntries] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [userMembershipsReady, setUserMembershipsReady] = useState(false);

  // All teams (public — needed for the unauthenticated team browser)
  useEffect(() => {
    return onSnapshot(collection(db, 'teams'), (snap) => {
      setAllTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Categories for every team (needed for the join-request form before a team is selected)
  useEffect(() => {
    return onSnapshot(collection(db, 'categories'), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (!map[data.teamId]) map[data.teamId] = [];
        map[data.teamId].push(data);
      });
      setAllTeamCategories(map);
    });
  }, []);

  // Current user's memberships across all teams
  useEffect(() => {
    if (!authUser) {
      setUserMemberships([]);
      setUserMembershipsReady(false);
      return;
    }
    setUserMembershipsReady(false);
    const q = query(collection(db, 'memberships'), where('userId', '==', authUser.uid));
    return onSnapshot(q, (snap) => {
      setUserMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUserMembershipsReady(true);
    });
  }, [authUser]);

  // All data for the selected team — resets when team changes
  useEffect(() => {
    if (!selectedTeamId) return;
    const unsubs = [];

    const sub = (q, setter, transform) =>
      unsubs.push(
        onSnapshot(q, (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setter(transform ? transform(rows) : rows);
        }),
      );

    sub(query(collection(db, 'memberships'), where('teamId', '==', selectedTeamId)), setTeamMemberships);
    sub(
      query(collection(db, 'categories'), where('teamId', '==', selectedTeamId)),
      setTeamCategories,
      (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    );
    sub(query(collection(db, 'merits'), where('teamId', '==', selectedTeamId)), setTeamMerits);
    sub(
      query(collection(db, 'meritEvents'), where('teamId', '==', selectedTeamId)),
      setTeamMeritEvents,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );
    sub(
      query(collection(db, 'modules'), where('teamId', '==', selectedTeamId)),
      setTeamModules,
      (rows) => [...rows].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    );
    sub(
      query(collection(db, 'teamEvents'), where('teamId', '==', selectedTeamId)),
      setTeamEvents,
      (rows) => [...rows].sort((a, b) => tsToDate(a.date) - tsToDate(b.date)),
    );
    sub(
      query(collection(db, 'teamSwots'), where('teamId', '==', selectedTeamId)),
      setTeamSwots,
      (rows) => [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    );
    sub(
      query(collection(db, 'teamEisenhowers'), where('teamId', '==', selectedTeamId)),
      setTeamEisenhowers,
      (rows) => [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    );
    sub(
      query(collection(db, 'teamPughs'), where('teamId', '==', selectedTeamId)),
      setTeamPughs,
      (rows) => [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    );
    sub(query(collection(db, 'teamBoards'), where('teamId', '==', selectedTeamId)), setTeamBoards);
    sub(
      query(collection(db, 'posts'), where('teamId', '==', selectedTeamId)),
      setTeamPosts,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );
    sub(query(collection(db, 'comments'), where('teamId', '==', selectedTeamId)), setTeamComments);
    sub(query(collection(db, 'teamMeetings'), where('teamId', '==', selectedTeamId)), setTeamMeetings);
    sub(query(collection(db, 'teamGoals'), where('teamId', '==', selectedTeamId)), setTeamGoals);
    sub(
      query(collection(db, 'weeklyStatuses'), where('teamId', '==', selectedTeamId)),
      setTeamWeeklyStatuses,
      (rows) => [...rows].sort((a, b) => (b.weekOf || '').localeCompare(a.weekOf || '')),
    );
    sub(
      query(collection(db, 'teamFundingAccounts'), where('teamId', '==', selectedTeamId)),
      setTeamFundingAccounts,
      (rows) => [...rows].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    );
    sub(
      query(collection(db, 'teamFundingEntries'), where('teamId', '==', selectedTeamId)),
      setTeamFundingEntries,
      (rows) => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    );
    sub(
      query(collection(db, 'tasks'), where('teamId', '==', selectedTeamId)),
      setTeamTasks,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );

    // Module attempts are filtered per user to respect Firestore rules
    if (authUser) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'moduleAttempts'),
            where('teamId', '==', selectedTeamId),
            where('userId', '==', authUser.uid),
          ),
          (snap) => setTeamModuleAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        ),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [selectedTeamId, authUser]);

  // Retroactive migration: update "Actualización semanal" merits from 5 → 25 pts (runs once per team)
  useEffect(() => {
    if (!selectedTeamId || !authUser) return;
    const lockId = `weekly_25_${selectedTeamId}`;
    const lockRef = doc(db, 'migrations', lockId);
    const meritEventsRef = collection(db, 'meritEvents');
    (async () => {
      try {
        const lockSnap = await getDoc(lockRef);
        if (lockSnap.exists()) return;
        const q = query(
          meritEventsRef,
          where('teamId', '==', selectedTeamId),
          where('meritName', '==', SYSTEM_MERIT_NAMES.weeklyUpdate),
          where('points', '==', 5),
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(d.ref, { points: 25 });
        }
        await setDoc(lockRef, { doneAt: serverTimestamp(), updated: snap.size });
      } catch (e) {
        console.warn('Migration weekly_25:', e);
      }
    })();
  }, [selectedTeamId, authUser]);

  return {
    allTeams,
    allTeamCategories,
    userMemberships,
    teamMemberships,
    teamCategories,
    teamMerits,
    teamMeritEvents,
    teamModules,
    teamModuleAttempts,
    teamEvents,
    teamSwots,
    teamEisenhowers,
    teamPughs,
    teamBoards,
    teamPosts,
    teamComments,
    teamMeetings,
    teamGoals,
    teamWeeklyStatuses,
    teamFundingAccounts,
    teamFundingEntries,
    teamTasks,
    userMembershipsReady,
  };
}
