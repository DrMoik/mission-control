// ─── ToolsView ────────────────────────────────────────────────────────────────
// Tab-based container for all PM tools.
//
// Scope rules
// ───────────
// • Every tool item (board / meeting / goal / calendar event) has a `categoryId`
//   field.  null = Global (visible to all members); a category ID = visible only
//   to members of that category (plus admins).
//
// Edit-permission rules
// ─────────────────────
// • Global items   → any member with role ≥ leader  (canEditTools)
// • Category items → only leaders assigned to that category, OR admins
//
// SWOT is always global and is stored directly on the team document.
//
// Each tool section shows:
//   ① A collapsible "How to use" description
//   ② A scope visibility filter
//   ③ "Last edited by" on every item

import React, { useState, useMemo } from 'react';
import LangContext             from '../i18n/LangContext.js';
import BoardTypeSection        from './tools/BoardTypeSection.jsx';
import MeetingsSection         from './tools/MeetingsSection.jsx';
import GoalsSection            from './tools/GoalsSection.jsx';
import { BilingualField }      from '../components/ui/index.js';
import { getL, toL, fillL, ensureString, tsToDate } from '../utils.js';

// SWOT quadrant metadata (colours are language-independent)
const SWOT_META = [
  { key: 'strengths',     labelKey: 'swot_strengths',     border: 'border-emerald-600', bg: 'bg-emerald-950/20' },
  { key: 'weaknesses',    labelKey: 'swot_weaknesses',    border: 'border-red-600',     bg: 'bg-red-950/20'     },
  { key: 'opportunities', labelKey: 'swot_opportunities', border: 'border-blue-600',    bg: 'bg-blue-950/20'    },
  { key: 'threats',       labelKey: 'swot_threats',       border: 'border-amber-600',   bg: 'bg-amber-950/20'   },
];

// ── HowToUse banner ────────────────────────────────────────────────────────────
// Collapsible grey banner shown at the top of every tool tab.
function HowToUse({ descKey }) {
  const { t } = React.useContext(LangContext);
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg text-xs">
      <button onClick={() => setOpen((s) => !s)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
        <span className="font-semibold inline-flex items-center gap-1">
              <span className={`inline-block text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}>▼</span>
              {t('how_to_use') || 'How to use'}
            </span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-slate-400 leading-relaxed space-y-2">
          <p className="whitespace-pre-line">{t(descKey)}</p>
          {(() => {
            const ex = t(descKey + '_example');
            const ln = t(descKey + '_link');
            const hasEx = ex && ex !== descKey + '_example';
            const hasLn = ln && ln.startsWith('http');
            return (
              <>
                {hasEx && <p className="text-slate-500 text-[11px] italic">{t('tool_example')}: {ex}</p>}
                {hasLn && (
                  <a href={ln} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline text-[11px] block">
                    {t('tool_more_info')} →
                  </a>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── ScopeFilter ────────────────────────────────────────────────────────────────
// Tab strip: "All accessible" / "Global only" / per-category
function ScopeFilter({ value, onChange, categories, userCategoryId, canEdit }) {
  const { t, lang } = React.useContext(LangContext);
  const options = [
    { id: 'all',    label: t('scope_filter_all')    },
    { id: 'global', label: t('scope_filter_global') },
    // Only show a category filter if the user belongs to one (or is admin)
    ...categories
      .filter((c) => canEdit || c.id === userCategoryId)
      .map((c) => ({ id: c.id, label: ensureString(c.name, lang) })),
  ];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
            value === opt.id
              ? 'bg-emerald-500 text-black'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   team:              object,
 *   teamEvents:        object[],
 *   teamSwots:         object[],
 *   teamEisenhowers:   object[],
 *   teamPughs:         object[],
 *   teamBoards:        object[],
 *   teamMeetings:      object[],
 *   teamGoals:         object[],
 *   categories:        object[],
 *   currentMembership: object | null,
 *   memberRole:        string | null,
 *   canEdit:           boolean,           // admin-level
 *   canEditTools:      boolean,           // leader+ level (global tools)
 *   resolveCanEdit:    function(item): boolean,
 *   onCreateEvent, onUpdateEvent, onDeleteEvent, onUpdateSwot,
 *   onCreateEisenhower, onUpdateEisenhower, onDeleteEisenhower,
 *   onCreatePugh, onUpdatePugh, onDeletePugh,
 *   onCreateBoard, onUpdateBoard, onDeleteBoard,
 *   onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
 *   onCreateGoal, onUpdateGoal, onDeleteGoal,
 * }} props
 */
export default function ToolsView({
  team, teamEvents, teamSwots = [], teamEisenhowers = [], teamPughs = [], teamBoards, teamMeetings, teamGoals,
  categories, memberships = [], currentMembership, memberRole, canEdit, canEditTools,
  resolveCanEdit,
  onCreateTask, canAssignTask,
  onCreateEvent, onUpdateEvent, onDeleteEvent,
  onCreateSwot, onUpdateSwot, onDeleteSwot,
  onCreateEisenhower, onUpdateEisenhower, onDeleteEisenhower,
  onCreatePugh, onUpdatePugh, onDeletePugh,
  onCreateBoard,  onUpdateBoard,  onDeleteBoard,
  onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
  onCreateGoal,   onUpdateGoal,   onDeleteGoal,
}) {
  const { t, lang } = React.useContext(LangContext);

  const [toolTab,     setToolTab]     = useState('calendar');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [showBirthdays, setShowBirthdays] = useState(false); // checkbox: show birthdays in calendar
  const [newEvent,    setNewEvent]    = useState({
    title:       { en: '', es: '' },
    date:        '',
    description: { en: '', es: '' },
    categoryId:  '',
  });
  const [editingEventId, setEditingEventId] = useState(null);
  const [editEventDraft,  setEditEventDraft] = useState({ title: { en: '', es: '' }, date: '', description: { en: '', es: '' }, categoryId: '' });
  const [selectedSwotId, setSelectedSwotId] = useState(null);
  const [editingSwot, setEditingSwot] = useState(false);
  const [swotDraft,   setSwotDraft]   = useState(null);
  const [newSwotName, setNewSwotName] = useState('');
  const [newSwotCategoryId, setNewSwotCategoryId] = useState('');

  // Eisenhower: multiple matrices per team (Firestore teamEisenhowers)
  const EISENHOWER_KEYS = ['q1', 'q2', 'q3', 'q4'];
  const emptyEisenhowerData = () => ({ q1: [], q2: [], q3: [], q4: [] });
  const [selectedEisenhowerId, setSelectedEisenhowerId] = useState(null);
  const [newEisenhowerName, setNewEisenhowerName] = useState('');
  const [newEisenhowerCategoryId, setNewEisenhowerCategoryId] = useState('');
  const selectedEisenhower = selectedEisenhowerId ? teamEisenhowers.find((m) => m.id === selectedEisenhowerId) : null;
  const eisenhowerData = selectedEisenhower ? { q1: selectedEisenhower.q1 || [], q2: selectedEisenhower.q2 || [], q3: selectedEisenhower.q3 || [], q4: selectedEisenhower.q4 || [] } : emptyEisenhowerData();
  const setEisenhowerData = (updater) => {
    if (!selectedEisenhowerId || !onUpdateEisenhower) return;
    const next = typeof updater === 'function' ? updater(eisenhowerData) : updater;
    onUpdateEisenhower(selectedEisenhowerId, next);
  };
  const [editingEisenhowerItem, setEditingEisenhowerItem] = useState(null);

  // Pugh: multiple matrices per team (Firestore teamPughs)
  const emptyPughData = () => ({ issue: '', reference: '', criteria: [], alternatives: [], scores: {} });
  const [selectedPughId, setSelectedPughId] = useState(null);
  const [newPughName, setNewPughName] = useState('');
  const [newPughCategoryId, setNewPughCategoryId] = useState('');
  const selectedPugh = selectedPughId ? teamPughs.find((m) => m.id === selectedPughId) : null;
  const pughData = selectedPugh ? {
    issue: selectedPugh.issue || '',
    reference: selectedPugh.reference || '',
    criteria: (selectedPugh.criteria || []).map((c) => ({ ...c, weight: c.weight ?? 10 })),
    alternatives: selectedPugh.alternatives || [],
    scores: selectedPugh.scores || {},
  } : emptyPughData();
  const setPughData = (updater) => {
    if (!selectedPughId || !onUpdatePugh) return;
    const next = typeof updater === 'function' ? updater(pughData) : updater;
    onUpdatePugh(selectedPughId, next);
  };

  const userCategoryId = currentMembership?.categoryId || null;

  // ── Visibility helper ──────────────────────────────────────────────────────
  // An item is visible to the current user when:
  //   • it is global (no categoryId), OR
  //   • it belongs to the user's category, OR
  //   • the user is an admin (canEdit)
  const isVisible = React.useCallback((item) => {
    if (!item.categoryId) return true;
    if (canEdit) return true;
    return item.categoryId === userCategoryId;
  }, [canEdit, userCategoryId]);

  // Apply both visibility AND scope-filter
  const filterItems = React.useCallback((items) => {
    return items.filter((item) => {
      if (!isVisible(item)) return false;
      if (scopeFilter === 'all')    return true;
      if (scopeFilter === 'global') return !item.categoryId;
      return item.categoryId === scopeFilter;
    });
  }, [isVisible, scopeFilter]);

  // Birthday events from memberships (virtual, not stored)
  const birthdayEvents = useMemo(() => {
    const year = new Date().getFullYear();
    return (memberships || [])
      .filter((m) => m.birthdate && typeof m.birthdate === 'string' && m.birthdate.trim().length >= 5)
      .map((m) => {
        const s = m.birthdate.trim();
        const parts = s.split('-');
        let month, day;
        if (parts.length >= 3) {
          [, month, day] = parts;
        } else if (parts.length >= 2) {
          [month, day] = parts;
        } else return null;
        const mNum = parseInt(month, 10);
        const dNum = parseInt(day, 10);
        if (isNaN(mNum) || isNaN(dNum) || mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) return null;
        const dateStr = `${year}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
        const name = ensureString(m.displayName, lang) || '?';
        return {
          id:           `birthday-${m.id}`,
          title:        { en: `Birthday of ${name}`, es: `Cumpleaños de ${name}` },
          date:         dateStr,
          categoryId:   m.categoryId || null,
          isBirthday:   true,
        };
      })
      .filter(Boolean);
  }, [memberships, lang]);

  // Derived filtered collections
  const filteredTeamEvents = useMemo(() => filterItems(teamEvents), [filterItems, teamEvents]);
  const filteredBirthdays = useMemo(() => filterItems(birthdayEvents), [filterItems, birthdayEvents]);
  const visibleEvents = useMemo(() => {
    const team = filteredTeamEvents || [];
    const birthdays = showBirthdays ? (filteredBirthdays || []) : [];
    const merged = [...team, ...birthdays];
    return merged.sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return da - db;
    });
  }, [filteredTeamEvents, filteredBirthdays, showBirthdays]);
  const visibleSwots    = useMemo(() => filterItems(teamSwots),    [filterItems, teamSwots]);
  const visibleBoards   = useMemo(() => filterItems(teamBoards),   [filterItems, teamBoards]);
  const visibleMeetings = useMemo(() => filterItems(teamMeetings), [filterItems, teamMeetings]);
  const visibleGoals    = useMemo(() => filterItems(teamGoals),    [filterItems, teamGoals]);
  const visibleEisenhowerList = useMemo(() => filterItems(teamEisenhowers), [filterItems, teamEisenhowers]);
  const visiblePughList       = useMemo(() => filterItems(teamPughs),       [filterItems, teamPughs]);

  // When scope filter hides the selected Eisenhower/Pugh matrix, select first visible
  React.useEffect(() => {
    if (selectedEisenhowerId && !visibleEisenhowerList.some((m) => m.id === selectedEisenhowerId)) {
      setSelectedEisenhowerId(visibleEisenhowerList[0]?.id ?? null);
    }
  }, [selectedEisenhowerId, visibleEisenhowerList]);
  React.useEffect(() => {
    if (selectedPughId && !visiblePughList.some((m) => m.id === selectedPughId)) {
      setSelectedPughId(visiblePughList[0]?.id ?? null);
    }
  }, [selectedPughId, visiblePughList]);

  const selectedSwot = selectedSwotId ? teamSwots.find((s) => s.id === selectedSwotId) : null;

  // Whether the current user can CREATE a new item (regardless of scope — permission
  // is re-checked per-item in the handler)
  const canCreate = canEditTools; // any leader+ can try; scope permission enforced server-side

  // ── SWOT helpers ───────────────────────────────────────────────────────────

  const norm = (items) => (items || []).map((i) => ({ ...i, text: toL(i.text) }));

  const startEditSwot = (swot) => {
    if (!swot) return;
    setSwotDraft({
      strengths:     norm(swot.strengths),
      weaknesses:    norm(swot.weaknesses),
      opportunities: norm(swot.opportunities),
      threats:       norm(swot.threats),
    });
    setEditingSwot(true);
  };

  const addSwotItem    = (key)          => setSwotDraft((d) => ({ ...d, [key]: [...(d[key] || []), { id: `${Date.now()}`, text: { en: '', es: '' } }] }));
  const updateSwotItem = (key, id, val) => setSwotDraft((d) => ({ ...d, [key]: (d[key] || []).map((i) => (i.id === id ? { ...i, text: val } : i)) }));
  const removeSwotItem = (key, id)      => setSwotDraft((d) => ({ ...d, [key]: (d[key] || []).filter((i) => i.id !== id) }));

  const handleSaveSwot = async () => {
    if (!selectedSwotId) return;
    await onUpdateSwot(selectedSwotId, swotDraft);
    setEditingSwot(false);
  };

  const handleCreateSwotSubmit = async (e) => {
    e.preventDefault();
    const name = (newSwotName || '').trim();
    if (!name && !canEditTools) return;
    const id = await onCreateSwot({ name: name || undefined, categoryId: newSwotCategoryId || null });
    setNewSwotName('');
    setNewSwotCategoryId('');
    if (id) setSelectedSwotId(id);
  };

  // ── Calendar event creation ────────────────────────────────────────────────

  const handleAddEvent = async (e) => {
    e.preventDefault();
    await onCreateEvent({
      title:       fillL(newEvent.title),
      date:        newEvent.date,
      description: fillL(newEvent.description),
      categoryId:  newEvent.categoryId || null,
    });
    setNewEvent({ title: { en: '', es: '' }, date: '', description: { en: '', es: '' }, categoryId: '' });
  };

  const startEditEvent = (evt) => {
    const d = evt.date?.toDate ? evt.date.toDate() : new Date(evt.date);
    setEditingEventId(evt.id);
    setEditEventDraft({
      title:       toL(evt.title),
      date:        d.toISOString().slice(0, 10),
      description: toL(evt.description),
      categoryId:  evt.categoryId || '',
    });
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEventId) return;
    await onUpdateEvent(editingEventId, {
      title:       fillL(editEventDraft.title),
      date:        editEventDraft.date,
      description: fillL(editEventDraft.description),
      categoryId:  editEventDraft.categoryId || null,
    });
    setEditingEventId(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('team_tools_title')}</h2>

      {/* Tool tab bar — grouped by function: Identify & plan vs Execute */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mr-1">{t('tools_group_identify_plan')}</span>
          {[
            ['swot', t('tab_swot')],
            ['eisenhower', t('tab_eisenhower')],
            ['pugh', t('tab_pugh')],
            ['goals', t('tab_goals')],
          ].map(([id, label]) => (
            <button key={id} onClick={() => { setToolTab(id); setScopeFilter('all'); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors
                ${toolTab === id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mr-1">{t('tools_group_execute')}</span>
          {[
            ['calendar', t('tab_calendar')],
            ['boards', t('tab_kanban')],
            ['scrum', t('tab_scrum')],
            ['retro', t('tab_retro')],
            ['meetings', t('tab_meetings')],
          ].map(([id, label]) => (
            <button key={id} onClick={() => { setToolTab(id); setScopeFilter('all'); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors
                ${toolTab === id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ CALENDAR ══════════ */}
      {toolTab === 'calendar' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_calendar" />

          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input type="checkbox" checked={showBirthdays} onChange={(e) => setShowBirthdays(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-pink-500 focus:ring-pink-500" />
            <span>🎂 {t('calendar_filter_birthdays')}</span>
          </label>

          {canCreate && !editingEventId && (
            <form onSubmit={handleAddEvent} className="bg-slate-800 rounded-lg p-4 space-y-3">
              <BilingualField
                label={`${t('event_title_label')} *`}
                value={newEvent.title}
                onChange={(v) => setNewEvent((n) => ({ ...n, title: v }))}
                placeholder={{ en: t('event_title_ph'), es: t('event_title_ph') }}
              />
              <BilingualField
                label={t('description')}
                value={newEvent.description}
                onChange={(v) => setNewEvent((n) => ({ ...n, description: v }))}
              />
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-40">
                  <label className="text-xs text-slate-400 block mb-1">{t('event_date')} *</label>
                  <input type="date" value={newEvent.date} onChange={(e) => setNewEvent((v) => ({ ...v, date: e.target.value }))}
                    required className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">{t('scope_label')}</label>
                  <select value={newEvent.categoryId} onChange={(e) => setNewEvent((v) => ({ ...v, categoryId: e.target.value }))}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
                    <option value="">{t('scope_global')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded self-end">
                  {t('add_event_btn')}
                </button>
              </div>
            </form>
          )}

          {editingEventId && (
            <form onSubmit={handleUpdateEvent} className="bg-slate-800 rounded-lg p-4 space-y-3 border border-amber-700/50">
              <div className="text-xs text-amber-400/90 mb-1">{t('edit')} {t('event_title_label')}</div>
              <BilingualField
                label={`${t('event_title_label')} *`}
                value={editEventDraft.title}
                onChange={(v) => setEditEventDraft((n) => ({ ...n, title: v }))}
                placeholder={{ en: t('event_title_ph'), es: t('event_title_ph') }}
              />
              <BilingualField
                label={t('description')}
                value={editEventDraft.description}
                onChange={(v) => setEditEventDraft((n) => ({ ...n, description: v }))}
              />
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-40">
                  <label className="text-xs text-slate-400 block mb-1">{t('event_date')} *</label>
                  <input type="date" value={editEventDraft.date} onChange={(e) => setEditEventDraft((v) => ({ ...v, date: e.target.value }))}
                    required className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">{t('scope_label')}</label>
                  <select value={editEventDraft.categoryId} onChange={(e) => setEditEventDraft((v) => ({ ...v, categoryId: e.target.value }))}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300">
                    <option value="">{t('scope_global')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded self-end">{t('save')}</button>
                <button type="button" onClick={() => setEditingEventId(null)} className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded self-end">{t('cancel')}</button>
              </div>
            </form>
          )}

          <div className="bg-slate-800 rounded-lg overflow-hidden">
            {visibleEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">{t('no_events_add')}</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {visibleEvents.map((evt) => {
                  const d         = evt.date?.toDate ? evt.date.toDate() : new Date(evt.date);
                  const isPast    = d < new Date();
                  const catName   = evt.categoryId
                    ? ensureString(categories.find((c) => c.id === evt.categoryId)?.name, lang) : null;
                  const canDelEvt = !evt.isBirthday && resolveCanEdit(evt);
                  return (
                    <div key={evt.id} className={`flex items-start gap-4 px-4 py-3 ${isPast ? 'opacity-40' : ''}`}>
                      <div className="shrink-0 bg-slate-700 rounded-lg p-2 text-center w-14">
                        <div className="text-[10px] text-slate-400 uppercase">{d.toLocaleString('default', { month: 'short' })}</div>
                        <div className="text-2xl font-bold leading-none">{d.getDate()}</div>
                        <div className="text-[10px] text-slate-400">{d.getFullYear()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{getL(evt.title, lang)}</div>
                        {getL(evt.description, lang) && <div className="text-xs text-slate-400 mt-0.5">{getL(evt.description, lang)}</div>}
                        {/* Scope badge */}
                        <div className="mt-1">
                          {evt.isBirthday
                            ? <span className="text-[9px] bg-pink-900/40 text-pink-300 px-1.5 py-0.5 rounded-full">
                                🎂 {t('calendar_filter_birthdays')}
                              </span>
                            : catName
                              ? <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                                  {t('scope_category')} {catName}
                                </span>
                              : <span className="text-[9px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">Global</span>
                          }
                        </div>
                        {isPast && <div className="text-[10px] text-slate-600 mt-0.5">{t('past_label')}</div>}
                        {evt.lastEditedBy && (
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {t('last_edited_by')(evt.lastEditedBy, evt.lastEditedAt?.toDate?.().toLocaleDateString() ?? '')}
                          </div>
                        )}
                      </div>
                      {canDelEvt && (
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => startEditEvent(evt)} className="text-[11px] text-amber-400 underline">
                            {t('edit')}
                          </button>
                          <button type="button" onClick={() => onDeleteEvent(evt.id)} className="text-[11px] text-red-400 underline">
                            {t('delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SWOT / FODA (multiple entries) ══════════ */}
      {toolTab === 'swot' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_swot" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <p className="text-xs text-slate-400">{t('swot_desc')}</p>

          {/* New SWOT form — only shown when user can create */}
          {canEditTools && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600/60">
              <div className="text-xs font-medium text-slate-300 mb-3">{t('create_new')} FODA / SWOT</div>
              <form onSubmit={handleCreateSwotSubmit} className="flex flex-wrap gap-2 items-end">
                <input
                  value={newSwotName}
                  onChange={(e) => setNewSwotName(e.target.value)}
                  placeholder={t('swot_name_ph')}
                  className="flex-1 min-w-[160px] px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200"
                />
                <select
                  value={newSwotCategoryId}
                  onChange={(e) => setNewSwotCategoryId(e.target.value)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300"
                >
                  <option value="">{t('scope_global')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded">
                  {t('new_swot_btn')}
                </button>
              </form>
            </div>
          )}

          {/* List of SWOT entries to select */}
          {visibleSwots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {visibleSwots.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedSwotId(s.id); setEditingSwot(false); }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${selectedSwotId === s.id ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {ensureString(s.name, lang) || t('swot_new_entry')}
                  </button>
                  {canEditTools && resolveCanEdit(s) && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(t('delete_matrix_confirm'))) onDeleteSwot(s.id); setSelectedSwotId((id) => (id === s.id ? null : id)); }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected SWOT content + edit */}
          {selectedSwot && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-slate-300">{ensureString(selectedSwot.name, lang)}</span>
                {canEditTools && resolveCanEdit(selectedSwot) && !editingSwot && (
                  <button onClick={() => startEditSwot(selectedSwot)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300">
                    {t('edit_swot_btn')}
                  </button>
                )}
                {editingSwot && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingSwot(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                    <button type="button" onClick={handleSaveSwot} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
                  </div>
                )}
              </div>
              {selectedSwot.lastEditedBy && !editingSwot && (
                <p className="text-[10px] text-slate-600">
                  {t('last_edited_by')(selectedSwot.lastEditedBy, selectedSwot.lastEditedAt?.toDate?.().toLocaleDateString() ?? '')}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SWOT_META.map((q) => {
                  const items = editingSwot ? (swotDraft?.[q.key] || []) : (selectedSwot[q.key] || []).map((i) => ({ ...i, text: toL(i.text) }));
                  const displayItems = editingSwot ? (swotDraft?.[q.key] || []) : (selectedSwot[q.key] || []);
                  return (
                    <div key={q.key} className={`border-2 ${q.border} ${q.bg} rounded-lg p-4`}>
                      <div className="font-semibold text-sm mb-3">{t(q.labelKey)}</div>
                      <div className="space-y-2">
                        {displayItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-2">
                            <span className="text-slate-400 mt-0.5 text-xs shrink-0">•</span>
                            {editingSwot ? (
                              <div className="flex-1 space-y-1">
                                <BilingualField
                                  value={item.text}
                                  onChange={(v) => updateSwotItem(q.key, item.id, v)}
                                />
                                <button type="button" onClick={() => removeSwotItem(q.key, item.id)} className="text-red-400 text-xs underline">{t('delete')}</button>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-200">{getL(item.text, lang)}</span>
                            )}
                          </div>
                        ))}
                        {displayItems.length === 0 && !editingSwot && (
                          <p className="text-xs text-slate-600 italic">{t('nothing_yet')}</p>
                        )}
                        {editingSwot && (
                          <button type="button" onClick={() => addSwotItem(q.key)} className="text-xs text-emerald-400 underline mt-1">
                            {t('add_item_btn')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {visibleSwots.length === 0 && (
            <p className="text-xs text-slate-500 italic">{t('nothing_yet')}</p>
          )}
        </div>
      )}

      {/* ══════════ EISENHOWER MATRIX ══════════ */}
      {toolTab === 'eisenhower' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_eisenhower" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          {canCreate && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600/60">
              <div className="text-xs font-medium text-slate-300 mb-3">{t('create_new')} Eisenhower</div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = (newEisenhowerName || '').trim() || t('eisenhower_new_matrix');
                  const id = await onCreateEisenhower({ name, categoryId: newEisenhowerCategoryId || null });
                  setNewEisenhowerName('');
                  setNewEisenhowerCategoryId('');
                  if (id) setSelectedEisenhowerId(id);
                }}
                className="flex flex-wrap gap-2 items-end"
              >
                <input
                  value={newEisenhowerName}
                  onChange={(e) => setNewEisenhowerName(e.target.value)}
                  placeholder={t('eisenhower_matrix_name_ph')}
                  className="min-w-[140px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                />
                <select
                  value={newEisenhowerCategoryId}
                  onChange={(e) => setNewEisenhowerCategoryId(e.target.value)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300"
                >
                  <option value="">{t('scope_global')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded">
                  {t('eisenhower_new_matrix')}
                </button>
              </form>
            </div>
          )}
          {visibleEisenhowerList.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {visibleEisenhowerList.map((m) => (
                <div key={m.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedEisenhowerId(m.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${selectedEisenhowerId === m.id ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {ensureString(m.name, lang) || m.id}
                  </button>
                  {canCreate && resolveCanEdit(m) && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(t('delete_matrix_confirm'))) onDeleteEisenhower(m.id); setSelectedEisenhowerId((id) => (id === m.id ? (visibleEisenhowerList.find((x) => x.id !== m.id)?.id ?? null) : id)); }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {selectedEisenhower && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'q1', labelKey: 'eisenhower_do_first',  border: 'border-red-600',     bg: 'bg-red-950/20' },
              { key: 'q2', labelKey: 'eisenhower_schedule',   border: 'border-emerald-600', bg: 'bg-emerald-950/20' },
              { key: 'q3', labelKey: 'eisenhower_delegate',  border: 'border-amber-600',   bg: 'bg-amber-950/20' },
              { key: 'q4', labelKey: 'eisenhower_eliminate', border: 'border-slate-600',   bg: 'bg-slate-800/40' },
            ].map(({ key, labelKey, border, bg }) => (
              <div key={key} className={`border-2 ${border} ${bg} rounded-lg p-4`}>
                <div className="font-semibold text-sm mb-3">{t(labelKey)}</div>
                <div className="space-y-2">
                  {(eisenhowerData[key] || []).map((item) => {
                    const isEditing = editingEisenhowerItem?.key === key && editingEisenhowerItem?.id === item.id;
                    return (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <span className="text-slate-400 text-xs shrink-0">•</span>
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={item.text || ''}
                            autoFocus
                            className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-emerald-600 rounded text-xs text-slate-200"
                            onBlur={(e) => {
                              const v = e.target.value?.trim();
                              if (v !== undefined) {
                                setEisenhowerData((d) => ({
                                  ...d,
                                  [key]: (d[key] || []).map((i) => (i.id === item.id ? { ...i, text: v || i.text } : i)),
                                }));
                              }
                              setEditingEisenhowerItem(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                              if (e.key === 'Escape') setEditingEisenhowerItem(null);
                            }}
                          />
                        ) : (
                          <span
                            className="text-sm text-slate-200 flex-1 truncate cursor-pointer hover:text-emerald-300"
                            onClick={() => setEditingEisenhowerItem({ key, id: item.id })}
                            title={t('edit')}
                          >
                            {item.text || ''}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEisenhowerData((d) => ({
                            ...d,
                            [key]: (d[key] || []).filter((i) => i.id !== item.id),
                          }))}
                          className="text-red-400 text-xs opacity-0 group-hover:opacity-100 hover:underline shrink-0"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      placeholder={t('eisenhower_add_item')}
                      className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const v = e.target.value?.trim();
                        if (!v) return;
                        setEisenhowerData((d) => ({
                          ...d,
                          [key]: [...(d[key] || []), { id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: v }],
                        }));
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.target.closest('div').querySelector('input');
                        const v = input?.value?.trim();
                        if (!v) return;
                        setEisenhowerData((d) => ({
                          ...d,
                          [key]: [...(d[key] || []), { id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: v }],
                        }));
                        if (input) input.value = '';
                      }}
                      className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {t('eisenhower_urgent')} ↔ columns · {t('eisenhower_important')} ↔ rows
          </p>
          </>
          )}
          {visibleEisenhowerList.length === 0 && (
            <p className="text-xs text-slate-500 italic">{t('nothing_yet')}</p>
          )}
        </div>
      )}

      {/* ══════════ PUGH MATRIX ══════════ */}
      {toolTab === 'pugh' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_pugh" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          {canCreate && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600/60">
              <div className="text-xs font-medium text-slate-300 mb-3">{t('create_new')} Pugh</div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = (newPughName || '').trim() || t('pugh_new_matrix');
                  const id = await onCreatePugh({ name, categoryId: newPughCategoryId || null });
                  setNewPughName('');
                  setNewPughCategoryId('');
                  if (id) setSelectedPughId(id);
                }}
                className="flex flex-wrap gap-2 items-end"
              >
                <input
                  value={newPughName}
                  onChange={(e) => setNewPughName(e.target.value)}
                  placeholder={t('pugh_matrix_name_ph')}
                  className="min-w-[140px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                />
                <select
                  value={newPughCategoryId}
                  onChange={(e) => setNewPughCategoryId(e.target.value)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300"
                >
                  <option value="">{t('scope_global')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{t('scope_category')} {ensureString(c.name, lang)}</option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded">
                  {t('pugh_new_matrix')}
                </button>
              </form>
            </div>
          )}
          {visiblePughList.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {visiblePughList.map((m) => (
                <div key={m.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPughId(m.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${selectedPughId === m.id ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {ensureString(m.name, lang) || m.id}
                  </button>
                  {canCreate && resolveCanEdit(m) && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(t('delete_matrix_confirm'))) onDeletePugh(m.id); setSelectedPughId((id) => (id === m.id ? (visiblePughList.find((x) => x.id !== m.id)?.id ?? null) : id)); }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {selectedPugh && (
          <>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <button
              type="button"
              onClick={() => setPughData((d) => ({ ...d, criteria: [...(d.criteria || []), { id: `c-${Date.now()}`, name: '', weight: 10 }] }))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
            >
              {t('pugh_add_criterion')}
            </button>
            <button
              type="button"
              onClick={() => setPughData((d) => ({ ...d, alternatives: [...(d.alternatives || []), { id: `a-${Date.now()}`, name: '' }] }))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
            >
              {t('pugh_add_alternative')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-600 bg-slate-800/80">
              <thead>
                <tr className="border-b border-slate-600">
                  <th colSpan={2} className="px-3 py-2 text-left text-slate-400 border-r border-slate-600 align-top">
                    <span className="font-semibold">{t('pugh_issue')}:</span>
                    <input
                      type="text"
                      value={pughData.issue || ''}
                      onChange={(e) => setPughData((d) => ({ ...d, issue: e.target.value }))}
                      placeholder={t('pugh_issue')}
                      className="block w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </th>
                  <th className="border-r border-slate-600 py-2 w-14 bg-slate-900/50">
                    <span className="inline-block font-semibold text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minHeight: '4rem' }}>
                      {pughData.reference ? ensureString(pughData.reference, lang) : t('pugh_datum')}
                    </span>
                  </th>
                  {(pughData.alternatives || []).map((alt) => (
                    <th key={alt.id} className="border-r border-slate-600 py-2 w-14 min-w-[3rem] bg-slate-900/30 last:border-r-0">
                      <span className="inline-block text-slate-300 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minHeight: '4rem' }}>
                        {ensureString(alt.name, lang) || '—'}
                      </span>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-600 bg-slate-900/40">
                  <th className="px-2 py-1.5 text-left text-slate-500 font-semibold border-r border-slate-600 w-40">{t('pugh_criteria')}</th>
                  <th className="px-2 py-1.5 text-right text-slate-500 font-semibold border-r border-slate-600 w-14">{t('pugh_weight')}</th>
                  <th className="px-2 py-1.5 text-center text-slate-500 border-r border-slate-600 w-14">Datum</th>
                  {(pughData.alternatives || []).map((alt) => (
                    <th key={alt.id} className="px-2 py-1.5 border-r border-slate-600 last:border-r-0 min-w-[4rem]">
                      <input
                        type="text"
                        value={alt.name || ''}
                        onChange={(e) => setPughData((d) => ({
                          ...d,
                          alternatives: d.alternatives.map((a) => a.id === alt.id ? { ...a, name: e.target.value } : a),
                        }))}
                        placeholder={t('pugh_alternatives')}
                        className="w-full bg-transparent border-b border-slate-500 focus:outline-none focus:border-emerald-500 text-slate-200 text-center text-[11px]"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pughData.criteria || []).map((crit) => (
                  <tr key={crit.id} className="border-b border-slate-700/50">
                    <td className="px-2 py-1.5 border-r border-slate-600">
                      <input
                        type="text"
                        value={crit.name || ''}
                        onChange={(e) => setPughData((d) => ({
                          ...d,
                          criteria: d.criteria.map((c) => c.id === crit.id ? { ...c, name: e.target.value } : c),
                        }))}
                        placeholder={t('pugh_criteria')}
                        className="w-full bg-transparent border-b border-slate-600 focus:outline-none focus:border-emerald-500 text-slate-200"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right border-r border-slate-600">
                      <input
                        type="number"
                        min={0}
                        value={crit.weight ?? 10}
                        onChange={(e) => setPughData((d) => ({
                          ...d,
                          criteria: d.criteria.map((c) => c.id === crit.id ? { ...c, weight: Number(e.target.value) || 0 } : c),
                        }))}
                        className="w-12 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-right"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-500 border-r border-slate-600">0</td>
                    {(pughData.alternatives || []).map((alt) => {
                      const score = (pughData.scores || {})[crit.id]?.[alt.id] ?? null;
                      return (
                        <td key={alt.id} className="px-1 py-1.5 text-center border-r border-slate-600 last:border-r-0">
                          <select
                            value={score === null ? '' : String(score)}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              setPughData((d) => {
                                const scores = { ...(d.scores || {}), [crit.id]: { ...(d.scores || {})[crit.id], [alt.id]: v } };
                                return { ...d, scores };
                              });
                            }}
                            className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-slate-300 w-14"
                          >
                            <option value="">?</option>
                            <option value="1">+1</option>
                            <option value="0">0</option>
                            <option value="-1">−1</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(pughData.criteria || []).length === 0 && (
                  <tr>
                    <td colSpan={(pughData.alternatives || []).length + 3} className="px-3 py-4 text-slate-500 text-center">
                      {t('pugh_add_criterion')} / {t('pugh_add_alternative')}
                    </td>
                  </tr>
                )}
              </tbody>
              {(pughData.alternatives || []).length > 0 && (pughData.criteria || []).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-900/50">
                    <td className="px-2 py-2 font-semibold text-slate-300 border-r border-slate-600">{t('pugh_total')}</td>
                    <td className="px-2 py-2 border-r border-slate-600">—</td>
                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-600">—</td>
                    {(pughData.alternatives || []).map((alt) => {
                      const total = (pughData.criteria || []).reduce((sum, crit) => {
                        const s = (pughData.scores || {})[crit.id]?.[alt.id];
                        return sum + (s === null || s === undefined ? 0 : s);
                      }, 0);
                      return (
                        <td key={alt.id} className="px-2 py-2 text-center font-mono font-semibold text-slate-200 border-r border-slate-600 last:border-r-0">
                          {total > 0 ? `+${total}` : total}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-t border-slate-600 bg-slate-900/60">
                    <td className="px-2 py-2 font-semibold text-slate-300 border-r border-slate-600">{t('pugh_weighted_total')}</td>
                    <td className="px-2 py-2 border-r border-slate-600">—</td>
                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-600">—</td>
                    {(pughData.alternatives || []).map((alt) => {
                      const weighted = (pughData.criteria || []).reduce((sum, crit) => {
                        const s = (pughData.scores || {})[crit.id]?.[alt.id];
                        const w = crit.weight ?? 10;
                        return sum + (s === null || s === undefined ? 0 : s) * w;
                      }, 0);
                      return (
                        <td key={alt.id} className="px-2 py-2 text-center font-mono font-bold text-emerald-400 border-r border-slate-600 last:border-r-0">
                          {weighted}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="mt-2 flex gap-4 items-center">
            <label className="text-[11px] text-slate-500">{t('pugh_datum')} / {t('pugh_reference')}:</label>
            <input
              type="text"
              value={pughData.reference || ''}
              onChange={(e) => setPughData((d) => ({ ...d, reference: e.target.value }))}
              placeholder={t('pugh_reference')}
              className="flex-1 max-w-xs px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-slate-200"
            />
          </div>
          </>
          )}
          {!selectedPugh && visiblePughList.length === 0 && (
            <p className="text-slate-500 text-sm py-4">{t('pugh_no_matrices')}</p>
          )}
        </div>
      )}

      {/* ══════════ KANBAN ══════════ */}
      {toolTab === 'boards' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_kanban" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <BoardTypeSection
            boards={visibleBoards.filter((b) => !b.boardType || b.boardType === 'kanban')}
            boardType="kanban"
            defaultColumns={[
              { id: 'todo',       name: t('col_todo'),       cards: [] },
              { id: 'inprogress', name: t('col_inprogress'), cards: [] },
              { id: 'done',       name: t('col_done'),       cards: [] },
            ]}
            emptyText={t('no_kanban')}
            categories={categories}
            canCreate={canCreate}
            resolveCanEdit={resolveCanEdit}
            onCreateBoard={onCreateBoard}
            onUpdateBoard={onUpdateBoard}
            onDeleteBoard={onDeleteBoard}
            onCreateTask={onCreateTask}
            canAssignTask={canAssignTask}
            memberships={memberships}
            currentMembership={currentMembership}
            memberRole={memberRole}
          />
        </div>
      )}

      {/* ══════════ SCRUM ══════════ */}
      {toolTab === 'scrum' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_scrum" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <BoardTypeSection
            boards={visibleBoards.filter((b) => b.boardType === 'scrum')}
            boardType="scrum"
            defaultColumns={[
              { id: 'productbacklog', name: t('col_backlog'),    cards: [] },
              { id: 'sprintbacklog',  name: t('col_sprint'),     cards: [] },
              { id: 'inprogress',     name: t('col_inprogress'), cards: [] },
              { id: 'done',           name: t('col_done_check'), cards: [] },
            ]}
            emptyText={t('no_sprints')}
            placeholder={t('sprint_ph')}
            categories={categories}
            canCreate={canCreate}
            resolveCanEdit={resolveCanEdit}
            onCreateBoard={onCreateBoard}
            onUpdateBoard={onUpdateBoard}
            onDeleteBoard={onDeleteBoard}
            onCreateTask={onCreateTask}
            canAssignTask={canAssignTask}
            memberships={memberships}
            currentMembership={currentMembership}
            memberRole={memberRole}
          />
        </div>
      )}

      {/* ══════════ RETROSPECTIVE ══════════ */}
      {toolTab === 'retro' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_retro" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <BoardTypeSection
            boards={visibleBoards.filter((b) => b.boardType === 'retro')}
            boardType="retro"
            defaultColumns={[
              { id: 'wentwell', name: t('col_went_well'), cards: [] },
              { id: 'improve',  name: t('col_improve'),   cards: [] },
              { id: 'actions',  name: t('col_actions'),   cards: [] },
            ]}
            emptyText={t('no_retros')}
            placeholder={t('retro_ph')}
            categories={categories}
            canCreate={canCreate}
            resolveCanEdit={resolveCanEdit}
            onCreateBoard={onCreateBoard}
            onUpdateBoard={onUpdateBoard}
            onDeleteBoard={onDeleteBoard}
          />
        </div>
      )}

      {/* ══════════ MEETING NOTES ══════════ */}
      {toolTab === 'meetings' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_meetings" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <MeetingsSection
            meetings={visibleMeetings}
            categories={categories}
            canCreate={canCreate}
            resolveCanEdit={resolveCanEdit}
            onCreateMeeting={onCreateMeeting}
            onUpdateMeeting={onUpdateMeeting}
            onDeleteMeeting={onDeleteMeeting}
          />
        </div>
      )}

      {/* ══════════ GOALS / OKRs ══════════ */}
      {toolTab === 'goals' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_goals" />
          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />
          <GoalsSection
            goals={visibleGoals}
            categories={categories}
            canCreate={canCreate}
            resolveCanEdit={resolveCanEdit}
            onCreateGoal={onCreateGoal}
            onUpdateGoal={onUpdateGoal}
            onDeleteGoal={onDeleteGoal}
          />
        </div>
      )}
    </div>
  );
}
