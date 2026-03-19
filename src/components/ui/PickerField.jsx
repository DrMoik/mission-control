import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import ModalOverlay from '../ModalOverlay.jsx';

const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeValue(hours, minutes) {
  return `${pad(hours)}:${pad(minutes)}`;
}

function parseTimeValue(value) {
  const [rawHours = '0', rawMinutes = '0'] = String(value || '').split(':');
  return {
    hours: Math.max(0, Math.min(23, Number(rawHours) || 0)),
    minutes: Math.max(0, Math.min(59, Number(rawMinutes) || 0)),
  };
}

function parseDateTimeValue(value) {
  if (!value) return { date: '', time: '09:00' };
  const [date = '', time = '09:00'] = String(value).split('T');
  return { date, time: time.slice(0, 5) || '09:00' };
}

function toStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function formatDisplayValue(type, value) {
  if (!value) return '';
  if (type === 'time') return value;
  if (type === 'datetime-local') {
    const { date, time } = parseDateTimeValue(value);
    const parsed = parseDateValue(date);
    if (!parsed) return value;
    return `${parsed.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · ${time}`;
  }
  const parsed = parseDateValue(value);
  return parsed
    ? parsed.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : value;
}

function CalendarPanel({ selectedDate, viewMonth, minDate, maxDate, onPrevMonth, onNextMonth, onPickDate }) {
  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-emerald-400/60 hover:text-emerald-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-slate-100">
          {viewMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-emerald-400/60 hover:text-emerald-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {dayNames.map((name, index) => (
          <div key={`${name}-${index}`} className="py-1">{name}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isSelected = selectedDate && formatDateValue(selectedDate) === formatDateValue(day);
          const isBeforeMin = minDate && formatDateValue(day) < formatDateValue(minDate);
          const isAfterMax = maxDate && formatDateValue(day) > formatDateValue(maxDate);
          const isDisabled = isBeforeMin || isAfterMax;
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onPickDate(day)}
              className={`h-10 rounded-xl border text-sm transition-colors ${
                isDisabled
                  ? 'cursor-not-allowed border-slate-800 bg-slate-950/20 text-slate-700'
                  :
                isSelected
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                  : isCurrentMonth
                    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800'
                    : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700'
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimePanel({ timeValue, onChange }) {
  const { hours, minutes } = parseTimeValue(timeValue);
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Hora</div>
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1">
          {Array.from({ length: 24 }, (_, value) => (
            <button
              key={`hour-${value}`}
              type="button"
              onClick={() => onChange(formatTimeValue(value, minutes))}
              className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                hours === value
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/50'
              }`}
            >
              {pad(value)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Minutos</div>
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
          {minuteOptions.map((value) => (
            <button
              key={`minute-${value}`}
              type="button"
              onClick={() => onChange(formatTimeValue(hours, value))}
              className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                minutes === value
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/50'
              }`}
            >
              {pad(value)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PickerField({
  type = 'date',
  value = '',
  onChange,
  placeholder = '',
  min = '',
  max = '',
  className = '',
  buttonClassName = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = useMemo(() => {
    if (type === 'datetime-local') return parseDateValue(parseDateTimeValue(value).date);
    if (type === 'date') return parseDateValue(value);
    return null;
  }, [type, value]);
  const minDate = useMemo(() => (type !== 'time' ? parseDateValue(type === 'datetime-local' ? parseDateTimeValue(min).date : min) : null), [type, min]);
  const maxDate = useMemo(() => (type !== 'time' ? parseDateValue(type === 'datetime-local' ? parseDateTimeValue(max).date : max) : null), [type, max]);
  const [viewMonth, setViewMonth] = useState(parsedDate ? toStartOfMonth(parsedDate) : toStartOfMonth(new Date()));
  const [draftTime, setDraftTime] = useState(type === 'datetime-local' ? parseDateTimeValue(value).time : value || '09:00');

  useEffect(() => {
    if (parsedDate) setViewMonth(toStartOfMonth(parsedDate));
  }, [parsedDate]);

  useEffect(() => {
    if (type === 'datetime-local') {
      setDraftTime(parseDateTimeValue(value).time);
      return;
    }
    if (type === 'time') setDraftTime(value || '09:00');
  }, [type, value]);

  const displayValue = formatDisplayValue(type, value);
  const icon = type === 'time' ? <Clock3 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />;

  const commitDate = (nextDate) => {
    if (minDate && nextDate < minDate) return;
    if (maxDate && nextDate > maxDate) return;
    const nextDateValue = formatDateValue(nextDate);
    if (type === 'datetime-local') {
      onChange?.(`${nextDateValue}T${draftTime || '09:00'}`);
      return;
    }
    onChange?.(nextDateValue);
    setOpen(false);
  };

  const commitTime = (nextTime) => {
    if (type === 'datetime-local') {
      setDraftTime(nextTime);
      const currentDate = parseDateTimeValue(value).date || formatDateValue(parsedDate || new Date());
      onChange?.(`${currentDate}T${nextTime}`);
      return;
    }
    onChange?.(nextTime);
    setOpen(false);
  };

  const clearValue = () => {
    onChange?.('');
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`${className} ${buttonClassName} flex w-full items-center justify-between gap-2 text-left ${disabled ? 'opacity-60' : ''}`.trim()}
      >
        <span className={`truncate ${displayValue ? 'text-slate-100' : 'text-slate-500'}`}>
          {displayValue || placeholder}
        </span>
        <span className="shrink-0 text-slate-400">{icon}</span>
      </button>

      {open && (
        <ModalOverlay onClickBackdrop={() => setOpen(false)}>
          <div className="w-[min(92vw,720px)] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {type === 'time' ? 'Seleccionar hora' : type === 'datetime-local' ? 'Seleccionar fecha y hora' : 'Seleccionar fecha'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {displayValue || placeholder || 'Elige un valor'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-400 underline transition-colors hover:text-slate-200"
              >
                Cerrar
              </button>
            </div>

            <div className={`grid gap-4 ${type === 'datetime-local' ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
              {type !== 'time' && (
                <CalendarPanel
                  selectedDate={parsedDate}
                  viewMonth={viewMonth}
                  minDate={minDate}
                  maxDate={maxDate}
                  onPrevMonth={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  onNextMonth={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  onPickDate={commitDate}
                />
              )}

              {type !== 'date' && (
                <TimePanel
                  timeValue={type === 'datetime-local' ? draftTime : value}
                  onChange={commitTime}
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-4">
              <div className="flex gap-2">
                {type !== 'time' && (
                  <button
                    type="button"
                    onClick={() => commitDate(new Date())}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
                  >
                    Hoy
                  </button>
                )}
                {type === 'time' && (
                  <button
                    type="button"
                    onClick={() => commitTime(formatTimeValue(new Date().getHours(), Math.floor(new Date().getMinutes() / 5) * 5))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
                  >
                    Ahora
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearValue}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
