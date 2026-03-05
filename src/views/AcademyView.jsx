// ─── AcademyView ─────────────────────────────────────────────────────────────
// Modules, each with multiple topics. Study content; no retrieval prompt.
// At the end of each module: "Solicitar revisión". Evaluation is personal (later).
//
// Bilingual: title, description; each topic has title, content. videoUrl is plain string.

import React, { useState } from 'react';
import { t, lang } from '../strings.js';
import { toEmbedUrl, tsToDate, getL, toL, fillL } from '../utils.js';
import { BilingualField } from '../components/ui/index.js';

const newTopicId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function AcademyView({
  modules,
  moduleAttempts,
  canEdit,
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onRequestModuleReview,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const emptyTopic = () => ({
    id: newTopicId(),
    title: { en: '', es: '' },
    content: { en: '', es: '' },
    videoUrl: '',
  });

  const emptyMod = () => ({
    title: { en: '', es: '' },
    description: { en: '', es: '' },
    topics: [emptyTopic()],
  });

  const [newMod, setNewMod] = useState(emptyMod());

  const selected = modules.find((m) => m.id === selectedId) || null;
  const attempt = selected ? moduleAttempts.find((a) => a.moduleId === selectedId) : null;

  // Normalize: support legacy modules (content/video at top level) as a single topic
  const getTopics = (mod) => {
    if (mod?.topics?.length) return mod.topics;
    if (mod?.title) {
      return [{
        id: 'legacy',
        title: mod.title,
        content: mod.content ?? { en: '', es: '' },
        videoUrl: mod.videoUrl ?? '',
      }];
    }
    return [];
  };

  const handleCreate = async () => {
    if (!newMod.title.en?.trim() && !newMod.title.es?.trim()) {
      alert(t('title_req') || 'Title is required.');
      return;
    }
    const topics = (newMod.topics || [])
      .filter((tp) => getL(tp.title, lang).trim() || getL(tp.content, lang).trim())
      .map((tp) => ({
        id: tp.id,
        title: fillL(tp.title),
        content: fillL(tp.content),
        videoUrl: (tp.videoUrl || '').trim(),
      }));
    if (topics.length === 0) {
      alert(t('topic_label') + ': ' + (t('add_topic') || 'Add at least one topic.'));
      return;
    }
    await onCreateModule({
      title: fillL(newMod.title),
      description: fillL(newMod.description),
      topics,
      order: modules.length,
    });
    setNewMod(emptyMod());
    setShowNewForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingModule) return;
    const { id, ...rest } = editingModule;
    const topics = (rest.topics || [])
      .map((tp) => ({
        id: tp.id,
        title: fillL(tp.title),
        content: fillL(tp.content),
        videoUrl: (tp.videoUrl || '').trim(),
      }));
    await onUpdateModule(id, {
      title: fillL(rest.title),
      description: fillL(rest.description),
      topics,
    });
    setEditingModule(null);
  };

  const openForEdit = (mod) => {
    const topics = mod.topics?.length
      ? mod.topics.map((tp) => ({ ...tp, title: toL(tp.title), content: toL(tp.content) }))
      : [{ ...emptyTopic(), id: 'legacy', title: toL(mod.title), content: toL(mod.content), videoUrl: mod.videoUrl || '' }];
    setEditingModule({
      ...mod,
      title: toL(mod.title),
      description: toL(mod.description),
      topics,
    });
  };

  const addTopicToNew = () =>
    setNewMod((m) => ({ ...m, topics: [...(m.topics || []), emptyTopic()] }));
  const removeTopicFromNew = (idx) =>
    setNewMod((m) => ({
      ...m,
      topics: m.topics.filter((_, i) => i !== idx),
    }));
  const updateTopicInNew = (idx, field, value) =>
    setNewMod((m) => ({
      ...m,
      topics: m.topics.map((tp, i) => (i !== idx ? tp : { ...tp, [field]: value })),
    }));

  const addTopicToEdit = () =>
    setEditingModule((m) => ({ ...m, topics: [...(m.topics || []), emptyTopic()] }));
  const removeTopicFromEdit = (idx) =>
    setEditingModule((m) => ({ ...m, topics: m.topics.filter((_, i) => i !== idx) }));
  const updateTopicInEdit = (idx, field, value) =>
    setEditingModule((m) => ({
      ...m,
      topics: m.topics.map((tp, i) => (i !== idx ? tp : { ...tp, [field]: value })),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('nav_academy')}</h2>
        {canEdit && (
          <button
            onClick={() => setShowNewForm((s) => !s)}
            className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded"
          >
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
          <div>
            <div className="text-xs text-slate-400 mb-2">{t('topic_label')}s</div>
            {(newMod.topics || []).map((tp, idx) => (
              <div key={tp.id} className="bg-slate-900 rounded p-3 mb-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{t('topic_label')} {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeTopicFromNew(idx)}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    {t('delete')}
                  </button>
                </div>
                <BilingualField
                  label={t('topic_title_ph')}
                  value={tp.title}
                  onChange={(v) => updateTopicInNew(idx, 'title', v)}
                />
                <BilingualField
                  label={t('content_ph')}
                  value={tp.content}
                  onChange={(v) => updateTopicInNew(idx, 'content', v)}
                  multiline
                  rows={3}
                />
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">{t('video_ph')}</label>
                  <input
                    placeholder="https://youtu.be/…"
                    value={tp.videoUrl || ''}
                    onChange={(e) => updateTopicInNew(idx, 'videoUrl', e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addTopicToNew}
              className="text-xs text-emerald-400 underline"
            >
              + {t('add_topic')}
            </button>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded"
          >
            {t('save')} {t('new_module')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-3 space-y-1">
          <div className="text-xs text-slate-400 mb-2">{`Módulos (${modules.length})`}</div>
          {modules.length === 0 && <div className="text-xs text-slate-500">{t('no_modules')}</div>}
          {modules.map((m) => {
            const hasAttempt = moduleAttempts.some((a) => a.moduleId === m.id);
            return (
              <button
                key={m.id}
                onClick={() => { setSelectedId(m.id); setEditingModule(null); }}
                className={`w-full text-left px-2 py-2 rounded text-xs flex items-center justify-between gap-1 transition-colors
                  ${selectedId === m.id ? 'bg-emerald-500 text-black' : 'hover:bg-slate-700 text-slate-200'}`}
              >
                <span className="truncate">{getL(m.title, lang)}</span>
                {hasAttempt && <span className="shrink-0 font-bold text-emerald-400">●</span>}
              </button>
            );
          })}
        </div>

        <div className="md:col-span-2 bg-slate-800 rounded-lg p-4 space-y-4 min-h-[300px]">
          {!selected && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-slate-500">{t('select_module_msg')}</p>
            </div>
          )}

          {/* View mode: study content + request review at end */}
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
                    <button onClick={() => openForEdit(selected)} className="text-xs text-slate-400 underline">
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => { onDeleteModule(selected.id); setSelectedId(null); }}
                      className="text-xs text-red-400 underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>

              {getTopics(selected).map((topic, idx) => (
                <div key={topic.id} className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">
                    {t('topic_label')} {idx + 1}: {getL(topic.title, lang) || '—'}
                  </h4>
                  {topic.videoUrl && (
                    <div className="relative w-full mb-3" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={toEmbedUrl(topic.videoUrl)}
                        className="absolute inset-0 w-full h-full rounded"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        title={getL(topic.title, lang)}
                      />
                    </div>
                  )}
                  {getL(topic.content, lang) && (
                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {getL(topic.content, lang)}
                    </div>
                  )}
                </div>
              ))}

              {/* Request review — at end of module; evaluation is personal (mentor reviews later) */}
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <p className="text-[11px] text-slate-500">{t('academy_eval_personal')}</p>
                {attempt ? (
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-xs font-medium text-slate-300">
                      {attempt.status === 'approved' ? t('review_approved') : t('review_requested')}
                    </p>
                    {(attempt.requestedAt?.toDate || attempt.completedAt?.toDate) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {tsToDate(attempt.requestedAt || attempt.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onRequestModuleReview(selected.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded"
                  >
                    {t('request_review')}
                  </button>
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
                  <button onClick={() => setEditingModule(null)} className="text-xs text-slate-400 underline">
                    {t('cancel')}
                  </button>
                  <button onClick={handleSaveEdit} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">
                    {t('save')}
                  </button>
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
              <div>
                <div className="text-xs text-slate-400 mb-2">{t('topic_label')}s</div>
                {(editingModule.topics || []).map((tp, idx) => (
                  <div key={tp.id} className="bg-slate-900 rounded p-3 mb-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">{t('topic_label')} {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeTopicFromEdit(idx)}
                        className="text-[11px] text-red-400 hover:underline"
                      >
                        {t('delete')}
                      </button>
                    </div>
                    <BilingualField
                      label={t('topic_title_ph')}
                      value={tp.title}
                      onChange={(v) => updateTopicInEdit(idx, 'title', v)}
                    />
                    <BilingualField
                      label={t('content_ph')}
                      value={tp.content}
                      onChange={(v) => updateTopicInEdit(idx, 'content', v)}
                      multiline
                      rows={3}
                    />
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">{t('video_ph')}</label>
                      <input
                        placeholder="https://youtu.be/…"
                        value={tp.videoUrl || ''}
                        onChange={(e) => updateTopicInEdit(idx, 'videoUrl', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                      />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addTopicToEdit} className="text-xs text-emerald-400 underline">
                  + {t('add_topic')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
