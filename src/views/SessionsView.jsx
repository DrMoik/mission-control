// ─── SessionsView ─────────────────────────────────────────────────────────────
// Community Sessions: list, create, edit, delete, attendance.
// Sessions are synchronous gatherings with attendance; distinct from calendar events.

import React, { useState, useEffect } from 'react';
import { t, lang } from '../strings.js';
import { getL, ensureString } from '../utils.js';
import { SESSION_CLASSES, SESSION_TYPES } from '../constants.js';

function formatDatetime(ts) {
  if (!ts) return '—';
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function toDatetimeLocal(ts) {
  if (!ts) return '';
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function SessionsView({
  sessions = [],
  memberships = [],
  categories = [],
  canManageSessions,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onSaveAttendance,
  fetchAttendance,
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  const [newSession, setNewSession] = useState({
    title: '',
    sessionClass: 'work',
    sessionType: 'other',
    scheduledAt: '',
    durationMinutes: '',
    description: '',
    categoryId: '',
  });

  const getClassLabel = (id) => SESSION_CLASSES.find((c) => c.id === id)?.label?.[lang] || id;
  const getTypeLabel = (id) => SESSION_TYPES.find((c) => c.id === id)?.label?.[lang] || id;

  useEffect(() => {
    if (!expandedId || !fetchAttendance) return;
    fetchAttendance(expandedId).then((rows) => {
      const map = {};
      rows.forEach((r) => { map[r.membershipId] = r.attended; });
      setAttendance(map);
      setAttendanceDirty(false);
    });
  }, [expandedId, fetchAttendance]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSession.title?.trim()) return;
    await onCreateSession({
      title: newSession.title.trim(),
      sessionClass: newSession.sessionClass || 'work',
      sessionType: newSession.sessionType || 'other',
      scheduledAt: newSession.scheduledAt || new Date().toISOString().slice(0, 16),
      durationMinutes: newSession.durationMinutes ? Number(newSession.durationMinutes) : null,
      description: newSession.description?.trim() || null,
      categoryId: newSession.categoryId || null,
    });
    setNewSession({ title: '', sessionClass: 'work', sessionType: 'other', scheduledAt: '', durationMinutes: '', description: '', categoryId: '' });
    setShowNewForm(false);
  };

  const handleSaveAttendanceClick = async () => {
    if (!expandedId || !onSaveAttendance) return;
    const payload = (memberships || [])
      .filter((m) => m.status === 'active')
      .map((m) => ({ membershipId: m.id, attended: Boolean(attendance[m.id]) }));
    await onSaveAttendance(expandedId, payload);
    setAttendanceDirty(false);
  };

  const toggleAttendance = (membershipId) => {
    setAttendance((prev) => ({ ...prev, [membershipId]: !prev[membershipId] }));
    setAttendanceDirty(true);
  };

  const activeMembers = (memberships || []).filter((m) => m.status === 'active');

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('session_title')}</h2>
        {canManageSessions && (
          <button
            type="button"
            onClick={() => setShowNewForm((s) => !s)}
            className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded"
          >
            {showNewForm ? t('cancel') : `+ ${t('session_new')}`}
          </button>
        )}
      </div>

      {showNewForm && canManageSessions && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('task_title')} *</label>
            <input
              value={newSession.title}
              onChange={(e) => setNewSession((s) => ({ ...s, title: e.target.value }))}
              placeholder={t('task_title_ph')}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('session_class')}</label>
              <select
                value={newSession.sessionClass}
                onChange={(e) => setNewSession((s) => ({ ...s, sessionClass: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              >
                {SESSION_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>{getClassLabel(c.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('session_type')}</label>
              <select
                value={newSession.sessionType}
                onChange={(e) => setNewSession((s) => ({ ...s, sessionType: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              >
                {SESSION_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{getTypeLabel(c.id)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('session_scheduled')}</label>
              <input
                type="datetime-local"
                value={newSession.scheduledAt}
                onChange={(e) => setNewSession((s) => ({ ...s, scheduledAt: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('session_duration')}</label>
              <input
                type="number"
                min="0"
                value={newSession.durationMinutes}
                onChange={(e) => setNewSession((s) => ({ ...s, durationMinutes: e.target.value }))}
                placeholder="60"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_description')}</label>
            <textarea
              value={newSession.description}
              onChange={(e) => setNewSession((s) => ({ ...s, description: e.target.value }))}
              placeholder={t('task_description_ph')}
              rows={2}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded">
              {t('save')}
            </button>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-sm text-slate-400 underline">
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-4">{t('session_no_sessions')}</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-slate-800 rounded-lg border border-slate-600 overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer flex items-center justify-between gap-2"
                onClick={() => setExpandedId((id) => (id === session.id ? null : session.id))}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-200">{ensureString(session.title, lang)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {getClassLabel(session.sessionClass)} · {getTypeLabel(session.sessionType)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatDatetime(session.scheduledAt)}
                    {session.durationMinutes && ` · ${session.durationMinutes} min`}
                  </p>
                </div>
                <span className={`shrink-0 transition-transform ${expandedId === session.id ? '' : '-rotate-90'}`}>▼</span>
              </div>

              {expandedId === session.id && (
                <div className="border-t border-slate-700 p-4 space-y-4">
                  {session.description && (
                    <p className="text-xs text-slate-400 whitespace-pre-wrap">{ensureString(session.description, lang)}</p>
                  )}

                  {canManageSessions && (
                    <>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 mb-2">{t('session_attendance')}</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {activeMembers.map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-700/30 rounded px-2 py-1">
                              <input
                                type="checkbox"
                                checked={Boolean(attendance[m.id])}
                                onChange={() => toggleAttendance(m.id)}
                                className="rounded"
                              />
                              <span className="text-slate-200">{ensureString(m.displayName, lang) || '—'}</span>
                            </label>
                          ))}
                        </div>
                        {attendanceDirty && (
                          <button
                            type="button"
                            onClick={handleSaveAttendanceClick}
                            className="mt-2 text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded"
                          >
                            {t('session_save_attendance')}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-700">
                        <button
                          type="button"
                          onClick={() => { setEditingId(session.id); }}
                          className="text-xs text-slate-400 underline"
                        >
                          {t('session_edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(t('delete') + '?')) onDeleteSession(session.id); }}
                          className="text-xs text-red-400 underline"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingId && canManageSessions && (() => {
        const session = sessions.find((s) => s.id === editingId);
        if (!session) return null;
        return (
          <EditSessionModal
            session={session}
            categories={categories}
            onCancel={() => setEditingId(null)}
            onSave={async (updates) => {
              await onUpdateSession(editingId, updates);
              setEditingId(null);
            }}
            getClassLabel={getClassLabel}
            getTypeLabel={getTypeLabel}
            toDatetimeLocal={toDatetimeLocal}
          />
        );
      })()}
    </div>
  );
}

function EditSessionModal({ session, categories, onCancel, onSave, getClassLabel, getTypeLabel, toDatetimeLocal }) {
  const [title, setTitle] = useState(session.title || '');
  const [sessionClass, setSessionClass] = useState(session.sessionClass || 'work');
  const [sessionType, setSessionType] = useState(session.sessionType || 'other');
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(session.scheduledAt));
  const [durationMinutes, setDurationMinutes] = useState(session.durationMinutes ?? '');
  const [description, setDescription] = useState(session.description || '');
  const [categoryId, setCategoryId] = useState(session.categoryId || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-800 rounded-lg p-4 max-w-md w-full space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-sm">{t('session_edit')}</h3>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">{t('task_title')} *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_class')}</label>
            <select
              value={sessionClass}
              onChange={(e) => setSessionClass(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            >
              {SESSION_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{getClassLabel(c.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_type')}</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            >
              {SESSION_TYPES.map((c) => (
                <option key={c.id} value={c.id}>{getTypeLabel(c.id)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_scheduled')}</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_duration')}</label>
            <input
              type="number"
              min="0"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">{t('session_description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSave({
              title: title.trim(),
              sessionClass,
              sessionType,
              scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
              durationMinutes: durationMinutes ? Number(durationMinutes) : null,
              description: description.trim() || null,
              categoryId: categoryId || null,
            })}
            className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded"
          >
            {t('save')}
          </button>
          <button onClick={onCancel} className="text-sm text-slate-400 underline">
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
