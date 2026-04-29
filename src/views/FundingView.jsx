// ─── FundingView ─────────────────────────────────────────────────────────────
// Transparent funding ledger + sales tracking for the team.
// Two tabs: Fondos (accounts/ledger) and Ventas (t-shirt sales).
// All team members can view; leaders+ can add/edit entries and confirm sales.

import React, { useState } from 'react';
import { X, Plus, Wallet, ShoppingBag, Package, CheckCircle2, Clock, Trophy, Pencil } from 'lucide-react';
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

// ── Fondos tab ────────────────────────────────────────────────────────────────
function FondosTab({
  accounts,
  entries,
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
    <div className="space-y-5">
      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-surface-sm sm:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">{t('funding_grand_total')}</div>
          <div className="text-2xl font-bold text-primary">{formatMoney(grandTotal)}</div>
        </div>
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
      {canEdit && !addingEntry && (
        <div className="flex justify-end">
          <Button size="sm" onClick={startAddEntry} disabled={accounts.length === 0}>
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('funding_add_entry')}
          </Button>
        </div>
      )}
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

// ── Ventas tab ────────────────────────────────────────────────────────────────
function EmptySaleLineItem() {
  return { itemId: '', itemName: '', quantity: 1, unitPrice: 0 };
}

function VentasTab({
  saleItems,
  sales,
  memberships,
  canEdit,
  canRegisterSale,
  onCreateSaleItem,
  onUpdateSaleItem,
  onDeleteSaleItem,
  onRegisterSale,
  onConfirmSale,
  onDeleteSale,
}) {
  // Catalog state
  const [addingItem, setAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState({ name: '', description: '', price: '', stock: '', active: true });

  // Register sale form
  const [registeringOpen, setRegisteringOpen] = useState(false);
  const [saleDraft, setSaleDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    buyerName: '',
    notes: '',
    sellerMembershipId: '',
    lines: [EmptySaleLineItem()],
  });

  const activeMembers = (memberships || [])
    .filter((m) => m.status === 'active')
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));

  const activeItems = saleItems.filter((i) => i.active !== false);

  // ── Catalog CRUD ──
  const startAddItem = () => {
    setItemDraft({ name: '', description: '', price: '', stock: '', active: true });
    setAddingItem(true);
    setEditingItemId(null);
  };

  const startEditItem = (item) => {
    setItemDraft({
      name: item.name || '',
      description: item.description || '',
      price: item.price ?? '',
      stock: item.stock ?? '',
      active: item.active !== false,
    });
    setEditingItemId(item.id);
    setAddingItem(false);
  };

  const handleSaveItem = async () => {
    if (!itemDraft.name.trim()) return;
    const payload = {
      name: itemDraft.name,
      description: itemDraft.description,
      price: itemDraft.price,
      stock: itemDraft.stock,
      active: itemDraft.active,
    };
    if (editingItemId) {
      await onUpdateSaleItem?.(editingItemId, payload);
      setEditingItemId(null);
    } else {
      await onCreateSaleItem?.(payload);
      setAddingItem(false);
    }
    setItemDraft({ name: '', description: '', price: '', stock: '', active: true });
  };

  const cancelItemForm = () => {
    setAddingItem(false);
    setEditingItemId(null);
    setItemDraft({ name: '', description: '', price: '', stock: '', active: true });
  };

  // ── Sale line helpers ──
  const updateLine = (idx, field, value) => {
    setSaleDraft((d) => {
      const lines = [...d.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      if (field === 'itemId') {
        const found = saleItems.find((i) => i.id === value);
        lines[idx].itemName = found?.name || '';
        lines[idx].unitPrice = found?.price ?? 0;
      }
      return { ...d, lines };
    });
  };

  const addLine = () => setSaleDraft((d) => ({ ...d, lines: [...d.lines, EmptySaleLineItem()] }));

  const removeLine = (idx) => setSaleDraft((d) => ({
    ...d,
    lines: d.lines.filter((_, i) => i !== idx),
  }));

  const saleTotal = saleDraft.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  const handleRegisterSale = async () => {
    const validLines = saleDraft.lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (!validLines.length) return;
    await onRegisterSale?.({
      date: saleDraft.date,
      buyerName: saleDraft.buyerName,
      notes: saleDraft.notes,
      items: validLines,
      sellerMembershipId: saleDraft.sellerMembershipId || null,
    });
    setRegisteringOpen(false);
    setSaleDraft({ date: new Date().toISOString().slice(0, 10), buyerName: '', notes: '', sellerMembershipId: '', lines: [EmptySaleLineItem()] });
  };

  // ── Summary stats ──
  const confirmedSales = sales.filter((s) => s.status === 'confirmed');
  const pendingSales = sales.filter((s) => s.status !== 'confirmed');
  const totalConfirmed = confirmedSales.reduce((s, sale) => s + (Number(sale.totalAmount) || 0), 0);
  const totalPending = pendingSales.reduce((s, sale) => s + (Number(sale.totalAmount) || 0), 0);

  // ── Leaderboard ──
  const leaderMap = {};
  for (const sale of confirmedSales) {
    const key = sale.sellerMembershipId || sale.sellerName;
    if (!leaderMap[key]) leaderMap[key] = { name: sale.sellerName, count: 0, amount: 0 };
    leaderMap[key].count += 1;
    leaderMap[key].amount += Number(sale.totalAmount) || 0;
  }
  const leaders = Object.values(leaderMap).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-5">
      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">{t('sales_total_confirmed')}</div>
          <div className="text-2xl font-bold text-emerald-400">{formatMoney(totalConfirmed)}</div>
          <div className="text-xs text-content-tertiary mt-0.5">{confirmedSales.length} {t('sales_confirmed_sales')}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">{t('sales_total_pending')}</div>
          <div className="text-2xl font-bold text-amber-400">{formatMoney(totalPending)}</div>
          <div className="text-xs text-content-tertiary mt-0.5">{pendingSales.length} {t('sales_pending_count')}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">{t('sales_leaderboard')}</div>
          {leaders.length === 0 ? (
            <p className="text-xs text-content-tertiary italic mt-1">—</p>
          ) : (
            <div className="text-sm text-content-primary font-semibold truncate">{leaders[0]?.name}</div>
          )}
          {leaders[0] && (
            <div className="text-xs text-content-tertiary mt-0.5">{formatMoney(leaders[0].amount)} {t('sales_confirmed_amount')}</div>
          )}
        </div>
      </div>

      {/* ── Leaderboard panel ── */}
      {leaders.length > 0 && (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('sales_leaderboard')}</span>
          </div>
          <div className="divide-y divide-slate-700/40">
            {leaders.map((leader, idx) => (
              <div key={leader.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold w-5 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-content-tertiary'}`}>
                    {idx + 1}
                  </span>
                  <span className="text-sm text-content-primary">{leader.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-400">{formatMoney(leader.amount)}</div>
                  <div className="text-[11px] text-content-tertiary">{leader.count} {t('sales_confirmed_sales')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Product catalog ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-content-tertiary" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('sales_catalog')}</span>
          </div>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={startAddItem}>
              <Plus className="w-3 h-3 mr-1" strokeWidth={2.5} />{t('sales_add_item')}
            </Button>
          )}
        </div>

        {/* Catalog form */}
        {(addingItem || editingItemId) && (
          <div className="border-b border-slate-700/40 bg-surface-sunken/30 px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-content-tertiary block mb-1">{t('sales_item_name')}</label>
                <Input value={itemDraft.name} onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ej. Playera M" />
              </div>
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('sales_item_price')}</label>
                <Input type="number" step="0.01" min="0" value={itemDraft.price}
                  onChange={(e) => setItemDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-content-tertiary block mb-1">{t('sales_item_stock')}</label>
                <Input type="number" min="0" step="1" value={itemDraft.stock}
                  onChange={(e) => setItemDraft((d) => ({ ...d, stock: e.target.value }))} placeholder="0" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-content-tertiary block mb-1">{t('sales_item_description')}</label>
                <Input value={itemDraft.description} onChange={(e) => setItemDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Descripción" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="itemActive" checked={itemDraft.active}
                  onChange={(e) => setItemDraft((d) => ({ ...d, active: e.target.checked }))}
                  className="w-4 h-4 accent-primary" />
                <label htmlFor="itemActive" className="text-xs text-content-secondary">{t('sales_item_active')}</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={cancelItemForm}>{t('cancel')}</Button>
              <Button type="button" size="sm" onClick={handleSaveItem} disabled={!itemDraft.name.trim()}>{t('save')}</Button>
            </div>
          </div>
        )}

        {saleItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Package className="w-7 h-7 text-content-tertiary mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-content-tertiary italic">{t('sales_no_items')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {saleItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-content-primary truncate">{item.name}</span>
                      {!item.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-content-tertiary">inactivo</span>
                      )}
                    </div>
                    {item.description && (
                      <span className="text-[11px] text-content-tertiary">{item.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary">{formatMoney(item.price)}</div>
                    <div className={`text-[11px] ${(item.stock ?? 0) === 0 ? 'text-red-400' : (item.stock ?? 0) <= 3 ? 'text-amber-400' : 'text-content-tertiary'}`}>
                      {(item.stock ?? 0) === 0 ? t('sales_out_of_stock') : (item.stock ?? 0) <= 3 ? `${t('sales_low_stock')}: ${item.stock}` : `Stock: ${item.stock}`}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button onClick={() => startEditItem(item)} className="text-amber-400 hover:text-amber-300 p-0.5 transition-colors" title={t('edit')}>
                        <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button onClick={() => onDeleteSaleItem?.(item.id)} className="text-red-400 hover:text-red-300 p-0.5 transition-colors" title={t('delete')}>
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Register sale button / form ── */}
      {canRegisterSale && !registeringOpen && (
        <div className="flex justify-end">
          <Button onClick={() => setRegisteringOpen(true)} disabled={activeItems.length === 0}>
            <ShoppingBag className="w-4 h-4 mr-1.5" strokeWidth={2} />{t('sales_register')}
          </Button>
        </div>
      )}

      {registeringOpen && (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <span className="text-sm font-semibold text-content-primary">{t('sales_register_title')}</span>
            <button onClick={() => setRegisteringOpen(false)} className="text-content-tertiary hover:text-content-secondary">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('sales_date')}</label>
              <PickerField type="date" value={saleDraft.date}
                onChange={(value) => setSaleDraft((d) => ({ ...d, date: value }))}
                placeholder="Seleccionar fecha" className={pickerCls} />
            </div>
            <div>
              <label className="text-xs text-content-tertiary block mb-1">{t('sales_buyer_name')}</label>
              <Input value={saleDraft.buyerName} onChange={(e) => setSaleDraft((d) => ({ ...d, buyerName: e.target.value }))} placeholder="Comprador" />
            </div>
            {canEdit && (
              <div className="sm:col-span-2">
                <label className="text-xs text-content-tertiary block mb-1">{t('sales_seller')} <span className="text-amber-400">(registrar en nombre de…)</span></label>
                <select value={saleDraft.sellerMembershipId}
                  onChange={(e) => setSaleDraft((d) => ({ ...d, sellerMembershipId: e.target.value }))}
                  className={selectCls}>
                  <option value="">— Mi cuenta (yo realicé la venta) —</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName || m.id}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <label className="text-xs text-content-tertiary block">{t('sales_items_sold')}</label>
            {saleDraft.lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="flex-1">
                  <select
                    value={line.itemId}
                    onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">{t('sales_select_items')}</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} — {formatMoney(item.price)}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20 shrink-0">
                  <Input
                    type="number" min="1" step="1" value={line.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    placeholder="Cant."
                  />
                </div>
                <div className="w-24 shrink-0 text-right text-sm font-semibold text-primary whitespace-nowrap">
                  {formatMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
                </div>
                {saleDraft.lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300 p-0.5 shrink-0">
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
              <Plus className="w-3 h-3" strokeWidth={2.5} />{t('sales_add_line')}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-slate-700/40">
            <span className="text-sm text-content-secondary">{t('sales_total')}</span>
            <span className="text-lg font-bold text-primary">{formatMoney(saleTotal)}</span>
          </div>

          <div>
            <label className="text-xs text-content-tertiary block mb-1">{t('sales_notes')}</label>
            <Input value={saleDraft.notes} onChange={(e) => setSaleDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notas opcionales" />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => setRegisteringOpen(false)}>{t('cancel')}</Button>
            <Button type="button" size="sm" onClick={handleRegisterSale}
              disabled={!saleDraft.lines.some((l) => l.itemId && Number(l.quantity) > 0)}>
              {t('sales_register')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Sales ledger ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-content-tertiary" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('sales_ledger')}</span>
        </div>
        {sales.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ShoppingBag className="w-7 h-7 text-content-tertiary mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-content-tertiary italic">{t('sales_no_sales')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {sales.map((sale) => {
              const isConfirmed = sale.status === 'confirmed';
              return (
                <div key={sale.id} className="px-4 py-3 hover:bg-slate-700/10 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isConfirmed
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                          : <Clock className="w-4 h-4 text-amber-400" strokeWidth={2} />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-sm text-content-primary font-medium">{sale.sellerName}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isConfirmed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                            {isConfirmed ? t('sales_status_confirmed') : t('sales_status_pending')}
                          </span>
                          <span className="text-xs text-content-tertiary">{formatDate(sale.date)}</span>
                        </div>
                        {sale.buyerName && (
                          <div className="text-xs text-content-tertiary">{t('sales_buyer')}: {sale.buyerName}</div>
                        )}
                        <div className="text-xs text-content-tertiary mt-0.5">
                          {(sale.items || []).map((li, i) => (
                            <span key={i}>{i > 0 ? ', ' : ''}{li.itemName} ×{li.quantity}</span>
                          ))}
                        </div>
                        {isConfirmed && sale.confirmedByName && (
                          <div className="text-xs text-content-tertiary mt-0.5">
                            {t('sales_confirmed_by')}: {sale.confirmedByName}
                          </div>
                        )}
                        {sale.notes && (
                          <div className="text-xs text-content-tertiary mt-0.5 italic">{sale.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-primary">{formatMoney(sale.totalAmount)}</span>
                      {!isConfirmed && canEdit && (
                        <Button size="sm" onClick={() => onConfirmSale?.(sale.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('sales_confirm_payment')}
                        </Button>
                      )}
                      {canEdit && (
                        <button onClick={() => onDeleteSale?.(sale.id)} className="text-red-400 hover:text-red-300 p-0.5 transition-colors" title={t('sales_delete_sale')}>
                          <X className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main FundingView (tabbed) ─────────────────────────────────────────────────
export default function FundingView({
  accounts = [],
  entries = [],
  canEdit,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateEntry,
  onDeleteEntry,
  saleItems = [],
  sales = [],
  memberships = [],
  currentMembership,
  canRegisterSale,
  onCreateSaleItem,
  onUpdateSaleItem,
  onDeleteSaleItem,
  onRegisterSale,
  onConfirmSale,
  onDeleteSale,
}) {
  const [activeTab, setActiveTab] = useState('fondos');

  const tabs = [
    { id: 'fondos', label: t('funding_tab'), Icon: Wallet },
    { id: 'ventas', label: t('sales_tab'), Icon: ShoppingBag },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Page header ── */}
      <div>
        <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('nav_funding')}</h2>
        <p className="text-sm text-content-secondary mt-0.5">Registro financiero del equipo</p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-slate-700/40">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-slate-500'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'fondos' && (
        <FondosTab
          accounts={accounts}
          entries={entries}
          canEdit={canEdit}
          onCreateAccount={onCreateAccount}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onCreateEntry={onCreateEntry}
          onDeleteEntry={onDeleteEntry}
        />
      )}
      {activeTab === 'ventas' && (
        <VentasTab
          saleItems={saleItems}
          sales={sales}
          memberships={memberships}
          canEdit={canEdit}
          canRegisterSale={canRegisterSale}
          onCreateSaleItem={onCreateSaleItem}
          onUpdateSaleItem={onUpdateSaleItem}
          onDeleteSaleItem={onDeleteSaleItem}
          onRegisterSale={onRegisterSale}
          onConfirmSale={onConfirmSale}
          onDeleteSale={onDeleteSale}
        />
      )}
    </div>
  );
}
