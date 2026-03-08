// ─── TasksView ─────────────────────────────────────────────────────────────────
// Tab where users see tasks assigned to them. Tasks are created only from
// Project Management tools (e.g. Scrum/Boards). Assignees request review;
// the assigner (task responsible) assigns a merit from the catalog (points set by admin).

import React, { useState } from 'react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { TASK_GRADES } from '../constants.js';

export default function TasksView({
  tasks,
  memberships = [],
  currentMembership,
  canViewAllTasks = false,
  knowledgeAreas = [],
  onRequestTaskReview,
  onGradeTask,
  onDeleteTask,
  onSetBlocked,
  onUnblockTask,
  onUpdateTask,
  onRequestBlockReason,
  tsToDate,
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAllTeamTasks, setShowAllTeamTasks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

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

  const allTasks = tasks || [];
  const q = (taskSearch || '').toLowerCase().trim();
  const matchesSearch = (task) => {
    if (!q) return true;
    const title = (ensureString(task.title, lang) || '').toLowerCase();
    const desc = (ensureString(task.description, lang) || '').toLowerCase();
    return title.includes(q) || desc.includes(q);
  };
  const allPending = allTasks.filter((t) => (t.status || 'pending') === 'pending' && matchesSearch(t));
  const allPendingReview = allTasks.filter((t) => t.status === 'pending_review' && matchesSearch(t));
  const allCompleted = allTasks.filter((t) => t.status === 'completed' && matchesSearch(t));
  const filteredMyPending = pending.filter((t) => matchesSearch(t));
  const filteredMyPendingReview = pendingReviewMine.filter((t) => matchesSearch(t));
  const filteredMyCompleted = completed.filter((t) => matchesSearch(t));
  const filteredTasksPendingMyReview = tasksPendingMyReview.filter((t) => matchesSearch(t));

  const TaskCard = ({ task, isCompleted, showRequestReview, showGrade }) => {
    const assignerName = task.assignedByName || '—';
    const due = task.dueDate ? tsToDate(task.dueDate) : null;
    const now = new Date();
    const isOverdue = due && due < now && (task.status || 'pending') === 'pending';
    const overdueDays = isOverdue ? Math.ceil((now - due) / (24 * 60 * 60 * 1000)) : 0;
    const assigneeIds = getAssigneeIds(task);
    const assigneeNames = assigneeIds
      .map((id) => memberships.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ensureString(m.displayName, lang))
      .join(', ') || '—';
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    const canDelete = isAssignee || isAssigner;
    const canRequestReview = showRequestReview && isAssignee && (task.status || 'pending') === 'pending' && !task.blocked;
    const isPendingReview = task.status === 'pending_review';
    const isBlocked = Boolean(task.blocked);
    const statusLabel = task.status === 'completed' ? t('task_status_completed')
      : isPendingReview ? t('task_status_pending_review')
      : isBlocked ? t('task_status_blocked')
      : (task.status || 'pending') === 'pending' ? t('task_status_assigned')
      : t('task_status_in_progress');

    return (
      <div
        className={`rounded-lg border p-4 space-y-2 ${
          isCompleted
            ? 'bg-slate-800/40 border-slate-700 text-slate-500'
            : isPendingReview
              ? 'bg-amber-950/20 border-amber-700/50'
              : isBlocked
                ? 'bg-amber-950/15 border-amber-600/40'
                : 'bg-slate-800/60 border-slate-600'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-medium ${isCompleted ? 'line-through' : 'text-slate-200'}`}>
                {ensureString(task.title, lang)}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isCompleted ? 'bg-slate-700 text-slate-400' :
                isPendingReview ? 'bg-amber-900/50 text-amber-300' :
                isBlocked ? 'bg-red-900/50 text-red-300' :
                'bg-slate-700/80 text-slate-400'
              }`}>
                {statusLabel}
              </span>
            </div>
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
                <> · {t('task_due')}: {due.toLocaleDateString()}
                  {isOverdue && (
                    <span className="ml-1 text-red-400 font-medium">
                      ({t('task_overdue_by')} {overdueDays} {t('task_overdue_days')})
                    </span>
                  )}
                </>
              )}
            </p>
            {isBlocked && task.blockedReason && (
              <p className="text-xs text-amber-200/90 mt-1">{ensureString(task.blockedReason, lang)}</p>
            )}
            {knowledgeAreas.length > 0 && (isAssigner || canViewAllTasks) && onUpdateTask && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-slate-500">{t('merit_attr_knowledge_areas') || 'Áreas'}:</span>
                {knowledgeAreas.map((a) => {
                  const sel = (task.knowledgeAreaIds || []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const next = sel
                          ? (task.knowledgeAreaIds || []).filter((x) => x !== a.id)
                          : [...(task.knowledgeAreaIds || []), a.id];
                        onUpdateTask(task.id, { knowledgeAreaIds: next });
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-400 border border-slate-600'}`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
            {isPendingReview && isAssignee && (
              <p className="text-xs text-amber-400/90 mt-1">{t('task_waiting_review')}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {isBlocked && isAssignee && onUnblockTask && (
              <button
                type="button"
                onClick={() => onUnblockTask(task.id)}
                className="text-xs bg-slate-600 hover:bg-emerald-600 text-slate-200 font-semibold px-3 py-1.5 rounded"
              >
                {t('task_unblock')}
              </button>
            )}
            {!isBlocked && isAssignee && (task.status || 'pending') === 'pending' && onSetBlocked && (
              <button
                type="button"
                onClick={async () => {
                  const getReason = onRequestBlockReason ?? (() => Promise.resolve(window.prompt(t('task_blocked_reason_ph') || 'Motivo del bloqueo (opcional)…') ?? null));
                  const reason = await getReason(task.id);
                  if (reason !== null) onSetBlocked(task.id, reason || '');
                }}
                className="text-xs text-amber-400 hover:bg-amber-900/30 px-2 py-1 rounded"
              >
                {t('task_mark_blocked')}
              </button>
            )}
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

      <input
        type="search"
        value={taskSearch}
        onChange={(e) => setTaskSearch(e.target.value)}
        placeholder={t('search_placeholder')}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
      />

      {/* Pending your review (assigner grades here) */}
      {filteredTasksPendingMyReview.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400/90 mb-2">{t('task_pending_your_review')}</h3>
          <p className="text-xs text-slate-500 mb-2">{t('task_grade_hint')}</p>
          <div className="space-y-2">
            {filteredTasksPendingMyReview.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview={false} showGrade />
            ))}
          </div>
        </div>
      )}

      {/* All team tasks (admins only) */}
      {canViewAllTasks && allTasks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAllTeamTasks((s) => !s)}
            className="text-sm font-medium text-slate-300 hover:text-slate-200"
          >
            <span className={`inline-block transition-transform ${showAllTeamTasks ? '' : '-rotate-90'}`}>▼</span> {t('task_all_team')} ({allTasks.length})
          </button>
          {showAllTeamTasks && (
            <div className="space-y-4 mt-3">
              {allPendingReview.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-400/90 mb-2">{t('task_pending_your_review')} ({allPendingReview.length})</h4>
                  <div className="space-y-2">
                    {allPendingReview.map((task) => (
                      <TaskCard key={task.id} task={task} showRequestReview={false} showGrade />
                    ))}
                  </div>
                </div>
              )}
              {allPending.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">{t('task_pending')} ({allPending.length})</h4>
                  <div className="space-y-2">
                    {allPending.map((task) => (
                      <TaskCard key={task.id} task={task} showRequestReview showGrade={false} />
                    ))}
                  </div>
                </div>
              )}
              {allCompleted.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">{t('task_completed')} ({allCompleted.length})</h4>
                  <div className="space-y-2">
                    {allCompleted.map((task) => (
                      <TaskCard key={task.id} task={task} isCompleted showRequestReview={false} showGrade={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* My pending tasks */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">{t('task_my_pending')}</h3>
        {myTasks.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">{t('task_no_tasks_guidance')}</p>
        ) : filteredMyPending.length === 0 && filteredMyPendingReview.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">{taskSearch ? t('search_no_results') : t('task_no_pending_guidance')}</p>
        ) : (
          <div className="space-y-2">
            {filteredMyPending.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview showGrade={false} />
            ))}
            {filteredMyPendingReview.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview={false} showGrade={false} />
            ))}
          </div>
        )}
      </div>

      {/* Responsibility history — Tu historial de compromisos */}
      {myTasks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            <span className={`inline-block transition-transform ${showHistory ? '' : '-rotate-90'}`}>▼</span> {t('task_responsibility_history')} ({myTasks.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {[...myTasks]
                .filter(matchesSearch)
                .sort((a, b) => {
                  const ta = a.createdAt?.toDate?.() || new Date(0);
                  const tb = b.createdAt?.toDate?.() || new Date(0);
                  return tb - ta;
                })
                .map((task) => {
                  const status = task.status === 'completed' ? t('task_status_completed')
                    : task.status === 'pending_review' ? t('task_status_pending_review')
                    : task.blocked ? t('task_status_blocked')
                    : t('task_status_assigned');
                  const created = task.createdAt ? tsToDate(task.createdAt) : null;
                  const completed = task.completedAt ? tsToDate(task.completedAt) : null;
                  const reason = task.blocked && task.blockedReason ? ensureString(task.blockedReason, lang) : '';
                  const meta = completed
                    ? `${status} · ${created?.toLocaleDateString() || '—'} → ${completed.toLocaleDateString()}`
                    : `${status}${created ? ` · ${created.toLocaleDateString()}` : ''}`;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800/50 rounded text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-200 truncate block">{ensureString(task.title, lang)}</span>
                        <span className="text-slate-500 text-[11px]">{meta}</span>
                        {reason && <span className="text-slate-500 text-[11px] block truncate" title={reason}>— {reason.length > 50 ? reason.slice(0, 50) + '…' : reason}</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* My completed (optional toggle) */}
      {filteredMyCompleted.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCompleted((s) => !s)}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            <span className={`inline-block transition-transform ${showCompleted ? '' : '-rotate-90'}`}>▼</span> {t('task_completed')} ({filteredMyCompleted.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {filteredMyCompleted.map((task) => (
                <TaskCard key={task.id} task={task} isCompleted showRequestReview={false} showGrade={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
