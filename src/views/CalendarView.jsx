// ─── CalendarView ──────────────────────────────────────────────────────────────
// Standalone calendar tab: events + birthdays. Scope filter (global/area), birthday checkbox.

import React, { useState, useMemo, useCallback } from 'react';
import { t, lang } from '../strings.js';
import { BilingualField, HowToUse, ScopeFilter } from '../components/ui/index.js';
import { getL, toL, fillL, ensureString, parseCalendarDate } from '../utils.js';

export default function CalendarView({
  teamEvents = [],
  categories = [],
  memberships = [],
  currentMembership,
  canEdit,
  canEditTools,
  resolveCanEdit,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}) {
  const userCategoryId = currentMembership?.categoryId || null;

  const [scopeFilter, setScopeFilter] = useState('all');
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title:       { en: '', es: '' },
    date:        '',
    description: { en: '', es: '' },
    categoryId:  '',
  });
  const [editingEventId, setEditingEventId] = useState(null);
  const [editEventDraft, setEditEventDraft] = useState({ title: { en: '', es: '' }, date: '', description: { en: '', es: '' }, categoryId: '' });

  const isVisible = useCallback((item) => {
    if (!item.categoryId) return true;
    if (canEdit) return true;
    return item.categoryId === userCategoryId;
  }, [canEdit, userCategoryId]);

  const filterItems = useCallback((items) => {
    return items.filter((item) => {
      if (!isVisible(item)) return false;
      if (scopeFilter === 'all')    return true;
      if (scopeFilter === 'global') return !item.categoryId;
      return item.categoryId === scopeFilter;
    });
  }, [isVisible, scopeFilter]);

  const birthdayEvents = useMemo(() => {
    const year = new Date().getFullYear();
    return (memberships || [])
      .filter((m) => m.birthdate && typeof m.birthdate === 'string' && m.birthdate.trim().length >= 5)
      .map((m) => {
        // Strip time/timezone to avoid UTC-midnight → previous day in local TZ
        const s = m.birthdate.trim().split(/[TZ\s]/)[0];
        const parts = s.split('-');
        let month, day;
        if (parts.length >= 3) {
          [, month, day] = parts;
        } else if (parts.length >= 2) {
          [month, day] = parts;
        } else return null;
        const mNum = parseInt(month, 10);
        const dNum = parseInt(day, 10);
        if (isNaN(mNum) || isNaN(dNum) || mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) return null;
        const dateStr = `${year}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
        const name = ensureString(m.displayName, lang) || '?';
        return {
          id:           `birthday-${m.id}`,
          title:        { en: `🎂 ${name}`, es: `🎂 ${name}` },
          date:         dateStr,
          categoryId:   m.categoryId || null,
          isBirthday:   true,
        };
      })
      .filter(Boolean);
  }, [memberships, lang]);

  const filteredTeamEvents = useMemo(() => filterItems(teamEvents), [filterItems, teamEvents]);
  const filteredBirthdays = useMemo(() => filterItems(birthdayEvents), [filterItems, birthdayEvents]);
  const visibleEvents = useMemo(() => {
    const team = filteredTeamEvents || [];
    const birthdays = showBirthdays ? (filteredBirthdays || []) : [];
    const merged = [...team, ...birthdays];
    return merged.sort((a, b) => {
      const da = parseCalendarDate(a.date);
      const db = parseCalendarDate(b.date);
      return da - db;
    });
  }, [filteredTeamEvents, filteredBirthdays, showBirthdays]);

  const canCreate = canEditTools;

  const handleAddEvent = async (e) => {
    e.preventDefault();
    await onCreateEvent({
      title:       fillL(newEvent.title),
      date:        newEvent.date,
      description: fillL(newEvent.description),
      categoryId:  newEvent.categoryId || null,
    });
    setNewEvent({ title: { en: '', es: '' }, date: '', description: { en: '', es: '' }, categoryId: '' });
  };

  const startEditEvent = (evt) => {
    const d = parseCalendarDate(evt.date);
    setEditingEventId(evt.id);
    setEditEventDraft({
      title:       toL(evt.title),
      date:        d.toISOString().slice(0, 10),
      description: toL(evt.description),
      categoryId:  evt.categoryId || '',
    });
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEventId) return;
    await onUpdateEvent(editingEventId, {
      title:       fillL(editEventDraft.title),
      date:        editEventDraft.date,
      description: fillL(editEventDraft.description),
      categoryId:  editEventDraft.categoryId || null,
    });
    setEditingEventId(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('calendar_title')}</h2>
      <HowToUse descKey="tool_desc_calendar" />

      <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
        categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
        <input type="checkbox" checked={showBirthdays} onChange={(e) => setShowBirthdays(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-pink-500 focus:ring-pink-500" />
        <span>🎂 Ver fechas</span>
      </label>

      {canCreate && !editingEventId && (
        <form onSubmit={handleAddEvent} className="bg-slate-800 rounded-lg p-4 space-y-3">
          <BilingualField
            label={`${t('event_title_label')} *`}
            value={newEvent.title}
            onChange={(v) => setNewEvent((n) => ({ ...n, title: v }))}
            placeholder={{ en: t('event_title_ph'), es: t('event_title_ph') }}
          />
          <BilingualField
            label={t('description')}
            value={newEvent.description}
            onChange={(v) => setNewEvent((n) => ({ ...n, description: v }))}
          />
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-40">
              <label className="text-xs text-slate-400 block mb-1">{t('event_date')} *</label>
              <input type="date" value={newEvent.date} onChange={(e) => setNewEvent((v) => ({ ...v, date: e.target.value }))}
                required className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('scope_label')}</label>
              <select value={newEvent.categoryId} onChange={(e) => setNewEvent((v) => ({ ...v, categoryId: e.target.value }))}
                className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
                <option value="">{t('scope_global')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded self-end">
              {t('add_event_btn')}
            </button>
          </div>
        </form>
      )}

      {editingEventId && (
        <form onSubmit={handleUpdateEvent} className="bg-slate-800 rounded-lg p-4 space-y-3 border border-amber-700/50">
          <div className="text-xs text-amber-400/90 mb-1">{t('edit')} {t('event_title_label')}</div>
          <BilingualField
            label={`${t('event_title_label')} *`}
            value={editEventDraft.title}
            onChange={(v) => setEditEventDraft((n) => ({ ...n, title: v }))}
            placeholder={{ en: t('event_title_ph'), es: t('event_title_ph') }}
          />
          <BilingualField
            label={t('description')}
            value={editEventDraft.description}
            onChange={(v) => setEditEventDraft((n) => ({ ...n, description: v }))}
          />
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-40">
              <label className="text-xs text-slate-400 block mb-1">{t('event_date')} *</label>
              <input type="date" value={editEventDraft.date} onChange={(e) => setEditEventDraft((v) => ({ ...v, date: e.target.value }))}
                required className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('scope_label')}</label>
              <select value={editEventDraft.categoryId} onChange={(e) => setEditEventDraft((v) => ({ ...v, categoryId: e.target.value }))}
                className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
                <option value="">{t('scope_global')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded self-end">{t('save')}</button>
            <button type="button" onClick={() => setEditingEventId(null)} className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded self-end">{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        {visibleEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">{t('no_events_add')}</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {visibleEvents.map((evt) => {
              const d         = parseCalendarDate(evt.date);
              const isPast    = d < new Date();
              const catName   = evt.categoryId
                ? ensureString(categories.find((c) => c.id === evt.categoryId)?.name, lang) : null;
              const canDelEvt = !evt.isBirthday && resolveCanEdit(evt);
              return (
                <div key={evt.id} className={`flex items-start gap-4 px-4 py-3 ${isPast ? 'opacity-40' : ''}`}>
                  <div className="shrink-0 bg-slate-700 rounded-lg p-2 text-center w-14">
                    <div className="text-[10px] text-slate-400 uppercase">{d.toLocaleString('default', { month: 'short' })}</div>
                    <div className="text-2xl font-bold leading-none">{d.getDate()}</div>
                    <div className="text-[10px] text-slate-400">{d.getFullYear()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{getL(evt.title, lang)}</div>
                    {getL(evt.description, lang) && <div className="text-xs text-slate-400 mt-0.5">{getL(evt.description, lang)}</div>}
                    <div className="mt-1">
                      {evt.isBirthday
                        ? <span className="text-[9px] bg-pink-900/40 text-pink-300 px-1.5 py-0.5 rounded-full">
                            🎂
                          </span>
                        : catName
                          ? <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                              {t('scope_category')} {catName}
                            </span>
                          : <span className="text-[9px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">Global</span>
                      }
                    </div>
                    {isPast && <div className="text-[10px] text-slate-600 mt-0.5">{t('past_label')}</div>}
                    {evt.lastEditedBy && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {`Última edición por ${evt.lastEditedBy} el ${evt.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
                      </div>
                    )}
                  </div>
                  {canDelEvt && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => startEditEvent(evt)} className="text-[11px] text-amber-400 underline">
                        {t('edit')}
                      </button>
                      <button type="button" onClick={() => onDeleteEvent(evt.id)} className="text-[11px] text-red-400 underline">
                        {t('delete')}
                      </button>
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
