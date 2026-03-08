// ─── InicioView ───────────────────────────────────────────────────────────────
// Personal dashboard: quick summary of commitments and activity.
// Non-disruptive news center — merits, task assignments, feed posts (aggregated).

import React, { useMemo, useEffect } from 'react';
import { t } from '../strings.js';
import { ensureString } from '../utils.js';
import MyCommitmentsCard from '../components/MyCommitmentsCard.jsx';

const LAST_VISIT_KEY = (teamId) => `mission-control:lastVisit_${teamId}`;

function getAssigneeIds(task) {
  return task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
}

export default function InicioView({
  team,
  teamTasks = [],
  teamWeeklyStatuses = [],
  teamMeritEvents = [],
  teamPosts = [],
  teamMemberships = [],
  currentMembership,
  tsToDate,
  onNavigateTasks,
  onNavigateProfile,
  onNavigateOverview,
  onNavigateFeed,
}) {
  const teamId = team?.id;

  // Store last visit on unmount
  useEffect(() => {
    if (!teamId) return;
    return () => {
      try {
        localStorage.setItem(LAST_VISIT_KEY(teamId), String(Date.now()));
      } catch (_) {}
    };
  }, [teamId]);

  const { activityItems, sinceLastVisitCount } = useMemo(() => {
    const lastVisit = teamId ? parseInt(localStorage.getItem(LAST_VISIT_KEY(teamId)) || '0', 10) : 0;
    const items = [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Merit awards (last 7 days)
    const awards = (teamMeritEvents || [])
      .filter((e) => e.type === 'award')
      .map((e) => ({
        type: 'merit',
        ts: tsToDate(e.createdAt)?.getTime?.() ?? 0,
        membershipId: e.membershipId,
        memberName: teamMemberships.find((m) => m.id === e.membershipId)?.displayName || '—',
        meritName: e.meritName || 'Logro',
        points: e.points ?? 0,
      }))
      .filter((a) => a.ts >= sevenDaysAgo);

    awards.forEach((a) => items.push({ ...a, date: a.ts }));

    // Task assignments to current user (last 7 days)
    if (currentMembership) {
      const myTasks = (teamTasks || []).filter((t) => getAssigneeIds(t).includes(currentMembership.id));
      myTasks.forEach((task) => {
        const ts = tsToDate(task.createdAt)?.getTime?.() ?? 0;
        if (ts >= sevenDaysAgo) {
          items.push({
            type: 'task',
            date: ts,
            taskId: task.id,
            title: ensureString(task.title),
            assignedByName: task.assignedByName || '—',
          });
        }
      });
    }

    // Feed posts — aggregate by count (one item: "X new posts")
    const posts = (teamPosts || []).filter((p) => {
      const ts = tsToDate(p.createdAt)?.getTime?.() ?? 0;
      return ts >= sevenDaysAgo;
    });
    if (posts.length > 0) {
      const latestTs = Math.max(...posts.map((p) => tsToDate(p.createdAt)?.getTime?.() ?? 0));
      items.push({
        type: 'posts',
        date: latestTs,
        count: posts.length,
      });
    }

    items.sort((a, b) => b.date - a.date);
    const recent = items.slice(0, 15);

    const sinceCount = lastVisit > 0 ? items.filter((i) => i.date >= lastVisit).length : 0;

    return { activityItems: recent, sinceLastVisitCount: sinceCount };
  }, [teamId, teamMeritEvents, teamTasks, teamPosts, teamMemberships, currentMembership, tsToDate]);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-semibold text-slate-200">{t('nav_inicio')}</h2>
      <p className="text-xs text-slate-500">{t('inicio_desc')}</p>

      {/* My commitments — personal responsibility dashboard */}
      {currentMembership && (
        <MyCommitmentsCard
          tasks={teamTasks}
          weeklyStatuses={teamWeeklyStatuses}
          currentMembership={currentMembership}
          tsToDate={tsToDate}
          onNavigateTasks={onNavigateTasks}
          onNavigateProfile={onNavigateProfile}
        />
      )}

      {/* Activity feed — news: merits, tasks, feed posts */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('inicio_activity')}</h3>
        {sinceLastVisitCount > 0 && (
          <p className="text-[11px] text-emerald-400/90 mb-2">
            {sinceLastVisitCount} {t('inicio_since_visit')}
          </p>
        )}
        {activityItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic">{t('inicio_no_activity')}</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {activityItems.map((item, i) => {
              const d = item.date ? new Date(item.date) : null;
              const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
              if (item.type === 'merit') {
                return (
                  <li key={`merit-${i}-${item.membershipId}-${item.date}`} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0">🏆</span>
                    <span>
                      <strong className="text-slate-200">{ensureString(item.memberName)}</strong> {t('inicio_merit_awarded')}{' '}
                      <span className="text-emerald-400">+{item.points} pts</span> — {ensureString(item.meritName)}
                    </span>
                    <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                  </li>
                );
              }
              if (item.type === 'task') {
                return (
                  <li key={`task-${item.taskId}`} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-amber-400 shrink-0">✓</span>
                    <span>
                      {t('inicio_task_assigned')}: <strong className="text-slate-200">{item.title || '—'}</strong>
                      {item.assignedByName && <span className="text-slate-500"> ({item.assignedByName})</span>}
                    </span>
                    <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                  </li>
                );
              }
              if (item.type === 'posts') {
                return (
                  <li key={`posts-${item.date}`} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-blue-400 shrink-0">📝</span>
                    <button
                      type="button"
                      onClick={onNavigateFeed}
                      className="text-left hover:text-slate-100 transition-colors"
                    >
                      <strong className="text-slate-200">{item.count}</strong>{' '}
                      {item.count === 1 ? t('inicio_post_feed') : t('inicio_posts_feed')}
                    </button>
                    <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        )}
      </div>

      {/* Quick links — non-disruptive access to key areas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onNavigateOverview}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_overview')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_team_card')}</span>
        </button>
        <button
          type="button"
          onClick={onNavigateFeed}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_feed')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_activity')}</span>
        </button>
        <button
          type="button"
          onClick={onNavigateTasks}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_tasks')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_tasks')}</span>
        </button>
      </div>

      {!currentMembership && (
        <p className="text-xs text-slate-500 italic">{t('inicio_no_membership')}</p>
      )}
    </div>
  );
}
