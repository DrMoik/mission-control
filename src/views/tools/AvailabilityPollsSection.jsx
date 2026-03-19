import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';
import PickerField from '../../components/ui/PickerField.jsx';

const SLOT_STEP_OPTIONS = [15, 30, 60];

const createPollForm = () => ({
  title: '',
  description: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '18:00',
  slotMinutes: 30,
  proposedSlots: {},
});

const makeSlotKey = (date, time) => `${date}__${time}`;

const parseSlotKey = (key) => {
  const [date, time] = String(key || '').split('__');
  return { date: date || '', time: time || '' };
};

const formatDate = (value) => {
  if (!value) return t('tbd_label');
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getMembershipLabel = (membershipId, memberships) => {
  const current = memberships.find((item) => item.id === membershipId);
  return current?.displayName || current?.name || current?.email || membershipId;
};

const normalizeSlotList = (items = []) => {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))].sort();
};

const collectSelectedKeys = (selectedMap = {}) =>
  Object.entries(selectedMap)
    .filter(([, selected]) => Boolean(selected))
    .map(([key]) => key)
    .sort();

const addMinutes = (time, minutesToAdd) => {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (hours * 60) + minutes + minutesToAdd;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const buildTimeRange = (startTime, endTime, slotMinutes) => {
  if (!startTime || !endTime || !slotMinutes) return [];
  const start = addMinutes(startTime, 0);
  const end = addMinutes(endTime, 0);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return [];

  const times = [];
  for (let current = start; current < end; current += slotMinutes) {
    times.push(minutesToTime(current));
  }
  return times;
};

const getProposedSlotKeys = (poll) => {
  const explicit = normalizeSlotList(poll.proposedSlots);
  if (explicit.length > 0) return explicit;
  const dates = Array.isArray(poll.dateOptions) ? poll.dateOptions : [];
  const times = Array.isArray(poll.timeOptions) ? poll.timeOptions : [];
  return dates.flatMap((date) => times.map((time) => makeSlotKey(date, time)));
};

const getGridModel = (slotKeys = []) => {
  const uniqueDates = [...new Set(slotKeys.map((key) => parseSlotKey(key).date).filter(Boolean))].sort();
  const uniqueTimes = [...new Set(slotKeys.map((key) => parseSlotKey(key).time).filter(Boolean))].sort();
  return {
    dates: uniqueDates,
    times: uniqueTimes,
    enabledSlots: new Set(slotKeys),
  };
};

function SelectionMatrix({
  dates,
  times,
  enabledSlots,
  selectedSlots,
  slotCounts = {},
  maxCount = 0,
  agreedSlot = null,
  onToggleSlot,
  readOnly = false,
}) {
  if (dates.length === 0 || times.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
        Ajusta el rango de fechas y horas para generar la cuadrícula.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/40">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-slate-700 bg-slate-900 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Hora
            </th>
            {dates.map((date) => (
              <th key={date} className="min-w-[92px] border-b border-slate-700 bg-slate-900 px-2 py-1.5 text-center sm:min-w-[104px]">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">
                  {new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' })}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-100 sm:text-xs">{formatDate(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time}>
              <th className="sticky left-0 z-10 border-r border-t border-slate-700 bg-slate-900 px-2 py-2 text-left text-[11px] font-medium text-slate-300 sm:text-xs">
                {time}
              </th>
              {dates.map((date) => {
                const slotKey = makeSlotKey(date, time);
                const enabled = enabledSlots.has(slotKey);
                const selected = Boolean(selectedSlots[slotKey]);
                const isAgreed = agreedSlot?.date === date && agreedSlot?.time === time;
                const count = slotCounts[slotKey] || 0;
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const baseClass = !enabled
                  ? 'bg-slate-950/30 text-slate-700'
                  : isAgreed
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                    : selected
                      ? 'bg-emerald-500/80 text-slate-950 border-emerald-300'
                      : intensity >= 0.75
                        ? 'bg-emerald-900/70 text-emerald-100 border-emerald-700/80'
                        : intensity >= 0.4
                          ? 'bg-emerald-950/60 text-emerald-200 border-emerald-900/70'
                          : 'bg-slate-900/90 text-slate-300 border-slate-800';

                return (
                  <td key={slotKey} className="border-t border-slate-800 p-1">
                    {enabled ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => onToggleSlot?.(date, time)}
                        className={`group flex h-14 w-full min-w-[84px] flex-col items-center justify-center rounded-lg border px-1.5 py-1 text-center transition-all sm:h-16 sm:min-w-[96px] ${
                          readOnly ? 'cursor-default' : 'hover:-translate-y-[1px] hover:border-emerald-400/60'
                        } ${baseClass}`}
                      >
                        <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">
                          {isAgreed ? 'Acordado' : selected ? 'Seleccionado' : count > 0 ? `${count} disponible${count === 1 ? '' : 's'}` : 'Disponible'}
                        </span>
                        <span className={`mt-0.5 text-[9px] leading-tight sm:text-[10px] ${selected || isAgreed ? 'text-slate-950/80' : 'text-slate-400 group-hover:text-slate-200'}`}>
                          {selected || isAgreed ? 'Click para ajustar' : 'Click para marcar'}
                        </span>
                      </button>
                    ) : (
                      <div className="h-14 min-w-[84px] rounded-lg border border-dashed border-slate-800 bg-slate-950/20 sm:h-16 sm:min-w-[96px]" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AvailabilityPollsSection({
  polls,
  categories,
  memberships,
  currentMembership,
  canCreate,
  resolveCanEdit,
  onCreatePoll,
  onUpdatePoll,
  onDeletePoll,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(createPollForm());
  const [expandedId, setExpandedId] = useState(null);

  const draftDates = useMemo(
    () => buildDateRange(form.startDate, form.endDate),
    [form.startDate, form.endDate],
  );
  const draftTimes = useMemo(
    () => buildTimeRange(form.startTime, form.endTime, Number(form.slotMinutes) || 30),
    [form.startTime, form.endTime, form.slotMinutes],
  );
  const draftEnabledSlots = useMemo(
    () => new Set(draftDates.flatMap((date) => draftTimes.map((time) => makeSlotKey(date, time)))),
    [draftDates, draftTimes],
  );

  const toggleDraftSlot = (date, time) => {
    const slotKey = makeSlotKey(date, time);
    setForm((current) => ({
      ...current,
      proposedSlots: {
        ...current.proposedSlots,
        [slotKey]: !current.proposedSlots[slotKey],
      },
    }));
  };

  const clearUnavailableDraftSlots = () => {
    setForm((current) => {
      const nextSlots = {};
      Object.entries(current.proposedSlots).forEach(([key, selected]) => {
        if (!selected || !draftEnabledSlots.has(key)) return;
        nextSlots[key] = true;
      });
      return { ...current, proposedSlots: nextSlots };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const proposedSlots = collectSelectedKeys(form.proposedSlots).filter((key) => draftEnabledSlots.has(key));
    if (!title || proposedSlots.length === 0) return;

    const dateOptions = [...new Set(proposedSlots.map((key) => parseSlotKey(key).date))].sort();
    const timeOptions = [...new Set(proposedSlots.map((key) => parseSlotKey(key).time))].sort();

    await onCreatePoll({
      title,
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      dateOptions,
      timeOptions,
      proposedSlots,
      slotMinutes: Number(form.slotMinutes) || 30,
    });

    setForm(createPollForm());
    setShowCreateForm(false);
  };

  const sortedPolls = useMemo(
    () => [...polls].sort((a, b) => {
      const aDate = a.agreedSlot?.date || getProposedSlotKeys(a)[0] || '';
      const bDate = b.agreedSlot?.date || getProposedSlotKeys(b)[0] || '';
      return aDate.localeCompare(bDate);
    }),
    [polls],
  );

  const myMembershipId = currentMembership?.id || null;

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="space-y-3">
          {!showCreateForm && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
              >
                Nueva encuesta
              </button>
            </div>
          )}

          {showCreateForm && (
            <form onSubmit={handleCreate} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="border-b border-slate-700 pb-3 text-center">
                <div className="text-lg font-semibold text-slate-100">Coordinar horario</div>
                <div className="mt-1 text-xs text-slate-400">Elige un rango y marca con clics exactamente los horarios que quieres proponer.</div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px]">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Titulo</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                    placeholder="Ej. Reunion de integracion del sistema"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">{t('scope_label')}</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">{t('scope_global')}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {t('scope_category')} {ensureString(category.name, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Descripcion</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  placeholder="Que se va a coordinar y que criterios importa considerar"
                  className="mt-1 min-h-[90px] w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Fecha inicial</label>
                  <PickerField
                    type="date"
                    value={form.startDate}
                    onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
                    placeholder="Seleccionar fecha"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Fecha final</label>
                  <PickerField
                    type="date"
                    value={form.endDate}
                    onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
                    placeholder="Seleccionar fecha"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Hora inicial</label>
                  <PickerField
                    type="time"
                    value={form.startTime}
                    onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
                    placeholder="Seleccionar hora"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Hora final</label>
                  <PickerField
                    type="time"
                    value={form.endTime}
                    onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
                    placeholder="Seleccionar hora"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Intervalo</label>
                  <select
                    value={form.slotMinutes}
                    onChange={(e) => setForm((current) => ({ ...current, slotMinutes: Number(e.target.value) || 30 }))}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    {SLOT_STEP_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option} min</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Horarios propuestos</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Marca solo las celdas que quieras habilitar para la encuesta.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={clearUnavailableDraftSlots}
                      className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
                    >
                      Limpiar fuera del rango
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, proposedSlots: {} }))}
                      className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
                    >
                      Borrar selección
                    </button>
                  </div>
                </div>

                <SelectionMatrix
                  dates={draftDates}
                  times={draftTimes}
                  enabledSlots={draftEnabledSlots}
                  selectedSlots={form.proposedSlots}
                  onToggleSlot={toggleDraftSlot}
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    {collectSelectedKeys(form.proposedSlots).filter((key) => draftEnabledSlots.has(key)).length} horarios seleccionados
                  </span>
                  <span className="text-slate-500">
                    Consejo: puedes proponer solo algunos bloques y dejar otros fuera.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setForm(createPollForm()); }}
                  className="text-xs text-slate-400 underline"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">
                  Crear encuesta
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {sortedPolls.length === 0 && (
        <div className="rounded-lg bg-slate-800 p-8 text-center text-xs text-slate-500">
          Aun no hay encuestas de disponibilidad. Crea una para coordinar horarios.
        </div>
      )}

      {sortedPolls.map((poll) => {
        const canEditThis = resolveCanEdit(poll);
        const isExpanded = expandedId === poll.id;
        const responses = poll.responses || {};
        const totalResponses = Object.keys(responses).length;
        const slotCounts = {};
        const proposedSlotKeys = getProposedSlotKeys(poll);
        const { dates, times, enabledSlots } = getGridModel(proposedSlotKeys);

        Object.values(responses).forEach((memberSlots) => {
          Object.entries(memberSlots || {}).forEach(([slotKey, enabled]) => {
            if (!enabled || !enabledSlots.has(slotKey)) return;
            slotCounts[slotKey] = (slotCounts[slotKey] || 0) + 1;
          });
        });

        const sortedSuggestions = proposedSlotKeys
          .map((slotKey) => ({ slotKey, count: slotCounts[slotKey] || 0 }))
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.slotKey.localeCompare(b.slotKey);
          });

        const bestEntry = sortedSuggestions[0] || null;
        const bestSlot = bestEntry ? parseSlotKey(bestEntry.slotKey) : null;
        const mySlots = myMembershipId ? (responses[myMembershipId] || {}) : {};
        const maxCount = Math.max(0, ...Object.values(slotCounts));

        const toggleSlot = async (date, time) => {
          if (!myMembershipId || poll.agreedSlot) return;
          const slotKey = makeSlotKey(date, time);
          if (!enabledSlots.has(slotKey)) return;
          const nextForMe = { ...mySlots, [slotKey]: !mySlots[slotKey] };
          if (!nextForMe[slotKey]) delete nextForMe[slotKey];
          await onUpdatePoll(poll.id, {
            responses: {
              ...responses,
              [myMembershipId]: nextForMe,
            },
          });
        };

        const finalizeSlot = async (slotKey) => {
          const { date, time } = parseSlotKey(slotKey);
          const expiry = new Date(`${date}T12:00:00`);
          expiry.setDate(expiry.getDate() + 7);
          await onUpdatePoll(poll.id, {
            agreedSlot: { date, time },
            expiresAt: expiry,
          });
        };

        const clearAgreement = async () => {
          await onUpdatePoll(poll.id, {
            agreedSlot: null,
            expiresAt: null,
          });
        };

        return (
          <div key={poll.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : poll.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-100">{ensureString(poll.title, lang)}</div>
                  {poll.categoryId ? (
                    <span className="rounded-full bg-blue-900/40 px-1.5 py-0.5 text-[9px] text-blue-300">
                      {t('scope_category')} {ensureString(categories.find((category) => category.id === poll.categoryId)?.name, lang) || poll.categoryId}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">{t('scope_global')}</span>
                  )}
                </div>
                {poll.description && <div className="mt-1 text-xs text-slate-400">{poll.description}</div>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>{totalResponses} respuesta{totalResponses === 1 ? '' : 's'}</span>
                  <span>{proposedSlotKeys.length} horario{proposedSlotKeys.length === 1 ? '' : 's'} propuesto{proposedSlotKeys.length === 1 ? '' : 's'}</span>
                  {bestSlot && !poll.agreedSlot && <span>Mejor opcion actual: {formatDate(bestSlot.date)} a las {bestSlot.time}</span>}
                  {poll.agreedSlot && <span className="text-emerald-300">Acordado: {formatDate(poll.agreedSlot.date)} a las {poll.agreedSlot.time}</span>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canEditThis && (
                  <button type="button" onClick={() => onDeletePoll(poll.id)} className="text-[11px] text-red-400 underline">
                    {t('delete')}
                  </button>
                )}
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : poll.id)} className="text-slate-400">
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-4 border-t border-slate-700 px-4 py-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Disponibilidad por horario</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {poll.agreedSlot
                          ? 'La encuesta ya tiene horario acordado.'
                          : 'Haz clic en las celdas donde puedes asistir.'}
                      </div>
                    </div>
                    {!poll.agreedSlot && (
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                          Tu selección
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-900/80" />
                          Más coincidencias
                        </span>
                      </div>
                    )}
                  </div>

                  <SelectionMatrix
                    dates={dates}
                    times={times}
                    enabledSlots={enabledSlots}
                    selectedSlots={mySlots}
                    slotCounts={slotCounts}
                    maxCount={maxCount}
                    agreedSlot={poll.agreedSlot}
                    onToggleSlot={toggleSlot}
                    readOnly={!myMembershipId || Boolean(poll.agreedSlot)}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_360px]">
                  <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Participantes</div>
                    <div className="space-y-1 text-sm text-slate-300">
                      {Object.keys(responses).length > 0 ? Object.keys(responses).map((membershipId) => (
                        <div key={membershipId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                          <span>{getMembershipLabel(membershipId, memberships)}</span>
                          <span className="text-xs text-slate-500">
                            {Object.values(responses[membershipId] || {}).filter(Boolean).length} disponibilidad{Object.values(responses[membershipId] || {}).filter(Boolean).length === 1 ? '' : 'es'}
                          </span>
                        </div>
                      )) : (
                        <div className="text-slate-500">Aun no hay respuestas.</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Mejores coincidencias</div>
                      <div className="space-y-2">
                        {sortedSuggestions.slice(0, 5).map(({ slotKey, count }) => {
                          const slot = parseSlotKey(slotKey);
                          const isAgreed = poll.agreedSlot?.date === slot.date && poll.agreedSlot?.time === slot.time;
                          return (
                            <div key={slotKey} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-slate-200">{formatDate(slot.date)} · {slot.time}</div>
                                <div className="text-xs text-slate-500">{count} disponible{count === 1 ? '' : 's'}</div>
                              </div>
                              {canEditThis && !poll.agreedSlot ? (
                                <button
                                  type="button"
                                  onClick={() => finalizeSlot(slotKey)}
                                  className="rounded bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-300"
                                >
                                  Acordar
                                </button>
                              ) : isAgreed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                                  <Check className="h-3.5 w-3.5" />
                                  Final
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                        {sortedSuggestions.length === 0 && (
                          <div className="text-sm text-slate-500">Todavia no hay horarios seleccionados en esta encuesta.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Estado del acuerdo</div>
                      {poll.agreedSlot ? (
                        <div className="space-y-2">
                          <div className="text-sm text-emerald-300">
                            {formatDate(poll.agreedSlot.date)} a las {poll.agreedSlot.time}
                          </div>
                          <div className="text-xs text-slate-500">
                            Esta encuesta se elimina una semana despues de la fecha acordada.
                          </div>
                          {poll.expiresAt && (
                            <div className="text-xs text-slate-500">
                              Expira: {new Date(typeof poll.expiresAt?.toDate === 'function' ? poll.expiresAt.toDate() : poll.expiresAt).toLocaleDateString('es-MX')}
                            </div>
                          )}
                          {canEditThis && (
                            <button type="button" onClick={clearAgreement} className="text-xs text-amber-300 underline">
                              Quitar acuerdo
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">Aun no se ha fijado un horario final.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
