// ─── BoardTypeSection ─────────────────────────────────────────────────────────
// Reusable wrapper for Kanban, SCRUM, and Retrospective tabs.
// Handles: board creation (with scope selector), board switcher tabs,
// and delegating per-board edit permission to BoardView via resolveCanEdit().

import React, { useState } from 'react';
import LangContext from '../../i18n/LangContext.js';
import BoardView   from './BoardView.jsx';

/**
 * @param {{
 *   boards:         object[],          // already filtered for visibility by ToolsView
 *   boardType:      string,            // 'kanban' | 'scrum' | 'retro'
 *   defaultColumns: object[],          // template columns for new boards
 *   emptyText:      string,
 *   placeholder?:   string,
 *   categories:     object[],          // for scope dropdown
 *   canCreate:      boolean,           // can the user create a new board at all?
 *   resolveCanEdit: function(board): boolean,
 *   onCreateBoard:  function(name, type, columns, categoryId): Promise<void>,
 *   onUpdateBoard:  function(id, updates): Promise<void>,
 *   onDeleteBoard:  function(id): Promise<void>,
 * }} props
 */
export default function BoardTypeSection({
  boards, boardType, defaultColumns, emptyText, placeholder,
  categories, canCreate, resolveCanEdit,
  onCreateBoard, onUpdateBoard, onDeleteBoard,
}) {
  const { t } = React.useContext(LangContext);
  const [newBoardName,    setNewBoardName]    = useState('');
  const [newCategoryId,   setNewCategoryId]   = useState('');  // '' = global
  const [selectedBoardId, setSelectedBoardId] = useState(null);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId) || boards[0] || null;

  const handleCreate = async () => {
    if (!newBoardName.trim()) return;
    await onCreateBoard(newBoardName.trim(), boardType, defaultColumns, newCategoryId || null);
    setNewBoardName('');
    setNewCategoryId('');
  };

  return (
    <div className="space-y-4">
      {/* ── New board form (scope + name) ── */}
      {canCreate && (
        <div className="flex flex-wrap gap-2">
          <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)}
            placeholder={placeholder || t('new_board_btn')}
            className="flex-1 min-w-[140px] px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
          {/* Scope selector */}
          <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}
            className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
            <option value="">{t('scope_global')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{t('scope_category')} {c.name}</option>
            ))}
          </select>
          <button onClick={handleCreate}
            className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded">
            {t('create_board_btn')}
          </button>
        </div>
      )}

      {boards.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-8 text-center text-xs text-slate-500">
          {emptyText}{canCreate ? t('create_above') : ''}
        </div>
      )}

      {/* Board selector tabs */}
      {boards.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {boards.map((b) => (
            <button key={b.id} onClick={() => setSelectedBoardId(b.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors
                ${selectedBoard?.id === b.id ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {b.name}
              {/* Scope badge */}
              {b.categoryId
                ? <span className="ml-1.5 text-[9px] bg-blue-900/60 text-blue-300 px-1 py-0.5 rounded">
                    {categories.find((c) => c.id === b.categoryId)?.name ?? ''}
                  </span>
                : <span className="ml-1.5 text-[9px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded">Global</span>
              }
            </button>
          ))}
        </div>
      )}

      {selectedBoard && (
        <>
          {/* Scope badge for single board */}
          {boards.length === 1 && (
            <div className="flex items-center gap-2">
              {selectedBoard.categoryId
                ? <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                    {t('scope_category')} {categories.find((c) => c.id === selectedBoard.categoryId)?.name}
                    <span className="ml-1 text-blue-500">· {t('category_only_hint')}</span>
                  </span>
                : <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                    {t('scope_global')}
                  </span>
              }
            </div>
          )}
          <BoardView
            board={selectedBoard}
            canEditThis={resolveCanEdit(selectedBoard)}
            onUpdateBoard={onUpdateBoard}
            onDeleteBoard={onDeleteBoard}
          />
        </>
      )}
    </div>
  );
}
