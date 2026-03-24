// ─── CategoriesView ───────────────────────────────────────────────────────────
// Shows all team categories as expandable cards, each listing its active members.
// Admins can create, rename, and delete categories.

import React, { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { t, lang } from '../strings.js';
import { BilingualField } from '../components/ui/index.js';
import SafeProfileImage from '../components/ui/SafeProfileImage.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { getL, toL, fillL, ensureString } from '../utils.js';

export default function CategoriesView({
  categories, memberships, canEdit,
  onCreateCategory, onDeleteCategory, onUpdateCategory, onViewProfile,
}) {
  const [showForm,  setShowForm]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState({ en: '', es: '' });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', description: { en: '', es: '' } });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreateCategory(newName.trim(), fillL(newDesc));
    setNewName('');
    setNewDesc({ en: '', es: '' });
    setShowForm(false);
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditDraft({ name: cat.name, description: toL(cat.description) });
  };

  const handleSaveEdit = async (catId) => {
    if (!editDraft.name.trim()) return;
    await onUpdateCategory(catId, editDraft.name.trim(), fillL(editDraft.description));
    setEditingId(null);
  };

  const totalMembers = memberships.filter((m) => m.status === 'active').length;

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('categories_title')}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{`${categories.length} áreas · ${totalMembers} miembros activos`}</p>
        </div>
        {canEdit && !showForm && (
          <div className="shrink-0">
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('add_category')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Create form panel ── */}
      {canEdit && showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <span className="text-sm font-semibold text-content-primary">{t('add_category')}</span>
          </div>
          <div>
            <label className="text-xs text-content-tertiary block mb-1">{t('category_name')} *</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              placeholder={t('cat_placeholder')}
            />
          </div>
          <BilingualField
            label={t('description')}
            value={newDesc}
            onChange={setNewDesc}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            <Button type="submit" size="sm">{t('add_category')}</Button>
          </div>
        </form>
      )}

      {/* ── Categories list ── */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm">
          <div className="px-4 py-12 text-center">
            <Users className="w-8 h-8 text-content-tertiary mx-auto mb-3" strokeWidth={1.5} />
            <div className="text-content-tertiary text-sm">
              {t('no_categories')}{canEdit ? ` ${t('add_category')}.` : ''}
            </div>
            {canEdit && !showForm && (
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('add_category')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catMembers = memberships.filter((m) => m.categoryId === cat.id && m.status === 'active');
            const isEditing  = editingId === cat.id;

            return (
              <div key={cat.id} className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-content-tertiary block mb-1">{t('category_name')}</label>
                        <Input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <BilingualField
                        label={t('description')}
                        value={editDraft.description}
                        onChange={(v) => setEditDraft((d) => ({ ...d, description: v }))}
                      />
                      <div className="flex gap-2 justify-end pt-1">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                        <Button type="button" size="sm" onClick={() => handleSaveEdit(cat.id)}>{t('save')}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-content-primary">{ensureString(cat.name, lang)}</div>
                        {cat.description && (
                          <div className="text-xs text-content-secondary mt-0.5">{getL(cat.description, lang)}</div>
                        )}
                        <div className="text-xs text-content-tertiary mt-0.5">
                          {`${catMembers.length} miembro${catMembers.length !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(cat)} className="text-[11px] text-amber-400 hover:underline">{t('edit')}</button>
                          <button onClick={() => onDeleteCategory(cat.id)} className="text-[11px] text-red-400 hover:underline">{t('delete')}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Member chips */}
                {catMembers.length > 0 && (
                  <div className="border-t border-slate-700/40 bg-surface-sunken/30 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {catMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onViewProfile?.(m)}
                          className="flex items-center gap-2 bg-surface-overlay hover:bg-slate-700/60 border border-slate-700/40 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          {m.photoURL ? (
                            <SafeProfileImage
                              src={m.photoURL}
                              fallback={
                                <div className="w-6 h-6 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {(ensureString(m.displayName, lang) || '?')[0].toUpperCase()}
                                </div>
                              }
                              className="w-6 h-6 rounded-full object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">
                              {(ensureString(m.displayName, lang) || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="text-left">
                            <div className="text-xs font-medium text-content-primary">{ensureString(m.displayName, lang)}</div>
                            <div className="text-[10px] text-content-tertiary">{t('role_' + m.role) || m.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {catMembers.length === 0 && (
                  <div className="border-t border-slate-700/40 px-4 py-2 text-xs text-content-tertiary italic">
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
