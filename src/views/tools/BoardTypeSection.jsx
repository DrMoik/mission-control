// ─── BoardTypeSection ─────────────────────────────────────────────────────────
// Reusable wrapper for Kanban, SCRUM, and Retrospective tabs.
// Handles: board creation (with scope selector), board switcher tabs,
// and delegating per-board edit permission to BoardView via resolveCanEdit().

import React, { useState } from 'react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';
import { Button, Input } from '../../components/ui/index.js';
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
  const [showArchived, setShowArchived] = useState(false);
  const [selectedArchivedBoardId, setSelectedArchivedBoardId] = useState(null);

  const activeBoards = boards.filter((board) => !board.archived);
  const archivedBoards = boards.filter((board) => board.archived);
  const selectedBoard = activeBoards.find((b) => b.id === selectedBoardId) || activeBoards[0] || null;
  const selectedArchivedBoard = archivedBoards.find((b) => b.id === selectedArchivedBoardId) || archivedBoards[0] || null;
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
          <Input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder={placeholder || t('new_board_btn')} className="flex-1 min-w-[140px]" />
          <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary">
            <option value="">{t('scope_global')}</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>))}
          </select>
          <Button variant="primary" size="sm" onClick={handleCreate}>{t('create_board_btn')}</Button>
        </div>
      )}

      {activeBoards.length === 0 && (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-8 text-center text-xs text-content-tertiary italic">
          {archivedBoards.length > 0
            ? 'Todos los tableros activos fueron archivados. Usa la seccion de archivados para consultarlos o restaurarlos.'
            : `${emptyText}${canCreate ? t('create_above') : ''}`}
        </div>
      )}

      {/* Board selector tabs */}
      {activeBoards.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {activeBoards.map((b) => (
            <button key={b.id} onClick={() => setSelectedBoardId(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150
                ${selectedBoard?.id === b.id ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm' : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'}`}>
              {ensureString(b.name, lang)}
              {b.categoryId
                ? <span className="ml-1.5 text-[9px] bg-blue-900/40 text-blue-300 border border-blue-800/50 px-1 py-0.5 rounded">{ensureString(categories.find((c) => c.id === b.categoryId)?.name, lang) ?? ''}</span>
                : <span className="ml-1.5 text-[9px] bg-surface-overlay text-content-tertiary border border-slate-700/40 px-1 py-0.5 rounded">{t('scope_global')}</span>
              }
            </button>
          ))}
        </div>
      )}

      {selectedBoard && (
        <>
          {activeBoards.length === 1 && !editingBoardId && (
            <div className="flex items-center gap-2">
              {selectedBoard.categoryId
                ? <span className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-full">
                    {t('scope_category')} {ensureString(categories.find((c) => c.id === selectedBoard.categoryId)?.name, lang)}
                    <span className="ml-1 text-blue-400/70">· {t('category_only_hint')}</span>
                  </span>
                : <span className="text-[10px] bg-surface-overlay text-content-tertiary border border-slate-700/40 px-2 py-0.5 rounded-full">{t('scope_global')}</span>
              }
              {canEditSelected && (
                <button type="button" onClick={startEditBoard} className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors underline">{t('edit')}</button>
              )}
            </div>
          )}
          {editingBoardId === selectedBoard.id && (
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
              <span className="text-xs text-amber-400/90">{t('edit')}</span>
              <Input value={editBoardName} onChange={(e) => setEditBoardName(e.target.value)} placeholder={placeholder || t('new_board_btn')} className="flex-1 min-w-[140px]" />
              <select value={editBoardCategoryId} onChange={(e) => setEditBoardCategoryId(e.target.value)} className="px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary">
                <option value="">{t('scope_global')}</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>))}
              </select>
              <Button variant="primary" size="sm" onClick={saveEditBoard}>{t('save')}</Button>
              <Button variant="secondary" size="sm" onClick={() => setEditingBoardId(null)}>{t('cancel')}</Button>
            </div>
          )}
          {activeBoards.length > 1 && canEditSelected && !editingBoardId && (
            <div className="flex justify-end">
              <button type="button" onClick={startEditBoard} className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors underline">
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

      {archivedBoards.length > 0 && (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">Archivados</div>
              <div className="text-sm text-content-secondary">{archivedBoards.length} tablero{archivedBoards.length === 1 ? '' : 's'} fuera del flujo principal</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {showArchived && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-2">
                {archivedBoards.map((board) => {
                  const categoryName = board.categoryId
                    ? ensureString(categories.find((c) => c.id === board.categoryId)?.name, lang)
                    : t('scope_global');
                  const isSelected = selectedArchivedBoard?.id === board.id;
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => setSelectedArchivedBoardId(board.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600/70 hover:bg-slate-900/70'
                      }`}
                    >
                      <div className="text-sm font-semibold text-content-primary">{ensureString(board.name, lang)}</div>
                      <div className="mt-1 text-xs text-content-tertiary">
                        {categoryName}
                        {board.archivedBy ? ` · Archivado por ${board.archivedBy}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedArchivedBoard && (
                <div className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">Auditoria</div>
                      <div className="text-lg font-semibold text-content-primary">{ensureString(selectedArchivedBoard.name, lang)}</div>
                    </div>
                    {resolveCanEdit(selectedArchivedBoard) && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onUpdateBoard(selectedArchivedBoard.id, { archived: false, archivedAt: null, archivedBy: null })}>
                          Restaurar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onDeleteBoard(selectedArchivedBoard.id)}>
                          {t('delete')}
                        </Button>
                      </div>
                    )}
                  </div>

                  <BoardView
                    board={selectedArchivedBoard}
                    canEditThis={false}
                    onUpdateBoard={onUpdateBoard}
                    onDeleteBoard={onDeleteBoard}
                    memberships={memberships}
                    categories={categories}
                    currentMembership={currentMembership}
                    memberRole={memberRole}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
