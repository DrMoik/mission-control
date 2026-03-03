// ─── MeritsView ───────────────────────────────────────────────────────────────
// Three panels:
//  1. Define a new merit (admin/leader)
//  2. Merit definitions grid — clickable cards open the long-description popup
//  3. Award form (leader +)
//  4. Audit log with edit/revoke (platformAdmin)

import React, { useState } from 'react';
import LangContext              from '../i18n/LangContext.js';
import { MERIT_ICONS, ASSIGNABLE_BY_OPTIONS } from '../constants.js';
import { tsToDate, getL, fillL, ensureString } from '../utils.js';
import ImageCropModal           from '../components/ImageCropModal.jsx';
import { BilingualField }       from '../components/ui/index.js';

/**
 * @param {{
 *   merits, categories, memberships, meritEvents,
 *   canEdit, canAward, currentMembership, memberRole, isPlatformAdmin,
 *   onCreateMerit, onDeleteMerit, onAwardMerit, onRevokeMerit, onEditMeritEvent, onViewProfile
 * }} props
 */
export default function MeritsView({
  merits, categories, memberships, meritEvents, userProfile,
  canEdit, canAward, currentMembership, memberRole, isPlatformAdmin,
  onCreateMerit, onDeleteMerit, onAwardMerit, onRevokeMerit, onEditMeritEvent, onViewProfile,
}) {
  const { t, lang } = React.useContext(LangContext);

  const [meritForm, setMeritForm] = useState({
    name: '', points: 100, categoryId: '', logo: '🏆', assignableBy: 'leader',
    shortDescription: { en: '', es: '' },
    longDescription:  { en: '', es: '' },
  });
  const [detailMerit,     setDetailMerit]     = useState(null);  // merit shown in popup
  const [showIconPicker,  setShowIconPicker]  = useState(false);
  const [cropSrc,         setCropSrc]         = useState(null);
  const [awardForm,       setAwardForm]       = useState({ membershipId: '', meritId: '', evidence: '' });
  const [editingEventId,  setEditingEventId]  = useState(null);
  const [editEventDraft,  setEditEventDraft]  = useState({ points: '', evidence: '' });

  const activeMembers = memberships.filter((m) => m.status === 'active');

  // Can current user assign this merit? (assignableBy must match memberRole; teamAdmin/facultyAdvisor can assign any)
  const canAssignMerit = (merit) => {
    if (!merit) return false;
    const allowed = merit.assignableBy || 'leader';
    if (memberRole === 'teamAdmin' || memberRole === 'facultyAdvisor') return true; // admins can assign any
    return memberRole === allowed;
  };

  const assignableMerits = merits.filter(canAssignMerit);

  const handleCreate = () => {
    if (!meritForm.name.trim())                             { alert(t('name') + ' required.');    return; }
    if (!meritForm.points || Number(meritForm.points) <= 0) { alert(t('points') + ' must be > 0.'); return; }
    onCreateMerit(
      meritForm.name.trim(), meritForm.points, meritForm.categoryId,
      meritForm.logo,
      fillL(meritForm.shortDescription),
      fillL(meritForm.longDescription),
      meritForm.assignableBy,
    );
    setMeritForm({
      name: '', points: 100, categoryId: '', logo: '🏆', assignableBy: 'leader',
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

      {/* ── Define merit form (admin / advisor) ── */}
      {canEdit && (
        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div className="text-xs text-slate-400">{t('define_merit')}</div>

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
                      ✂
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

            {/* Category */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('category')}</label>
              <select
                value={meritForm.categoryId}
                onChange={(e) => setMeritForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
              >
                <option value="">{t('global_category')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{ensureString(c.name)}</option>)}
              </select>
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

            <button onClick={handleCreate}
              className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded whitespace-nowrap self-end">
              {t('add_merit')}
            </button>
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
        <div className="text-xs text-slate-400 mb-3">{t('merit_definitions')}</div>
        {merits.length === 0 ? (
          <div className="text-xs text-slate-500">{t('no_merits')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {merits.map((m) => (
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
                    {m.categoryId && <span className="truncate">· {ensureString(categories.find((c) => c.id === m.categoryId)?.name)}</span>}
                    <span className="text-[10px] text-slate-500">· {t('assignable_by_' + (m.assignableBy || 'leader'))}</span>
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
            <div className="flex-1 min-w-[130px]">
              <label className="text-[11px] text-slate-500 block mb-1">{t('merit')}</label>
              <select
                value={awardForm.meritId}
                onChange={(e) => setAwardForm((f) => ({ ...f, meritId: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
              >
                <option value="">{t('select_merit')}</option>
                {assignableMerits.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.points} {t('pts_label')})</option>
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
              className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded">
              {t('award')}
            </button>
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
