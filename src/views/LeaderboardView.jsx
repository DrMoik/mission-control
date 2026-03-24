// ─── LeaderboardView ──────────────────────────────────────────────────────────
// Ranks members by total merit points for the current season (3 months)
// or all-time.  Medal colours for top 3 positions.

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { RoleBadge, MemberAvatar } from '../components/ui/index.js';
import { getTaskAssigneeIds } from '../utils/taskHelpers.js';

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
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'name' | 'category'
  const [sortDir, setSortDir] = useState('desc'); // desc = high first (default for rankings)

  const pointsRowsRaw = (tab === 'season' ? leaderboard?.season : leaderboard?.allTime) ?? [];
  const pointsByMember = React.useMemo(
    () => Object.fromEntries(pointsRowsRaw.map((row) => [row.membershipId, row.points ?? 0])),
    [pointsRowsRaw],
  );
  const pointsRankByMember = React.useMemo(() => {
    const ranked = memberships
      .filter((membership) => membership.status === 'active')
      .map((membership) => ({
        membershipId: membership.id,
        points: pointsByMember[membership.id] ?? 0,
        name: membership.displayName || 'Member',
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (a.name || '').localeCompare(b.name || '');
      });

    return Object.fromEntries(ranked.map((row, index) => [row.membershipId, index + 1]));
  }, [memberships, pointsByMember]);
  const pointsRows = React.useMemo(
    () => pointsRowsRaw.map((row) => ({ ...row, pointsRank: pointsRankByMember[row.membershipId] ?? null })),
    [pointsRowsRaw, pointsRankByMember],
  );

  const effortRows = React.useMemo(() => {
    const weeklyByMember = {};
    (weeklyStatuses || []).forEach((s) => {
      weeklyByMember[s.membershipId] = (weeklyByMember[s.membershipId] || 0) + 1;
    });
    const tasksByMember = {};
    (tasks || []).forEach((task) => {
      const ids = getTaskAssigneeIds(task);
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
          pointsRank: pointsRankByMember[m.id] ?? null,
          weeklyCount: weeklyByMember[m.id] || 0,
          tasksDone: tasksByMember[m.id] || 0,
          effort: (weeklyByMember[m.id] || 0) + (tasksByMember[m.id] || 0) * 2,
        };
      })
      .sort((a, b) => b.effort - a.effort);
  }, [memberships, weeklyStatuses, tasks, categories, pointsRankByMember]);

  const sortedRows = React.useMemo(() => {
    const arr = mode === 'effort' ? [...effortRows] : [...pointsRows];
    if (sortBy === 'score') {
      arr.sort((a, b) => {
        const va = mode === 'effort' ? (a.effort ?? 0) : (a.points ?? 0);
        const vb = mode === 'effort' ? (b.effort ?? 0) : (b.points ?? 0);
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    } else if (sortBy === 'name') {
      arr.sort((a, b) => {
        const cmp = (a.name || '').localeCompare(b.name || '');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else if (sortBy === 'category') {
      arr.sort((a, b) => {
        const cmp = (a.categoryName || '').localeCompare(b.categoryName || '');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return arr;
  }, [mode, pointsRows, effortRows, sortBy, sortDir]);

  const rows = sortedRows;
  const toggleSort = (col) => {
    setSortBy(col);
    setSortDir((d) => (sortBy === col ? (d === 'asc' ? 'desc' : 'asc') : (col === 'score' ? 'desc' : 'asc')));
  };
  const SortTh = ({ col, label, className = '' }) => (
    <th className={className}>
      <button type="button" onClick={() => toggleSort(col)} className="text-left hover:text-content-primary transition-colors flex items-center gap-0.5">
        {label}
        {sortBy === col && <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />}
      </button>
    </th>
  );
  const showEffortCols = mode === 'effort';

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-gradient tracking-tight">Leaderboard</h2>
      </div>

      {/* Points / Effort mode toggle */}
      <div className="flex flex-wrap gap-2 animate-slide-up animate-delay-1">
        {[['points', t('leaderboard_by_points')], ['effort', t('leaderboard_by_effort')]].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
              mode === id
                ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm'
                : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Season / All-time (only for points mode) */}
      {mode === 'points' && (
        <div className="flex gap-2 animate-slide-up animate-delay-1">
          {[['season', t('this_season')], ['allTime', t('all_time_tab')]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                tab === id
                  ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm'
                  : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-700/40 bg-surface-raised overflow-hidden shadow-surface-sm animate-slide-up animate-delay-2">
        {rows.length === 0 ? (
          <div className="p-8 text-xs text-content-tertiary text-center italic">{t('no_merit_data')}</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-content-tertiary border-b border-slate-700/40 bg-surface-sunken/30">
                <th className="px-3 py-2.5 w-10">#</th>
                <SortTh col="name" label={t('th_member')} className="px-3 py-2.5" />
                <th className="px-3 py-2.5">{t('th_role')}</th>
                <SortTh col="category" label={t('th_category')} className="px-3 py-2.5" />
                {showEffortCols ? (
                  <>
                    <th className="px-3 py-2.5 text-right">{t('leaderboard_weekly_count')}</th>
                    <th className="px-3 py-2.5 text-right">{t('leaderboard_tasks_done')}</th>
                    <SortTh col="score" label={t('leaderboard_effort') || 'Esfuerzo'} className="px-3 py-2.5 text-right" />
                  </>
                ) : (
                  <SortTh col="score" label={t('points')} className="px-3 py-2.5 text-right" />
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.membershipId} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors animate-slide-up" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                  <td className="px-3 py-2.5">
                    <span className={`font-bold text-base ${
                      row.pointsRank === 1 ? 'text-yellow-400' :
                      row.pointsRank === 2 ? 'text-slate-300'  :
                      row.pointsRank === 3 ? 'text-amber-600'  : 'text-content-tertiary'
                    }`}>
                      {row.pointsRank ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <MemberAvatar
                      membership={memberships.find((m) => m.id === row.membershipId) || { displayName: row.name, photoURL: null }}
                      onViewProfile={onViewProfile}
                    />
                  </td>
                  <td className="px-3 py-2.5"><RoleBadge role={row.role} /></td>
                  <td className="px-3 py-2.5 text-content-tertiary text-xs">{row.categoryName}</td>
                  {showEffortCols ? (
                    <>
                      <td className="px-3 py-2.5 text-right font-mono text-content-secondary">{row.weeklyCount ?? 0}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-content-secondary">{row.tasksDone ?? 0}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">{row.effort ?? 0}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">{row.points}</td>
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
