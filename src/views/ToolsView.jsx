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
import { getL, toL, fillL, ensureString } from '../utils.js';

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
        <span className="text-base">💡</span>
        <span className="font-semibold">{open ? '▼' : '▶'} {t('how_to_use') || 'How to use'}</span>
      </button>
      {open && (
        <p className="px-4 pb-3 text-slate-400 leading-relaxed">{t(descKey)}</p>
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
 *   teamBoards:        object[],
 *   teamMeetings:      object[],
 *   teamGoals:         object[],
 *   categories:        object[],
 *   currentMembership: object | null,
 *   memberRole:        string | null,
 *   canEdit:           boolean,           // admin-level
 *   canEditTools:      boolean,           // leader+ level (global tools)
 *   resolveCanEdit:    function(item): boolean,
 *   onCreateEvent, onDeleteEvent, onUpdateSwot,
 *   onCreateBoard, onUpdateBoard, onDeleteBoard,
 *   onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
 *   onCreateGoal, onUpdateGoal, onDeleteGoal,
 * }} props
 */
export default function ToolsView({
  team, teamEvents, teamBoards, teamMeetings, teamGoals,
  categories, currentMembership, memberRole, canEdit, canEditTools,
  resolveCanEdit,
  onCreateEvent, onDeleteEvent, onUpdateSwot,
  onCreateBoard,  onUpdateBoard,  onDeleteBoard,
  onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
  onCreateGoal,   onUpdateGoal,   onDeleteGoal,
}) {
  const { t, lang } = React.useContext(LangContext);

  const [toolTab,     setToolTab]     = useState('calendar');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [newEvent,    setNewEvent]    = useState({
    title:       { en: '', es: '' },
    date:        '',
    description: { en: '', es: '' },
    categoryId:  '',
  });
  const [editingSwot, setEditingSwot] = useState(false);
  const [swotDraft,   setSwotDraft]   = useState(null);

  const userCategoryId = currentMembership?.categoryId || null;
  const swot           = team?.swot || {};

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

  // Derived filtered collections
  const visibleEvents   = useMemo(() => filterItems(teamEvents),   [filterItems, teamEvents]);
  const visibleBoards   = useMemo(() => filterItems(teamBoards),   [filterItems, teamBoards]);
  const visibleMeetings = useMemo(() => filterItems(teamMeetings), [filterItems, teamMeetings]);
  const visibleGoals    = useMemo(() => filterItems(teamGoals),    [filterItems, teamGoals]);

  // Whether the current user can CREATE a new item (regardless of scope — permission
  // is re-checked per-item in the handler)
  const canCreate = canEditTools; // any leader+ can try; scope permission enforced server-side

  // ── SWOT helpers ───────────────────────────────────────────────────────────

  const startEditSwot = () => {
    // Normalise legacy plain-string text to bilingual objects
    const norm = (items) => (items || []).map((i) => ({ ...i, text: toL(i.text) }));
    setSwotDraft({
      strengths:     norm(swot.strengths),
      weaknesses:    norm(swot.weaknesses),
      opportunities: norm(swot.opportunities),
      threats:       norm(swot.threats),
    });
    setEditingSwot(true);
  };

  const addSwotItem    = (key)          => setSwotDraft((d) => ({ ...d, [key]: [...d[key], { id: `${Date.now()}`, text: { en: '', es: '' } }] }));
  const updateSwotItem = (key, id, val) => setSwotDraft((d) => ({ ...d, [key]: d[key].map((i) => (i.id === id ? { ...i, text: val } : i)) }));
  const removeSwotItem = (key, id)      => setSwotDraft((d) => ({ ...d, [key]: d[key].filter((i) => i.id !== id) }));

  const handleSaveSwot = async () => { await onUpdateSwot(swotDraft); setEditingSwot(false); };

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('team_tools_title')}</h2>

      {/* Tool tab bar */}
      <div className="flex gap-2 flex-wrap">
        {[
          ['calendar', t('tab_calendar')],
          ['swot',     t('tab_swot')],
          ['boards',   t('tab_kanban')],
          ['scrum',    t('tab_scrum')],
          ['retro',    t('tab_retro')],
          ['meetings', t('tab_meetings')],
          ['goals',    t('tab_goals')],
        ].map(([id, label]) => (
          <button key={id} onClick={() => { setToolTab(id); setScopeFilter('all'); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors
              ${toolTab === id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ CALENDAR ══════════ */}
      {toolTab === 'calendar' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_calendar" />

          <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
            categories={categories} userCategoryId={userCategoryId} canEdit={canEdit} />

          {canCreate && (
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
                  const canDelEvt = resolveCanEdit(evt);
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
                          {catName
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
                        <button onClick={() => onDeleteEvent(evt.id)} className="shrink-0 text-[11px] text-red-400 underline">
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SWOT (always global) ══════════ */}
      {toolTab === 'swot' && (
        <div className="space-y-4">
          <HowToUse descKey="tool_desc_swot" />
          {/* SWOT is always global */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-400">{t('swot_desc')}</p>
            {canEditTools && !editingSwot && (
              <button onClick={startEditSwot}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300">
                {t('edit_swot_btn')}
              </button>
            )}
            {editingSwot && (
              <div className="flex gap-2">
                <button onClick={() => setEditingSwot(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                <button onClick={handleSaveSwot} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
              </div>
            )}
          </div>
          {/* Last edited on SWOT */}
          {team?.lastEditedBy && !editingSwot && (
            <p className="text-[10px] text-slate-600">
              {t('last_edited_by')(team.lastEditedBy, team.lastEditedAt?.toDate?.().toLocaleDateString() ?? '')}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SWOT_META.map((q) => {
              const items = editingSwot ? (swotDraft?.[q.key] || []) : (swot[q.key] || []);
              return (
                <div key={q.key} className={`border-2 ${q.border} ${q.bg} rounded-lg p-4`}>
                  <div className="font-semibold text-sm mb-3">{t(q.labelKey)}</div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className="text-slate-400 mt-0.5 text-xs shrink-0">•</span>
                        {editingSwot ? (
                          <div className="flex-1 space-y-1">
                            <BilingualField
                              value={item.text}
                              onChange={(v) => updateSwotItem(q.key, item.id, v)}
                            />
                            <button onClick={() => removeSwotItem(q.key, item.id)}
                              className="text-red-400 text-xs underline">{t('delete')}</button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-200">{getL(item.text, lang)}</span>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && !editingSwot && (
                      <p className="text-xs text-slate-600 italic">{t('nothing_yet')}</p>
                    )}
                    {editingSwot && (
                      <button onClick={() => addSwotItem(q.key)} className="text-xs text-emerald-400 underline mt-1">
                        {t('add_item_btn')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
