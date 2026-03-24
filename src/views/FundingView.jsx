// ─── FundingView ─────────────────────────────────────────────────────────────
// Transparent funding ledger for the team.
// Multiple accounts; grand total = sum of all account balances.
// Each movement specifies which account it belongs to.
// All team members can view; leaders+ can add/edit entries and accounts.

import React, { useState } from 'react';
import { X, Plus, Wallet } from 'lucide-react';
import { t } from '../strings.js';
import PickerField from '../components/ui/PickerField.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

function formatMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function formatDate(s) {
  if (!s) return '—';
  try {
    return new Date(s + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

function accountLabel(acc) {
  const parts = [];
  if (acc?.bankName) parts.push(acc.bankName);
  if (acc?.accountName) parts.push(acc.accountName);
  if (acc?.accountLast4) parts.push(`****${acc.accountLast4}`);
  return parts.length ? parts.join(' · ') : (acc?.id?.slice(0, 8) || '—');
}

const pickerCls = 'w-full px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-sm text-content-primary placeholder:text-content-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150';
const selectCls = 'w-full px-2 py-1.5 bg-surface-sunken border border-slate-600 rounded-lg text-sm text-content-secondary focus:border-primary focus:outline-none';

export default function FundingView({
  accounts = [],
  entries = [],
  canEdit,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateEntry,
  onDeleteEntry,
}) {
  const [addingAccount, setAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [accountDraft, setAccountDraft] = useState({});
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryDraft, setEntryDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    type: 'in',
    category: '',
    accountId: '',
  });

  const grandTotal = accounts.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0);
  const sortedEntries = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const withBalances = sortedEntries.map((e, i) => {
    const acc = accounts.find((a) => a.id === e.accountId);
    const amt = Number(e.amount) || 0;
    let balanceAfter = acc?.currentBalance ?? 0;
    for (let j = 0; j < i; j++) {
      const d = sortedEntries[j];
      if (d.accountId !== e.accountId) continue;
      const dAmt = Number(d.amount) || 0;
      balanceAfter -= d.type === 'out' ? -dAmt : dAmt;
    }
    return { ...e, _balanceAfter: balanceAfter };
  });

  const startAddAccount = () => {
    setAccountDraft({ bankName: '', accountName: '', accountLast4: '', currentBalance: '' });
    setAddingAccount(true);
    setEditingAccountId(null);
  };

  const startEditAccount = (acc) => {
    setAccountDraft({
      bankName: acc?.bankName || '',
      accountName: acc?.accountName || '',
      accountLast4: acc?.accountLast4 || '',
      currentBalance: acc?.currentBalance ?? '',
    });
    setEditingAccountId(acc?.id);
    setAddingAccount(false);
  };

  const handleSaveAccount = async () => {
    const payload = {
      bankName: String(accountDraft.bankName || '').trim(),
      accountName: String(accountDraft.accountName || '').trim(),
      accountLast4: String(accountDraft.accountLast4 || '').replace(/\D/g, '').slice(-4),
      currentBalance: parseFloat(accountDraft.currentBalance) || 0,
    };
    if (editingAccountId) {
      await onUpdateAccount?.(editingAccountId, payload);
      setEditingAccountId(null);
    } else {
      await onCreateAccount?.(payload);
      setAddingAccount(false);
    }
    setAccountDraft({});
  };

  const startAddEntry = () => {
    setEntryDraft({
      date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '',
      type: 'in',
      category: '',
      accountId: accounts[0]?.id || '',
    });
    setAddingEntry(true);
  };

  const handleCreateEntry = async () => {
    const amt = parseFloat(entryDraft.amount);
    if (isNaN(amt) || amt <= 0) return;
    if (!entryDraft.accountId) return;
    await onCreateEntry?.({
      date: entryDraft.date,
      description: String(entryDraft.description || '').trim(),
      amount: amt,
      type: entryDraft.type,
      category: String(entryDraft.category || '').trim(),
      accountId: entryDraft.accountId,
    });
    setAddingEntry(false);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('nav_funding')}</h2>
          <p className="text-sm text-content-secondary mt-0.5">Registro financiero del equipo</p>
        </div>
        {canEdit && !addingEntry && (
          <div className="shrink-0">
            <Button size="sm" onClick={startAddEntry} disabled={accounts.length === 0}>
              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('funding_add_entry')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Grand total tile */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-surface-sm sm:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">{t('funding_grand_total')}</div>
          <div className="text-2xl font-bold text-primary">{formatMoney(grandTotal)}</div>
        </div>
        {/* Account tiles */}
        {accounts.slice(0, 2).map((acc) => (
          <div key={acc.id} className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1 truncate">{accountLabel(acc)}</div>
            <div className="text-2xl font-bold text-content-primary">{formatMoney(acc.currentBalance)}</div>
          </div>
        ))}
      </div>

      {/* ── Accounts panel ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('funding_accounts_title')}</span>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={startAddAccount}>
              <Plus className="w-3 h-3 mr-1" strokeWidth={2.5} />{t('funding_add_account')}
            </Button>
          )}
        </div>

        {/* Account form */}
        {(addingAccount || editingAccountId) && (
          <div className="border-b border-slate-700/40 bg-surface-sunken/30 px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('funding_bank')}</label>
                <Input value={accountDraft.bankName} onChange={(e) => setAccountDraft((d) => ({ ...d, bankName: e.target.value }))} placeholder="Banco, cooperativa…" />
              </div>
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('funding_account_name')}</label>
                <Input value={accountDraft.accountName} onChange={(e) => setAccountDraft((d) => ({ ...d, accountName: e.target.value }))} placeholder="Nombre de la cuenta" />
              </div>
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('funding_last4')}</label>
                <Input value={accountDraft.accountLast4}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, accountLast4: e.target.value.replace(/\D/g, '').slice(-4) }))}
                  placeholder="Últimos 4 dígitos" maxLength={4} />
              </div>
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('funding_balance')}</label>
                <Input type="number" step="0.01" value={accountDraft.currentBalance}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, currentBalance: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setAddingAccount(false); setEditingAccountId(null); setAccountDraft({}); }}>{t('cancel')}</Button>
              <Button type="button" size="sm" onClick={handleSaveAccount}>{t('save')}</Button>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Wallet className="w-7 h-7 text-content-tertiary mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-content-tertiary italic">{t('funding_no_accounts')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors">
                <div>
                  <span className="text-sm text-content-primary">{accountLabel(acc)}</span>
                  <span className="ml-2 font-mono text-primary font-semibold">{formatMoney(acc.currentBalance)}</span>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => startEditAccount(acc)} className="text-xs text-amber-400 hover:underline">{t('edit')}</button>
                    <button onClick={() => onDeleteAccount?.(acc.id)} className="text-xs text-red-400 hover:underline">{t('delete')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add entry form panel ── */}
      {addingEntry && (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <span className="text-sm font-semibold text-content-primary">{t('funding_add_entry')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_account')}</label>
              <select value={entryDraft.accountId} onChange={(e) => setEntryDraft((d) => ({ ...d, accountId: e.target.value }))} className={selectCls} required>
                <option value="">{t('select_placeholder')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_date')}</label>
              <PickerField type="date" value={entryDraft.date}
                onChange={(value) => setEntryDraft((d) => ({ ...d, date: value }))}
                placeholder="Seleccionar fecha" className={pickerCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_description')}</label>
              <Input value={entryDraft.description} onChange={(e) => setEntryDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Descripción" />
            </div>
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_amount')}</label>
              <Input type="number" step="0.01" min="0" value={entryDraft.amount}
                onChange={(e) => setEntryDraft((d) => ({ ...d, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_type')}</label>
              <select value={entryDraft.type} onChange={(e) => setEntryDraft((d) => ({ ...d, type: e.target.value }))} className={selectCls}>
                <option value="in">{t('funding_type_in')}</option>
                <option value="out">{t('funding_type_out')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-content-tertiary block mb-1">{t('funding_category')}</label>
              <Input value={entryDraft.category} onChange={(e) => setEntryDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Categoría (opcional)" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddingEntry(false)}>{t('cancel')}</Button>
            <Button type="button" size="sm" onClick={handleCreateEntry}
              disabled={!entryDraft.accountId || !entryDraft.amount}>{t('save')}</Button>
          </div>
        </div>
      )}

      {/* ── Ledger table ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">Movimientos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken/50 border-b border-slate-700/40">
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_date')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_account')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_description')}</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_in')}</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_out')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_category')}</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-content-tertiary">{t('funding_balance')}</th>
                {canEdit && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {withBalances.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-3 py-10 text-center text-content-tertiary italic">{t('funding_no_entries')}</td>
                </tr>
              ) : (
                withBalances.map((e) => {
                  const acc = accounts.find((a) => a.id === e.accountId);
                  return (
                    <tr key={e.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-2.5 text-content-secondary whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-3 py-2.5 text-content-tertiary text-[11px]">{accountLabel(acc)}</td>
                      <td className="px-3 py-2.5 text-content-primary">{e.description || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400">{e.type === 'in' ? formatMoney(e.amount) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-red-400">{e.type === 'out' ? formatMoney(e.amount) : '—'}</td>
                      <td className="px-3 py-2.5 text-content-tertiary">{e.category || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-content-primary">{formatMoney(e._balanceAfter)}</td>
                      {canEdit && (
                        <td className="px-3 py-2.5">
                          <button onClick={() => onDeleteEntry?.(e.id)} className="text-red-400 hover:text-red-300 p-0.5 transition-colors" title={t('delete')}>
                            <X className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
