import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { t, lang } from '../strings.js';
import { BilingualField, ScopeFilter } from '../components/ui/index.js';
import PickerField from '../components/ui/PickerField.jsx';
import Button from '../components/ui/Button.jsx';
import ModalOverlay from '../components/ModalOverlay.jsx';
import { getL, toL, fillL, ensureString, parseCalendarDate } from '../utils.js';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const isSameDay = (a, b) => toDateKey(a) === toDateKey(b);
const monthLabel = (value) => value.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

const dateToInput = (value) => toDateKey(value);
const timeToInput = (value) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;
const combineDateTime = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr || '00:00'}`);
const displayTime = (value) => value.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

const startOfCalendarGrid = (monthDate) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const nativeDay = firstDay.getDay();
  const mondayIndex = nativeDay === 0 ? 6 : nativeDay - 1;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayIndex);
  return start;
};

const buildCalendarDays = (monthDate) => {
  const start = startOfCalendarGrid(monthDate);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const createEmptyDraft = (dateValue = new Date()) => ({
  title: { en: '', es: '' },
  description: { en: '', es: '' },
  categoryId: '',
  allDay: true,
  startDate: dateToInput(dateValue),
  startTime: '09:00',
  endDate: dateToInput(dateValue),
  endTime: '10:00',
});

const eventBadgeClasses = (event) => {
  if (event.isBirthday) return 'bg-pink-500/15 text-pink-200 border-pink-400/30';
  if (event.isSession) return 'bg-violet-500/15 text-violet-200 border-violet-400/30';
  if (event.categoryName) return 'bg-blue-500/15 text-blue-200 border-blue-400/30';
  return 'bg-slate-700/50 text-slate-200 border-slate-600/60';
};

export default function CalendarView({
  teamEvents = [],
  teamSessions = [],
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
  const today = startOfDay(new Date());

  const [scopeFilter, setScopeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('calendar');
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [draft, setDraft] = useState(createEmptyDraft(today));

  const isVisible = useCallback((item) => {
    if (!item.categoryId) return true;
    if (canEdit) return true;
    return item.categoryId === userCategoryId;
  }, [canEdit, userCategoryId]);

  const filterItems = useCallback((items) => (
    items.filter((item) => {
      if (!isVisible(item)) return false;
      if (scopeFilter === 'all') return true;
      if (scopeFilter === 'global') return !item.categoryId;
      return item.categoryId === scopeFilter;
    })
  ), [isVisible, scopeFilter]);

  const birthdayEvents = useMemo(() => {
    const year = currentMonth.getFullYear();
    return (memberships || [])
      .filter((member) => typeof member.birthdate === 'string' && member.birthdate.trim())
      .map((member) => {
        const parts = member.birthdate.trim().split(/[TZ\s]/)[0].split('-');
        const month = parts.length >= 3 ? Number(parts[1]) : Number(parts[0]);
        const day = parts.length >= 3 ? Number(parts[2]) : Number(parts[1]);
        if (!month || !day) return null;
        const start = new Date(year, month - 1, day);
        const name = ensureString(member.displayName, lang) || '?';
        return {
          id: `birthday-${member.id}`,
          title: { es: `Cumpleanos de ${name}`, en: `Birthday of ${name}` },
          description: '',
          categoryId: member.categoryId || null,
          isBirthday: true,
          isSession: false,
          allDay: true,
          startAt: start,
          endAt: start,
          dateKey: toDateKey(start),
        };
      })
      .filter(Boolean);
  }, [memberships, currentMonth]);

  const sessionEvents = useMemo(() => (
    (teamSessions || []).map((session) => {
      const start = parseCalendarDate(session.scheduledAt);
      const durationMinutes = Number(session.durationMinutes) || 60;
      const end = new Date(start.getTime() + (durationMinutes * 60000));
      return {
        id: `session-${session.id}`,
        title: { es: typeof session.title === 'string' ? session.title : (session.title?.es || session.title?.en || 'Sesion'), en: typeof session.title === 'string' ? session.title : (session.title?.en || session.title?.es || 'Session') },
        description: session.shortDescription || session.longDescription || session.description || '',
        categoryId: session.categoryId || null,
        isBirthday: false,
        isSession: true,
        allDay: false,
        startAt: start,
        endAt: end,
        dateKey: toDateKey(start),
      };
    })
  ), [teamSessions]);

  const normalizedTeamEvents = useMemo(() => (
    (teamEvents || []).map((event) => {
      const start = event.startAt ? parseCalendarDate(event.startAt) : parseCalendarDate(event.date);
      const end = event.endAt ? parseCalendarDate(event.endAt) : start;
      return {
        ...event,
        isBirthday: false,
        isSession: false,
        allDay: event.allDay !== false && !event.startAt,
        startAt: start,
        endAt: end,
        dateKey: toDateKey(start),
      };
    })
  ), [teamEvents]);

  const visibleEvents = useMemo(() => {
    const merged = [
      ...filterItems(normalizedTeamEvents),
      ...filterItems(sessionEvents),
      ...(showBirthdays ? filterItems(birthdayEvents) : []),
    ].map((event) => {
      const categoryName = event.categoryId
        ? ensureString(categories.find((category) => category.id === event.categoryId)?.name, lang)
        : null;
      return { ...event, categoryName };
    });

    return merged.sort((a, b) => {
      if (a.startAt.getTime() !== b.startAt.getTime()) return a.startAt - b.startAt;
      return String(getL(a.title, lang)).localeCompare(String(getL(b.title, lang)));
    });
  }, [birthdayEvents, categories, filterItems, normalizedTeamEvents, sessionEvents, showBirthdays]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    visibleEvents.forEach((event) => {
      const list = map.get(event.dateKey) || [];
      list.push(event);
      map.set(event.dateKey, list);
    });
    return map;
  }, [visibleEvents]);

  const monthDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const selectedDate = parseCalendarDate(selectedDateKey);
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const upcomingCount = visibleEvents.filter((event) => startOfDay(event.startAt) >= today).length;

  const closeForm = () => {
    setShowForm(false);
    setEditingEventId(null);
    setDraft(createEmptyDraft(selectedDate));
  };

  const openCreateForm = (dateValue = selectedDate) => {
    setEditingEventId(null);
    setDraft(createEmptyDraft(dateValue));
    setShowForm(true);
  };

  const startEditEvent = (event) => {
    const start = event.startAt || parseCalendarDate(event.date);
    const end = event.endAt || start;
    setEditingEventId(event.id);
    setDraft({
      title: toL(event.title),
      description: toL(event.description),
      categoryId: event.categoryId || '',
      allDay: Boolean(event.allDay),
      startDate: dateToInput(start),
      startTime: timeToInput(start),
      endDate: dateToInput(end),
      endTime: timeToInput(end),
    });
    setShowForm(true);
  };

  const submitDraft = async (e) => {
    e.preventDefault();
    const startDate = draft.startDate;
    const endDate = draft.endDate || draft.startDate;
    if (!startDate) return;

    const startAt = draft.allDay ? null : combineDateTime(startDate, draft.startTime);
    let endAt = draft.allDay ? null : combineDateTime(endDate, draft.endTime);
    if (startAt && endAt < startAt) endAt = new Date(startAt.getTime() + 3600000);

    const payload = {
      title: fillL(draft.title),
      description: fillL(draft.description),
      categoryId: draft.categoryId || null,
      date: startDate,
      allDay: draft.allDay,
      startAt,
      endAt,
    };

    if (editingEventId) {
      await onUpdateEvent(editingEventId, payload);
    } else {
      await onCreateEvent(payload);
    }

    closeForm();
  };

  const previousMonth = () => {
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(toDateKey(today));
  };

  const pickerClass = 'w-full rounded-lg border border-slate-600 bg-surface-sunken px-3 py-2 text-sm text-content-primary';
  const selectClass = 'w-full rounded-lg border border-slate-600 bg-surface-sunken px-3 py-2 text-sm text-content-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-content-primary">{t('calendar_title')}</h2>
          <p className="mt-0.5 text-sm text-content-secondary">{t('tool_desc_calendar')}</p>
        </div>
        {canEditTools && (
          <Button size="sm" onClick={() => openCreateForm()}>
            <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2.5} />
            {t('add_event_btn')}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-content-tertiary">Eventos visibles</div>
          <div className="text-2xl font-bold text-content-primary">{visibleEvents.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-content-tertiary">Proximos</div>
          <div className="text-2xl font-bold text-primary">{upcomingCount}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-content-tertiary">Mes actual</div>
          <div className="text-lg font-bold capitalize text-content-primary">{monthLabel(currentMonth)}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">Capas</div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={showBirthdays}
              onChange={(e) => setShowBirthdays(e.target.checked)}
              className="rounded border-slate-600 bg-surface-sunken text-pink-500 focus:ring-pink-500"
            />
            <span>{t('calendar_filter_birthdays')}</span>
          </label>
        </div>
      </div>

      <ScopeFilter
        value={scopeFilter}
        onChange={setScopeFilter}
        categories={categories}
        userCategoryId={userCategoryId}
        canEdit={canEdit}
      />

      <div className="flex flex-wrap gap-2">
        {[
          ['calendar', 'Calendario'],
          ['list', 'Lista'],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={viewMode === id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {viewMode === 'calendar' ? (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-700/40 bg-surface-raised shadow-surface-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={previousMonth} className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={nextMonth} className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-content-tertiary">Vista mensual</div>
                <div className="text-lg font-semibold capitalize text-content-primary">{monthLabel(currentMonth)}</div>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={jumpToToday}>Hoy</Button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-700/40 bg-slate-900/60">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = toDateKey(day);
              const dayEvents = eventsByDate.get(key) || [];
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = key === selectedDateKey;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDateKey(key)}
                  className={`min-h-[130px] border-b border-r border-slate-800/70 p-2 text-left align-top transition-colors ${
                    isSelected ? 'bg-emerald-500/10' : 'bg-slate-950/20 hover:bg-slate-900/40'
                  } ${!isCurrentMonth ? 'opacity-45' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday ? 'bg-emerald-400 text-slate-950' : 'text-content-primary'
                    }`}>
                      {day.getDate()}
                    </span>
                    {canEditTools && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateForm(day);
                        }}
                        className="rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        +
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`truncate rounded-md border px-2 py-1 text-[11px] font-medium ${eventBadgeClasses(event)}`}
                        title={`${getL(event.title, lang)}${event.allDay ? '' : ` · ${displayTime(event.startAt)}`}`}
                      >
                        {!event.allDay ? `${displayTime(event.startAt)} · ` : ''}
                        {getL(event.title, lang)}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[11px] text-slate-400">+{dayEvents.length - 3} mas</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/40 bg-surface-raised shadow-surface-sm">
          <div className="border-b border-slate-700/40 px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-content-tertiary">
              <CalendarDays className="h-4 w-4" />
              Agenda del dia
            </div>
            <div className="mt-1 text-lg font-semibold text-content-primary">
              {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="space-y-3 p-4">
            {selectedDayEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 px-4 py-10 text-center">
                <Calendar className="mx-auto mb-3 h-8 w-8 text-content-tertiary" strokeWidth={1.5} />
                <div className="text-sm text-content-tertiary">No hay eventos en esta fecha.</div>
                {canEditTools && (
                  <Button size="sm" className="mt-4" onClick={() => openCreateForm(selectedDate)}>
                    <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2.5} />
                    {t('add_event_btn')}
                  </Button>
                )}
              </div>
            ) : selectedDayEvents.map((event) => {
              const canManage = !event.isBirthday && !event.isSession && resolveCanEdit(event);
              const isPast = startOfDay(event.startAt) < today;
              return (
                <div key={event.id} className={`rounded-xl border border-slate-700/60 bg-slate-950/30 p-4 ${isPast ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-content-primary">{getL(event.title, lang)}</div>
                      <div className="mt-1 text-xs text-content-tertiary">
                        {event.allDay ? 'Todo el dia' : `${displayTime(event.startAt)} - ${displayTime(event.endAt)}`}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${eventBadgeClasses(event)}`}>
                      {event.isBirthday ? 'Cumpleanos' : event.isSession ? 'Sesion' : event.categoryName || 'Global'}
                    </span>
                  </div>

                  {getL(event.description, lang) && (
                    <div className="mt-3 text-sm text-content-secondary">{getL(event.description, lang)}</div>
                  )}

                  {event.lastEditedBy && (
                    <div className="mt-3 text-[11px] text-content-tertiary">
                      Ultima edicion por {event.lastEditedBy}
                    </div>
                  )}

                  {canManage && (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEditEvent(event)}>{t('edit')}</Button>
                      <Button size="sm" variant="danger" onClick={() => onDeleteEvent(event.id)}>{t('delete')}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/40 bg-surface-raised shadow-surface-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/40 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-content-tertiary">Vista de lista</div>
              <div className="text-lg font-semibold text-content-primary">{visibleEvents.length} eventos visibles</div>
            </div>
            <Button variant="secondary" size="sm" onClick={jumpToToday}>Hoy</Button>
          </div>

          {visibleEvents.length === 0 ? (
            <div className="px-4 py-12 text-center text-content-tertiary">
              <Calendar className="mx-auto mb-3 h-8 w-8" strokeWidth={1.5} />
              <div className="text-sm">No hay eventos para mostrar con estos filtros.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {visibleEvents.map((event) => {
                const canManage = !event.isBirthday && !event.isSession && resolveCanEdit(event);
                const isPastEvent = endOfDay(event.endAt) < today;
                const monthLabel = event.startAt.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase();
                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-4 px-4 py-5 transition-colors hover:bg-slate-900/25 ${isPastEvent ? 'opacity-75' : ''}`}
                  >
                    <div className="flex h-[84px] w-[62px] shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-800/80 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{monthLabel}</div>
                      <div className="mt-1 text-[2rem] font-semibold leading-none text-slate-100">{event.startAt.getDate()}</div>
                      <div className="mt-1 text-[11px] font-medium tracking-[0.08em] text-slate-500">{event.startAt.getFullYear()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[1.1rem] font-semibold text-content-primary">{getL(event.title, lang)}</div>
                          {getL(event.description, lang) && (
                            <div className="mt-1 text-sm text-content-secondary">{getL(event.description, lang)}</div>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex shrink-0 items-center gap-3 text-sm font-medium">
                            <button
                              type="button"
                              className="text-amber-300 transition hover:text-amber-200"
                              onClick={() => startEditEvent(event)}
                            >
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              className="text-rose-300 transition hover:text-rose-200"
                              onClick={() => onDeleteEvent(event.id)}
                            >
                              {t('delete')}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${eventBadgeClasses(event)}`}>
                          {event.isBirthday ? 'Cumpleanos' : event.isSession ? 'Sesiones' : event.categoryName || 'Global'}
                        </span>
                        {isPastEvent && <span className="text-[11px] text-content-tertiary">{t('past_label')}</span>}
                      </div>

                      <div className="mt-2 text-xs text-content-tertiary">
                        {event.startAt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {!event.allDay ? ` - ${displayTime(event.startAt)} - ${displayTime(event.endAt)}` : ' - Todo el dia'}
                      </div>
                      {!event.isBirthday && event.lastEditedByName && (
                        <div className="mt-1 text-xs text-slate-500">
                          Ultima edicion por {event.lastEditedByName}
                          {event.lastEditedAt ? ` el ${new Date(event.lastEditedAt).toLocaleDateString('es-MX')}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ModalOverlay onClickBackdrop={closeForm}>
          <form onSubmit={submitDraft} className="w-[min(94vw,760px)] space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl">
            <div className="border-b border-slate-700 pb-3">
              <div className="text-lg font-semibold text-slate-100">
                {editingEventId ? `${t('edit')} ${t('event_title_label')}` : t('add_event_btn')}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Configura el evento con una vista mas cercana a un calendario real.
              </div>
            </div>

            <BilingualField
              label={`${t('event_title_label')} *`}
              value={draft.title}
              onChange={(value) => setDraft((current) => ({ ...current, title: value }))}
              placeholder={{ en: t('event_title_ph'), es: t('event_title_ph') }}
            />

            <BilingualField
              label={t('description')}
              value={draft.description}
              onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
            />

            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-xs text-content-tertiary">{t('scope_label')}</label>
                <select
                  value={draft.categoryId}
                  onChange={(e) => setDraft((current) => ({ ...current, categoryId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">{t('scope_global')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t('scope_category')} {ensureString(category.name, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={draft.allDay}
                    onChange={(e) => setDraft((current) => ({ ...current, allDay: e.target.checked }))}
                    className="rounded border-slate-600 bg-surface-sunken text-emerald-400 focus:ring-emerald-400"
                  />
                  Todo el dia
                </label>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-content-tertiary">Inicio</label>
                    <PickerField
                      type="date"
                      value={draft.startDate}
                      onChange={(value) => setDraft((current) => ({ ...current, startDate: value, endDate: current.endDate || value }))}
                      placeholder="Seleccionar fecha"
                      className={pickerClass}
                    />
                  </div>
                  {!draft.allDay && (
                    <div>
                      <label className="mb-1 block text-xs text-content-tertiary">Hora de inicio</label>
                      <PickerField
                        type="time"
                        value={draft.startTime}
                        onChange={(value) => setDraft((current) => ({ ...current, startTime: value }))}
                        placeholder="Seleccionar hora"
                        className={pickerClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-content-tertiary">Fin</label>
                    <PickerField
                      type="date"
                      value={draft.endDate}
                      onChange={(value) => setDraft((current) => ({ ...current, endDate: value }))}
                      min={draft.startDate}
                      placeholder="Seleccionar fecha"
                      className={pickerClass}
                    />
                  </div>
                  {!draft.allDay && (
                    <div>
                      <label className="mb-1 block text-xs text-content-tertiary">Hora de fin</label>
                      <PickerField
                        type="time"
                        value={draft.endTime}
                        onChange={(value) => setDraft((current) => ({ ...current, endTime: value }))}
                        placeholder="Seleccionar hora"
                        className={pickerClass}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-700 pt-3">
              <Button type="button" variant="secondary" onClick={closeForm}>{t('cancel')}</Button>
              <Button type="submit">{editingEventId ? t('save') : t('add_event_btn')}</Button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}
