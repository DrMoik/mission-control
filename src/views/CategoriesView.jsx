// ─── CategoriesView ───────────────────────────────────────────────────────────
// Shows all team categories as expandable cards, each listing its active members.
// Admins can create, rename, and delete categories.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';

/**
 * @param {{
 *   categories:       object[],
 *   memberships:      object[],
 *   canEdit:          boolean,
 *   onCreateCategory: function(name, description) → Promise
 *   onDeleteCategory: function(catId) → Promise
 *   onUpdateCategory: function(catId, name, description) → Promise
 *   onViewProfile:    function(membership)
 * }} props
 */
export default function CategoriesView({
  categories, memberships, canEdit,
  onCreateCategory, onDeleteCategory, onUpdateCategory, onViewProfile,
}) {
  const { t } = React.useContext(LangContext);

  const [newName,    setNewName]    = useState('');
  const [newDesc,    setNewDesc]    = useState('');
  const [editingId,  setEditingId]  = useState(null);
  const [editDraft,  setEditDraft]  = useState({ name: '', description: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreateCategory(newName.trim(), newDesc.trim());
    setNewName('');
    setNewDesc('');
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditDraft({ name: cat.name, description: cat.description || '' });
  };

  const handleSaveEdit = async (catId) => {
    if (!editDraft.name.trim()) return;
    await onUpdateCategory(catId, editDraft.name.trim(), editDraft.description.trim());
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">{t('categories_title')}</h2>

      {/* Create form — admins only */}
      {canEdit && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-400 block mb-1">{t('category_name')}</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
              placeholder={t('cat_placeholder')}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-400 block mb-1">{t('description')}</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded">
            {t('add_category')}
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-8 text-center text-xs text-slate-500">
          {t('no_categories')}{canEdit ? ` ${t('add_category')}.` : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catMembers = memberships.filter((m) => m.categoryId === cat.id && m.status === 'active');
            const isEditing  = editingId === cat.id;

            return (
              <div key={cat.id} className="bg-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3">
                  {isEditing ? (
                    /* Inline edit form */
                    <div className="space-y-2">
                      <input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-emerald-500 rounded text-sm font-semibold"
                      />
                      <input
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        placeholder={t('desc_placeholder')}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                        <button onClick={() => handleSaveEdit(cat.id)}
                          className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                      </div>
                    </div>
                  ) : (
                    /* View mode header */
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{cat.name}</div>
                        {cat.description && <div className="text-xs text-slate-400 mt-0.5">{cat.description}</div>}
                        <div className="text-xs text-slate-500 mt-0.5">{t('member_s')(catMembers.length)}</div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(cat)} className="text-[11px] text-amber-400 underline">{t('edit')}</button>
                          <button onClick={() => onDeleteCategory(cat.id)} className="text-[11px] text-red-400 underline">{t('delete')}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Member chips */}
                {catMembers.length > 0 && (
                  <div className="border-t border-slate-700 px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      {catMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onViewProfile?.(m)}
                          className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          {m.photoURL ? (
                            <img src={m.photoURL} className="w-6 h-6 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold">
                              {(m.displayName || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="text-left">
                            <div className="text-xs font-medium">{m.displayName}</div>
                            <div className="text-[10px] text-slate-400">{t('role_' + m.role) || m.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {catMembers.length === 0 && (
                  <div className="border-t border-slate-700 px-4 py-2 text-xs text-slate-600 italic">
                    {t('no_members_yet')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
