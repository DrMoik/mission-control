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
//   strings.js     — t() and STRINGS (Spanish only)
//   components/    — shared modals and UI atoms
//   views/         — one file per full-page view

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  addDoc, query, where, onSnapshot, serverTimestamp, runTransaction,
  getDocs, writeBatch,
} from 'firebase/firestore';
import { useAuth } from './hooks/useAuth.js';
import { useFirebaseSubscriptions } from './hooks/useFirebaseSubscriptions.js';

// System merit points: use team config or defaults (see handleSaveSystemMeritPoints)

/** Returns true if weekOf (YYYY-MM-DD, any day) falls in current or previous week (Monday–Sunday). */
function isWeekEligibleForPoints(weekOf) {
  const monday = normalizeWeekOfToMonday(weekOf);
  if (!monday) return false;
  const thisMonday = getMondayOfWeekLocal();
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const lastMonday = getMondayOfWeekLocal(d);
  return monday === thisMonday || monday === lastMonday;
}

// ── Internal modules ──────────────────────────────────────────────────────────
import { t, lang, STRINGS }         from './strings.js';
import {
  EMPTY_PROFILE, COLLAB_TAG_SUGGESTIONS, MERIT_ACHIEVEMENT_TYPES, MERIT_DOMAINS,
  CAREER_OPTIONS, SEMESTER_OPTIONS, PERSONALITY_TAGS, PERSONALITY_TAGS_DEFAULT, MERIT_TIERS,
  TASK_GRADES, TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT, TASK_GRADE_POINTS_TEAM_DEFAULT,
  SYSTEM_MERIT_POINTS_DEFAULT, SYSTEM_MERIT_NAMES,
} from './constants.js';
import { atLeast, tsToDate, getL, ensureString, compressDataUrlIfNeeded, getMondayOfWeekLocal, normalizeWeekOfToMonday } from './utils.js';

// ── Shared UI atoms ───────────────────────────────────────────────────────────
import { RoleBadge, GoogleIcon }   from './components/ui/index.js';

// ── Modals ────────────────────────────────────────────────────────────────────
import JoinRequestModal            from './components/JoinRequestModal.jsx';

// ── Full-page views (lazy to avoid "Cannot access X before initialization" in bundle) ──
import OverviewView                from './views/OverviewView.jsx';
import CategoriesView              from './views/CategoriesView.jsx';
import LeaderboardView             from './views/LeaderboardView.jsx';
import CalendarView                from './views/CalendarView.jsx';
import ToolsView                   from './views/ToolsView.jsx';
import AcademyView                 from './views/AcademyView.jsx';
import FeedView                    from './views/FeedView.jsx';
import FundingView                 from './views/FundingView.jsx';
import TasksView                   from './views/TasksView.jsx';

const ProfilePageView = lazy(() => import('./views/ProfilePageView.jsx'));
const MembersView     = lazy(() => import('./views/MembersView.jsx'));
const MeritsView      = lazy(() => import('./views/MeritsView.jsx'));
const AdminView       = lazy(() => import('./views/AdminView.jsx'));

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

  // ── Team selection ─────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [joinTarget, setJoinTarget] = useState(null);

  const onSignOut = useCallback(() => setSelectedTeamId(null), []);
  const { authUser, authLoading, userProfile, handleGoogleSignIn, handleSignOut } = useAuth({ onSignOut });

  const {
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
  } = useFirebaseSubscriptions({ authUser, selectedTeamId });

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

  const validViews = new Set(['overview', 'feed', 'categories', 'members', 'merits', 'leaderboard', 'calendar', 'tools', 'academy', 'funding', 'tasks', 'myprofile', 'profile', 'admin']);
  const isViewValid = validViews.has(view);

  // Redirect invalid paths to /overview (only when team is selected, to avoid running in team picker)
  useEffect(() => {
    if (selectedTeamId && !isViewValid) navigate('/overview', { replace: true });
  }, [selectedTeamId, isViewValid, navigate]);

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

  // Admin tab is only for team admins; redirect others to overview (must be after canEdit is defined)
  useEffect(() => {
    if (selectedTeamId && view === 'admin' && !canEdit) navigate('/overview', { replace: true });
  }, [selectedTeamId, view, canEdit, navigate]);

  // Merit tags: team overrides, then platform config, then constants
  // Team tags; new teams get defaults from constants in handleCreateTeam
  const meritAchievementTypes = (currentTeam?.achievementTypes?.length ? currentTeam.achievementTypes : MERIT_ACHIEVEMENT_TYPES);
  const meritDomains         = (currentTeam?.domains?.length ? currentTeam.domains : MERIT_DOMAINS);

  // Dropdown options: team overrides (from Admin tab) or constants
  const careerOptions        = (currentTeam?.careerOptions?.length ? currentTeam.careerOptions : CAREER_OPTIONS);
  const semesterOptions      = (currentTeam?.semesterOptions?.length ? currentTeam.semesterOptions : SEMESTER_OPTIONS);
  const personalityTags = useMemo(() => {
    const t = currentTeam?.personalityTags;
    if (t && typeof t === 'object' && !Array.isArray(t) && Object.keys(t).length > 0) return t;
    if (Array.isArray(t) && t.length > 0) return Object.fromEntries(t.map((k) => [k, PERSONALITY_TAGS_DEFAULT[k] || k]));
    return PERSONALITY_TAGS_DEFAULT;
  }, [currentTeam?.personalityTags]);

  const systemMeritPoints = useMemo(() => ({
    weeklyUpdate:    currentTeam?.pointsPerWeeklyUpdate ?? SYSTEM_MERIT_POINTS_DEFAULT.weeklyUpdate,
    profileComplete: currentTeam?.pointsPerProfileComplete ?? SYSTEM_MERIT_POINTS_DEFAULT.profileComplete,
    milestone50:     currentTeam?.pointsPerMilestone50 ?? SYSTEM_MERIT_POINTS_DEFAULT.milestone50,
  }), [currentTeam?.pointsPerWeeklyUpdate, currentTeam?.pointsPerProfileComplete, currentTeam?.pointsPerMilestone50]);
  const meritTiers           = (currentTeam?.meritTiers?.length ? currentTeam.meritTiers : MERIT_TIERS);

  const myTeams = useMemo(() => {
    const ids = new Set(userMemberships.map((m) => m.teamId));
    return allTeams.filter((t) => ids.has(t.id));
  }, [allTeams, userMemberships]);

  // All collaboration tags: team-defined base (or constants) + tags from members
  const collabTagSuggestions = useMemo(() => {
    const base = (currentTeam?.collabTagSuggestions?.length ? currentTeam.collabTagSuggestions : COLLAB_TAG_SUGGESTIONS);
    const set = new Set(base);
    const add = (t) => { const s = typeof t === 'string' ? t : (t?.es || t?.en || ''); if (s.trim()) set.add(s.trim()); };
    teamMemberships.forEach((m) => {
      (m.lookingForHelpIn || []).forEach(add);
      (m.iCanHelpWith || []).forEach(add);
      (m.skillsToLearnThisSemester || []).forEach(add);
      (m.skillsICanTeach || []).forEach(add);
    });
    return [...set].sort();
  }, [currentTeam?.collabTagSuggestions, teamMemberships]);

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

  // ── Teams ──────────────────────────────────────────────────────────────────

  const handleCreateTeam = async (name) => {
    if (!isPlatformAdmin || !authUser || !userProfile) return;
    try {
      const teamRef = await addDoc(collection(db, 'teams'), {
        name,
        createdAt: serverTimestamp(),
        overview: { tagline: '', about: '', history: '', objectives: '', kpis: [] },
        achievementTypes: MERIT_ACHIEVEMENT_TYPES,
        domains:          MERIT_DOMAINS,
      });
      // Seed default categories
      for (const catName of ['Aspirants', 'Mechanics', 'Software', 'Sciences']) {
        await addDoc(collection(db, 'categories'), { teamId: teamRef.id, name: catName, description: '' });
      }
      // Seed a welcome module (topics-based; one topic)
      await addDoc(collection(db, 'modules'), {
        teamId: teamRef.id,
        title: { en: 'Welcome to the Team', es: 'Bienvenido al equipo' },
        description: { en: 'Start here before exploring anything else.', es: 'Empieza aquí antes de explorar.' },
        topics: [
          {
            id: 'welcome-1',
            title: { en: 'Getting started', es: 'Para comenzar' },
            content: { en: 'Read this module. When you finish, use "Request review" so a mentor can evaluate you.', es: 'Lee este módulo. Al terminar, usa "Solicitar revisión" para que un mentor te evalúe.' },
            videoUrl: '',
          },
        ],
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

  const handleSaveTeamMeritTags = async (achievementTypes, domains) => {
    if (!currentTeam || (!canEdit && !isPlatformAdmin)) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      achievementTypes: Array.isArray(achievementTypes) ? achievementTypes.filter(Boolean) : [],
      domains:          Array.isArray(domains)          ? domains.filter(Boolean)          : [],
    });
  };

  const handleSaveTeamCareers = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), { careerOptions: Array.isArray(arr) ? arr : [] });
  };
  const handleSaveTeamSemesters = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), { semesterOptions: Array.isArray(arr) ? arr : [] });
  };
  const handleSaveTeamCollabSuggestions = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), { collabTagSuggestions: Array.isArray(arr) ? arr : [] });
  };
  const handleSaveTeamMeritTiers = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), { meritTiers: Array.isArray(arr) ? arr : [] });
  };
  const handleSaveTaskGradePoints = async ({ individual, team }) => {
    if (!currentTeam || !canEdit) return;
    const ptsInd = individual || TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT;
    const ptsTeam = team || TASK_GRADE_POINTS_TEAM_DEFAULT;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      taskGradePointsIndividual: ptsInd,
      taskGradePointsTeam:       ptsTeam,
    });
    // Retroactively update all "Tarea revisada" merit events
    const meritEventsRef = collection(db, 'meritEvents');
    const q = query(meritEventsRef, where('teamId', '==', currentTeam.id), where('meritName', '==', 'Tarea revisada'));
    const snap = await getDocs(q);
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      const evt = d.data();
      const grade = evt.taskGrade || (evt.evidence && /\((\w+)\)$/.exec(evt.evidence)?.[1]);
      const scope = evt.taskCompletionScope || 'individual';
      if (!grade || !TASK_GRADES.includes(grade)) continue;
      const newPoints = scope === 'team' ? (ptsTeam[grade] ?? 0) : (ptsInd[grade] ?? 0);
      if (evt.points !== newPoints) {
        batch.update(d.ref, { points: newPoints });
        count++;
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
  };

  const handleSaveSystemMeritPoints = async (points) => {
    if (!currentTeam || !canEdit) return;
    const { weeklyUpdate, profileComplete, milestone50 } = points;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      pointsPerWeeklyUpdate:    weeklyUpdate ?? SYSTEM_MERIT_POINTS_DEFAULT.weeklyUpdate,
      pointsPerProfileComplete: profileComplete ?? SYSTEM_MERIT_POINTS_DEFAULT.profileComplete,
      pointsPerMilestone50:    milestone50 ?? SYSTEM_MERIT_POINTS_DEFAULT.milestone50,
    });
    // Retroactively update all existing meritEvents for this team (Actualización semanal, Perfil completo, 50 actualizaciones)
    const meritEventsRef = collection(db, 'meritEvents');
    const q = query(meritEventsRef, where('teamId', '==', currentTeam.id));
    const snap = await getDocs(q);
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      const evt = d.data();
      let newPoints = null;
      if (evt.meritName === SYSTEM_MERIT_NAMES.weeklyUpdate && evt.autoAward) newPoints = weeklyUpdate;
      else if (evt.meritName === SYSTEM_MERIT_NAMES.profileComplete || evt.evidence === 'profile_complete_50') newPoints = profileComplete;
      else if (evt.meritName === SYSTEM_MERIT_NAMES.milestone50 || evt.evidence === 'milestone_50') newPoints = milestone50;
      if (newPoints != null && evt.points !== newPoints) {
        batch.update(d.ref, { points: newPoints });
        count++;
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
  };

  const handleSaveTeamPersonalityTags = async (dictOrArr) => {
    if (!currentTeam || !canEdit) return;
    const payload = (typeof dictOrArr === 'object' && !Array.isArray(dictOrArr))
      ? dictOrArr
      : Array.isArray(dictOrArr)
        ? Object.fromEntries((dictOrArr || []).map((k) => [k, PERSONALITY_TAGS_DEFAULT[k] || k]))
        : PERSONALITY_TAGS_DEFAULT;
    await updateDoc(doc(db, 'teams', currentTeam.id), { personalityTags: payload });
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
      whatIListenTo:     otherMembership.whatIListenTo ?? [],
      bookThatMarkedMe:  otherMembership.bookThatMarkedMe ?? [],
      ideaThatMotivatesMe: otherMembership.ideaThatMotivatesMe ?? [],
      quoteThatMovesMe:  otherMembership.quoteThatMovesMe ?? [],
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

  // Admins with a category can only add/remove strikes for members in their area.
  // Area leaders (leader + categoryId) can strike only members in their area.
  // Leaders cannot remove their own strikes.
  const canStrike = canEdit || (memberRole === 'leader' && currentMembership?.categoryId);
  const canStrikeMember = (member) => {
    if (!canStrike) return false;
    if (isPlatformAdmin) return true;
    if (canEdit && !currentMembership?.categoryId) return true; // global admin
    return member?.categoryId === currentMembership?.categoryId;
  };
  const canRemoveStrikeMember = (member) =>
    canStrikeMember(member) && !(memberRole === 'leader' && !isPlatformAdmin && currentMembership?.id === member?.id);

  const handleAddStrike = async (membershipId) => {
    if (!canStrike) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    if (!canStrikeMember(m)) return;
    const newStrikes = (m.strikes || 0) + 1;
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: newStrikes,
      ...(newStrikes >= 3 ? { status: 'suspended' } : {}),
    });
  };

  const handleRemoveStrike = async (membershipId) => {
    if (!canStrike) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    if (!canStrikeMember(m)) return;
    // Leaders cannot remove their own strikes
    if (memberRole === 'leader' && !isPlatformAdmin && currentMembership?.id === membershipId) return;
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: Math.max(0, (m.strikes || 0) - 1),
      status: 'active',
    });
  };

  const handleUpdateMemberProfile = async (membershipId, updates) => {
    if (!currentTeam) throw new Error('No hay equipo activo.');
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) throw new Error('Miembro no encontrado.');
    const isOwnProfile = authUser && (m.userId === authUser.uid || currentMembership?.id === membershipId);
    const canEditThis = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || isOwnProfile;
    if (!canEditThis) throw new Error('No tienes permiso para editar este perfil.');
    // Compress data URLs to stay under Firestore 1MB doc limit (same limit for all members)
    const maxBytes = 120000;
    const photoURL = await compressDataUrlIfNeeded(updates.photoURL ?? m.photoURL ?? null, maxBytes);
    const coverPhotoURL = await compressDataUrlIfNeeded(updates.coverPhotoURL ?? m.coverPhotoURL ?? '', maxBytes);
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
      whatIListenTo:      Array.isArray(updates.whatIListenTo)
        ? updates.whatIListenTo.filter((t) => (typeof t === 'string' ? t : t?.title)?.trim()).map((t) => typeof t === 'string' ? { title: t.trim(), url: '' } : { title: (t.title || '').trim(), url: (t.url || '').trim() })
        : (m.whatIListenTo ?? []),
      bookThatMarkedMe:   Array.isArray(updates.bookThatMarkedMe) ? updates.bookThatMarkedMe.filter(Boolean) : (m.bookThatMarkedMe ?? []),
      ideaThatMotivatesMe: Array.isArray(updates.ideaThatMotivatesMe) ? updates.ideaThatMotivatesMe.filter(Boolean) : (m.ideaThatMotivatesMe ?? []),
      quoteThatMovesMe:   Array.isArray(updates.quoteThatMovesMe) ? updates.quoteThatMovesMe.filter(Boolean) : (m.quoteThatMovesMe ?? []),
      funFact:            updates.funFact            ?? m.funFact            ?? '',
      personalityTag:     updates.personalityTag     ?? m.personalityTag     ?? '',
      birthdate:          updates.birthdate          ?? m.birthdate          ?? '',
    };
    // When user edits their own profile, sync to all their memberships (shared profile across teams)
    const isOwnMembership = authUser && m.userId === authUser.uid;
    const idsToUpdate = isOwnMembership
      ? userMemberships.filter((um) => um.userId === authUser.uid).map((um) => um.id)
      : [membershipId];
    await Promise.all(idsToUpdate.map((id) => updateDoc(doc(db, 'memberships', id), payload)));

    // Auto-award 50 pts for "Perfil completo" ONLY when all profile fields are filled.
    // Also require at least one culture entry. Award is locked/idempotent via deterministic event doc ID.
    const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
    const isNonEmptyBilingual = (v) => {
      const es = ensureString(getL(v, 'es')).trim();
      const en = ensureString(getL(v, 'en')).trim();
      return es.length > 0 || en.length > 0;
    };
    const hasNonEmptyTagList = (arr) =>
      Array.isArray(arr) && arr.some((t) => ensureString(t).trim().length > 0);
    const hasCulture = (() => {
      const hasListen = Array.isArray(payload.whatIListenTo) && payload.whatIListenTo.some((it) => {
        if (typeof it === 'string') return it.trim().length > 0;
        return (it?.title || '').trim().length > 0;
      });
      const hasBook = Array.isArray(payload.bookThatMarkedMe) && payload.bookThatMarkedMe.some((t) => ensureString(t).trim().length > 0);
      const hasIdea = Array.isArray(payload.ideaThatMotivatesMe) && payload.ideaThatMotivatesMe.some((t) => ensureString(t).trim().length > 0);
      const hasQuote = Array.isArray(payload.quoteThatMovesMe) && payload.quoteThatMovesMe.some((t) => ensureString(t).trim().length > 0);
      const hasLegacySong = isNonEmptyString(payload.songOnRepeatTitle);
      return hasListen || hasBook || hasIdea || hasQuote || hasLegacySong;
    })();

    const hasBirthdate = isNonEmptyString(payload.birthdate) && payload.birthdate.trim().length >= 5; // MM-DD or YYYY-MM-DD
    const isProfileComplete =
      isNonEmptyString(payload.displayName) &&
      isNonEmptyString(payload.email) &&
      isNonEmptyBilingual(payload.bio) &&
      isNonEmptyBilingual(payload.hobbies) &&
      isNonEmptyString(payload.career) &&
      isNonEmptyString(payload.semester) &&
      isNonEmptyString(payload.university) &&
      isNonEmptyBilingual(payload.currentObjective) &&
      isNonEmptyBilingual(payload.currentChallenge) &&
      hasNonEmptyTagList(payload.lookingForHelpIn) &&
      hasNonEmptyTagList(payload.iCanHelpWith) &&
      hasNonEmptyTagList(payload.skillsToLearnThisSemester) &&
      hasNonEmptyTagList(payload.skillsICanTeach) &&
      isNonEmptyBilingual(payload.funFact) &&
      isNonEmptyString(payload.personalityTag) &&
      hasBirthdate &&
      hasCulture;

    // Perfil completo: award once per membership. If merit was deleted, re-award (per-membership doc is source of truth).
    if (isProfileComplete && currentTeam && authUser) {
      const meritEventsRef = collection(db, 'meritEvents');
      const midsToAward = idsToUpdate.filter((mid) => teamMemberships.some((mm) => mm.id === mid));
      if (midsToAward.length === 0) return;
      await runTransaction(db, async (tx) => {
        for (const mid of midsToAward) {
          const awardId = `auto_profile_complete_50_${currentTeam.id}_${mid}`;
          const awardRef = doc(meritEventsRef, awardId);
          const awardSnap = await tx.get(awardRef);
          if (awardSnap.exists()) continue; // already awarded for this membership
          tx.set(awardRef, {
            teamId:            currentTeam.id,
            membershipId:      mid,
            meritId:           null,
            meritName:         SYSTEM_MERIT_NAMES.profileComplete,
            meritLogo:         '✅',
            points:            systemMeritPoints.profileComplete,
            type:              'award',
            evidence:          'profile_complete_50',
            autoAward:         true,
            awardedByUserId:   authUser.uid,
            awardedByName:     userProfile?.displayName || authUser.email || '—',
            createdAt:         serverTimestamp(),
          });
        }
      });
    }
    // Firestore listener will update teamMemberships; profileMember derives from it
    return { meritAwarded: !!isProfileComplete };
  };

  /** Admin-only: re-award "Perfil completo" merit if the member's profile meets all requirements. Use when merit was accidentally revoked. */
  const handleReawardProfileComplete = async (membershipId) => {
    if (!canEdit || !currentTeam || !authUser) throw new Error('No tienes permiso.');
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) throw new Error('Miembro no encontrado.');
    const payload = {
      displayName:   m.displayName   || '',
      email:         m.email         || '',
      bio:           m.bio           ?? '',
      hobbies:       m.hobbies       ?? '',
      career:        m.career        || '',
      semester:      m.semester      || '',
      university:    m.university    || '',
      currentObjective: m.currentObjective ?? '',
      currentChallenge: m.currentChallenge ?? '',
      lookingForHelpIn:        m.lookingForHelpIn        ?? [],
      iCanHelpWith:            m.iCanHelpWith            ?? [],
      skillsToLearnThisSemester: m.skillsToLearnThisSemester ?? [],
      skillsICanTeach:         m.skillsICanTeach         ?? [],
      whatIListenTo:      Array.isArray(m.whatIListenTo) ? m.whatIListenTo : (m.songOnRepeatTitle ? [{ title: m.songOnRepeatTitle, url: m.songOnRepeatUrl || '' }] : []),
      bookThatMarkedMe:   m.bookThatMarkedMe   ?? [],
      ideaThatMotivatesMe: m.ideaThatMotivatesMe ?? [],
      quoteThatMovesMe:   m.quoteThatMovesMe   ?? [],
      funFact:            m.funFact            ?? '',
      personalityTag:     m.personalityTag     || '',
      birthdate:          m.birthdate          || '',
    };
    const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
    const isNonEmptyBilingual = (v) => {
      const es = ensureString(getL(v, 'es')).trim();
      const en = ensureString(getL(v, 'en')).trim();
      return es.length > 0 || en.length > 0;
    };
    const hasNonEmptyTagList = (arr) =>
      Array.isArray(arr) && arr.some((t) => ensureString(t).trim().length > 0);
    const hasCulture = (() => {
      const hasListen = Array.isArray(payload.whatIListenTo) && payload.whatIListenTo.some((it) => {
        if (typeof it === 'string') return it.trim().length > 0;
        return (it?.title || '').trim().length > 0;
      });
      const hasBook = Array.isArray(payload.bookThatMarkedMe) && payload.bookThatMarkedMe.some((t) => ensureString(t).trim().length > 0);
      const hasIdea = Array.isArray(payload.ideaThatMotivatesMe) && payload.ideaThatMotivatesMe.some((t) => ensureString(t).trim().length > 0);
      const hasQuote = Array.isArray(payload.quoteThatMovesMe) && payload.quoteThatMovesMe.some((t) => ensureString(t).trim().length > 0);
      const hasLegacySong = isNonEmptyString(m.songOnRepeatTitle);
      return hasListen || hasBook || hasIdea || hasQuote || hasLegacySong;
    })();
    const hasBirthdate = isNonEmptyString(payload.birthdate) && payload.birthdate.trim().length >= 5;
    const isProfileComplete =
      isNonEmptyString(payload.displayName) &&
      isNonEmptyString(payload.email) &&
      isNonEmptyBilingual(payload.bio) &&
      isNonEmptyBilingual(payload.hobbies) &&
      isNonEmptyString(payload.career) &&
      isNonEmptyString(payload.semester) &&
      isNonEmptyString(payload.university) &&
      isNonEmptyBilingual(payload.currentObjective) &&
      isNonEmptyBilingual(payload.currentChallenge) &&
      hasNonEmptyTagList(payload.lookingForHelpIn) &&
      hasNonEmptyTagList(payload.iCanHelpWith) &&
      hasNonEmptyTagList(payload.skillsToLearnThisSemester) &&
      hasNonEmptyTagList(payload.skillsICanTeach) &&
      isNonEmptyBilingual(payload.funFact) &&
      isNonEmptyString(payload.personalityTag) &&
      hasBirthdate &&
      hasCulture;
    if (!isProfileComplete) throw new Error('El perfil no cumple todos los requisitos para el logro Perfil completo. Revisa que todos los campos obligatorios estén llenos (incl. cultura: libro, idea, cita o música).');
    const awardId = `auto_profile_complete_50_${currentTeam.id}_${membershipId}`;
    const awardRef = doc(db, 'meritEvents', awardId);
    await setDoc(awardRef, {
      teamId:            currentTeam.id,
      membershipId,
      meritId:           null,
      meritName:         SYSTEM_MERIT_NAMES.profileComplete,
      meritLogo:         '✅',
      points:            systemMeritPoints.profileComplete,
      type:              'award',
      evidence:          'profile_complete_50',
      autoAward:         true,
      awardedByUserId:   authUser.uid,
      awardedByName:     userProfile?.displayName || authUser.email || '—',
      createdAt:         serverTimestamp(),
    }, { merge: true });
  };

  // ── Weekly status ───────────────────────────────────────────────────────────
  // One document per member per week.  Doc ID: `{membershipId}_{weekOf}`.
  // Auto-awards: 25 pts only for the FIRST save of that week (one award per week); 100 pts at 50 updates.
  const handleSaveWeeklyStatus = async ({ membershipId, weekOf: weekOfParam, advanced, failedAt, learned }) => {
    if (!currentTeam || !authUser) throw new Error('No hay equipo o sesión activa.');
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) throw new Error('Miembro no encontrado.');
    // Any member can post their own weekly status; admins and leaders (for their area) can post for others
    const isOwnStatus = currentMembership?.id === membershipId || m?.userId === authUser?.uid;
    const isLeaderPostingForArea = memberRole === 'leader' && currentMembership?.categoryId && m?.categoryId === currentMembership.categoryId;
    const canPost = isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || isOwnStatus || isLeaderPostingForArea;
    if (!canPost) throw new Error('No tienes permiso para publicar.');
    const weekOf = normalizeWeekOfToMonday(weekOfParam) || weekOfParam || getMondayOfWeekLocal();
    const docId = `${membershipId}_${weekOf}`;
    const statusRef = doc(db, 'weeklyStatuses', docId);
    const meritEventsRef = collection(db, 'meritEvents');
    const doAward = isWeekEligibleForPoints(weekOf);

    const didAwardThisWeek = await runTransaction(db, async (tx) => {
      const statusSnap = await tx.get(statusRef);
      const existed = statusSnap.exists();

      tx.set(statusRef, {
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

      // Only one system award per week: grant 25 pts only on first save for this week (not on edits)
      if (!existed && doAward) {
        const eventRef = doc(meritEventsRef);
        tx.set(eventRef, {
          teamId:       currentTeam.id,
          membershipId,
          meritId:      null,
          meritName:    SYSTEM_MERIT_NAMES.weeklyUpdate,
          meritLogo:    '📝',
          points:       systemMeritPoints.weeklyUpdate,
          type:         'award',
          evidence:     weekOf,
          autoAward:    true,
          awardedByUserId: authUser.uid,
          awardedByName:  userProfile?.displayName || authUser.email || '—',
          createdAt:    serverTimestamp(),
        });
        return true;
      }
      return false;
    });

    // 50-update milestone only when we actually awarded (first save of the week)
    if (didAwardThisWeek) {
      const memberStatuses = teamWeeklyStatuses.filter((s) => s.membershipId === membershipId);
      const count = memberStatuses.length + 1;
      if (count >= 50) {
        const alreadyAwarded = teamMeritEvents.some(
          (e) => e.membershipId === membershipId && e.evidence === 'milestone_50',
        );
        if (!alreadyAwarded) {
          await addDoc(meritEventsRef, {
            teamId:       currentTeam.id,
            membershipId,
            meritId:      null,
            meritName:    SYSTEM_MERIT_NAMES.milestone50,
            meritLogo:    '🎯',
            points:       systemMeritPoints.milestone50,
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

  const handleCreateMerit = async (name, points, categoryId, logo, shortDescription, longDescription, assignableBy = 'leader', tags = [], achievementTypes = [], domains = [], tier = null, repeatable = true) => {
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
        repeatable:       repeatable !== false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[Logro] Firestore error:', err);
      alert(`No se pudo guardar el logro: ${err.message}\n\nVerifica las reglas de Firestore en FIREBASE_SETUP.md.`);
    }
  };

  const handleDeleteMerit = async (meritId) => {
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit || !canEditMerit(merit)) return;
    await deleteDoc(doc(db, 'merits', meritId));
  };

  /** Recover a deleted merit from its award events. Recreates the merit doc with the same ID. */
  const handleRecoverMerit = async (meritId, sampleEvent) => {
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
        logo:           sampleEvent.meritLogo || '🏆',
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
  };

  const canEditMerit = React.useCallback((merit) => {
    if (canEdit) return true;
    if (memberRole === 'leader' && currentMembership?.categoryId && merit?.categoryId === currentMembership.categoryId) return true;
    return false;
  }, [canEdit, memberRole, currentMembership?.categoryId]);

  const handleUpdateMerit = async (meritId, updates) => {
    const merit = teamMerits.find((m) => m.id === meritId);
    if (!merit || !canEditMerit(merit)) return;
    try {
      await updateDoc(doc(db, 'merits', meritId), {
        name:             updates.name             ?? merit.name,
        points:           Number(updates.points ?? merit.points),
        categoryId:       updates.categoryId       ?? merit.categoryId ?? null,
        logo:             updates.logo             ?? merit.logo ?? '🏆',
        shortDescription: updates.shortDescription ?? merit.shortDescription ?? '',
        longDescription:  updates.longDescription  ?? merit.longDescription ?? '',
        assignableBy:     updates.assignableBy     ?? merit.assignableBy ?? 'leader',
        tags:             Array.isArray(updates.tags) ? updates.tags.filter(Boolean) : (merit.tags || []),
        achievementTypes: Array.isArray(updates.achievementTypes) ? updates.achievementTypes.filter(Boolean) : (merit.achievementTypes || []),
        domains:          Array.isArray(updates.domains) ? updates.domains.filter(Boolean) : (merit.domains || []),
        tier:             updates.tier ?? merit.tier ?? null,
        repeatable:       updates.repeatable !== undefined ? updates.repeatable !== false : merit.repeatable !== false,
      });
    } catch (err) {
      console.error('[Logro] Update Firestore error:', err);
      alert(`No se pudo actualizar el logro: ${err.message}`);
    }
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
    // Leaders may only award to members of their own area
    if (memberRole === 'leader' && !isPlatformAdmin) {
      const targetMember = teamMemberships.find((mm) => mm.id === membershipId);
      if (targetMember && currentMembership?.categoryId && targetMember.categoryId !== currentMembership.categoryId) {
        alert(t('merit_leader_area_only') || 'Como Líder, solo puedes otorgar reconocimiento a miembros de tu área.');
        return;
      }
    }
    // Block self-assignment of merits except for platform admin (testing)
    if (membershipId === currentMembership?.id && !isPlatformAdmin) {
      alert(t('merit_self_award_error') || 'No puedes otorgarte logros a ti mismo.');
      return;
    }
    // If merit is single-use (not repeatable), block duplicate award to same member
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

  const handleRequestModuleReview = async (moduleId) => {
    if (!authUser || !currentMembership || !currentTeam) return;
    const existing = teamModuleAttempts.find(
      (a) => a.moduleId === moduleId && a.membershipId === currentMembership.id,
    );
    if (existing) return; // already requested or approved
    await addDoc(collection(db, 'moduleAttempts'), {
      teamId:       currentTeam.id,
      moduleId,
      userId:       authUser.uid,
      membershipId: currentMembership.id,
      status:       'requested_review',
      requestedAt:  serverTimestamp(),
    });
  };

  // ── Tasks (assigned by area leader or admins) ─────────────────────────────
  const canAssignTask = (assigneeMembershipId) => {
    if (!currentTeam || !authUser) return false;
    if (canEdit) return true;
    if (memberRole !== 'leader' || !currentMembership?.categoryId) return false;
    const assignee = teamMemberships.find((m) => m.id === assigneeMembershipId);
    return assignee?.categoryId === currentMembership.categoryId;
  };

  const handleCreateTask = async ({ assigneeMembershipId, assigneeMembershipIds, title, description, dueDate }) => {
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
  };

  const handleRequestTaskReview = async (taskId) => {
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
  };

  const handleGradeTask = async (taskId, grade) => {
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
        meritLogo:             '✓',
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
  };

  const handleCompleteTask = async (taskId) => {
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
  };

  const handleDeleteTask = async (taskId) => {
    if (!currentTeam) return;
    const task = teamTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigneeIds = task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAdmin = canEdit;
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    if (!isAssignee && !isAdmin && !isAssigner) return;
    await deleteDoc(doc(db, 'tasks', taskId));
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

  const handleUpdateEvent = async (eventId, { title, date, description, categoryId }) => {
    const evt = teamEvents.find((e) => e.id === eventId);
    if (!evt || !canEditToolItem(evt)) return;
    await updateDoc(doc(db, 'teamEvents', eventId), {
      title:       title ?? evt.title,
      date:        date != null ? new Date(date) : evt.date,
      description: description ?? evt.description ?? '',
      categoryId:  categoryId ?? evt.categoryId ?? null,
      ...lastEditedStamp(),
    });
  };

  const handleDeleteEvent = async (eventId) => {
    const evt = teamEvents.find((e) => e.id === eventId);
    if (!canEditToolItem(evt)) return;
    await deleteDoc(doc(db, 'teamEvents', eventId));
  };

  // ── Tools: SWOT / FODA (multiple entries per team) ─────────────────────────

  const handleCreateSwot = async ({ name, categoryId }) => {
    if (!currentTeam || !canEditTools) return null;
    const fakeItem = { categoryId: categoryId || null };
    if (!canEditToolItem(fakeItem)) return null;
    const ref = await addDoc(collection(db, 'teamSwots'), {
      teamId:      currentTeam.id,
      name:        (name || '').trim() || t('swot_new_entry'),
      categoryId:  categoryId || null,
      strengths:   [],
      weaknesses:  [],
      opportunities: [],
      threats:     [],
      createdAt:   serverTimestamp(),
      ...lastEditedStamp(),
    });
    return ref.id;
  };

  const handleUpdateSwot = async (swotId, updates) => {
    const swot = teamSwots.find((s) => s.id === swotId);
    if (!swot || !canEditToolItem(swot)) return;
    await updateDoc(doc(db, 'teamSwots', swotId), {
      ...updates,
      ...lastEditedStamp(),
    });
  };

  const handleDeleteSwot = async (swotId) => {
    const swot = teamSwots.find((s) => s.id === swotId);
    if (!swot || !canEditToolItem(swot)) return;
    await deleteDoc(doc(db, 'teamSwots', swotId));
  };

  // ── Tools: Eisenhower (multiple entries per team) ─────────────────────────

  const handleCreateEisenhower = async ({ name, categoryId }) => {
    if (!currentTeam || !canEditTools) return null;
    const fakeItem = { categoryId: categoryId || null };
    if (!canEditToolItem(fakeItem)) return null;
    const ref = await addDoc(collection(db, 'teamEisenhowers'), {
      teamId:     currentTeam.id,
      name:       (name || '').trim() || t('eisenhower_new_matrix'),
      categoryId: categoryId || null,
      q1: [], q2: [], q3: [], q4: [],
      createdAt:  serverTimestamp(),
      ...lastEditedStamp(),
    });
    return ref.id;
  };

  const handleUpdateEisenhower = async (id, updates) => {
    const entry = teamEisenhowers.find((e) => e.id === id);
    if (!entry || !canEditToolItem(entry)) return;
    await updateDoc(doc(db, 'teamEisenhowers', id), { ...updates, ...lastEditedStamp() });
  };

  const handleDeleteEisenhower = async (id) => {
    const entry = teamEisenhowers.find((e) => e.id === id);
    if (!entry || !canEditToolItem(entry)) return;
    await deleteDoc(doc(db, 'teamEisenhowers', id));
  };

  // ── Tools: Pugh (multiple entries per team) ─────────────────────────────────

  const handleCreatePugh = async ({ name, categoryId }) => {
    if (!currentTeam || !canEditTools) return null;
    const fakeItem = { categoryId: categoryId || null };
    if (!canEditToolItem(fakeItem)) return null;
    const ref = await addDoc(collection(db, 'teamPughs'), {
      teamId:       currentTeam.id,
      name:         (name || '').trim() || t('pugh_new_matrix'),
      categoryId:   categoryId || null,
      issue:        '',
      reference:    '',
      criteria:     [],
      alternatives: [],
      scores:       {},
      createdAt:    serverTimestamp(),
      ...lastEditedStamp(),
    });
    return ref.id;
  };

  const handleUpdatePugh = async (id, updates) => {
    const entry = teamPughs.find((e) => e.id === id);
    if (!entry || !canEditToolItem(entry)) return;
    await updateDoc(doc(db, 'teamPughs', id), { ...updates, ...lastEditedStamp() });
  };

  const handleDeletePugh = async (id) => {
    const entry = teamPughs.find((e) => e.id === id);
    if (!entry || !canEditToolItem(entry)) return;
    await deleteDoc(doc(db, 'teamPughs', id));
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{t('loading')}</div>
      </div>
    );
  }

  // ── Unauthenticated — public team browser ──────────────────────────────────
  if (!authUser) {
    return (
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
              </>
            )}

            {activeMyTeams.length === 0 && pendingMyTeams.length === 0 && otherTeams.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-12">{t('no_teams')}</div>
            )}
          </main>
        </div>
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
      { id: 'calendar',    label: t('nav_calendar'),    icon: '◐' },
      { id: 'tools',       label: t('nav_tools'),       icon: '⊙' },
      { id: 'academy',     label: t('nav_academy'),     icon: '◈' },
      { id: 'funding',     label: t('nav_funding'),     icon: '¤' },
      { id: 'tasks',       label: t('nav_tasks'),       icon: '☐' },
    ] : []),
    ...(currentMembership ? [{ id: 'myprofile', label: t('nav_myprofile'), icon: '☺' }] : []),
    ...(canEdit ? [{ id: 'admin', label: t('nav_admin'), icon: '⚙' }] : []),
  ];

  return (
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
            <span className="truncate">{`Modo Vista Previa — viendo como ${STRINGS['role_' + previewRole] ?? previewRole}.`}</span>
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
            <Suspense fallback={<div className="py-12 text-center text-slate-400 text-sm">{t('loading')}</div>}>
            {view === 'overview' && (
              <OverviewView
                team={currentTeam}
                teamMemberships={teamMemberships}
                teamMeritEvents={teamMeritEvents}
                teamModules={teamModules}
                teamCategories={teamCategories}
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
                canStrike={canStrike}
                canStrikeMember={canStrikeMember}
                canRemoveStrikeMember={canRemoveStrikeMember}
                isPlatformAdmin={isPlatformAdmin}
                careerOptions={careerOptions}
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
                meritTiers={meritTiers}
                onCreateMerit={handleCreateMerit}
                onUpdateMerit={handleUpdateMerit}
                onDeleteMerit={handleDeleteMerit}
                onRecoverMerit={handleRecoverMerit}
                canEditMerit={canEditMerit}
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

            {view === 'calendar' && isAtLeastRookie && (
              <CalendarView
                teamEvents={teamEvents}
                categories={teamCategories}
                memberships={teamMemberships}
                currentMembership={currentMembership}
                canEdit={canEdit}
                canEditTools={canEditTools}
                resolveCanEdit={canEditToolItem}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            )}

            {view === 'tools' && isAtLeastRookie && (
              <ToolsView
                team={currentTeam}
                teamEvents={teamEvents}
                teamSwots={teamSwots}
                teamEisenhowers={teamEisenhowers}
                teamPughs={teamPughs}
                teamBoards={teamBoards}
                teamMeetings={teamMeetings}
                teamGoals={teamGoals}
                categories={teamCategories}
                memberships={teamMemberships}
                currentMembership={currentMembership}
                memberRole={memberRole}
                canEdit={canEdit}
                canEditTools={canEditTools}
                resolveCanEdit={canEditToolItem}
                onCreateTask={handleCreateTask}
                canAssignTask={canAssignTask}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onCreateSwot={handleCreateSwot}
                onUpdateSwot={handleUpdateSwot}
                onDeleteSwot={handleDeleteSwot}
                onCreateEisenhower={handleCreateEisenhower}
                onUpdateEisenhower={handleUpdateEisenhower}
                onDeleteEisenhower={handleDeleteEisenhower}
                onCreatePugh={handleCreatePugh}
                onUpdatePugh={handleUpdatePugh}
                onDeletePugh={handleDeletePugh}
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
                onRequestModuleReview={handleRequestModuleReview}
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

            {view === 'tasks' && isAtLeastRookie && (
              <TasksView
                tasks={teamTasks}
                memberships={teamMemberships}
                currentMembership={currentMembership}
                onRequestTaskReview={handleRequestTaskReview}
                onGradeTask={handleGradeTask}
                onDeleteTask={handleDeleteTask}
                tsToDate={tsToDate}
              />
            )}

            {/* My Profile — full page */}
            {view === 'admin' && canEdit && (
              <AdminView
                key={currentTeam?.id}
                team={currentTeam}
                t={t}
                onSaveCareers={handleSaveTeamCareers}
                onSaveSemesters={handleSaveTeamSemesters}
                onSavePersonalityTags={handleSaveTeamPersonalityTags}
                onSaveCollabSuggestions={handleSaveTeamCollabSuggestions}
                onSaveMeritTags={handleSaveTeamMeritTags}
                onSaveMeritTiers={handleSaveTeamMeritTiers}
                onSaveSystemMeritPoints={handleSaveSystemMeritPoints}
                onSaveTaskGradePoints={handleSaveTaskGradePoints}
              />
            )}

            {view === 'myprofile' && (
              currentMembership ? (
                <ProfilePageView
                  membership={currentMembership}
                  categories={teamCategories}
                  merits={teamMerits}
                  meritEvents={teamMeritEvents.filter((e) => e.membershipId === currentMembership.id)}
                  canEditThis={isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || (authUser && (currentMembership.userId === authUser.uid || view === 'myprofile'))}
                  onSave={handleUpdateMemberProfile}
                  onReawardProfileComplete={canEdit ? handleReawardProfileComplete : null}
                  weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === currentMembership.id)}
                  onSaveWeeklyStatus={handleSaveWeeklyStatus}
                  suggestedTags={collabTagSuggestions}
                  careerOptions={careerOptions}
                  semesterOptions={semesterOptions}
                  personalityTags={personalityTags}
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
                merits={teamMerits}
                meritEvents={teamMeritEvents.filter((e) => e.membershipId === profileMember.id)}
                canEditThis={isPlatformAdmin || memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor' || (authUser && profileMember.userId === authUser.uid) || (memberRole === 'leader' && currentMembership?.categoryId && profileMember?.categoryId === currentMembership.categoryId)}
                onSave={handleUpdateMemberProfile}
                onReawardProfileComplete={canEdit ? handleReawardProfileComplete : null}
                weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === profileMember.id)}
                onSaveWeeklyStatus={handleSaveWeeklyStatus}
                suggestedTags={collabTagSuggestions}
                careerOptions={careerOptions}
                semesterOptions={semesterOptions}
                personalityTags={personalityTags}
              />
            )}
            </Suspense>
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
  );
}
