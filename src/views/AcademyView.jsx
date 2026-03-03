// ─── AcademyView ──────────────────────────────────────────────────────────────
// Two-panel layout: module list on the left, module detail + retrieval on the right.
// Admins can create, edit, and delete modules; members submit retrieval answers.
//
// Bilingual fields: title, description, content, retrievalPrompt
// Plain field: videoUrl (a URL — no translation needed)

import React, { useState }     from 'react';
import LangContext              from '../i18n/LangContext.js';
import { toEmbedUrl, tsToDate, getL, toL, fillL } from '../utils.js';
import { BilingualField }       from '../components/ui/index.js';

export default function AcademyView({
  modules, moduleAttempts, canEdit,
  onCreateModule, onUpdateModule, onDeleteModule, onCompleteModule,
}) {
  const { t, lang } = React.useContext(LangContext);

  const [selectedId,    setSelectedId]    = useState(null);
  const [answer,        setAnswer]        = useState('');
  const [editingModule, setEditingModule] = useState(null);
  const [showNewForm,   setShowNewForm]   = useState(false);

  const emptyMod = () => ({
    title:           { en: '', es: '' },
    description:     { en: '', es: '' },
    content:         { en: '', es: '' },
    videoUrl:        '',
    retrievalPrompt: { en: '', es: '' },
  });

  const [newMod, setNewMod] = useState(emptyMod());

  const selected = modules.find((m) => m.id === selectedId) || null;
  const attempt  = selected ? moduleAttempts.find((a) => a.moduleId === selectedId) : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newMod.title.en.trim() && !newMod.title.es.trim()) {
      alert('Title is required.');
      return;
    }
    if (!newMod.retrievalPrompt.en.trim() && !newMod.retrievalPrompt.es.trim()) {
      alert('Retrieval prompt is required.');
      return;
    }
    await onCreateModule({
      title:           fillL(newMod.title),
      description:     fillL(newMod.description),
      content:         fillL(newMod.content),
      videoUrl:        newMod.videoUrl,
      retrievalPrompt: fillL(newMod.retrievalPrompt),
      order:           modules.length,
    });
    setNewMod(emptyMod());
    setShowNewForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingModule) return;
    const { id, ...updates } = editingModule;
    await onUpdateModule(id, {
      ...updates,
      title:           fillL(updates.title),
      description:     fillL(updates.description),
      content:         fillL(updates.content),
      retrievalPrompt: fillL(updates.retrievalPrompt),
    });
    setEditingModule(null);
  };

  const openForEdit = (mod) => setEditingModule({
    ...mod,
    title:           toL(mod.title),
    description:     toL(mod.description),
    content:         toL(mod.content),
    retrievalPrompt: toL(mod.retrievalPrompt),
  });

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
        <div className="bg-slate-800 rounded-lg p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-300">{t('new_module_form_title')}</div>

          <BilingualField
            label={`${t('title_req')} *`}
            value={newMod.title}
            onChange={(v) => setNewMod((m) => ({ ...m, title: v }))}
            placeholder={{ en: 'Module title…', es: 'Título del módulo…' }}
          />
          <BilingualField
            label={t('short_desc_mod')}
            value={newMod.description}
            onChange={(v) => setNewMod((m) => ({ ...m, description: v }))}
          />
          <BilingualField
            label={t('content_ph')}
            value={newMod.content}
            onChange={(v) => setNewMod((m) => ({ ...m, content: v }))}
            multiline rows={4}
          />

          {/* Video URL — single value, no translation needed */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('video_ph')}</label>
            <input placeholder="https://youtu.be/…" value={newMod.videoUrl}
              onChange={(e) => setNewMod((m) => ({ ...m, videoUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
            {newMod.videoUrl && (
              <p className="text-[11px] text-slate-500 mt-1">
                {t('embed_label')} {toEmbedUrl(newMod.videoUrl) || t('url_parse_err')}
              </p>
            )}
          </div>

          <BilingualField
            label={`${t('retrieval_ph')} *`}
            value={newMod.retrievalPrompt}
            onChange={(v) => setNewMod((m) => ({ ...m, retrievalPrompt: v }))}
            multiline rows={2}
          />

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
                <span className="truncate">{getL(m.title, lang)}</span>
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
                  <h3 className="font-semibold text-base">{getL(selected.title, lang)}</h3>
                  {getL(selected.description, lang) && (
                    <p className="text-xs text-slate-400 mt-1">{getL(selected.description, lang)}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openForEdit(selected)} className="text-xs text-slate-400 underline">{t('edit')}</button>
                    <button onClick={() => { onDeleteModule(selected.id); setSelectedId(null); }}
                      className="text-xs text-red-400 underline">{t('delete')}</button>
                  </div>
                )}
              </div>

              {selected.videoUrl && (
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={toEmbedUrl(selected.videoUrl)}
                    className="absolute inset-0 w-full h-full rounded"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={getL(selected.title, lang)}
                  />
                </div>
              )}

              {getL(selected.content, lang) && (
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed border-t border-slate-700 pt-4">
                  {getL(selected.content, lang)}
                </div>
              )}

              {/* Retrieval practice */}
              <div className="border-t border-slate-700 pt-4">
                {getL(selected.retrievalPrompt, lang) && (
                  <p className="text-xs font-semibold text-slate-300 mb-3">
                    {t('retrieval_label')}{' '}
                    <span className="font-normal text-slate-200 italic">{getL(selected.retrievalPrompt, lang)}</span>
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
                      placeholder={getL(selected.retrievalPrompt, lang) || t('retrieval_ph')}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-300">{t('edit_module_title')}</div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingModule(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                  <button onClick={handleSaveEdit} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                </div>
              </div>

              <BilingualField
                label={t('title_req')}
                value={editingModule.title}
                onChange={(v) => setEditingModule((m) => ({ ...m, title: v }))}
              />
              <BilingualField
                label={t('short_desc_mod')}
                value={editingModule.description}
                onChange={(v) => setEditingModule((m) => ({ ...m, description: v }))}
              />
              <BilingualField
                label={t('content_ph')}
                value={editingModule.content}
                onChange={(v) => setEditingModule((m) => ({ ...m, content: v }))}
                multiline rows={4}
              />

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('video_ph')}</label>
                <input placeholder="https://youtu.be/…" value={editingModule.videoUrl || ''}
                  onChange={(e) => setEditingModule((m) => ({ ...m, videoUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                {editingModule.videoUrl && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t('embed_label')} {toEmbedUrl(editingModule.videoUrl)}
                  </p>
                )}
              </div>

              <BilingualField
                label={t('retrieval_ph')}
                value={editingModule.retrievalPrompt}
                onChange={(v) => setEditingModule((m) => ({ ...m, retrievalPrompt: v }))}
                multiline rows={2}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
