// ─── BoardTypeSection ─────────────────────────────────────────────────────────
// Reusable wrapper for Kanban, SCRUM, and Retrospective tabs.
// Handles: board creation (with scope selector), board switcher tabs,
// and delegating per-board edit permission to BoardView via resolveCanEdit().

import React, { useState } from 'react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';
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
 *   onCreateTask?:  function({ assigneeMembershipId, title, description, dueDate }): Promise<void>,
 *   canAssignTask?: function(assigneeMembershipId: string): boolean,
 *   memberships?:   object[],          // for "Assign to" on cards (execute tools only)
 *   currentMembership?: object | null,
 *   memberRole?:     string | null,    // for leader-only hint in assign UI
 * }} props
 */
export default function BoardTypeSection({
  boards, boardType, defaultColumns, emptyText, placeholder,
  categories, canCreate, resolveCanEdit,
  onCreateBoard, onUpdateBoard, onDeleteBoard,
  onCreateTask, canAssignTask, memberships = [],
  currentMembership = null,
  memberRole = null,
}) {
  const [newBoardName,    setNewBoardName]    = useState('');
  const [newCategoryId,   setNewCategoryId]   = useState('');  // '' = global
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [editingBoardId,  setEditingBoardId]  = useState(null);
  const [editBoardName,   setEditBoardName]   = useState('');
  const [editBoardCategoryId, setEditBoardCategoryId] = useState('');

  const selectedBoard = boards.find((b) => b.id === selectedBoardId) || boards[0] || null;
  const canEditSelected = selectedBoard && resolveCanEdit(selectedBoard);

  const handleAssignCard = async (columnId, cardId, cardTitle, assigneeMembershipIds, assigneeDisplayNames) => {
    const ids = Array.isArray(assigneeMembershipIds) ? assigneeMembershipIds : [assigneeMembershipIds];
    const names = Array.isArray(assigneeDisplayNames) ? assigneeDisplayNames : [assigneeDisplayNames];
    if (!selectedBoard || !onCreateTask || ids.length === 0) return;
    for (const id of ids) { if (!canAssignTask?.(id)) return; }
    const boardName = ensureString(selectedBoard.name, lang) || selectedBoard.id;
    await onCreateTask({
      assigneeMembershipIds: ids,
      title: cardTitle,
      description: boardName,
      dueDate: null,
    });
    const assignedByNamesStr = names.join(', ');
    const newColumns = (selectedBoard.columns || []).map((col) =>
      col.id === columnId
        ? {
            ...col,
            cards: (col.cards || []).map((c) =>
              c.id === cardId
                ? { ...c, assigneeMembershipIds: ids, assignedByNames: assignedByNamesStr }
                : c,
            ),
          }
        : col,
    );
    await onUpdateBoard(selectedBoard.id, { columns: newColumns });
  };

  const startEditBoard = () => {
    if (!selectedBoard) return;
    setEditingBoardId(selectedBoard.id);
    setEditBoardName(ensureString(selectedBoard.name, lang) || '');
    setEditBoardCategoryId(selectedBoard.categoryId || '');
  };

  const saveEditBoard = async () => {
    if (!editingBoardId || !editBoardName.trim()) return;
    await onUpdateBoard(editingBoardId, {
      name:       editBoardName.trim(),
      categoryId: editBoardCategoryId || null,
    });
    setEditingBoardId(null);
  };

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
              <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
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
              {ensureString(b.name, lang)}
              {/* Scope badge */}
              {b.categoryId
                ? <span className="ml-1.5 text-[9px] bg-blue-900/60 text-blue-300 px-1 py-0.5 rounded">
                    {ensureString(categories.find((c) => c.id === b.categoryId)?.name, lang) ?? ''}
                  </span>
                : <span className="ml-1.5 text-[9px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded">{t('scope_global')}</span>
              }
            </button>
          ))}
        </div>
      )}

      {selectedBoard && (
        <>
          {/* Scope badge for single board */}
          {boards.length === 1 && !editingBoardId && (
            <div className="flex items-center gap-2">
              {selectedBoard.categoryId
                ? <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                    {t('scope_category')} {ensureString(categories.find((c) => c.id === selectedBoard.categoryId)?.name, lang)}
                    <span className="ml-1 text-blue-500">· {t('category_only_hint')}</span>
                  </span>
                : <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                    {t('scope_global')}
                  </span>
              }
              {canEditSelected && (
                <button type="button" onClick={startEditBoard} className="text-[11px] text-amber-400 underline">
                  {t('edit')}
                </button>
              )}
            </div>
          )}
          {/* Edit board (name + scope) */}
          {editingBoardId === selectedBoard.id && (
            <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-800 rounded-lg border border-amber-700/40">
              <span className="text-xs text-amber-400/90">{t('edit')}</span>
              <input value={editBoardName} onChange={(e) => setEditBoardName(e.target.value)}
                placeholder={placeholder || t('new_board_btn')}
                className="flex-1 min-w-[140px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
              <select value={editBoardCategoryId} onChange={(e) => setEditBoardCategoryId(e.target.value)}
                className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
                <option value="">{t('scope_global')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                ))}
              </select>
              <button type="button" onClick={saveEditBoard}
                className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded">{t('save')}</button>
              <button type="button" onClick={() => setEditingBoardId(null)}
                className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded">{t('cancel')}</button>
            </div>
          )}
          {/* When multiple boards, show Edit in a small line above BoardView */}
          {boards.length > 1 && canEditSelected && !editingBoardId && (
            <div className="flex justify-end">
              <button type="button" onClick={startEditBoard} className="text-[11px] text-amber-400 underline">
                {t('edit')} {t('scope_label').toLowerCase()}
              </button>
            </div>
          )}
          <BoardView
            board={selectedBoard}
            canEditThis={resolveCanEdit(selectedBoard)}
            onUpdateBoard={onUpdateBoard}
            onDeleteBoard={onDeleteBoard}
            onCreateTask={onCreateTask}
            canAssignTask={canAssignTask}
            memberships={memberships}
            categories={categories}
            onAssignCard={onCreateTask && canAssignTask ? handleAssignCard : undefined}
            currentMembership={currentMembership}
            memberRole={memberRole}
          />
        </>
      )}
    </div>
  );
}
