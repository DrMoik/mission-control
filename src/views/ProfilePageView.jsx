// ─── ProfilePageView ──────────────────────────────────────────────────────────
// Full-page profile (no modal).  Renders the same content as ProfileModal
// but as the main content area.  Used for "Mi Perfil" and when viewing
// another member's profile from the members list.
//
// onBack: optional — when viewing another member, show a back button that calls this

import React, { useState, useEffect, useRef } from 'react';
import LangContext              from '../i18n/LangContext.js';
import { CAREER_OPTIONS, SEMESTER_OPTIONS } from '../constants.js';
import { RoleBadge, BilingualField, TagInput } from '../components/ui/index.js';
import ImageCropModal           from '../components/ImageCropModal.jsx';
import { getL, toL, fillL, ensureString } from '../utils.js';

const PERSONALITY_TAGS = [
  'ptag_creative', 'ptag_analytical', 'ptag_detail', 'ptag_bigpicture',
  'ptag_solver', 'ptag_collaborator', 'ptag_independent', 'ptag_mentor',
  'ptag_learner', 'ptag_builder', 'ptag_researcher',
];

function currentWeekMonday() {
  const d  = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().split('T')[0];
}

function isValidSongUrl(url) {
  if (!url) return true;
  return /spotify\.com|youtube\.com|youtu\.be|soundcloud\.com/.test(url);
}

function SectionHeading({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <span className="text-base">{icon}</span>
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</h4>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

function TagList({ tags, colorClass = 'bg-emerald-900/50 text-emerald-200 border-emerald-700/50', lang = 'es' }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {tags.map((tag, i) => {
        const str = ensureString(tag, lang);
        const key = typeof tag === 'string' ? tag : (str || `tag-${i}`);
        return (
          <span key={key} className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>{str}</span>
        );
      })}
    </div>
  );
}

// Auto-grow textarea: height expands with content
function AutoGrowTextarea({ value, onChange, placeholder, className, rows = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.max(ref.current.scrollHeight, rows * 24)}px`;
  }, [value, rows]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

// Auto-grow input: width expands with content (min 8ch)
function AutoGrowInput({ value, onChange, placeholder, className, ...rest }) {
  const len = (value || '').length;
  const w   = Math.max(12, Math.min(len + 2, 60));
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={{ minWidth: `${w}ch`, width: '100%' }}
      {...rest}
    />
  );
}

export default function ProfilePageView({
  membership, categories, canEditThis, onSave,
  weeklyStatuses = [], onSaveWeeklyStatus,
  onBack,
}) {
  const { t, lang } = React.useContext(LangContext);
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState({});
  const [cropTarget, setCropTarget] = useState(null);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyDraft,   setWeeklyDraft]   = useState({ advanced: '', failedAt: '', learned: '' });
  const [songUrlError,  setSongUrlError]  = useState('');

  if (!membership) return null;

  const cat     = categories.find((c) => c.id === membership.categoryId);
  const weekOf  = currentWeekMonday();
  const thisWeek = weeklyStatuses.find((s) => s.weekOf === weekOf);

  const startEdit = () => {
    const normTags = (arr) => (arr || []).map((t) => (typeof t === 'string' ? t : ensureString(t, lang)));
    setDraft({
      displayName:   membership.displayName   || '',
      photoURL:      membership.photoURL      || '',
      coverPhotoURL: membership.coverPhotoURL || '',
      bio:           toL(membership.bio),
      hobbies:       toL(membership.hobbies),
      career:        membership.career     || '',
      semester:      membership.semester   || '',
      university:    membership.university || '',
      currentObjective: toL(membership.currentObjective),
      currentChallenge: toL(membership.currentChallenge),
      lookingForHelpIn:          normTags(membership.lookingForHelpIn),
      iCanHelpWith:              normTags(membership.iCanHelpWith),
      skillsToLearnThisSemester: normTags(membership.skillsToLearnThisSemester),
      skillsICanTeach:           normTags(membership.skillsICanTeach),
      songOnRepeatTitle:  membership.songOnRepeatTitle  || '',
      songOnRepeatUrl:    membership.songOnRepeatUrl    || '',
      funFact:            toL(membership.funFact),
      personalityTag:     membership.personalityTag     || '',
    });
    setSongUrlError('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (draft.songOnRepeatUrl && !isValidSongUrl(draft.songOnRepeatUrl)) {
      setSongUrlError(t('invalid_song_url'));
      return;
    }
    setSongUrlError('');
    await onSave(membership.id, {
      ...draft,
      bio:              fillL(draft.bio),
      hobbies:          fillL(draft.hobbies),
      currentObjective: fillL(draft.currentObjective),
      currentChallenge: fillL(draft.currentChallenge),
      funFact:          fillL(draft.funFact),
      lookingForHelpIn:          (draft.lookingForHelpIn || []).map((t) => ensureString(t)),
      iCanHelpWith:              (draft.iCanHelpWith || []).map((t) => ensureString(t)),
      skillsToLearnThisSemester: (draft.skillsToLearnThisSemester || []).map((t) => ensureString(t)),
      skillsICanTeach:           (draft.skillsICanTeach || []).map((t) => ensureString(t)),
    });
    setEditing(false);
  };

  const startWeeklyEdit = () => {
    setWeeklyDraft({
      advanced: thisWeek?.advanced || '',
      failedAt: thisWeek?.failedAt || '',
      learned:  thisWeek?.learned  || '',
    });
    setEditingWeekly(true);
  };

  const handleSaveWeekly = async () => {
    await onSaveWeeklyStatus?.({
      membershipId: membership.id,
      weekOf,
      ...weeklyDraft,
    });
    setEditingWeekly(false);
  };

  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="w-full max-w-full min-h-[60vh]">
      {/* Back button when viewing another member */}
      {onBack && (
        <button onClick={onBack}
          className="mb-4 text-xs text-slate-400 hover:text-white flex items-center gap-1">
          ← {t('back')}
        </button>
      )}

      {/* Cover + avatar */}
      <div className="h-40 bg-gradient-to-r from-emerald-900 via-slate-800 to-slate-900 rounded-t-xl relative overflow-hidden">
        {(editing ? draft.coverPhotoURL : membership.coverPhotoURL) && (
          <img src={editing ? draft.coverPhotoURL : membership.coverPhotoURL}
            className="w-full h-full object-cover" alt="" />
        )}
        <div className="absolute -bottom-14 left-5">
          {(editing ? draft.photoURL : membership.photoURL) ? (
            <img src={editing ? draft.photoURL : membership.photoURL}
              className="w-28 h-28 rounded-full border-4 border-slate-900 object-cover" alt="" />
          ) : (
            <div className="w-28 h-28 rounded-full border-4 border-slate-900 bg-slate-600 flex items-center justify-center text-4xl font-bold">
              {(ensureString(membership.displayName, lang) || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="pt-16 px-4 sm:px-6 pb-8 bg-slate-800 rounded-b-xl -mt-px">

        {editing ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <span className="text-xs text-slate-400">{t('edit_profile')}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                <button onClick={handleSave} className="text-xs bg-emerald-500 text-black font-semibold px-4 py-1.5 rounded">{t('save_profile')}</button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('display_name')}</label>
              <AutoGrowInput value={draft.displayName} onChange={(v) => set('displayName', v)}
                className="w-full min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('profile_photo_url')}</label>
              <div className="flex gap-2 items-center flex-wrap">
                {draft.photoURL ? (
                  <img src={draft.photoURL} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-600" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">?</div>
                )}
                <input value={draft.photoURL} onChange={(e) => set('photoURL', e.target.value)}
                  placeholder="https://…" className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
                <button type="button" disabled={!draft.photoURL} onClick={() => setCropTarget('photoURL')}
                  className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded">
                  {t('reframe_profile')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('cover_photo_url')}</label>
              <div className="flex gap-2 items-center flex-wrap">
                {draft.coverPhotoURL ? (
                  <img src={draft.coverPhotoURL} className="w-14 h-9 rounded object-cover shrink-0 border border-slate-600" alt="" />
                ) : (
                  <div className="w-14 h-9 rounded shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-[10px]">{t('cover_photo')}</div>
                )}
                <input value={draft.coverPhotoURL} onChange={(e) => set('coverPhotoURL', e.target.value)}
                  placeholder="https://…" className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
                <button type="button" disabled={!draft.coverPhotoURL} onClick={() => setCropTarget('coverPhotoURL')}
                  className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded">
                  {t('reframe_cover')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('university')}</label>
                <AutoGrowInput value={draft.university} onChange={(v) => set('university', v)}
                  placeholder="e.g. Tec de Monterrey"
                  className="w-full min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('career')}</label>
                <select value={draft.career} onChange={(e) => set('career', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
                  {CAREER_OPTIONS.map((o) => <option key={o} value={o}>{o || t('select_placeholder')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('semester')}</label>
                <select value={draft.semester} onChange={(e) => set('semester', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
                  {SEMESTER_OPTIONS.map((o) => <option key={o} value={o}>{o || t('select_placeholder')}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">🎯 {t('section_mission')}</p>
              <BilingualField label={t('current_objective')} value={draft.currentObjective}
                onChange={(v) => set('currentObjective', v)} placeholder={{ en: t('objective_ph'), es: t('objective_ph') }} />
              <BilingualField label={t('current_challenge')} value={draft.currentChallenge}
                onChange={(v) => set('currentChallenge', v)} placeholder={{ en: t('challenge_ph'), es: t('challenge_ph') }} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">🤝 {t('section_collaboration')}</p>
              <TagInput label={t('looking_for_help_in')} value={draft.lookingForHelpIn} onChange={(v) => set('lookingForHelpIn', v)} placeholder={t('collab_tags_ph')} />
              <TagInput label={t('i_can_help_with')} value={draft.iCanHelpWith} onChange={(v) => set('iCanHelpWith', v)} placeholder={t('collab_tags_ph')} />
              <TagInput label={t('skills_to_learn')} value={draft.skillsToLearnThisSemester} onChange={(v) => set('skillsToLearnThisSemester', v)} placeholder={t('collab_tags_ph')} />
              <TagInput label={t('skills_i_can_teach')} value={draft.skillsICanTeach} onChange={(v) => set('skillsICanTeach', v)} placeholder={t('collab_tags_ph')} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">🎵 {t('section_culture')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('song_title_label')}</label>
                  <AutoGrowInput value={draft.songOnRepeatTitle} onChange={(v) => set('songOnRepeatTitle', v)}
                    placeholder={t('song_title_ph')}
                    className="w-full min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('song_url_label')}</label>
                  <input value={draft.songOnRepeatUrl}
                    onChange={(e) => { set('songOnRepeatUrl', e.target.value); setSongUrlError(''); }}
                    placeholder={t('song_url_ph')}
                    className={`w-full px-2 py-1.5 bg-slate-800 border rounded text-xs ${songUrlError ? 'border-red-500' : 'border-slate-600'}`} />
                  {songUrlError && <p className="text-[10px] text-red-400 mt-0.5">{songUrlError}</p>}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('personality_tag_label')}</label>
                <select value={draft.personalityTag} onChange={(e) => set('personalityTag', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
                  <option value="">{t('select_placeholder')}</option>
                  {PERSONALITY_TAGS.map((k) => <option key={k} value={k}>{t(k)}</option>)}
                </select>
              </div>
              <BilingualField label={t('fun_fact_label')} value={draft.funFact} onChange={(v) => set('funFact', v)}
                placeholder={{ en: t('fun_fact_ph'), es: t('fun_fact_ph') }} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">👤 {t('about_label')}</p>
              <BilingualField label={t('about_me')} value={draft.bio} onChange={(v) => set('bio', v)}
                multiline rows={3} placeholder={{ en: t('tell_team_placeholder'), es: t('tell_team_placeholder') }} />
              <BilingualField label={t('hobbies')} value={draft.hobbies} onChange={(v) => set('hobbies', v)}
                multiline rows={2} placeholder={{ en: t('hobbies_placeholder'), es: t('hobbies_placeholder') }} />
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold">{ensureString(membership.displayName, lang)}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <RoleBadge role={membership.role} />
                  {cat && <span className="text-xs text-slate-400">· {ensureString(cat.name, lang)}</span>}
                  {ensureString(membership.personalityTag, lang) && (
                    <span className="text-[10px] bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full border border-violet-700/50">{t(ensureString(membership.personalityTag, lang))}</span>
                  )}
                  {membership.ghost && (
                    <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">{t('external_member')}</span>
                  )}
                </div>
                {(membership.university || membership.career || membership.semester) && (
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                    {membership.university && <span>🎓 {ensureString(membership.university, lang)}</span>}
                    {membership.career     && <span>💼 {ensureString(membership.career, lang)}</span>}
                    {membership.semester   && <span>📅 {ensureString(membership.semester, lang)} {t('semester_suffix')}</span>}
                  </div>
                )}
              </div>
              {canEditThis && (
                <button onClick={startEdit} className="text-xs text-amber-400 underline shrink-0">{t('edit_profile')}</button>
              )}
            </div>

            {(getL(membership.currentObjective, lang) || getL(membership.currentChallenge, lang)) && (
              <>
                <SectionHeading icon="🎯" label={t('section_mission')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getL(membership.currentObjective, lang) && (
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('current_objective')}</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{getL(membership.currentObjective, lang)}</p>
                    </div>
                  )}
                  {getL(membership.currentChallenge, lang) && (
                    <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('current_challenge')}</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{getL(membership.currentChallenge, lang)}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {(membership.lookingForHelpIn?.length || membership.iCanHelpWith?.length ||
              membership.skillsToLearnThisSemester?.length || membership.skillsICanTeach?.length) && (
              <>
                <SectionHeading icon="🤝" label={t('section_collaboration')} />
                <div className="space-y-2">
                  {membership.lookingForHelpIn?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">{t('looking_label')}</p>
                      <TagList tags={membership.lookingForHelpIn} colorClass="bg-amber-900/40 text-amber-200 border-amber-700/50" lang={lang} />
                    </div>
                  )}
                  {membership.iCanHelpWith?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">{t('offering_label')}</p>
                      <TagList tags={membership.iCanHelpWith} colorClass="bg-emerald-900/40 text-emerald-200 border-emerald-700/50" lang={lang} />
                    </div>
                  )}
                  {membership.skillsToLearnThisSemester?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">📚 {t('skills_to_learn')}</p>
                      <TagList tags={membership.skillsToLearnThisSemester} colorClass="bg-blue-900/40 text-blue-200 border-blue-700/50" lang={lang} />
                    </div>
                  )}
                  {membership.skillsICanTeach?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">🏫 {t('skills_i_can_teach')}</p>
                      <TagList tags={membership.skillsICanTeach} colorClass="bg-purple-900/40 text-purple-200 border-purple-700/50" lang={lang} />
                    </div>
                  )}
                </div>
              </>
            )}

            {(membership.songOnRepeatTitle || getL(membership.funFact, lang)) && (
              <>
                <SectionHeading icon="🎵" label={t('section_culture')} />
                <div className="space-y-2">
                  {membership.songOnRepeatTitle && (
                    <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2">
                      <span className="text-xl shrink-0">🎧</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-500">{t('song_on_repeat')}</p>
                        <p className="text-sm text-slate-200 truncate">{ensureString(membership.songOnRepeatTitle, lang)}</p>
                      </div>
                      {membership.songOnRepeatUrl && isValidSongUrl(membership.songOnRepeatUrl) && (
                        <a href={membership.songOnRepeatUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-xs text-emerald-400 underline hover:text-emerald-300">{t('listen_link')}</a>
                      )}
                    </div>
                  )}
                  {getL(membership.funFact, lang) && (
                    <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{t('fun_fact_label')}</p>
                      <p className="text-sm text-slate-200 italic">"{getL(membership.funFact, lang)}"</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <SectionHeading icon="📅" label={t('section_weekly')} />
            {editingWeekly ? (
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                {[['advanced', t('weekly_advanced'), t('weekly_ph_advanced')], ['failedAt', t('weekly_failed_at'), t('weekly_ph_failed')], ['learned', t('weekly_learned'), t('weekly_ph_learned')]].map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="text-[11px] text-slate-400 block mb-0.5">{label}</label>
                    <AutoGrowTextarea value={weeklyDraft[key]} onChange={(v) => setWeeklyDraft((d) => ({ ...d, [key]: v }))}
                      placeholder={ph} rows={2}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm resize-none min-h-[48px]" />
                  </div>
                ))}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingWeekly(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                  <button onClick={handleSaveWeekly} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded">{t('save')}</button>
                </div>
              </div>
            ) : thisWeek ? (
              <div className="bg-slate-800/60 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500">{t('week_of')(new Date(weekOf + 'T12:00').toLocaleDateString())}</p>
                  {canEditThis && <button onClick={startWeeklyEdit} className="text-[11px] text-amber-400 underline">{t('edit')}</button>}
                </div>
                {[['✅', t('weekly_advanced'), thisWeek.advanced], ['⚠️', t('weekly_failed_at'), thisWeek.failedAt], ['💡', t('weekly_learned'), thisWeek.learned]].map(([icon, label, text]) => {
                  const str = ensureString(text, lang);
                  return str ? (
                    <div key={label}>
                      <p className="text-[10px] text-slate-500 font-semibold">{icon} {label}</p>
                      <p className="text-sm text-slate-200 leading-relaxed mt-0.5">{str}</p>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-500 italic">{t('no_weekly_status')}</p>
                {canEditThis && (
                  <button onClick={startWeeklyEdit} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded">{t('post_weekly_status')}</button>
                )}
              </div>
            )}

            {(getL(membership.bio, lang) || getL(membership.hobbies, lang)) && (
              <>
                <SectionHeading icon="👤" label={t('about_label')} />
                {getL(membership.bio, lang) && <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{getL(membership.bio, lang)}</p>}
                {getL(membership.hobbies, lang) && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t('hobbies')}</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{getL(membership.hobbies, lang)}</p>
                  </div>
                )}
              </>
            )}

            {!getL(membership.bio, lang) && !getL(membership.hobbies, lang) && !getL(membership.currentObjective, lang) && !getL(membership.currentChallenge, lang) && !membership.lookingForHelpIn?.length && !membership.iCanHelpWith?.length && !membership.songOnRepeatTitle && !thisWeek && (
              <p className="text-xs text-slate-600 italic text-center py-4">{t('no_profile_info')}</p>
            )}
          </div>
        )}
      </div>

      {cropTarget === 'photoURL' && (
        <ImageCropModal src={draft.photoURL} label="Reframe Profile Photo" cropWidth={400} cropHeight={400}
          onApply={(url) => { set('photoURL', url); setCropTarget(null); }} onCancel={() => setCropTarget(null)} />
      )}
      {cropTarget === 'coverPhotoURL' && (
        <ImageCropModal src={draft.coverPhotoURL} label="Reframe Cover Photo" cropWidth={960} cropHeight={320}
          onApply={(url) => { set('coverPhotoURL', url); setCropTarget(null); }} onCancel={() => setCropTarget(null)} />
      )}
    </div>
  );
}
