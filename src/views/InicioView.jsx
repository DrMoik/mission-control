// ─── InicioView ───────────────────────────────────────────────────────────────
// Personal dashboard: my summary, my commitments, quick links.

import React, { useMemo, useEffect } from 'react';
import { Trophy, Check, ArrowRight, Zap } from 'lucide-react';
import { t } from '../strings.js';
import { ensureString } from '../utils.js';
import MyCommitmentsCard from '../components/MyCommitmentsCard.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { getTaskAssigneeIds } from '../utils/taskHelpers.js';

const LAST_VISIT_KEY = (teamId) => `mission-control:lastVisit_${teamId}`;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function InicioView({
  team,
  teamTasks = [],
  teamWeeklyStatuses = [],
  teamMeritEvents = [],
  teamMemberships = [],
  currentMembership,
  tsToDate,
  onNavigateTasks,
  onNavigateProfile,
  onNavigateOverview,
  onNavigateFeed,
}) {
  const teamId = team?.id;

  useEffect(() => {
    if (!teamId) return;
    return () => {
      try {
        localStorage.setItem(LAST_VISIT_KEY(teamId), String(Date.now()));
      } catch (_) {}
    };
  }, [teamId]);

  const { personalItems, personalSummary } = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const awards = (teamMeritEvents || [])
      .filter((e) => e.type === 'award')
      .map((e) => ({
        type: 'merit',
        ts: tsToDate(e.createdAt)?.getTime?.() ?? 0,
        membershipId: e.membershipId,
        meritName: e.meritName || 'Logro',
        points: e.points ?? 0,
      }))
      .filter((a) => a.ts >= sevenDaysAgo);

    const myAwards = currentMembership ? awards.filter((a) => a.membershipId === currentMembership.id) : [];
    const personalItemsList = [];

    if (currentMembership) {
      const myTasks = (teamTasks || []).filter((t) => getTaskAssigneeIds(t).includes(currentMembership.id));
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

    personalItemsList.sort((a, b) => b.date - a.date);

    return {
      personalItems: personalItemsList.slice(0, 10),
      personalSummary: {
        meritCount: myAwards.length,
        myPoints: myAwards.reduce((s, a) => s + (a.points || 0), 0),
        myTaskCount: personalItemsList.filter((i) => i.type === 'task').length,
      },
    };
  }, [teamId, teamMeritEvents, teamTasks, teamMemberships, currentMembership, tsToDate]);

  const hasPersonal = personalSummary.meritCount > 0 || personalSummary.myTaskCount > 0;
  const displayName = ensureString(currentMembership?.displayName) || '';

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Greeting header ── */}
      <div className="animate-fade-in">
        {currentMembership && (
          <p className="text-sm text-content-tertiary mb-0.5">{getGreeting()}{displayName ? ', ' : ''}<span className="text-gradient-primary font-semibold">{displayName}</span></p>
        )}
        <h2 className="text-2xl font-bold text-gradient tracking-tight">{t('nav_inicio')}</h2>
        <p className="text-sm text-content-secondary mt-1">{t('inicio_desc')}</p>
      </div>

      {/* ── Personal summary ── */}
      {currentMembership && (
        <div className="rounded-xl border border-primary/25 bg-surface-raised shadow-glow-sm overflow-hidden animate-slide-up animate-delay-1 relative">
          {/* Ambient glow blob */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/8 blur-3xl pointer-events-none" />

          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">
              {t('inicio_personal')} · {t('inicio_summary_7d')}
            </span>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/40">
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-amber-400">{personalSummary.meritCount}</div>
              <div className="text-[10px] text-content-tertiary uppercase tracking-wider mt-0.5">{t('inicio_my_merits')}</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-primary">{personalSummary.myPoints}</div>
              <div className="text-[10px] text-content-tertiary uppercase tracking-wider mt-0.5">{t('inicio_points_total')}</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-content-primary">{personalSummary.myTaskCount}</div>
              <div className="text-[10px] text-content-tertiary uppercase tracking-wider mt-0.5">{t('inicio_tasks_to_you')}</div>
            </div>
          </div>

          {/* Activity timeline */}
          {personalItems.length > 0 ? (
            <div className="px-4 py-3 border-t border-slate-700/40">
              <div className="border-l-2 border-primary/20 pl-4 ml-1 space-y-3 max-h-44 overflow-y-auto">
                {personalItems.map((item, i) => {
                  const d = item.date ? new Date(item.date) : null;
                  const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div
                      key={item.type === 'merit' ? `p-merit-${i}` : `p-task-${item.taskId}`}
                      className="relative flex items-start gap-2.5 text-xs animate-slide-up"
                      style={{ animationDelay: `${120 + i * 40}ms` }}
                    >
                      {/* Timeline dot */}
                      <span className="absolute -left-[22px] top-1 w-2 h-2 rounded-full border-2 border-surface-raised bg-primary/60" />
                      {item.type === 'merit' ? (
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" strokeWidth={2} />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                      )}
                      <span className="text-content-secondary flex-1 min-w-0">
                        {item.type === 'merit' ? (
                          <>{t('inicio_you_received')} <span className="text-amber-400 font-semibold">+{item.points} pts</span> — {ensureString(item.meritName)}</>
                        ) : (
                          <>{t('inicio_task_assigned')}: <span className="text-content-primary font-medium">{item.title || '—'}</span></>
                        )}
                      </span>
                      <span className="text-content-tertiary shrink-0 text-[10px]">{dateStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 border-t border-slate-700/40">
              <p className="text-xs text-content-tertiary italic">{t('inicio_no_activity')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── My commitments ── */}
      {currentMembership && (
        <div className="animate-slide-up animate-delay-2">
          <MyCommitmentsCard
            tasks={teamTasks}
            weeklyStatuses={teamWeeklyStatuses}
            currentMembership={currentMembership}
            tsToDate={tsToDate}
            onNavigateTasks={onNavigateTasks}
            onNavigateProfile={onNavigateProfile}
          />
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-slide-up animate-delay-3">
        {[
          { label: t('nav_overview'), sub: t('inicio_link_team_card'), onClick: onNavigateOverview },
          { label: t('nav_feed'),     sub: t('inicio_link_activity'),   onClick: onNavigateFeed },
          { label: t('nav_tasks'),    sub: t('inicio_link_tasks'),      onClick: onNavigateTasks },
        ].map(({ label, sub, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group p-3.5 rounded-xl border border-slate-600/50 bg-surface-raised text-left transition-all duration-200 hover:border-primary/40 hover:shadow-glow-sm hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-content-primary">{label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-content-tertiary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150" strokeWidth={2} />
            </div>
            <span className="text-xs text-content-tertiary">{sub}</span>
          </button>
        ))}
      </div>

      {!currentMembership && (
        <p className="text-xs text-content-tertiary italic">{t('inicio_no_membership')}</p>
      )}
    </div>
  );
}
