import React, { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';
import ModalOverlay from '../../components/ModalOverlay.jsx';
import PickerField from '../../components/ui/PickerField.jsx';
import Card from '../../components/layout/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';

const SLOT_STEP_OPTIONS = [15, 30, 60];
const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createPollForm = () => ({
  title: '',
  description: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '18:00',
  slotMinutes: 30,
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
              <th key={date} className="min-w-[72px] border-b border-slate-700 bg-slate-900 px-1.5 py-1 text-center sm:min-w-[84px]">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">
                  {new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' })}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-100 sm:text-[11px]">{formatDate(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time}>
              <th className="sticky left-0 z-10 border-r border-t border-slate-700 bg-slate-900 px-1.5 py-1.5 text-left text-[10px] font-medium text-slate-300 sm:text-[11px]">
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
                    ? 'bg-emerald-300 border-emerald-200 text-slate-950'
                    : intensity >= 0.9
                      ? 'bg-emerald-300/95 border-emerald-200/90 text-slate-950'
                      : intensity >= 0.7
                        ? 'bg-emerald-400/70 border-emerald-300/80 text-slate-950'
                        : intensity >= 0.45
                          ? 'bg-emerald-500/45 border-emerald-400/65 text-slate-100'
                          : intensity > 0
                            ? 'bg-emerald-700/28 border-emerald-600/45 text-slate-200'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300';

                return (
                  <td key={slotKey} className="border-t border-slate-800 p-0.5">
                    {enabled ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => onToggleSlot?.(date, time)}
                        className={`group relative flex h-9 w-full min-w-[64px] items-center justify-center rounded-md border px-1 py-0.5 text-center transition-all sm:h-10 sm:min-w-[72px] ${
                          readOnly ? 'cursor-default' : 'hover:-translate-y-[1px] hover:border-emerald-200/80'
                        } ${baseClass}`}
                        title={
                          isAgreed
                            ? `Acordado: ${formatDate(date)} ${time}`
                            : count > 0
                              ? `${count} disponible${count === 1 ? '' : 's'}`
                              : selected
                                ? 'Seleccionado'
                                : 'Disponible'
                        }
                      >
                        {selected ? (
                          <span className="pointer-events-none absolute inset-0 rounded-md border-4 border-red-300 shadow-[0_0_0_2px_rgba(217,70,239,0.35)]" />
                        ) : null}
                        {isAgreed ? (
                          <span className="pointer-events-none absolute inset-0 rounded-md border-4 border-amber-200 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]" />
                        ) : null}
                      </button>
                    ) : (
                      <div className="h-9 min-w-[64px] rounded-md border border-dashed border-slate-800 bg-slate-950/20 sm:h-10 sm:min-w-[72px]" />
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
  const minDate = todayLocal();

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
  const toggleDraftSlot = () => {};
  const clearUnavailableDraftSlots = () => {};

  const handleCreate = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const proposedSlots = [...draftEnabledSlots].sort();
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
        <div className="flex justify-end">
          {!showCreateForm && (
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              Nueva encuesta
            </Button>
          )}

          {showCreateForm && (
            <ModalOverlay onClickBackdrop={() => { setShowCreateForm(false); setForm(createPollForm()); }}>
              <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="border-b border-slate-700 pb-3 text-center">
                  <div className="text-lg font-semibold text-slate-100">Coordinar horario</div>
                  <div className="mt-1 text-xs text-slate-500">Define solo el marco temporal. Despues, la comunidad vota directamente en la cuadrícula.</div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px]">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Titulo</label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                      placeholder="Ej. Reunion de integracion del sistema"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{t('scope_label')}</label>
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
                  <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Descripcion</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                    placeholder="Que se va a coordinar y que criterios importa considerar"
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Fecha inicial</label>
                    <PickerField
                      type="date"
                      value={form.startDate}
                      onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
                      min={minDate}
                      placeholder="Seleccionar fecha"
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Fecha final</label>
                    <PickerField
                      type="date"
                      value={form.endDate}
                      onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
                      min={form.startDate || minDate}
                      placeholder="Seleccionar fecha"
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Hora inicial</label>
                    <PickerField
                      type="time"
                      value={form.startTime}
                      onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
                      placeholder="Seleccionar hora"
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Hora final</label>
                    <PickerField
                      type="time"
                      value={form.endTime}
                      onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
                      placeholder="Seleccionar hora"
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Intervalo</label>
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

                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <div className="mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Vista previa del marco temporal</div>
                    <div className="mt-1 text-xs text-slate-500">
                      La encuesta se crea con todos los bloques del rango. La votacion ocurre despues en la cuadrícula.
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Dias</div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{draftDates.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Horarios por dia</div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{draftTimes.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Bloques totales</div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{draftEnabledSlots.size}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    {draftDates.length > 0 && draftTimes.length > 0
                      ? `Desde ${formatDate(draftDates[0])} hasta ${formatDate(draftDates[draftDates.length - 1])}`
                      : 'Selecciona un rango valido para crear la encuesta'}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowCreateForm(false); setForm(createPollForm()); }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" size="sm">
                    Crear encuesta
                  </Button>
                </div>
              </form>
            </ModalOverlay>
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
          <Card
            key={poll.id}
            padding={false}
            className={`overflow-hidden${poll.agreedSlot ? ' border-l-2 border-l-emerald-400' : ''}`}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : poll.id)}
              className="w-full px-4 py-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
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
                  {poll.description && <div className="mt-1 text-xs text-slate-500">{poll.description}</div>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>{totalResponses} respuesta{totalResponses === 1 ? '' : 's'}</span>
                    <span>{proposedSlotKeys.length} horario{proposedSlotKeys.length === 1 ? '' : 's'} propuesto{proposedSlotKeys.length === 1 ? '' : 's'}</span>
                    {bestSlot && !poll.agreedSlot && <span>Mejor opcion actual: {formatDate(bestSlot.date)} a las {bestSlot.time}</span>}
                    {poll.agreedSlot && (
                      <span className="font-semibold text-emerald-300">
                        Acordado: {formatDate(poll.agreedSlot.date)} a las {poll.agreedSlot.time}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="flex shrink-0 items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEditThis && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-red-400"
                      onClick={() => onDeletePoll(poll.id)}
                    >
                      {t('delete')}
                    </Button>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-150 ease-out-smooth${isExpanded ? ' rotate-180' : ''}`}
                  />
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="space-y-4 border-t border-slate-700 px-4 py-4">
                <Card>
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
                          <span className="h-2.5 w-4 rounded-full border border-emerald-50/95 bg-transparent" />
                          Tu selección
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                          <span className="h-1.5 w-4 rounded-full bg-emerald-200" />
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
                </Card>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_360px]">
                  <Card>
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
                  </Card>

                  <div className="space-y-3">
                    <Card>
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
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => finalizeSlot(slotKey)}
                                >
                                  Acordar
                                </Button>
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
                    </Card>

                    <Card>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Estado del acuerdo</div>
                      {poll.agreedSlot ? (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-emerald-300">
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
                            <Button variant="link" size="sm" onClick={clearAgreement}>
                              Quitar acuerdo
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">Aun no se ha fijado un horario final.</div>
                      )}
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
