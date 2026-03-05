// ─── BoardView ────────────────────────────────────────────────────────────────
// Renders a single Kanban/Scrum/Retro board with columns and draggable-style
// cards.  Edit permission is resolved per-board by the parent (BoardTypeSection).
// Shows "last edited by" stamp at the bottom.

import React, { useState } from 'react';
import LangContext from '../../i18n/LangContext.js';
import { ensureString } from '../../utils.js';

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
 *   onAssignCard?: function(columnId, cardId, cardTitle, assigneeMembershipId, assigneeDisplayName): Promise<void>,
 *   currentMembership?: object | null,
 *   memberRole?:     string | null,
 * }} props
 */
export default function BoardView({
  board, canEditThis, onUpdateBoard, onDeleteBoard,
  onCreateTask, canAssignTask, memberships = [], categories = [],
  onAssignCard, currentMembership = null,
  memberRole = null,
}) {
  const { t, lang } = React.useContext(LangContext);
  const [newCardTitles, setNewCardTitles] = useState({});
  const [assigningCardId, setAssigningCardId] = useState(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState(new Set());
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignAreaFilter, setAssignAreaFilter] = useState('');

  const assignableMembers = (memberships || []).filter(
    (m) => m.status === 'active' && m.id !== currentMembership?.id && canAssignTask?.(m.id),
  );

  const filteredAssignable = assignableMembers.filter((m) => {
    const name = (ensureString(m.displayName, lang) || '').toLowerCase();
    const query = (assignSearchQuery || '').trim().toLowerCase();
    const matchesSearch = !query || name.includes(query);
    const matchesArea = !assignAreaFilter || m.categoryId === assignAreaFilter;
    return matchesSearch && matchesArea;
  });

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

  const deleteCard = (colId, cardId) => {
    const newColumns = board.columns.map((col) =>
      col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col,
    );
    onUpdateBoard(board.id, { columns: newColumns });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{ensureString(board.name, lang)}</h3>
        {canEditThis && (
          <button onClick={() => onDeleteBoard(board.id)} className="text-[11px] text-red-400 underline">
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
                return (
                  <div key={card.id} className="bg-slate-700 rounded p-2.5 text-xs group">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-slate-100 font-medium">{cardTitle}</span>
                      {canEditThis && (
                        <button onClick={() => deleteCard(col.id, card.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 shrink-0 transition-opacity">✕</button>
                      )}
                    </div>
                    {(card.assignedByNames || card.assignedByName) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{t('task_assigned_to')}: {card.assignedByNames || card.assignedByName}</p>
                    )}
                    {canEditThis && onAssignCard && assignableMembers.length > 0 && !card.assigneeMembershipIds?.length && !card.assigneeMembershipId && (
                      <div className="mt-1.5 relative">
                        {!isAssigning ? (
                          <button type="button" onClick={() => { setAssigningCardId(card.id); setSelectedAssigneeIds(new Set()); setAssignSearchQuery(''); setAssignAreaFilter(''); }}
                            className="text-[10px] text-emerald-400 hover:underline">
                            {t('task_assign')}
                          </button>
                        ) : (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={assignSearchQuery}
                              onChange={(e) => setAssignSearchQuery(e.target.value)}
                              placeholder={t('task_assign_search')}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-[11px] text-slate-200 placeholder-slate-500"
                              autoFocus
                            />
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
                            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                              {filteredAssignable.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-1">{t('task_assign_no_match')}</p>
                              ) : (
                                filteredAssignable.map((m) => {
                                  const checked = selectedAssigneeIds.has(m.id);
                                  const cat = categories?.find((c) => c.id === m.categoryId);
                                  return (
                                    <label key={m.id} className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer hover:bg-slate-600/50 rounded px-1 py-0.5">
                                      <input type="checkbox" checked={checked}
                                        onChange={() => {
                                          setSelectedAssigneeIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(m.id)) next.delete(m.id);
                                            else next.add(m.id);
                                            return next;
                                          });
                                        }} />
                                      <span>{ensureString(m.displayName, lang)}</span>
                                      {cat && <span className="text-slate-500 text-[9px]">({ensureString(cat.name, lang)})</span>}
                                    </label>
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
                                  await onAssignCard(col.id, card.id, cardTitle, ids, names);
                                  setAssigningCardId(null);
                                  setSelectedAssigneeIds(new Set());
                                  setAssignSearchQuery('');
                                  setAssignAreaFilter('');
                                }}
                                disabled={selectedAssigneeIds.size === 0}
                                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1 rounded">
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
                            className="text-[10px] text-slate-400 hover:text-emerald-400 border border-slate-600 rounded px-1 transition-colors">
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
          {t('last_edited_by')(
            board.lastEditedBy,
            board.lastEditedAt?.toDate?.().toLocaleDateString() ?? '',
          )}
        </p>
      )}
    </div>
  );
}
