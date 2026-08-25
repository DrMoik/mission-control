// ─── BoardView ────────────────────────────────────────────────────────────────
// Renders a single Kanban/Scrum/Retro board with columns and draggable-style
// cards.  Edit permission is resolved per-board by the parent (BoardTypeSection).
// Shows "last edited by" stamp at the bottom.

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { ensureString, tsToDate } from '../../utils.js';
import PickerField from '../../components/ui/PickerField.jsx';
import { confirmDialog } from '../../services/feedback.js';

/**
 * @param {{
 *   board:         object,
 *   canEditThis:   boolean,   // pre-resolved by parent via resolveCanEdit(board)
 *   onUpdateBoard: function(id: string, updates: object): Promise<void>,
 *   onDeleteBoard: function(id: string): Promise<void>,
 *   onCreateTask?: function,
 *   canAssignTask?: function(assigneeMembershipId: string): boolean,
 *   memberships?:  object[],
 *   categories?:   object[],
 *   onAssignCard?: function(columnId, cardId, cardTitle, assigneeMembershipIds, assigneeDisplayNames, cardDescription, cardDueDate): Promise<void>,
 *   currentMembership?: object | null,
 *   memberRole?:     string | null,
 * }} props
 */
export default function BoardView({
  board, canEditThis, onUpdateBoard, onDeleteBoard,
  canAssignTask, memberships = [], categories = [],
  onAssignCard, currentMembership = null,
  memberRole = null,
}) {
  const [newCardTitles, setNewCardTitles] = useState({});
  const [assigningCardId, setAssigningCardId] = useState(null);
  const [editingDetailsCardId, setEditingDetailsCardId] = useState(null);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsDescription, setDetailsDescription] = useState('');
  const [detailsDueDate, setDetailsDueDate] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState(new Set());
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignAreaFilter, setAssignAreaFilter] = useState('');
  const [assignIsOpen, setAssignIsOpen] = useState(false);
  const [openGrantsPoints, setOpenGrantsPoints] = useState(false);
  const [openPoints, setOpenPoints] = useState('');

  const assignableMembers = (memberships || []).filter(
    (m) => m.status === 'active' && m.id !== currentMembership?.id && canAssignTask?.(m.id),
  );

  const searchQuery = (assignSearchQuery || '').trim().toLowerCase();
  const filteredAssignable = assignableMembers.filter((m) => {
    const name = (ensureString(m.displayName, lang) || '').toLowerCase();
    const matchesSearch = !searchQuery || name.includes(searchQuery);
    const matchesArea = !assignAreaFilter || m.categoryId === assignAreaFilter;
    return matchesSearch && matchesArea;
  });
  const showResults = searchQuery.length >= 1;

  // ── Card mutations ─────────────────────────────────────────────────────────

  const addCard = (colId) => {
    const title = (newCardTitles[colId] || '').trim();
    if (!title) return;
    const newColumns = board.columns.map((col) =>
      col.id === colId ? { ...col, cards: [...col.cards, { id: `${Date.now()}`, title }] } : col,
    );
    onUpdateBoard(board.id, { columns: newColumns });
    setNewCardTitles((prev) => ({ ...prev, [colId]: '' }));
  };

  const moveCard = (cardId, fromColId, toColId) => {
    const card = board.columns.find((c) => c.id === fromColId)?.cards.find((c) => c.id === cardId);
    if (!card) return;
    const newColumns = board.columns.map((col) => {
      if (col.id === fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
      if (col.id === toColId)   return { ...col, cards: [...col.cards, card] };
      return col;
    });
    onUpdateBoard(board.id, { columns: newColumns });
  };

  const deleteCard = async (colId, cardId) => {
    if (!(await confirmDialog({ message: t('delete_card_confirm'), confirmLabel: t('delete'), danger: true }))) return;
    const newColumns = board.columns.map((col) =>
      col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col,
    );
    onUpdateBoard(board.id, { columns: newColumns });
  };

  const saveCardDetails = (colId, cardId) => {
    const title = detailsTitle.trim();
    if (!title) return;
    const newColumns = board.columns.map((col) =>
      col.id === colId
        ? {
            ...col,
            cards: col.cards.map((c) =>
              c.id === cardId
                ? { ...c, title, description: detailsDescription.trim() || null, dueDate: detailsDueDate || null }
                : c,
            ),
          }
        : col,
    );
    onUpdateBoard(board.id, { columns: newColumns });
    setEditingDetailsCardId(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{ensureString(board.name, lang)}</h3>
        {canEditThis && (
          <button
            onClick={async () => { if (await confirmDialog({ message: t('delete_board_confirm'), confirmLabel: t('delete'), danger: true })) onDeleteBoard(board.id); }}
            className="text-[11px] text-red-400 underline">
            {t('delete_board_btn')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {board.columns.map((col) => (
          <div key={col.id} className="bg-slate-800 rounded-lg p-3 space-y-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{ensureString(col.name, lang)}</span>
              <span className="text-[10px] text-slate-600">{col.cards.length}</span>
            </div>

            <div className="space-y-1.5">
              {col.cards.map((card) => {
                const cardTitle = ensureString(card.title, lang);
                const isAssigning = assigningCardId === card.id;
                const isEditingDetails = editingDetailsCardId === card.id;
                const cardDueDate = card.dueDate ? tsToDate(card.dueDate) : null;
                const assigneeNames = card.assigneeNames?.join(', ') || card.assignedByNames || '';
                return (
                  <div key={card.id} className="bg-slate-700 rounded p-2.5 text-xs group">
                    {!isEditingDetails && (
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-slate-100 font-medium">{cardTitle}</span>
                        {canEditThis && (
                          <button onClick={() => deleteCard(col.id, card.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 shrink-0 transition-opacity p-0.5" title={t('delete')}><X className="w-4 h-4" strokeWidth={2} /></button>
                        )}
                      </div>
                    )}
                    {!isEditingDetails && card.description && (
                      <p className="text-[11px] text-slate-300 mt-1 whitespace-pre-wrap">{ensureString(card.description, lang)}</p>
                    )}
                    {(assigneeNames || card.assignedByName || cardDueDate) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {assigneeNames && <>{t('task_assigned_to')}: {assigneeNames}</>}
                        {card.assignedByName && <>{assigneeNames ? ' · ' : ''}{t('task_assigned_by')}: {card.assignedByName}</>}
                        {cardDueDate && <>{(assigneeNames || card.assignedByName) ? ' · ' : ''}{t('task_due')}: {cardDueDate.toLocaleDateString()}</>}
                      </p>
                    )}
                    {canEditThis && (
                      <div className="mt-1">
                        {!isEditingDetails ? (
                          <button type="button"
                            onClick={() => { setEditingDetailsCardId(card.id); setDetailsTitle(card.title || ''); setDetailsDescription(card.description || ''); setDetailsDueDate(card.dueDate || ''); }}
                            className="text-[10px] text-slate-400 hover:text-teal-400 hover:underline">
                            {t('edit')}
                          </button>
                        ) : (
                          <div className="space-y-1.5 mt-1">
                            <input
                              type="text"
                              value={detailsTitle}
                              onChange={(e) => setDetailsTitle(e.target.value)}
                              placeholder={t('task_title_ph')}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[11px] text-slate-200 placeholder-slate-500 font-medium"
                              autoFocus
                            />
                            <textarea
                              value={detailsDescription}
                              onChange={(e) => setDetailsDescription(e.target.value)}
                              placeholder={t('task_description_ph')}
                              rows={2}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[11px] text-slate-200 placeholder-slate-500"
                            />
                            <PickerField
                              type="date"
                              value={detailsDueDate}
                              onChange={setDetailsDueDate}
                              placeholder={t('task_due')}
                              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[11px] text-slate-200"
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={() => saveCardDetails(col.id, card.id)}
                                className="text-[10px] bg-teal-500 hover:bg-teal-400 text-black px-2 py-1 rounded">{t('save')}</button>
                              <button type="button" onClick={() => setEditingDetailsCardId(null)}
                                className="text-[10px] text-slate-500 hover:underline">{t('cancel')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {canEditThis && onAssignCard && !card.assigneeMembershipIds?.length && !card.assigneeMembershipId && !card.openTask && (
                      <div className="mt-1.5 relative">
                        {!isAssigning ? (
                          <div className="flex items-center gap-2">
                            {assignableMembers.length > 0 && (
                              <button type="button" onClick={() => { setAssigningCardId(card.id); setAssignIsOpen(false); setSelectedAssigneeIds(new Set()); setAssignSearchQuery(''); setAssignAreaFilter(''); }}
                                className="text-[10px] text-teal-400 hover:underline">
                                {t('task_assign')}
                              </button>
                            )}
                            <button type="button" onClick={() => { setAssigningCardId(card.id); setAssignIsOpen(true); setOpenGrantsPoints(false); setOpenPoints(''); }}
                              className="text-[10px] text-blue-400 hover:underline">
                              {t('task_open_toggle')}
                            </button>
                          </div>
                        ) : assignIsOpen ? (
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                              <input type="checkbox" checked={openGrantsPoints} onChange={(e) => setOpenGrantsPoints(e.target.checked)} className="rounded" />
                              {t('task_open_grants_points')}
                            </label>
                            {openGrantsPoints && (
                              <input
                                type="number"
                                min="1"
                                value={openPoints}
                                onChange={(e) => setOpenPoints(e.target.value)}
                                placeholder={t('task_open_points_ph')}
                                className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                              />
                            )}
                            <div className="flex gap-1">
                              <button type="button"
                                onClick={async () => {
                                  await onAssignCard(col.id, card.id, cardTitle, [], [], card.description, card.dueDate, {
                                    open: true,
                                    grantsPoints: openGrantsPoints,
                                    points: openGrantsPoints ? openPoints : null,
                                  });
                                  setAssigningCardId(null);
                                  setAssignIsOpen(false);
                                }}
                                className="text-[10px] bg-blue-500 hover:bg-blue-400 text-black px-2 py-1 rounded">
                                {t('task_open_create')}
                              </button>
                              <button type="button" onClick={() => { setAssigningCardId(null); setAssignIsOpen(false); }}
                                className="text-[10px] text-slate-500 hover:underline">{t('cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={assignSearchQuery}
                              onChange={(e) => setAssignSearchQuery(e.target.value)}
                              placeholder={t('task_assign_search')}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
                              autoFocus
                            />
                            <p className="text-[10px] text-slate-500">{t('task_assign_hint')}</p>
                            {(() => {
                              const areasInList = [...new Set(assignableMembers.map((m) => m.categoryId).filter(Boolean))];
                              const showAreaFilter = areasInList.length > 1 && categories?.length > 0;
                              const isLeader = memberRole === 'leader' && currentMembership?.categoryId;
                              const leaderAreaName = isLeader && categories?.length
                                ? ensureString(categories.find((c) => c.id === currentMembership?.categoryId)?.name, lang)
                                : null;
                              return (
                                <>
                                  {isLeader && leaderAreaName && (
                                    <p className="text-[10px] text-slate-500">{t('task_assign_your_area')}: {leaderAreaName}</p>
                                  )}
                                  {showAreaFilter ? (
                                    <select
                                      value={assignAreaFilter}
                                      onChange={(e) => setAssignAreaFilter(e.target.value)}
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[10px] text-slate-300"
                                    >
                                      <option value="">{t('task_filter_area')}</option>
                                      {categories.filter((c) => areasInList.includes(c.id)).map((c) => (
                                        <option key={c.id} value={c.id}>{ensureString(c.name, lang)}</option>
                                      ))}
                                    </select>
                                  ) : null}
                                </>
                              );
                            })()}
                            {selectedAssigneeIds.size > 0 && (
                              <p className="text-[10px] text-teal-400">{t('task_assign_selected')}: {selectedAssigneeIds.size}</p>
                            )}
                            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                              {!showResults ? (
                                <p className="text-[10px] text-slate-500 italic py-1">{t('task_assign_type_to_search')}</p>
                              ) : filteredAssignable.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-1">{t('task_assign_no_match')}</p>
                              ) : (
                                filteredAssignable.map((m) => {
                                  const selected = selectedAssigneeIds.has(m.id);
                                  const cat = categories?.find((c) => c.id === m.categoryId);
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAssigneeIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(m.id)) next.delete(m.id);
                                          else next.add(m.id);
                                          return next;
                                        });
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors flex items-center gap-2 ${
                                        selected
                                          ? 'bg-teal-600/40 text-teal-200 border border-teal-500/50'
                                          : 'text-slate-300 hover:bg-slate-600/50 border border-transparent'
                                      }`}
                                    >
                                      <span className="font-medium min-w-0 truncate">{ensureString(m.displayName, lang)}</span>
                                      {cat && <span className="text-slate-500 text-[9px] shrink-0">({ensureString(cat.name, lang)})</span>}
                                      {selected && <Check className="w-4 h-4 text-teal-400 shrink-0 ml-auto" strokeWidth={2.5} />}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button type="button"
                                onClick={async () => {
                                  if (selectedAssigneeIds.size === 0) return;
                                  const ids = Array.from(selectedAssigneeIds);
                                  const names = ids.map((id) => {
                                    const m = assignableMembers.find((x) => x.id === id);
                                    return m ? ensureString(m.displayName, lang) : '';
                                  }).filter(Boolean);
                                  await onAssignCard(col.id, card.id, cardTitle, ids, names, card.description, card.dueDate);
                                  setAssigningCardId(null);
                                  setSelectedAssigneeIds(new Set());
                                  setAssignSearchQuery('');
                                  setAssignAreaFilter('');
                                }}
                                disabled={selectedAssigneeIds.size === 0}
                                className="text-[10px] bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-2 py-1 rounded">
                                {t('task_assign')}
                              </button>
                              <button type="button" onClick={() => { setAssigningCardId(null); setSelectedAssigneeIds(new Set()); setAssignSearchQuery(''); setAssignAreaFilter(''); }}
                                className="text-[10px] text-slate-500 hover:underline">{t('cancel')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {canEditThis && board.columns.length > 1 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {board.columns.filter((c) => c.id !== col.id).map((target) => (
                          <button key={target.id} onClick={() => moveCard(card.id, col.id, target.id)}
                            className="text-[10px] text-slate-400 hover:text-teal-400 border border-slate-600 rounded px-1 transition-colors">
                            {t('move_to')} {ensureString(target.name, lang)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {canEditThis && (
              <div className="flex gap-1">
                <input value={newCardTitles[col.id] || ''}
                  onChange={(e) => setNewCardTitles((prev) => ({ ...prev, [col.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCard(col.id); }}
                  placeholder={t('add_card_ph')}
                  className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                <button onClick={() => addCard(col.id)}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded">+</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Last edited stamp */}
      {board.lastEditedBy && (
        <p className="text-[10px] text-slate-600 text-right">
          {`Última edición por ${board.lastEditedBy} el ${board.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
        </p>
      )}
    </div>
  );
}
