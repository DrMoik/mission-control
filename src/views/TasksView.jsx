// ─── TasksView ─────────────────────────────────────────────────────────────────
// Tab where users see tasks assigned to them. Tasks are created only from
// Project Management tools (e.g. Scrum/Boards). Assignees request review;
// the assigner (task responsible) assigns a merit from the catalog (points set by admin).

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { TASK_GRADES } from '../constants.js';
import { getTaskAssigneeIds } from '../utils/taskHelpers.js';
import { Button, Input } from '../components/ui/index.js';

export default function TasksView({
  tasks,
  memberships = [],
  currentMembership,
  canViewAllTasks = false,
  knowledgeAreas = [],
  onRequestTaskReview,
  onCancelTaskReviewRequest,
  onGradeTask,
  onRejectTaskReview,
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
  const [editingKnowledgeAreasTaskId, setEditingKnowledgeAreasTaskId] = useState(null);

  const myTasks = (tasks || []).filter((task) =>
    getTaskAssigneeIds(task).includes(currentMembership?.id),
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

  const getAcceptedDate = (task) => {
    if (task.acceptedAt) return tsToDate(task.acceptedAt);
    if (task.completedAt) return tsToDate(task.completedAt);
    return null;
  };

  const formatAcceptanceLeadTime = (task) => {
    const assigned = task.createdAt ? tsToDate(task.createdAt) : null;
    const accepted = getAcceptedDate(task);
    if (!assigned || !accepted) return null;
    const diffMs = accepted - assigned;
    if (!Number.isFinite(diffMs) || diffMs < 0) return null;

    const totalMinutes = Math.round(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
  };

  const TaskCard = ({ task, isCompleted, showRequestReview, showGrade }) => {
    const assignerName = task.assignedByName
      || memberships.find((m) => m.id === task.assignedByMembershipId)?.displayName
      || '—';
    const due = task.dueDate ? tsToDate(task.dueDate) : null;
    const now = new Date();
    const isOverdue = due && due < now && (task.status || 'pending') === 'pending';
    const overdueDays = isOverdue ? Math.ceil((now - due) / (24 * 60 * 60 * 1000)) : 0;
    const assigneeIds = getTaskAssigneeIds(task);
    const assigneeNames = assigneeIds
      .map((id) => memberships.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ensureString(m.displayName, lang))
      .join(', ') || '—';
    const isAssignee = assigneeIds.includes(currentMembership?.id);
    const isAssigner = task.assignedByMembershipId === currentMembership?.id;
    const canDelete = isAssigner || canViewAllTasks;
    const canRequestReview = showRequestReview && isAssignee && (task.status || 'pending') === 'pending' && !task.blocked;
    const isPendingReview = task.status === 'pending_review';
    const canCancelReviewRequest = isAssignee && isPendingReview && onCancelTaskReviewRequest;
    const isBlocked = Boolean(task.blocked);
    const acceptedAt = getAcceptedDate(task);
    const acceptanceLeadTime = formatAcceptanceLeadTime(task);
    const statusLabel = task.status === 'completed' ? t('task_status_completed')
      : isPendingReview ? t('task_status_pending_review')
      : isBlocked ? t('task_status_blocked')
      : (task.status || 'pending') === 'pending' ? t('task_status_assigned')
      : t('task_status_in_progress');

    const cardBg = isCompleted
      ? 'bg-surface-raised/40 border-slate-700/40'
      : isPendingReview
        ? 'bg-amber-950/20 border-amber-700/40'
        : isBlocked
          ? 'bg-red-950/15 border-red-600/30'
          : 'bg-surface-raised border-slate-700/40 hover:border-primary/25 hover:shadow-glow-sm';

    const badgeCls = isCompleted ? 'bg-surface-overlay text-content-tertiary'
      : isPendingReview ? 'bg-amber-900/40 text-amber-300 border border-amber-700/40'
      : isBlocked ? 'bg-red-900/40 text-red-300 border border-red-700/40'
      : 'bg-surface-overlay text-content-tertiary border border-slate-700/40';

    return (
      <div className={`rounded-xl border p-4 space-y-2 transition-all duration-200 ${cardBg}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-medium ${isCompleted ? 'line-through text-content-tertiary' : 'text-content-primary'}`}>
                {ensureString(task.title, lang)}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${badgeCls}`}>
                {statusLabel}
              </span>
            </div>
            {task.description && (
              <p className="text-sm text-content-secondary mt-1 whitespace-pre-wrap">
                {ensureString(task.description, lang)}
              </p>
            )}
            <p className="text-[11px] text-content-tertiary mt-2">
              {t('task_assigned_by')}: {assignerName}
              {assigneeIds.length > 1 && (
                <> · {t('task_assigned_to')}: {assigneeNames}</>
              )}
              {due && (
                <> · {t('task_due')}: {due.toLocaleDateString()}
                  {isOverdue && (
                    <span className="ml-1 text-error font-medium">
                      ({t('task_overdue_by')} {overdueDays} {t('task_overdue_days')})
                    </span>
                  )}
                </>
              )}
            </p>
            {isBlocked && task.blockedReason && (
              <p className="text-xs text-amber-200/90 mt-1">{ensureString(task.blockedReason, lang)}</p>
            )}
            {knowledgeAreas.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-content-tertiary">{t('merit_attr_knowledge_areas') || 'Áreas'}:</span>
                {editingKnowledgeAreasTaskId === task.id && (isAssigner || canViewAllTasks) && onUpdateTask ? (
                  <>
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
                          className={`text-[10px] px-1.5 py-0.5 rounded-md border transition-colors ${sel ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-surface-overlay hover:bg-slate-700/50 text-content-tertiary border-slate-700/40'}`}
                        >
                          {a.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setEditingKnowledgeAreasTaskId(null)}
                      className="text-[10px] text-content-tertiary hover:text-content-primary underline"
                    >
                      {t('close')}
                    </button>
                  </>
                ) : (
                  <>
                    {(task.knowledgeAreaIds || [])
                      .map((id) => knowledgeAreas.find((a) => a.id === id))
                      .filter(Boolean)
                      .map((a) => (
                        <span
                          key={a.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-overlay text-content-tertiary border border-slate-700/40"
                        >
                          {a.name}
                        </span>
                      ))}
                    {(task.knowledgeAreaIds || []).length === 0 && (
                      <span className="text-[10px] text-content-tertiary italic">—</span>
                    )}
                    {(isAssigner || canViewAllTasks) && onUpdateTask && (
                      <button
                        type="button"
                        onClick={() => setEditingKnowledgeAreasTaskId(task.id)}
                        className="text-[10px] text-content-tertiary hover:text-content-primary underline"
                      >
                        {t('edit') || 'Editar'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {isPendingReview && (
              <p className="text-xs text-amber-400/90 mt-1">
                {(t('task_review_responsible') || 'Revisión a cargo de')}: <span className="font-medium text-amber-300">{assignerName}</span>
              </p>
            )}
            {!isPendingReview && task.reviewFeedback && (
              <p className="text-xs text-error/90 mt-1 whitespace-pre-wrap">
                {(t('task_review_feedback') || 'Feedback de revisión')}: <span className="text-red-300">{ensureString(task.reviewFeedback, lang)}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {isBlocked && isAssignee && onUnblockTask && (
              <Button variant="secondary" size="sm" onClick={() => onUnblockTask(task.id)}>
                {t('task_unblock')}
              </Button>
            )}
            {!isBlocked && isAssignee && (task.status || 'pending') === 'pending' && onSetBlocked && (
              <button
                type="button"
                onClick={async () => {
                  const getReason = onRequestBlockReason ?? (() => Promise.resolve(window.prompt(t('task_blocked_reason_ph') || 'Motivo del bloqueo (opcional)…') ?? null));
                  const reason = await getReason(task.id);
                  if (reason !== null) onSetBlocked(task.id, reason || '');
                }}
                className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 px-2 py-1 rounded-md transition-colors"
              >
                {t('task_mark_blocked')}
              </button>
            )}
            {canRequestReview && (
              <Button variant="primary" size="sm" onClick={() => onRequestTaskReview(task.id)}>
                {t('task_request_review')}
              </Button>
            )}
            {canCancelReviewRequest && (
              <Button variant="secondary" size="sm" onClick={() => onCancelTaskReviewRequest(task.id)}>
                {t('task_cancel_submission')}
              </Button>
            )}
            {showGrade && isAssigner && task.status === 'pending_review' && (
              <div className="flex flex-wrap gap-1">
                {onRejectTaskReview && (
                  <button
                    type="button"
                    onClick={async () => {
                      const feedback = window.prompt(
                        t('task_reject_prompt') || 'Explica por qué la entrega está incompleta o no cumple el estándar.',
                        ensureString(task.reviewFeedback, lang) || '',
                      );
                      if (feedback === null) return;
                      await onRejectTaskReview(task.id, feedback);
                    }}
                    className="text-[10px] bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-700/40 px-2 py-1 rounded-md transition-colors"
                  >
                    {t('task_reject_review')}
                  </button>
                )}
                {TASK_GRADES.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => onGradeTask(task.id, grade)}
                    className="text-[10px] bg-surface-overlay hover:bg-primary/20 hover:text-primary text-content-secondary border border-slate-700/40 hover:border-primary/40 px-2 py-1 rounded-md capitalize transition-colors"
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
                className="text-xs text-error hover:text-red-400 transition-colors"
              >
                {t('delete')}
              </button>
            )}
          </div>
        </div>
        {isCompleted && task.grade && (
          <div className="space-y-0.5 pt-1 border-t border-slate-700/40">
            <p className="text-[11px] text-content-tertiary">
              {t('task_grade_label')}: <span className="text-content-secondary">{t(`task_grade_${task.grade}`)}</span>
            </p>
            {acceptedAt && (
              <p className="text-[11px] text-content-tertiary">
                {t('task_accepted_at')}: {acceptedAt.toLocaleDateString()}
              </p>
            )}
            {acceptanceLeadTime && (
              <p className="text-[11px] text-content-tertiary">
                {t('task_acceptance_time')}: {acceptanceLeadTime}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const SectionToggle = ({ label, count, open, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors"
    >
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} strokeWidth={2} />
      {label} <span className="text-content-tertiary text-xs">({count})</span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-gradient tracking-tight">{t('nav_tasks')}</h2>
        <p className="text-sm text-content-secondary mt-1">{t('task_from_pm_tools')}</p>
      </div>

      <Input
        type="search"
        value={taskSearch}
        onChange={(e) => setTaskSearch(e.target.value)}
        placeholder={t('search_placeholder')}
      />

      {/* Pending your review (assigner grades here) */}
      {filteredTasksPendingMyReview.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <h3 className="text-sm font-semibold text-amber-400/90">{t('task_pending_your_review')}</h3>
          </div>
          <p className="text-xs text-content-tertiary mb-3">{t('task_grade_hint')}</p>
          <div className="space-y-2">
            {filteredTasksPendingMyReview.map((task) => (
              <TaskCard key={task.id} task={task} showRequestReview={false} showGrade />
            ))}
          </div>
        </div>
      )}

      {/* All team tasks (admins only) */}
      {canViewAllTasks && allTasks.length > 0 && (
        <div className="animate-slide-up">
          <SectionToggle
            label={t('task_all_team')}
            count={allTasks.length}
            open={showAllTeamTasks}
            onToggle={() => setShowAllTeamTasks((s) => !s)}
          />
          {showAllTeamTasks && (
            <div className="space-y-4 mt-3">
              {allPendingReview.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-2">{t('task_pending_your_review')} ({allPendingReview.length})</h4>
                  <div className="space-y-2">
                    {allPendingReview.map((task) => (
                      <TaskCard key={task.id} task={task} showRequestReview={false} showGrade />
                    ))}
                  </div>
                </div>
              )}
              {allPending.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2">{t('task_pending')} ({allPending.length})</h4>
                  <div className="space-y-2">
                    {allPending.map((task) => (
                      <TaskCard key={task.id} task={task} showRequestReview showGrade={false} />
                    ))}
                  </div>
                </div>
              )}
              {allCompleted.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2">{t('task_completed')} ({allCompleted.length})</h4>
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
      <div className="animate-slide-up animate-delay-1">
        <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-3">{t('task_my_pending')}</h3>
        {myTasks.length === 0 ? (
          <p className="text-xs text-content-tertiary italic py-2">{t('task_no_tasks_guidance')}</p>
        ) : filteredMyPending.length === 0 && filteredMyPendingReview.length === 0 ? (
          <p className="text-xs text-content-tertiary italic py-2">{taskSearch ? t('search_no_results') : t('task_no_pending_guidance')}</p>
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

      {/* Responsibility history */}
      {myTasks.length > 0 && (
        <div className="animate-slide-up animate-delay-2">
          <SectionToggle
            label={t('task_responsibility_history')}
            count={myTasks.length}
            open={showHistory}
            onToggle={() => setShowHistory((s) => !s)}
          />
          {showHistory && (
            <div className="mt-3 rounded-xl border border-slate-700/40 bg-surface-raised overflow-hidden divide-y divide-slate-700/40">
              {[...myTasks]
                .filter(matchesSearch)
                .sort((a, b) => {
                  const ta = a.createdAt?.toDate?.() || new Date(0);
                  const tb = b.createdAt?.toDate?.() || new Date(0);
                  return tb - ta;
                })
                .map((task, i) => {
                  const status = task.status === 'completed' ? t('task_status_completed')
                    : task.status === 'pending_review' ? t('task_status_pending_review')
                    : task.blocked ? t('task_status_blocked')
                    : t('task_status_assigned');
                  const created = task.createdAt ? tsToDate(task.createdAt) : null;
                  const completedDate = task.completedAt ? tsToDate(task.completedAt) : null;
                  const accepted = getAcceptedDate(task);
                  const acceptanceLeadTime = formatAcceptanceLeadTime(task);
                  const reason = task.blocked && task.blockedReason ? ensureString(task.blockedReason, lang) : '';
                  const meta = completedDate
                    ? `${status} · ${created?.toLocaleDateString() || '—'} → ${completedDate.toLocaleDateString()}`
                    : `${status}${created ? ` · ${created.toLocaleDateString()}` : ''}`;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs hover:bg-slate-700/20 transition-colors animate-slide-up"
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-content-primary truncate block">{ensureString(task.title, lang)}</span>
                        <span className="text-content-tertiary text-[11px]">{meta}</span>
                        {accepted && acceptanceLeadTime && (
                          <span className="text-content-tertiary text-[11px] block">
                            {t('task_acceptance_time')}: {acceptanceLeadTime}
                          </span>
                        )}
                        {reason && <span className="text-content-tertiary text-[11px] block truncate" title={reason}>— {reason.length > 50 ? reason.slice(0, 50) + '…' : reason}</span>}
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
        <div className="animate-slide-up animate-delay-3">
          <SectionToggle
            label={t('task_completed')}
            count={filteredMyCompleted.length}
            open={showCompleted}
            onToggle={() => setShowCompleted((s) => !s)}
          />
          {showCompleted && (
            <div className="space-y-2 mt-3">
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
