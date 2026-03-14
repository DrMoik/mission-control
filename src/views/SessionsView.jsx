// ─── SessionsView ─────────────────────────────────────────────────────────────
// Community Sessions: list, create, edit, delete, attendance.
// Sessions are synchronous gatherings with attendance; distinct from calendar events.

import React, { useState, useEffect } from 'react';
import { t, lang } from '../strings.js';
import { ensureString } from '../utils.js';
import { SESSION_ATTENDANCE_POINTS_DEFAULT, SESSION_CLASSES, SESSION_TYPES } from '../constants.js';

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
  authUser = null,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onSaveAttendance,
  fetchAttendance,
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [attendanceUISessionId, setAttendanceUISessionId] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  const [newSession, setNewSession] = useState({
    title: '',
    sessionClass: 'work',
    sessionType: 'other',
    scheduledAt: '',
    durationMinutes: '',
    place: '',
    shortDescription: '',
    longDescription: '',
    categoryId: '',
    grantsPoints: false,
    meritPoints: String(SESSION_ATTENDANCE_POINTS_DEFAULT),
  });
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all' | 'attended' | 'not_attended'

  const getClassLabel = (id) => SESSION_CLASSES.find((c) => c.id === id)?.label?.[lang] || id;
  const getTypeLabel = (id) => SESSION_TYPES.find((c) => c.id === id)?.label?.[lang] || id;

  useEffect(() => {
    setAttendanceUISessionId(null);
    setAttendanceFilter('all');
  }, [expandedId]);

  useEffect(() => {
    if (!expandedId || !fetchAttendance || attendanceUISessionId !== expandedId) return;
    fetchAttendance(expandedId).then((rows) => {
      const map = {};
      rows.forEach((r) => { map[r.membershipId] = r.attended; });
      setAttendance(map);
      setAttendanceDirty(false);
    });
  }, [expandedId, attendanceUISessionId, fetchAttendance]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSession.title?.trim()) return;
    await onCreateSession({
      title: newSession.title.trim(),
      sessionClass: newSession.sessionClass || 'work',
      sessionType: newSession.sessionType || 'other',
      scheduledAt: newSession.scheduledAt || new Date().toISOString().slice(0, 16),
      durationMinutes: newSession.durationMinutes ? Number(newSession.durationMinutes) : null,
      place: newSession.place?.trim() || null,
      shortDescription: newSession.shortDescription?.trim() || null,
      longDescription: newSession.longDescription?.trim() || null,
      categoryId: newSession.categoryId || null,
      grantsPoints: Boolean(newSession.grantsPoints),
      meritPoints: newSession.grantsPoints ? Number(newSession.meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT) : null,
    });
    setNewSession({ title: '', sessionClass: 'work', sessionType: 'other', scheduledAt: '', durationMinutes: '', place: '', shortDescription: '', longDescription: '', categoryId: '', grantsPoints: false, meritPoints: String(SESSION_ATTENDANCE_POINTS_DEFAULT) });
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
  const filteredAttendanceMembers = (() => {
    const list = activeMembers;
    if (attendanceFilter === 'attended') return list.filter((m) => attendance[m.id]);
    if (attendanceFilter === 'not_attended') return list.filter((m) => !attendance[m.id]);
    return list;
  })();

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
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_place')}</label>
            <input
              value={newSession.place}
              onChange={(e) => setNewSession((s) => ({ ...s, place: e.target.value }))}
              placeholder="Ej. Lab 3, Zoom…"
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_short_description')}</label>
            <input
              value={newSession.shortDescription}
              onChange={(e) => setNewSession((s) => ({ ...s, shortDescription: e.target.value }))}
              placeholder={t('task_description_ph')}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('session_long_description')}</label>
            <textarea
              value={newSession.longDescription}
              onChange={(e) => setNewSession((s) => ({ ...s, longDescription: e.target.value }))}
              placeholder={t('task_description_ph')}
              rows={3}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(newSession.grantsPoints)}
              onChange={(e) => setNewSession((s) => ({ ...s, grantsPoints: e.target.checked }))}
              className="rounded"
            />
            <span>{t('session_grants_points')}</span>
          </label>
          {newSession.grantsPoints && (
            <div className="space-y-2">
              <p className="text-xs text-emerald-400">{t('session_points_after_attendance')}</p>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">{t('session_points_amount')}</label>
                <input
                  type="number"
                  min="0"
                  value={newSession.meritPoints}
                  onChange={(e) => setNewSession((s) => ({ ...s, meritPoints: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </div>
            </div>
          )}
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
          {sessions.map((session) => {
            const isOrganizer = session.createdBy === authUser?.uid;
            const canTakeAttendance = isOrganizer || canManageSessions;
            const isExpanded = expandedId === session.id;
            const showAttendanceUI = isExpanded && canTakeAttendance && attendanceUISessionId === session.id;
            return (
              <div
                key={session.id}
                className="bg-slate-800 rounded-lg border border-slate-600 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId((id) => (id === session.id ? null : session.id))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-200">{ensureString(session.title, lang)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                          {getClassLabel(session.sessionClass)} · {getTypeLabel(session.sessionType)}
                        </span>
                        {session.grantsPoints && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            +{session.meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT} pts
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDatetime(session.scheduledAt)}
                        {session.durationMinutes && ` · ${session.durationMinutes} min`}
                        {session.place && ` · ${ensureString(session.place, lang)}`}
                      </p>
                      {(session.shortDescription || session.description) && (
                        <p className={`text-xs text-slate-400 mt-2 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>{ensureString(session.shortDescription || session.description, lang)}</p>
                      )}
                    </div>
                    <span className={`shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}>▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-700 p-4 space-y-4">
                    {(session.place || session.longDescription || session.description) && (
                      <div className="space-y-1">
                        {session.place && <p className="text-xs text-slate-400"><span className="text-slate-500">{t('session_place')}:</span> {ensureString(session.place, lang)}</p>}
                        {(session.longDescription || session.description) && (
                          <p className="text-xs text-slate-400 whitespace-pre-wrap">{ensureString(session.longDescription || session.description, lang)}</p>
                        )}
                      </div>
                    )}
                    {canTakeAttendance && (
                      <div>
                        {!showAttendanceUI ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAttendanceUISessionId(session.id); }}
                            className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded"
                          >
                            {t('session_take_attendance')}
                          </button>
                        ) : (
                          <>
                            <h4 className="text-xs font-semibold text-slate-400 mb-2">{t('session_attendance')}</h4>
                            <div className="flex gap-1 mb-2">
                              {['all', 'attended', 'not_attended'].map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setAttendanceFilter(f)}
                                  className={`text-[11px] px-2 py-1 rounded ${attendanceFilter === f ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                >
                                  {f === 'all' ? t('session_attendance_all') : f === 'attended' ? t('session_attendance_attended') : t('session_attendance_not_attended')}
                                </button>
                              ))}
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {filteredAttendanceMembers.map((m) => (
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
                          </>
                        )}
                      </div>
                    )}

                    {canManageSessions && (
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
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
  const [place, setPlace] = useState(session.place || '');
  const [shortDescription, setShortDescription] = useState(session.shortDescription || session.description || '');
  const [longDescription, setLongDescription] = useState(session.longDescription || session.description || '');
  const [categoryId, setCategoryId] = useState(session.categoryId || '');
  const [grantsPoints, setGrantsPoints] = useState(Boolean(session.grantsPoints));
  const [meritPoints, setMeritPoints] = useState(String(session.meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT));

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
          <label className="text-[11px] text-slate-500 block mb-1">{t('session_place')}</label>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Ej. Lab 3, Zoom…"
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">{t('session_short_description')}</label>
          <input
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">{t('session_long_description')}</label>
          <textarea
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={grantsPoints}
            onChange={(e) => setGrantsPoints(e.target.checked)}
            className="rounded"
          />
          <span>{t('session_grants_points')}</span>
        </label>
        {grantsPoints && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400">{t('session_points_after_attendance')}</p>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('session_points_amount')}</label>
              <input
                type="number"
                min="0"
                value={meritPoints}
                onChange={(e) => setMeritPoints(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              />
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSave({
              title: title.trim(),
              sessionClass,
              sessionType,
              scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
              durationMinutes: durationMinutes ? Number(durationMinutes) : null,
              place: place.trim() || null,
              shortDescription: shortDescription.trim() || null,
              longDescription: longDescription.trim() || null,
              description: shortDescription.trim() || longDescription.trim() || null,
              categoryId: categoryId || null,
              grantsPoints,
              meritPoints: grantsPoints ? Number(meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT) : null,
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
