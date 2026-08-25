// ─── EventLogisticsSection ─────────────────────────────────────────────────
// Event logistics: owners (from team memberships), guests, budget/coverage,
// and a per-event expense breakdown. Adapted from a standalone HTML mockup;
// "Encargados" reuses real team memberships instead of an ad-hoc roster.

import React, { useState, useMemo } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { confirmDialog } from '../../services/feedback.js';
import ModalOverlay from '../../components/ModalOverlay.jsx';
import PickerField from '../../components/ui/PickerField.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { ensureString } from '../../utils.js';

const CONFIRM_OPTS = ['Sí', 'No', 'En negociación'];
const GUEST_STATUS_OPTS = ['Confirmado', 'Pendiente', 'En negociación', 'No aplica', 'Declinó'];
const MERCH_OPTS = ['Sí', 'No', 'Por definir'];
const STATUS_OPTS = ['En planeación', 'En preparación', 'Confirmado', 'Realizado', 'Cancelado'];

const CONFIRM_SELECT = { 'Sí': 'text-teal-300', 'No': 'text-slate-400', 'En negociación': 'text-amber-300' };
const MERCH_SELECT = { 'Sí': 'text-teal-300', 'No': 'text-slate-400', 'Por definir': 'text-amber-300' };
const STATUS_SELECT = {
  'En planeación': 'text-blue-300', 'En preparación': 'text-amber-300', 'Confirmado': 'text-teal-300',
  'Realizado': 'text-slate-400', 'Cancelado': 'text-red-300',
};
const STATUS_BADGE = {
  'En planeación': 'bg-blue-900/40 text-blue-300', 'En preparación': 'bg-amber-900/40 text-amber-300',
  'Confirmado': 'bg-teal-900/60 text-teal-300', 'Realizado': 'bg-slate-700/60 text-slate-300', 'Cancelado': 'bg-red-950/40 text-red-300',
};
const GUEST_BADGE = {
  Confirmado: 'bg-teal-900/60 text-teal-300', Pendiente: 'bg-amber-900/40 text-amber-300', 'En negociación': 'bg-blue-900/40 text-blue-300',
  'No aplica': 'bg-slate-700/60 text-slate-300', Declinó: 'bg-red-950/40 text-red-300',
};

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;
const parseDay = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const daysUntil = (value) => {
  const d = parseDay(value);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

const emptyForm = { name: '', place: '', date: '', categoryId: '' };
const genId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Assign event owners from real team memberships — same pattern as MeetingsSection's attendee picker. */
function OwnerSelect({ memberships = [], selected = [], onChange }) {
  const activeNames = memberships
    .filter((m) => m.status === 'active')
    .map((m) => ({ id: m.id, name: ensureString(m.displayName, lang).trim() }))
    .filter((m) => m.name);
  const selectedSet = new Set(selected);
  const available = activeNames.filter((m) => !selectedSet.has(m.name));

  return (
    <div className="space-y-2">
      <select value="" onChange={(e) => { const v = e.target.value; if (v) onChange([...selected, v]); }}
        className="w-full px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary">
        <option value="">{t('logistics_add_owner_ph')}</option>
        {available.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
      </select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-surface-overlay px-2 py-0.5 text-xs text-content-secondary">
              {name}
              <button type="button" onClick={() => onChange(selected.filter((n) => n !== name))} className="text-content-tertiary hover:text-red-400">
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Proportional horizontal bar list — no chart library. */
function CostBarList({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-content-secondary" title={i.label}>{i.label}</span>
          <div className="flex-1 h-3 bg-surface-sunken rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-content-tertiary">{fmtMoney(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   events:          object[],           // already filtered for visibility
 *   memberships:     object[],           // for the owners picker
 *   categories:      object[],
 *   scopeCategories: object[],
 *   canCreate:       boolean,
 *   resolveCanEdit:  function(event): boolean,
 *   onCreateEvent:   function(data): Promise<void>,
 *   onUpdateEvent:   function(id, updates): Promise<void>,
 *   onDeleteEvent:   function(id): Promise<void>,
 * }} props
 */
export default function EventLogisticsSection({
  events, memberships = [], categories, scopeCategories = categories, canCreate, resolveCanEdit,
  onCreateEvent, onUpdateEvent, onDeleteEvent,
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onCreateEvent({
      name: form.name.trim(),
      place: form.place.trim(),
      date: form.date,
      categoryId: form.categoryId || null,
      confirmed: 'No', owners: [], guests: [], merch: 'Por definir', food: 'Por definir',
      budget: 0, covered: 0, pending: '', status: 'En planeación', expenses: [],
    });
    setForm(emptyForm);
    setShowForm(false);
  };

  const patchEvent = (event, patch) => onUpdateEvent(event.id, patch);
  const detail = detailId ? events.find((e) => e.id === detailId) : null;

  const stats = useMemo(() => {
    const budgetTotal = events.reduce((s, e) => s + (e.budget || 0), 0);
    const coveredTotal = events.reduce((s, e) => s + (e.covered || 0), 0);
    const pendingCount = events.filter((e) => (e.pending || '').trim()).length;
    const confirmedCount = events.filter((e) => e.status === 'Confirmado').length;
    const preparingCount = events.filter((e) => e.status === 'En preparación').length;
    const planningCount = events.filter((e) => e.status === 'En planeación').length;
    const upcoming = events
      .map((e) => ({ event: e, days: daysUntil(e.date) }))
      .filter((x) => x.days !== null && x.days >= 0)
      .sort((a, b) => a.days - b.days);
    const pendingGuests = [];
    events.forEach((e) => {
      (e.guests || []).forEach((g) => {
        if (g.status !== 'Confirmado' && g.status !== 'No aplica') pendingGuests.push({ ...g, eventName: e.name });
      });
    });
    const costBars = [...events].sort((a, b) => (b.budget || 0) - (a.budget || 0)).slice(0, 6)
      .map((e) => ({ label: e.name, value: e.budget || 0 }));
    return { budgetTotal, coveredTotal, pendingCount, confirmedCount, preparingCount, planningCount, upcoming, pendingGuests, costBars };
  }, [events]);

  const coveragePct = stats.budgetTotal > 0 ? Math.round((stats.coveredTotal / stats.budgetTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canCreate && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('logistics_new_btn')}
          </Button>
        )}
      </div>

      {canCreate && showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-hairline bg-surface-raised p-4 flex flex-wrap gap-2 items-end">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('logistics_name_ph')} className="flex-1 min-w-[160px] text-xs" />
          <Input value={form.place} onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
            placeholder={t('logistics_place_ph')} className="min-w-[140px] text-xs" />
          <PickerField type="date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))}
            className="w-32 px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary" />
          <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-secondary">
            <option value="">{t('scope_global')}</option>
            {scopeCategories.map((c) => <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>)}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
          <Button type="submit" size="sm">{t('logistics_new_btn')}</Button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-slate-500 italic">{t('logistics_no_events')}</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('logistics_kpi_total')}</div>
              <div className="text-xl font-bold text-content-primary mt-1">{events.length}</div>
              <div className="text-[10px] text-content-tertiary">{stats.confirmedCount} confirmados · {stats.preparingCount} en preparación · {stats.planningCount} en planeación</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('logistics_kpi_next')}</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{stats.upcoming[0] ? `${stats.upcoming[0].days}d` : '—'}</div>
              <div className="text-[10px] text-content-tertiary truncate">{stats.upcoming[0]?.event.name || t('logistics_kpi_next_none')}</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('logistics_kpi_budget')}</div>
              <div className="text-xl font-bold text-teal-400 mt-1">{fmtMoney(stats.budgetTotal)}</div>
              <div className="text-[10px] text-content-tertiary">{t('logistics_kpi_budget_sub')}</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('logistics_kpi_pending')}</div>
              <div className="text-xl font-bold text-red-400 mt-1">{stats.pendingCount}</div>
            </div>
          </div>

          {/* Coverage + cost bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('logistics_coverage_title')}</div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-bold text-teal-400">{coveragePct}%</span>
                <span className="text-xs text-content-tertiary">{fmtMoney(stats.coveredTotal)} / {fmtMoney(stats.budgetTotal)}</span>
              </div>
              <div className="w-full bg-surface-sunken rounded-full h-2.5">
                <div className="bg-teal-500 h-2.5 rounded-full transition-all" style={{ width: `${coveragePct}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('logistics_cost_per_event')}</div>
              {stats.costBars.length > 0 ? <CostBarList items={stats.costBars} /> : <p className="text-xs text-slate-500 italic">{t('nothing_yet')}</p>}
            </div>
          </div>

          {/* Upcoming + guests pending */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('logistics_upcoming_title')}</div>
              {stats.upcoming.length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('logistics_no_upcoming')}</p>
              ) : (
                <div className="divide-y divide-slate-700/40">
                  {stats.upcoming.slice(0, 6).map(({ event, days }) => (
                    <div key={event.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-content-primary truncate">{event.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[event.status] || ''}`}>{event.status}</span>
                      </div>
                      <div className="text-[11px] text-content-tertiary mt-0.5 flex flex-wrap gap-x-3">
                        <span>{event.date || '—'}</span>
                        <span>{event.place || t('logistics_kpi_next_none')}</span>
                        <span>{(event.owners || []).join(', ') || t('logistics_owners_none')}</span>
                        <span>en {days} días</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('logistics_guests_pending_title')}</div>
              {stats.pendingGuests.length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('logistics_no_guests_pending')}</p>
              ) : (
                <div className="divide-y divide-slate-700/40">
                  {stats.pendingGuests.map((g, idx) => (
                    <div key={`${g.id}-${idx}`} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-content-primary truncate">{g.name}</div>
                        <div className="text-[10px] text-content-tertiary truncate">{g.eventName}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${GUEST_BADGE[g.status] || ''}`}>{g.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-hairline bg-surface-raised overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[1080px]">
              <thead>
                <tr className="bg-slate-900/60 text-content-tertiary uppercase text-[10px] tracking-wider">
                  <th className="px-3 py-2 text-left">{t('logistics_col_name')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_date')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_place')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_confirmed')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_owners')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_guests')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_merch')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_food')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_budget')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_covered')}</th>
                  <th className="px-3 py-2 text-left">{t('logistics_col_status')}</th>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {events.map((ev) => {
                  const canEditThis = resolveCanEdit(ev);
                  const guests = ev.guests || [];
                  const confirmedGuests = guests.filter((g) => g.status === 'Confirmado').length;
                  return (
                    <tr key={ev.id} className="hover:bg-slate-700/10 group">
                      <td className="px-1 py-1">
                        <input type="text" defaultValue={ev.name} disabled={!canEditThis}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== ev.name) patchEvent(ev, { name: v }); }}
                          className="w-full min-w-[140px] bg-transparent px-2 py-1.5 text-content-primary font-medium focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <PickerField type="date" value={ev.date} onChange={(v) => canEditThis && patchEvent(ev, { date: v })}
                          className="w-28 bg-transparent px-2 py-1.5 text-content-secondary text-xs focus:outline-none" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" defaultValue={ev.place} disabled={!canEditThis}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v !== ev.place) patchEvent(ev, { place: v }); }}
                          className="w-full min-w-[120px] bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={ev.confirmed} disabled={!canEditThis} onChange={(e) => patchEvent(ev, { confirmed: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 font-semibold focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${CONFIRM_SELECT[ev.confirmed] || ''}`}>
                          {CONFIRM_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-content-secondary truncate max-w-[160px]" title={(ev.owners || []).join(', ')}>
                        {(ev.owners || []).join(', ') || <span className="text-content-tertiary italic">{t('logistics_owners_none')}</span>}
                      </td>
                      <td className="px-1 py-1">
                        <button type="button" onClick={() => setDetailId(ev.id)} className="w-full text-left px-2 py-1.5 hover:bg-surface-sunken rounded">
                          {guests.length === 0
                            ? <span className="text-content-tertiary italic">+ {t('logistics_add_guest')}</span>
                            : <span className="text-content-secondary">{guests.length} · {confirmedGuests}/{guests.length} <span className="text-teal-400">✓</span></span>}
                        </button>
                      </td>
                      <td className="px-1 py-1">
                        <select value={ev.merch} disabled={!canEditThis} onChange={(e) => patchEvent(ev, { merch: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${MERCH_SELECT[ev.merch] || ''}`}>
                          {MERCH_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select value={ev.food} disabled={!canEditThis} onChange={(e) => patchEvent(ev, { food: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${MERCH_SELECT[ev.food] || ''}`}>
                          {MERCH_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" defaultValue={ev.budget || 0} disabled={!canEditThis}
                          onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== (ev.budget || 0)) patchEvent(ev, { budget: v }); }}
                          className="w-24 bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" defaultValue={ev.covered || 0} disabled={!canEditThis}
                          onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== (ev.covered || 0)) patchEvent(ev, { covered: v }); }}
                          className="w-24 bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={ev.status} disabled={!canEditThis} onChange={(e) => patchEvent(ev, { status: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 font-semibold focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${STATUS_SELECT[ev.status] || ''}`}>
                          {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button type="button" onClick={() => setDetailId(ev.id)} className="text-content-tertiary hover:text-primary p-1" title={t('logistics_col_detail')}>
                          <Search className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </td>
                      <td className="px-1 py-1 text-center">
                        {canEditThis && (
                          <button type="button"
                            onClick={async () => { if (await confirmDialog({ message: t('delete_matrix_confirm'), confirmLabel: t('delete'), danger: true })) onDeleteEvent(ev.id); }}
                            className="text-content-tertiary hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title={t('delete')}>
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Detail modal */}
      {detail && (
        <ModalOverlay onClickBackdrop={() => setDetailId(null)}>
          <div className="bg-surface-raised rounded-2xl w-full max-w-3xl shadow-surface-xl border border-hairline p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-content-primary">{detail.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-content-tertiary">{detail.date || '—'} · {detail.place || '—'}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[detail.status] || ''}`}>{detail.status}</span>
                </div>
              </div>
              <button onClick={() => setDetailId(null)} className="text-content-tertiary hover:text-content-primary p-1.5 rounded-full hover:bg-surface-sunken">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-sunken rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-content-tertiary font-semibold">{t('logistics_col_budget')}</div>
                <div className="text-sm text-content-primary font-semibold mt-0.5">{fmtMoney(detail.budget)}</div>
              </div>
              <div className="bg-surface-sunken rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-content-tertiary font-semibold">{t('logistics_col_covered')}</div>
                <div className="text-sm text-content-primary font-semibold mt-0.5">{fmtMoney(detail.covered)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-content-tertiary">{t('logistics_owners')}</label>
              <OwnerSelect memberships={memberships} selected={detail.owners || []} onChange={(owners) => patchEvent(detail, { owners })} />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-content-tertiary">{t('logistics_pending')}</label>
              <textarea defaultValue={detail.pending} onBlur={(e) => patchEvent(detail, { pending: e.target.value })}
                rows={2} className="w-full text-xs bg-surface-sunken border border-slate-600 rounded-lg p-2 text-content-primary focus:outline-none focus:border-primary" />
            </div>

            {/* Guests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-content-tertiary">{t('logistics_guests')}</label>
                <button type="button"
                  onClick={() => patchEvent(detail, { guests: [...(detail.guests || []), { id: genId('g'), name: '', status: 'Pendiente' }] })}
                  className="text-[11px] text-teal-400 hover:underline">
                  + {t('logistics_add_guest')}
                </button>
              </div>
              {(detail.guests || []).length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('logistics_no_guests')}</p>
              ) : (
                <div className="space-y-1.5">
                  {(detail.guests || []).map((g) => (
                    <div key={g.id} className="flex gap-1.5 items-center">
                      <input type="text" defaultValue={g.name} placeholder={t('logistics_guest_name_ph')}
                        onBlur={(e) => patchEvent(detail, { guests: detail.guests.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x) })}
                        className="flex-1 min-w-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <select value={g.status} onChange={(e) => patchEvent(detail, { guests: detail.guests.map((x) => x.id === g.id ? { ...x, status: e.target.value } : x) })}
                        className="w-40 shrink-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary">
                        {GUEST_STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button type="button" onClick={() => patchEvent(detail, { guests: detail.guests.filter((x) => x.id !== g.id) })}
                        className="text-content-tertiary hover:text-red-400 p-1 shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-content-tertiary">{t('logistics_expenses')}</label>
                <button type="button"
                  onClick={() => patchEvent(detail, { expenses: [...(detail.expenses || []), { id: genId('x'), concept: '', amount: 0, paid: 'No' }] })}
                  className="text-[11px] text-teal-400 hover:underline">
                  + {t('logistics_add_expense')}
                </button>
              </div>
              {(detail.expenses || []).length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('logistics_no_expenses')}</p>
              ) : (
                <div className="space-y-1.5">
                  {(detail.expenses || []).map((g) => (
                    <div key={g.id} className="flex gap-1.5 items-center">
                      <input type="text" defaultValue={g.concept} placeholder={t('logistics_expense_concept_ph')}
                        onBlur={(e) => patchEvent(detail, { expenses: detail.expenses.map((x) => x.id === g.id ? { ...x, concept: e.target.value } : x) })}
                        className="flex-1 min-w-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <input type="number" defaultValue={g.amount || 0}
                        onBlur={(e) => patchEvent(detail, { expenses: detail.expenses.map((x) => x.id === g.id ? { ...x, amount: Number(e.target.value) || 0 } : x) })}
                        className="w-28 shrink-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <select value={g.paid} onChange={(e) => patchEvent(detail, { expenses: detail.expenses.map((x) => x.id === g.id ? { ...x, paid: e.target.value } : x) })}
                        className="w-24 shrink-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary">
                        <option value="Sí">{t('logistics_expense_paid')}: Sí</option>
                        <option value="No">{t('logistics_expense_paid')}: No</option>
                      </select>
                      <button type="button" onClick={() => patchEvent(detail, { expenses: detail.expenses.filter((x) => x.id !== g.id) })}
                        className="text-content-tertiary hover:text-red-400 p-1 shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  {(() => {
                    const totalSpent = (detail.expenses || []).reduce((s, g) => s + (g.amount || 0), 0);
                    const diff = (detail.budget || 0) - totalSpent;
                    return (
                      <div className="flex items-center justify-between text-xs font-semibold pt-1.5 border-t border-hairline">
                        <span className="text-content-secondary">{t('logistics_total_spent')}: {fmtMoney(totalSpent)}</span>
                        <span className={diff < 0 ? 'text-red-400' : 'text-teal-400'}>
                          {diff < 0 ? `${t('logistics_over_budget')} ${fmtMoney(Math.abs(diff))}` : `${t('logistics_available')}: ${fmtMoney(diff)}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {detail.lastEditedBy && (
              <p className="text-[10px] text-content-tertiary text-right pt-1 border-t border-hairline">
                {`Última edición por ${detail.lastEditedBy} el ${detail.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
              </p>
            )}
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
