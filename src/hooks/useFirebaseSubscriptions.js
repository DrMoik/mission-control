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
  documentId,
} from 'firebase/firestore';
import { tsToDate } from '../utils.js';
import { SYSTEM_MERIT_NAMES } from '../constants.js';

/**
 * @param {{ authUser: object | null, selectedTeamId: string | null, userProfile?: object | null }} params
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
 *   teamSessions: object[],
 *   teamSwots: object[],
 *   teamEisenhowers: object[],
 *   teamPughs: object[],
 *   teamBoards: object[],
 *   teamPosts: object[],
 *   teamComments: object[],
 *   teamPostReactions: object[],
 *   teamMeetings: object[],
 *   teamGoals: object[],
 *   teamWeeklyStatuses: object[],
 *   teamFundingAccounts: object[],
 *   teamFundingEntries: object[],
 *   teamInventoryItems: object[],
 *   teamInventoryLoans: object[],
 *   crossTeamChannels: object[],
 *   crossTeamChannelInvitations: object[],
 *   teamTasks: object[],
 *   userMembershipsReady: boolean,
 * }}
 */
export function useFirebaseSubscriptions({ authUser, selectedTeamId, userProfile = null }) {
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
  const [teamSessions, setTeamSessions] = useState([]);
  const [teamSwots, setTeamSwots] = useState([]);
  const [teamEisenhowers, setTeamEisenhowers] = useState([]);
  const [teamPughs, setTeamPughs] = useState([]);
  const [teamBoards, setTeamBoards] = useState([]);
  const [teamPosts, setTeamPosts] = useState([]);
  const [teamComments, setTeamComments] = useState([]);
  const [teamPostReactions, setTeamPostReactions] = useState([]);
  const [teamMeetings, setTeamMeetings] = useState([]);
  const [teamGoals, setTeamGoals] = useState([]);
  const [teamWeeklyStatuses, setTeamWeeklyStatuses] = useState([]);
  const [teamFundingAccounts, setTeamFundingAccounts] = useState([]);
  const [teamFundingEntries, setTeamFundingEntries] = useState([]);
  const [teamInventoryItems, setTeamInventoryItems] = useState([]);
  const [teamInventoryLoans, setTeamInventoryLoans] = useState([]);
  const [crossTeamChannels, setCrossTeamChannels] = useState([]);
  const [crossTeamChannelInvitations, setCrossTeamChannelInvitations] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamHrSuggestions, setTeamHrSuggestions] = useState([]);
  const [teamHrComplaints, setTeamHrComplaints] = useState([]);
  const [teamSkillProposals, setTeamSkillProposals] = useState([]);
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
    if (!selectedTeamId) {
      setCrossTeamChannels([]);
      setCrossTeamChannelInvitations([]);
      return;
    }
    const unsubs = [];
    const isPlatformAdmin = userProfile?.platformRole?.trim() === 'platformAdmin';

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
      query(collection(db, 'teamSessions'), where('teamId', '==', selectedTeamId)),
      setTeamSessions,
      (rows) => [...rows].sort((a, b) => tsToDate(b.scheduledAt) - tsToDate(a.scheduledAt)),
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
    sub(query(collection(db, 'postReactions'), where('teamId', '==', selectedTeamId)), setTeamPostReactions);
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
      query(collection(db, 'teamInventoryItems'), where('teamId', '==', selectedTeamId)),
      setTeamInventoryItems,
      (rows) => [...rows].sort((a, b) => {
        const areaCmp = String(a.categoryId || '').localeCompare(String(b.categoryId || ''));
        if (areaCmp !== 0) return areaCmp;
        const typeCmp = String(a.type || '').localeCompare(String(b.type || ''));
        if (typeCmp !== 0) return typeCmp;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }),
    );
    sub(
      query(collection(db, 'teamInventoryLoans'), where('teamId', '==', selectedTeamId)),
      setTeamInventoryLoans,
      (rows) => [...rows].sort((a, b) => tsToDate(b.loanedAt) - tsToDate(a.loanedAt)),
    );
    if (isPlatformAdmin) {
      sub(
        collection(db, 'crossTeamChannels'),
        setCrossTeamChannels,
        (rows) => [...rows].sort((a, b) => {
          const tsCmp = tsToDate(b.lastMessageAt) - tsToDate(a.lastMessageAt);
          if (!Number.isNaN(tsCmp) && tsCmp !== 0) return tsCmp;
          return String(a.name || '').localeCompare(String(b.name || ''));
        }),
      );
    } else {
      const channelDocUnsubs = [];
      unsubs.push(() => channelDocUnsubs.splice(0).forEach((fn) => fn()));
      unsubs.push(onSnapshot(
        query(
          collection(db, 'crossTeamChannelTeams'),
          where('teamId', '==', selectedTeamId),
          where('status', 'in', ['owner', 'member']),
        ),
        (snap) => {
          channelDocUnsubs.splice(0).forEach((fn) => fn());
          const channelIds = [...new Set(snap.docs.map((d) => d.data().channelId).filter(Boolean))];
          if (!channelIds.length) {
            setCrossTeamChannels([]);
            return;
          }

          const channelMap = new Map();
          const syncRows = () => {
            setCrossTeamChannels(
              [...channelMap.values()].sort((a, b) => {
                const tsCmp = tsToDate(b.lastMessageAt) - tsToDate(a.lastMessageAt);
                if (!Number.isNaN(tsCmp) && tsCmp !== 0) return tsCmp;
                return String(a.name || '').localeCompare(String(b.name || ''));
              }),
            );
          };

          for (let i = 0; i < channelIds.length; i += 10) {
            const chunk = channelIds.slice(i, i + 10);
            const unsubChunk = onSnapshot(
              query(collection(db, 'crossTeamChannels'), where(documentId(), 'in', chunk)),
              (channelSnap) => {
                chunk.forEach((id) => channelMap.delete(id));
                channelSnap.docs.forEach((docSnap) => {
                  channelMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                });
                syncRows();
              },
            );
            channelDocUnsubs.push(unsubChunk);
          }
        },
      ));
    }
    sub(
      query(
        collection(db, 'crossTeamChannelTeams'),
        where('teamId', '==', selectedTeamId),
        where('status', '==', 'pending'),
      ),
      setCrossTeamChannelInvitations,
      (rows) => [...rows].sort((a, b) => tsToDate(b.invitedAt) - tsToDate(a.invitedAt)),
    );
    sub(
      query(collection(db, 'tasks'), where('teamId', '==', selectedTeamId)),
      setTeamTasks,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );
    sub(
      query(collection(db, 'hrSuggestions'), where('teamId', '==', selectedTeamId)),
      setTeamHrSuggestions,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );
    sub(
      query(collection(db, 'hrComplaints'), where('teamId', '==', selectedTeamId)),
      setTeamHrComplaints,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );
    sub(
      query(collection(db, 'skillProposals'), where('teamId', '==', selectedTeamId)),
      setTeamSkillProposals,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)),
    );

    // Module attempts: team admins see all (for approval); others see only their own
    if (authUser) {
      const isPlatformAdmin = userProfile?.platformRole?.trim() === 'platformAdmin';
      const currentMem = userMemberships.find(
        (m) => m.teamId === selectedTeamId && m.status === 'active',
      );
      const isTeamAdmin =
        isPlatformAdmin ||
        (currentMem && ['teamAdmin', 'facultyAdvisor'].includes(currentMem.role));
      const q = isTeamAdmin
        ? query(collection(db, 'moduleAttempts'), where('teamId', '==', selectedTeamId))
        : query(
            collection(db, 'moduleAttempts'),
            where('teamId', '==', selectedTeamId),
            where('userId', '==', authUser.uid),
          );
      unsubs.push(
        onSnapshot(q, (snap) =>
          setTeamModuleAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        ),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [selectedTeamId, authUser, userProfile, userMemberships]);

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
    teamSessions,
    teamSwots,
    teamEisenhowers,
    teamPughs,
    teamBoards,
    teamPosts,
    teamComments,
    teamPostReactions,
    teamMeetings,
    teamGoals,
    teamWeeklyStatuses,
    teamFundingAccounts,
    teamFundingEntries,
    teamInventoryItems,
    teamInventoryLoans,
    crossTeamChannels,
    crossTeamChannelInvitations,
    teamTasks,
    teamHrSuggestions,
    teamHrComplaints,
    teamSkillProposals,
    userMembershipsReady,
  };
}
