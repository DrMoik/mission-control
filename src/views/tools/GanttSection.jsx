// ─── GanttSection ──────────────────────────────────────────────────────────
// Multiple named Gantt charts per team (global or per-area, like Eisenhower /
// Pugh). Each chart holds a flat list of bar items (title, start/end date,
// optional link to an existing task) rendered as a day-scaled timeline.

import React, { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { confirmDialog } from '../../services/feedback.js';
import PickerField from '../../components/ui/PickerField.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { ensureString } from '../../utils.js';

const MS_DAY = 86400000;
const parseDay = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const dayIndex = (date, base) => Math.round((date - base) / MS_DAY);
const fmt = (value) => {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
};

const newItem = () => ({ id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: '', startDate: '', endDate: '', taskId: '' });

/**
 * @param {{
 *   charts:         object[],           // already filtered for visibility
 *   tasks:          object[],           // teamTasks, for optional linking
 *   categories:     object[],
 *   scopeCategories: object[],
 *   canCreate:      boolean,
 *   resolveCanEdit: function(chart): boolean,
 *   onCreateGantt:  function({ name, categoryId }): Promise<string>,
 *   onUpdateGantt:  function(id, updates): Promise<void>,
 *   onDeleteGantt:  function(id): Promise<void>,
 * }} props
 */
export default function GanttSection({
  charts, tasks = [], categories, scopeCategories = categories, canCreate, resolveCanEdit,
  onCreateGantt, onUpdateGantt, onDeleteGantt,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [draft, setDraft] = useState(newItem());

  const selected = selectedId ? charts.find((c) => c.id === selectedId) : null;
  const items = useMemo(() => selected?.items || [], [selected]);
  const canEditSelected = selected ? resolveCanEdit(selected) : false;

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const name = (newName || '').trim() || t('gantt_new_chart');
    const id = await onCreateGantt({ name, categoryId: newCategoryId || null });
    setNewName('');
    setNewCategoryId('');
    if (id) setSelectedId(id);
  };

  const addItem = async () => {
    if (!selected || !draft.title.trim() || !draft.startDate || !draft.endDate) return;
    await onUpdateGantt(selected.id, { items: [...items, { ...draft, title: draft.title.trim() }] });
    setDraft(newItem());
  };

  const updateItem = async (itemId, patch) => {
    if (!selected) return;
    await onUpdateGantt(selected.id, { items: items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) });
  };

  const removeItem = async (itemId) => {
    if (!selected) return;
    await onUpdateGantt(selected.id, { items: items.filter((it) => it.id !== itemId) });
  };

  // ── Timeline scale: min/max across all valid items, padded by a couple of days ──
  const timeline = useMemo(() => {
    const valid = items.filter((it) => it.startDate && it.endDate);
    if (valid.length === 0) return null;
    const starts = valid.map((it) => parseDay(it.startDate));
    const ends = valid.map((it) => parseDay(it.endDate));
    const base = new Date(Math.min(...starts) - MS_DAY);
    const last = new Date(Math.max(...ends) + MS_DAY);
    const totalDays = Math.max(1, dayIndex(last, base));
    const today = dayIndex(new Date(new Date().toDateString()), base);
    return { base, totalDays, today };
  }, [items]);

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="rounded-xl border border-hairline bg-surface-raised p-4">
          <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('create_new')} Gantt</div>
          <form onSubmit={handleCreateSubmit} className="flex flex-wrap gap-2 items-end">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('gantt_chart_name_ph')}
              className="min-w-[160px] flex-1 text-xs"
            />
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              className="px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary"
            >
              <option value="">{t('scope_global')}</option>
              {scopeCategories.map((c) => (
                <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
              ))}
            </select>
            <Button type="submit" variant="primary" size="sm">{t('gantt_new_chart')}</Button>
          </form>
        </div>
      )}

      {charts.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {charts.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${selectedId === c.id ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm' : 'bg-surface-overlay border-hairline text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'}`}
              >
                {ensureString(c.name, lang) || c.id}
              </button>
              {canCreate && resolveCanEdit(c) && (
                <button
                  type="button"
                  onClick={async () => { if (await confirmDialog({ message: t('delete_matrix_confirm'), confirmLabel: t('delete'), danger: true })) { onDeleteGantt(c.id); setSelectedId((id) => (id === c.id ? null : id)); } }}
                  className="text-[11px] text-red-400 hover:underline"
                >
                  {t('delete')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          {/* Add item form */}
          {canEditSelected && (
            <div className="flex flex-wrap gap-2 items-end rounded-xl border border-hairline bg-surface-raised p-3">
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder={t('gantt_item_title_ph')}
                className="flex-1 min-w-[140px] text-xs"
              />
              <PickerField type="date" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v, endDate: d.endDate && d.endDate < v ? v : d.endDate }))}
                placeholder={t('gantt_start_date')}
                className="w-32 px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary" />
              <PickerField type="date" value={draft.endDate} onChange={(v) => setDraft((d) => ({ ...d, endDate: v }))}
                min={draft.startDate || undefined}
                placeholder={t('gantt_end_date')}
                className="w-32 px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary" />
              <select
                value={draft.taskId}
                onChange={(e) => setDraft((d) => ({ ...d, taskId: e.target.value }))}
                className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-secondary max-w-[160px]"
              >
                <option value="">{t('gantt_link_task_none')}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{ensureString(task.title, lang) || task.id}</option>
                ))}
              </select>
              <Button type="button" variant="primary" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Button>
            </div>
          )}

          {/* Timeline */}
          {timeline ? (
            <div className="rounded-xl border border-hairline bg-surface-raised p-4 overflow-x-auto">
              <div className="min-w-[640px] space-y-1">
                {items.filter((it) => it.startDate && it.endDate).map((item) => {
                  const start = dayIndex(parseDay(item.startDate), timeline.base);
                  const end = dayIndex(parseDay(item.endDate), timeline.base) + 1;
                  const left = (start / timeline.totalDays) * 100;
                  const width = Math.max(((end - start) / timeline.totalDays) * 100, 2);
                  const linkedTask = item.taskId ? tasks.find((task) => task.id === item.taskId) : null;
                  return (
                    <div key={item.id} className="flex items-center gap-2 py-1 group">
                      {canEditSelected ? (
                        <input
                          type="text"
                          defaultValue={item.title}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) updateItem(item.id, { title: v }); }}
                          className="w-28 shrink-0 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-primary focus:outline-none text-xs text-content-secondary truncate"
                        />
                      ) : (
                        <div className="w-28 shrink-0 text-xs text-content-secondary truncate" title={item.title}>{item.title}</div>
                      )}
                      {canEditSelected && (
                        <>
                          <PickerField type="date" value={item.startDate} onChange={(v) => updateItem(item.id, { startDate: v })}
                            className="w-24 shrink-0 px-1.5 py-1 bg-surface-sunken border border-slate-600 rounded text-[10px] text-content-primary" />
                          <PickerField type="date" value={item.endDate} min={item.startDate || undefined} onChange={(v) => updateItem(item.id, { endDate: v })}
                            className="w-24 shrink-0 px-1.5 py-1 bg-surface-sunken border border-slate-600 rounded text-[10px] text-content-primary" />
                        </>
                      )}
                      <div className="relative flex-1 h-6 bg-surface-sunken rounded">
                        {timeline.today >= 0 && timeline.today <= timeline.totalDays && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/70" style={{ left: `${(timeline.today / timeline.totalDays) * 100}%` }} />
                        )}
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded bg-primary/70 hover:bg-primary transition-colors flex items-center px-1.5"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${fmt(item.startDate)} – ${fmt(item.endDate)}`}
                        >
                          <span className="text-[10px] text-white/90 truncate">{fmt(item.startDate)}–{fmt(item.endDate)}</span>
                        </div>
                      </div>
                      {linkedTask && (
                        <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full shrink-0" title={t('gantt_linked_task')}>
                          {ensureString(linkedTask.title, lang)}
                        </span>
                      )}
                      {canEditSelected && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title={t('delete')}
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">{t('gantt_no_items')}</p>
          )}
        </div>
      )}

      {charts.length === 0 && (
        <p className="text-xs text-slate-500 italic">{t('nothing_yet')}</p>
      )}
    </div>
  );
}
