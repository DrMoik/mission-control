import React, { useMemo, useState } from 'react';
import { t } from '../strings.js';
import PickerField from '../components/ui/PickerField.jsx';
import { Button } from '../components/ui/index.js';

const ITEM_TYPES = [
  { id: 'tool', label: 'Herramienta' },
  { id: 'consumable', label: 'Consumible' },
  { id: 'equipment', label: 'Equipo' },
];

const EMPTY_DRAFT = {
  name: '',
  type: 'tool',
  quantity: '',
  unit: '',
  minQuantity: '',
  categoryId: '',
  notes: '',
};

function normalizeDraft(draft) {
  return {
    name: String(draft.name || '').trim(),
    type: ['tool', 'consumable', 'equipment'].includes(draft.type) ? draft.type : 'equipment',
    quantity: Number(draft.quantity) || 0,
    unit: String(draft.unit || '').trim(),
    minQuantity: Math.max(0, Number(draft.minQuantity) || 0),
    categoryId: draft.categoryId || null,
    notes: String(draft.notes || '').trim(),
  };
}

function areaLabel(item, categories) {
  if (!item?.categoryId) return t('inventory_area_global') || 'General';
  return categories.find((c) => c.id === item.categoryId)?.name || (t('unassigned') || 'Sin asignar');
}

export default function InventoryView({
  items = [],
  loans = [],
  categories = [],
  memberships = [],
  canManageInventory = false,
  currentMembership = null,
  canEditItem,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onCreateLoan,
  onReturnLoan,
}) {
  const [draft, setDraft] = useState({
    ...EMPTY_DRAFT,
    categoryId: currentMembership?.categoryId || '',
  });
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(EMPTY_DRAFT);
  const [typeFilter, setTypeFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [loanModalItem, setLoanModalItem] = useState(null);
  const [loanDraft, setLoanDraft] = useState({ membershipId: '', quantity: '1', dueDate: '', notes: '' });
  const activeLoans = useMemo(
    () => loans.filter((loan) => !loan.returnedAt),
    [loans],
  );
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const editableCategories = useMemo(() => {
    const leaderCategoryId = currentMembership?.role === 'leader' ? currentMembership?.categoryId : null;
    if (leaderCategoryId) return categories.filter((c) => c.id === leaderCategoryId);
    return categories;
  }, [categories, currentMembership]);

  const areaOptions = useMemo(() => {
    const options = [
      { id: 'all', label: t('inventory_filter_all_areas') || 'Todas las areas' },
      { id: '__global__', label: t('inventory_area_global') || 'General' },
      ...categories.map((cat) => ({ id: cat.id, label: cat.name })),
    ];
    return options;
  }, [categories]);

  const visibleItems = useMemo(() => {
    return [...items]
      .filter((item) => typeFilter === 'all' || item.type === typeFilter)
      .filter((item) => {
        if (areaFilter === 'all') return true;
        if (areaFilter === '__global__') return !item.categoryId;
        return item.categoryId === areaFilter;
      })
      .sort((a, b) => {
        const areaCmp = areaLabel(a, categories).localeCompare(areaLabel(b, categories));
        if (areaCmp !== 0) return areaCmp;
        const typeCmp = String(a.type || '').localeCompare(String(b.type || ''));
        if (typeCmp !== 0) return typeCmp;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  }, [items, typeFilter, areaFilter, categories]);

  const borrowerOptions = useMemo(
    () => memberships.filter((m) => m.status === 'active').sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''))),
    [memberships],
  );

  const submitCreate = async () => {
    const payload = normalizeDraft(draft);
    if (!payload.name) return;
    await onCreateItem?.(payload);
    setDraft({
      ...EMPTY_DRAFT,
      type: payload.type,
      unit: payload.unit,
      categoryId: currentMembership?.categoryId || '',
    });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingDraft({
      name: item.name || '',
      type: item.type || 'tool',
      quantity: item.quantity ?? '',
      unit: item.unit || '',
      minQuantity: item.minQuantity ?? '',
      categoryId: item.categoryId || '',
      notes: item.notes || '',
    });
  };

  const submitEdit = async () => {
    const payload = normalizeDraft(editingDraft);
    if (!payload.name || !editingId) return;
    await onUpdateItem?.(editingId, payload);
    setEditingId(null);
    setEditingDraft(EMPTY_DRAFT);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(EMPTY_DRAFT);
  };

  const typeOptions = [{ id: 'all', label: t('inventory_filter_all') || 'Todo' }, ...ITEM_TYPES];

  const getActiveLoansForItem = (itemId) => activeLoans.filter((loan) => loan.itemId === itemId);
  const openLoanModal = (item) => {
    setLoanModalItem(item);
    setLoanDraft({ membershipId: '', quantity: '1', dueDate: '', notes: '' });
  };
  const closeLoanModal = () => {
    setLoanModalItem(null);
    setLoanDraft({ membershipId: '', quantity: '1', dueDate: '', notes: '' });
  };

  const loanModalActiveLoans = loanModalItem ? getActiveLoansForItem(loanModalItem.id) : [];
  const loanModalLoanedQty = loanModalActiveLoans.reduce((sum, loan) => sum + (Number(loan.quantity) || 0), 0);
  const loanModalAvailableQty = loanModalItem
    ? Math.max(0, Number(loanModalItem.quantity || 0) - loanModalLoanedQty)
    : 0;

  const submitLoan = async () => {
    if (!loanModalItem || !loanDraft.membershipId) return;
    await onCreateLoan?.({
      itemId: loanModalItem.id,
      membershipId: loanDraft.membershipId,
      quantity: loanDraft.quantity,
      dueDate: loanDraft.dueDate,
      notes: loanDraft.notes,
    });
    closeLoanModal();
  };

  const dueState = (loan) => {
    if (!loan?.dueDate || loan.returnedAt) return 'normal';
    const due = new Date(`${loan.dueDate}T00:00:00`);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - now) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 2) return 'soon';
    return 'normal';
  };

  const overdueLoans = activeLoans.filter((loan) => dueState(loan) === 'overdue');
  const dueSoonLoans = activeLoans.filter((loan) => dueState(loan) === 'soon');

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gradient tracking-tight">{t('inventory_title') || 'Inventario'}</h2>
          <p className="text-sm text-content-secondary mt-1">
            {t('inventory_help') || 'Administra herramientas, consumibles y otros recursos por area.'}
          </p>
          <p className="mt-1 text-xs text-content-tertiary">
            {t('inventory_sheet_help') || 'Se muestra una sola hoja. Usa los filtros para cambiar el area o tipo visible.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTypeFilter(opt.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-150 ${
                typeFilter === opt.id
                  ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm'
                  : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-slate-700/40 bg-surface-raised p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-emerald-400">{t('inventory_spreadsheet') || 'Hoja de inventario'}</h3>
            <p className="text-xs text-content-tertiary">
              {t('inventory_counters_help') || 'Cantidad = cuantas unidades tienes. Unidad = como se mide, por ejemplo piezas, cajas o litros.'}
            </p>
          </div>
          <div className="min-w-[220px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
              {t('inventory_filter_area') || 'Filtrar por area'}
            </label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-primary/60"
            >
              {areaOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        {(overdueLoans.length > 0 || dueSoonLoans.length > 0) && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="font-semibold text-amber-300">{t('inventory_due_alerts') || 'Alertas de prestamos'}</p>
            {overdueLoans.length > 0 && (
              <p className="mt-1 text-amber-200">
                {(t('inventory_overdue_count') || 'Prestamos vencidos')}: {overdueLoans.length}
              </p>
            )}
            {dueSoonLoans.length > 0 && (
              <p className="mt-1 text-amber-200">
                {(t('inventory_due_soon_count') || 'Prestamos por vencer')}: {dueSoonLoans.length}
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-700/40">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-sunken/60 text-content-tertiary">
              <tr>
                <th className="px-3 py-2 text-left">{t('inventory_area_label') || 'Area'}</th>
                <th className="px-3 py-2 text-left">{t('inventory_name') || 'Nombre'}</th>
                <th className="min-w-[140px] px-3 py-2 text-left">{t('inventory_type') || 'Tipo'}</th>
                <th className="px-3 py-2 text-right">{t('inventory_quantity_label') || 'Cantidad'}</th>
                <th className="px-3 py-2 text-right">{t('inventory_available') || 'Disponible'}</th>
                <th className="px-3 py-2 text-left">{t('inventory_unit') || 'Unidad de medida'}</th>
                <th className="px-3 py-2 text-right">{t('inventory_min_quantity') || 'Minimo'}</th>
                <th className="px-3 py-2 text-left">{t('inventory_notes') || 'Notas'}</th>
                {canManageInventory && <th className="min-w-[220px] px-3 py-2 text-left">{t('inventory_actions') || 'Acciones'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 bg-surface-raised/50">
              {canManageInventory && (
                <tr className="bg-emerald-950/10">
                  <td className="px-2 py-2">
                    <select
                      value={draft.categoryId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    >
                      {currentMembership?.role !== 'leader' && (
                        <option value="">{t('inventory_area_global') || 'General'}</option>
                      )}
                      {editableCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={t('inventory_name') || 'Nombre'}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[140px]">
                    <select
                      value={draft.type}
                      onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full min-w-[130px] rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    >
                      {ITEM_TYPES.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.quantity}
                      onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-right text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-content-tertiary">—</td>
                  <td className="px-2 py-2">
                    <input
                      value={draft.unit}
                      onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}
                      placeholder={t('inventory_unit') || 'Unidad de medida'}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.minQuantity}
                      onChange={(e) => setDraft((prev) => ({ ...prev, minQuantity: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-right text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={draft.notes}
                      onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder={t('inventory_notes') || 'Notas'}
                      className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={submitCreate}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-gradient-to-br from-primary-hover to-primary text-content-inverse hover:from-teal-400 hover:to-primary-hover hover:shadow-glow-sm active:scale-[0.96] transition-all duration-150"
                    >
                      {t('add') || 'Agregar'}
                    </button>
                  </td>
                </tr>
              )}

              {visibleItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageInventory ? 9 : 8}
                    className="px-4 py-8 text-center text-sm text-content-tertiary italic"
                  >
                    {t('inventory_empty') || 'No hay items en este inventario todavia.'}
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => {
                  const editable = canEditItem?.(item);
                  const isEditing = editingId === item.id;
                  const row = isEditing ? editingDraft : item;
                  const lowStock = Number(item.minQuantity || 0) > 0 && Number(item.quantity || 0) <= Number(item.minQuantity || 0);
                  const activeItemLoans = getActiveLoansForItem(item.id);
                  const activeLoanedQty = activeItemLoans.reduce((sum, loan) => sum + (Number(loan.quantity) || 0), 0);
                  const availableQty = item.type === 'consumable'
                    ? Number(item.quantity || 0)
                    : Math.max(0, Number(item.quantity || 0) - activeLoanedQty);
                  const canLoan = canManageInventory && item.type !== 'consumable' && availableQty > 0;

                  return (
                    <tr key={item.id} className={lowStock ? 'bg-amber-500/5' : ''}>
                      <td className="px-2 py-2 text-xs text-content-primary">
                        {isEditing ? (
                          <select
                            value={row.categoryId || ''}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, categoryId: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          >
                            {currentMembership?.role !== 'leader' && (
                              <option value="">{t('inventory_area_global') || 'General'}</option>
                            )}
                            {editableCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                        ) : areaLabel(item, categories)}
                      </td>
                      <td className="px-2 py-2 text-slate-100">
                        {isEditing ? (
                          <input
                            value={row.name}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          />
                        ) : item.name}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-300 min-w-[140px]">
                        {isEditing ? (
                          <select
                            value={row.type}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, type: e.target.value }))}
                            className="w-full min-w-[130px] rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          >
                            {ITEM_TYPES.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        ) : (
                          ITEM_TYPES.find((opt) => opt.id === item.type)?.label || item.type
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-100">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.quantity}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-right text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          />
                        ) : Number(item.quantity || 0)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-100">
                        {availableQty}
                      </td>
                      <td className="px-2 py-2 text-xs text-content-primary">
                        {isEditing ? (
                          <input
                            value={row.unit}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, unit: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          />
                        ) : (item.unit || '—')}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-content-primary">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.minQuantity}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, minQuantity: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-right text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          />
                        ) : (item.minQuantity || 0)}
                      </td>
                      <td className="px-2 py-2 text-xs text-content-tertiary">
                        {isEditing ? (
                          <input
                            value={row.notes}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, notes: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-primary/60"
                          />
                        ) : (
                          <span className={lowStock ? 'text-amber-300' : ''}>
                            {item.notes || (lowStock ? (t('inventory_low_stock') || 'Stock bajo') : '—')}
                          </span>
                        )}
                      </td>
                      {canManageInventory && (
                        <td className="px-2 py-2 text-xs">
                          {editable ? (
                            isEditing ? (
                              <div className="flex gap-2">
                                <button onClick={submitEdit} className="text-emerald-400 underline">
                                  {t('save') || 'Guardar'}
                                </button>
                                <button onClick={cancelEdit} className="text-content-tertiary hover:text-content-primary transition-colors underline">
                                  {t('cancel') || 'Cancelar'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => openLoanModal(item)}
                                  disabled={!canLoan}
                                  className="text-sky-400 underline disabled:no-underline disabled:opacity-40"
                                >
                                  {t('inventory_register_loan') || 'Prestamo'}
                                </button>
                                {activeItemLoans.length > 0 && (
                                  <button
                                    onClick={() => onReturnLoan?.(activeItemLoans[0]?.id)}
                                    className="text-emerald-400 underline"
                                  >
                                    {t('inventory_return') || 'Registrar devolucion'}
                                  </button>
                                )}
                                <button onClick={() => startEdit(item)} className="text-amber-400 underline">
                                  {t('edit') || 'Editar'}
                                </button>
                                <button onClick={() => onDeleteItem?.(item.id)} className="text-red-400 underline">
                                  {t('delete') || 'Eliminar'}
                                </button>
                              </div>
                            )
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {loanModalItem && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-100">
                    {t('inventory_register_loan') || 'Prestamo'}: {loanModalItem.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {t('inventory_available') || 'Disponible'}: {loanModalAvailableQty} {loanModalItem.unit || ''}
                  </p>
                </div>
                <button onClick={closeLoanModal} className="text-sm text-content-tertiary hover:text-content-primary transition-colors">
                  {t('close') || 'Cerrar'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                    {t('inventory_select_borrower') || 'Seleccionar prestatario'}
                  </label>
                  <select
                    value={loanDraft.membershipId}
                    onChange={(e) => setLoanDraft((prev) => ({ ...prev, membershipId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-primary/60"
                  >
                    <option value="">{t('inventory_select_borrower') || 'Seleccionar prestatario'}</option>
                    {borrowerOptions.map((member) => (
                      <option key={member.id} value={member.id}>{member.displayName || 'Member'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                    {t('inventory_quantity_label') || 'Cantidad'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, loanModalAvailableQty)}
                    value={loanDraft.quantity}
                    onChange={(e) => setLoanDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                    {t('inventory_due_date') || 'Vence'}
                  </label>
                  <PickerField
                    type="date"
                    value={loanDraft.dueDate}
                    onChange={(value) => setLoanDraft((prev) => ({ ...prev, dueDate: value }))}
                    placeholder={t('inventory_open_calendar') || 'Seleccionar fecha'}
                    className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-primary/60"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                    {t('inventory_loan_notes') || 'Notas del prestamo'}
                  </label>
                  <textarea
                    value={loanDraft.notes}
                    onChange={(e) => setLoanDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-600/60 bg-surface-sunken px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-primary/60"
                  />
                </div>
              </div>

              {loanModalActiveLoans.length > 0 && (
                <div className="mt-4 space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                    {t('inventory_active_loans') || 'Prestamos activos'}
                  </p>
                  {loanModalActiveLoans.map((loan) => (
                    <div key={loan.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                      <span>
                        {loan.borrowerName || 'Member'} · {loan.quantity || 1}
                        {loan.dueDate ? ` · ${t('inventory_due_date') || 'Vence'} ${loan.dueDate}` : ''}
                      </span>
                      <button onClick={() => onReturnLoan?.(loan.id)} className="text-emerald-400 underline">
                        {t('inventory_return') || 'Registrar devolucion'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={submitLoan}
                  disabled={!loanDraft.membershipId || loanModalAvailableQty <= 0}
                  className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('inventory_register_loan') || 'Prestamo'}
                </button>
                <button onClick={closeLoanModal} className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded">
                  {t('cancel') || 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeLoans.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-100">
                {t('inventory_active_loans') || 'Prestamos activos'}
              </h4>
              <span className="text-xs text-content-tertiary">{activeLoans.length}</span>
            </div>
            <div className="space-y-2">
              {activeLoans.map((loan) => {
                const state = dueState(loan);
                const item = items.find((entry) => entry.id === loan.itemId);
                return (
                  <div key={loan.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-200">
                        {loan.itemName || item?.name || 'Item'} · {loan.borrowerName || 'Member'} · {loan.quantity || 1}
                      </p>
                      <p className="text-slate-400">
                        {loan.dueDate ? `${t('inventory_due_date') || 'Vence'} ${loan.dueDate}` : (t('inventory_no_due_date') || 'Sin fecha limite')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {state === 'overdue' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300">{t('inventory_overdue') || 'Vencido'}</span>}
                      {state === 'soon' && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{t('inventory_due_soon') || 'Por vencer'}</span>}
                      {canManageInventory && (
                        <button onClick={() => onReturnLoan?.(loan.id)} className="text-emerald-400 underline">
                          {t('inventory_return') || 'Registrar devolucion'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
