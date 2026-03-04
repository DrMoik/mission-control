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
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db, googleProvider }         from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  addDoc, query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

// Default achievements for platform usage
const POINTS_PER_WEEKLY_UPDATE = 5;
const MILESTONE_50_POINTS = 100;

/** Returns true if weekOf (YYYY-MM-DD) is the current week or previous week (late submission). */
function isWeekEligibleForPoints(weekOf) {
  if (!weekOf || typeof weekOf !== 'string') return false;
  const d = new Date();
  const day = d.getDay() || 7; // Sun=0 → treat as 7
  d.setDate(d.getDate() - (day - 1));
  const thisMonday = d.toISOString().split('T')[0];
  d.setDate(d.getDate() - 7);
  const lastMonday = d.toISOString().split('T')[0];
  return weekOf === thisMonday || weekOf === lastMonday;
}

// ── Internal modules ──────────────────────────────────────────────────────────
import TRANSLATIONS                from './i18n/translations.js';
import LangContext                 from './i18n/LangContext.js';
import { EMPTY_PROFILE, COLLAB_TAG_SUGGESTIONS, MERIT_ACHIEVEMENT_TYPES, MERIT_DOMAINS } from './constants.js';
import { atLeast, tsToDate, getL, ensureString, compressDataUrlIfNeeded } from './utils.js';

// ── Shared UI atoms ───────────────────────────────────────────────────────────
import { RoleBadge, GoogleIcon }   from './components/ui/index.js';

// ── Modals ────────────────────────────────────────────────────────────────────
import ProfilePageView            from './views/ProfilePageView.jsx';
import JoinRequestModal            from './components/JoinRequestModal.jsx';
import PlatformConfigSection       from './components/PlatformConfigSection.jsx';

// ── Full-page views ───────────────────────────────────────────────────────────
import OverviewView                from './views/OverviewView.jsx';
import CategoriesView              from './views/CategoriesView.jsx';
import MembersView                 from './views/MembersView.jsx';
import MeritsView                  from './views/MeritsView.jsx';
import LeaderboardView             from './views/LeaderboardView.jsx';
import ToolsView                   from './views/ToolsView.jsx';
import AcademyView                 from './views/AcademyView.jsx';
import FeedView                    from './views/FeedView.jsx';
import FundingView                 from './views/FundingView.jsx';

// Standard hamburger menu icon (three horizontal bars)
function HamburgerIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ── InlineTeamRename ──────────────────────────────────────────────────────────
// Small component rendered in the app header so platform admins can
// rename or delete the currently-open team without leaving the page.
function InlineTeamRename({ team, isPlatformAdmin, onRename, onDelete, t }) {
  const [editing,  setEditing]  = React.useState(false);
  const [value,    setValue]    = React.useState('');

  if (!team) return null;

  if (!isPlatformAdmin) {
    return <span className="font-bold text-sm truncate">{team.name}</span>;
  }

  const start = () => { setValue(team.name); setEditing(true); };
  const commit = () => { onRename(team.id, value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="px-2 py-1 bg-slate-800 border border-emerald-600 rounded text-sm font-bold w-44"
        />
        <button onClick={commit}
          className="text-[11px] bg-emerald-500 text-black font-semibold px-2 py-1 rounded">
          {t('save')}
        </button>
        <button onClick={() => setEditing(false)} className="text-[11px] text-slate-400 underline">
          {t('cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-bold text-sm truncate">{team.name}</span>
      <button onClick={start}
        title={t('rename_team')}
        className="text-slate-500 hover:text-amber-400 transition-colors text-xs shrink-0"
      >
        …
      </button>
      <button onClick={() => onDelete(team.id)}
        title={t('delete_team')}
        className="text-slate-500 hover:text-red-400 transition-colors text-xs shrink-0"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {

  // ── Language ───────────────────────────────────────────────────────────────
  // Spanish only for now. Bilingual toggle commented out — will deal with that later.
  const lang = 'es';
  const t = React.useCallback(
    (key) => TRANSLATIONS.es?.[key] ?? key,
    [],
  );
  // const [lang, setLang] = useState(() => localStorage.getItem('mc_lang') || 'es');
  // const handleSetLang = (l) => { setLang(l); localStorage.setItem('mc_lang', l); };

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
  const [teamWeeklyStatuses,  setTeamWeeklyStatuses]  = useState([]);
  const [teamFundingAccounts,  setTeamFundingAccounts]  = useState([]);
  const [teamFundingEntries,  setTeamFundingEntries]  = useState([]);
  const [platformConfig,      setPlatformConfig]      = useState(null);       // { achievementTypes, domains }

  // ── UI state ───────────────────────────────────────────────────────────────
  const [navCollapsed,   setNavCollapsed]   = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [previewRole,    setPreviewRole]    = useState(null);   // admin "preview as role" simulation
  const [renamingTeamId, setRenamingTeamId] = useState(null);  // team picker inline rename
  const [renameValue,    setRenameValue]    = useState('');

  // Routing — derive view and profileMember from URL when team is selected
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = (location.pathname || '/').replace(/^\/+|\/+$/g, '') || 'overview';
  const pathParts = pathname.split('/').filter(Boolean);
  const routeView = pathParts[0] || 'overview';  // first segment: overview, feed, profile, etc.
  const profileMemberId = routeView === 'profile' && pathParts[1] ? pathParts[1] : null;
  const view = routeView === 'profile' && !profileMemberId ? 'myprofile' : (routeView === 'profile' ? 'profile' : routeView);
  const profileMember = profileMemberId
    ? teamMemberships.find((m) => m.id === profileMemberId) || null
    : null;

  const validViews = new Set(['overview', 'feed', 'categories', 'members', 'merits', 'leaderboard', 'tools', 'academy', 'funding', 'myprofile', 'profile']);
  const isViewValid = validViews.has(view);

  // Redirect invalid paths to /overview (only when team is selected, to avoid running in team picker)
  useEffect(() => {
    if (selectedTeamId && !isViewValid) navigate('/overview', { replace: true });
  }, [selectedTeamId, isViewValid, navigate]);

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

  // Platform config (achievement types, domains) — readable by all; editable by platform admin
  useEffect(() => {
    if (!authUser) { setPlatformConfig(null); return; }
    return onSnapshot(doc(db, 'platformConfig', 'config'), (snap) => {
      setPlatformConfig(snap.exists() ? snap.data() : null);
    }, () => setPlatformConfig(null));
  }, [authUser]);

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
    sub(query(collection(db, 'teamMeetings'),    where('teamId', '==', selectedTeamId)), setTeamMeetings);
    sub(query(collection(db, 'teamGoals'),       where('teamId', '==', selectedTeamId)), setTeamGoals);
    sub(query(collection(db, 'weeklyStatuses'),  where('teamId', '==', selectedTeamId)), setTeamWeeklyStatuses,
      (rows) => [...rows].sort((a, b) => (b.weekOf || '').localeCompare(a.weekOf || '')));
    sub(query(collection(db, 'teamFundingAccounts'), where('teamId', '==', selectedTeamId)), setTeamFundingAccounts,
      (rows) => [...rows].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    sub(query(collection(db, 'teamFundingEntries'), where('teamId', '==', selectedTeamId)), setTeamFundingEntries,
      (rows) => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '')));

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
  // Leaders can create logros only for their category; admins can create any
  const canCreateMerit  = canEdit || (memberRole === 'leader' && currentMembership?.categoryId);
  const isMember        = effectiveAdmin || Boolean(currentMembership);
  // Real permission level — unaffected by preview mode (used for UI controls)
  const isAdminLevel    = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor';

  const currentTeam = useMemo(
    () => allTeams.find((t) => t.id === selectedTeamId) || null,
    [allTeams, selectedTeamId],
  );

  // Platform config overrides constants for merit tags; defaults used when creating teams
  const meritAchievementTypes = (platformConfig?.achievementTypes?.length ? platformConfig.achievementTypes : MERIT_ACHIEVEMENT_TYPES);
  const meritDomains         = (platformConfig?.domains?.length ? platformConfig.domains : MERIT_DOMAINS);

  const myTeams = useMemo(() => {
    const ids = new Set(userMemberships.map((m) => m.teamId));
    return allTeams.filter((t) => ids.has(t.id));
  }, [allTeams, userMemberships]);

  // All collaboration tags (team + predefined) — for TagInput dropdown to avoid duplicates
  const collabTagSuggestions = useMemo(() => {
    const set = new Set(COLLAB_TAG_SUGGESTIONS);
    const add = (t) => { const s = typeof t === 'string' ? t : (t?.es || t?.en || ''); if (s.trim()) set.add(s.trim()); };
    teamMemberships.forEach((m) => {
      (m.lookingForHelpIn || []).forEach(add);
      (m.iCanHelpWith || []).forEach(add);
      (m.skillsToLearnThisSemester || []).forEach(add);
      (m.skillsICanTeach || []).forEach(add);
    });
    return [...set].sort();
  }, [teamMemberships]);

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
      navigate('/overview');
    } catch (err) {
      alert(
        `Could not create team.\n\nFirebase said: ${err.message}\n\n` +
        `Most likely cause: your platformRole has a typo or leading space.\n` +
        `Open Firestore → users → your document → set platformRole to exactly: platformAdmin`,
      );
    }
  };

  const handleRenameTeam = async (teamId, newName) => {
    if (!isPlatformAdmin) return;
    const name = newName.trim();
    if (!name) return;
    await updateDoc(doc(db, 'teams', teamId), { name });
  };

  const handleDeleteTeam = async (teamId) => {
    if (!isPlatformAdmin) return;
    const team = allTeams.find((t) => t.id === teamId);
    const confirmed = window.confirm(
      `Delete team "${team?.name}"?\n\n` +
      `This removes the team record. Member data, categories, merits, and other ` +
      `team collections must be cleaned up in the Firestore console separately.\n\n` +
      `This cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteDoc(doc(db, 'teams', teamId));
    // If we were inside the deleted team, return to the picker
    if (selectedTeamId === teamId) setSelectedTeamId(null);
  };

  const handleSavePlatformConfig = async (achievementTypes, domains) => {
    if (!isPlatformAdmin) return;
    const ref = doc(db, 'platformConfig', 'config');
    const data = {
      achievementTypes: Array.isArray(achievementTypes) ? achievementTypes.filter(Boolean) : MERIT_ACHIEVEMENT_TYPES,
      domains:          Array.isArray(domains)          ? domains.filter(Boolean)          : MERIT_DOMAINS,
      updatedAt:       serverTimestamp(),
    };
    await setDoc(ref, data, { merge: true });
  };

  // ── Memberships ────────────────────────────────────────────────────────────

  const handleJoinTeam = async (teamId, categoryId = null, motivation = '') => {
    if (!authUser || !userProfile) return;
    const existing = userMemberships.find((m) => m.teamId === teamId);
    if (existing) {
      if (existing.status === 'active') { setSelectedTeamId(teamId); navigate('/overview'); }
      return;
    }
    // Copy profile from another membership if user has one (shared profile across teams)
    const otherMembership = userMemberships.find((m) => m.userId === authUser.uid && m.teamId !== teamId);
    const profileSeed = otherMembership ? {
      displayName:   otherMembership.displayName   || userProfile.displayName,
      photoURL:      otherMembership.photoURL      ?? userProfile.photoURL ?? null,
      coverPhotoURL: otherMembership.coverPhotoURL ?? '',
      bio:           otherMembership.bio           ?? '',
      hobbies:       otherMembership.hobbies       ?? '',
      career:        otherMembership.career        ?? '',
      semester:      otherMembership.semester      ?? '',
      university:    otherMembership.university    ?? '',
      email:         otherMembership.email         ?? '',
      currentObjective: otherMembership.currentObjective ?? '',
      currentChallenge: otherMembership.currentChallenge ?? '',
      lookingForHelpIn:  otherMembership.lookingForHelpIn ?? [],
      iCanHelpWith:      otherMembership.iCanHelpWith ?? [],
      skillsToLearnThisSemester: otherMembership.skillsToLearnThisSemester ?? [],
      skillsICanTeach:   otherMembership.skillsICanTeach ?? [],
      songOnRepeatTitle: otherMembership.songOnRepeatTitle ?? '',
      songOnRepeatUrl:   otherMembership.songOnRepeatUrl ?? '',
      funFact:           otherMembership.funFact ?? '',
      personalityTag:    otherMembership.personalityTag ?? '',
    } : { displayName: userProfile.displayName, photoURL: userProfile.photoURL || null, ...EMPTY_PROFILE };
    await setDoc(doc(db, 'memberships', `${authUser.uid}_${teamId}`), {
      teamId,
      userId:      authUser.uid,
      role:        'aspirant',
      status:      'pending',    // awaiting admin approval
      strikes:     0,
      categoryId:  categoryId || null,
      motivation:  motivation || '',
      ghost:       false,
      ...profileSeed,
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
    // Compress data URLs to stay under Firestore 1MB doc limit
    const photoURL = await compressDataUrlIfNeeded(updates.photoURL ?? m.photoURL ?? null);
    const coverPhotoURL = await compressDataUrlIfNeeded(updates.coverPhotoURL ?? m.coverPhotoURL ?? '');
    const payload = {
      displayName:   updates.displayName   || m.displayName,
      photoURL:      photoURL ?? m.photoURL ?? null,
      coverPhotoURL: coverPhotoURL || '',
      // Bilingual fields
      bio:           updates.bio           ?? m.bio     ?? '',
      hobbies:       updates.hobbies       ?? m.hobbies ?? '',
      // Academic & contact
      career:        updates.career        ?? m.career     ?? '',
      semester:      updates.semester      ?? m.semester   ?? '',
      university:    updates.university    ?? m.university ?? '',
      email:         updates.email         ?? m.email      ?? '',
      // ── Community profile — Mission ──────────────────────────────────────
      currentObjective: updates.currentObjective ?? m.currentObjective ?? '',
      currentChallenge: updates.currentChallenge ?? m.currentChallenge ?? '',
      // ── Community profile — Collaboration ────────────────────────────────
      lookingForHelpIn:        updates.lookingForHelpIn        ?? m.lookingForHelpIn        ?? [],
      iCanHelpWith:            updates.iCanHelpWith            ?? m.iCanHelpWith            ?? [],
      skillsToLearnThisSemester: updates.skillsToLearnThisSemester ?? m.skillsToLearnThisSemester ?? [],
      skillsICanTeach:         updates.skillsICanTeach         ?? m.skillsICanTeach         ?? [],
      // ── Community profile — Culture ───────────────────────────────────────
      songOnRepeatTitle:  updates.songOnRepeatTitle  ?? m.songOnRepeatTitle  ?? '',
      songOnRepeatUrl:    updates.songOnRepeatUrl    ?? m.songOnRepeatUrl    ?? '',
      funFact:            updates.funFact            ?? m.funFact            ?? '',
      personalityTag:     updates.personalityTag     ?? m.personalityTag     ?? '',
    };
    // When user edits their own profile, sync to all their memberships (shared profile across teams)
    const isOwnProfile = authUser && m.userId === authUser.uid;
    const idsToUpdate = isOwnProfile
      ? userMemberships.filter((um) => um.userId === authUser.uid).map((um) => um.id)
      : [membershipId];
    await Promise.all(idsToUpdate.map((id) => updateDoc(doc(db, 'memberships', id), payload)));
    // Firestore listener will update teamMemberships; profileMember derives from it
  };

  // ── Weekly status ───────────────────────────────────────────────────────────
  // One document per member per week.  Doc ID: `{membershipId}_{weekOf}`.
  // Auto-awards: 5 pts per new weekly update; 100 pts when member hits 50 updates.
  const handleSaveWeeklyStatus = async ({ membershipId, weekOf, advanced, failedAt, learned }) => {
    if (!currentTeam || !authUser) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    // Only the member themselves (or an admin) can post
    const canPost = isPlatformAdmin || memberRole === 'teamAdmin' || m.userId === authUser.uid;
    if (!canPost) return;
    const docId = `${membershipId}_${weekOf}`;
    const statusRef = doc(db, 'weeklyStatuses', docId);
    const existed = (await getDoc(statusRef)).exists();
    await setDoc(statusRef, {
      teamId:       currentTeam.id,
      membershipId,
      userId:       authUser.uid,
      displayName:  m.displayName || '',
      weekOf,
      advanced:     advanced  || '',
      failedAt:     failedAt  || '',
      learned:      learned   || '',
      updatedAt:    serverTimestamp(),
    }, { merge: true });

    // Auto-award points only for NEW weekly updates (not edits)
    // and only when weekOf is current or previous week (prevents farming by backfilling)
    if (!existed && isWeekEligibleForPoints(weekOf)) {
      await addDoc(collection(db, 'meritEvents'), {
        teamId:       currentTeam.id,
        membershipId,
        meritId:      null,
        meritName:    'Actualización semanal',
        meritLogo:    '📝',
        points:       POINTS_PER_WEEKLY_UPDATE,
        type:         'award',
        evidence:     weekOf,
        autoAward:    true,
        awardedByUserId: authUser.uid,
        awardedByName:  userProfile?.displayName || authUser.email || '—',
        createdAt:    serverTimestamp(),
      });
      // Check 50-update milestone
      const memberStatuses = teamWeeklyStatuses.filter((s) => s.membershipId === membershipId);
      const count = memberStatuses.length + 1; // +1 for the one we just saved
      if (count >= 50) {
        const alreadyAwarded = teamMeritEvents.some(
          (e) => e.membershipId === membershipId && e.evidence === 'milestone_50',
        );
        if (!alreadyAwarded) {
          await addDoc(collection(db, 'meritEvents'), {
            teamId:       currentTeam.id,
            membershipId,
            meritId:      null,
            meritName:    '50 actualizaciones',
            meritLogo:    '🎯',
            points:       MILESTONE_50_POINTS,
            type:         'award',
            evidence:     'milestone_50',
            autoAward:    true,
            awardedByUserId: authUser.uid,
            awardedByName:  userProfile?.displayName || authUser.email || '—',
            createdAt:    serverTimestamp(),
          });
        }
      }
    }
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

  // ── Funding ─────────────────────────────────────────────────────────────────

  const handleCreateFundingAccount = async (payload) => {
    if (!currentTeam || !canEditTools) return;
    const order = teamFundingAccounts.length;
    await addDoc(collection(db, 'teamFundingAccounts'), {
      teamId: currentTeam.id,
      bankName: String(payload.bankName || '').trim(),
      accountName: String(payload.accountName || '').trim(),
      accountLast4: String(payload.accountLast4 || '').replace(/\D/g, '').slice(-4),
      currentBalance: parseFloat(payload.currentBalance) || 0,
      order,
      createdAt: serverTimestamp(),
    });
  };

  const handleUpdateFundingAccount = async (accountId, payload) => {
    if (!currentTeam || !canEditTools) return;
    await updateDoc(doc(db, 'teamFundingAccounts', accountId), {
      bankName: String(payload.bankName || '').trim(),
      accountName: String(payload.accountName || '').trim(),
      accountLast4: String(payload.accountLast4 || '').replace(/\D/g, '').slice(-4),
      currentBalance: parseFloat(payload.currentBalance) || 0,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteFundingAccount = async (accountId) => {
    if (!currentTeam || !canEditTools) return;
    const hasEntries = teamFundingEntries.some((e) => e.accountId === accountId);
    if (hasEntries) {
      alert('No se puede eliminar una cuenta con movimientos. Elimina o reasigna los movimientos primero.');
      return;
    }
    await deleteDoc(doc(db, 'teamFundingAccounts', accountId));
  };

  const handleCreateFundingEntry = async ({ date, description, amount, type, category, accountId }) => {
    if (!currentTeam || !canEditTools) return;
    const acc = teamFundingAccounts.find((a) => a.id === accountId);
    if (!acc) return;
    const currentBal = acc?.currentBalance ?? 0;
    const delta = type === 'out' ? -amount : amount;
    const newBalance = currentBal + delta;
    await addDoc(collection(db, 'teamFundingEntries'), {
      teamId: currentTeam.id,
      accountId,
      date,
      description: description || '',
      amount,
      type,
      category: category || '',
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'teamFundingAccounts', accountId), {
      currentBalance: newBalance,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteFundingEntry = async (entryId) => {
    if (!currentTeam || !canEditTools) return;
    const entry = teamFundingEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const acc = teamFundingAccounts.find((a) => a.id === entry.accountId);
    if (!acc) return;
    const delta = entry.type === 'out' ? entry.amount : -entry.amount;
    const newBalance = (acc?.currentBalance ?? 0) + delta;
    await deleteDoc(doc(db, 'teamFundingEntries', entryId));
    await updateDoc(doc(db, 'teamFundingAccounts', entry.accountId), {
      currentBalance: newBalance,
      updatedAt: serverTimestamp(),
    });
  };

  // ── Merits ─────────────────────────────────────────────────────────────────

  const handleCreateMerit = async (name, points, categoryId, logo, shortDescription, longDescription, assignableBy = 'leader', tags = [], achievementTypes = [], domains = [], tier = null) => {
    if (!currentTeam) { alert('No team selected.'); return; }
    if (!canCreateMerit) { alert('No permission to create logros.'); return; }
    // Leaders may only create logros for their own category (not global)
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
        logo:             logo             || '🏆',
        shortDescription: shortDescription || '',
        longDescription:  longDescription  || '',
        assignableBy:     assignableBy     || 'leader',
        tags:             Array.isArray(tags) ? tags.filter(Boolean) : [],
        achievementTypes: Array.isArray(achievementTypes) ? achievementTypes.filter(Boolean) : [],
        domains:          Array.isArray(domains) ? domains.filter(Boolean) : [],
        tier:             tier || null,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[Logro] Firestore error:', err);
      alert(`No se pudo guardar el logro: ${err.message}\n\nVerifica las reglas de Firestore en FIREBASE_SETUP.md.`);
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
    const allowed = merit.assignableBy || 'leader';
    const canAssign = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || memberRole === allowed;
    if (!canAssign) {
      alert(`Solo un ${allowed === 'leader' ? 'Líder' : allowed === 'teamAdmin' ? 'Team Admin' : 'Faculty Advisor'} puede otorgar este logro.`);
      return;
    }
    // Leaders may only award merits within their own category
    if (!canEdit && memberRole === 'leader' && !isPlatformAdmin) {
      if (merit.categoryId && merit.categoryId !== currentMembership?.categoryId) {
        alert('Como Líder, solo puedes otorgar logros dentro de tu categoría asignada.');
        return;
      }
    }
    await addDoc(collection(db, 'meritEvents'), {
      teamId:               currentTeam.id,
      membershipId,
      meritId,
      meritName:            merit.name,
      meritLogo:            merit.logo || '🏆',
      points:               merit.points,
      type:                 'award',
      evidence:             evidence || '',
      createdByUserId:      authUser?.uid             || null,
      createdByMembershipId: currentMembership?.id    || null,
      awardedByUserId:      authUser?.uid             || null,
      awardedByName:        userProfile?.displayName   || authUser?.email || '—',
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

  /* Bilingual toggle — commented out; will deal with that later
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
  */

  const handleViewProfile = (membership) => {
    navigate(`/profile/${membership.id}`);
  };

  const goToView = (viewId) => {
    navigate(viewId === 'myprofile' ? '/profile' : `/${viewId}`);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <LangContext.Provider value={{ lang, t, setLang: () => {} }}>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-400 text-sm">{t('loading')}</div>
        </div>
      </LangContext.Provider>
    );
  }

  // ── Unauthenticated — public team browser ──────────────────────────────────
  if (!authUser) {
    return (
      <LangContext.Provider value={{ lang, t, setLang: () => {} }}>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">{t('app_name')}</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">{t('app_subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                <div key={team.id} className="bg-slate-800/90 rounded-xl p-4 space-y-2 border border-slate-700/40 shadow-sm hover:border-slate-600/50 transition-colors">
                  <h2 className="font-bold text-base">{team.name}</h2>
                  {getL(team.overview?.tagline, lang) && <p className="text-sm text-slate-300 italic">"{getL(team.overview.tagline, lang)}"</p>}
                  {getL(team.overview?.about, lang)   && <p className="text-xs text-slate-400 line-clamp-3">{getL(team.overview.about, lang)}</p>}
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

    const startRename = (team, e) => {
      e.stopPropagation();
      setRenamingTeamId(team.id);
      setRenameValue(team.name);
    };
    const commitRename = async (teamId) => {
      await handleRenameTeam(teamId, renameValue);
      setRenamingTeamId(null);
    };

    // Reusable card action bar for platform admins
    const AdminTeamActions = ({ team }) => {
      if (!isPlatformAdmin) return null;
      if (renamingTeamId === team.id) {
        return (
          <div className="flex gap-1 items-center mt-2" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(team.id); if (e.key === 'Escape') setRenamingTeamId(null); }}
              placeholder={t('rename_team_ph')}
              className="flex-1 px-2 py-1 bg-slate-900 border border-emerald-600 rounded text-xs"
            />
            <button onClick={() => commitRename(team.id)}
              className="px-2 py-1 bg-emerald-500 text-black text-[11px] font-semibold rounded">
              {t('save')}
            </button>
            <button onClick={() => setRenamingTeamId(null)}
              className="text-[11px] text-slate-400 underline">
              {t('cancel')}
            </button>
          </div>
        );
      }
      return (
        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => startRename(team, e)}
            className="text-[11px] text-amber-400 hover:text-amber-300 underline transition-colors">
            {t('rename_team')}
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id); }}
            className="text-[11px] text-red-400 hover:text-red-300 underline transition-colors">
            {t('delete_team')}
          </button>
        </div>
      );
    };

    return (
      <LangContext.Provider value={{ lang, t, setLang: () => {} }}>
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
                      <div key={team.id} className="bg-slate-800/90 rounded-xl p-4 space-y-1 border border-slate-700/40 shadow-sm hover:border-emerald-500/30 transition-colors">
                        <button onClick={() => { setSelectedTeamId(team.id); navigate('/overview'); }}
                          className="w-full text-left hover:text-emerald-300 transition-colors active:scale-95">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm">{team.name}</h3>
                            {mem && <RoleBadge role={mem.role} />}
                          </div>
                          {getL(team.overview?.tagline, lang) && <p className="text-xs text-slate-400 italic">"{getL(team.overview.tagline, lang)}"</p>}
                        </button>
                        <AdminTeamActions team={team} />
                      </div>
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
                        {cat && <p className="text-xs text-slate-400">{t('requested_category')}: <span className="text-slate-200">{ensureString(cat.name, lang)}</span></p>}
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
                    <div key={team.id} className="bg-slate-800/90 rounded-xl p-4 space-y-2 border border-slate-700/40 shadow-sm hover:border-slate-600/50 transition-colors">
                      <h3 className="font-bold text-sm">{team.name}</h3>
                      {getL(team.overview?.tagline, lang) && <p className="text-xs text-slate-400 italic">"{getL(team.overview.tagline, lang)}"</p>}
                      {getL(team.overview?.about, lang)   && <p className="text-xs text-slate-500 line-clamp-2">{getL(team.overview.about, lang)}</p>}
                      <button onClick={() => setJoinTarget(team)}
                        className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
                        {t('request_to_join')}
                      </button>
                      <AdminTeamActions team={team} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPlatformAdmin && (
              <>
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
                <PlatformConfigSection
                  platformConfig={platformConfig}
                  onSave={handleSavePlatformConfig}
                  t={t}
                />
              </>
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
      { id: 'funding',     label: t('nav_funding'),     icon: '¤' },
    ] : []),
    ...(currentMembership ? [{ id: 'myprofile', label: t('nav_myprofile'), icon: '☺' }] : []),
  ];

  return (
    <LangContext.Provider value={{ lang, t, setLang: () => {} }}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">


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
                <button key={tab.id} onClick={() => { goToView(tab.id); setMobileNavOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded flex items-center gap-2 text-sm transition-colors
                    ${view === tab.id ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <span className="text-base shrink-0 w-5 text-center">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
              <div className="pt-3 border-t border-slate-800 space-y-2 mt-2">
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
        <header className="border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0 bg-slate-950/80 backdrop-blur-sm gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors shrink-0"
              title={t('expand_menu')}
              aria-label={t('expand_menu')}>
              <HamburgerIcon />
            </button>
            {/* Desktop sidebar collapse toggle */}
            <button onClick={() => setNavCollapsed((c) => !c)}
              className="hidden md:flex text-slate-400 hover:text-white w-8 h-8 items-center justify-center rounded hover:bg-slate-800 transition-colors shrink-0"
              title={navCollapsed ? t('expand_menu') : t('collapse_menu')}
              aria-label={navCollapsed ? t('expand_menu') : t('collapse_menu')}>
              <HamburgerIcon />
            </button>
            <InlineTeamRename
              team={currentTeam}
              isPlatformAdmin={isPlatformAdmin}
              onRename={handleRenameTeam}
              onDelete={handleDeleteTeam}
              t={t}
            />
            {currentMembership && !previewRole && <span className="hidden sm:inline"><RoleBadge role={currentMembership.role} /></span>}
            {isPlatformAdmin && !previewRole && (
              <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                {t('platform_admin')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                  className="w-8 h-8 rounded-full object-cover object-[center_top] border-2 border-slate-600 hover:border-emerald-500 transition-colors" alt="" />
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
          <nav className={`hidden md:block ${navCollapsed ? 'w-12' : 'w-44'} border-r border-slate-800/80 p-2 shrink-0 transition-all duration-200 bg-slate-950/60 flex flex-col min-w-0 overflow-hidden`}>
            <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {navItems.map((tab) => (
              <button key={tab.id} onClick={() => goToView(tab.id)}
                className={`w-full text-left rounded flex items-center gap-2 text-sm transition-colors flex-shrink-0
                  ${navCollapsed ? 'justify-center p-2 min-h-[36px]' : 'px-2 py-2'}
                  ${view === tab.id ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>
                <span className="text-base shrink-0 w-5 text-center">{tab.icon}</span>
                {!navCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            ))}
            </div>
          </nav>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/50">
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
                userProfile={userProfile}
                canEdit={canEdit}
                canCreateMerit={canCreateMerit}
                canAward={canAward}
                currentMembership={currentMembership}
                memberRole={memberRole}
                isPlatformAdmin={isPlatformAdmin}
                achievementTypes={meritAchievementTypes}
                domains={meritDomains}
                platformConfig={platformConfig}
                onSavePlatformConfig={handleSavePlatformConfig}
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

            {view === 'funding' && isAtLeastRookie && (
              <FundingView
                accounts={teamFundingAccounts}
                entries={teamFundingEntries}
                canEdit={canEditTools}
                onCreateAccount={handleCreateFundingAccount}
                onUpdateAccount={handleUpdateFundingAccount}
                onDeleteAccount={handleDeleteFundingAccount}
                onCreateEntry={handleCreateFundingEntry}
                onDeleteEntry={handleDeleteFundingEntry}
              />
            )}

            {/* My Profile — full page */}
            {view === 'myprofile' && (
              currentMembership ? (
                <ProfilePageView
                  membership={currentMembership}
                  categories={teamCategories}
                  meritEvents={teamMeritEvents.filter((e) => e.membershipId === currentMembership.id)}
                  canEditThis={isPlatformAdmin || memberRole === 'teamAdmin' || (authUser && currentMembership.userId === authUser.uid)}
                  onSave={handleUpdateMemberProfile}
                  weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === currentMembership.id)}
                  onSaveWeeklyStatus={handleSaveWeeklyStatus}
                  suggestedTags={collabTagSuggestions}
                />
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">
                  {t('loading')}
                </div>
              )
            )}

            {/* Viewing another member's profile — full page */}
            {view === 'profile' && profileMemberId && !profileMember && (
              <div className="py-12 text-center">
                <p className="text-slate-400 text-sm">{t('member_not_found')}</p>
              </div>
            )}
            {view === 'profile' && profileMember && (
              <ProfilePageView
                membership={profileMember}
                categories={teamCategories}
                meritEvents={teamMeritEvents.filter((e) => e.membershipId === profileMember.id)}
                canEditThis={isPlatformAdmin || memberRole === 'teamAdmin' || (authUser && profileMember.userId === authUser.uid)}
                onSave={handleUpdateMemberProfile}
                weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === profileMember.id)}
                onSaveWeeklyStatus={handleSaveWeeklyStatus}
                suggestedTags={collabTagSuggestions}
              />
            )}
          </main>
        </div>

        {/* ── Mobile bottom nav bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex items-center justify-around px-1 py-1 z-30">
          {navItems.slice(0, 5).map((tab) => (
            <button key={tab.id} onClick={() => goToView(tab.id)}
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
