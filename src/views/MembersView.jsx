// ─── MembersView ──────────────────────────────────────────────────────────────
// Lists all team members with filters and per-row admin actions.
// Also handles:
//  - Ghost / faculty profiles (no Firebase account required)
//  - Pending join request approvals
//  - Strike management and suspensions

import React, { useState, useMemo } from 'react';
import LangContext   from '../i18n/LangContext.js';
import { ROLE_ORDER, CAREER_OPTIONS } from '../constants.js';
import { RoleBadge, StrikePips, MemberAvatar } from '../components/ui/index.js';
import { ensureString } from '../utils.js';

/**
 * @param {{
 *   categories:           object[],
 *   memberships:          object[],
 *   canEdit:              boolean,
 *   isPlatformAdmin:      boolean,
 *   onUpdateRole:         function(membershipId, role) → Promise
 *   onAssignCategory:     function(membershipId, catId) → Promise
 *   onAddStrike:          function(membershipId) → Promise
 *   onRemoveStrike:       function(membershipId) → Promise
 *   onViewProfile:        function(membership)
 *   onCreateGhostMember:  function(data) → Promise
 *   onApproveMember:      function(membershipId) → Promise
 *   onRejectMember:       function(membershipId) → Promise
 * }} props
 */
export default function MembersView({
  categories, memberships, canEdit, isPlatformAdmin,
  careerOptions: careerOptionsProp,
  onUpdateRole, onAssignCategory, onAddStrike, onRemoveStrike,
  onViewProfile, onCreateGhostMember, onApproveMember, onRejectMember,
}) {
  const { t } = React.useContext(LangContext);
  const careerOptions = careerOptionsProp ?? CAREER_OPTIONS;

  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('');
  const [catFilter,     setCatFilter]     = useState('');
  const [skillFilter,   setSkillFilter]   = useState('');   // collaboration skill search
  const [showGhostForm, setShowGhostForm] = useState(false);
  const [ghostForm,     setGhostForm]     = useState({
    displayName: '', role: 'facultyAdvisor', categoryId: '', university: '', career: '', bio: '',
  });

  const pending   = memberships.filter((m) => m.status === 'pending');
  const active    = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');

  // Collect all unique skill tags across active members for the autocomplete list
  const allSkillTags = useMemo(() => {
    const set = new Set();
    const add = (t) => { const s = ensureString(t); if (s) set.add(s); };
    active.forEach((m) => {
      (m.lookingForHelpIn        || []).forEach(add);
      (m.iCanHelpWith            || []).forEach(add);
      (m.skillsToLearnThisSemester || []).forEach(add);
      (m.skillsICanTeach         || []).forEach(add);
    });
    return [...set].sort();
  }, [active]);

  // Apply search + filter to active members
  const filtered = active.filter((m) => {
    if (search     && !m.displayName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter)                                         return false;
    if (catFilter  && m.categoryId !== catFilter)                                   return false;
    if (skillFilter) {
      const sk = skillFilter.toLowerCase().trim();
      const allTags = [
        ...(m.lookingForHelpIn           || []),
        ...(m.iCanHelpWith               || []),
        ...(m.skillsToLearnThisSemester  || []),
        ...(m.skillsICanTeach            || []),
      ].map((t) => ensureString(t));
      if (!allTags.some((tag) => tag.toLowerCase().includes(sk))) return false;
    }
    return true;
  });

  // For each member, detect whether they can help someone who is looking for a specific skill
  // (only shown when a skill filter is active)
  const isMatch = (m) => {
    if (!skillFilter) return false;
    const sk = skillFilter.toLowerCase().trim();
    return (m.iCanHelpWith || []).some((tag) => ensureString(tag).toLowerCase().includes(sk)) ||
           (m.skillsICanTeach || []).some((tag) => ensureString(tag).toLowerCase().includes(sk));
  };

  const handleCreateGhost = async (e) => {
    e.preventDefault();
    await onCreateGhostMember(ghostForm);
    setGhostForm({ displayName: '', role: 'facultyAdvisor', categoryId: '', university: '', career: '', bio: '' });
    setShowGhostForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">{t('members_title')}</h2>
        {(canEdit || isPlatformAdmin) && (
          <button
            onClick={() => setShowGhostForm((s) => !s)}
            className="text-xs bg-purple-800 hover:bg-purple-700 text-purple-200 px-3 py-1.5 rounded font-semibold transition-colors"
          >
            {t('add_faculty_ghost')}
          </button>
        )}
      </div>

      {/* Ghost / faculty creation form */}
      {showGhostForm && (
        <form onSubmit={handleCreateGhost} className="bg-slate-800 rounded-lg p-4 space-y-3 border border-purple-800/50">
          <div className="text-xs text-purple-300 font-semibold">{t('new_ghost_form_title')}</div>
          <div className="flex flex-wrap gap-2">
            <input
              required
              value={ghostForm.displayName}
              onChange={(e) => setGhostForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder={t('full_name_req')}
              className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
            <select
              value={ghostForm.role}
              onChange={(e) => setGhostForm((f) => ({ ...f, role: e.target.value }))}
              className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
            >
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
            </select>
            <select
              value={ghostForm.categoryId}
              onChange={(e) => setGhostForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
            >
              <option value="">{t('no_category_opt')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={ghostForm.university}
              onChange={(e) => setGhostForm((f) => ({ ...f, university: e.target.value }))}
              placeholder={t('university')}
              className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm"
            />
            <select
              value={ghostForm.career}
              onChange={(e) => setGhostForm((f) => ({ ...f, career: e.target.value }))}
              className="flex-1 min-w-[140px] px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
            >
              {(careerOptions.includes('') ? careerOptions : ['', ...careerOptions]).map((o) => <option key={o || '_blank'} value={o}>{o || t('select_placeholder')}</option>)}
            </select>
          </div>
          <textarea
            rows={2}
            value={ghostForm.bio}
            onChange={(e) => setGhostForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder={t('brief_bio_ph')}
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowGhostForm(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
            <button type="submit" className="text-xs bg-purple-500 text-white font-semibold px-3 py-1.5 rounded">{t('create_profile_btn')}</button>
          </div>
        </form>
      )}

      {/* Pending join requests (only visible to admins) */}
      {canEdit && pending.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-600/30 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-amber-300">{t('pending_join_requests')} ({pending.length})</span>
          </div>
          <div className="divide-y divide-amber-900/40">
            {pending.map((m) => {
              const cat = categories.find((c) => c.id === m.categoryId);
              return (
                <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                  {m.photoURL ? (
                    <img src={m.photoURL} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                      {(m.displayName || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-100">{ensureString(m.displayName)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {t('wants_to_join')} <span className="text-slate-200">{ensureString(cat?.name) || t('no_cat_selected')}</span>
                    </div>
                    {m.motivation && <div className="text-[11px] text-slate-500 italic mt-0.5">"{m.motivation}"</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => onApproveMember(m.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded transition-colors">
                      {t('approve')}
                    </button>
                    <button onClick={() => onRejectMember(m.id)}
                      className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 text-[11px] font-semibold rounded transition-colors">
                      {t('reject')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search_name')}
          className="flex-1 min-w-[160px] px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
          <option value="">{t('all_roles')}</option>
          {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
          <option value="">{t('all_categories_opt')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
        </select>
        {(search || roleFilter || catFilter || skillFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setCatFilter(''); setSkillFilter(''); }}
            className="text-xs text-slate-400 underline"
          >
            {t('clear_filters')}
          </button>
        )}
      </div>

      {/* Collaboration / skill filter row */}
      {allSkillTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 shrink-0">{t('filter_collab')}:</span>
          <input
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            list="skill-tags-list"
            placeholder={t('collab_filter_ph')}
            className={`flex-1 min-w-[140px] px-2 py-1 bg-slate-800 border rounded text-xs transition-colors ${
              skillFilter ? 'border-emerald-600 text-emerald-200' : 'border-slate-600'
            }`}
          />
          <datalist id="skill-tags-list">
            {allSkillTags.map((tag) => <option key={tag} value={tag} />)}
          </datalist>
          {skillFilter && (
            <button onClick={() => setSkillFilter('')} className="text-[11px] text-slate-400 underline">
              {t('clear_skill_filter')}
            </button>
          )}
        </div>
      )}

      {/* Active members table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 text-xs text-slate-400 font-semibold">
          {t('showing_of')(filtered.length, active.length)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">{t('th_member')}</th>
                <th className="px-3 py-2">{t('th_role')}</th>
                <th className="px-3 py-2">{t('th_category')}</th>
                <th className="px-3 py-2">{t('th_strikes')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className={`border-b border-slate-700 hover:bg-slate-700/30 ${isMatch(m) ? 'bg-emerald-950/20' : ''}`}>
                  <td className="px-3 py-2">
                    <MemberAvatar membership={m} onViewProfile={onViewProfile} />
                    {m.ghost && <span className="text-[10px] text-purple-400 ml-1">{t('external_badge')}</span>}
                    {isMatch(m) && (
                      <span className="ml-1 text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-700/50">
                        {t('collab_match_hint')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateRole(m.id, e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs"
                      >
                        {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
                      </select>
                    ) : <RoleBadge role={m.role} />}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        value={m.categoryId || ''}
                        onChange={(e) => onAssignCategory(m.id, e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs"
                      >
                        <option value="">{t('unassigned')}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
                      </select>
                    ) : (ensureString(categories.find((c) => c.id === m.categoryId)?.name) || '—')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StrikePips count={m.strikes || 0} />
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => onAddStrike(m.id)}
                            className="text-[10px] text-red-400 border border-red-800 rounded px-1 hover:bg-red-900/30">
                            +
                          </button>
                          {(m.strikes || 0) > 0 && (
                            <button onClick={() => onRemoveStrike(m.id)}
                              className="text-[10px] text-slate-400 border border-slate-600 rounded px-1 hover:bg-slate-700">
                              −
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-slate-500 text-center">{t('no_members_filter')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspended members (admins only) */}
      {canEdit && suspended.length > 0 && (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 text-xs text-red-400 font-semibold">
            {t('suspended_header')(suspended.length)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-3 py-2">{t('th_member')}</th>
                  <th className="px-3 py-2">{t('th_strikes')}</th>
                  <th className="px-3 py-2">{t('th_action')}</th>
                </tr>
              </thead>
              <tbody>
                {suspended.map((m) => (
                  <tr key={m.id} className="border-b border-slate-700 opacity-60">
                    <td className="px-3 py-2">{ensureString(m.displayName)}</td>
                    <td className="px-3 py-2"><StrikePips count={m.strikes || 0} /></td>
                    <td className="px-3 py-2">
                      <button onClick={() => onRemoveStrike(m.id)} className="text-[11px] text-emerald-400 underline">
                        {t('reinstate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
