// ─── MeritsView ───────────────────────────────────────────────────────────────
// Three panels:
//  1. Define a new merit (admin/leader)
//  2. Merit definitions grid — clickable cards open the long-description popup
//  3. Award form (leader +)
//  4. Audit log with edit/revoke (platformAdmin)

import React, { useState, useMemo, useEffect } from 'react';
import LangContext              from '../i18n/LangContext.js';
import { MERIT_ICONS, ASSIGNABLE_BY_OPTIONS, MERIT_ACHIEVEMENT_TYPES, MERIT_DOMAINS, MERIT_TIERS } from '../constants.js';
import { tsToDate, getL, fillL, ensureString } from '../utils.js';
import ImageCropModal           from '../components/ImageCropModal.jsx';
import { BilingualField } from '../components/ui/index.js';

/**
 * @param {{
 *   merits, categories, memberships, meritEvents,
 *   canEdit, canCreateMerit, canAward, currentMembership, memberRole, isPlatformAdmin,
 *   achievementTypes, domains,
 *   onCreateMerit, onDeleteMerit, onAwardMerit, onRevokeMerit, onEditMeritEvent, onViewProfile
 * }} props
 */
export default function MeritsView({
  merits, categories, memberships, meritEvents, userProfile,
  canEdit, canCreateMerit, canAward, currentMembership, memberRole, isPlatformAdmin,
  achievementTypes = MERIT_ACHIEVEMENT_TYPES, domains = MERIT_DOMAINS,
  teamTags, onSaveTeamMeritTags,
  onCreateMerit, onDeleteMerit, onAwardMerit, onRevokeMerit, onEditMeritEvent, onViewProfile,
}) {
  const { t, lang } = React.useContext(LangContext);

  // Leaders can only create for their area; pre-fill categoryId
  const leaderCategoryId = (memberRole === 'leader' && !isPlatformAdmin) ? currentMembership?.categoryId : null;
  const [meritForm, setMeritForm] = useState({
    name: '', points: 100, categoryId: leaderCategoryId || '', logo: '🏆', assignableBy: 'leader',
    tags: [], achievementTypes: [], domains: [], tier: '', repeatable: true,
    shortDescription: { en: '', es: '' },
    longDescription:  { en: '', es: '' },
  });
  useEffect(() => {
    if (leaderCategoryId) setMeritForm((f) => ({ ...f, categoryId: leaderCategoryId }));
  }, [leaderCategoryId]);

  // Inline edit of team types/domains (inside "Define a new merit")
  const [teamTagsTypesStr,   setTeamTagsTypesStr]   = useState(() => achievementTypes.join(', '));
  const [teamTagsDomainsStr, setTeamTagsDomainsStr] = useState(() => domains.join(', '));
  const [teamTagsSaving,     setTeamTagsSaving]     = useState(false);
  useEffect(() => {
    setTeamTagsTypesStr(achievementTypes.join(', '));
    setTeamTagsDomainsStr(domains.join(', '));
  }, [achievementTypes, domains]);
  const parseList = (s) => (s || '').split(/[,\n]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const handleSaveTeamTags = async () => {
    if (!onSaveTeamMeritTags) return;
    const typesArr = parseList(teamTagsTypesStr);
    const domainsArr = parseList(teamTagsDomainsStr);
    if (typesArr.length === 0 || domainsArr.length === 0) {
      alert(t('platform_config_min_one') || 'Cada lista debe tener al menos un valor.');
      return;
    }
    setTeamTagsSaving(true);
    await onSaveTeamMeritTags(typesArr, domainsArr);
    setTeamTagsSaving(false);
  };
  const resetTeamTagsToDefaults = () => {
    setTeamTagsTypesStr(MERIT_ACHIEVEMENT_TYPES.join(', '));
    setTeamTagsDomainsStr(MERIT_DOMAINS.join(', '));
  };

  const [detailMerit,     setDetailMerit]     = useState(null);  // merit shown in popup
  const [showIconPicker,  setShowIconPicker]  = useState(false);
  const [cropSrc,         setCropSrc]         = useState(null);
  const [awardForm,       setAwardForm]       = useState({ membershipId: '', meritId: '', evidence: '' });
  const [meritSearch,        setMeritSearch]        = useState('');
  const [meritScopeFilter,   setMeritScopeFilter]   = useState(''); // '' = all, 'global' = global only, categoryId = that category
  const [meritTypeFilters,   setMeritTypeFilters]   = useState([]); // multi-select
  const [meritDomainFilters, setMeritDomainFilters] = useState([]);
  const [meritTierFilter,    setMeritTierFilter]    = useState('');
  const [gridSearch,         setGridSearch]         = useState('');
  const [gridScopeFilter,    setGridScopeFilter]    = useState('');
  const [gridTypeFilters,    setGridTypeFilters]    = useState([]);
  const [gridDomainFilters,   setGridDomainFilters]  = useState([]);
  const [gridTierFilter,     setGridTierFilter]     = useState('');
  const [gridFilterOpenTipo,  setGridFilterOpenTipo]  = useState(false);
  const [gridFilterOpenCategoria, setGridFilterOpenCategoria] = useState(false);
  const [gridFilterOpenNivel, setGridFilterOpenNivel] = useState(false);
  const [awardFilterOpenTipo, setAwardFilterOpenTipo] = useState(false);
  const [awardFilterOpenCategoria, setAwardFilterOpenCategoria] = useState(false);
  const [awardFilterOpenNivel, setAwardFilterOpenNivel] = useState(false);
  const [editingEventId,  setEditingEventId]  = useState(null);
  const [editEventDraft,  setEditEventDraft]  = useState({ points: '', evidence: '' });

  const activeMembers = memberships.filter((m) => m.status === 'active');

  // Assignable merits: teamAdmin/facultyAdvisor see all; leaders see global + their category only
  const assignableMerits = useMemo(() => {
    return merits.filter((m) => {
      const allowed = m.assignableBy || 'leader';
      if (memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor') return true;
      if (memberRole !== allowed) return false;
      if (memberRole === 'leader' && currentMembership?.categoryId && !isPlatformAdmin) {
        return !m.categoryId || m.categoryId === currentMembership.categoryId;
      }
      return true;
    });
  }, [merits, memberRole, currentMembership?.categoryId, isPlatformAdmin]);

  // Filtered merits for award form (search, scope, types, domains, tier, tags)
  const filteredAwardMerits = useMemo(() => {
    let list = assignableMerits;
    const q = (meritSearch || '').toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const short = (getL(m.shortDescription, lang) || '').toLowerCase();
        const tags = (m.tags || []).join(' ').toLowerCase();
        const types = (m.achievementTypes || []).join(' ').toLowerCase();
        const domains = (m.domains || []).join(' ').toLowerCase();
        return name.includes(q) || short.includes(q) || tags.includes(q) || types.includes(q) || domains.includes(q);
      });
    }
    if (meritScopeFilter) {
      if (meritScopeFilter === 'global') list = list.filter((m) => !m.categoryId);
      else list = list.filter((m) => m.categoryId === meritScopeFilter);
    }
    if (meritTypeFilters.length > 0) {
      list = list.filter((m) => (m.achievementTypes || []).some((t) => meritTypeFilters.includes(t)));
    }
    if (meritDomainFilters.length > 0) {
      list = list.filter((m) => (m.domains || []).some((d) => meritDomainFilters.includes(d)));
    }
    if (meritTierFilter) {
      list = list.filter((m) => (m.tier || '') === meritTierFilter);
    }
    return list;
  }, [assignableMerits, meritSearch, meritScopeFilter, meritTypeFilters, meritDomainFilters, meritTierFilter, lang]);

  // Filtered merits for definitions grid
  const filteredGridMerits = useMemo(() => {
    let list = merits;
    const q = (gridSearch || '').toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const short = (getL(m.shortDescription, lang) || '').toLowerCase();
        const tags = (m.tags || []).join(' ').toLowerCase();
        const types = (m.achievementTypes || []).join(' ').toLowerCase();
        const domains = (m.domains || []).join(' ').toLowerCase();
        return name.includes(q) || short.includes(q) || tags.includes(q) || types.includes(q) || domains.includes(q);
      });
    }
    if (gridScopeFilter) {
      if (gridScopeFilter === 'global') list = list.filter((m) => !m.categoryId);
      else list = list.filter((m) => m.categoryId === gridScopeFilter);
    }
    if (gridTypeFilters.length > 0) {
      list = list.filter((m) => (m.achievementTypes || []).some((t) => gridTypeFilters.includes(t)));
    }
    if (gridDomainFilters.length > 0) {
      list = list.filter((m) => (m.domains || []).some((d) => gridDomainFilters.includes(d)));
    }
    if (gridTierFilter) {
      list = list.filter((m) => (m.tier || '') === gridTierFilter);
    }
    return list;
  }, [merits, gridSearch, gridScopeFilter, gridTypeFilters, gridDomainFilters, gridTierFilter, lang]);

  const handleCreate = () => {
    if (!meritForm.name.trim())                             { alert(t('name') + ' required.');    return; }
    if (!meritForm.points || Number(meritForm.points) <= 0) { alert(t('points') + ' must be > 0.'); return; }
    onCreateMerit(
      meritForm.name.trim(), meritForm.points, meritForm.categoryId,
      meritForm.logo,
      fillL(meritForm.shortDescription),
      fillL(meritForm.longDescription),
      meritForm.assignableBy,
      meritForm.tags || [],
      meritForm.achievementTypes || [],
      meritForm.domains || [],
      meritForm.tier || null,
      meritForm.repeatable !== false,
    );
    setMeritForm({
      name: '', points: 100, categoryId: leaderCategoryId || '', logo: '🏆', assignableBy: 'leader',
      tags: [], achievementTypes: [], domains: [], tier: '', repeatable: true,
      shortDescription: { en: '', es: '' },
      longDescription:  { en: '', es: '' },
    });
    setShowIconPicker(false);
  };

  const handleAward = () => {
    if (!awardForm.membershipId || !awardForm.meritId) return;
    onAwardMerit(awardForm.membershipId, awardForm.meritId, awardForm.evidence);
    setAwardForm({ membershipId: '', meritId: '', evidence: '' });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">{t('merits_title')}</h2>

      {/* Crop modal — rendered outside the form row so it cannot block click events */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onApply={(dataUrl) => { setMeritForm((f) => ({ ...f, logo: dataUrl })); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── Define merit form (admin / leader for their area) ── */}
      {canCreateMerit && (
        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div className="text-xs text-slate-400">{t('define_merit')}</div>

          {/* Edit team types/domains (admin only) — inside this section */}
          {(canEdit || isPlatformAdmin) && onSaveTeamMeritTags && (
            <div className="border-t border-slate-700 pt-3 space-y-2">
              <p className="text-[11px] text-slate-500 font-medium">{t('team_config_tags') || 'Tipos y categorías disponibles para este equipo'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('merit_attr_types')}</label>
                  <textarea
                    value={teamTagsTypesStr}
                    onChange={(e) => setTeamTagsTypesStr(e.target.value)}
                    rows={2}
                    placeholder="technical, leadership, ..."
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('merit_attr_domains')}</label>
                  <textarea
                    value={teamTagsDomainsStr}
                    onChange={(e) => setTeamTagsDomainsStr(e.target.value)}
                    rows={2}
                    placeholder="software, hardware, ..."
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveTeamTags} disabled={teamTagsSaving}
                  className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded hover:bg-emerald-400 disabled:opacity-50">
                  {teamTagsSaving ? '…' : t('save')}
                </button>
                <button type="button" onClick={resetTeamTagsToDefaults}
                  className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded hover:bg-slate-500">
                  {t('platform_config_reset') || 'Reset'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-end">
            {/* Logo picker */}
            <div className="shrink-0 min-w-[180px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('logo')}</label>
              <div className="flex items-start gap-2">
                {/* Preview square */}
                <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  {meritForm.logo?.startsWith('http') || meritForm.logo?.startsWith('data:') ? (
                    <img src={meritForm.logo} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-2xl">{meritForm.logo || '🏆'}</span>
                  )}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  {/* Emoji picker button */}
                  <div className="relative">
                    <button type="button" onClick={() => setShowIconPicker((s) => !s)}
                      className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-300 rounded transition-colors w-full text-left">
                      {t('pick_emoji')}
                    </button>
                    {showIconPicker && (
                      <div className="absolute top-9 left-0 z-20 bg-slate-900 border border-slate-600 rounded-lg p-2 w-64 shadow-xl max-h-48 overflow-y-auto">
                        <div className="grid grid-cols-8 gap-0.5">
                          {MERIT_ICONS.map((icon) => (
                            <button key={icon} type="button"
                              onClick={() => { setMeritForm((f) => ({ ...f, logo: icon })); setShowIconPicker(false); }}
                              className={`text-base p-1 rounded hover:bg-slate-700 transition-colors ${meritForm.logo === icon ? 'ring-1 ring-emerald-500 bg-slate-700' : ''}`}>
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* URL input + scissors reframe button */}
                  <div className="flex gap-1">
                    <input
                      placeholder={t('paste_image_url')}
                      value={meritForm.logo?.startsWith('http') ? meritForm.logo : ''}
                      className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[11px]"
                      onChange={(e) => setMeritForm((f) => ({ ...f, logo: e.target.value || '🏆' }))}
                    />
                    <button type="button"
                      disabled={!(meritForm.logo?.startsWith('http') || meritForm.logo?.startsWith('data:'))}
                      onClick={() => { setCropSrc(meritForm.logo); setShowIconPicker(false); }}
                      title="Reframe Image"
                      className="w-8 h-[26px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-semibold rounded transition-colors shrink-0">
                      ⟳
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('name')}</label>
              <input
                value={meritForm.name}
                onChange={(e) => setMeritForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Build Champion"
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
              />
            </div>

            {/* Points */}
            <div className="w-20">
              <label className="text-[11px] text-slate-500 block mb-1">{t('points')}</label>
              <input type="number" min="1"
                value={meritForm.points}
                onChange={(e) => setMeritForm((f) => ({ ...f, points: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
              />
            </div>

            {/* Category — leaders restricted to their area only */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('category')}</label>
              {leaderCategoryId ? (
                <div className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
                  {ensureString(categories.find((c) => c.id === leaderCategoryId)?.name) || t('category')}
                </div>
              ) : (
                <select
                  value={meritForm.categoryId}
                  onChange={(e) => setMeritForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                >
                  <option value="">{t('global_category')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
                </select>
              )}
            </div>
            {/* Assignable by — who can award this logro */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('assignable_by')}</label>
              <select
                value={meritForm.assignableBy}
                onChange={(e) => setMeritForm((f) => ({ ...f, assignableBy: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
              >
                {ASSIGNABLE_BY_OPTIONS.map((r) => (
                  <option key={r} value={r}>{t('assignable_by_' + r)}</option>
                ))}
              </select>
            </div>

            {/* Repeatable — can this logro be awarded multiple times to the same member */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="merit-repeatable"
                checked={meritForm.repeatable !== false}
                onChange={(e) => setMeritForm((f) => ({ ...f, repeatable: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
              <label htmlFor="merit-repeatable" className="text-[11px] text-slate-400">{t('merit_repeatable')}</label>
            </div>

            <button onClick={handleCreate}
              className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded whitespace-nowrap self-end">
              {t('add_merit')}
            </button>
          </div>

          {/* Attributes for search/filter (500+ logros) */}
          <div className="space-y-2">
            <label className="text-[11px] text-slate-500 block">{t('merit_attr_types')}</label>
            <div className="flex flex-wrap gap-1">
              {achievementTypes.map((type) => {
                const sel = (meritForm.achievementTypes || []).includes(type);
                return (
                  <button key={type} type="button"
                    onClick={() => setMeritForm((f) => ({
                      ...f, achievementTypes: sel ? (f.achievementTypes || []).filter((t) => t !== type) : [...(f.achievementTypes || []), type],
                    }))}
                    className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'}`}>
                    {type}
                  </button>
                );
              })}
            </div>
            <label className="text-[11px] text-slate-500 block mt-2">{t('merit_attr_domains')}</label>
            <div className="flex flex-wrap gap-1">
              {domains.map((d) => {
                const sel = (meritForm.domains || []).includes(d);
                return (
                  <button key={d} type="button"
                    onClick={() => setMeritForm((f) => ({
                      ...f, domains: sel ? (f.domains || []).filter((x) => x !== d) : [...(f.domains || []), d],
                    }))}
                    className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
            <label className="text-[11px] text-slate-500 block mt-2">{t('merit_attr_tier')}</label>
            <div className="flex flex-wrap gap-1">
              <button type="button"
                onClick={() => setMeritForm((f) => ({ ...f, tier: '' }))}
                className={`text-[10px] px-2 py-0.5 rounded ${!meritForm.tier ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'}`}>
                —
              </button>
              {MERIT_TIERS.map((tier) => {
                const sel = meritForm.tier === tier;
                return (
                  <button key={tier} type="button"
                    onClick={() => setMeritForm((f) => ({ ...f, tier: sel ? '' : tier }))}
                    className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'}`}>
                    {t('merit_tier_' + tier)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bilingual description fields */}
          <BilingualField
            label={t('short_description')}
            value={meritForm.shortDescription}
            onChange={(v) => setMeritForm((f) => ({ ...f, shortDescription: v }))}
            maxLength={100}
            placeholder={{ en: t('short_desc_placeholder'), es: t('short_desc_placeholder') }}
          />
          <BilingualField
            label={t('long_description')}
            value={meritForm.longDescription}
            onChange={(v) => setMeritForm((f) => ({ ...f, longDescription: v }))}
            multiline
            rows={2}
            placeholder={{ en: t('long_desc_placeholder'), es: t('long_desc_placeholder') }}
          />
        </div>
      )}

      {/* ── Merit detail popup (long description) ── */}
      {detailMerit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setDetailMerit(null)}
        >
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 flex items-center gap-4">
              <div className="w-16 h-16 flex items-center justify-center bg-slate-700 rounded-xl overflow-hidden border border-slate-600 shrink-0">
                {detailMerit.logo && (detailMerit.logo.startsWith('http') || detailMerit.logo.startsWith('data:')) ? (
                  <img src={detailMerit.logo} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-4xl">{detailMerit.logo || '🏆'}</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight">{detailMerit.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono text-emerald-400 font-bold text-sm">{detailMerit.points} {t('pts_label')}</span>
                  {detailMerit.categoryId && (
                    <span className="text-xs text-slate-400">
                      · {ensureString(categories.find((c) => c.id === detailMerit.categoryId)?.name)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {getL(detailMerit.shortDescription, lang) && (
                <p className="text-sm text-slate-300 italic">{getL(detailMerit.shortDescription, lang)}</p>
              )}
              <div>
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('how_to_obtain')}</div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {getL(detailMerit.longDescription, lang) || t('no_long_desc')}
                </p>
              </div>
              <button
                onClick={() => setDetailMerit(null)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                {t('merit_detail_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merit definitions grid ── */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="space-y-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">{t('merit_definitions')}</span>
            <input
              type="search"
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              placeholder={t('merit_search_placeholder')}
              className="flex-1 min-w-[140px] px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[11px]"
            />
          </div>
          {merits.length > 5 && (
            <div className="flex flex-wrap gap-2">
              <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 w-full max-w-xs">
                <button type="button" onClick={() => setGridFilterOpenTipo((v) => !v)}
                  className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                  {t('merit_filter_type')} {gridTypeFilters.length > 0 && `(${gridTypeFilters.length})`}
                  <span className="text-slate-500">{gridFilterOpenTipo ? '▼' : '▶'}</span>
                </button>
                {gridFilterOpenTipo && (
                  <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700">
                    {achievementTypes.map((type) => {
                      const sel = gridTypeFilters.includes(type);
                      return (
                        <button key={type} type="button"
                          onClick={() => setGridTypeFilters(sel ? gridTypeFilters.filter((t) => t !== type) : [...gridTypeFilters, type])}
                          className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{type}</button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 w-full max-w-xs">
                <button type="button" onClick={() => setGridFilterOpenCategoria((v) => !v)}
                  className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                  {t('merit_filter_scope')} / {t('merit_filter_domain')}
                  {(gridScopeFilter || gridDomainFilters.length > 0) && ` (${(gridScopeFilter ? 1 : 0) + gridDomainFilters.length})`}
                  <span className="text-slate-500">{gridFilterOpenCategoria ? '▼' : '▶'}</span>
                </button>
                {gridFilterOpenCategoria && (
                  <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700 space-y-2">
                    <div className="w-full flex flex-wrap gap-1">
                      <button type="button" onClick={() => setGridScopeFilter('')}
                        className={`text-[10px] px-2 py-0.5 rounded ${!gridScopeFilter ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('merit_scope_all')}</button>
                      <button type="button" onClick={() => setGridScopeFilter('global')}
                        className={`text-[10px] px-2 py-0.5 rounded ${gridScopeFilter === 'global' ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('global_category')}</button>
                      {categories.map((c) => (
                        <button key={c.id} type="button" onClick={() => setGridScopeFilter(gridScopeFilter === c.id ? '' : c.id)}
                          className={`text-[10px] px-2 py-0.5 rounded ${gridScopeFilter === c.id ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{ensureString(c.name)}</button>
                      ))}
                    </div>
                    <div className="w-full flex flex-wrap gap-1">
                      {domains.map((d) => {
                        const sel = gridDomainFilters.includes(d);
                        return (
                          <button key={d} type="button"
                            onClick={() => setGridDomainFilters(sel ? gridDomainFilters.filter((x) => x !== d) : [...gridDomainFilters, d])}
                            className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{d}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 w-full max-w-xs">
                <button type="button" onClick={() => setGridFilterOpenNivel((v) => !v)}
                  className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                  {t('merit_filter_tier')} {gridTierFilter && `(${t('merit_tier_' + gridTierFilter)})`}
                  <span className="text-slate-500">{gridFilterOpenNivel ? '▼' : '▶'}</span>
                </button>
                {gridFilterOpenNivel && (
                  <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700">
                    <button type="button" onClick={() => setGridTierFilter('')}
                      className={`text-[10px] px-2 py-0.5 rounded ${!gridTierFilter ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>—</button>
                    {MERIT_TIERS.map((tier) => {
                      const sel = gridTierFilter === tier;
                      return (
                        <button key={tier} type="button"
                          onClick={() => setGridTierFilter(sel ? '' : tier)}
                          className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('merit_tier_' + tier)}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {merits.length === 0 ? (
          <div className="text-xs text-slate-500">{t('no_merits')}</div>
        ) : filteredGridMerits.length === 0 ? (
          <div className="text-xs text-slate-500">{t('no_merits_match')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredGridMerits.map((m) => (
              <button key={m.id} onClick={() => setDetailMerit(m)}
                className="flex items-center gap-3 p-3 bg-slate-700/40 hover:bg-slate-700/70 rounded-lg transition-colors text-left w-full group">
                <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-slate-700 rounded-xl overflow-hidden border border-slate-600">
                  {m.logo && (m.logo.startsWith('http') || m.logo.startsWith('data:')) ? (
                    <img src={m.logo} className="w-full h-full object-cover" alt={m.name} />
                  ) : (
                    <span className="text-3xl">{m.logo || '🏆'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate group-hover:text-emerald-300 transition-colors">{m.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono text-emerald-400 font-bold">{m.points} {t('pts_label')}</span>
                    {m.categoryId ? <span className="truncate">· {ensureString(categories.find((c) => c.id === m.categoryId)?.name)}</span> : <span>· {t('global_category')}</span>}
                    {(m.achievementTypes || []).length > 0 && <span>· {(m.achievementTypes || []).join(', ')}</span>}
                    {m.tier && <span>· {t('merit_tier_' + m.tier)}</span>}
                  </div>
                  {getL(m.shortDescription, lang) && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{getL(m.shortDescription, lang)}</p>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteMerit(m.id); }}
                    className="text-[11px] text-red-400 hover:text-red-300 underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {t('delete')}
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Award form ── */}
      {canAward && (
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-3">{t('award_merit')}</div>
          {assignableMerits.length === 0 && (
            <p className="text-xs text-amber-400/90 mb-3">{t('no_assignable_logros')}</p>
          )}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[130px]">
                <label className="text-[11px] text-slate-500 block mb-1">{t('member')}</label>
                <select
                  value={awardForm.membershipId}
                  onChange={(e) => setAwardForm((f) => ({ ...f, membershipId: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                >
                  <option value="">{t('select_member')}</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>{ensureString(m.displayName)} ({t('role_' + m.role) || m.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] text-slate-500 block mb-1">{t('evidence_optional')}</label>
                <input
                  value={awardForm.evidence}
                  onChange={(e) => setAwardForm((f) => ({ ...f, evidence: e.target.value }))}
                  placeholder={t('evidence_optional')}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                />
              </div>
              <button onClick={handleAward}
                disabled={!awardForm.membershipId || !awardForm.meritId}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold rounded">
                {t('award')}
              </button>
            </div>

            {/* Merit selector: search + filter chips + list */}
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{t('merit')}</label>
              <input
                type="search"
                value={meritSearch}
                onChange={(e) => setMeritSearch(e.target.value)}
                placeholder={t('merit_search_placeholder')}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs mb-2"
              />
              <div className="flex flex-wrap gap-2 mb-2">
                <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 max-w-xs">
                  <button type="button" onClick={() => setAwardFilterOpenTipo((v) => !v)}
                    className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    {t('merit_filter_type')} {meritTypeFilters.length > 0 && `(${meritTypeFilters.length})`}
                    <span className="text-slate-500">{awardFilterOpenTipo ? '▼' : '▶'}</span>
                  </button>
                  {awardFilterOpenTipo && (
                    <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700">
                      {achievementTypes.map((type) => {
                        const sel = meritTypeFilters.includes(type);
                        return (
                          <button key={type} type="button"
                            onClick={() => setMeritTypeFilters(sel ? meritTypeFilters.filter((t) => t !== type) : [...meritTypeFilters, type])}
                            className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{type}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 max-w-xs">
                  <button type="button" onClick={() => setAwardFilterOpenCategoria((v) => !v)}
                    className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    {t('merit_filter_scope')} / {t('merit_filter_domain')}
                    {(meritScopeFilter || meritDomainFilters.length > 0) && ` (${(meritScopeFilter ? 1 : 0) + meritDomainFilters.length})`}
                    <span className="text-slate-500">{awardFilterOpenCategoria ? '▼' : '▶'}</span>
                  </button>
                  {awardFilterOpenCategoria && (
                    <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700 space-y-2">
                      <div className="w-full flex flex-wrap gap-1">
                        <button type="button" onClick={() => setMeritScopeFilter('')}
                          className={`text-[10px] px-2 py-0.5 rounded ${!meritScopeFilter ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('merit_scope_all')}</button>
                        <button type="button" onClick={() => setMeritScopeFilter('global')}
                          className={`text-[10px] px-2 py-0.5 rounded ${meritScopeFilter === 'global' ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('global_category')}</button>
                        {categories.map((c) => (
                          <button key={c.id} type="button" onClick={() => setMeritScopeFilter(meritScopeFilter === c.id ? '' : c.id)}
                            className={`text-[10px] px-2 py-0.5 rounded ${meritScopeFilter === c.id ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{ensureString(c.name)}</button>
                        ))}
                      </div>
                      <div className="w-full flex flex-wrap gap-1">
                        {domains.map((d) => {
                          const sel = meritDomainFilters.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => setMeritDomainFilters(sel ? meritDomainFilters.filter((x) => x !== d) : [...meritDomainFilters, d])}
                              className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{d}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="border border-slate-600 rounded overflow-hidden bg-slate-900/50 max-w-xs">
                  <button type="button" onClick={() => setAwardFilterOpenNivel((v) => !v)}
                    className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    {t('merit_filter_tier')} {meritTierFilter && `(${t('merit_tier_' + meritTierFilter)})`}
                    <span className="text-slate-500">{awardFilterOpenNivel ? '▼' : '▶'}</span>
                  </button>
                  {awardFilterOpenNivel && (
                    <div className="px-2 pb-2 pt-0 flex flex-wrap gap-1 border-t border-slate-700">
                      <button type="button" onClick={() => setMeritTierFilter('')}
                        className={`text-[10px] px-2 py-0.5 rounded ${!meritTierFilter ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>—</button>
                      {MERIT_TIERS.map((tier) => {
                        const sel = meritTierFilter === tier;
                        return (
                          <button key={tier} type="button"
                            onClick={() => setMeritTierFilter(sel ? '' : tier)}
                            className={`text-[10px] px-2 py-0.5 rounded ${sel ? 'bg-emerald-600/50 border border-emerald-500' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'}`}>{t('merit_tier_' + tier)}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-600 rounded bg-slate-900/60">
                {filteredAwardMerits.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-500">{t('no_merits_match')}</p>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {filteredAwardMerits.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAwardForm((f) => ({ ...f, meritId: m.id }))}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/50 transition-colors ${awardForm.meritId === m.id ? 'bg-emerald-900/40 border-l-2 border-emerald-500' : ''}`}
                      >
                        <span className="text-lg shrink-0">{m.logo && !m.logo.startsWith('http') ? m.logo : '🏆'}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{m.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {m.points} {t('pts_label')}
                            {m.categoryId ? ` · ${ensureString(categories.find((c) => c.id === m.categoryId)?.name)}` : ` · ${t('global_category')}`}
                            {(m.achievementTypes || []).length > 0 && ` · ${(m.achievementTypes || []).join(', ')}`}
                            {m.tier && ` · ${t('merit_tier_' + m.tier)}`}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit log ── */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
          <span>{t('merit_audit_log')}</span>
          {isPlatformAdmin && <span className="text-amber-400">{t('platform_admin_editable')}</span>}
        </div>
        {meritEvents.length === 0 ? (
          <div className="p-4 text-xs text-slate-500">{t('no_events_yet')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-3 py-2">{t('th_when')}</th>
                  <th className="px-3 py-2">{t('th_member')}</th>
                  <th className="px-3 py-2">{t('merit')}</th>
                  <th className="px-3 py-2">{t('points')}</th>
                  <th className="px-3 py-2">{t('awarded_by')}</th>
                  <th className="px-3 py-2">{t('th_note')}</th>
                  <th className="px-3 py-2">{t('th_type')}</th>
                  {(canEdit || isPlatformAdmin) && <th className="px-3 py-2 w-0"></th>}
                </tr>
              </thead>
              <tbody>
                {meritEvents.map((evt) => {
                  const m       = memberships.find((mm) => mm.id === evt.membershipId);
                  const ts      = tsToDate(evt.createdAt);
                  const isEditing = editingEventId === evt.id;
                  return (
                    <tr key={evt.id} className="border-b border-slate-700 hover:bg-slate-700/20">
                      <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">{ts.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {m ? (
                          <button onClick={() => onViewProfile?.(m)} className="hover:underline text-left">{ensureString(m.displayName)}</button>
                        ) : '?'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {(() => { const merit = merits?.find((mm) => mm.id === evt.meritId); return merit?.logo ? <span className="text-base">{merit.logo}</span> : null; })()}
                          {evt.meritName || '?'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input type="number"
                            value={editEventDraft.points}
                            onChange={(e) => setEditEventDraft((d) => ({ ...d, points: e.target.value }))}
                            className="w-16 px-1.5 py-0.5 bg-slate-900 border border-amber-500 rounded text-xs font-mono text-center" />
                        ) : (
                          <span className={`font-mono font-bold ${evt.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {evt.points > 0 ? '+' : ''}{evt.points}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-[11px]">
                        {evt.awardedByName || (() => {
                          const uid = evt.awardedByUserId || evt.createdByUserId;
                          const m = memberships.find((mm) => mm.userId === uid);
                          return m ? ensureString(m.displayName) : '—';
                        })()}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate">
                        {isEditing ? (
                          <input
                            value={editEventDraft.evidence}
                            onChange={(e) => setEditEventDraft((d) => ({ ...d, evidence: e.target.value }))}
                            placeholder={t('note_ph')}
                            className="w-full px-1.5 py-0.5 bg-slate-900 border border-amber-500 rounded text-xs" />
                        ) : (
                          <span title={evt.evidence}>{evt.evidence || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize text-slate-400">{evt.type}</td>
                      {(canEdit || isPlatformAdmin) && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {isPlatformAdmin && (
                              isEditing ? (
                                <>
                                  <button
                                    onClick={() => {
                                      onEditMeritEvent(evt.id, { points: Number(editEventDraft.points), evidence: editEventDraft.evidence });
                                      setEditingEventId(null);
                                    }}
                                    className="text-[11px] text-amber-400 underline">
                                    {t('save')}
                                  </button>
                                  <button onClick={() => setEditingEventId(null)}
                                    className="text-[11px] text-slate-500 underline">{t('cancel')}</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setEditingEventId(evt.id); setEditEventDraft({ points: evt.points, evidence: evt.evidence || '' }); }}
                                  className="text-[11px] text-amber-400 underline">{t('edit')}</button>
                              )
                            )}
                            {canEdit && !isEditing && evt.type === 'award' && (
                              <button
                                onClick={() => { if (window.confirm(t('revoke_confirm'))) onRevokeMerit(evt.id); }}
                                className="text-[11px] text-red-400 underline">{t('revoke')}</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
