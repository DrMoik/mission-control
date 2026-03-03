// ─── ProfileModal ─────────────────────────────────────────────────────────────
// Full-screen overlay showing a member's profile.
// - View mode: displays cover photo, avatar, role, category, bio, hobbies.
// - Edit mode (canEditThis): allows updating all fields including photos.
// - Photo crop: uses ImageCropModal for both profile and cover photos.

import React, { useState } from 'react';
import LangContext        from '../i18n/LangContext.js';
import { CAREER_OPTIONS, SEMESTER_OPTIONS } from '../constants.js';
import { RoleBadge }     from './ui/index.js';
import ImageCropModal    from './ImageCropModal.jsx';

/**
 * @param {{
 *   membership:   object,   – membership document being viewed/edited
 *   categories:   object[], – all team categories for the category label
 *   canEditThis:  boolean,  – true if the current user may edit this profile
 *   onClose:      function,
 *   onSave:       function(membershipId, updates) → Promise
 * }} props
 */
export default function ProfileModal({ membership, categories, canEditThis, onClose, onSave }) {
  const { t } = React.useContext(LangContext);
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState({});
  // cropTarget: null | 'photoURL' | 'coverPhotoURL'
  const [cropTarget, setCropTarget] = useState(null);

  if (!membership) return null;

  const cat = categories.find((c) => c.id === membership.categoryId);

  const startEdit = () => {
    setDraft({
      displayName:   membership.displayName   || '',
      photoURL:      membership.photoURL      || '',
      coverPhotoURL: membership.coverPhotoURL || '',
      bio:           membership.bio           || '',
      hobbies:       membership.hobbies       || '',
      career:        membership.career        || '',
      semester:      membership.semester      || '',
      university:    membership.university    || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(membership.id, draft);
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover photo */}
        <div className="h-36 bg-gradient-to-r from-emerald-900 via-slate-800 to-slate-900 relative shrink-0">
          {(editing ? draft.coverPhotoURL : membership.coverPhotoURL) && (
            <img
              src={editing ? draft.coverPhotoURL : membership.coverPhotoURL}
              className="w-full h-full object-cover"
              alt=""
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-sm"
          >
            ✕
          </button>
          {/* Avatar — overlaps the cover bottom edge */}
          <div className="absolute -bottom-12 left-5">
            {(editing ? draft.photoURL : membership.photoURL) ? (
              <img
                src={editing ? draft.photoURL : membership.photoURL}
                className="w-24 h-24 rounded-full border-4 border-slate-900 object-cover"
                alt=""
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-slate-900 bg-slate-600 flex items-center justify-center text-3xl font-bold">
                {(membership.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="pt-16 px-5 pb-5 space-y-4">
          {editing ? (
            /* ── Edit form ── */
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {/* Display name */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('display_name')}</label>
                  <input
                    value={draft.displayName}
                    onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm"
                  />
                </div>

                {/* Profile photo URL + reframe */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('profile_photo_url')}</label>
                  <div className="flex gap-2 items-center">
                    {draft.photoURL ? (
                      <img src={draft.photoURL} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-600" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">?</div>
                    )}
                    <input
                      value={draft.photoURL}
                      onChange={(e) => setDraft((d) => ({ ...d, photoURL: e.target.value }))}
                      placeholder="https://…"
                      className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm"
                    />
                    <button
                      type="button"
                      disabled={!draft.photoURL}
                      onClick={() => setCropTarget('photoURL')}
                      className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded transition-colors whitespace-nowrap"
                    >
                      {t('reframe_profile')}
                    </button>
                  </div>
                </div>

                {/* Cover photo URL + reframe */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('cover_photo_url')}</label>
                  <div className="flex gap-2 items-center">
                    {draft.coverPhotoURL ? (
                      <img src={draft.coverPhotoURL} className="w-14 h-9 rounded object-cover shrink-0 border border-slate-600" alt="" />
                    ) : (
                      <div className="w-14 h-9 rounded shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-[10px]">{t('cover_photo')}</div>
                    )}
                    <input
                      value={draft.coverPhotoURL}
                      onChange={(e) => setDraft((d) => ({ ...d, coverPhotoURL: e.target.value }))}
                      placeholder="https://…"
                      className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm"
                    />
                    <button
                      type="button"
                      disabled={!draft.coverPhotoURL}
                      onClick={() => setCropTarget('coverPhotoURL')}
                      className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded transition-colors whitespace-nowrap"
                    >
                      {t('reframe_cover')}
                    </button>
                  </div>
                </div>
              </div>

              {/* University / Career / Semester */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('university')}</label>
                  <input
                    value={draft.university}
                    onChange={(e) => setDraft((d) => ({ ...d, university: e.target.value }))}
                    placeholder="e.g. Tec de Monterrey"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('career')}</label>
                  <select
                    value={draft.career}
                    onChange={(e) => setDraft((d) => ({ ...d, career: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                  >
                    {CAREER_OPTIONS.map((o) => <option key={o} value={o}>{o || t('select_placeholder')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('semester')}</label>
                  <select
                    value={draft.semester}
                    onChange={(e) => setDraft((d) => ({ ...d, semester: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
                  >
                    {SEMESTER_OPTIONS.map((o) => <option key={o} value={o}>{o || t('select_placeholder')}</option>)}
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('about_me')}</label>
                <textarea
                  rows={3}
                  value={draft.bio}
                  onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                  placeholder={t('tell_team_placeholder')}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm resize-none"
                />
              </div>

              {/* Hobbies */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('hobbies')}</label>
                <textarea
                  rows={2}
                  value={draft.hobbies}
                  onChange={(e) => setDraft((d) => ({ ...d, hobbies: e.target.value }))}
                  placeholder={t('hobbies_placeholder')}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                <button onClick={handleSave} className="text-xs bg-emerald-500 text-black font-semibold px-4 py-1.5 rounded">{t('save_profile')}</button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{membership.displayName}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <RoleBadge role={membership.role} />
                    {cat && <span className="text-xs text-slate-400">· {cat.name}</span>}
                    {membership.ghost && (
                      <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">{t('external_member')}</span>
                    )}
                  </div>
                </div>
                {canEditThis && (
                  <button onClick={startEdit} className="text-xs text-amber-400 underline shrink-0">{t('edit_profile')}</button>
                )}
              </div>

              {(membership.university || membership.career || membership.semester) && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-4 py-3">
                  {membership.university && <span>🎓 {membership.university}</span>}
                  {membership.career     && <span>💼 {membership.career}</span>}
                  {membership.semester   && <span>📅 {membership.semester} {t('semester_suffix')}</span>}
                </div>
              )}

              {membership.bio && (
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('about_label')}</div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{membership.bio}</p>
                </div>
              )}

              {membership.hobbies && (
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('hobbies')}</div>
                  <p className="text-sm text-slate-200 leading-relaxed">{membership.hobbies}</p>
                </div>
              )}

              {!membership.bio && !membership.hobbies && (
                <p className="text-xs text-slate-600 italic text-center py-4">{t('no_profile_info')}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Crop modals — rendered outside the scrollable panel so they always sit on top */}
      {cropTarget === 'photoURL' && (
        <ImageCropModal
          src={draft.photoURL}
          label="Reframe Profile Photo"
          cropWidth={400}
          cropHeight={400}
          onApply={(url) => { setDraft((d) => ({ ...d, photoURL: url })); setCropTarget(null); }}
          onCancel={() => setCropTarget(null)}
        />
      )}
      {cropTarget === 'coverPhotoURL' && (
        <ImageCropModal
          src={draft.coverPhotoURL}
          label="Reframe Cover Photo"
          cropWidth={960}
          cropHeight={320}
          onApply={(url) => { setDraft((d) => ({ ...d, coverPhotoURL: url })); setCropTarget(null); }}
          onCancel={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}
