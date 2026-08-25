// ─── SponsorsSection ───────────────────────────────────────────────────────
// Sponsor tracking: level, contribution type, contract dates and status,
// with a contacts sub-list per sponsor. Mirrors the team's
// "SEGUIMIENTO DE PATROCINADORES" spreadsheet — see SHEET_URL below.

import React, { useState, useMemo } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { confirmDialog } from '../../services/feedback.js';
import ModalOverlay from '../../components/ModalOverlay.jsx';
import PickerField from '../../components/ui/PickerField.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { ensureString } from '../../utils.js';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iEeyGP12-0vefgFJFtqGyHUJINIjOU5UW4DcFdLK05s/edit';

const LEVELS  = ['Oro', 'Plata', 'Bronce'];
const TYPES   = ['Dinero', 'Especie', 'Mixto'];
const STATUSES = ['Activo', 'Inactivo', 'En revisión', 'Pendiente'];

const LEVEL_BADGE  = { Oro: 'bg-amber-900/40 text-amber-300', Plata: 'bg-slate-700/60 text-slate-300', Bronce: 'bg-orange-900/40 text-orange-300' };
const STATUS_BADGE = { Activo: 'bg-teal-900/60 text-teal-300', Inactivo: 'bg-red-950/40 text-red-300', 'En revisión': 'bg-yellow-900/40 text-yellow-300', Pendiente: 'bg-blue-900/40 text-blue-300' };
const LEVEL_SELECT  = { Oro: 'text-amber-300', Plata: 'text-slate-300', Bronce: 'text-orange-300' };
const STATUS_SELECT = { Activo: 'text-teal-300', Inactivo: 'text-red-300', 'En revisión': 'text-yellow-300', Pendiente: 'text-blue-300' };

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
const durationMonths = (start, end) => {
  const s = parseDay(start), e = parseDay(end);
  if (!s || !e) return null;
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44)));
};

const emptyForm = { name: '', owner: '', level: 'Bronce', type: 'Dinero', categoryId: '' };

/** A thin proportional segment bar + legend — no chart library. */
function DistributionBar({ items, colors }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-xs text-slate-500 italic">{t('nothing_yet')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-sunken">
        {items.filter((i) => i.count > 0).map((i) => (
          <div key={i.label} style={{ width: `${(i.count / total) * 100}%`, backgroundColor: colors[i.label] }} title={`${i.label}: ${i.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-content-secondary">
        {items.map((i) => (
          <span key={i.label} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i.label] }} />
            {i.label} · {i.count}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   sponsors:        object[],           // already filtered for visibility
 *   categories:      object[],
 *   scopeCategories: object[],
 *   canCreate:       boolean,
 *   resolveCanEdit:  function(sponsor): boolean,
 *   onCreateSponsor: function(data): Promise<void>,
 *   onUpdateSponsor: function(id, updates): Promise<void>,
 *   onDeleteSponsor: function(id): Promise<void>,
 * }} props
 */
export default function SponsorsSection({
  sponsors, categories, scopeCategories = categories, canCreate, resolveCanEdit,
  onCreateSponsor, onUpdateSponsor, onDeleteSponsor,
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onCreateSponsor({
      name: form.name.trim(),
      owner: form.owner.trim(),
      level: form.level,
      type: form.type,
      categoryId: form.categoryId || null,
      amount: 0,
      startDate: '', endDate: '', status: 'Pendiente',
      benefitReceived: '', benefitGiven: '', notes: '',
      contacts: [],
    });
    setForm(emptyForm);
    setShowForm(false);
  };

  const patchSponsor = (sponsor, patch) => onUpdateSponsor(sponsor.id, patch);

  const detail = detailId ? sponsors.find((s) => s.id === detailId) : null;

  // ── KPIs & distributions ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const cash = sponsors.filter((s) => s.type === 'Dinero').reduce((sum, s) => sum + (s.amount || 0), 0);
    const kind = sponsors.filter((s) => s.type === 'Especie').reduce((sum, s) => sum + (s.amount || 0), 0);
    const expiring = sponsors
      .map((s) => ({ sponsor: s, days: daysUntil(s.endDate) }))
      .filter((x) => x.days !== null && x.days >= 0 && x.days <= 30)
      .sort((a, b) => a.days - b.days);
    return {
      cash, kind, expiring,
      byLevel: LEVELS.map((label) => ({ label, count: sponsors.filter((s) => s.level === label).length })),
      byType: TYPES.map((label) => ({ label, count: sponsors.filter((s) => s.type === label).length })),
    };
  }, [sponsors]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline">
          {t('sponsors_open_sheet')}
        </a>
        {canCreate && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('sponsors_new_btn')}
          </Button>
        )}
      </div>

      {canCreate && showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-hairline bg-surface-raised p-4 flex flex-wrap gap-2 items-end">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('sponsors_name_ph')} className="flex-1 min-w-[160px] text-xs" />
          <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            placeholder={t('sponsors_owner_ph')} className="min-w-[140px] text-xs" />
          <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary">
            {LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </select>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-primary">
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            className="px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-xs text-content-secondary">
            <option value="">{t('scope_global')}</option>
            {scopeCategories.map((c) => <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>)}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
          <Button type="submit" size="sm">{t('sponsors_new_btn')}</Button>
        </form>
      )}

      {sponsors.length === 0 ? (
        <p className="text-xs text-slate-500 italic">{t('sponsors_no_sponsors')}</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('sponsors_kpi_total')}</div>
              <div className="text-xl font-bold text-content-primary mt-1">{sponsors.length}</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('sponsors_kpi_cash')}</div>
              <div className="text-xl font-bold text-teal-400 mt-1">{fmtMoney(stats.cash)}</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('sponsors_kpi_kind')}</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{fmtMoney(stats.kind)}</div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-3">
              <div className="text-[10px] uppercase tracking-wider text-content-tertiary font-semibold">{t('sponsors_kpi_expiring')}</div>
              <div className="text-xl font-bold text-red-400 mt-1">{stats.expiring.length}</div>
              <div className="text-[10px] text-content-tertiary">{t('sponsors_kpi_expiring_sub')}</div>
            </div>
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('sponsors_by_level')}</div>
              <DistributionBar items={stats.byLevel} colors={{ Oro: '#C9A227', Plata: '#8B95A3', Bronce: '#B57F50' }} />
            </div>
            <div className="rounded-xl border border-hairline bg-surface-raised p-4">
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">{t('sponsors_by_type')}</div>
              <DistributionBar items={stats.byType} colors={{ Dinero: '#1E8E5A', Especie: '#C9A227', Mixto: '#2C5AA0' }} />
            </div>
          </div>

          {/* Expiring alerts */}
          {stats.expiring.length > 0 && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4">
              <div className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2">{t('sponsors_expiring_title')}</div>
              <div className="space-y-1.5">
                {stats.expiring.map(({ sponsor, days }) => (
                  <div key={sponsor.id} className="flex items-center justify-between text-xs">
                    <span className="text-content-primary font-medium">{sponsor.name}</span>
                    <span className="bg-red-950/40 text-red-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">{days} {t('sponsors_days_left')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-hairline bg-surface-raised overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-900/60 text-content-tertiary uppercase text-[10px] tracking-wider">
                  <th className="px-3 py-2 text-left">{t('sponsors_col_name')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_owner')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_level')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_type')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_amount')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_end')}</th>
                  <th className="px-3 py-2 text-left">{t('sponsors_col_status')}</th>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {sponsors.map((s) => {
                  const canEditThis = resolveCanEdit(s);
                  return (
                    <tr key={s.id} className="hover:bg-slate-700/10 group">
                      <td className="px-1 py-1">
                        <input type="text" defaultValue={s.name} disabled={!canEditThis}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) patchSponsor(s, { name: v }); }}
                          className="w-full bg-transparent px-2 py-1.5 text-content-primary font-medium focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" defaultValue={s.owner} disabled={!canEditThis}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v !== s.owner) patchSponsor(s, { owner: v }); }}
                          className="w-full bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={s.level} disabled={!canEditThis} onChange={(e) => patchSponsor(s, { level: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 font-semibold focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${LEVEL_SELECT[s.level] || ''}`}>
                          {LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select value={s.type} disabled={!canEditThis} onChange={(e) => patchSponsor(s, { type: e.target.value })}
                          className="w-full bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70">
                          {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" defaultValue={s.amount || 0} disabled={!canEditThis}
                          onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== (s.amount || 0)) patchSponsor(s, { amount: v }); }}
                          className="w-24 bg-transparent px-2 py-1.5 text-content-secondary focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70" />
                      </td>
                      <td className="px-1 py-1">
                        <PickerField type="date" value={s.endDate} onChange={(v) => canEditThis && patchSponsor(s, { endDate: v })}
                          className="w-28 bg-transparent px-2 py-1.5 text-content-secondary text-xs focus:outline-none" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={s.status} disabled={!canEditThis} onChange={(e) => patchSponsor(s, { status: e.target.value })}
                          className={`w-full bg-transparent px-2 py-1.5 font-semibold focus:outline-none focus:bg-surface-sunken rounded disabled:opacity-70 ${STATUS_SELECT[s.status] || ''}`}>
                          {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button type="button" onClick={() => setDetailId(s.id)} className="text-content-tertiary hover:text-primary p-1" title={t('sponsors_col_detail')}>
                          <Search className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </td>
                      <td className="px-1 py-1 text-center">
                        {canEditThis && (
                          <button type="button"
                            onClick={async () => { if (await confirmDialog({ message: t('delete_matrix_confirm'), confirmLabel: t('delete'), danger: true })) onDeleteSponsor(s.id); }}
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
          <div className="bg-surface-raised rounded-2xl w-full max-w-2xl shadow-surface-xl border border-hairline p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-content-primary">{detail.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEVEL_BADGE[detail.level] || ''}`}>{detail.level}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[detail.status] || ''}`}>{detail.status}</span>
                </div>
              </div>
              <button onClick={() => setDetailId(null)} className="text-content-tertiary hover:text-content-primary p-1.5 rounded-full hover:bg-surface-sunken">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="bg-surface-sunken rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-content-tertiary font-semibold">{t('sponsors_start_date')}</div>
                <PickerField type="date" value={detail.startDate} onChange={(v) => patchSponsor(detail, { startDate: v })}
                  className="bg-transparent text-xs text-content-primary font-semibold mt-0.5" />
              </div>
              <div className="bg-surface-sunken rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-content-tertiary font-semibold">{t('sponsors_end_date')}</div>
                <PickerField type="date" value={detail.endDate} onChange={(v) => patchSponsor(detail, { endDate: v })}
                  className="bg-transparent text-xs text-content-primary font-semibold mt-0.5" />
              </div>
              <div className="bg-surface-sunken rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-content-tertiary font-semibold">{t('sponsors_duration')}</div>
                <div className="text-xs text-content-primary font-semibold mt-1">
                  {durationMonths(detail.startDate, detail.endDate) ?? '—'} {durationMonths(detail.startDate, detail.endDate) != null ? t('sponsors_duration_months') : ''}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-content-tertiary">{t('sponsors_benefit_received')}</label>
              <textarea defaultValue={detail.benefitReceived} onBlur={(e) => patchSponsor(detail, { benefitReceived: e.target.value })}
                rows={2} className="w-full text-xs bg-surface-sunken border border-slate-600 rounded-lg p-2 text-content-primary focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-content-tertiary">{t('sponsors_benefit_given')}</label>
              <textarea defaultValue={detail.benefitGiven} onBlur={(e) => patchSponsor(detail, { benefitGiven: e.target.value })}
                rows={2} className="w-full text-xs bg-surface-sunken border border-slate-600 rounded-lg p-2 text-content-primary focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-content-tertiary">{t('sponsors_notes')}</label>
              <textarea defaultValue={detail.notes} onBlur={(e) => patchSponsor(detail, { notes: e.target.value })}
                rows={2} className="w-full text-xs bg-surface-sunken border border-slate-600 rounded-lg p-2 text-content-primary focus:outline-none focus:border-primary" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-content-tertiary">{t('sponsors_contacts')}</label>
                <button type="button"
                  onClick={() => patchSponsor(detail, { contacts: [...(detail.contacts || []), { id: `c-${Date.now()}`, name: '', role: '', phone: '' }] })}
                  className="text-[11px] text-teal-400 hover:underline">
                  + {t('sponsors_add_contact')}
                </button>
              </div>
              {(detail.contacts || []).length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('sponsors_no_contacts')}</p>
              ) : (
                <div className="space-y-1.5">
                  {(detail.contacts || []).map((c) => (
                    <div key={c.id} className="flex gap-1.5 items-center">
                      <input type="text" defaultValue={c.name} placeholder={t('sponsors_contact_name_ph')}
                        onBlur={(e) => patchSponsor(detail, { contacts: detail.contacts.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x) })}
                        className="flex-1 min-w-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <input type="text" defaultValue={c.role} placeholder={t('sponsors_contact_role_ph')}
                        onBlur={(e) => patchSponsor(detail, { contacts: detail.contacts.map((x) => x.id === c.id ? { ...x, role: e.target.value } : x) })}
                        className="flex-1 min-w-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <input type="text" defaultValue={c.phone} placeholder={t('sponsors_contact_phone_ph')}
                        onBlur={(e) => patchSponsor(detail, { contacts: detail.contacts.map((x) => x.id === c.id ? { ...x, phone: e.target.value } : x) })}
                        className="w-36 shrink-0 text-xs bg-surface-sunken border border-slate-600 rounded px-2 py-1.5 text-content-primary focus:outline-none focus:border-primary" />
                      <button type="button" onClick={() => patchSponsor(detail, { contacts: detail.contacts.filter((x) => x.id !== c.id) })}
                        className="text-content-tertiary hover:text-red-400 p-1 shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
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
