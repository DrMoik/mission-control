// ─── MyCommitmentsCard ────────────────────────────────────────────────────────
// Personal responsibility dashboard: pending tasks, overdue, weekly streak, profile completion.
// No reminders — visibility only. Students own checking it.

import React from 'react';
import { t } from '../strings.js';
import { computeProfileCompletion, getMondayOfWeekLocal, normalizeWeekOfToMonday } from '../utils.js';

function getAssigneeIds(task) {
  return task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);
}

export default function MyCommitmentsCard({
  tasks = [],
  weeklyStatuses = [],
  currentMembership,
  tsToDate,
  onNavigateTasks,
  onNavigateProfile,
}) {
  if (!currentMembership) return null;

  const myTasks = tasks.filter((task) => getAssigneeIds(task).includes(currentMembership.id));
  const pending = myTasks.filter((task) => (task.status || 'pending') === 'pending');
  const pendingReview = myTasks.filter((task) => task.status === 'pending_review');
  const now = new Date();
  const overdue = pending.filter((task) => {
    const due = task.dueDate ? tsToDate(task.dueDate) : null;
    return due && due < now;
  });
  const overdueDays = (task) => {
    const due = task.dueDate ? tsToDate(task.dueDate) : null;
    if (!due || due >= now) return 0;
    return Math.ceil((now - due) / (24 * 60 * 60 * 1000));
  };

  const weekOf = getMondayOfWeekLocal();
  const weekSet = new Set(
    weeklyStatuses
      .map((s) => s.weekOf && normalizeWeekOfToMonday(s.weekOf))
      .filter(Boolean)
  );
  const thisWeekPosted = weekSet.has(weekOf);
  let streak = 0;
  let checkMonday = weekOf;
  while (weekSet.has(checkMonday)) {
    streak++;
    const d = new Date(checkMonday + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    checkMonday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const profileCompletion = computeProfileCompletion(currentMembership);

  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('my_commitments')}</h3>
      <p className="text-[11px] text-slate-500 mb-4">{t('my_commitments_desc')}</p>

      <div className="space-y-3">
        {/* Tasks */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{t('my_pending_tasks')}</span>
          <span className={`text-sm font-semibold ${pending.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {pending.length}
          </span>
        </div>
        {overdue.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400">{t('my_overdue_tasks')}</span>
            <span className="text-sm font-semibold text-red-400">
              {overdue.length} ({overdueDays(overdue[0])} {t('task_overdue_days')})
            </span>
          </div>
        )}
        {(pending.length > 0 || pendingReview.length > 0) && (
          <button
            type="button"
            onClick={onNavigateTasks}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            {t('view_tasks')}
          </button>
        )}

        {/* Weekly streak */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <span className="text-xs text-slate-400">{t('weekly_streak')}</span>
          <span className="text-sm font-semibold text-slate-200">{streak}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{t('weekly_this_week')}</span>
          <span className={`text-xs font-medium ${thisWeekPosted ? 'text-emerald-400' : 'text-amber-400'}`}>
            {thisWeekPosted ? t('weekly_posted') : t('weekly_not_posted')}
          </span>
        </div>
        {!thisWeekPosted && (
          <button
            type="button"
            onClick={onNavigateProfile}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            {t('view_profile')}
          </button>
        )}

        {/* Profile completion */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <span className="text-xs text-slate-400">{t('profile_completion')}</span>
          <span className={`text-sm font-semibold ${profileCompletion.percentage >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {profileCompletion.percentage}% {t('profile_complete_pct')}
          </span>
        </div>
        {profileCompletion.percentage < 100 && (
          <button
            type="button"
            onClick={onNavigateProfile}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            {t('view_profile')}
          </button>
        )}
      </div>
    </div>
  );
}
