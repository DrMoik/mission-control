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

  const { personalItems, teamItems, sinceLastVisitCount, personalSummary, teamSummary } = useMemo(() => {
    const lastVisit = teamId ? parseInt(localStorage.getItem(LAST_VISIT_KEY(teamId)) || '0', 10) : 0;
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

    const myAwards = currentMembership ? awards.filter((a) => a.membershipId === currentMembership.id) : [];
    const teamAwards = awards;

    const personalItemsList = [];
    const teamItemsList = [];

    // Personal: task assignments to me
    if (currentMembership) {
      const myTasks = (teamTasks || []).filter((t) => getAssigneeIds(t).includes(currentMembership.id));
      myTasks.forEach((task) => {
        const ts = tsToDate(task.createdAt)?.getTime?.() ?? 0;
        if (ts >= sevenDaysAgo) {
          personalItemsList.push({
            type: 'task',
            date: ts,
            taskId: task.id,
            title: ensureString(task.title),
            assignedByName: task.assignedByName || '—',
          });
        }
      });
      myAwards.forEach((a) => personalItemsList.push({ ...a, date: a.ts }));
    }

    // Team: merits (all), posts
    teamAwards.forEach((a) => teamItemsList.push({ ...a, date: a.ts }));
    const posts = (teamPosts || []).filter((p) => (tsToDate(p.createdAt)?.getTime?.() ?? 0) >= sevenDaysAgo);
    if (posts.length > 0) {
      const latestTs = Math.max(...posts.map((p) => tsToDate(p.createdAt)?.getTime?.() ?? 0));
      teamItemsList.push({ type: 'posts', date: latestTs, count: posts.length });
    }

    personalItemsList.sort((a, b) => b.date - a.date);
    teamItemsList.sort((a, b) => b.date - a.date);

    const sinceCount = lastVisit > 0
      ? [...personalItemsList, ...teamItemsList].filter((i) => i.date >= lastVisit).length
      : 0;

    return {
      personalItems: personalItemsList.slice(0, 10),
      teamItems: teamItemsList.slice(0, 10),
      sinceLastVisitCount: sinceCount,
      personalSummary: {
        meritCount: myAwards.length,
        myPoints: myAwards.reduce((s, a) => s + (a.points || 0), 0),
        myTaskCount: personalItemsList.filter((i) => i.type === 'task').length,
      },
      teamSummary: {
        meritCount: teamAwards.length,
        totalPoints: teamAwards.reduce((s, a) => s + (a.points || 0), 0),
        postCount: posts.length,
      },
    };
  }, [teamId, teamMeritEvents, teamTasks, teamPosts, teamMemberships, currentMembership, tsToDate]);

  const hasPersonal = personalSummary.meritCount > 0 || personalSummary.myTaskCount > 0;
  const hasTeam = teamSummary.meritCount > 0 || teamSummary.postCount > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-semibold text-slate-200">{t('nav_inicio')}</h2>
      <p className="text-xs text-slate-500">{t('inicio_desc')}</p>

      {/* Personal summary — your wins in last 7 days */}
      {currentMembership && (
        <div className="rounded-xl border border-amber-500/20 bg-slate-800/80 p-4">
          <h3 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wide mb-3">{t('inicio_personal')} · {t('inicio_summary_7d')}</h3>
          {hasPersonal ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-3">
              {personalSummary.meritCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🏆</span>
                  <span className="text-slate-200">
                    <strong className="text-amber-400">{personalSummary.meritCount}</strong>{' '}
                    {personalSummary.meritCount === 1 ? t('inicio_my_merit') : t('inicio_my_merits')}
                    {personalSummary.myPoints > 0 && (
                      <span className="text-emerald-400/90 ml-1">(+{personalSummary.myPoints} {t('inicio_points_total')})</span>
                    )}
                  </span>
                </div>
              )}
              {personalSummary.myTaskCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">✓</span>
                  <span className="text-slate-300">
                    <strong>{personalSummary.myTaskCount}</strong>{' '}
                    {personalSummary.myTaskCount === 1 ? t('inicio_task_to_you') : t('inicio_tasks_to_you')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mb-3">{t('inicio_no_activity')}</p>
          )}
          {personalItems.length > 0 && (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
              {personalItems.map((item, i) => {
                const d = item.date ? new Date(item.date) : null;
                const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                if (item.type === 'merit') {
                  return (
                    <li key={`p-merit-${i}`} className="text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0">🏆</span>
                      <span>
                        {t('inicio_you_received')} <span className="text-emerald-400">+{item.points} pts</span> — {ensureString(item.meritName)}
                      </span>
                      <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                    </li>
                  );
                }
                if (item.type === 'task') {
                  return (
                    <li key={`p-task-${item.taskId}`} className="text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 shrink-0">✓</span>
                      <span>{t('inicio_task_assigned')}: <strong className="text-slate-200">{item.title || '—'}</strong></span>
                      <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          )}
        </div>
      )}

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

      {/* Team summary — team wins in last 7 days */}
      <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/30 to-slate-800/80 p-4">
        <h3 className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wide mb-3">{t('inicio_team')} · {t('inicio_summary_7d')}</h3>
        {sinceLastVisitCount > 0 && (
          <p className="text-[11px] text-emerald-400/90 mb-2">
            {sinceLastVisitCount} {t('inicio_since_visit')}
          </p>
        )}
        {hasTeam ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-3">
            {teamSummary.meritCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🏆</span>
                <span className="text-slate-200">
                  <strong className="text-emerald-400">{teamSummary.meritCount}</strong>{' '}
                  {teamSummary.meritCount === 1 ? t('inicio_merit_count') : t('inicio_merits_count')}
                  {teamSummary.totalPoints > 0 && (
                    <span className="text-emerald-400/90 ml-1">(+{teamSummary.totalPoints} {t('inicio_points_total')})</span>
                  )}
                </span>
              </div>
            )}
            {teamSummary.postCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-blue-400">📝</span>
                <span className="text-slate-300">
                  <strong>{teamSummary.postCount}</strong>{' '}
                  {teamSummary.postCount === 1 ? t('inicio_post_count') : t('inicio_posts_count')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mb-3">{t('inicio_no_activity')}</p>
        )}
        {teamItems.length > 0 && (
          <ul className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
            {teamItems.map((item, i) => {
              const d = item.date ? new Date(item.date) : null;
              const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
              if (item.type === 'merit') {
                return (
                  <li key={`t-merit-${i}-${item.membershipId}-${item.date}`} className="text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0">🏆</span>
                    <span>
                      <strong className="text-slate-200">{ensureString(item.memberName)}</strong> {t('inicio_merit_awarded')}{' '}
                      <span className="text-emerald-400">+{item.points} pts</span> — {ensureString(item.meritName)}
                    </span>
                    <span className="text-slate-500 shrink-0 text-[10px]">{dateStr}</span>
                  </li>
                );
              }
              if (item.type === 'posts') {
                return (
                  <li key={`t-posts-${item.date}`} className="text-slate-300 flex items-start gap-2">
                    <span className="text-blue-400 shrink-0">📝</span>
                    <button type="button" onClick={onNavigateFeed} className="text-left hover:text-slate-100 transition-colors">
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
