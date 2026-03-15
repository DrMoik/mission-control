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
//   config/       — navigation structure (NAV_DOMAINS, VIEW_TO_DOMAIN)
//   utils.js      — pure helper functions (rankOf, tsToDate, …)
//   strings.js    — t() and STRINGS (Spanish only)
//   components/   — shared modals and UI atoms
//   views/        — one file per full-page view

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  addDoc, query, where, onSnapshot, serverTimestamp, Timestamp, runTransaction,
  getDocs, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { useAuth } from './hooks/useAuth.js';
import { useFirebaseSubscriptions } from './hooks/useFirebaseSubscriptions.js';
import { useTaskHandlers } from './hooks/useTaskHandlers.js';
import { useMeritHandlers } from './hooks/useMeritHandlers.js';
import { useSessionHandlers } from './hooks/useSessionHandlers.js';
import { t, lang, STRINGS }         from './strings.js';
import {
  EMPTY_PROFILE, COLLAB_TAG_SUGGESTIONS, MERIT_DOMAINS,
  CAREER_OPTIONS, SEMESTER_OPTIONS, PERSONALITY_TAGS, PERSONALITY_TAGS_DEFAULT, MERIT_TIERS,
  MERIT_FAMILIES_DEFAULT, KNOWLEDGE_AREAS_DEFAULT, SKILL_DICTIONARY_DEFAULT, SKILL_TYPES,
  TASK_GRADES, TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT, TASK_GRADE_POINTS_TEAM_DEFAULT,
  SYSTEM_MERIT_POINTS_DEFAULT, SYSTEM_MERIT_NAMES, SELECTED_TEAM_STORAGE_KEY,
} from './constants.js';
import { atLeast, tsToDate, getL, ensureString, compressDataUrlIfNeeded, getSundayOfWeekLocal, normalizeWeekOfToSunday, getProfileMissingFieldsLabels, isWeekEligibleForPoints } from './utils.js';
import { NAV_DOMAINS, VIEW_TO_DOMAIN } from './config/navigation.js';
import RoleBadge  from './components/ui/RoleBadge.jsx';
import GoogleIcon from './components/ui/GoogleIcon.jsx';
import HamburgerIcon from './components/ui/HamburgerIcon.jsx';
import InlineTeamRename from './components/InlineTeamRename.jsx';
import SafeProfileImage from './components/ui/SafeProfileImage.jsx';
import { Home, User, Settings, ChevronDown, ChevronRight, X } from 'lucide-react';

import JoinRequestModal from './components/JoinRequestModal.jsx';

// ── Full-page views (all lazy to avoid "Cannot access X before initialization" in bundle) ──
const OverviewView     = lazy(() => import('./views/OverviewView.jsx'));
const InicioView       = lazy(() => import('./views/InicioView.jsx'));
const CategoriesView  = lazy(() => import('./views/CategoriesView.jsx'));
const LeaderboardView = lazy(() => import('./views/LeaderboardView.jsx'));
const CalendarView    = lazy(() => import('./views/CalendarView.jsx'));
const ToolsView       = lazy(() => import('./views/ToolsView.jsx'));
const AcademyView     = lazy(() => import('./views/AcademyView.jsx'));
const FeedView        = lazy(() => import('./views/FeedView.jsx'));
const ChannelsView    = lazy(() => import('./views/ChannelsView.jsx'));
const FundingView     = lazy(() => import('./views/FundingView.jsx'));
const InventoryView   = lazy(() => import('./views/InventoryView.jsx'));
const TasksView       = lazy(() => import('./views/TasksView.jsx'));
const ProfilePageView = lazy(() => import('./views/ProfilePageView.jsx'));
const SessionsView    = lazy(() => import('./views/SessionsView.jsx'));
const KnowledgeMapView = lazy(() => import('./views/KnowledgeMapView.jsx'));
const MembersView     = lazy(() => import('./views/MembersView.jsx'));
const MeritsView      = lazy(() => import('./views/MeritsView.jsx'));
const HRView          = lazy(() => import('./views/HRView.jsx'));
const AdminView       = lazy(() => import('./views/AdminView.jsx'));

export default function App() {

  // ── Team selection ─────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamIdState] = useState(null);
  const setSelectedTeamId = useCallback((teamId) => {
    setSelectedTeamIdState(teamId);
    if (teamId) {
      try { localStorage.setItem(SELECTED_TEAM_STORAGE_KEY, teamId); } catch (_) {}
    } else {
      try { localStorage.removeItem(SELECTED_TEAM_STORAGE_KEY); } catch (_) {}
    }
  }, []);
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
    teamSessions,
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
    teamInventoryItems,
    teamInventoryLoans,
    crossTeamChannels,
    crossTeamChannelInvitations,
    teamTasks,
    teamHrSuggestions,
    teamHrComplaints,
    teamSkillProposals,
    userMembershipsReady,
  } = useFirebaseSubscriptions({ authUser, selectedTeamId, userProfile });

  // Restore last selected team from localStorage on refresh (only when user has access)
  useEffect(() => {
    if (!authUser || !userMembershipsReady || selectedTeamId) return;
    try {
      const saved = localStorage.getItem(SELECTED_TEAM_STORAGE_KEY);
      if (!saved) return;
      const hasAccess = userMemberships.some(
        (m) => m.teamId === saved && (m.status === 'active' || m.status === 'suspended')
      );
      if (hasAccess) setSelectedTeamId(saved);
    } catch (_) {}
  }, [authUser, userMembershipsReady, selectedTeamId, userMemberships, setSelectedTeamId]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [navCollapsed,   setNavCollapsed]   = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [expandedDomain, setExpandedDomain] = useState(null);
  const [previewRole,    setPreviewRole]    = useState(null);   // admin "preview as role" simulation
  const [renamingTeamId, setRenamingTeamId] = useState(null);  // team picker inline rename
  const [renameValue,    setRenameValue]    = useState('');

  // Routing — derive view and profileMember from URL (must be before currentDomain)
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = (location.pathname || '/').replace(/^\/+|\/+$/g, '') || 'inicio';
  const pathParts = pathname.split('/').filter(Boolean);
  const routeView = pathParts[0] || 'inicio';  // first segment: inicio, overview, feed, profile, etc.
  const profileMemberId = routeView === 'profile' && pathParts[1] ? pathParts[1] : null;
  const view = routeView === 'profile' && !profileMemberId ? 'myprofile' : (routeView === 'profile' ? 'profile' : routeView);
  const profileMember = profileMemberId
    ? teamMemberships.find((m) => m.id === profileMemberId) || null
    : null;

  const currentDomain = VIEW_TO_DOMAIN[view] || null;
  useEffect(() => {
    if (mobileNavOpen && currentDomain) setExpandedDomain(currentDomain);
  }, [mobileNavOpen, currentDomain]);
  useEffect(() => {
    if (currentDomain) setExpandedDomain((prev) => (prev === currentDomain ? prev : currentDomain));
  }, [currentDomain]);

  const validViews = new Set(['inicio', 'overview', 'feed', 'channels', 'categories', 'members', 'merits', 'leaderboard', 'calendar', 'tools', 'academy', 'funding', 'inventory', 'tasks', 'sessions', 'mapa', 'hr', 'myprofile', 'profile', 'admin']);
  const isViewValid = validViews.has(view);

  // Redirect invalid paths to /inicio (only when team is selected, to avoid running in team picker)
  useEffect(() => {
    if (selectedTeamId && !isViewValid) navigate('/inicio', { replace: true });
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
  const canViewInventory = isMember;
  const canViewFunding = isMember;
  const canManageInventory = canEdit || (memberRole === 'leader' && currentMembership?.categoryId);
  const canUseCrossTeamChannels = effectiveAdmin || atLeast(effectiveRole, 'leader');
  const canManageCrossTeamChannels = isPlatformAdmin || atLeast(memberRole, 'leader');

  const currentTeam = useMemo(
    () => allTeams.find((t) => t.id === selectedTeamId) || null,
    [allTeams, selectedTeamId],
  );

  // Admin tab is only for team admins; redirect others to inicio (must be after canEdit is defined)
  useEffect(() => {
    if (selectedTeamId && view === 'admin' && !canEdit) navigate('/inicio', { replace: true });
  }, [selectedTeamId, view, canEdit, navigate]);
  useEffect(() => {
    if (selectedTeamId && view === 'inventory' && !canViewInventory) navigate('/inicio', { replace: true });
  }, [selectedTeamId, view, canViewInventory, navigate]);
  useEffect(() => {
    if (selectedTeamId && view === 'funding' && !canViewFunding) navigate('/inicio', { replace: true });
  }, [selectedTeamId, view, canViewFunding, navigate]);
  useEffect(() => {
    if (selectedTeamId && view === 'channels' && !canUseCrossTeamChannels) navigate('/inicio', { replace: true });
  }, [selectedTeamId, view, canUseCrossTeamChannels, navigate]);

  // Merit tags: team overrides, then platform config, then constants
  // Team tags; new teams get defaults from constants in handleCreateTeam
  const meritDomains = (currentTeam?.domains?.length ? currentTeam.domains : MERIT_DOMAINS);

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
  const meritFamilies        = (currentTeam?.meritFamilies?.length ? currentTeam.meritFamilies : MERIT_FAMILIES_DEFAULT);
  // skillDictionary: collaboration uses this only (never knowledgeAreas). knowledgeAreas: technical only for KM, tasks, modules.
  const skillDictionary = useMemo(() => {
    const teamDict = currentTeam?.skillDictionary;
    if (teamDict?.length) return teamDict;
    return SKILL_DICTIONARY_DEFAULT;
  }, [currentTeam?.skillDictionary]);
  const knowledgeAreas = useMemo(() => {
    const teamAreas = currentTeam?.knowledgeAreas;
    if (teamAreas?.length) return teamAreas;
    return skillDictionary.filter((s) => s.type === 'technical').map((s) => ({ id: s.id, name: s.label }));
  }, [currentTeam?.knowledgeAreas, skillDictionary]);

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

  // ── Audit log (transparency for admin actions) ──────────────────────────────
  const logAudit = useCallback(async (action, targetType, targetId, details = {}) => {
    if (!currentTeam || !canEdit || !authUser) return;
    try {
      await addDoc(collection(db, 'auditLog'), {
        teamId: currentTeam.id,
        userId: authUser.uid,
        userName: userProfile?.displayName || authUser.email || '—',
        action,
        targetType,
        targetId: targetId || null,
        details,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Audit log failed:', e);
    }
  }, [currentTeam, canEdit, authUser, userProfile]);

  const logChannelAudit = useCallback(async (action, channelId, details = {}) => {
    if (!currentTeam || !authUser || !canManageCrossTeamChannels) return;
    try {
      await addDoc(collection(db, 'auditLog'), {
        teamId: currentTeam.id,
        userId: authUser.uid,
        userName: currentMembership?.displayName || userProfile?.displayName || authUser.email || 'Member',
        action,
        targetType: 'crossTeamChannel',
        targetId: channelId || null,
        details: {
          actorTeamId: currentTeam.id,
          actorMembershipId: currentMembership?.id || null,
          ...details,
        },
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Channel audit failed:', e);
    }
  }, [currentTeam, authUser, currentMembership, userProfile, canManageCrossTeamChannels]);

  // Extracted handlers (hooks)
  const {
    canAssignTask,
    handleCreateTask,
    handleRequestTaskReview,
    handleCancelTaskReviewRequest,
    handleGradeTask,
    handleRejectTaskReview,
    handleCompleteTask,
    handleDeleteTask,
    handleSetBlocked,
    handleUnblockTask,
    handleUpdateTask,
  } = useTaskHandlers({
    currentTeam,
    currentMembership,
    authUser,
    userProfile,
    teamMemberships,
    teamTasks,
    canEdit,
    memberRole,
    logAudit,
  });

  const {
    canEditMerit,
    handleCreateMerit,
    handleDeleteMerit,
    handleRecoverMerit,
    handleUpdateMerit,
    handleAwardMerit,
    handleRevokeMerit,
    handleEditMeritEvent,
  } = useMeritHandlers({
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
  });

  const {
    handleCreateSession,
    handleUpdateSession,
    handleDeleteSession,
    handleSaveAttendance,
    fetchAttendance,
    canManageSessions,
  } = useSessionHandlers({
    currentTeam,
    currentMembership,
    authUser,
    userProfile,
    canEdit,
    canEditTools,
  });

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
        domains: MERIT_DOMAINS,
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
      navigate('/inicio');
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

  const handleSaveTeamMeritTags = async (domains) => {
    if (!currentTeam || (!canEdit && !isPlatformAdmin)) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      domains: Array.isArray(domains) ? domains.filter(Boolean) : [],
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
  const handleSaveTeamMeritFamilies = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      meritFamilies: Array.isArray(arr) ? arr.filter((x) => x && x.id && x.name) : [],
    });
  };
  const handleSaveTeamKnowledgeAreas = async (arr) => {
    if (!currentTeam || !canEdit) return;
    await updateDoc(doc(db, 'teams', currentTeam.id), {
      knowledgeAreas: Array.isArray(arr) ? arr.filter((x) => x && x.id && x.name) : [],
    });
  };
  const handleSaveSkillDictionary = async (arr) => {
    if (!currentTeam || !canEdit) return;
    const skills = Array.isArray(arr)
      ? arr.filter((x) => x && x.id && x.label && x.type).map((s) => ({
          id: s.id,
          label: s.label,
          type: SKILL_TYPES.includes(s.type) ? s.type : 'technical',
          description: s.description || '',
          status: s.status || 'active',
        }))
      : [];
    await updateDoc(doc(db, 'teams', currentTeam.id), { skillDictionary: skills });
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
      if (existing.status === 'active') { setSelectedTeamId(teamId); navigate('/inicio'); }
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
      helpNeedsAreas:    otherMembership.helpNeedsAreas ?? [],
      helpOfferAreas:    otherMembership.helpOfferAreas ?? [],
      learnAreas:        otherMembership.learnAreas ?? [],
      teachAreas:        otherMembership.teachAreas ?? [],
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

  const handleAddStrike = async (membershipId, evidence = {}) => {
    if (!canStrike) return;
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) return;
    if (!canStrikeMember(m)) return;
    const hasEvidence = (evidence.text || '').trim() || (evidence.link || '').trim();
    if (!hasEvidence) throw new Error('Se requiere al menos una evidencia (texto o enlace).');
    const newStrikes = (m.strikes || 0) + 1;
    const strikeHistory = Array.isArray(m.strikeHistory) ? [...m.strikeHistory] : [];
    strikeHistory.push({
      evidence: {
        ...(evidence.text?.trim() && { text: evidence.text.trim() }),
        ...(evidence.link?.trim() && { link: evidence.link.trim() }),
      },
      createdAt: Timestamp.now(),
      addedByUserId: authUser?.uid ?? '',
      addedByName: authUser?.displayName ?? '',
    });
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: newStrikes,
      strikeHistory,
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
    const newStrikes = Math.max(0, (m.strikes || 0) - 1);
    const strikeHistory = Array.isArray(m.strikeHistory) ? [...m.strikeHistory] : [];
    if (strikeHistory.length > 0) strikeHistory.pop();
    await updateDoc(doc(db, 'memberships', membershipId), {
      strikes: newStrikes,
      strikeHistory,
      status: 'active',
    });
  };

  const handleSubmitHrSuggestion = async (content, isAnonymous) => {
    if (!currentTeam || !authUser) throw new Error('Debes iniciar sesión.');
    if (!currentMembership || currentMembership.status !== 'active') throw new Error('Solo miembros activos pueden enviar sugerencias.');
    await addDoc(collection(db, 'hrSuggestions'), {
      teamId: currentTeam.id,
      content: (content || '').trim(),
      isAnonymous: !!isAnonymous,
      authorId: isAnonymous ? null : authUser.uid,
      authorName: isAnonymous ? null : (userProfile?.displayName ?? authUser.displayName ?? ''),
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  };

  const handleSubmitHrComplaint = async (data) => {
    if (!currentTeam || !authUser) throw new Error('Debes iniciar sesión.');
    if (!currentMembership || currentMembership.status !== 'active') throw new Error('Solo miembros activos pueden enviar quejas.');
    const hasEvidence =
      (data.evidence?.text || '').trim() ||
      (data.evidence?.link || '').trim();
    if (!hasEvidence) throw new Error('Se requiere evidencia (texto o enlace).');
    await addDoc(collection(db, 'hrComplaints'), {
      teamId: currentTeam.id,
      type: data.type || 'team',
      targetCategoryId: data.targetCategoryId || null,
      targetMembershipId: data.targetMembershipId || null,
      content: (data.content || '').trim(),
      evidence: {
        text: (data.evidence?.text || '').trim() || null,
        link: (data.evidence?.link || '').trim() || null,
      },
      authorId: authUser.uid,
      authorName: userProfile?.displayName ?? authUser.displayName ?? '',
      createdAt: serverTimestamp(),
    });
  };

  const SUGGESTION_MERIT_POINTS = [50, 100, 150, 200];

  const handleAcceptHrSuggestion = async (suggestionId, points) => {
    if (!currentTeam || !canEdit) return;
    const suggestion = teamHrSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion || (suggestion.status || 'pending') !== 'pending') return;
    if (!suggestion.authorId) throw new Error(t('hr_suggestion_anonymous_no_merit'));
    if (!SUGGESTION_MERIT_POINTS.includes(points)) return;
    const membership = teamMemberships.find((m) => m.userId === suggestion.authorId);
    if (!membership) throw new Error(t('hr_suggestion_author_not_found'));
    const eventRef = await addDoc(collection(db, 'meritEvents'), {
      teamId:               currentTeam.id,
      membershipId:         membership.id,
      meritId:              null,
      meritName:            SYSTEM_MERIT_NAMES.suggestionAccepted,
      meritLogo:            'bulb',
      points:               points,
      type:                 'award',
      evidence:             suggestion.id,
      autoAward:            false,
      systemGiven:          true,
      awardedByUserId:      authUser?.uid || null,
      awardedByName:        userProfile?.displayName   || authUser?.email || '—',
      achievementTypes:     ['creatividad'],
      createdAt:            serverTimestamp(),
    });
    await updateDoc(doc(db, 'hrSuggestions', suggestionId), {
      status:       'accepted',
      reviewedAt:   serverTimestamp(),
      reviewedByUserId: authUser?.uid,
      reviewedByName:   userProfile?.displayName ?? authUser?.email ?? '—',
      meritPoints:     points,
      meritEventId:    eventRef.id,
    });
    await logAudit('accept_suggestion', 'hrSuggestion', suggestionId, { points, membershipId: membership.id });
  };

  const handleDismissHrSuggestion = async (suggestionId) => {
    if (!currentTeam || !canEdit) return;
    const suggestion = teamHrSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion || (suggestion.status || 'pending') !== 'pending') return;
    await updateDoc(doc(db, 'hrSuggestions', suggestionId), {
      status:       'dismissed',
      reviewedAt:   serverTimestamp(),
      reviewedByUserId: authUser?.uid,
      reviewedByName:   userProfile?.displayName ?? authUser?.email ?? '—',
    });
    await logAudit('dismiss_suggestion', 'hrSuggestion', suggestionId, {});
  };

  const handleReconsiderHrSuggestion = async (suggestionId) => {
    if (!currentTeam || !canEdit) return;
    const suggestion = teamHrSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion || (suggestion.status || 'pending') !== 'dismissed') return;
    await updateDoc(doc(db, 'hrSuggestions', suggestionId), {
      status:       'pending',
      reviewedAt:   null,
      reviewedByUserId: null,
      reviewedByName:   null,
    });
  };

  const handleProposeSkill = async (labelOrObj, proposedType = 'technical') => {
    if (!currentTeam || !currentMembership) return;
    const label = typeof labelOrObj === 'string' ? (labelOrObj || '').trim() : (labelOrObj?.label || '').trim();
    const type = typeof labelOrObj === 'object' ? (labelOrObj.type || 'technical') : proposedType;
    if (!label) return;
    await addDoc(collection(db, 'skillProposals'), {
      teamId: currentTeam.id,
      label,
      proposedType: SKILL_TYPES.includes(type) ? type : 'technical',
      proposedByMembershipId: currentMembership.id,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
  };

  const handleApproveSkillProposal = async (proposalId) => {
    if (!currentTeam || !canEdit) return;
    const prop = teamSkillProposals.find((p) => p.id === proposalId);
    if (!prop || (prop.status || 'pending') !== 'pending') return;
    const newLabel = (prop.label || prop.proposedLabel || '').trim();
    if (!newLabel) return;
    const newType = prop.proposedType || 'technical';
    const newAreaId = newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '') || 'skill';
    const dict = (currentTeam.skillDictionary?.length ? currentTeam.skillDictionary : skillDictionary);
    const existingIds = new Set(dict.map((s) => s.id));
    let finalId = newAreaId;
    let suffix = 0;
    while (existingIds.has(finalId)) { suffix++; finalId = `${newAreaId}_${suffix}`; }
    const newSkill = { id: finalId, label: newLabel, type: newType };
    const updatedDict = [...dict, newSkill];
    await updateDoc(doc(db, 'teams', currentTeam.id), { skillDictionary: updatedDict });
    await updateDoc(doc(db, 'skillProposals', proposalId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedByUserId: authUser?.uid,
      approvedByName: userProfile?.displayName ?? authUser?.email ?? '—',
      newSkillId: finalId,
      newSkillLabel: newLabel,
      newSkillType: newType,
    });
    await logAudit('approve_skill_proposal', 'skillProposal', proposalId, { newSkillId: finalId, newSkillLabel: newLabel });
  };

  const handleRejectSkillProposal = async (proposalId) => {
    if (!currentTeam || !canEdit) return;
    const prop = teamSkillProposals.find((p) => p.id === proposalId);
    if (!prop || (prop.status || 'pending') !== 'pending') return;
    await updateDoc(doc(db, 'skillProposals', proposalId), {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
      reviewedByUserId: authUser?.uid,
      reviewedByName: userProfile?.displayName ?? authUser?.email ?? '—',
    });
    await logAudit('reject_skill_proposal', 'skillProposal', proposalId, {});
  };

  const handleUpdateMemberProfile = async (membershipId, updates) => {
    if (!currentTeam) throw new Error('No hay equipo activo.');
    const m = teamMemberships.find((mm) => mm.id === membershipId);
    if (!m) throw new Error('Miembro no encontrado.');
    const isOwnProfile = authUser && (m.userId === authUser.uid || currentMembership?.id === membershipId);
    const canEditThis = isPlatformAdmin || isOwnProfile; // Only platform admin and the member can edit profile
    if (!canEditThis) throw new Error('No tienes permiso para editar este perfil.');
    // Compress data URLs to stay under Firestore 1MB doc limit (same limit for all members)
    const maxBytes = 120000;
    const photoURL = await compressDataUrlIfNeeded(updates.photoURL ?? m.photoURL ?? null, maxBytes);
    const coverPhotoURL = await compressDataUrlIfNeeded(updates.coverPhotoURL ?? m.coverPhotoURL ?? '', maxBytes);
    const payload = {
      ...(isOwnProfile && { userId: authUser.uid }), // Ensure userId is set on own profile (fixes legacy docs)
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
      helpNeedsAreas:         Array.isArray(updates.helpNeedsAreas)         ? updates.helpNeedsAreas.filter(Boolean)         : (m.helpNeedsAreas ?? []),
      helpOfferAreas:         Array.isArray(updates.helpOfferAreas)         ? updates.helpOfferAreas.filter(Boolean)         : (m.helpOfferAreas ?? []),
      learnAreas:             Array.isArray(updates.learnAreas)             ? updates.learnAreas.filter(Boolean)             : (m.learnAreas ?? []),
      teachAreas:             Array.isArray(updates.teachAreas)             ? updates.teachAreas.filter(Boolean)             : (m.teachAreas ?? []),
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
    // Update only the membership being edited (simple: one doc, one rule check)
    const idsToUpdate = [membershipId];
    await updateDoc(doc(db, 'memberships', membershipId), payload);

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
    const hasAreas = (arr) => Array.isArray(arr) && arr.length > 0;
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
      (hasAreas(payload.helpNeedsAreas) || hasNonEmptyTagList(payload.lookingForHelpIn)) &&
      (hasAreas(payload.helpOfferAreas) || hasNonEmptyTagList(payload.iCanHelpWith)) &&
      (hasAreas(payload.learnAreas) || hasNonEmptyTagList(payload.skillsToLearnThisSemester)) &&
      (hasAreas(payload.teachAreas) || hasNonEmptyTagList(payload.skillsICanTeach)) &&
      isNonEmptyBilingual(payload.funFact) &&
      isNonEmptyString(payload.personalityTag) &&
      hasBirthdate &&
      hasCulture;

    // Perfil completo: award once per membership. If merit was deleted, re-award (per-membership doc is source of truth).
    // Merit award runs after profile save; if it fails (e.g. rules), profile save still succeeds.
    let meritNewlyAwarded = false;
    if (isProfileComplete && currentTeam && authUser) {
      const meritEventsRef = collection(db, 'meritEvents');
      const midsToAward = idsToUpdate.filter((mid) => teamMemberships.some((mm) => mm.id === mid));
      if (midsToAward.length > 0) {
        try {
          await runTransaction(db, async (tx) => {
            for (const mid of midsToAward) {
              const awardId = `auto_profile_complete_50_${currentTeam.id}_${mid}`;
              const awardRef = doc(meritEventsRef, awardId);
              const awardSnap = await tx.get(awardRef);
              if (awardSnap.exists()) continue; // already awarded for this membership
              meritNewlyAwarded = true;
              tx.set(awardRef, {
                teamId:            currentTeam.id,
                membershipId:      mid,
                meritId:           null,
                meritName:         SYSTEM_MERIT_NAMES.profileComplete,
                meritLogo:         'checked-shield',
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
        } catch (meritErr) {
          console.warn('Perfil completo merit award failed (profile saved):', meritErr);
        }
      }
    }
    // Firestore listener will update teamMemberships; profileMember derives from it
    const missingFields = isProfileComplete ? [] : getProfileMissingFieldsLabels(payload);
    return { meritAwarded: meritNewlyAwarded, profileComplete: !!isProfileComplete, missingFields };
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
    const weekOf = normalizeWeekOfToSunday(weekOfParam) || weekOfParam || getSundayOfWeekLocal();
    const docId = `${membershipId}_${weekOf}`;
    const statusRef = doc(db, 'weeklyStatuses', docId);
    const meritEventsRef = collection(db, 'meritEvents');
    const doAward = isWeekEligibleForPoints(weekOf);
    const hasContent = (s) => typeof s === 'string' && s.trim().length > 0;
    const allThreeFilled = hasContent(advanced) && hasContent(failedAt) && hasContent(learned);

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

      // Only one system award per week: grant 25 pts only on first save when all three fields are filled
      if (!existed && doAward && allThreeFilled) {
        const eventRef = doc(meritEventsRef);
        tx.set(eventRef, {
          teamId:       currentTeam.id,
          membershipId,
          meritId:      null,
          meritName:    SYSTEM_MERIT_NAMES.weeklyUpdate,
          meritLogo:    'quill',
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
            meritLogo:    'archery-target',
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
    return { weeklyMeritAwarded: didAwardThisWeek, weeklyMeritPoints: didAwardThisWeek ? systemMeritPoints.weeklyUpdate : 0 };
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

  const handleApproveModuleAttempt = async (attemptId) => {
    if (!currentTeam || !currentMembership || !canEdit) return;
    await updateDoc(doc(db, 'moduleAttempts', attemptId), {
      status:      'approved',
      completedAt: serverTimestamp(),
      approvedBy:  currentMembership.id,
      approvedAt:  serverTimestamp(),
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

  const canEditInventoryItem = React.useCallback((item) => {
    if (!item) return false;
    if (canEdit) return true;
    return memberRole === 'leader'
      && !!currentMembership?.categoryId
      && item.categoryId === currentMembership.categoryId;
  }, [canEdit, memberRole, currentMembership]);

  const handleCreateInventoryItem = async (data) => {
    if (!currentTeam || !canManageInventory) return;
    const payload = {
      name: String(data?.name || '').trim(),
      type: ['tool', 'consumable', 'equipment'].includes(data?.type) ? data.type : 'equipment',
      quantity: Math.max(0, Number(data?.quantity) || 0),
      unit: String(data?.unit || '').trim(),
      minQuantity: Math.max(0, Number(data?.minQuantity) || 0),
      categoryId: data?.categoryId || null,
      notes: String(data?.notes || '').trim(),
    };
    if (!payload.name) return;
    if (!canEdit && payload.categoryId !== currentMembership?.categoryId) return;
    await addDoc(collection(db, 'teamInventoryItems'), {
      teamId: currentTeam.id,
      createdAt: serverTimestamp(),
      ...payload,
      ...lastEditedStamp(),
    });
  };

  const handleUpdateInventoryItem = async (itemId, updates) => {
    const item = teamInventoryItems.find((entry) => entry.id === itemId);
    if (!item || !canEditInventoryItem(item)) return;
    const nextCategoryId = updates?.categoryId ?? item.categoryId ?? null;
    if (!canEdit && nextCategoryId !== currentMembership?.categoryId) return;
    await updateDoc(doc(db, 'teamInventoryItems', itemId), {
      name: String(updates?.name ?? item.name ?? '').trim(),
      type: ['tool', 'consumable', 'equipment'].includes(updates?.type) ? updates.type : (item.type || 'equipment'),
      quantity: Math.max(0, Number(updates?.quantity ?? item.quantity) || 0),
      unit: String(updates?.unit ?? item.unit ?? '').trim(),
      minQuantity: Math.max(0, Number(updates?.minQuantity ?? item.minQuantity) || 0),
      categoryId: nextCategoryId,
      notes: String(updates?.notes ?? item.notes ?? '').trim(),
      ...lastEditedStamp(),
    });
  };

  const handleDeleteInventoryItem = async (itemId) => {
    const item = teamInventoryItems.find((entry) => entry.id === itemId);
    if (!item || !canEditInventoryItem(item)) return;
    await deleteDoc(doc(db, 'teamInventoryItems', itemId));
  };

  const handleCreateInventoryLoan = async ({ itemId, membershipId, quantity = 1, dueDate = '', notes = '' }) => {
    if (!currentTeam || !canManageInventory || !currentMembership) return;
    const item = teamInventoryItems.find((entry) => entry.id === itemId);
    const borrower = teamMemberships.find((entry) => entry.id === membershipId);
    if (!item || !borrower) return;
    if (item.type === 'consumable') return;
    const qty = Math.max(1, Number(quantity) || 1);
    const activeLoaned = teamInventoryLoans
      .filter((loan) => loan.itemId === itemId && !loan.returnedAt)
      .reduce((sum, loan) => sum + (Number(loan.quantity) || 0), 0);
    const available = Math.max(0, Number(item.quantity || 0) - activeLoaned);
    if (qty > available) return;
    await addDoc(collection(db, 'teamInventoryLoans'), {
      teamId: currentTeam.id,
      itemId,
      itemName: item.name || '',
      membershipId,
      borrowerName: borrower.displayName || 'Member',
      quantity: qty,
      dueDate: dueDate || '',
      notes: String(notes || '').trim(),
      loanedAt: serverTimestamp(),
      loanedByMembershipId: currentMembership.id,
      loanedByName: currentMembership.displayName || userProfile?.displayName || authUser?.email || 'Unknown',
      returnedAt: null,
      returnedByMembershipId: null,
      returnedByName: '',
    });
  };

  const handleReturnInventoryLoan = async (loanId) => {
    if (!currentTeam || !canManageInventory || !currentMembership) return;
    const loan = teamInventoryLoans.find((entry) => entry.id === loanId);
    if (!loan || loan.returnedAt) return;
    await updateDoc(doc(db, 'teamInventoryLoans', loanId), {
      returnedAt: serverTimestamp(),
      returnedByMembershipId: currentMembership.id,
      returnedByName: currentMembership.displayName || userProfile?.displayName || authUser?.email || 'Unknown',
    });
  };

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

  const handleCreatePost = async (content, mediaUrls = []) => {
    if (!authUser || !currentTeam || !isMember) return;
    const normalizedMediaUrls = Array.isArray(mediaUrls)
      ? mediaUrls.map((url) => String(url || '').trim()).filter(Boolean)
      : [];

    await addDoc(collection(db, 'posts'), {
      teamId:      currentTeam.id,
      content,
      ...(normalizedMediaUrls.length > 0 ? {
        imageUrls: normalizedMediaUrls,
        imageUrl: normalizedMediaUrls[0],
      } : {}),
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

  const deleteInChunks = async (refs, chunkSize = 400) => {
    for (let i = 0; i < refs.length; i += chunkSize) {
      const batch = writeBatch(db);
      refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  };

  // Cross-team channels
  const handleCreateCrossTeamChannel = async ({ name, description = '', invitedTeamIds = [] }) => {
    const trimmedName = String(name || '').trim();
    if (!authUser || !currentTeam || !trimmedName || !canManageCrossTeamChannels) return;

    const uniqueInvitedTeamIds = [...new Set(
      invitedTeamIds
        .map((teamId) => String(teamId || '').trim())
        .filter((teamId) => teamId && teamId !== currentTeam.id),
    )];

    const channelRef = doc(collection(db, 'crossTeamChannels'));
    const batch = writeBatch(db);
    const actorName = currentMembership?.displayName || userProfile?.displayName || authUser.email || 'Member';

    batch.set(channelRef, {
      createdByTeamId: currentTeam.id,
      createdByTeamName: currentTeam.name || 'Equipo',
      createdByMembershipId: currentMembership?.id || null,
      createdByMembershipName: actorName,
      name: trimmedName,
      description: String(description || '').trim(),
      memberTeamIds: [currentTeam.id],
      pendingTeamIds: uniqueInvitedTeamIds,
      declinedTeamIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
    });

    batch.set(doc(db, 'crossTeamChannelTeams', `${channelRef.id}_${currentTeam.id}`), {
      channelId: channelRef.id,
      channelName: trimmedName,
      channelDescription: String(description || '').trim(),
      ownerTeamId: currentTeam.id,
      ownerTeamName: currentTeam.name || 'Equipo',
      teamId: currentTeam.id,
      teamName: currentTeam.name || 'Equipo',
      status: 'owner',
      invitedByMembershipId: currentMembership?.id || null,
      invitedByMembershipName: actorName,
      invitedAt: serverTimestamp(),
      respondedAt: serverTimestamp(),
      respondedByMembershipId: currentMembership?.id || null,
      updatedAt: serverTimestamp(),
    });

    uniqueInvitedTeamIds.forEach((teamId) => {
      const invitedTeam = allTeams.find((team) => team.id === teamId);
      batch.set(doc(db, 'crossTeamChannelTeams', `${channelRef.id}_${teamId}`), {
        channelId: channelRef.id,
        channelName: trimmedName,
        channelDescription: String(description || '').trim(),
        ownerTeamId: currentTeam.id,
        ownerTeamName: currentTeam.name || 'Equipo',
        teamId,
        teamName: invitedTeam?.name || 'Equipo',
        status: 'pending',
        invitedByMembershipId: currentMembership?.id || null,
        invitedByMembershipName: actorName,
        invitedAt: serverTimestamp(),
        respondedAt: null,
        respondedByMembershipId: null,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    await logChannelAudit('channel_create', channelRef.id, {
      invitedTeamIds: uniqueInvitedTeamIds,
      channelName: trimmedName,
    });
  };

  const handleInviteTeamsToChannel = async (channelId, invitedTeamIds = []) => {
    const channel = crossTeamChannels.find((entry) => entry.id === channelId);
    if (!channel || !currentTeam || !canManageCrossTeamChannels) return;
    if (!isPlatformAdmin && channel.createdByTeamId !== currentTeam.id) return;

    const relationSnap = await getDocs(query(collection(db, 'crossTeamChannelTeams'), where('channelId', '==', channelId)));
    const activeOrPendingTeamIds = new Set(
      relationSnap.docs
        .map((docSnap) => docSnap.data())
        .filter((entry) => ['owner', 'member', 'pending'].includes(entry.status))
        .map((entry) => entry.teamId),
    );
    const existingDeclined = new Set(
      relationSnap.docs
        .map((docSnap) => docSnap.data())
        .filter((entry) => ['declined', 'left'].includes(entry.status))
        .map((entry) => entry.teamId),
    );
    const teamIdsToInvite = [...new Set(
      invitedTeamIds
        .map((teamId) => String(teamId || '').trim())
        .filter((teamId) => teamId && !activeOrPendingTeamIds.has(teamId) && teamId !== channel.createdByTeamId),
    )];

    if (!teamIdsToInvite.length) return;

    const batch = writeBatch(db);
    const actorName = currentMembership?.displayName || userProfile?.displayName || authUser?.email || 'Member';

    const channelUpdates = {
      pendingTeamIds: arrayUnion(...teamIdsToInvite),
      updatedAt: serverTimestamp(),
    };
    const declinedIdsToClear = teamIdsToInvite.filter((teamId) => existingDeclined.has(teamId));
    if (declinedIdsToClear.length) {
      channelUpdates.declinedTeamIds = arrayRemove(...declinedIdsToClear);
    }
    batch.update(doc(db, 'crossTeamChannels', channelId), channelUpdates);

    teamIdsToInvite.forEach((teamId) => {
      const invitedTeam = allTeams.find((team) => team.id === teamId);
      batch.set(doc(db, 'crossTeamChannelTeams', `${channelId}_${teamId}`), {
        channelId,
        channelName: channel.name || 'Canal',
        channelDescription: channel.description || '',
        ownerTeamId: channel.createdByTeamId,
        ownerTeamName: channel.createdByTeamName || currentTeam.name || 'Equipo',
        teamId,
        teamName: invitedTeam?.name || 'Equipo',
        status: 'pending',
        invitedByMembershipId: currentMembership?.id || null,
        invitedByMembershipName: actorName,
        invitedAt: serverTimestamp(),
        respondedAt: null,
        respondedByMembershipId: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    await logChannelAudit('channel_invite', channelId, { invitedTeamIds: teamIdsToInvite });
  };

  const handleAcceptCrossTeamInvitation = async (invitationId) => {
    if (!authUser || !selectedTeamId || !canManageCrossTeamChannels) return;
    const invitation = crossTeamChannelInvitations.find((entry) => entry.id === invitationId);
    if (!invitation || invitation.teamId !== selectedTeamId || invitation.status !== 'pending') return;

    await runTransaction(db, async (tx) => {
      const invitationRef = doc(db, 'crossTeamChannelTeams', invitationId);
      const channelRef = doc(db, 'crossTeamChannels', invitation.channelId);
      const [invitationSnap, channelSnap] = await Promise.all([tx.get(invitationRef), tx.get(channelRef)]);
      if (!invitationSnap.exists() || !channelSnap.exists()) return;

      const invitationData = invitationSnap.data();
      const channelData = channelSnap.data();
      if (invitationData.status !== 'pending' || invitationData.teamId !== selectedTeamId) return;

      const memberTeamIds = new Set(channelData.memberTeamIds || []);
      memberTeamIds.add(selectedTeamId);
      const pendingTeamIds = (channelData.pendingTeamIds || []).filter((teamId) => teamId !== selectedTeamId);
      const declinedTeamIds = (channelData.declinedTeamIds || []).filter((teamId) => teamId !== selectedTeamId);

      tx.update(channelRef, {
        memberTeamIds: [...memberTeamIds],
        pendingTeamIds,
        declinedTeamIds,
        updatedAt: serverTimestamp(),
      });
      tx.update(invitationRef, {
        status: 'member',
        respondedAt: serverTimestamp(),
        respondedByMembershipId: currentMembership?.id || null,
        updatedAt: serverTimestamp(),
      });
    });
    await logChannelAudit('channel_accept_invite', invitation.channelId, { targetTeamId: selectedTeamId });
  };

  const handleDeclineCrossTeamInvitation = async (invitationId) => {
    if (!authUser || !selectedTeamId || !canManageCrossTeamChannels) return;
    const invitation = crossTeamChannelInvitations.find((entry) => entry.id === invitationId);
    if (!invitation || invitation.teamId !== selectedTeamId || invitation.status !== 'pending') return;

    await runTransaction(db, async (tx) => {
      const invitationRef = doc(db, 'crossTeamChannelTeams', invitationId);
      const channelRef = doc(db, 'crossTeamChannels', invitation.channelId);
      const [invitationSnap, channelSnap] = await Promise.all([tx.get(invitationRef), tx.get(channelRef)]);
      if (!invitationSnap.exists() || !channelSnap.exists()) return;

      const invitationData = invitationSnap.data();
      const channelData = channelSnap.data();
      if (invitationData.status !== 'pending' || invitationData.teamId !== selectedTeamId) return;

      const pendingTeamIds = (channelData.pendingTeamIds || []).filter((teamId) => teamId !== selectedTeamId);
      const declinedTeamIds = new Set(channelData.declinedTeamIds || []);
      declinedTeamIds.add(selectedTeamId);

      tx.update(channelRef, {
        pendingTeamIds,
        declinedTeamIds: [...declinedTeamIds],
        updatedAt: serverTimestamp(),
      });
      tx.update(invitationRef, {
        status: 'declined',
        respondedAt: serverTimestamp(),
        respondedByMembershipId: currentMembership?.id || null,
        updatedAt: serverTimestamp(),
      });
    });
    await logChannelAudit('channel_decline_invite', invitation.channelId, { targetTeamId: selectedTeamId });
  };

  const handleUpdateCrossTeamChannel = async (channelId, updates) => {
    const channel = crossTeamChannels.find((entry) => entry.id === channelId);
    if (!channel || !canManageCrossTeamChannels) return;
    if (!isPlatformAdmin && channel.createdByTeamId !== selectedTeamId) return;

    const nextName = typeof updates?.name === 'string' ? updates.name.trim() : channel.name;
    const nextDescription = typeof updates?.description === 'string' ? updates.description.trim() : channel.description;
    if (!nextName) return;

    const relationSnap = await getDocs(query(collection(db, 'crossTeamChannelTeams'), where('channelId', '==', channelId)));
    const batch = writeBatch(db);
    batch.update(doc(db, 'crossTeamChannels', channelId), {
      name: nextName,
      description: nextDescription || '',
      updatedAt: serverTimestamp(),
    });
    relationSnap.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        channelName: nextName,
        channelDescription: nextDescription || '',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    await logChannelAudit('channel_update', channelId, { channelName: nextName });
  };

  const handleCreateCrossTeamMessage = async (channelId, content) => {
    const channel = crossTeamChannels.find((entry) => entry.id === channelId);
    const trimmedContent = String(content || '').trim();
    if (!channel || !trimmedContent || !currentTeam || !authUser || !canManageCrossTeamChannels) return;
    const relationSnap = await getDoc(doc(db, 'crossTeamChannelTeams', `${channelId}_${currentTeam.id}`));
    const relation = relationSnap.exists() ? relationSnap.data() : null;
    const isLegacyMember = (channel.memberTeamIds || []).includes(currentTeam.id);
    if (!isPlatformAdmin && !['owner', 'member'].includes(relation?.status || '') && !isLegacyMember) return;

    await addDoc(collection(db, 'crossTeamMessages'), {
      channelId,
      teamId: currentTeam.id,
      teamName: currentTeam.name || 'Equipo',
      membershipId: currentMembership?.id || null,
      authorName: currentMembership?.displayName || userProfile?.displayName || authUser.email || 'Member',
      content: trimmedContent,
      createdAt: serverTimestamp(),
    });

    try {
      await updateDoc(doc(db, 'crossTeamChannels', channelId), {
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Channel timestamp update failed:', e);
    }
    await logChannelAudit('channel_message', channelId);
  };

  const handleLeaveCrossTeamChannel = async (channelId) => {
    const channel = crossTeamChannels.find((entry) => entry.id === channelId);
    if (!channel || !selectedTeamId || !canManageCrossTeamChannels) return;
    if (channel.createdByTeamId === selectedTeamId) return;
    if (!(channel.memberTeamIds || []).includes(selectedTeamId)) return;

    await runTransaction(db, async (tx) => {
      const channelRef = doc(db, 'crossTeamChannels', channelId);
      const invitationRef = doc(db, 'crossTeamChannelTeams', `${channelId}_${selectedTeamId}`);
      const channelSnap = await tx.get(channelRef);
      if (!channelSnap.exists()) return;

      const channelData = channelSnap.data();
      tx.update(channelRef, {
        memberTeamIds: (channelData.memberTeamIds || []).filter((teamId) => teamId !== selectedTeamId),
        updatedAt: serverTimestamp(),
      });

      const invitationSnap = await tx.get(invitationRef);
      if (invitationSnap.exists()) {
        tx.update(invitationRef, {
          status: 'left',
          respondedAt: serverTimestamp(),
          respondedByMembershipId: currentMembership?.id || null,
          updatedAt: serverTimestamp(),
        });
      }
    });
    await logChannelAudit('channel_leave', channelId, { targetTeamId: selectedTeamId });
  };

  const handleDeleteCrossTeamChannel = async (channelId) => {
    const channel = crossTeamChannels.find((entry) => entry.id === channelId);
    if (!channel || !canManageCrossTeamChannels) return;
    if (!isPlatformAdmin && channel.createdByTeamId !== selectedTeamId) return;

    const invitationsSnap = await getDocs(query(collection(db, 'crossTeamChannelTeams'), where('channelId', '==', channelId)));
    const messagesSnap = await getDocs(query(collection(db, 'crossTeamMessages'), where('channelId', '==', channelId)));
    await deleteInChunks([
      ...invitationsSnap.docs.map((docSnap) => docSnap.ref),
      ...messagesSnap.docs.map((docSnap) => docSnap.ref),
      doc(db, 'crossTeamChannels', channelId),
    ]);
    await logChannelAudit('channel_delete', channelId);
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
    if (!membership?.id) return;
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-content-tertiary text-sm">{t('loading')}</div>
      </div>
    );
  }

  // ── Unauthenticated — public team browser ──────────────────────────────────
  if (!authUser) {
    return (
        <div className="min-h-screen bg-surface-base text-content-primary flex flex-col">
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
          <main className="flex-1 w-full">
            <div className="page-container max-w-content-wide mx-auto">
              <p className="text-content-secondary text-sm mb-6">{t('sign_in_google')} — {t('app_subtitle')}</p>
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
                <div className="col-span-2 text-center text-content-tertiary text-sm py-12">{t('no_teams_sign_in')}</div>
              )}
            </div>
            </div>
          </main>
        </div>
    );
  }

  // ── Authenticated, no team selected — team picker ──────────────────────────
  if (!selectedTeamId) {
    // Wait for user memberships to load so teams appear immediately (avoids refresh after Google login)
    if (authUser && !userMembershipsReady) {
      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center">
          <div className="text-content-tertiary text-sm">{t('loading')}</div>
        </div>
      );
    }
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
        <div className="min-h-screen bg-surface-base text-content-primary flex flex-col">
          <div className="shell-accent-bar shrink-0" />
          {joinTarget && (
            <JoinRequestModal
              team={joinTarget}
              categories={allTeamCategories[joinTarget.id] || []}
              onSubmit={(categoryId, motivation) => { handleJoinTeam(joinTarget.id, categoryId, motivation); setJoinTarget(null); }}
              onCancel={() => setJoinTarget(null)}
            />
          )}

          <header className="shell-header px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight text-content-primary">{t('app_name')}</h1>
              <p className="text-xs text-content-secondary hidden sm:block">{t('app_subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {userProfile?.photoURL ? (
                <SafeProfileImage
                  src={userProfile.photoURL}
                  fallback={<div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold">{(userProfile?.displayName || '?')[0].toUpperCase()}</div>}
                  className="w-7 h-7 rounded-full"
                  alt=""
                />
              ) : null}
              <span className="text-sm text-slate-200 hidden sm:inline">{userProfile?.displayName}</span>
              {isPlatformAdmin && (
                <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                  {t('platform_admin')}
                </span>
              )}
              <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-white underline">{t('sign_out')}</button>
            </div>
          </header>

          <main className="flex-1 w-full">
            <div className="page-container max-w-content-wide mx-auto section-spacing">
            {activeMyTeams.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('your_teams')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeMyTeams.map((team) => {
                    const mem = userMemberships.find((m) => m.teamId === team.id);
                    return (
                      <div key={team.id} className="bg-surface-raised rounded-xl p-4 space-y-1 border border-slate-700/40 shadow-surface-sm hover:border-primary/40 hover:shadow-surface-md transition-all duration-200">
                        <button onClick={() => { setSelectedTeamId(team.id); navigate('/inicio'); }}
                          className="w-full text-left hover:text-primary transition-colors active:scale-[0.98]">
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
                    <div key={team.id} className="bg-surface-raised rounded-xl p-4 space-y-2 border border-slate-700/40 shadow-surface-sm hover:border-primary/40 hover:shadow-surface-md transition-all duration-200">
                      <h3 className="font-bold text-sm">{team.name}</h3>
                      {getL(team.overview?.tagline, lang) && <p className="text-xs text-slate-400 italic">"{getL(team.overview.tagline, lang)}"</p>}
                      {getL(team.overview?.about, lang)   && <p className="text-xs text-slate-500 line-clamp-2">{getL(team.overview.about, lang)}</p>}
                      <button onClick={() => setJoinTarget(team)}
                        className="text-xs bg-primary text-content-inverse font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors">
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
              <div className="text-center text-content-tertiary text-sm py-12">{t('no_teams')}</div>
            )}
            </div>
          </main>
        </div>
    );
  }

  // ── Main app shell (team selected) ─────────────────────────────────────────

  const visibleDomains = NAV_DOMAINS
    .map((domain) => ({
      ...domain,
      items: domain.items.filter((item) => {
        if (item.access === 'admin') return canEdit;
        if (item.access === 'leader') return canEditTools;
        if (item.access === 'member') return isMember;
        return true;
      }),
    }))
    .filter((domain) => domain.items.length > 0);
  const navItems = visibleDomains.flatMap((d) => d.items);

  return (
      <div className="h-screen overflow-hidden bg-surface-base text-content-primary flex flex-col">
        {/* ── Top accent bar ── */}
        <div className="shell-accent-bar shrink-0" />

        {/* ── Mobile nav overlay (accordion domains) ── */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <nav className="relative z-50 w-64 shell-sidebar p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">{currentTeam?.name}</span>
                <button onClick={() => setMobileNavOpen(false)} className="text-content-tertiary hover:text-content-primary p-1" title={t('close') || 'Cerrar'} aria-label={t('close') || 'Cerrar'}><X className="w-5 h-5" strokeWidth={2} /></button>
              </div>
              <button onClick={() => { goToView('inicio'); setMobileNavOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded flex items-center gap-2 text-sm transition-colors
                  ${view === 'inicio' ? 'shell-nav-active font-semibold' : 'text-content-secondary shell-nav-hover'}`}>
                <Home className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                <span>{t('nav_inicio')}</span>
              </button>
              {isAtLeastRookie && visibleDomains.map((domain) => {
                const isExpanded = expandedDomain === domain.id;
                const isActiveDomain = currentDomain === domain.id;
                return (
                  <div key={domain.id} className="mt-1">
                    <button
                      onClick={() => setExpandedDomain(isExpanded ? null : domain.id)}
                      className={`w-full text-left px-3 py-2.5 rounded flex items-center justify-between text-sm transition-colors
                        ${isActiveDomain ? 'shell-nav-active' : 'text-content-secondary shell-nav-hover'}`}>
                      <div className="flex items-center gap-2">
                        <domain.Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                        <span>{t(domain.labelKey)}</span>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {domain.items.map((item) => (
                          <button key={item.id} onClick={() => { goToView(item.id); setMobileNavOpen(false); }}
                            title={item.id === 'hr' ? t('hr_page_title') : undefined}
                            className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors
                              ${view === item.id ? 'shell-nav-active font-semibold' : 'text-content-tertiary shell-nav-hover'}`}>
                            <item.Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span>{t(item.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-3 border-t border-slate-800 space-y-2 mt-3">
                {currentMembership && (
                  <button onClick={() => { goToView('myprofile'); setMobileNavOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded flex items-center gap-2 text-sm
                      ${view === 'myprofile' ? 'shell-nav-active font-semibold' : 'text-content-tertiary shell-nav-hover'}`}>
                    <User className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                    <span>{t('nav_myprofile')}</span>
                  </button>
                )}
                <button onClick={() => { setSelectedTeamId(null); setPreviewRole(null); setMobileNavOpen(false); }}
                  className="w-full text-left text-xs text-content-tertiary hover:text-content-primary px-2 py-1.5">
                  ← {t('switch_team')}
                </button>
                <button onClick={handleSignOut} className="w-full text-left text-xs text-content-tertiary hover:text-content-primary px-2 py-1.5">
                  {t('sign_out')}
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* ── Header ── */}
        <header className="shell-header px-4 py-3 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-content-tertiary hover:text-content-primary w-8 h-8 flex items-center justify-center rounded shell-nav-hover transition-colors shrink-0"
              title={t('expand_menu')}
              aria-label={t('expand_menu')}>
              <HamburgerIcon />
            </button>
            {/* Desktop sidebar collapse toggle */}
            <button onClick={() => setNavCollapsed((c) => !c)}
              className="hidden md:flex text-content-tertiary hover:text-content-primary w-8 h-8 items-center justify-center rounded shell-nav-hover transition-colors shrink-0"
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
            {canEdit && (
              <button onClick={() => goToView('admin')}
                className="p-2 rounded shell-nav-hover text-content-tertiary hover:text-content-primary transition-colors"
                title={t('nav_admin')}
                aria-label={t('nav_admin')}>
                <Settings className="w-5 h-5" strokeWidth={1.5} />
              </button>
            )}
            {/* Profile avatar button */}
            <button onClick={() => currentMembership && goToView('myprofile')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title={t('nav_myprofile')}
              aria-label={t('nav_myprofile')}>
              {(currentMembership?.photoURL || userProfile?.photoURL) ? (
                <SafeProfileImage
                  src={currentMembership?.photoURL || userProfile?.photoURL}
                  fallback={
                    <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-500 flex items-center justify-center text-sm font-bold">
                      {(currentMembership?.displayName || userProfile?.displayName || '?')[0].toUpperCase()}
                    </div>
                  }
                  className="w-8 h-8 rounded-full object-cover object-[center_top] border-2 border-slate-600 hover:border-primary transition-colors"
                  alt=""
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-500 flex items-center justify-center text-sm font-bold">
                  {(userProfile?.displayName || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-content-secondary hidden lg:inline">{currentMembership?.displayName || userProfile?.displayName}</span>
            </button>
            <button onClick={() => { setSelectedTeamId(null); setPreviewRole(null); }}
              className="text-xs text-content-tertiary hover:text-content-primary transition-colors hidden sm:block">
              {t('switch_team')}
            </button>
            <button onClick={handleSignOut} className="text-xs text-content-tertiary hover:text-content-primary transition-colors hidden sm:block">
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
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Desktop sidebar (domain groups) */}
          <nav className={`hidden md:block shell-sidebar ${navCollapsed ? 'w-12' : 'w-48'} p-2 shrink-0 transition-all duration-200 flex flex-col min-w-0 overflow-hidden`}>
            <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <button onClick={() => goToView('inicio')}
                className={`w-full text-left rounded flex items-center gap-2 text-sm transition-colors flex-shrink-0
                  ${navCollapsed ? 'justify-center p-2 min-h-[36px]' : 'px-2 py-2'}
                  ${view === 'inicio' ? 'shell-nav-active font-semibold' : 'text-content-secondary shell-nav-hover'}`}>
                <Home className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                {!navCollapsed && <span className="truncate">{t('nav_inicio')}</span>}
              </button>
              {isAtLeastRookie && visibleDomains.map((domain) => {
                const isExpanded = expandedDomain === domain.id || navCollapsed;
                const isActiveDomain = currentDomain === domain.id;
                return (
                  <div key={domain.id} className="flex-shrink-0">
                    <button
                      onClick={() => {
                        if (navCollapsed) setNavCollapsed(false);
                        setExpandedDomain(expandedDomain === domain.id ? null : domain.id);
                      }}
                      className={`w-full text-left rounded flex items-center gap-2 text-sm transition-colors
                        ${navCollapsed ? 'justify-center p-2 min-h-[36px]' : 'px-2 py-2'}
                        ${isActiveDomain ? 'shell-nav-active' : 'text-content-secondary shell-nav-hover'}`}>
                      <domain.Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                      {!navCollapsed && (
                        <>
                          <span className="truncate flex-1">{t(domain.labelKey)}</span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                        </>
                      )}
                    </button>
                    {!navCollapsed && isExpanded && (
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        {domain.items.map((item) => (
                          <button key={item.id} onClick={() => goToView(item.id)}
                            title={item.id === 'hr' ? t('hr_page_title') : undefined}
                            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-sm transition-colors
                              ${view === item.id ? 'shell-nav-active font-semibold' : 'text-content-tertiary shell-nav-hover'}`}>
                            <item.Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span className="truncate">{t(item.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto shell-content">
            <div className="page-container min-h-full">
              <Suspense fallback={<div className="py-16 text-center text-content-tertiary text-sm">{t('loading')}</div>}>
            {view === 'inicio' && (
              <InicioView
                team={currentTeam}
                teamTasks={teamTasks}
                teamWeeklyStatuses={teamWeeklyStatuses}
                teamMeritEvents={teamMeritEvents}
                teamMemberships={teamMemberships}
                currentMembership={currentMembership}
                tsToDate={tsToDate}
                onNavigateTasks={() => navigate('/tasks')}
                onNavigateProfile={() => navigate('/profile')}
                onNavigateOverview={() => navigate('/overview')}
                onNavigateFeed={() => navigate('/feed')}
              />
            )}

            {view === 'overview' && (
              <OverviewView
                onViewProfile={handleViewProfile}
                team={currentTeam}
                teamMemberships={teamMemberships}
                teamMeritEvents={teamMeritEvents}
                teamPosts={teamPosts}
                teamSessions={teamSessions}
                teamModules={teamModules}
                teamCategories={teamCategories}
                canEdit={canEdit}
                onSave={handleSaveOverview}
                onNavigateFeed={() => navigate('/feed')}
                onNavigateSessions={() => navigate('/sessions')}
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

            {view === 'channels' && canUseCrossTeamChannels && (
              <ChannelsView
                currentTeam={currentTeam}
                currentMembership={currentMembership}
                allTeams={allTeams}
                channels={crossTeamChannels}
                pendingInvitations={crossTeamChannelInvitations}
                onCreateChannel={handleCreateCrossTeamChannel}
                onInviteTeams={handleInviteTeamsToChannel}
                onAcceptInvitation={handleAcceptCrossTeamInvitation}
                onDeclineInvitation={handleDeclineCrossTeamInvitation}
                onUpdateChannel={handleUpdateCrossTeamChannel}
                onCreateMessage={handleCreateCrossTeamMessage}
                onLeaveChannel={handleLeaveCrossTeamChannel}
                onDeleteChannel={handleDeleteCrossTeamChannel}
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
                complaintsAgainstMember={teamHrComplaints.filter((c) => c.type === 'person' && c.targetMembershipId)}
                canEdit={canEdit}
                canStrike={canStrike}
                canStrikeMember={canStrikeMember}
                canRemoveStrikeMember={canRemoveStrikeMember}
                isPlatformAdmin={isPlatformAdmin}
                careerOptions={careerOptions}
                knowledgeAreas={knowledgeAreas}
                skillDictionary={skillDictionary}
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
                domains={meritDomains}
                meritTiers={meritTiers}
                meritFamilies={meritFamilies}
                knowledgeAreas={knowledgeAreas}
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
                weeklyStatuses={teamWeeklyStatuses}
                tasks={teamTasks}
                categories={teamCategories}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'calendar' && isAtLeastRookie && (
              <CalendarView
                teamEvents={teamEvents}
                teamSessions={teamSessions}
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
                teamMemberships={teamMemberships}
                canEdit={canEdit}
                knowledgeAreas={knowledgeAreas}
                onCreateModule={handleCreateModule}
                onUpdateModule={handleUpdateModule}
                onDeleteModule={handleDeleteModule}
                onRequestModuleReview={handleRequestModuleReview}
                onApproveModuleAttempt={handleApproveModuleAttempt}
              />
            )}

            {view === 'inventory' && canViewInventory && (
              <InventoryView
                items={teamInventoryItems}
                loans={teamInventoryLoans}
                categories={teamCategories}
                memberships={teamMemberships}
                canManageInventory={canManageInventory}
                currentMembership={currentMembership}
                canEditItem={canEditInventoryItem}
                onCreateItem={handleCreateInventoryItem}
                onUpdateItem={handleUpdateInventoryItem}
                onDeleteItem={handleDeleteInventoryItem}
                onCreateLoan={handleCreateInventoryLoan}
                onReturnLoan={handleReturnInventoryLoan}
              />
            )}

            {view === 'funding' && canViewFunding && (
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

            {view === 'sessions' && isAtLeastRookie && (
              <SessionsView
                sessions={teamSessions}
                memberships={teamMemberships}
                categories={teamCategories}
                canManageSessions={canManageSessions}
                authUser={authUser}
                onCreateSession={handleCreateSession}
                onUpdateSession={handleUpdateSession}
                onDeleteSession={handleDeleteSession}
                onSaveAttendance={handleSaveAttendance}
                fetchAttendance={fetchAttendance}
              />
            )}

            {view === 'mapa' && isAtLeastRookie && (
              <KnowledgeMapView
                memberships={teamMemberships}
                moduleAttempts={teamModuleAttempts}
                modules={teamModules}
                knowledgeAreas={knowledgeAreas}
                onViewProfile={handleViewProfile}
              />
            )}

            {view === 'tasks' && isAtLeastRookie && (
              <TasksView
                tasks={teamTasks}
                memberships={teamMemberships}
                currentMembership={currentMembership}
                canViewAllTasks={canEdit}
                onRequestTaskReview={handleRequestTaskReview}
                onCancelTaskReviewRequest={handleCancelTaskReviewRequest}
                onGradeTask={handleGradeTask}
                onRejectTaskReview={handleRejectTaskReview}
                onDeleteTask={handleDeleteTask}
                onSetBlocked={handleSetBlocked}
                onUnblockTask={handleUnblockTask}
                onUpdateTask={handleUpdateTask}
                knowledgeAreas={knowledgeAreas}
                tsToDate={tsToDate}
              />
            )}

            {view === 'hr' && isAtLeastRookie && (
              <HRView
                suggestions={teamHrSuggestions}
                complaints={teamHrComplaints}
                categories={teamCategories}
                memberships={teamMemberships}
                canViewHr={canEdit}
                isFaculty={isPlatformAdmin || memberRole === 'facultyAdvisor'}
                authUserId={authUser?.uid}
                onSubmitSuggestion={handleSubmitHrSuggestion}
                onSubmitComplaint={handleSubmitHrComplaint}
                onAcceptSuggestion={handleAcceptHrSuggestion}
                onDismissSuggestion={handleDismissHrSuggestion}
                onReconsiderSuggestion={handleReconsiderHrSuggestion}
                suggestionMeritPoints={[50, 100, 150, 200]}
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
                onSaveMeritTags={handleSaveTeamMeritTags}
                onSaveMeritTiers={handleSaveTeamMeritTiers}
                onSaveMeritFamilies={handleSaveTeamMeritFamilies}
                onSaveKnowledgeAreas={handleSaveTeamKnowledgeAreas}
                onSaveSkillDictionary={handleSaveSkillDictionary}
                skillProposals={teamSkillProposals}
                memberships={teamMemberships}
                onApproveSkillProposal={handleApproveSkillProposal}
                onRejectSkillProposal={handleRejectSkillProposal}
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
                  tasks={teamTasks}
                  modules={teamModules}
                  moduleAttempts={teamModuleAttempts}
                  meritFamilies={meritFamilies}
                  knowledgeAreas={knowledgeAreas}
                  skillDictionary={skillDictionary}
                  allMeritEvents={teamMeritEvents}
                  canEditThis={isPlatformAdmin || (authUser && currentMembership.userId === authUser.uid)}
                  onSave={handleUpdateMemberProfile}
                  weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === currentMembership.id)}
                  onSaveWeeklyStatus={handleSaveWeeklyStatus}
                  onProposeSkill={handleProposeSkill}
                  careerOptions={careerOptions}
                  semesterOptions={semesterOptions}
                  personalityTags={personalityTags}
                  onNavigate={goToView}
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
                tasks={teamTasks}
                modules={teamModules}
                moduleAttempts={teamModuleAttempts}
                meritFamilies={meritFamilies}
                knowledgeAreas={knowledgeAreas}
                skillDictionary={skillDictionary}
                allMeritEvents={teamMeritEvents}
                canEditThis={isPlatformAdmin || (authUser && profileMember.userId === authUser.uid)}
                onSave={handleUpdateMemberProfile}
                weeklyStatuses={teamWeeklyStatuses.filter((s) => s.membershipId === profileMember.id)}
                onSaveWeeklyStatus={handleSaveWeeklyStatus}
                onProposeSkill={handleProposeSkill}
                careerOptions={careerOptions}
                semesterOptions={semesterOptions}
                personalityTags={personalityTags}
                onNavigate={goToView}
              />
            )}
            </Suspense>
            </div>
          </main>
        </div>

        {/* ── Mobile bottom nav bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex items-center justify-around px-1 py-1 z-30">
          {navItems.slice(0, 5).map((tab) => {
            const Icon = tab.Icon;
            return (
              <button key={tab.id} onClick={() => goToView(tab.id)}
                title={tab.id === 'hr' ? t('hr_page_title') : undefined}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded flex-1 transition-colors
                  ${view === tab.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                <span className="text-[9px] leading-none truncate">{t(tab.labelKey)}</span>
              </button>
            );
          })}
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
