// ─── CountdownBar ────────────────────────────────────────────────────────────
// Always-visible strip under the header with countdowns to team deadlines
// (e.g. contests). Stored on the team doc as `countdowns: [{ id, label, at, icon }]`
// where `at` is an ISO timestamp and `icon` a key of COUNTDOWN_ICONS. Only admins (canEdit) can program them;
// past countdowns are hidden from the strip but stay editable.

import { useEffect, useState } from 'react';
import {
  Pencil, Plus, Trash2, Trophy, Rocket, Bot, Flag, Medal, Star, PartyPopper, CalendarDays, Plane, Cpu, Mic, GraduationCap,
} from 'lucide-react';
import ModalOverlay from './ModalOverlay.jsx';
import PickerField from './ui/PickerField.jsx';
import { remainingParts } from '../utils.js';

const COUNTDOWN_ICONS = {
  trophy: Trophy, rocket: Rocket, bot: Bot, flag: Flag, medal: Medal, star: Star,
  party: PartyPopper, calendar: CalendarDays, plane: Plane, cpu: Cpu, mic: Mic, grad: GraduationCap,
};
const iconFor = (key) => COUNTDOWN_ICONS[key] || Trophy;

const pad = (n) => String(n).padStart(2, '0');

// ISO → "YYYY-MM-DDTHH:mm" in local time (PickerField's datetime-local format).
const toLocalInput = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function CountdownEditor({ countdowns, onSave, onClose, t }) {
  const [rows, setRows] = useState(() => countdowns.map((c) => ({ ...c, at: toLocalInput(c.at) })));
  const [saving, setSaving] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(null); // row id whose icon grid is open
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(rows
        .filter((r) => r.label.trim() && r.at)
        .map((r) => ({ id: r.id, label: r.label.trim(), at: new Date(r.at).toISOString(), icon: r.icon || 'trophy' })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClickBackdrop={onClose}>
      <div className="w-[min(92vw,560px)] rounded-2xl border border-hairline bg-slate-900 p-4 shadow-2xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">{t('countdowns_title')}</h2>
        {rows.map((row, i) => {
          const RowIcon = iconFor(row.icon);
          return (
          <div key={row.id} className="space-y-2 rounded-xl border border-hairline p-2.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPickingIcon((id) => (id === row.id ? null : row.id))}
              className="p-2 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
              title={t('countdown_icon')} aria-label={t('countdown_icon')}>
              <RowIcon className="w-5 h-5" />
            </button>
            <input value={row.label} onChange={(e) => setRow(i, { label: e.target.value })}
              placeholder={t('countdown_label_ph')}
              className="flex-1 min-w-0 bg-surface-raised border border-hairline rounded-lg px-3 py-2 text-sm text-content-primary" />
            <button onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              className="p-2 text-content-tertiary hover:text-red-400" aria-label={t('delete')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <PickerField type="datetime-local" value={row.at} onChange={(v) => setRow(i, { at: v })} />
          {pickingIcon === row.id && (
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-black/20 p-2">
              {Object.keys(COUNTDOWN_ICONS).map((key) => {
                const Icon = COUNTDOWN_ICONS[key];
                return (
                <button key={key} type="button" onClick={() => { setRow(i, { icon: key }); setPickingIcon(null); }}
                  className={`p-2 rounded-lg hover:bg-white/10 ${(row.icon || 'trophy') === key ? 'bg-amber-400/20 text-amber-300' : 'text-content-secondary'}`}
                  aria-label={key}>
                  <Icon className="w-5 h-5" />
                </button>
                );
              })}
            </div>
          )}
          </div>
          );
        })}
        <button onClick={() => setRows((r) => [...r, { id: crypto.randomUUID(), label: '', at: '', icon: 'trophy' }])}
          className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="w-3.5 h-3.5" /> {t('countdown_add')}
        </button>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-content-secondary">{t('cancel')}</button>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white disabled:opacity-50">{t('save')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

export default function CountdownBar({ countdowns = [], canEdit, onSave, t }) {
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);

  const upcoming = countdowns
    .filter((c) => new Date(c.at).getTime() > now)
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  useEffect(() => {
    if (upcoming.length === 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [upcoming.length]);

  if (upcoming.length === 0 && !canEdit) return null;

  return (
    <div className="shrink-0 border-b border-hairline bg-gradient-to-r from-fuchsia-950/40 via-slate-900/60 to-amber-950/40 flex items-center">
      <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 overflow-x-auto snap-x snap-mandatory sm:flex-wrap sm:overflow-visible [scrollbar-width:none]">
        {upcoming.map((c) => {
          const ms = new Date(c.at).getTime() - now;
          const { d, h, m, s } = remainingParts(ms);
          const units = [[d, t('countdown_days')], [h, t('countdown_hours')], [m, t('countdown_minutes')], [s, t('countdown_seconds')]];
          const Icon = iconFor(c.icon);
          return (
            <div key={c.id}
              className={`snap-start shrink-0 flex items-center gap-2 sm:gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-fuchsia-500/10 px-2.5 sm:px-3 py-1.5 sm:py-2 ${ms < 86_400_000 ? 'animate-glow-breathe' : ''}`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-amber-200 truncate max-w-[11rem] sm:max-w-[14rem]">{c.label}</div>
                <div className="flex items-end gap-1 sm:gap-1.5 mt-0.5">
                  {units.map(([v, label]) => (
                    <div key={label} className="flex flex-col items-center">
                      <span className="font-mono tabular-nums text-base sm:text-2xl font-bold leading-none text-content-primary rounded-md bg-black/30 px-1 sm:px-1.5 py-0.5 sm:py-1">
                        {String(v).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-content-tertiary mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {upcoming.length === 0 && <span className="text-xs text-content-tertiary">{t('countdowns_empty')}</span>}
      </div>
      {canEdit && (
        <button onClick={() => setEditing(true)} className="shrink-0 p-2 mr-1.5 text-content-tertiary hover:text-content-primary"
          title={t('countdowns_edit')} aria-label={t('countdowns_edit')}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {editing && <CountdownEditor countdowns={countdowns} onSave={onSave} onClose={() => setEditing(false)} t={t} />}
    </div>
  );
}
