import React, { useEffect, useMemo, useState } from 'react';
import { t, lang } from '../strings.js';
import { toEmbedUrl, tsToDate, getL, toL, fillL, ensureString, toGoogleDriveDownloadUrl } from '../utils.js';
import { BilingualField } from '../components/ui/index.js';
import ModalOverlay from '../components/ModalOverlay.jsx';
import PdfReader from '../components/ui/PdfReader.jsx';
import SafeImage from '../components/ui/SafeImage.jsx';

const newTopicId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

const emptyBook = () => ({
  title: '',
  author: '',
  description: '',
  driveUrl: '',
  coverUrl: '',
  categoryId: '',
});

const emptyProgress = () => ({ lastPage: 1 });

export default function AcademyView({
  modules,
  moduleAttempts,
  books = [],
  bookProgress = [],
  teamMemberships = [],
  categories = [],
  currentMembership = null,
  knowledgeAreas = [],
  canEdit,
  canManageBooks = false,
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onCreateBook,
  onUpdateBook,
  onDeleteBook,
  onSaveBookProgress,
  onRequestModuleReview,
  onApproveModuleAttempt,
}) {
  const [contentTab, setContentTab] = useState('modules');
  const [selectedId, setSelectedId] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMod, setNewMod] = useState(emptyMod());

  const [selectedBookId, setSelectedBookId] = useState(null);
  const [showNewBookForm, setShowNewBookForm] = useState(false);
  const [newBook, setNewBook] = useState(emptyBook());
  const [editingBookId, setEditingBookId] = useState(null);
  const [editBookDraft, setEditBookDraft] = useState(emptyBook());
  const [readerBookId, setReaderBookId] = useState(null);
  const [readerPage, setReaderPage] = useState(null);
  const [readerMode, setReaderMode] = useState('pdf');

  const selected = modules.find((m) => m.id === selectedId) || null;
  const attempt = selected ? moduleAttempts.find((a) => a.moduleId === selectedId) : null;

  const visibleBooks = useMemo(
    () => books.filter((book) => !book.categoryId || canEdit || currentMembership?.categoryId === book.categoryId),
    [books, canEdit, currentMembership],
  );

  const selectedBook = visibleBooks.find((book) => book.id === selectedBookId) || null;
  const readerBook = visibleBooks.find((book) => book.id === readerBookId) || null;
  const selectedBookProgress = selectedBook
    ? bookProgress.find((item) => item.bookId === selectedBook.id) || null
    : null;
  const readerBookProgress = readerBook
    ? bookProgress.find((item) => item.bookId === readerBook.id) || null
    : null;

  useEffect(() => {
    if (selectedBookId && !visibleBooks.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(null);
      setEditingBookId(null);
    }
  }, [selectedBookId, visibleBooks]);

  useEffect(() => {
    if (readerBookId && !visibleBooks.some((book) => book.id === readerBookId)) {
      setReaderBookId(null);
    }
  }, [readerBookId, visibleBooks]);

  useEffect(() => {
    if (!readerBook) {
      setReaderPage(null);
      setReaderMode('pdf');
      return;
    }
    setReaderPage(Math.max(1, Number(readerBookProgress?.lastPage) || 1));
    setReaderMode('pdf');
  }, [readerBook, readerBookProgress]);

  useEffect(() => {
    if (!readerBook || !readerPage) return undefined;
    const timeout = window.setTimeout(() => {
      onSaveBookProgress(readerBook.id, { lastPage: readerPage });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [readerBook, readerPage, onSaveBookProgress]);

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
      knowledgeAreaIds: Array.isArray(newMod.knowledgeAreaIds) ? newMod.knowledgeAreaIds.filter(Boolean) : [],
    });
    setNewMod(emptyMod());
    setShowNewForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingModule) return;
    const { id, ...rest } = editingModule;
    const topics = (rest.topics || []).map((tp) => ({
      id: tp.id,
      title: fillL(tp.title),
      content: fillL(tp.content),
      videoUrl: (tp.videoUrl || '').trim(),
    }));
    await onUpdateModule(id, {
      title: fillL(rest.title),
      description: fillL(rest.description),
      topics,
      knowledgeAreaIds: Array.isArray(rest.knowledgeAreaIds) ? rest.knowledgeAreaIds.filter(Boolean) : [],
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
      knowledgeAreaIds: mod.knowledgeAreaIds || [],
    });
  };

  const addTopicToNew = () => setNewMod((m) => ({ ...m, topics: [...(m.topics || []), emptyTopic()] }));
  const removeTopicFromNew = (idx) => setNewMod((m) => ({ ...m, topics: m.topics.filter((_, i) => i !== idx) }));
  const updateTopicInNew = (idx, field, value) => setNewMod((m) => ({
    ...m,
    topics: m.topics.map((tp, i) => (i !== idx ? tp : { ...tp, [field]: value })),
  }));

  const addTopicToEdit = () => setEditingModule((m) => ({ ...m, topics: [...(m.topics || []), emptyTopic()] }));
  const removeTopicFromEdit = (idx) => setEditingModule((m) => ({ ...m, topics: m.topics.filter((_, i) => i !== idx) }));
  const updateTopicInEdit = (idx, field, value) => setEditingModule((m) => ({
    ...m,
    topics: m.topics.map((tp, i) => (i !== idx ? tp : { ...tp, [field]: value })),
  }));

  const pendingAttempts = (moduleAttempts || []).filter((a) => a.status === 'requested_review');

  const handleCreateBook = async () => {
    if (!newBook.title.trim() || !newBook.author.trim() || !newBook.driveUrl.trim()) return;
    await onCreateBook({
      title: newBook.title.trim(),
      author: newBook.author.trim(),
      description: newBook.description.trim(),
      driveUrl: newBook.driveUrl.trim(),
      coverUrl: newBook.coverUrl.trim(),
      categoryId: newBook.categoryId || null,
    });
    setNewBook(emptyBook());
    setShowNewBookForm(false);
  };

  const startEditBook = (book) => {
    setEditingBookId(book.id);
    setEditBookDraft({
      title: ensureString(book.title, lang),
      author: ensureString(book.author, lang),
      description: ensureString(book.description, lang),
      driveUrl: book.driveUrl || '',
      coverUrl: book.coverUrl || '',
      categoryId: book.categoryId || '',
    });
  };

  const handleSaveBookEdit = async () => {
    if (!editingBookId) return;
    await onUpdateBook(editingBookId, {
      title: editBookDraft.title.trim(),
      author: editBookDraft.author.trim(),
      description: editBookDraft.description.trim(),
      driveUrl: editBookDraft.driveUrl.trim(),
      coverUrl: editBookDraft.coverUrl.trim(),
      categoryId: editBookDraft.categoryId || null,
    });
    setEditingBookId(null);
  };

  const renderKnowledgeAreas = (value, setter) => (
    knowledgeAreas.length > 0 && (
      <div>
        <label className="text-[11px] text-slate-500 block mb-1">{t('merit_attr_knowledge_areas') || 'Areas de conocimiento'}</label>
        <div className="flex flex-wrap gap-1">
          {knowledgeAreas.map((area) => {
            const isSelected = (value.knowledgeAreaIds || []).includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => setter((current) => ({
                  ...current,
                  knowledgeAreaIds: isSelected
                    ? (current.knowledgeAreaIds || []).filter((id) => id !== area.id)
                    : [...(current.knowledgeAreaIds || []), area.id],
                }))}
                className={`text-[10px] px-2 py-0.5 rounded ${isSelected ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'}`}
              >
                {area.name}
              </button>
            );
          })}
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('nav_academy')}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setContentTab('modules')}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${contentTab === 'modules' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {t('academy_tab_modules')}
          </button>
          <button
            type="button"
            onClick={() => setContentTab('books')}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${contentTab === 'books' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {t('academy_tab_books')}
          </button>
        </div>
      </div>

      {contentTab === 'modules' ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">{t('modules_list')}</div>
            {canEdit && (
              <button
                onClick={() => setShowNewForm((s) => !s)}
                className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded"
              >
                {showNewForm ? t('cancel') : `+ ${t('new_module')}`}
              </button>
            )}
          </div>

          {canEdit && onApproveModuleAttempt && pendingAttempts.length > 0 && (
            <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4">
              <div className="text-xs font-semibold text-amber-200 mb-2">
                {t('review_pending') || 'Revisiones pendientes'}
              </div>
              <ul className="space-y-2">
                {pendingAttempts.map((a) => {
                  const mod = modules.find((m) => m.id === a.moduleId);
                  const member = teamMemberships.find((m) => m.id === a.membershipId);
                  const memberName = member?.displayName || member?.userId || a.membershipId || '-';
                  const modTitle = mod ? getL(mod.title, lang) : '-';
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-xs bg-slate-800/50 rounded px-3 py-2">
                      <span className="text-slate-200 truncate">{memberName} -&gt; {modTitle}</span>
                      <button onClick={() => onApproveModuleAttempt(a.id)} className="shrink-0 px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded text-[11px]">
                        {t('approve') || 'Aprobar'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {showNewForm && canEdit && (
            <div className="bg-slate-800 rounded-lg p-4 space-y-4">
              <div className="text-xs font-semibold text-slate-300">{t('new_module_form_title')}</div>
              <BilingualField
                label={`${t('title_req')} *`}
                value={newMod.title}
                onChange={(v) => setNewMod((m) => ({ ...m, title: v }))}
                placeholder={{ en: 'Module title...', es: 'Titulo del modulo...' }}
              />
              <BilingualField
                label={t('short_desc_mod')}
                value={newMod.description}
                onChange={(v) => setNewMod((m) => ({ ...m, description: v }))}
              />
              {renderKnowledgeAreas(newMod, setNewMod)}
              <div>
                <div className="text-xs text-slate-400 mb-2">{t('topic_label')}s</div>
                {(newMod.topics || []).map((tp, idx) => (
                  <div key={tp.id} className="bg-slate-900 rounded p-3 mb-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">{t('topic_label')} {idx + 1}</span>
                      <button type="button" onClick={() => removeTopicFromNew(idx)} className="text-[11px] text-red-400 hover:underline">
                        {t('delete')}
                      </button>
                    </div>
                    <BilingualField label={t('topic_title_ph')} value={tp.title} onChange={(v) => updateTopicInNew(idx, 'title', v)} />
                    <BilingualField label={t('content_ph')} value={tp.content} onChange={(v) => updateTopicInNew(idx, 'content', v)} multiline rows={3} />
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">{t('video_ph')}</label>
                      <input
                        placeholder="https://youtu.be/..."
                        value={tp.videoUrl || ''}
                        onChange={(e) => updateTopicInNew(idx, 'videoUrl', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                      />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addTopicToNew} className="text-xs text-emerald-400 underline">
                  + {t('add_topic')}
                </button>
              </div>
              <button type="button" onClick={handleCreate} className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded">
                {t('save')} {t('new_module')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-3 space-y-1">
              <div className="text-xs text-slate-400 mb-2">{`Modulos (${modules.length})`}</div>
              {modules.length === 0 && <div className="text-xs text-slate-500">{t('no_modules')}</div>}
              {modules.map((m) => {
                const hasAttempt = moduleAttempts.some((a) => a.moduleId === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedId(m.id); setEditingModule(null); }}
                    className={`w-full text-left px-2 py-2 rounded text-xs flex items-center justify-between gap-1 transition-colors ${selectedId === m.id ? 'bg-emerald-500 text-black' : 'hover:bg-slate-700 text-slate-200'}`}
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

              {selected && !editingModule && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base">{getL(selected.title, lang)}</h3>
                      {getL(selected.description, lang) && <p className="text-xs text-slate-400 mt-1">{getL(selected.description, lang)}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openForEdit(selected)} className="text-xs text-slate-400 underline">{t('edit')}</button>
                        <button onClick={() => { onDeleteModule(selected.id); setSelectedId(null); }} className="text-xs text-red-400 underline">{t('delete')}</button>
                      </div>
                    )}
                  </div>

                  {getTopics(selected).map((topic, idx) => (
                    <div key={topic.id} className="border-t border-slate-700 pt-4">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">{t('topic_label')} {idx + 1}: {getL(topic.title, lang) || '-'}</h4>
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
                      {getL(topic.content, lang) && <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{getL(topic.content, lang)}</div>}
                    </div>
                  ))}

                  <div className="border-t border-slate-700 pt-4 space-y-2">
                    <p className="text-[11px] text-slate-500">{t('academy_eval_personal')}</p>
                    {attempt ? (
                      <div className="bg-slate-700/50 rounded p-3">
                        <p className="text-xs font-medium text-slate-300">{attempt.status === 'approved' ? t('review_approved') : t('review_requested')}</p>
                        {(attempt.requestedAt?.toDate || attempt.completedAt?.toDate) && (
                          <p className="text-[10px] text-slate-500 mt-0.5">{tsToDate(attempt.requestedAt || attempt.completedAt).toLocaleString()}</p>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => onRequestModuleReview(selected.id)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded">
                        {t('request_review')}
                      </button>
                    )}
                  </div>
                </>
              )}

              {selected && editingModule && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-300">{t('edit_module_title')}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingModule(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                      <button onClick={handleSaveEdit} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                    </div>
                  </div>
                  <BilingualField label={t('title_req')} value={editingModule.title} onChange={(v) => setEditingModule((m) => ({ ...m, title: v }))} />
                  <BilingualField label={t('short_desc_mod')} value={editingModule.description} onChange={(v) => setEditingModule((m) => ({ ...m, description: v }))} />
                  {renderKnowledgeAreas(editingModule, setEditingModule)}
                  <div>
                    <div className="text-xs text-slate-400 mb-2">{t('topic_label')}s</div>
                    {(editingModule.topics || []).map((tp, idx) => (
                      <div key={tp.id} className="bg-slate-900 rounded p-3 mb-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500">{t('topic_label')} {idx + 1}</span>
                          <button type="button" onClick={() => removeTopicFromEdit(idx)} className="text-[11px] text-red-400 hover:underline">{t('delete')}</button>
                        </div>
                        <BilingualField label={t('topic_title_ph')} value={tp.title} onChange={(v) => updateTopicInEdit(idx, 'title', v)} />
                        <BilingualField label={t('content_ph')} value={tp.content} onChange={(v) => updateTopicInEdit(idx, 'content', v)} multiline rows={3} />
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">{t('video_ph')}</label>
                          <input
                            placeholder="https://youtu.be/..."
                            value={tp.videoUrl || ''}
                            onChange={(e) => updateTopicInEdit(idx, 'videoUrl', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                          />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addTopicToEdit} className="text-xs text-emerald-400 underline">+ {t('add_topic')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">{`${t('academy_books_title')} (${visibleBooks.length})`}</div>
              {canManageBooks && (
                <button type="button" onClick={() => setShowNewBookForm((s) => !s)} className="text-[11px] text-emerald-400 underline">
                  {showNewBookForm ? t('cancel') : t('academy_new_book')}
                </button>
              )}
            </div>

            {showNewBookForm && canManageBooks && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-3">
                <div className="text-xs font-semibold text-slate-300">{t('academy_new_book_form_title')}</div>
                <input value={newBook.title} onChange={(e) => setNewBook((b) => ({ ...b, title: e.target.value }))} placeholder={t('academy_book_title_ph')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={newBook.author} onChange={(e) => setNewBook((b) => ({ ...b, author: e.target.value }))} placeholder={t('academy_book_author_ph')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <textarea value={newBook.description} onChange={(e) => setNewBook((b) => ({ ...b, description: e.target.value }))} placeholder={t('academy_book_desc_ph')} rows={3} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={newBook.driveUrl} onChange={(e) => setNewBook((b) => ({ ...b, driveUrl: e.target.value }))} placeholder={t('academy_book_drive_url')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={newBook.coverUrl} onChange={(e) => setNewBook((b) => ({ ...b, coverUrl: e.target.value }))} placeholder={t('academy_book_cover_url')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <select value={newBook.categoryId} onChange={(e) => setNewBook((b) => ({ ...b, categoryId: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm">
                  <option value="">{t('scope_global')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t('scope_category')} {ensureString(category.name, lang)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">{t('academy_book_drive_hint')}</p>
                <button type="button" onClick={handleCreateBook} className="w-full rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-black">
                  {t('save')} {t('academy_new_book')}
                </button>
              </div>
            )}

            {visibleBooks.length === 0 && <div className="text-xs text-slate-500">{t('academy_no_books')}</div>}
            {visibleBooks.map((book) => {
              const progress = bookProgress.find((item) => item.bookId === book.id);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => { setSelectedBookId(book.id); setEditingBookId(null); }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedBookId === book.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'}`}
                >
                  <div className="flex gap-3">
                    <SafeImage
                      src={book.coverUrl}
                      alt={ensureString(book.title, lang)}
                      className="h-16 w-12 rounded object-cover bg-slate-700"
                      fallback={<div className="h-16 w-12 rounded bg-slate-700" />}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">{ensureString(book.title, lang)}</div>
                      <div className="text-xs text-slate-400">{ensureString(book.author, lang)}</div>
                      {progress?.lastPage ? <div className="mt-2 text-[11px] text-emerald-300">Pagina {progress.lastPage}</div> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="md:col-span-2 bg-slate-800 rounded-lg p-4 space-y-4 min-h-[320px]">
            {!selectedBook && (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-slate-500">{t('academy_empty_library_msg')}</p>
              </div>
            )}

            {selectedBook && editingBookId !== selectedBook.id && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-4">
                    <SafeImage
                      src={selectedBook.coverUrl}
                      alt={ensureString(selectedBook.title, lang)}
                      className="h-28 w-20 rounded object-cover bg-slate-700"
                      fallback={<div className="h-28 w-20 rounded bg-slate-700" />}
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{ensureString(selectedBook.title, lang)}</h3>
                      <div className="text-sm text-slate-400">{ensureString(selectedBook.author, lang)}</div>
                      {selectedBook.description && <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{ensureString(selectedBook.description, lang)}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setReaderBookId(selectedBook.id)}
                          className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black"
                        >
                          {t('academy_book_open')}
                        </button>
                        {selectedBookProgress?.lastPage ? (
                          <button
                            type="button"
                            onClick={() => setReaderBookId(selectedBook.id)}
                            className="rounded border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-300"
                          >
                            {t('academy_book_resume')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {canManageBooks && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditBook(selectedBook)} className="text-xs text-slate-400 underline">{t('edit')}</button>
                      <button type="button" onClick={() => { onDeleteBook(selectedBook.id); setSelectedBookId(null); }} className="text-xs text-red-400 underline">{t('delete')}</button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                  El libro se abre dentro del lector de la biblioteca para mantener el acceso en la app.
                </div>

                <div className="border-t border-slate-700 pt-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{t('academy_book_progress')}</div>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-3">
                    <div className="text-sm text-slate-200">
                      {selectedBookProgress?.lastPage ? `Ultima pagina detectada: ${selectedBookProgress.lastPage}` : 'Aun no hay una pagina registrada.'}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      La pagina se guarda automaticamente cuando el libro puede abrirse en el lector PDF interno.
                    </p>
                  </div>
                </div>
              </>
            )}

            {selectedBook && editingBookId === selectedBook.id && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-300">{t('academy_edit_book_title')}</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingBookId(null)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                    <button type="button" onClick={handleSaveBookEdit} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1 rounded">{t('save')}</button>
                  </div>
                </div>
                <input value={editBookDraft.title} onChange={(e) => setEditBookDraft((b) => ({ ...b, title: e.target.value }))} placeholder={t('academy_book_title_ph')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={editBookDraft.author} onChange={(e) => setEditBookDraft((b) => ({ ...b, author: e.target.value }))} placeholder={t('academy_book_author_ph')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <textarea value={editBookDraft.description} onChange={(e) => setEditBookDraft((b) => ({ ...b, description: e.target.value }))} placeholder={t('academy_book_desc_ph')} rows={3} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={editBookDraft.driveUrl} onChange={(e) => setEditBookDraft((b) => ({ ...b, driveUrl: e.target.value }))} placeholder={t('academy_book_drive_url')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <input value={editBookDraft.coverUrl} onChange={(e) => setEditBookDraft((b) => ({ ...b, coverUrl: e.target.value }))} placeholder={t('academy_book_cover_url')} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm" />
                <select value={editBookDraft.categoryId} onChange={(e) => setEditBookDraft((b) => ({ ...b, categoryId: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm">
                  <option value="">{t('scope_global')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t('scope_category')} {ensureString(category.name, lang)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {readerBook && (
        <ModalOverlay onClickBackdrop={() => setReaderBookId(null)} className="p-2 sm:p-4">
          <div className="flex h-[92vh] w-[min(96vw,1400px)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{ensureString(readerBook.title, lang)}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {ensureString(readerBook.author, lang)}
                  {readerBookProgress?.lastPage ? ` · Pagina ${readerBookProgress.lastPage}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBookId !== readerBook.id) setSelectedBookId(readerBook.id);
                    setReaderBookId(null);
                  }}
                  className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  Ver ficha
                </button>
                <button
                  type="button"
                  onClick={() => setReaderBookId(null)}
                  className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  Cerrar lector
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950">
              {readerBook.driveUrl && readerMode === 'pdf' ? (
                <PdfReader
                  src={toGoogleDriveDownloadUrl(readerBook.driveUrl)}
                  initialPage={readerBookProgress?.lastPage || 1}
                  title={ensureString(readerBook.title, lang)}
                  onPageChange={setReaderPage}
                  onLoadError={() => setReaderMode('iframe')}
                />
              ) : readerBook.embedUrl ? (
                <div className="flex h-full flex-col">
                  <div className="border-b border-slate-800 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                    No se pudo cargar el PDF en modo interno. Se abrio el visor embebido de respaldo y la pagina ya no se puede detectar automaticamente para este archivo.
                  </div>
                  <iframe
                    src={readerBook.embedUrl}
                    className="h-full w-full"
                    title={ensureString(readerBook.title, lang)}
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
                  {t('academy_book_preview_unavailable')}
                </div>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
