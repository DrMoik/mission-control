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
 * }} props
 */
export default function BoardView({ board, canEditThis, onUpdateBoard, onDeleteBoard }) {
  const { t, lang } = React.useContext(LangContext);
  const [newCardTitles, setNewCardTitles] = useState({});

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
              {col.cards.map((card) => (
                <div key={card.id} className="bg-slate-700 rounded p-2.5 text-xs group">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-slate-100 font-medium">{ensureString(card.title, lang)}</span>
                    {canEditThis && (
                      <button onClick={() => deleteCard(col.id, card.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 shrink-0 transition-opacity">✕</button>
                    )}
                  </div>
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
              ))}
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
