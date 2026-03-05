// ─── TasksView ─────────────────────────────────────────────────────────────────
// Tab where users see tasks assigned to them. Tasks are created only from
// Project Management tools (e.g. Scrum/Boards). Assignees request review;
// the assigner (task responsible) assigns a merit from the catalog (points set by admin).

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';
import { ensureString } from '../utils.js';
import { TASK_GRADES } from '../constants.js';

export default function TasksView({
  tasks,
  memberships = [],
  currentMembership,
  onRequestTaskReview,
  onGradeTask,
  onDeleteTask,
  tsToDate,
}) {
  const { t, lang } = React.useContext(LangContext);
  const [showCompleted, setShowCompleted] = useState(false);

  const getAssigneeIds = (task) =>
    task.assigneeMembershipIds ?? (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);

  const myTasks = (tasks || []).filter((task) =>
    getAssigneeIds(task).includes(currentMembership?.id),
  );
  const pending = myTasks.filter((t) => (t.status || 'pending') === 'pending');
  const pendingReviewMine = myTasks.filter((t) => t.status === 'pending_review');
  const completed = myTasks.filter((t) => t.status === 'completed');

  const tasksPendingMyReview = (tasks || []).filter(
    (task) =>
      task.assignedByMembershipId === currentMembership?.id && task.status === 'pending_review',
  );

  const TaskCard = ({ task, isCompleted, showRequestReview, showGrade }) => {
    const assignerName = task.assignedByName || '—';
    const due = task.dueDate ? tsToDate(task.dueDate) : null;
    const assigneeIds = getAssigneeIds(task);
    const assigneeNames = assigneeIds
      .map((id) => memberships.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ensureString(m.displayName, lang))
      .join(', ') || '—';
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    const canDelete = isAssignee || isAssigner;
    const canRequestReview = showRequestReview && isAssignee && (task.status || 'pending') === 'pending';
    const isPendingReview = task.status === 'pending_review';

    return (
      <div
        className={`rounded-lg border p-4 space-y-2 ${
          isCompleted
            ? 'bg-slate-800/40 border-slate-700 text-slate-500'
            : isPendingReview
              ? 'bg-amber-950/20 border-amber-700/50'
              : 'bg-slate-800/60 border-slate-600'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className={`font-medium ${isCompleted ? 'line-through' : 'text-slate-200'}`}>
              {ensureString(task.title, lang)}
            </h4>
            {task.description && (
              <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">
                {ensureString(task.description, lang)}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              {t('task_assigned_by')}: {assignerName}
              {assigneeIds.length > 1 && (
                <> · {t('task_assigned_to')}: {assigneeNames}</>
              )}
              {due && (
                <> · {t('task_due')}: {due.toLocaleDateString()}</>
              )}
            </p>
            {isPendingReview && isAssignee && (
              <p className="text-xs text-amber-400/90 mt-1">{t('task_waiting_review')}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {canRequestReview && (
              <button
                type="button"
                onClick={() => onRequestTaskReview(task.id)}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded"
              >
                {t('task_request_review')}
              </button>
            )}
            {showGrade && isAssigner && task.status === 'pending_review' && (
              <div className="flex flex-wrap gap-1">
                {TASK_GRADES.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => onGradeTask(task.id, grade)}
                    className="text-[10px] bg-slate-600 hover:bg-emerald-600 text-slate-200 px-2 py-1 rounded capitalize"
                  >
                    {t(`task_grade_${grade}`)}
                  </button>
                ))}
              </div>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => { if (window.confirm(t('delete') + '?')) onDeleteTask(task.id); }}
                className="text-xs text-red-400 hover:underline"
              >
                {t('delete')}
              </button>
            )}
          </div>
        </div>
        {isCompleted && task.grade && (
          <p className="text-[11px] text-slate-500">
            {t('task_grade_label')}: {t(`task_grade_${task.grade}`)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-semibold">{t('nav_tasks')}</h2>
      <p className="text-xs text-slate-500">{t('task_from_pm_tools')}</p>

      {/* Pending your review (assigner grades here) */}
      {tasksPendingMyReview.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400/90 mb-2">{t('task_pending_your_review')}</h3>
          <p className="text-xs text-slate-500 mb-2">{t('task_grade_hint')}</p>
          <div className="space-y-2">
            {tasksPendingMyReview.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview={false} showGrade />
            ))}
          </div>
        </div>
      )}

      {/* My pending tasks */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">{t('task_my_pending')}</h3>
        {pending.length === 0 && pendingReviewMine.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">{t('task_no_pending')}</p>
        ) : (
          <div className="space-y-2">
            {pending.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview showGrade={false} />
            ))}
            {pendingReviewMine.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview={false} showGrade={false} />
            ))}
          </div>
        )}
      </div>

      {/* My completed (optional toggle) */}
      {completed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCompleted((s) => !s)}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            <span className={`inline-block transition-transform ${showCompleted ? '' : '-rotate-90'}`}>▼</span> {t('task_completed')} ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {completed.map((task) => (
                <TaskCard key={task.id} task={task} isCompleted showRequestReview={false} showGrade={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
