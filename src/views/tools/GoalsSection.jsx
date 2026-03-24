// ─── GoalsSection ─────────────────────────────────────────────────────────────
// OKR-style goal tracking: objectives with measurable key results and
// progress sliders.  Scope (global vs. category) is set at creation time.
// Edit permission is resolved per-goal via resolveCanEdit().

import React, { useState }    from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { BilingualField }       from '../../components/ui/index.js';
import PickerField from '../../components/ui/PickerField.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { getL, toL, fillL, ensureString } from '../../utils.js';

/**
 * @param {{
 *   goals:          object[],            // already filtered for visibility
 *   categories:     object[],            // for scope dropdown
 *   canCreate:      boolean,
 *   resolveCanEdit: function(goal): boolean,
 *   onCreateGoal:   function(data): Promise<void>,
 *   onUpdateGoal:   function(id, updates): Promise<void>,
 *   onDeleteGoal:   function(id): Promise<void>,
 * }} props
 */
export default function GoalsSection({
  goals, categories, canCreate, resolveCanEdit,
  onCreateGoal, onUpdateGoal, onDeleteGoal,
}) {
  const [showForm,       setShowForm]       = useState(false);
  const [form,           setForm]           = useState({ objective: { en: '', es: '' }, owner: '', dueDate: '', categoryId: '' });
  const [expandedId,     setExpandedId]     = useState(null);
  const [newKR,          setNewKR]          = useState({});
  const [editingGoalId,  setEditingGoalId]  = useState(null);
  const [editGoalDraft,  setEditGoalDraft]  = useState({ objective: { en: '', es: '' }, owner: '', dueDate: '', categoryId: '' });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.objective.en.trim() && !form.objective.es.trim()) return;
    await onCreateGoal({
      objective:  fillL(form.objective),
      owner:      form.owner,
      dueDate:    form.dueDate,
      categoryId: form.categoryId || null,
      keyResults: [],
      status:     'active',
    });
    setForm({ objective: { en: '', es: '' }, owner: '', dueDate: '', categoryId: '' });
    setShowForm(false);
  };

  const addKeyResult = async (goal) => {
    const text = (newKR[goal.id] || '').trim();
    if (!text) return;
    const updated = [...(goal.keyResults || []), { id: `${Date.now()}`, text, progress: 0 }];
    await onUpdateGoal(goal.id, { keyResults: updated });
    setNewKR((k) => ({ ...k, [goal.id]: '' }));
  };

  const updateProgress = async (goal, krId, progress) => {
    const updated = (goal.keyResults || []).map((kr) => kr.id === krId ? { ...kr, progress: Number(progress) } : kr);
    await onUpdateGoal(goal.id, { keyResults: updated });
  };

  const removeKR = async (goal, krId) => {
    const updated = (goal.keyResults || []).filter((kr) => kr.id !== krId);
    await onUpdateGoal(goal.id, { keyResults: updated });
  };

  const toggleStatus = async (goal) => {
    await onUpdateGoal(goal.id, { status: goal.status === 'active' ? 'completed' : 'active' });
  };

  const startEditGoal = (goal) => {
    setEditingGoalId(goal.id);
    setEditGoalDraft({
      objective:  toL(goal.objective),
      owner:      goal.owner || '',
      dueDate:    goal.dueDate || '',
      categoryId: goal.categoryId || '',
    });
  };

  const handleSaveGoalEdit = async (e) => {
    e.preventDefault();
    if (!editingGoalId) return;
    await onUpdateGoal(editingGoalId, {
      objective:  fillL(editGoalDraft.objective),
      owner:      editGoalDraft.owner,
      dueDate:    editGoalDraft.dueDate,
      categoryId: editGoalDraft.categoryId || null,
    });
    setEditingGoalId(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeGoals = goals.filter((g) => g.status !== 'completed' && g.status !== 'cancelled');
  const doneGoals   = goals.filter((g) => g.status === 'completed');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('goals_title')}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{t('goals_subtitle')}</p>
        </div>
        {canCreate && !showForm && (
          <div className="shrink-0">
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('new_goal_btn')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Create form panel ── */}
      {canCreate && showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <span className="text-sm font-semibold text-content-primary">{t('new_goal_btn')}</span>
          </div>
          <BilingualField
            label={`${t('goal_ph')} *`}
            value={form.objective}
            onChange={(v) => setForm((f) => ({ ...f, objective: v }))}
          />
          <div className="flex flex-wrap gap-2">
            <Input
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              placeholder={t('owner_ph')}
              className="flex-1 min-w-[120px]"
            />
            <PickerField
              type="date"
              value={form.dueDate}
              onChange={(value) => setForm((f) => ({ ...f, dueDate: value }))}
              placeholder="Seleccionar fecha"
              className="w-36 px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-sm text-content-primary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150"
            />
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-secondary focus:border-primary focus:outline-none"
            >
              <option value="">{t('scope_global')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            <Button type="submit" size="sm">{t('add_goal_btn')}</Button>
          </div>
        </form>
      )}

      {/* ── Goals panel ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('goals_title')}</span>
          <span className="text-xs text-content-tertiary">{activeGoals.length} {t('active_label') || 'activos'}</span>
        </div>

        {goals.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-content-tertiary text-sm">{t('no_goals_add')}</div>
            {canCreate && !showForm && (
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('new_goal_btn')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {[...activeGoals, ...doneGoals].map((goal, goalIndex) => {
              const krs         = goal.keyResults || [];
              const avgProgress = krs.length
                ? Math.round(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length) : 0;
              const isExpanded  = expandedId === goal.id;
              const isDone      = goal.status === 'completed';
              const canEditThis = resolveCanEdit(goal);

              return (
                <div key={goal.id} className={`animate-slide-up ${isDone ? 'opacity-60' : ''}`} style={{ animationDelay: `${Math.min(goalIndex * 50, 300)}ms` }}>
                  {/* Goal row trigger */}
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-content-primary">{getL(goal.objective, lang)}</span>
                          {isDone && (
                            <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded-full">
                              {t('completed_badge')}
                            </span>
                          )}
                          {goal.categoryId
                            ? <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                                {t('scope_category')} {ensureString(categories.find((c) => c.id === goal.categoryId)?.name, lang) ?? goal.categoryId}
                              </span>
                            : <span className="text-[9px] bg-slate-700/60 text-content-tertiary px-1.5 py-0.5 rounded-full">Global</span>
                          }
                        </div>
                        <div className="text-xs text-content-tertiary mt-0.5 flex gap-3 flex-wrap">
                          {goal.owner   && <span>{goal.owner}</span>}
                          {goal.dueDate && <span>{goal.dueDate}</span>}
                          {krs.length > 0 && <span>{`${krs.length} resultado${krs.length !== 1 ? 's' : ''} clave`}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canEditThis && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditGoal(goal); }}
                              className="text-[11px] text-amber-400 hover:underline"
                            >{t('edit')}</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStatus(goal); }}
                              className={`text-[11px] hover:underline ${isDone ? 'text-content-tertiary' : 'text-primary'}`}
                            >{isDone ? t('reopen_btn') : t('complete_btn')}</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteGoal(goal.id); }}
                              className="text-[11px] text-red-400 hover:underline"
                            >{t('delete')}</button>
                          </>
                        )}
                        <ChevronDown className={`h-4 w-4 text-content-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Progress summary bar */}
                    {krs.length > 0 && (
                      <div className="mt-2.5">
                        <div className="flex justify-between text-[10px] text-content-tertiary mb-1">
                          <span>{t('overall_progress')}</span>
                          <span className="font-mono text-primary">{avgProgress}%</span>
                        </div>
                        <div className="w-full bg-surface-sunken rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${avgProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Edit goal form */}
                  {editingGoalId === goal.id && (
                    <form onSubmit={handleSaveGoalEdit} className="border-t border-slate-700/40 bg-surface-sunken/30 px-4 py-4 space-y-3">
                      <div className="text-xs font-semibold text-amber-400/90 mb-1">{t('edit')} {t('goal_ph')}</div>
                      <BilingualField
                        label={`${t('goal_ph')} *`}
                        value={editGoalDraft.objective}
                        onChange={(v) => setEditGoalDraft((f) => ({ ...f, objective: v }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={editGoalDraft.owner}
                          onChange={(e) => setEditGoalDraft((f) => ({ ...f, owner: e.target.value }))}
                          placeholder={t('owner_ph')}
                          className="flex-1 min-w-[120px]"
                        />
                        <PickerField
                          type="date"
                          value={editGoalDraft.dueDate}
                          onChange={(value) => setEditGoalDraft((f) => ({ ...f, dueDate: value }))}
                          placeholder="Seleccionar fecha"
                          className="w-36 px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-sm text-content-primary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150"
                        />
                        <select
                          value={editGoalDraft.categoryId}
                          onChange={(e) => setEditGoalDraft((f) => ({ ...f, categoryId: e.target.value }))}
                          className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-secondary focus:border-primary focus:outline-none"
                        >
                          <option value="">{t('scope_global')}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditingGoalId(null)}>{t('cancel')}</Button>
                        <Button type="submit" size="sm">{t('save')}</Button>
                      </div>
                    </form>
                  )}

                  {/* Expanded key results */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/40 bg-surface-sunken/30 px-4 py-4 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('key_results_label')}</div>
                      {krs.length === 0 && (
                        <p className="text-xs text-content-tertiary italic">{t('no_key_results') || 'No hay resultados clave todavía.'}</p>
                      )}
                      {krs.map((kr) => (
                        <div key={kr.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-content-primary flex-1">{ensureString(kr.text, lang)}</span>
                            <span className="text-xs font-mono text-primary w-10 text-right">{kr.progress}%</span>
                            {canEditThis && (
                              <button
                                onClick={() => removeKR(goal, kr.id)}
                                className="text-red-400 hover:text-red-300 p-0.5 transition-colors"
                                title={t('delete')}
                              ><X className="w-4 h-4" strokeWidth={2} /></button>
                            )}
                          </div>
                          {canEditThis ? (
                            <input
                              type="range" min={0} max={100} step={5} value={kr.progress}
                              onChange={(e) => updateProgress(goal, kr.id, e.target.value)}
                              className="w-full accent-primary"
                            />
                          ) : (
                            <div className="w-full bg-surface-sunken rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${kr.progress}%` }} />
                            </div>
                          )}
                        </div>
                      ))}
                      {canEditThis && (
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newKR[goal.id] || ''}
                            onChange={(e) => setNewKR((k) => ({ ...k, [goal.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') addKeyResult(goal); }}
                            placeholder={t('add_kr_ph')}
                            className="flex-1 text-xs"
                          />
                          <Button type="button" variant="secondary" size="sm" onClick={() => addKeyResult(goal)}>+</Button>
                        </div>
                      )}
                      {goal.lastEditedBy && (
                        <p className="text-[10px] text-content-tertiary text-right pt-1">
                          {`Última edición por ${goal.lastEditedBy} el ${goal.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
