// ─── App.jsx ──────────────────────────────────────────────────────────────────
// Root component.  Responsibilities:
//   1. Auth state (Firebase Auth + user profile document)
//   2. Real-time Firestore subscriptions for the active team
//   3. All write handlers (Firestore mutations)
//   4. Routing — chooses which view to render
//   5. Shell: header, sidebar nav, mobile nav, preview-mode banner
//
// Business logic that lives elsewhere:
//   constants.js   — static lookup tables (roles, careers, …)
//   utils.js       — pure helper functions (rankOf, tsToDate, …)
//   i18n/          — translations + LangContext
//   components/    — shared modals and UI atoms
//   views/         — one file per full-page view

import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, googleProvider }         from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  addDoc, query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

// ── Internal modules ──────────────────────────────────────────────────────────
import TRANSLATIONS                from './i18n/translations.js';
import LangContext                 from './i18n/LangContext.js';
import { EMPTY_PROFILE }           from './constants.js';
import { atLeast, tsToDate }       from './utils.js';

// ── Shared UI atoms ───────────────────────────────────────────────────────────
import { RoleBadge, GoogleIcon }   from './components/ui/index.js';

// ── Modals ────────────────────────────────────────────────────────────────────
import ProfileModal                from './components/ProfileModal.jsx';
import JoinRequestModal            from './components/JoinRequestModal.jsx';

// ── Full-page views ───────────────────────────────────────────────────────────
import OverviewView                from './views/OverviewView.jsx';
import CategoriesView              from './views/CategoriesView.jsx';
import MembersView                 from './views/MembersView.jsx';
import MeritsView                  from './views/MeritsView.jsx';
import LeaderboardView             from './views/LeaderboardView.jsx';
import ToolsView                   from './views/ToolsView.jsx';
import AcademyView                 from './views/AcademyView.jsx';
import FeedView                    from './views/FeedView.jsx';

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {

  // ── Language ───────────────────────────────────────────────────────────────
  // Persist choice in localStorage; default to Spanish
  const [lang, setLang] = useState(() => localStorage.getItem('mc_lang') || 'es');
  const t = React.useCallback(
    (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key,
    [lang],
  );
  const handleSetLang = (l) => { setLang(l); localStorage.setItem('mc_lang', l); };

  // ── Firebase Auth ──────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // ── Team selection ─────────────────────────────────────────────────────────
  const [selectedTeamId,    setSelectedTeamId]    = useState(null);
  const [joinTarget,        setJoinTarget]        = useState(null);       // team the user wants to join
  const [allTeamCategories, setAllTeamCategories] = useState({});         // { teamId: [categories] }

  // ── Live Firestore data ────────────────────────────────────────────────────
  const [allTeams,            setAllTeams]            = useState([]);
  const [userMemberships,     setUserMemberships]     = useState([]);
  const [teamMemberships,     setTeamMemberships]     = useState([]);
  const [teamCategories,      setTeamCategories]      = useState([]);
  const [teamMerits,          setTeamMerits]          = useState([]);
  const [teamMeritEvents,     setTeamMeritEvents]     = useState([]);
  const [teamModules,         setTeamModules]         = useState([]);
  const [teamModuleAttempts,  setTeamModuleAttempts]  = useState([]);
  const [teamEvents,          setTeamEvents]          = useState([]);
  const [teamBoards,          setTeamBoards]          = useState([]);
  const [teamPosts,           setTeamPosts]           = useState([]);
  const [teamComments,        setTeamComments]        = useState([]);
  const [teamMeetings,        setTeamMeetings]        = useState([]);
  const [teamGoals,           setTeamGoals]           = useState([]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [view,           setView]           = useState('overview');
  const [navCollapsed,   setNavCollapsed]   = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [previewRole,    setPreviewRole]    = useState(null);   // admin "preview as role" simulation
  const [profileMember,  setProfileMember]  = useState(null);   // opens ProfileModal

  // ────────────────────────────────────────────────────────────────────────────
  // EFFECTS — Firebase subscriptions
  // ────────────────────────────────────────────────────────────────────────────

  // Ref to cleanly cancel the user-profile listener on sign-out
  const profileUnsubRef = React.useRef(null);

  // Auth state — create user doc on first sign-in, subscribe to live updates
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; }
      setAuthUser(user);
      if (user) {
        const ref  = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: user.uid,
            displayName: user.displayName || user.email,
            email: user.email,
            photoURL: user.photoURL || null,
            platformRole: 'user',
            createdAt: serverTimestamp(),
          });
        }
        profileUnsubRef.current = onSnapshot(ref, (s) => {
          if (s.exists()) setUserProfile(s.data());
        });
      } else {
        setUserProfile(null);
        setSelectedTeamId(null);
      }
      setAuthLoading(false);
    });
  }, []);

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
    if (!authUser) { setUserMemberships([]); return; }
    const q = query(collection(db, 'memberships'), where('userId', '==', authUser.uid));
    return onSnapshot(q, (snap) => {
      setUserMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [authUser]);

  // All data for the selected team — resets when team changes
  useEffect(() => {
    if (!selectedTeamId) return;
    const unsubs = [];

    const sub = (q, setter, transform) =>
      unsubs.push(onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setter(transform ? transform(rows) : rows);
      }));

    sub(query(collection(db, 'memberships'),  where('teamId', '==', selectedTeamId)), setTeamMemberships);
    sub(query(collection(db, 'categories'),   where('teamId', '==', selectedTeamId)), setTeamCategories,
      (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)));
    sub(query(collection(db, 'merits'),       where('teamId', '==', selectedTeamId)), setTeamMerits);
    sub(query(collection(db, 'meritEvents'),  where('teamId', '==', selectedTeamId)), setTeamMeritEvents,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)));
    sub(query(collection(db, 'modules'),      where('teamId', '==', selectedTeamId)), setTeamModules,
      (rows) => [...rows].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    sub(query(collection(db, 'teamEvents'),   where('teamId', '==', selectedTeamId)), setTeamEvents,
      (rows) => [...rows].sort((a, b) => tsToDate(a.date) - tsToDate(b.date)));
    sub(query(collection(db, 'teamBoards'),   where('teamId', '==', selectedTeamId)), setTeamBoards);
    sub(query(collection(db, 'posts'),        where('teamId', '==', selectedTeamId)), setTeamPosts,
      (rows) => [...rows].sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)));
    sub(query(collection(db, 'comments'),     where('teamId', '==', selectedTeamId)), setTeamComments);
    sub(query(collection(db, 'teamMeetings'), where('teamId', '==', selectedTeamId)), setTeamMeetings);
    sub(query(collection(db, 'teamGoals'),    where('teamId', '==', selectedTeamId)), setTeamGoals);

    // Module attempts are filtered per user to respect Firestore rules
    if (authUser) {
      unsubs.push(onSnapshot(
        query(collection(db, 'moduleAttempts'),
          where('teamId', '==', selectedTeamId),
          where('userId', '==', authUser.uid),
        ),
        (snap) => setTeamModuleAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ));
    }

    return () => unsubs.forEach((u) => u());
  }, [selectedTeamId, authUser]);

  // ────────────────────────────────────────────────────────────────────────────
  // DERIVED STATE — permissions and computed data
  // ────────────────────────────────────────────────────────────────────────────

  const isPlatformAdmin = userProfile?.platformRole?.trim() === 'platformAdmin';

  const currentMembership = useMemo(() =>
    userMemberships.find((m) => m.teamId === selectedTeamId && m.status === 'active') || null,
    [userMemberships, selectedTeamId],
  );

  const memberRole = currentMembership?.role || null;

  // Preview mode overrides the effective role for UI rendering only
  const effectiveRole  = previewRole !== null ? previewRole : memberRole;
  const effectiveAdmin = previewRole !== null ? false        : isPlatformAdmin;

  const isAtLeastRookie = effectiveAdmin || atLeast(effectiveRole, 'rookie');
  const canEdit         = effectiveAdmin || effectiveRole === 'teamAdmin' || effectiveRole === 'facultyAdvisor';
  const canAward        = effectiveAdmin || atLeast(effectiveRole, 'leader');
  const canEditTools    = canEdit || atLeast(effectiveRole, 'leader');
  const isMember        = effectiveAdmin || Boolean(currentMembership);
  // Real permission level — unaffected by preview mode (used for UI controls)
  const isAdminLevel    = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor';

  const currentTeam = useMemo(
    () => allTeams.find((t) => t.id === selectedTeamId) || null,
    [allTeams, selectedTeamId],
  );

  const myTeams = useMemo(() => {
    const ids = new Set(userMemberships.map((m) => m.teamId));
    return allTeams.filter((t) => ids.has(t.id));
  }, [allTeams, userMemberships]);

  // Leaderboard — aggregated points per member for "this season" (last 3 months) and all-time
  const leaderboard = useMemo(() => {
    if (!selectedTeamId) return { allTime: [], season: [] };
    const now         = new Date();
    const seasonStart = new Date(now);
    seasonStart.setMonth(seasonStart.getMonth() - 3);

    const totalsAll = {}, totalsSeason = {};
    teamMeritEvents.forEach((evt) => {
      const ts = tsToDate(evt.createdAt);
      totalsAll[evt.membershipId]    = (totalsAll[evt.membershipId]    || 0) + (evt.points || 0);
      if (ts >= seasonStart) {
        totalsSeason[evt.membershipId] = (totalsSeason[evt.membershipId] || 0) + (evt.points || 0);
      }
    });

    const enrich = (map) =>
      Object.entries(map)
        .map(([membershipId, points]) => {
          const m   = teamMemberships.find((mm) => mm.id === membershipId);
          if (!m || m.status === 'suspended') return null;
          const cat = teamCategories.find((c) => c.id === m.categoryId);
          return { membershipId, name: m.displayName || 'Member', role: m.role, categoryName: cat?.name || 'Unassigned', points };
        })
        .filter(Boolean)
        .sort((a, b) => b.points - a.points);

    return { allTime: enrich(totalsAll), season: enrich(totalsSeason) };
  }, [teamMeritEvents, teamMemberships, teamCategories, selectedTeamId]);

  // ────────────────────────────────────────────────────────────────────────────
  // HANDLERS — all Firestore writes live here, passed down as props
  // ────────────────────────────────────────────────────────────────────────────

  // ── Auth ───────────────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert(e.message); }
  };

  const handleSignOut = () => { signOut(auth); setSelectedTeamId(null); };

  // ── Teams ──────────────────────────────────────────────────────────────────

  const handleCreateTeam = async (name) => {
    if (!isPlatformAdmin || !authUser || !userProfile) return;
    try {
      const teamRef = await addDoc(collection(db, 'teams'), {
        name,
        createdAt: serverTimestamp(),
        overview: { tagline: '', about: '', history: '', objectives: '', kpis: [] },
      });
      // Seed default categories
      for (const catName of ['Aspirants', 'Mechanics', 'Software', 'Sciences']) {
        await addDoc(collection(db, 'categories'), { teamId: teamRef.id, name: catName, description: '' });
      }
      // Seed a welcome module
      await addDoc(collection(db, 'modules'), {
        teamId: teamRef.id,
        title: 'Welcome to the Team',
        description: 'Start here before exploring anything else.',
        content: 'Read this module and answer the retrieval prompt below to get started.',
        videoUrl: '',
        retrievalPrompt: 'In 2–3 sentences, describe your goals for joining this team.',
        order: 0,
        createdAt: serverTimestamp(),
      });
      // Auto-join the creator as teamAdmin
      await setDoc(doc(db, 'memberships', `${authUser.uid}_${teamRef.id}`), {
        teamId: teamRef.id,
        userId: authUser.uid,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || null,
        role: 'teamAdmin',
        status: 'active',
        strikes: 0,
        categoryId: null,
        createdAt: serverTimestamp(),
      });
      setSelectedTeamId(teamRef.id);
      setView('overview');
    } catch (err) {
      alert(
        `Could not create team.\n\nFirebase said: ${err.message}\n\n` +
        `Most likely cause: your platformRole has a typo or leading space.\n` +
        `Open Firestore → users → your document → set platformRole to exactly: platformAdmin`,
      );
    }
  };

  // ── Memberships ────────────────────────────────────────────────────────────

  const handleJoinTeam = async (teamId, categoryId = null, motivation = '') => {
    if (!authUser || !userProfile) return;
    const existing = userMemberships.find((m) => m.teamId === teamId);
    if (existing) {
      if (existing.status === 'active') { setSelectedTeamId(teamId); setView('overview'); }
      return;
    }
    await setDoc(doc(db, 'memberships', `${authUser.uid}_${teamId}`), {
      teamId,
      userId:      authUser.uid,
      displayName: userProfile.displayName,
      photoURL:    userProfile.photoURL || null,
      role:        'aspirant',
      status:      'pending',    // awaiting admin approval
      strikes:     0,
      categoryId:  categoryId || null,
      motivation:  motivation || '',
      ghost:       false,
      ...EMPTY_PROFILE,
      createdAt:   serverTimestamp(),
    });
  };

  const handleApproveMember = async (membershipId) => {
    if (!canEdit) return;
    await updateDoc(doc(db, 'memberships', membershipId), { status: 'active' });
  };

  const handleRejectMember = async (membershipId) => {
    if (!canEdit) return;
    await deleteDoc(doc(db, 'memberships', membershipId));
  };

  const handleUpdateMemberRole = async (membershipId, newRole) => {
    if (!canEdit) return;
    await updateDoc(doc(db, 'memberships', membershipId), { role: newRole });
  };

  const handleAssignCategory = async (membershipId, categoryId) => {
    if (!canEdit) return;
    await updateDoc(doc(db, 'memberships', membershipId), { categoryId: categoryId || null });
  };

  const handleAddStrike = async (membershipId) => {
    if (!canEdit) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    const newStrikes = (m.strikes || 0) + 1;
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: newStrikes,
      ...(newStrikes >= 3 ? { status: 'suspended' } : {}),
    });
  };

  const handleRemoveStrike = async (membershipId) => {
    if (!canEdit) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: Math.max(0, (m.strikes || 0) - 1),
      status: 'active',
    });
  };

  const handleUpdateMemberProfile = async (membershipId, updates) => {
    if (!currentTeam) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    const canEditThis = isPlatformAdmin || memberRole === 'teamAdmin' || (authUser && m.userId === authUser.uid);
    if (!canEditThis) return;
    await updateDoc(doc(db, 'memberships', membershipId), {
      displayName:   updates.displayName   || m.displayName,
      photoURL:      updates.photoURL      || m.photoURL || null,
      coverPhotoURL: updates.coverPhotoURL || '',
      bio:           updates.bio           || '',
      hobbies:       updates.hobbies       || '',
      career:        updates.career        || '',
      semester:      updates.semester      || '',
      university:    updates.university    || '',
    });
    // Keep the open profile modal in sync without waiting for Firestore
    setProfileMember((prev) => prev?.id === membershipId ? { ...prev, ...updates } : prev);
  };

  const handleCreateGhostMember = async ({ displayName, role, categoryId, university, career, bio }) => {
    if (!currentTeam || !canEdit) return;
    await setDoc(doc(db, 'memberships', `ghost_${Date.now()}_${currentTeam.id}`), {
      teamId:       currentTeam.id,
      userId:       null,
      ghost:        true,
      displayName:  displayName || 'Faculty Member',
      role:         role || 'facultyAdvisor',
      categoryId:   categoryId || null,
      status:       'active',
      strikes:      0,
      photoURL:     null,
      coverPhotoURL: '',
      university:   university || '',
      career:       career     || '',
      bio:          bio        || '',
      hobbies:      '',
      semester:     '',
      createdAt:    serverTimestamp(),
    });
  };

  // ── Categories ─────────────────────────────────────────────────────────────

  const handleCreateCategory = async (name, description) => {
    if (!currentTeam || !canEdit) return;
    await addDoc(collection(db, 'categories'), { teamId: currentTeam.id, name, description });
  };

  const handleUpdateCategory = async (catId, name, description) => {
    if (!canEdit) return;
    await updateDoc(doc(db, 'categories', catId), { name, description });
  };

  const handleDeleteCategory = async (catId) => {
    if (!canEdit) return;
    await deleteDoc(doc(db, 'categories', catId));
    // Clear the deleted category from all affected memberships
    await Promise.all(
      teamMemberships
        .filter((m) => m.categoryId === catId)
        .map((m) => updateDoc(doc(db, 'memberships', m.id), { categoryId: null })),
    );
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  const handleSaveOverview = async (overview) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), { overview });
  };

  // ── Merits ─────────────────────────────────────────────────────────────────

  const handleCreateMerit = async (name, points, categoryId, logo, shortDescription, longDescription) => {
    if (!currentTeam) { alert('No team selected.'); return; }
    if (!canEdit)     { alert('No permission to create merits.'); return; }
    try {
      await addDoc(collection(db, 'merits'), {
        teamId: currentTeam.id,
        name,
        points:           Number(points),
        categoryId:       categoryId       || null,
        logo:             logo             || '🏆',
        shortDescription: shortDescription || '',
        longDescription:  longDescription  || '',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[Merit] Firestore error:', err);
      alert(`No se pudo guardar el mérito: ${err.message}\n\nVerifica las reglas de Firestore en FIREBASE_SETUP.md.`);
    }
  };

  const handleDeleteMerit = async (meritId) => {
    if (!canEdit) return;
    await deleteDoc(doc(db, 'merits', meritId));
  };

  const handleAwardMerit = async (membershipId, meritId, evidence) => {
    if (!currentTeam || !canAward) return;
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit) return;
    // Leaders may only award merits within their own category
    if (!canEdit && memberRole === 'leader' && !isPlatformAdmin) {
      if (merit.categoryId && merit.categoryId !== currentMembership?.categoryId) {
        alert('As a Leader, you can only award merits within your assigned category.');
        return;
      }
    }
    await addDoc(collection(db, 'meritEvents'), {
      teamId:               currentTeam.id,
      membershipId,
      meritId,
      meritName:            merit.name,
      points:               merit.points,
      type:                 'award',
      evidence:             evidence || '',
      createdByUserId:      authUser?.uid             || null,
      createdByMembershipId: currentMembership?.id    || null,
      createdAt:            serverTimestamp(),
    });
  };

  const handleRevokeMerit = async (eventId) => {
    if (!canEdit) return;
    const evt = teamMeritEvents.find((e) => e.id === eventId);
    if (!evt || evt.type !== 'award') return;
    // Delete the original award document so it cannot be revoked again
    await deleteDoc(doc(db, 'meritEvents', eventId));
  };

  const handleEditMeritEvent = async (eventId, { points, evidence }) => {
    if (!isPlatformAdmin) return;
    await updateDoc(doc(db, 'meritEvents', eventId), {
      points:       Number(points),
      evidence:     evidence || '',
      editedByUserId: authUser?.uid,
      editedAt:     serverTimestamp(),
    });
  };

  // ── Academy ────────────────────────────────────────────────────────────────

  const handleCreateModule = async (mod) => {
    if (!currentTeam || !canEdit) return;
    await addDoc(collection(db, 'modules'), { teamId: currentTeam.id, createdAt: serverTimestamp(), ...mod });
  };

  const handleUpdateModule = async (moduleId, updates) => {
    if (!canEdit) return;
    await updateDoc(doc(db, 'modules', moduleId), updates);
  };

  const handleDeleteModule = async (moduleId) => {
    if (!canEdit) return;
    await deleteDoc(doc(db, 'modules', moduleId));
  };

  const handleCompleteModule = async (moduleId, answer) => {
    if (!authUser || !currentMembership || !currentTeam) return;
    if (!answer.trim()) { alert('Please provide a response before completing.'); return; }
    await addDoc(collection(db, 'moduleAttempts'), {
      teamId:       currentTeam.id,
      moduleId,
      userId:       authUser.uid,
      membershipId: currentMembership.id,
      answer:       answer.trim(),
      completedAt:  serverTimestamp(),
    });
  };

  // ── Tools: shared permission helper ───────────────────────────────────────
  // Returns true if the current user may EDIT the given tool item.
  //   • Global item (categoryId == null) → any leader+ or admin
  //   • Category item → must be admin OR (leader assigned to that same category)
  const canEditToolItem = React.useCallback((item) => {
    if (!item) return false;
    if (canEdit) return true;                                    // admin always can
    if (!item.categoryId) return canEditTools;                  // global: leader+ is fine
    // Category-specific: must be a leader of that exact category
    return memberRole === 'leader' && currentMembership?.categoryId === item.categoryId;
  }, [canEdit, canEditTools, memberRole, currentMembership]);

  // Build the "last edited by" payload to stamp on every write
  const lastEditedStamp = React.useCallback(() => ({
    lastEditedBy:          userProfile?.displayName || authUser?.email || 'Unknown',
    lastEditedByUserId:    authUser?.uid || null,
    lastEditedAt:          serverTimestamp(),
  }), [userProfile, authUser]);

  // ── Tools: Calendar ────────────────────────────────────────────────────────

  const handleCreateEvent = async ({ title, date, description, categoryId }) => {
    if (!currentTeam) return;
    // Resolve permission: global events need canEditTools, category events need canEditToolItem
    const fakeItem = { categoryId: categoryId || null };
    if (!canEditToolItem(fakeItem)) return;
    await addDoc(collection(db, 'teamEvents'), {
      teamId:      currentTeam.id,
      title,
      date:        new Date(date),
      description: description || '',
      categoryId:  categoryId  || null,
      createdBy:   authUser?.uid,
      createdAt:   serverTimestamp(),
      ...lastEditedStamp(),
    });
  };

  const handleDeleteEvent = async (eventId) => {
    const evt = teamEvents.find((e) => e.id === eventId);
    if (!canEditToolItem(evt)) return;
    await deleteDoc(doc(db, 'teamEvents', eventId));
  };

  // ── Tools: SWOT ────────────────────────────────────────────────────────────
  // SWOT is always global (stored on the team document)

  const handleUpdateSwot = async (swot) => {
    if (!currentTeam || !canEditTools) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      swot,
      ...lastEditedStamp(),
    });
  };

  // ── Tools: Boards (Kanban / SCRUM / Retro) ─────────────────────────────────

  const handleCreateBoard = async (name, boardType = 'kanban', defaultColumns = null, categoryId = null) => {
    const fakeItem = { categoryId: categoryId || null };
    if (!currentTeam || !canEditToolItem(fakeItem)) return;
    await addDoc(collection(db, 'teamBoards'), {
      teamId:     currentTeam.id,
      name,
      boardType,
      categoryId: categoryId || null,
      columns: defaultColumns || [
        { id: 'todo',       name: 'To Do',      cards: [] },
        { id: 'inprogress', name: 'In Progress', cards: [] },
        { id: 'done',       name: 'Done',        cards: [] },
      ],
      createdAt: serverTimestamp(),
      ...lastEditedStamp(),
    });
  };

  const handleUpdateBoard = async (boardId, updates) => {
    const board = teamBoards.find((b) => b.id === boardId);
    if (!canEditToolItem(board)) return;
    await updateDoc(doc(db, 'teamBoards', boardId), { ...updates, ...lastEditedStamp() });
  };

  const handleDeleteBoard = async (boardId) => {
    const board = teamBoards.find((b) => b.id === boardId);
    if (!canEditToolItem(board)) return;
    await deleteDoc(doc(db, 'teamBoards', boardId));
  };

  // ── Tools: Meetings ────────────────────────────────────────────────────────

  const handleCreateMeeting = async (data) => {
    const fakeItem = { categoryId: data.categoryId || null };
    if (!currentTeam || !canEditToolItem(fakeItem)) return;
    await addDoc(collection(db, 'teamMeetings'), {
      teamId: currentTeam.id,
      ...data,
      categoryId: data.categoryId || null,
      createdAt: serverTimestamp(),
      ...lastEditedStamp(),
    });
  };
  const handleUpdateMeeting = async (id, updates) => {
    const meeting = teamMeetings.find((m) => m.id === id);
    if (!canEditToolItem(meeting)) return;
    await updateDoc(doc(db, 'teamMeetings', id), { ...updates, ...lastEditedStamp() });
  };
  const handleDeleteMeeting = async (id) => {
    const meeting = teamMeetings.find((m) => m.id === id);
    if (!canEditToolItem(meeting)) return;
    await deleteDoc(doc(db, 'teamMeetings', id));
  };

  // ── Tools: Goals / OKRs ────────────────────────────────────────────────────

  const handleCreateGoal = async (data) => {
    const fakeItem = { categoryId: data.categoryId || null };
    if (!currentTeam || !canEditToolItem(fakeItem)) return;
    await addDoc(collection(db, 'teamGoals'), {
      teamId: currentTeam.id,
      ...data,
      categoryId: data.categoryId || null,
      createdAt: serverTimestamp(),
      ...lastEditedStamp(),
    });
  };
  const handleUpdateGoal = async (id, updates) => {
    const goal = teamGoals.find((g) => g.id === id);
    if (!canEditToolItem(goal)) return;
    await updateDoc(doc(db, 'teamGoals', id), { ...updates, ...lastEditedStamp() });
  };
  const handleDeleteGoal = async (id) => {
    const goal = teamGoals.find((g) => g.id === id);
    if (!canEditToolItem(goal)) return;
    await deleteDoc(doc(db, 'teamGoals', id));
  };

  // ── Feed ───────────────────────────────────────────────────────────────────

  const handleCreatePost = async (content, imageUrl = null) => {
    if (!authUser || !currentTeam || !isMember) return;
    await addDoc(collection(db, 'posts'), {
      teamId:      currentTeam.id,
      content,
      ...(imageUrl ? { imageUrl } : {}),
      authorId:    authUser.uid,
      authorName:  userProfile?.displayName || 'Member',
      authorPhoto: userProfile?.photoURL    || null,
      createdAt:   serverTimestamp(),
    });
  };

  const handleDeletePost = async (postId) => {
    if (!authUser) return;
    const post = teamPosts.find((p) => p.id === postId);
    if (!post) return;
    if (post.authorId !== authUser.uid && !canEdit) return;
    await deleteDoc(doc(db, 'posts', postId));
  };

  const handleCreateComment = async (postId, content) => {
    if (!authUser || !currentTeam || !isMember) return;
    await addDoc(collection(db, 'comments'), {
      teamId:      currentTeam.id,
      postId,
      content,
      authorId:    authUser.uid,
      authorName:  userProfile?.displayName || 'Member',
      authorPhoto: userProfile?.photoURL    || null,
      createdAt:   serverTimestamp(),
    });
  };

  const handleDeleteComment = async (commentId) => {
    if (!authUser) return;
    const comment = teamComments.find((c) => c.id === commentId);
    if (!comment) return;
    if (comment.authorId !== authUser.uid && !canEdit) return;
    await deleteDoc(doc(db, 'comments', commentId));
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ────────────────────────────────────────────────────────────────────────────

  /** EN / ES toggle pill — used in every screen header */
  const LangToggle = () => (
    <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5 shrink-0">
      {['en', 'es'].map((l) => (
        <button key={l} onClick={() => handleSetLang(l)}
          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
            lang === l ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const handleViewProfile = (membership) => setProfileMember(membership);

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-400 text-sm">{t('loading')}</div>
        </div>
      </LangContext.Provider>
    );
  }

  // ── Unauthenticated — public team browser ──────────────────────────────────
  if (!authUser) {
    return (
      <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">{t('app_name')}</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">{t('app_subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LangToggle />
              <button onClick={handleGoogleSignIn}
                className="flex items-center gap-2 bg-white text-slate-900 text-xs sm:text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                <GoogleIcon />
                <span className="hidden sm:inline">{t('sign_in_google')}</span>
                <span className="sm:hidden">{t('sign_in_short')}</span>
              </button>
            </div>
          </header>
          <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
            <p className="text-slate-400 text-sm mb-5">{t('sign_in_google')} — {t('app_subtitle')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allTeams.map((team) => (
                <div key={team.id} className="bg-slate-800 rounded-xl p-4 space-y-2">
                  <h2 className="font-bold text-base">{team.name}</h2>
                  {team.overview?.tagline && <p className="text-sm text-slate-300 italic">"{team.overview.tagline}"</p>}
                  {team.overview?.about   && <p className="text-xs text-slate-400 line-clamp-3">{team.overview.about}</p>}
                  <button onClick={handleGoogleSignIn}
                    className="mt-1 text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
                    {t('sign_in_google')}
                  </button>
                </div>
              ))}
              {allTeams.length === 0 && (
                <div className="col-span-2 text-center text-slate-500 text-sm py-12">{t('no_teams_sign_in')}</div>
              )}
            </div>
          </main>
        </div>
      </LangContext.Provider>
    );
  }

  // ── Authenticated, no team selected — team picker ──────────────────────────
  if (!selectedTeamId) {
    const joinedIds      = new Set(userMemberships.map((m) => m.teamId));
    const otherTeams     = allTeams.filter((t) => !joinedIds.has(t.id));
    const activeMyTeams  = myTeams.filter((t) => { const m = userMemberships.find((m) => m.teamId === t.id); return m?.status === 'active' || m?.status === 'suspended'; });
    const pendingMyTeams = myTeams.filter((t) => { const m = userMemberships.find((m) => m.teamId === t.id); return m?.status === 'pending'; });

    return (
      <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          {joinTarget && (
            <JoinRequestModal
              team={joinTarget}
              categories={allTeamCategories[joinTarget.id] || []}
              onSubmit={(categoryId, motivation) => { handleJoinTeam(joinTarget.id, categoryId, motivation); setJoinTarget(null); }}
              onCancel={() => setJoinTarget(null)}
            />
          )}

          <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight">{t('app_name')}</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">{t('app_subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <LangToggle />
              {userProfile?.photoURL && <img src={userProfile.photoURL} className="w-7 h-7 rounded-full" alt="" />}
              <span className="text-sm text-slate-200 hidden sm:inline">{userProfile?.displayName}</span>
              {isPlatformAdmin && (
                <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                  {t('platform_admin')}
                </span>
              )}
              <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-white underline">{t('sign_out')}</button>
            </div>
          </header>

          <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
            {activeMyTeams.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('your_teams')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeMyTeams.map((team) => {
                    const mem = userMemberships.find((m) => m.teamId === team.id);
                    return (
                      <button key={team.id} onClick={() => { setSelectedTeamId(team.id); setView('overview'); }}
                        className="bg-slate-800 rounded-xl p-4 text-left hover:bg-slate-700 transition-colors space-y-1 active:scale-95">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm">{team.name}</h3>
                          {mem && <RoleBadge role={mem.role} />}
                        </div>
                        {team.overview?.tagline && <p className="text-xs text-slate-400 italic">"{team.overview.tagline}"</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingMyTeams.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('pending_requests')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pendingMyTeams.map((team) => {
                    const mem = userMemberships.find((m) => m.teamId === team.id);
                    const cat = (allTeamCategories[team.id] || []).find((c) => c.id === mem?.categoryId);
                    return (
                      <div key={team.id} className="bg-slate-800/60 border border-amber-600/30 rounded-xl p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-bold text-sm">{team.name}</h3>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                            {t('awaiting_approval')}
                          </span>
                        </div>
                        {cat && <p className="text-xs text-slate-400">{t('requested_category')}: <span className="text-slate-200">{cat.name}</span></p>}
                        {mem?.motivation && <p className="text-xs text-slate-500 italic">"{mem.motivation}"</p>}
                        <p className="text-[11px] text-slate-600">{t('review_shortly')}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {otherTeams.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('join_a_team')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {otherTeams.map((team) => (
                    <div key={team.id} className="bg-slate-800 rounded-xl p-4 space-y-2">
                      <h3 className="font-bold text-sm">{team.name}</h3>
                      {team.overview?.tagline && <p className="text-xs text-slate-400 italic">"{team.overview.tagline}"</p>}
                      {team.overview?.about   && <p className="text-xs text-slate-500 line-clamp-2">{team.overview.about}</p>}
                      <button onClick={() => setJoinTarget(team)}
                        className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
                        {t('request_to_join')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPlatformAdmin && (
              <div className="bg-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold mb-3">{t('create_new_team')}</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleCreateTeam(e.target.name.value); e.target.reset(); }}
                  className="flex gap-2">
                  <input name="name" placeholder={t('team_name_placeholder')} required
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                  <button type="submit" className="px-4 py-2 bg-emerald-500 text-black text-xs font-semibold rounded">
                    {t('create')}
                  </button>
                </form>
              </div>
            )}

            {activeMyTeams.length === 0 && pendingMyTeams.length === 0 && otherTeams.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-12">{t('no_teams')}</div>
            )}
          </main>
        </div>
      </LangContext.Provider>
    );
  }

  // ── Main app shell (team selected) ─────────────────────────────────────────

  const navItems = [
    { id: 'overview',    label: t('nav_overview'),    icon: '◎' },
    ...(isAtLeastRookie ? [
      { id: 'feed',        label: t('nav_feed'),        icon: '◷' },
      { id: 'categories',  label: t('nav_categories'),  icon: '⊞' },
      { id: 'members',     label: t('nav_members'),     icon: '◉' },
      { id: 'merits',      label: t('nav_merits'),      icon: '★' },
      { id: 'leaderboard', label: t('nav_leaderboard'), icon: '▲' },
      { id: 'tools',       label: t('nav_tools'),       icon: '⊙' },
      { id: 'academy',     label: t('nav_academy'),     icon: '◈' },
    ] : []),
    ...(currentMembership ? [{ id: 'myprofile', label: t('nav_myprofile'), icon: '☺' }] : []),
  ];

  return (
    <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">

        {/* ── Profile modal ── */}
        {profileMember && (
          <ProfileModal
            membership={profileMember}
            categories={teamCategories}
            canEditThis={isPlatformAdmin || memberRole === 'teamAdmin' || (authUser && profileMember.userId === authUser.uid)}
            onClose={() => setProfileMember(null)}
            onSave={handleUpdateMemberProfile}
          />
        )}

        {/* ── Mobile nav overlay ── */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <nav className="relative z-50 w-56 bg-slate-950 border-r border-slate-800 p-3 space-y-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">{currentTeam?.name}</span>
                <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>
              {navItems.map((tab) => (
                <button key={tab.id} onClick={() => { setView(tab.id); setMobileNavOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded flex items-center gap-2 text-sm transition-colors
                    ${view === tab.id ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <span className="text-base shrink-0 w-5 text-center">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
              <div className="pt-3 border-t border-slate-800 space-y-2 mt-2">
                <LangToggle />
                <button onClick={() => { setSelectedTeamId(null); setPreviewRole(null); setMobileNavOpen(false); }}
                  className="w-full text-left text-xs text-slate-400 hover:text-white px-2 py-1.5">
                  ← {t('switch_team')}
                </button>
                <button onClick={handleSignOut} className="w-full text-left text-xs text-slate-400 hover:text-white px-2 py-1.5">
                  {t('sign_out')}
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* ── Header ── */}
        <header className="border-b border-slate-800 px-3 py-2.5 flex items-center justify-between shrink-0 bg-slate-950/60 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors text-xl shrink-0">
              ☰
            </button>
            {/* Desktop sidebar collapse toggle */}
            <button onClick={() => setNavCollapsed((c) => !c)}
              className="hidden md:flex text-slate-400 hover:text-white w-7 h-7 items-center justify-center rounded hover:bg-slate-800 transition-colors text-lg shrink-0"
              title={navCollapsed ? t('expand_menu') : t('collapse_menu')}>
              {navCollapsed ? '›' : '‹'}
            </button>
            <span className="font-bold text-sm truncate">{currentTeam?.name}</span>
            {currentMembership && !previewRole && <span className="hidden sm:inline"><RoleBadge role={currentMembership.role} /></span>}
            {isPlatformAdmin && !previewRole && (
              <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                {t('platform_admin')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LangToggle />
            {/* Preview mode controls */}
            {isAdminLevel && (
              previewRole ? (
                <button onClick={() => setPreviewRole(null)}
                  className="text-xs bg-amber-500 text-black font-semibold px-2 py-1.5 rounded flex items-center gap-1">
                  ◉ <span className="hidden sm:inline">{t('exit_preview')}</span>
                </button>
              ) : (
                <select onChange={(e) => setPreviewRole(e.target.value || null)} defaultValue=""
                  className="text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded px-2 py-1.5 hidden sm:block">
                  <option value="">{t('preview_as')}</option>
                  {['aspirant', 'rookie', 'junior', 'senior', 'leader'].map((r) => (
                    <option key={r} value={r}>{t('role_' + r)}</option>
                  ))}
                </select>
              )
            )}
            {/* Profile avatar button */}
            <button onClick={() => currentMembership && handleViewProfile(currentMembership)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity" title={t('view_profile')}>
              {(currentMembership?.photoURL || userProfile?.photoURL) ? (
                <img src={currentMembership?.photoURL || userProfile?.photoURL}
                  className="w-8 h-8 rounded-full object-cover border-2 border-slate-600 hover:border-emerald-500 transition-colors" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-500 flex items-center justify-center text-sm font-bold">
                  {(userProfile?.displayName || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-300 hidden lg:inline">{currentMembership?.displayName || userProfile?.displayName}</span>
            </button>
            <button onClick={() => { setSelectedTeamId(null); setPreviewRole(null); }}
              className="text-xs text-slate-400 hover:text-white transition-colors hidden sm:block">
              {t('switch_team')}
            </button>
            <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-white transition-colors hidden sm:block">
              {t('sign_out')}
            </button>
          </div>
        </header>

        {/* ── Preview mode banner ── */}
        {previewRole && (
          <div className="bg-amber-500 text-black text-xs font-semibold px-4 py-2 flex items-center justify-between shrink-0">
            <span className="truncate">{t('preview_banner')(t('role_' + previewRole))}</span>
            <button onClick={() => setPreviewRole(null)} className="underline ml-3 shrink-0">{t('exit_preview')}</button>
          </div>
        )}

        {/* ── App body: sidebar + main ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Desktop sidebar */}
          <nav className={`hidden md:block ${navCollapsed ? 'w-11' : 'w-44'} border-r border-slate-800 p-2 space-y-1 shrink-0 transition-all duration-200 overflow-hidden bg-slate-950/40`}>
            {navItems.map((tab) => (
              <button key={tab.id} onClick={() => setView(tab.id)}
                className={`w-full text-left px-2 py-2 rounded flex items-center gap-2 text-sm transition-colors
                  ${view === tab.id ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>
                <span className="text-base shrink-0 w-5 text-center">{tab.icon}</span>
                {!navCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            ))}
          </nav>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-5">
            {view === 'overview' && (
              <OverviewView
                team={currentTeam}
                teamMemberships={teamMemberships}
                teamMeritEvents={teamMeritEvents}
                teamModules={teamModules}
                canEdit={canEdit}
                onSave={handleSaveOverview}
              />
            )}

            {view === 'feed' && isAtLeastRookie && (
              <FeedView
                posts={teamPosts}
                comments={teamComments}
                authUser={authUser}
                canEdit={canEdit}
                memberships={teamMemberships}
                onCreatePost={handleCreatePost}
                onDeletePost={handleDeletePost}
                onCreateComment={handleCreateComment}
                onDeleteComment={handleDeleteComment}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'categories' && isAtLeastRookie && (
              <CategoriesView
                categories={teamCategories}
                memberships={teamMemberships}
                canEdit={canEdit}
                onCreateCategory={handleCreateCategory}
                onDeleteCategory={handleDeleteCategory}
                onUpdateCategory={handleUpdateCategory}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'members' && isAtLeastRookie && (
              <MembersView
                categories={teamCategories}
                memberships={teamMemberships}
                canEdit={canEdit}
                isPlatformAdmin={isPlatformAdmin}
                onUpdateRole={handleUpdateMemberRole}
                onAssignCategory={handleAssignCategory}
                onAddStrike={handleAddStrike}
                onRemoveStrike={handleRemoveStrike}
                onViewProfile={handleViewProfile}
                onCreateGhostMember={handleCreateGhostMember}
                onApproveMember={handleApproveMember}
                onRejectMember={handleRejectMember}
              />
            )}

            {view === 'merits' && isAtLeastRookie && (
              <MeritsView
                merits={teamMerits}
                categories={teamCategories}
                memberships={teamMemberships}
                meritEvents={teamMeritEvents}
                canEdit={canEdit}
                canAward={canAward}
                currentMembership={currentMembership}
                memberRole={memberRole}
                isPlatformAdmin={isPlatformAdmin}
                onCreateMerit={handleCreateMerit}
                onDeleteMerit={handleDeleteMerit}
                onAwardMerit={handleAwardMerit}
                onRevokeMerit={handleRevokeMerit}
                onEditMeritEvent={handleEditMeritEvent}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'leaderboard' && isAtLeastRookie && (
              <LeaderboardView
                leaderboard={leaderboard}
                memberships={teamMemberships}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'tools' && isAtLeastRookie && (
              <ToolsView
                team={currentTeam}
                teamEvents={teamEvents}
                teamBoards={teamBoards}
                teamMeetings={teamMeetings}
                teamGoals={teamGoals}
                categories={teamCategories}
                currentMembership={currentMembership}
                memberRole={memberRole}
                canEdit={canEdit}
                canEditTools={canEditTools}
                resolveCanEdit={canEditToolItem}
                onCreateEvent={handleCreateEvent}
                onDeleteEvent={handleDeleteEvent}
                onUpdateSwot={handleUpdateSwot}
                onCreateBoard={handleCreateBoard}
                onUpdateBoard={handleUpdateBoard}
                onDeleteBoard={handleDeleteBoard}
                onCreateMeeting={handleCreateMeeting}
                onUpdateMeeting={handleUpdateMeeting}
                onDeleteMeeting={handleDeleteMeeting}
                onCreateGoal={handleCreateGoal}
                onUpdateGoal={handleUpdateGoal}
                onDeleteGoal={handleDeleteGoal}
              />
            )}

            {view === 'academy' && isAtLeastRookie && (
              <AcademyView
                modules={teamModules}
                moduleAttempts={teamModuleAttempts}
                canEdit={canEdit}
                onCreateModule={handleCreateModule}
                onUpdateModule={handleUpdateModule}
                onDeleteModule={handleDeleteModule}
                onCompleteModule={handleCompleteModule}
              />
            )}

            {/* My Profile — shortcut to open own profile modal */}
            {view === 'myprofile' && currentMembership && (
              <div className="max-w-lg space-y-4">
                <h2 className="text-base font-semibold">{t('my_profile_title')}</h2>
                <p className="text-xs text-slate-400">{t('profile_visible')}</p>
                <button onClick={() => setProfileMember(currentMembership)}
                  className="w-full bg-slate-800 rounded-lg p-4 text-left hover:bg-slate-700 transition-colors active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    {currentMembership.photoURL ? (
                      <img src={currentMembership.photoURL} className="w-12 h-12 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-xl font-bold">
                        {(currentMembership.displayName || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{currentMembership.displayName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {currentMembership.career     || t('no_career')} · {currentMembership.university || t('no_university')}
                      </div>
                      <div className="text-xs text-emerald-400 mt-1">{t('click_to_edit')}</div>
                    </div>
                  </div>
                  {currentMembership.bio
                    ? <p className="text-sm text-slate-300 mt-3 line-clamp-2">{currentMembership.bio}</p>
                    : <p className="text-xs text-slate-600 mt-3 italic">{t('no_bio')}</p>
                  }
                </button>
              </div>
            )}
          </main>
        </div>

        {/* ── Mobile bottom nav bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex items-center justify-around px-1 py-1 z-30">
          {navItems.slice(0, 5).map((tab) => (
            <button key={tab.id} onClick={() => setView(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded flex-1 transition-colors
                ${view === tab.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[9px] leading-none truncate">{tab.label}</span>
            </button>
          ))}
          <button onClick={() => setMobileNavOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded flex-1 text-slate-500 hover:text-slate-300">
            <span className="text-lg leading-none">⋯</span>
            <span className="text-[9px] leading-none">{t('more_btn')}</span>
          </button>
        </nav>
        {/* Spacer so content isn't hidden behind the mobile nav */}
        <div className="md:hidden h-14 shrink-0" />

      </div>
    </LangContext.Provider>
  );
}
