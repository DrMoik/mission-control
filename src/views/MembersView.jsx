// ─── MembersView ──────────────────────────────────────────────────────────────
// Lists all team members with filters and per-row admin actions.
// Also handles:
//  - Ghost / faculty profiles (no Firebase account required)
//  - Pending join request approvals
//  - Strike management and suspensions

import React, { useState, useMemo } from 'react';
import { ChevronDown, Users, UserPlus } from 'lucide-react';
import { t } from '../strings.js';
import { ROLE_ORDER, CAREER_OPTIONS } from '../constants.js';
import { RoleBadge, StrikePips, MemberAvatar } from '../components/ui/index.js';
import SafeProfileImage from '../components/ui/SafeProfileImage.jsx';
import AddStrikeModal from '../components/AddStrikeModal.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import { ensureString, tsToDate } from '../utils.js';

function StrikePipsWithEvidence({ member, canViewEvidence, onShowEvidence }) {
  const history = member?.strikeHistory || [];
  const count = member?.strikes || 0;
  const hasEvidence = canViewEvidence && history.length > 0;
  const summary = history.length > 0
    ? history.map((h, i) => {
        const parts = [];
        if (h.evidence?.text) parts.push(h.evidence.text.slice(0, 80) + (h.evidence.text.length > 80 ? '…' : ''));
        if (h.evidence?.link) parts.push(h.evidence.link);
        const date = h.createdAt?.toDate ? h.createdAt.toDate() : (h.createdAt ? tsToDate(h.createdAt) : null);
        const dateStr = date ? date.toLocaleDateString() : '';
        return `Falta ${i + 1}: ${parts.join(' ') || '—'} ${dateStr}`.trim();
      }).join('\n')
    : '';
  return (
    <span
      title={summary || undefined}
      className={`${hasEvidence ? 'cursor-pointer hover:opacity-80' : summary ? 'cursor-help' : ''}`}
      onClick={hasEvidence ? () => onShowEvidence?.(member) : undefined}
      role={hasEvidence ? 'button' : undefined}
    >
      <StrikePips count={count} />
    </span>
  );
}

const selectCls = 'bg-surface-sunken border border-slate-600 rounded-lg px-2 py-1 text-xs text-content-secondary focus:border-primary focus:outline-none';

export default function MembersView({
  categories, memberships, complaintsAgainstMember = [],
  canEdit, canStrike, canStrikeMember, canRemoveStrikeMember,
  isPlatformAdmin, careerOptions: careerOptionsProp,
  knowledgeAreas = [], skillDictionary = [],
  onUpdateRole, onAssignCategory, onAddStrike, onRemoveStrike,
  onViewProfile, onCreateGhostMember, onApproveMember, onRejectMember,
}) {
  const careerOptions = careerOptionsProp ?? CAREER_OPTIONS;

  const [search,           setSearch]           = useState('');
  const [roleFilter,       setRoleFilter]        = useState('');
  const [catFilter,        setCatFilter]         = useState('');
  const [strikesFilter,    setStrikesFilter]     = useState('');
  const [skillFilter,      setSkillFilter]       = useState('');
  const [complaintsFilter, setComplaintsFilter]  = useState('');
  const [sortBy,           setSortBy]            = useState('name');
  const [sortDir,          setSortDir]           = useState('asc');
  const [showGhostForm,    setShowGhostForm]     = useState(false);
  const [addStrikeMember,  setAddStrikeMember]   = useState(null);
  const [strikeEvidenceMember, setStrikeEvidenceMember] = useState(null);
  const [ghostForm,        setGhostForm]         = useState({
    displayName: '', role: 'facultyAdvisor', categoryId: '', university: '', career: '', bio: '',
  });

  const pending   = memberships.filter((m) => m.status === 'pending');
  const active    = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');

  const getSkillLabel = (id) => id.startsWith('proposed:') ? id.slice(9) : (skillDictionary.find((x) => x.id === id)?.label || knowledgeAreas.find((x) => x.id === id)?.name);

  const allSkillTags = useMemo(() => {
    const set = new Set();
    const add = (t) => { const s = ensureString(t); if (s) set.add(s); };
    active.forEach((m) => {
      (m.helpNeedsAreas || []).forEach((id) => { const lbl = getSkillLabel(id); if (lbl) set.add(lbl); });
      (m.helpOfferAreas || []).forEach((id) => { const lbl = getSkillLabel(id); if (lbl) set.add(lbl); });
      (m.learnAreas || []).forEach((id) => { const lbl = getSkillLabel(id); if (lbl) set.add(lbl); });
      (m.teachAreas || []).forEach((id) => { const lbl = getSkillLabel(id); if (lbl) set.add(lbl); });
      (m.lookingForHelpIn || []).forEach(add);
      (m.iCanHelpWith || []).forEach(add);
      (m.skillsToLearnThisSemester || []).forEach(add);
      (m.skillsICanTeach || []).forEach(add);
    });
    return [...set].sort();
  }, [active, knowledgeAreas, skillDictionary]);

  const filteredRaw = active.filter((m) => {
    if (search     && !m.displayName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter)                                         return false;
    if (catFilter  && m.categoryId !== catFilter)                                   return false;
    if (strikesFilter) {
      const s = m.strikes ?? 0;
      if (strikesFilter === '0' && s !== 0) return false;
      if (strikesFilter === '1' && s !== 1) return false;
      if (strikesFilter === '2' && s !== 2) return false;
      if (strikesFilter === '3' && s !== 3) return false;
    }
    if (skillFilter) {
      const sk = skillFilter.toLowerCase().trim();
      const areaNames = [
        ...(m.helpNeedsAreas || []),
        ...(m.helpOfferAreas || []),
        ...(m.learnAreas || []),
        ...(m.teachAreas || []),
      ].map((id) => getSkillLabel(id)).filter(Boolean);
      const legacyTags = [
        ...(m.lookingForHelpIn || []),
        ...(m.iCanHelpWith || []),
        ...(m.skillsToLearnThisSemester || []),
        ...(m.skillsICanTeach || []),
      ].map((t) => ensureString(t));
      const allTags = [...areaNames, ...legacyTags];
      if (!allTags.some((tag) => tag.toLowerCase().includes(sk))) return false;
    }
    if (complaintsFilter && canEdit) {
      const count = complaintsAgainstMember.filter((c) => c.targetMembershipId === m.id).length;
      if (complaintsFilter === 'none' && count > 0) return false;
      if (complaintsFilter === 'any' && count === 0) return false;
    }
    return true;
  });

  const filtered = useMemo(() => {
    const arr = [...filteredRaw];
    const cmp = (a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'name':
          va = (ensureString(a.displayName) || '').toLowerCase();
          vb = (ensureString(b.displayName) || '').toLowerCase();
          return va.localeCompare(vb);
        case 'role':
          va = ROLE_ORDER.indexOf(a.role);
          vb = ROLE_ORDER.indexOf(b.role);
          return (va < 0 ? 999 : va) - (vb < 0 ? 999 : vb);
        case 'category':
          va = ensureString(categories.find((c) => c.id === a.categoryId)?.name) || '';
          vb = ensureString(categories.find((c) => c.id === b.categoryId)?.name) || '';
          return va.localeCompare(vb);
        case 'strikes':
          va = a.strikes ?? 0;
          vb = b.strikes ?? 0;
          return va - vb;
        default:
          return 0;
      }
    };
    arr.sort((a, b) => (sortDir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    return arr;
  }, [filteredRaw, sortBy, sortDir, categories]);

  const toggleSort = (col) => {
    setSortBy(col);
    setSortDir((d) => (sortBy === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
  };
  const SortHeader = ({ col, label }) => (
    <button type="button" onClick={() => toggleSort(col)} className="text-left hover:text-content-primary transition-colors flex items-center gap-0.5">
      {label}
      {sortBy === col && <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />}
    </button>
  );

  const isMatch = (m) => {
    if (!skillFilter) return false;
    const sk = skillFilter.toLowerCase().trim();
    const areaNames = [...(m.helpOfferAreas || []), ...(m.teachAreas || [])]
      .map((id) => getSkillLabel(id))
      .filter(Boolean);
    const legacyHelp = (m.iCanHelpWith || []).concat(m.skillsICanTeach || []);
    return areaNames.some((n) => n.toLowerCase().includes(sk)) ||
           legacyHelp.some((tag) => ensureString(tag).toLowerCase().includes(sk));
  };

  const handleCreateGhost = async (e) => {
    e.preventDefault();
    await onCreateGhostMember(ghostForm);
    setGhostForm({ displayName: '', role: 'facultyAdvisor', categoryId: '', university: '', career: '', bio: '' });
    setShowGhostForm(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('members_title')}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{active.length} miembros activos · {suspended.length} suspendidos</p>
        </div>
        {(canEdit || isPlatformAdmin) && (
          <div className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowGhostForm((s) => !s)}
              className="border-purple-700/50 text-purple-300 hover:text-purple-200"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('add_faculty_ghost')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">Activos</div>
          <div className="text-2xl font-bold text-content-primary">{active.length}</div>
        </div>
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">Pendientes</div>
          <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">Áreas</div>
          <div className="text-2xl font-bold text-content-primary">{categories.length}</div>
        </div>
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 shadow-surface-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-1">Suspendidos</div>
          <div className="text-2xl font-bold text-red-400">{suspended.length}</div>
        </div>
      </div>

      {/* ── Ghost / faculty creation form ── */}
      {showGhostForm && (
        <form onSubmit={handleCreateGhost} className="rounded-xl border border-purple-800/50 bg-surface-raised shadow-surface-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <span className="text-sm font-semibold text-purple-300">{t('new_ghost_form_title')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input required value={ghostForm.displayName}
              onChange={(e) => setGhostForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder={t('full_name_req')} className="flex-1 min-w-[160px]" />
            <select value={ghostForm.role} onChange={(e) => setGhostForm((f) => ({ ...f, role: e.target.value }))} className={selectCls}>
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
            </select>
            <select value={ghostForm.categoryId} onChange={(e) => setGhostForm((f) => ({ ...f, categoryId: e.target.value }))} className={selectCls}>
              <option value="">{t('no_category_opt')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input value={ghostForm.university}
              onChange={(e) => setGhostForm((f) => ({ ...f, university: e.target.value }))}
              placeholder={t('university')} className="flex-1" />
            <select value={ghostForm.career} onChange={(e) => setGhostForm((f) => ({ ...f, career: e.target.value }))} className={`${selectCls} flex-1 min-w-[140px]`}>
              {(careerOptions.includes('') ? careerOptions : ['', ...careerOptions]).map((o) => <option key={o || '_blank'} value={o}>{o || t('select_placeholder')}</option>)}
            </select>
          </div>
          <Textarea rows={2} value={ghostForm.bio}
            onChange={(e) => setGhostForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder={t('brief_bio_ph')} className="resize-none" />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowGhostForm(false)}>{t('cancel')}</Button>
            <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">{t('create_profile_btn')}</Button>
          </div>
        </form>
      )}

      {/* ── Pending join requests ── */}
      {canEdit && pending.length > 0 && (
        <div className="rounded-xl border border-amber-600/40 bg-amber-950/30 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-600/30 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-amber-300">{t('pending_join_requests')} ({pending.length})</span>
          </div>
          <div className="divide-y divide-amber-900/30">
            {pending.map((m) => {
              const cat = categories.find((c) => c.id === m.categoryId);
              return (
                <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                  {m.photoURL ? (
                    <SafeProfileImage src={m.photoURL}
                      fallback={<div className="w-8 h-8 rounded-full bg-surface-overlay border border-slate-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 text-content-primary">{(m.displayName || '?')[0].toUpperCase()}</div>}
                      className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-overlay border border-slate-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 text-content-primary">
                      {(m.displayName || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-content-primary">{ensureString(m.displayName)}</div>
                    <div className="text-[11px] text-content-tertiary mt-0.5">
                      {t('wants_to_join')} <span className="text-content-secondary">{ensureString(cat?.name) || t('no_cat_selected')}</span>
                    </div>
                    {m.motivation && <div className="text-[11px] text-content-tertiary italic mt-0.5">"{m.motivation}"</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => onApproveMember(m.id)}>{t('approve')}</Button>
                    <Button variant="danger" size="sm" onClick={() => onRejectMember(m.id)}>{t('reject')}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-3 space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_name')} className="flex-1 min-w-[160px]" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
            <option value="">{t('all_roles')}</option>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
          </select>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={selectCls}>
            <option value="">{t('all_categories_opt')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
          </select>
          <select value={strikesFilter} onChange={(e) => setStrikesFilter(e.target.value)} className={selectCls}>
            <option value="">{t('all_strikes')}</option>
            <option value="0">{t('filter_strikes_0')}</option>
            <option value="1">{t('filter_strikes_1')}</option>
            <option value="2">{t('filter_strikes_2')}</option>
            <option value="3">{t('filter_strikes_3')}</option>
          </select>
          {canEdit && (
            <select value={complaintsFilter} onChange={(e) => setComplaintsFilter(e.target.value)} className={selectCls}>
              <option value="">{t('all_complaints')}</option>
              <option value="none">{t('filter_complaints_none')}</option>
              <option value="any">{t('filter_complaints_any')}</option>
            </select>
          )}
          {(search || roleFilter || catFilter || strikesFilter || skillFilter || complaintsFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setCatFilter(''); setStrikesFilter(''); setSkillFilter(''); setComplaintsFilter(''); }}
              className="text-xs text-content-tertiary hover:underline"
            >{t('clear_filters')}</button>
          )}
        </div>
        {allSkillTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-content-tertiary shrink-0">{t('filter_collab')}:</span>
            <input value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}
              list="skill-tags-list" placeholder={t('collab_filter_ph')}
              className={`flex-1 min-w-[140px] px-2 py-1 bg-surface-sunken border rounded-lg text-xs transition-colors focus:outline-none ${
                skillFilter ? 'border-primary text-primary' : 'border-slate-600 text-content-secondary'
              }`} />
            <datalist id="skill-tags-list">{allSkillTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
            {skillFilter && (
              <button onClick={() => setSkillFilter('')} className="text-[11px] text-content-tertiary hover:underline">{t('clear_skill_filter')}</button>
            )}
          </div>
        )}
      </div>

      {/* ── Active members table ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
          <Users className="w-4 h-4 text-content-tertiary" strokeWidth={1.5} />
          <span className="text-xs text-content-tertiary font-medium">{`${filtered.length} de ${active.length} miembros`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-content-tertiary border-b border-slate-700/40 bg-surface-sunken/30">
                <th className="px-3 py-2.5"><SortHeader col="name" label={t('th_member')} /></th>
                <th className="px-3 py-2.5"><SortHeader col="role" label={t('th_role')} /></th>
                <th className="px-3 py-2.5"><SortHeader col="category" label={t('th_category')} /></th>
                <th className="px-3 py-2.5"><SortHeader col="strikes" label={t('th_strikes')} /></th>
                {canEdit && <th className="px-3 py-2.5">{t('hr_complaints_count')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, mIndex) => (
                <tr key={m.id} className={`border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors animate-slide-up ${isMatch(m) ? 'bg-primary/5' : ''}`} style={{ animationDelay: `${Math.min(mIndex * 40, 300)}ms` }}>
                  <td className="px-3 py-2.5">
                    <MemberAvatar membership={m} onViewProfile={onViewProfile} />
                    {m.ghost && <span className="text-[10px] text-purple-400 ml-1">{t('external_badge')}</span>}
                    {isMatch(m) && (
                      <span className="ml-1 text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/30">
                        {t('collab_match_hint')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {canEdit ? (
                      <select value={m.role} onChange={(e) => onUpdateRole(m.id, e.target.value)} className={selectCls}>
                        {ROLE_ORDER.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
                      </select>
                    ) : <RoleBadge role={m.role} />}
                  </td>
                  <td className="px-3 py-2.5">
                    {canEdit ? (
                      <select value={m.categoryId || ''} onChange={(e) => onAssignCategory(m.id, e.target.value)} className={selectCls}>
                        <option value="">{t('unassigned')}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
                      </select>
                    ) : <span className="text-content-secondary">{ensureString(categories.find((c) => c.id === m.categoryId)?.name) || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StrikePipsWithEvidence member={m} canViewEvidence={canEdit || canStrike} onShowEvidence={setStrikeEvidenceMember} />
                      {(canStrikeMember ? canStrikeMember(m) : canEdit) && (
                        <div className="flex gap-1">
                          <button onClick={() => setAddStrikeMember({ id: m.id, displayName: ensureString(m.displayName) })}
                            className="text-[10px] text-red-400 border border-red-800/60 rounded px-1.5 hover:bg-red-900/30 transition-colors">+</button>
                          {(m.strikes || 0) > 0 && (canRemoveStrikeMember ? canRemoveStrikeMember(m) : canEdit) && (
                            <button onClick={() => onRemoveStrike(m.id)}
                              className="text-[10px] text-content-tertiary border border-slate-600/60 rounded px-1.5 hover:bg-surface-overlay transition-colors">−</button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5">
                      {(() => {
                        const count = complaintsAgainstMember.filter((c) => c.targetMembershipId === m.id).length;
                        return count > 0 ? (
                          <span className="text-amber-400 font-medium">{count}</span>
                        ) : (
                          <span className="text-content-tertiary">0</span>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-3 py-8 text-content-tertiary text-center">{t('no_members_filter')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Suspended members ── */}
      {(canEdit || canStrike) && suspended.length > 0 && (
        <div className="rounded-xl border border-red-900/40 bg-surface-raised shadow-surface-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/30 text-xs text-red-400 font-semibold">
            {`Suspendidos (${suspended.length}) — 3 faltas alcanzadas`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-content-tertiary border-b border-slate-700/40 bg-surface-sunken/30">
                  <th className="px-3 py-2.5">{t('th_member')}</th>
                  <th className="px-3 py-2.5">{t('th_strikes')}</th>
                  <th className="px-3 py-2.5">{t('th_action')}</th>
                </tr>
              </thead>
              <tbody>
                {suspended.map((m) => (
                  <tr key={m.id} className="border-b border-slate-700/40 opacity-60">
                    <td className="px-3 py-2.5 text-content-primary">{ensureString(m.displayName)}</td>
                    <td className="px-3 py-2.5">
                      <StrikePipsWithEvidence member={m} canViewEvidence={canEdit || canStrike} onShowEvidence={setStrikeEvidenceMember} />
                    </td>
                    <td className="px-3 py-2.5">
                      {(canRemoveStrikeMember ? canRemoveStrikeMember(m) : (canStrikeMember ? canStrikeMember(m) : canEdit)) && (
                        <button onClick={() => onRemoveStrike(m.id)} className="text-[11px] text-primary hover:underline">{t('reinstate')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addStrikeMember && (
        <AddStrikeModal
          memberName={addStrikeMember.displayName}
          onConfirm={(evidence) => onAddStrike(addStrikeMember.id, evidence)}
          onCancel={() => setAddStrikeMember(null)}
        />
      )}

      {strikeEvidenceMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setStrikeEvidenceMember(null)}>
          <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-md max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content-primary">
                {t('strike_evidence_title')} — {ensureString(strikeEvidenceMember.displayName)}
              </h3>
              <button onClick={() => setStrikeEvidenceMember(null)} className="text-content-tertiary hover:text-content-primary text-lg leading-none transition-colors">×</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              {(strikeEvidenceMember.strikeHistory || []).map((h, i) => {
                const date = h.createdAt?.toDate ? h.createdAt.toDate() : (h.createdAt ? tsToDate(h.createdAt) : null);
                const dateStr = date ? date.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
                return (
                  <div key={i} className="rounded-lg bg-surface-sunken/60 p-3 border border-slate-700/40">
                    <div className="text-[11px] text-content-tertiary mb-3">
                      {t('strike_evidence_strike')} {i + 1} · {dateStr}
                      {h.addedByName && ` · ${t('strike_evidence_added_by')}: ${h.addedByName}`}
                    </div>
                    {h.evidence?.text && <p className="text-xs text-content-primary whitespace-pre-wrap mb-2">{h.evidence.text}</p>}
                    {h.evidence?.link && (
                      <a href={h.evidence.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">{h.evidence.link}</a>
                    )}
                    {!h.evidence?.text && !h.evidence?.link && <p className="text-xs text-content-tertiary italic">—</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
