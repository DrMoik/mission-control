// ─── GoalsSection ─────────────────────────────────────────────────────────────
// OKR-style goal tracking: objectives with measurable key results and
// progress sliders.  Scope (global vs. category) is set at creation time.
// Edit permission is resolved per-goal via resolveCanEdit().

import React, { useState }    from 'react';
import LangContext              from '../../i18n/LangContext.js';
import { BilingualField }       from '../../components/ui/index.js';
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
  const { t, lang } = React.useContext(LangContext);
  const [form,       setForm]       = useState({ objective: { en: '', es: '' }, owner: '', dueDate: '', categoryId: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [newKR,      setNewKR]      = useState({});

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

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeGoals = goals.filter((g) => g.status !== 'completed' && g.status !== 'cancelled');
  const doneGoals   = goals.filter((g) => g.status === 'completed');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Create form ── */}
      {canCreate && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div className="text-xs text-slate-400">{t('new_goal_btn')}</div>
          <BilingualField
            label={`${t('goal_ph')} *`}
            value={form.objective}
            onChange={(v) => setForm((f) => ({ ...f, objective: v }))}
          />
          <div className="flex flex-wrap gap-2">
            <input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              placeholder={t('owner_ph')}
              className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-36 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
              <option value="">{t('scope_global')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded whitespace-nowrap">
              {t('add_goal_btn')}
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-8 text-center text-xs text-slate-500">{t('no_goals_add')}</div>
      )}

      {/* Active first, then completed */}
      {[...activeGoals, ...doneGoals].map((goal) => {
        const krs         = goal.keyResults || [];
        const avgProgress = krs.length
          ? Math.round(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length) : 0;
        const isExpanded  = expandedId === goal.id;
        const isDone      = goal.status === 'completed';
        const canEditThis = resolveCanEdit(goal);

        return (
          <div key={goal.id} className={`bg-slate-800 rounded-lg overflow-hidden ${isDone ? 'opacity-60' : ''}`}>
            <div className="px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : goal.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{getL(goal.objective, lang)}</span>
                    {isDone && (
                      <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded">
                        {t('completed_badge')}
                      </span>
                    )}
                    {/* Scope badge */}
                    {goal.categoryId
                      ? <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                          {t('scope_category')} {ensureString(categories.find((c) => c.id === goal.categoryId)?.name, lang) ?? goal.categoryId}
                        </span>
                      : <span className="text-[9px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">Global</span>
                    }
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex gap-3 flex-wrap">
                    {goal.owner   && <span>👤 {goal.owner}</span>}
                    {goal.dueDate && <span>📅 {goal.dueDate}</span>}
                    {krs.length > 0 && <span>{t('key_result_s')(krs.length)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEditThis && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); toggleStatus(goal); }}
                        className={`text-[11px] underline ${isDone ? 'text-slate-400' : 'text-emerald-400'}`}>
                        {isDone ? t('reopen_btn') : t('complete_btn')}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteGoal(goal.id); }}
                        className="text-[11px] text-red-400 underline">{t('delete')}</button>
                    </>
                  )}
                  <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Progress summary bar */}
              {krs.length > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>{t('overall_progress')}</span>
                    <span>{avgProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${avgProgress}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Expanded key results */}
            {isExpanded && (
              <div className="border-t border-slate-700 px-4 py-3 space-y-2">
                <div className="text-xs text-slate-400 font-semibold mb-2">{t('key_results_label')}</div>
                {krs.map((kr) => (
                  <div key={kr.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm flex-1">{ensureString(kr.text, lang)}</span>
                      <span className="text-xs font-mono text-emerald-400 w-10 text-right">{kr.progress}%</span>
                      {canEditThis && (
                        <button onClick={() => removeKR(goal, kr.id)} className="text-[11px] text-red-400">✕</button>
                      )}
                    </div>
                    {canEditThis ? (
                      <input type="range" min={0} max={100} step={5} value={kr.progress}
                        onChange={(e) => updateProgress(goal, kr.id, e.target.value)}
                        className="w-full accent-emerald-500" />
                    ) : (
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${kr.progress}%` }} />
                      </div>
                    )}
                  </div>
                ))}
                {canEditThis && (
                  <div className="flex gap-2 mt-2">
                    <input value={newKR[goal.id] || ''}
                      onChange={(e) => setNewKR((k) => ({ ...k, [goal.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addKeyResult(goal); }}
                      placeholder={t('add_kr_ph')}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    <button onClick={() => addKeyResult(goal)}
                      className="px-2 py-1 bg-slate-600 text-white text-xs rounded">+</button>
                  </div>
                )}
                {/* Last edited */}
                {goal.lastEditedBy && (
                  <p className="text-[10px] text-slate-600 text-right">
                    {t('last_edited_by')(
                      goal.lastEditedBy,
                      goal.lastEditedAt?.toDate?.().toLocaleDateString() ?? '',
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
