// ─── LeaderboardView ──────────────────────────────────────────────────────────
// Ranks members by total merit points for the current season (3 months)
// or all-time.  Medal colours for top 3 positions.

import React, { useState } from 'react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { RoleBadge, MemberAvatar } from '../components/ui/index.js';

function getAssigneeIds(task) {
  return task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
}

/**
 * @param {{
 *   leaderboard:  { allTime: object[], season: object[] },
 *   memberships:  object[],
 *   weeklyStatuses: object[],
 *   tasks: object[],
 *   categories: object[],
 *   onViewProfile:function(membership)
 * }} props
 */
export default function LeaderboardView({ leaderboard, memberships, weeklyStatuses = [], tasks = [], categories = [], onViewProfile }) {
  const [tab,  setTab] = useState('season');
  const [mode, setMode] = useState('points'); // 'points' | 'effort'

  const pointsRows = tab === 'season' ? leaderboard.season : leaderboard.allTime;

  const effortRows = React.useMemo(() => {
    const weeklyByMember = {};
    (weeklyStatuses || []).forEach((s) => {
      weeklyByMember[s.membershipId] = (weeklyByMember[s.membershipId] || 0) + 1;
    });
    const tasksByMember = {};
    (tasks || []).forEach((task) => {
      const ids = getAssigneeIds(task);
      if (task.status === 'completed') {
        ids.forEach((id) => { tasksByMember[id] = (tasksByMember[id] || 0) + 1; });
      }
    });
    return memberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const cat = categories.find((c) => c.id === m.categoryId);
        return {
          membershipId: m.id,
          name: m.displayName || 'Member',
          role: m.role,
          categoryName: ensureString(cat?.name, lang) || 'Unassigned',
          weeklyCount: weeklyByMember[m.id] || 0,
          tasksDone: tasksByMember[m.id] || 0,
          effort: (weeklyByMember[m.id] || 0) + (tasksByMember[m.id] || 0) * 2,
        };
      })
      .sort((a, b) => b.effort - a.effort);
  }, [memberships, weeklyStatuses, tasks, categories]);

  const rows = mode === 'effort' ? effortRows : pointsRows;
  const showEffortCols = mode === 'effort';

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Leaderboard</h2>

      {/* Points / Effort mode toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode('points')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            mode === 'points' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {t('leaderboard_by_points')}
        </button>
        <button
          onClick={() => setMode('effort')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            mode === 'effort' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {t('leaderboard_by_effort')}
        </button>
      </div>

      {/* Season / All-time (only for points mode) */}
      {mode === 'points' && (
        <div className="flex gap-2">
          {[['season', t('this_season')], ['allTime', t('all_time_tab')]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                tab === id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-xs text-slate-500 text-center">{t('no_merit_data')}</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">{t('th_member')}</th>
                <th className="px-3 py-2">{t('th_role')}</th>
                <th className="px-3 py-2">{t('th_category')}</th>
                {showEffortCols ? (
                  <>
                    <th className="px-3 py-2 text-right">{t('leaderboard_weekly_count')}</th>
                    <th className="px-3 py-2 text-right">{t('leaderboard_tasks_done')}</th>
                  </>
                ) : (
                  <th className="px-3 py-2 text-right">{t('points')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.membershipId} className="border-b border-slate-700 hover:bg-slate-700/30">
                  <td className="px-3 py-2">
                    {/* Medal colours: gold / silver / bronze */}
                    <span className={`font-bold text-base ${
                      i === 0 ? 'text-yellow-400' :
                      i === 1 ? 'text-slate-300'  :
                      i === 2 ? 'text-amber-600'  : 'text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <MemberAvatar
                      membership={memberships.find((m) => m.id === row.membershipId) || { displayName: row.name, photoURL: null }}
                      onViewProfile={onViewProfile}
                    />
                  </td>
                  <td className="px-3 py-2"><RoleBadge role={row.role} /></td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{row.categoryName}</td>
                  {showEffortCols ? (
                    <>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{row.weeklyCount ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">{row.tasksDone ?? 0}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">{row.points}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
