// ─── AcademyView ──────────────────────────────────────────────────────────────
// Two-panel layout: module list on the left, module detail + retrieval on the right.
// Admins can create, edit, and delete modules; members submit retrieval answers.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';
import { toEmbedUrl, tsToDate } from '../utils.js';

/**
 * @param {{
 *   modules:          object[],
 *   moduleAttempts:   object[],
 *   canEdit:          boolean,
 *   onCreateModule:   function(data: object): Promise<void>,
 *   onUpdateModule:   function(id: string, updates: object): Promise<void>,
 *   onDeleteModule:   function(id: string): Promise<void>,
 *   onCompleteModule: function(id: string, answer: string): Promise<void>,
 * }} props
 */
export default function AcademyView({
  modules, moduleAttempts, canEdit,
  onCreateModule, onUpdateModule, onDeleteModule, onCompleteModule,
}) {
  const { t } = React.useContext(LangContext);

  // Which module is currently open in the detail panel
  const [selectedId,    setSelectedId]    = useState(null);
  // Retrieval answer draft for the active module
  const [answer,        setAnswer]        = useState('');
  // Copy of a module being edited in-place
  const [editingModule, setEditingModule] = useState(null);
  // Controls visibility of the "new module" form
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newMod, setNewMod] = useState({ title: '', description: '', content: '', videoUrl: '', retrievalPrompt: '' });

  const selected = modules.find((m) => m.id === selectedId) || null;
  const attempt  = selected ? moduleAttempts.find((a) => a.moduleId === selectedId) : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newMod.title.trim() || !newMod.retrievalPrompt.trim()) {
      alert('Title and retrieval prompt are required.');
      return;
    }
    await onCreateModule({ ...newMod, order: modules.length });
    setNewMod({ title: '', description: '', content: '', videoUrl: '', retrievalPrompt: '' });
    setShowNewForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingModule) return;
    const { id, ...updates } = editingModule;
    await onUpdateModule(id, updates);
    setEditingModule(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('nav_academy')}</h2>
        {canEdit && (
          <button onClick={() => setShowNewForm((s) => !s)}
            className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">
            {showNewForm ? t('cancel') : `+ ${t('new_module')}`}
          </button>
        )}
      </div>

      {/* ── New module form ── */}
      {showNewForm && canEdit && (
        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-300">{t('new_module_form_title')}</div>
          <input placeholder={t('title_req')} value={newMod.title}
            onChange={(e) => setNewMod((m) => ({ ...m, title: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
          <input placeholder={t('short_desc_mod')} value={newMod.description}
            onChange={(e) => setNewMod((m) => ({ ...m, description: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
          <textarea rows={4} placeholder={t('content_ph')} value={newMod.content}
            onChange={(e) => setNewMod((m) => ({ ...m, content: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
          <div>
            <input placeholder={t('video_ph')} value={newMod.videoUrl}
              onChange={(e) => setNewMod((m) => ({ ...m, videoUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
            {newMod.videoUrl && (
              <p className="text-[11px] text-slate-500 mt-1">
                {t('embed_label')} {toEmbedUrl(newMod.videoUrl) || t('url_parse_err')}
              </p>
            )}
          </div>
          <textarea rows={2} placeholder={t('retrieval_ph')} value={newMod.retrievalPrompt}
            onChange={(e) => setNewMod((m) => ({ ...m, retrievalPrompt: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
          <button onClick={handleCreate} className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded">
            {t('save')} {t('new_module')}
          </button>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Module list */}
        <div className="bg-slate-800 rounded-lg p-3 space-y-1">
          <div className="text-xs text-slate-400 mb-2">{t('modules_list')(modules.length)}</div>
          {modules.length === 0 && <div className="text-xs text-slate-500">{t('no_modules')}</div>}
          {modules.map((m) => {
            const done = moduleAttempts.some((a) => a.moduleId === m.id);
            return (
              <button key={m.id}
                onClick={() => { setSelectedId(m.id); setAnswer(''); setEditingModule(null); }}
                className={`w-full text-left px-2 py-2 rounded text-xs flex items-center justify-between gap-1 transition-colors
                  ${selectedId === m.id ? 'bg-emerald-500 text-black' : 'hover:bg-slate-700 text-slate-200'}`}>
                <span className="truncate">{m.title}</span>
                {done && <span className="shrink-0 font-bold">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Module detail / edit panel */}
        <div className="md:col-span-2 bg-slate-800 rounded-lg p-4 space-y-4 min-h-[300px]">

          {!selected && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-slate-500">{t('select_module_msg')}</p>
            </div>
          )}

          {/* View mode */}
          {selected && !editingModule && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base">{selected.title}</h3>
                  {selected.description && <p className="text-xs text-slate-400 mt-1">{selected.description}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditingModule({ ...selected })} className="text-xs text-slate-400 underline">{t('edit')}</button>
                    <button onClick={() => { onDeleteModule(selected.id); setSelectedId(null); }}
                      className="text-xs text-red-400 underline">{t('delete')}</button>
                  </div>
                )}
              </div>

              {/* Embedded video */}
              {selected.videoUrl && (
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={toEmbedUrl(selected.videoUrl)}
                    className="absolute inset-0 w-full h-full rounded"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={selected.title}
                  />
                </div>
              )}

              {selected.content && (
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed border-t border-slate-700 pt-4">
                  {selected.content}
                </div>
              )}

              {/* Retrieval practice */}
              <div className="border-t border-slate-700 pt-4">
                {selected.retrievalPrompt && (
                  <p className="text-xs font-semibold text-slate-300 mb-3">
                    {t('retrieval_label')}{' '}
                    <span className="font-normal text-slate-200 italic">{selected.retrievalPrompt}</span>
                  </p>
                )}
                {attempt ? (
                  <div className="bg-emerald-900/20 border border-emerald-800 rounded p-3 space-y-1">
                    <p className="text-xs text-emerald-300 font-semibold">{t('completed_badge')} ✓</p>
                    <p className="text-xs text-slate-300 italic">"{attempt.answer}"</p>
                    <p className="text-[10px] text-slate-500">{tsToDate(attempt.completedAt).toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)}
                      placeholder={selected.retrievalPrompt || t('retrieval_ph')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500">{t('must_submit_msg')}</p>
                      <button onClick={() => onCompleteModule(selected.id, answer)}
                        className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded">
                        {t('mark_complete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Edit mode */}
          {selected && editingModule && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-300">{t('edit_module_title')}</div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingModule(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                  <button onClick={handleSaveEdit} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                </div>
              </div>
              <input placeholder={t('title_req')} value={editingModule.title}
                onChange={(e) => setEditingModule((m) => ({ ...m, title: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
              <input placeholder={t('short_desc_mod')} value={editingModule.description || ''}
                onChange={(e) => setEditingModule((m) => ({ ...m, description: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
              <textarea rows={4} placeholder={t('content_ph')} value={editingModule.content || ''}
                onChange={(e) => setEditingModule((m) => ({ ...m, content: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
              <div>
                <input placeholder={t('video_ph')} value={editingModule.videoUrl || ''}
                  onChange={(e) => setEditingModule((m) => ({ ...m, videoUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                {editingModule.videoUrl && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t('embed_label')} {toEmbedUrl(editingModule.videoUrl)}
                  </p>
                )}
              </div>
              <textarea rows={2} placeholder={t('retrieval_ph')} value={editingModule.retrievalPrompt || ''}
                onChange={(e) => setEditingModule((m) => ({ ...m, retrievalPrompt: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
