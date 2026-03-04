// ─── FundingView ─────────────────────────────────────────────────────────────
// Transparent funding ledger for the team.
// Multiple accounts; grand total = sum of all account balances.
// Each movement specifies which account it belongs to.
// All team members can view; leaders+ can add/edit entries and accounts.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';

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
  const { t } = React.useContext(LangContext);
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

  // Balance after each entry (per account, newest first)
  const withBalances = sortedEntries.map((e, i) => {
    const acc = accounts.find((a) => a.id === e.accountId);
    const amt = Number(e.amount) || 0;
    const delta = e.type === 'out' ? -amt : amt;
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('nav_funding')}</h2>
        {canEdit && !addingEntry && (
          <button onClick={startAddEntry} disabled={accounts.length === 0}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-3 py-1.5 rounded">
            + {t('funding_add_entry')}
          </button>
        )}
      </div>

      {/* Grand total */}
      <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-4">
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('funding_grand_total')}</p>
        <p className="text-2xl font-bold text-emerald-400">{formatMoney(grandTotal)}</p>
      </div>

      {/* Accounts section */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            {t('funding_accounts_title')}
          </h3>
          {canEdit && (
            <button onClick={startAddAccount} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded">
              + {t('funding_add_account')}
            </button>
          )}
        </div>

        {addingAccount || editingAccountId ? (
          <div className="space-y-3 mb-4 p-3 bg-slate-900/60 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_bank')}</label>
                <input value={accountDraft.bankName} onChange={(e) => setAccountDraft((d) => ({ ...d, bankName: e.target.value }))}
                  placeholder="Banco, cooperativa…"
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_account_name')}</label>
                <input value={accountDraft.accountName} onChange={(e) => setAccountDraft((d) => ({ ...d, accountName: e.target.value }))}
                  placeholder="Nombre de la cuenta"
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_last4')}</label>
                <input value={accountDraft.accountLast4} onChange={(e) => setAccountDraft((d) => ({ ...d, accountLast4: e.target.value.replace(/\D/g, '').slice(-4) }))}
                  placeholder="Últimos 4 dígitos"
                  maxLength={4}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_balance')}</label>
                <input type="number" step="0.01" value={accountDraft.currentBalance} onChange={(e) => setAccountDraft((d) => ({ ...d, currentBalance: e.target.value }))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAddingAccount(false); setEditingAccountId(null); setAccountDraft({}); }} className="text-xs text-slate-400 underline">{t('cancel')}</button>
              <button onClick={handleSaveAccount} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
            </div>
          </div>
        ) : null}

        {accounts.length === 0 ? (
          <p className="text-xs text-slate-500 italic">{t('funding_no_accounts')}</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <div>
                  <span className="text-sm text-slate-200">{accountLabel(acc)}</span>
                  <span className="ml-2 font-mono text-emerald-400 font-semibold">{formatMoney(acc.currentBalance)}</span>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => startEditAccount(acc)} className="text-xs text-amber-400 underline">{t('edit')}</button>
                    <button onClick={() => onDeleteAccount?.(acc.id)} className="text-xs text-red-400 underline">{t('delete')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add entry form */}
      {addingEntry && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('funding_add_entry')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_account')}</label>
              <select value={entryDraft.accountId} onChange={(e) => setEntryDraft((d) => ({ ...d, accountId: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" required>
                <option value="">{t('select_placeholder')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_date')}</label>
              <input type="date" value={entryDraft.date} onChange={(e) => setEntryDraft((d) => ({ ...d, date: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_description')}</label>
              <input value={entryDraft.description} onChange={(e) => setEntryDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Descripción"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_amount')}</label>
              <input type="number" step="0.01" min="0" value={entryDraft.amount} onChange={(e) => setEntryDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder="0"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_type')}</label>
              <select value={entryDraft.type} onChange={(e) => setEntryDraft((d) => ({ ...d, type: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm">
                <option value="in">{t('funding_type_in')}</option>
                <option value="out">{t('funding_type_out')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('funding_category')}</label>
              <input value={entryDraft.category} onChange={(e) => setEntryDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="Categoría (opcional)"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setAddingEntry(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
            <button onClick={handleCreateEntry} disabled={!entryDraft.accountId || !entryDraft.amount}
              className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed">{t('save')}</button>
          </div>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_date')}</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_account')}</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_description')}</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_in')}</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_out')}</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_category')}</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_balance')}</th>
              {canEdit && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {withBalances.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-3 py-8 text-center text-slate-500 italic">{t('funding_no_entries')}</td>
              </tr>
            ) : (
              withBalances.map((e) => {
                const acc = accounts.find((a) => a.id === e.accountId);
                return (
                  <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{accountLabel(acc)}</td>
                    <td className="px-3 py-2 text-slate-200">{e.description || '—'}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{e.type === 'in' ? formatMoney(e.amount) : '—'}</td>
                    <td className="px-3 py-2 text-right text-red-400">{e.type === 'out' ? formatMoney(e.amount) : '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{e.category || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-200">{formatMoney(e._balanceAfter)}</td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <button onClick={() => onDeleteEntry?.(e.id)} className="text-red-400 hover:text-red-300 text-xs" title={t('delete')}>✕</button>
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
  );
}
