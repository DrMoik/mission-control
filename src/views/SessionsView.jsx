// ─── SessionsView ─────────────────────────────────────────────────────────────
// Community Sessions: list, create, edit, delete, attendance.
// Sessions are synchronous gatherings with attendance; distinct from calendar events.

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { t, lang } from '../strings.js';
import PickerField from '../components/ui/PickerField.jsx';
import { Button, Input, Textarea } from '../components/ui/index.js';
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

function toDateObject(ts) {
  return typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
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
  const [showPastSessions, setShowPastSessions] = useState(false);

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

  const now = new Date();
  const sortedSessions = [...sessions].sort((a, b) => toDateObject(a.scheduledAt) - toDateObject(b.scheduledAt));
  const upcomingSessions = sortedSessions.filter((session) => toDateObject(session.scheduledAt) >= now);
  const pastSessions = sortedSessions.filter((session) => toDateObject(session.scheduledAt) < now);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold text-gradient tracking-tight">{t('session_title')}</h2>
        </div>
        {canManageSessions && (
          <Button variant={showNewForm ? 'secondary' : 'primary'} size="sm" onClick={() => setShowNewForm((s) => !s)}>
            {showNewForm ? t('cancel') : `+ ${t('session_new')}`}
          </Button>
        )}
      </div>

      {showNewForm && canManageSessions && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 space-y-3 animate-slide-up">
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('task_title')} *</label>
            <Input value={newSession.title} onChange={(e) => setNewSession((s) => ({ ...s, title: e.target.value }))} placeholder={t('task_title_ph')} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-content-tertiary block mb-1">{t('session_class')}</label>
              <select value={newSession.sessionClass} onChange={(e) => setNewSession((s) => ({ ...s, sessionClass: e.target.value }))} className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-sm text-content-primary">
                {SESSION_CLASSES.map((c) => (<option key={c.id} value={c.id}>{getClassLabel(c.id)}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-content-tertiary block mb-1">{t('session_type')}</label>
              <select value={newSession.sessionType} onChange={(e) => setNewSession((s) => ({ ...s, sessionType: e.target.value }))} className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-sm text-content-primary">
                {SESSION_TYPES.map((c) => (<option key={c.id} value={c.id}>{getTypeLabel(c.id)}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-content-tertiary block mb-1">{t('session_scheduled')}</label>
              <PickerField type="datetime-local" value={newSession.scheduledAt} onChange={(value) => setNewSession((s) => ({ ...s, scheduledAt: value }))} placeholder="Seleccionar fecha y hora" className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-sm text-content-primary" />
            </div>
            <div>
              <label className="text-[11px] text-content-tertiary block mb-1">{t('session_duration')}</label>
              <Input type="number" min="0" value={newSession.durationMinutes} onChange={(e) => setNewSession((s) => ({ ...s, durationMinutes: e.target.value }))} placeholder="60" />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('session_place')}</label>
            <Input value={newSession.place} onChange={(e) => setNewSession((s) => ({ ...s, place: e.target.value }))} placeholder="Ej. Lab 3, Zoom…" />
          </div>
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('session_short_description')}</label>
            <Input value={newSession.shortDescription} onChange={(e) => setNewSession((s) => ({ ...s, shortDescription: e.target.value }))} placeholder={t('task_description_ph')} />
          </div>
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('session_long_description')}</label>
            <Textarea value={newSession.longDescription} onChange={(e) => setNewSession((s) => ({ ...s, longDescription: e.target.value }))} placeholder={t('task_description_ph')} rows={3} />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-surface-overlay px-3 py-2 text-sm text-content-secondary cursor-pointer">
            <input type="checkbox" checked={Boolean(newSession.grantsPoints)} onChange={(e) => setNewSession((s) => ({ ...s, grantsPoints: e.target.checked }))} className="rounded" />
            <span>{t('session_grants_points')}</span>
          </label>
          {newSession.grantsPoints && (
            <div className="space-y-2">
              <p className="text-xs text-primary">{t('session_points_after_attendance')}</p>
              <div>
                <label className="text-[11px] text-content-tertiary block mb-1">{t('session_points_amount')}</label>
                <Input type="number" min="0" value={newSession.meritPoints} onChange={(e) => setNewSession((s) => ({ ...s, meritPoints: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm">{t('save')}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>{t('cancel')}</Button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-4">{t('session_no_sessions')}</p>
      ) : (
        <div className="space-y-5">
          {[
            { id: 'upcoming', title: 'Proximas sesiones', items: upcomingSessions, past: false, collapsible: false },
            { id: 'past', title: 'Sesiones pasadas', items: pastSessions, past: true, collapsible: true },
          ].map((group) => (
            group.items.length > 0 ? (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">
                    {group.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      group.past ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                    }`}>
                      {group.items.length}
                    </div>
                    {group.collapsible && (
                      <button
                        type="button"
                        onClick={() => setShowPastSessions((value) => !value)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-700/50 bg-surface-overlay p-1.5 text-content-tertiary transition-colors hover:border-slate-500/70 hover:text-content-primary"
                        aria-label={showPastSessions ? 'Contraer sesiones pasadas' : 'Expandir sesiones pasadas'}
                        title={showPastSessions ? 'Contraer sesiones pasadas' : 'Expandir sesiones pasadas'}
                      >
                        {showPastSessions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {(!group.collapsible || showPastSessions) && group.items.map((session) => {
            const isOrganizer = session.createdBy === authUser?.uid;
            const canTakeAttendance = isOrganizer || canManageSessions;
            const isExpanded = expandedId === session.id;
            const showAttendanceUI = isExpanded && canTakeAttendance && attendanceUISessionId === session.id;
            const isPastSession = group.past;
            return (
              <div
                key={session.id}
                className={`rounded-xl border overflow-hidden transition-colors animate-slide-up ${
                  isPastSession
                    ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-400/30'
                    : 'border-slate-700/40 bg-surface-raised hover:border-primary/20'
                }`}
                style={{ animationDelay: `${Math.min(group.items.indexOf(session) * 50, 300)}ms` }}
              >
                <div className="p-4 cursor-pointer" onClick={() => setExpandedId((id) => (id === session.id ? null : session.id))}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-content-primary">{ensureString(session.title, lang)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-overlay border border-slate-700/40 text-content-tertiary">
                          {getClassLabel(session.sessionClass)} · {getTypeLabel(session.sessionType)}
                        </span>
                        {session.grantsPoints && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
                            +{session.meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT} pts
                          </span>
                        )}
                        {isPastSession && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/30">
                            {t('past_label')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-content-tertiary mt-0.5">
                        {formatDatetime(session.scheduledAt)}
                        {session.durationMinutes && ` · ${session.durationMinutes} min`}
                        {session.place && ` · ${ensureString(session.place, lang)}`}
                      </p>
                      {(session.shortDescription || session.description) && (
                        <p className={`text-xs text-content-secondary mt-2 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>{ensureString(session.shortDescription || session.description, lang)}</p>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-content-tertiary shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} strokeWidth={2} />
                  </div>
                </div>

                {isExpanded && (
                  <div className={`border-t p-4 space-y-4 ${isPastSession ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-700/40 bg-surface-sunken/20'}`}>
                    {(session.place || session.longDescription || session.description) && (
                      <div className="space-y-1">
                        {session.place && <p className="text-xs text-content-secondary"><span className="text-content-tertiary">{t('session_place')}:</span> {ensureString(session.place, lang)}</p>}
                        {(session.longDescription || session.description) && (
                          <p className="text-xs text-content-secondary whitespace-pre-wrap">{ensureString(session.longDescription || session.description, lang)}</p>
                        )}
                      </div>
                    )}
                    {canTakeAttendance && (
                      <div>
                        {!showAttendanceUI ? (
                          <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); setAttendanceUISessionId(session.id); }}>
                            {t('session_take_attendance')}
                          </Button>
                        ) : (
                          <>
                            <h4 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2">{t('session_attendance')}</h4>
                            <div className="flex gap-1 mb-2">
                              {['all', 'attended', 'not_attended'].map((f) => (
                                <button key={f} type="button" onClick={() => setAttendanceFilter(f)}
                                  className={`text-[11px] px-2 py-1 rounded-lg border transition-all duration-150 ${attendanceFilter === f ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50'}`}>
                                  {f === 'all' ? t('session_attendance_all') : f === 'attended' ? t('session_attendance_attended') : t('session_attendance_not_attended')}
                                </button>
                              ))}
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {filteredAttendanceMembers.map((m) => (
                                <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-700/20 rounded-lg px-2 py-1 transition-colors">
                                  <input type="checkbox" checked={Boolean(attendance[m.id])} onChange={() => toggleAttendance(m.id)} className="rounded" />
                                  <span className="text-content-primary">{ensureString(m.displayName, lang) || '—'}</span>
                                </label>
                              ))}
                            </div>
                            {attendanceDirty && (
                              <Button variant="primary" size="sm" className="mt-2" onClick={handleSaveAttendanceClick}>
                                {t('session_save_attendance')}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {canManageSessions && (
                      <div className="flex gap-3 pt-2 border-t border-slate-700/40">
                        <button type="button" onClick={() => setEditingId(session.id)} className="text-xs text-content-tertiary hover:text-content-primary transition-colors underline">{t('session_edit')}</button>
                        <button type="button" onClick={() => { if (window.confirm(t('delete') + '?')) onDeleteSession(session.id); }} className="text-xs text-error hover:text-red-400 transition-colors underline">{t('delete')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
                })}
              </div>
            ) : null
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
  const [place, setPlace] = useState(session.place || '');
  const [shortDescription, setShortDescription] = useState(session.shortDescription || session.description || '');
  const [longDescription, setLongDescription] = useState(session.longDescription || session.description || '');
  const [categoryId, setCategoryId] = useState(session.categoryId || '');
  const [grantsPoints, setGrantsPoints] = useState(Boolean(session.grantsPoints));
  const [meritPoints, setMeritPoints] = useState(String(session.meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-5 max-w-md w-full space-y-3 max-h-[90vh] overflow-y-auto shadow-surface-xl">
        <h3 className="font-semibold text-content-primary">{t('session_edit')}</h3>
        <div>
          <label className="text-[11px] text-content-tertiary block mb-1">{t('task_title')} *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('session_class')}</label>
            <select
              value={sessionClass}
              onChange={(e) => setSessionClass(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-sm text-content-primary"
            >
              {SESSION_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{getClassLabel(c.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-content-tertiary block mb-1">{t('session_type')}</label>
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
            <PickerField
              type="datetime-local"
              value={scheduledAt}
              onChange={setScheduledAt}
              placeholder="Seleccionar fecha y hora"
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
            className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-sm text-content-primary"
          />
        </div>
        <div>
          <label className="text-[11px] text-content-tertiary block mb-1">{t('session_short_description')}</label>
          <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-content-tertiary block mb-1">{t('session_long_description')}</label>
          <Textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={3} />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-surface-overlay px-3 py-2 text-sm text-content-secondary cursor-pointer">
          <input type="checkbox" checked={grantsPoints} onChange={(e) => setGrantsPoints(e.target.checked)} className="rounded" />
          <span>{t('session_grants_points')}</span>
        </label>
        {grantsPoints && (
          <div className="space-y-2">
            <p className="text-xs text-primary">{t('session_points_after_attendance')}</p>
            <div>
              <label className="text-[11px] text-content-tertiary block mb-1">{t('session_points_amount')}</label>
              <Input type="number" min="0" value={meritPoints} onChange={(e) => setMeritPoints(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="primary" size="sm" onClick={() => onSave({ title: title.trim(), sessionClass, sessionType, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, durationMinutes: durationMinutes ? Number(durationMinutes) : null, place: place.trim() || null, shortDescription: shortDescription.trim() || null, longDescription: longDescription.trim() || null, description: shortDescription.trim() || longDescription.trim() || null, categoryId: categoryId || null, grantsPoints, meritPoints: grantsPoints ? Number(meritPoints || SESSION_ATTENDANCE_POINTS_DEFAULT) : null })}>
            {t('save')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>{t('cancel')}</Button>
        </div>
      </div>
    </div>
  );
}
