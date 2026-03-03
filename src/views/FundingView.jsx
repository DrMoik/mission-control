// ─── FundingView ─────────────────────────────────────────────────────────────
// Transparent funding ledger for the team.
// Shows: 1) Account info (where money is held), 2) Spreadsheet of entries.
// All team members can view; leaders+ can add/edit entries and account info.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';
import { tsToDate } from '../utils.js';

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

export default function FundingView({
  team,
  account,
  entries,
  canEdit,
  onSaveAccount,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
}) {
  const { t } = React.useContext(LangContext);
  const [editingAccount, setEditingAccount] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [accountDraft, setAccountDraft] = useState({});
  const [entryDraft, setEntryDraft] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', type: 'in', category: '' });

  const sortedEntries = [...(entries || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Compute balance after each entry (newest first: row 0 balance = currentBalance)
  const withBalances = sortedEntries.map((e, i) => {
    const amt = Number(e.amount) || 0;
    const delta = e.type === 'out' ? -amt : amt;
    let balanceAfter = account?.currentBalance ?? 0;
    for (let j = 0; j < i; j++) {
      const d = sortedEntries[j];
      const dAmt = Number(d.amount) || 0;
      balanceAfter -= d.type === 'out' ? -dAmt : dAmt;
    }
    return { ...e, _balanceAfter: balanceAfter };
  });

  const startEditAccount = () => {
    setAccountDraft({
      bankName: account?.bankName || '',
      accountName: account?.accountName || '',
      accountLast4: account?.accountLast4 || '',
      currentBalance: account?.currentBalance ?? '',
    });
    setEditingAccount(true);
  };

  const handleSaveAccount = async () => {
    const payload = {
      bankName: String(accountDraft.bankName || '').trim(),
      accountName: String(accountDraft.accountName || '').trim(),
      accountLast4: String(accountDraft.accountLast4 || '').replace(/\D/g, '').slice(-4),
      currentBalance: parseFloat(accountDraft.currentBalance) || 0,
    };
    await onSaveAccount?.(payload);
    setEditingAccount(false);
  };

  const startAddEntry = () => {
    setEntryDraft({
      date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '',
      type: 'in',
      category: '',
    });
    setAddingEntry(true);
  };

  const handleCreateEntry = async () => {
    const amt = parseFloat(entryDraft.amount);
    if (isNaN(amt) || amt <= 0) return;
    await onCreateEntry?.({
      date: entryDraft.date,
      description: String(entryDraft.description || '').trim(),
      amount: amt,
      type: entryDraft.type,
      category: String(entryDraft.category || '').trim(),
    });
    setAddingEntry(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('nav_funding')}</h2>
        {canEdit && !addingEntry && (
          <button onClick={startAddEntry} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded">
            + {t('funding_add_entry')}
          </button>
        )}
      </div>

      {/* Account info card */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span>🏦</span> {t('funding_account_title')}
        </h3>
        {editingAccount ? (
          <div className="space-y-3">
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
              <button onClick={() => setEditingAccount(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
              <button onClick={handleSaveAccount} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {(account?.bankName || account?.accountName || account?.accountLast4) ? (
              <div className="flex flex-wrap gap-4 text-sm">
                {account.bankName && <span><span className="text-slate-500">{t('funding_bank')}:</span> {account.bankName}</span>}
                {account.accountName && <span><span className="text-slate-500">{t('funding_account_name')}:</span> {account.accountName}</span>}
                {account.accountLast4 && <span><span className="text-slate-500">{t('funding_last4')}:</span> ****{account.accountLast4}</span>}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">{t('funding_no_account')}</p>
            )}
            <p className="text-lg font-bold text-emerald-400">
              {t('funding_balance')}: {formatMoney(account?.currentBalance)}
            </p>
            {canEdit && (
              <button onClick={startEditAccount} className="text-xs text-amber-400 underline">{t('edit')}</button>
            )}
          </div>
        )}
      </div>

      {/* Add entry form */}
      {addingEntry && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('funding_add_entry')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <button onClick={handleCreateEntry} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
          </div>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('funding_date')}</th>
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
                <td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-slate-500 italic">{t('funding_no_entries')}</td>
              </tr>
            ) : (
              withBalances.map((e) => (
                <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatDate(e.date)}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
