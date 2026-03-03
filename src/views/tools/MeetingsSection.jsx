// ─── MeetingsSection ──────────────────────────────────────────────────────────
// Create / view / edit meeting notes with action-item checklists.
// Scope (global vs. category) is set at creation time.
// Edit permission is resolved per-meeting via resolveCanEdit().

import React, { useState } from 'react';
import LangContext from '../../i18n/LangContext.js';

/**
 * @param {{
 *   meetings:         object[],           // already filtered for visibility
 *   categories:       object[],           // for scope dropdown
 *   canCreate:        boolean,
 *   resolveCanEdit:   function(meeting): boolean,
 *   onCreateMeeting:  function(data): Promise<void>,
 *   onUpdateMeeting:  function(id, updates): Promise<void>,
 *   onDeleteMeeting:  function(id): Promise<void>,
 * }} props
 */
export default function MeetingsSection({
  meetings, categories, canCreate, resolveCanEdit,
  onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
}) {
  const { t } = React.useContext(LangContext);
  const [form,          setForm]          = useState({ title: '', date: '', attendees: '', notes: '', categoryId: '' });
  const [expandedId,    setExpandedId]    = useState(null);
  const [editingId,     setEditingId]     = useState(null);
  const [editDraft,     setEditDraft]     = useState({});
  const [newActionText, setNewActionText] = useState({});

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onCreateMeeting({ ...form, categoryId: form.categoryId || null, actionItems: [] });
    setForm({ title: '', date: '', attendees: '', notes: '', categoryId: '' });
  };

  // ── Action items ───────────────────────────────────────────────────────────

  const toggleAction = async (meeting, itemId) => {
    const updated = meeting.actionItems.map((a) => a.id === itemId ? { ...a, done: !a.done } : a);
    await onUpdateMeeting(meeting.id, { actionItems: updated });
  };

  const addAction = async (meeting) => {
    const text = (newActionText[meeting.id] || '').trim();
    if (!text) return;
    const updated = [...meeting.actionItems, { id: `${Date.now()}`, text, assignee: '', done: false }];
    await onUpdateMeeting(meeting.id, { actionItems: updated });
    setNewActionText((prev) => ({ ...prev, [meeting.id]: '' }));
  };

  const removeAction = async (meeting, itemId) => {
    const updated = meeting.actionItems.filter((a) => a.id !== itemId);
    await onUpdateMeeting(meeting.id, { actionItems: updated });
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditDraft({ title: m.title, date: m.date || '', attendees: m.attendees || '', notes: m.notes || '' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Create form ── */}
      {canCreate && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 space-y-2">
          <div className="text-xs text-slate-400 mb-1">{t('new_meeting_btn')}</div>
          <div className="flex flex-wrap gap-2">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required placeholder={t('meeting_title_ph')}
              className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-36 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            <input value={form.attendees} onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
              placeholder={t('attendees_ph')}
              className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
          </div>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t('notes_ph')}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm resize-none" />
          {/* Scope */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-slate-400 shrink-0">{t('scope_label')}:</label>
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
              <option value="">{t('scope_global')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{t('scope_category')} {c.name}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded ml-auto">
              {t('add_meeting_btn')}
            </button>
          </div>
        </form>
      )}

      {meetings.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-8 text-center text-xs text-slate-500">{t('no_meetings_add')}</div>
      )}

      {/* ── Meeting cards ── */}
      {[...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((m) => {
        const isExpanded  = expandedId === m.id;
        const isEditing   = editingId  === m.id;
        const done        = (m.actionItems || []).filter((a) => a.done).length;
        const canEditThis = resolveCanEdit(m);

        return (
          <div key={m.id} className="bg-slate-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : m.id)}>
              <div className="shrink-0 bg-slate-700 rounded-lg p-2 text-center w-14">
                {m.date ? (
                  <>
                    <div className="text-[10px] text-slate-400 uppercase">
                      {new Date(m.date + 'T12:00').toLocaleString('default', { month: 'short' })}
                    </div>
                    <div className="text-xl font-bold leading-none">{new Date(m.date + 'T12:00').getDate()}</div>
                  </>
                ) : <div className="text-xs text-slate-500">{t('tbd_label')}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{m.title}</div>
                {m.attendees && <div className="text-xs text-slate-400 mt-0.5">👥 {m.attendees}</div>}
                {(m.actionItems || []).length > 0 && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('action_done_of')(done, (m.actionItems || []).length)}
                  </div>
                )}
                {/* Scope badge */}
                <div className="mt-1">
                  {m.categoryId
                    ? <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                        {t('scope_category')} {categories.find((c) => c.id === m.categoryId)?.name ?? m.categoryId}
                      </span>
                    : <span className="text-[9px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">Global</span>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEditThis && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                      className="text-[11px] text-amber-400 underline">{t('edit')}</button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteMeeting(m.id); }}
                      className="text-[11px] text-red-400 underline">{t('delete')}</button>
                  </>
                )}
                <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded: notes + action items */}
            {isExpanded && !isEditing && (
              <div className="border-t border-slate-700 px-4 py-3 space-y-3">
                {m.notes && <p className="text-sm text-slate-300 whitespace-pre-wrap">{m.notes}</p>}
                <div>
                  <div className="text-xs text-slate-400 font-semibold mb-2">{t('action_items_label')}</div>
                  {(m.actionItems || []).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 py-1">
                      <input type="checkbox" checked={a.done} onChange={() => toggleAction(m, a.id)}
                        className="accent-emerald-500" />
                      <span className={`text-sm flex-1 ${a.done ? 'line-through text-slate-500' : ''}`}>{a.text}</span>
                      {canEditThis && (
                        <button onClick={() => removeAction(m, a.id)} className="text-[11px] text-red-400">✕</button>
                      )}
                    </div>
                  ))}
                  {canEditThis && (
                    <div className="flex gap-2 mt-2">
                      <input value={newActionText[m.id] || ''}
                        onChange={(e) => setNewActionText((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addAction(m); }}
                        placeholder={t('add_action_ph')}
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                      <button onClick={() => addAction(m)}
                        className="px-2 py-1 bg-slate-600 text-white text-xs rounded">+</button>
                    </div>
                  )}
                </div>
                {/* Last edited */}
                {m.lastEditedBy && (
                  <p className="text-[10px] text-slate-600 text-right">
                    {t('last_edited_by')(
                      m.lastEditedBy,
                      m.lastEditedAt?.toDate?.().toLocaleDateString() ?? '',
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Inline edit form */}
            {isEditing && (
              <div className="border-t border-slate-700 px-4 py-3 space-y-2">
                <input value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-emerald-500 rounded text-sm font-semibold" />
                <div className="flex gap-2">
                  <input type="date" value={editDraft.date}
                    onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                    className="w-36 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
                  <input value={editDraft.attendees}
                    onChange={(e) => setEditDraft((d) => ({ ...d, attendees: e.target.value }))}
                    placeholder={t('attendees_ph')}
                    className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
                </div>
                <textarea rows={3} value={editDraft.notes}
                  onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm resize-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                  <button onClick={async () => { await onUpdateMeeting(m.id, editDraft); setEditingId(null); }}
                    className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
