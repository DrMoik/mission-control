// ─── ProfilePageView ──────────────────────────────────────────────────────────
// Full-page profile (no modal).  Renders the same content as ProfileModal
// but as the main content area.  Used for "Mi Perfil" and when viewing
// another member's profile from the members list.
//

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t, lang } from '../strings.js';
import { CAREER_OPTIONS, SEMESTER_OPTIONS, PERSONALITY_TAGS_DEFAULT, SYSTEM_MERIT_DESCRIPTIONS } from '../constants.js';
import { RoleBadge, BilingualField, TagInput, CultureListField, CultureSongField } from '../components/ui/index.js';
import ImageCropModal           from '../components/ImageCropModal.jsx';
import { getL, toL, fillL, ensureString, getMondayOfWeekLocal, normalizeWeekOfToMonday, formatBirthdateDisplay, isBlockedImageHost, computeProfileCompletion, tsToDate } from '../utils.js';

function isValidSongUrl(url) {
  if (!url) return true;
  return /spotify\.com|youtube\.com|youtu\.be|soundcloud\.com/.test(url);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

function SectionHeading({ label }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-2">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</h4>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-transparent" />
    </div>
  );
}

function TagList({ tags, colorClass = 'bg-emerald-900/50 text-emerald-200 border-emerald-700/50', lang = 'es' }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {tags.map((tag, i) => {
        const str = ensureString(tag, lang);
        const key = typeof tag === 'string' ? tag : (str || `tag-${i}`);
        return (
          <span key={key} className={`text-xs px-2.5 py-1 rounded-full border ${colorClass} transition-colors`}>{str}</span>
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
  membership, categories, merits = [], meritEvents = [], canEditThis, onSave,
  weeklyStatuses = [], onSaveWeeklyStatus, suggestedTags = [],
  careerOptions: careerOptionsProp, semesterOptions: semesterOptionsProp, personalityTags: personalityTagsProp,
}) {
  const careerOptions = careerOptionsProp ?? CAREER_OPTIONS;
  const semesterOptions = semesterOptionsProp ?? SEMESTER_OPTIONS;
  const personalityTags = personalityTagsProp ?? PERSONALITY_TAGS_DEFAULT;
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState({});
  const [cropTarget, setCropTarget] = useState(null);
  const [detailMerit, setDetailMerit] = useState(null); // merit shown in popup when clicking a logro
  const photoFileRef = useRef(null);
  const coverFileRef = useRef(null);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyDraft,   setWeeklyDraft]   = useState({ advanced: '', failedAt: '', learned: '' });
  const [savingWeekly,  setSavingWeekly]  = useState(false);
  const [reawarding,    setReawarding]   = useState(false);

  if (!membership) return null;

  useEffect(() => {
    if (!detailMerit) return;
    const onKey = (e) => { if (e.key === 'Escape') setDetailMerit(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailMerit]);

  const cat     = categories.find((c) => c.id === membership.categoryId);
  const weekOf  = getMondayOfWeekLocal(); // Monday–Sunday week, local time (weeks start Monday)
  // Match by week: normalize stored weekOf to Monday so any day (e.g. 2026-03-03) matches current week Monday (2026-03-02)
  const thisWeek = weeklyStatuses.find((s) => s.weekOf && normalizeWeekOfToMonday(s.weekOf) === weekOf);
  const totalPoints = meritEvents
    .filter((e) => e.type === 'award')
    .reduce((sum, e) => sum + (Number(e.points) || 0), 0);

  const profileCompletion = computeProfileCompletion(membership);

  const startEdit = () => {
    const normTags = (arr) => (arr || []).map((t) => (typeof t === 'string' ? t : ensureString(t, lang)));
    setDraft({
      displayName:   membership.displayName   || '',
      email:         membership.email         || '',
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
      whatIListenTo:      (() => {
        const raw = membership.whatIListenTo?.length ? membership.whatIListenTo : (membership.songOnRepeatTitle ? [{ title: membership.songOnRepeatTitle, url: membership.songOnRepeatUrl || '' }] : []);
        return raw.map((t) => typeof t === 'string' ? { title: t, url: '' } : { title: t?.title ?? t?.text ?? '', url: t?.url ?? '' });
      })(),
      bookThatMarkedMe:   membership.bookThatMarkedMe   || [],
      ideaThatMotivatesMe: membership.ideaThatMotivatesMe || [],
      quoteThatMovesMe:   membership.quoteThatMovesMe   || [],
      funFact:            toL(membership.funFact),
      personalityTag:     membership.personalityTag     || '',
      birthdate:          membership.birthdate          || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const result = await onSave(membership.id, {
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
      whatIListenTo:             (draft.whatIListenTo || []).filter((t) => (typeof t === 'string' ? t : t?.title)?.trim()).map((t) => typeof t === 'string' ? { title: t.trim(), url: '' } : { title: (t.title || '').trim(), url: (t.url || '').trim() }),
      bookThatMarkedMe:          (draft.bookThatMarkedMe || []).filter(Boolean),
      ideaThatMotivatesMe:       (draft.ideaThatMotivatesMe || []).filter(Boolean),
      quoteThatMovesMe:          (draft.quoteThatMovesMe || []).filter(Boolean),
      });
      setEditing(false);
      if (result?.meritAwarded) alert(t('profile_saved_merit_awarded'));
      else if (result?.profileComplete === false) alert(t('profile_saved_merit_missing'));
    } catch (err) {
      console.error('Profile save failed:', err);
      const msg = (err?.message || '').toLowerCase();
      const isImage = msg.includes('image') || msg.includes('size') || msg.includes('quota') || msg.includes('too large');
      alert(isImage ? `${t('save_failed')} ${t('save_failed_image')}` : `${t('save_failed')} ${err?.message || ''}`);
    }
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
    if (!onSaveWeeklyStatus) {
      alert(t('save_weekly_failed') || 'No se puede guardar el estatus semanal.');
      return;
    }
    setSavingWeekly(true);
    try {
      const result = await onSaveWeeklyStatus({
        membershipId: membership.id,
        weekOf,
        ...weeklyDraft,
      });
      setEditingWeekly(false);
      if (result?.weeklyMeritAwarded) {
        const pts = result.weeklyMeritPoints ?? 25;
        alert(t('weekly_merit_awarded').replace('{pts}', pts));
      }
    } catch (err) {
      console.error('Weekly status save failed:', err);
      alert(t('save_weekly_failed') || `Error: ${err?.message || ''}`);
    } finally {
      setSavingWeekly(false);
    }
  };

  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const handleExportRecord = () => {
    const awards = meritEvents.filter((e) => e.type === 'award');
    const headers = ['Fecha', 'Logro', 'Puntos', 'Evidencia'];
    const rows = awards.map((e) => {
      const d = tsToDate(e.createdAt);
      return [
        d.toLocaleDateString('es-MX'),
        e.meritName || '—',
        e.points ?? '',
        (e.evidence || '').toString().slice(0, 80),
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-${ensureString(membership.displayName, lang).replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-full min-h-[60vh]">
      {/* Cover + avatar — z-10 so they render above the content section */}
      <div className="relative z-10">
        <div className="h-60 bg-gradient-to-br from-emerald-950/80 via-slate-800 to-slate-900 rounded-t-xl relative overflow-hidden shadow-xl">
          {(editing ? draft.coverPhotoURL : membership.coverPhotoURL) ? (
            <>
              <img src={editing ? draft.coverPhotoURL : membership.coverPhotoURL}
                className="w-full h-full object-cover object-center" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-transparent to-slate-800/60" />
          )}
        </div>
        <div className="absolute -bottom-16 left-6 z-20">
          {(editing ? draft.photoURL : membership.photoURL) ? (
            <img src={editing ? draft.photoURL : membership.photoURL}
              className="w-48 h-48 rounded-full border-4 border-slate-800 object-cover object-[center_top] shadow-lg ring-2 ring-emerald-500/30" alt="" />
          ) : (
            <div className="w-48 h-48 rounded-full border-4 border-slate-800 bg-slate-600 flex items-center justify-center text-4xl font-bold text-slate-300 shadow-lg">
              {(ensureString(membership.displayName, lang) || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-0 pt-28 px-4 sm:px-6 lg:px-8 pb-8 bg-slate-800/95 rounded-b-xl -mt-px shadow-lg border border-t-0 border-slate-700/50 w-full">

        {/* Profile completion indicator */}
        {canEditThis && profileCompletion.percentage < 100 && (
          <div className="mb-4 p-3 bg-slate-900/60 rounded-lg border border-slate-600/50">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs text-slate-400">{t('profile_completion')}</span>
              <span className="text-sm font-semibold text-slate-300">{profileCompletion.percentage}% {t('profile_complete_pct')}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${profileCompletion.percentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500/80'}`}
                style={{ width: `${profileCompletion.percentage}%` }}
              />
            </div>
          </div>
        )}

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
              <label className="text-[11px] text-slate-500 block mb-0.5">{t('email')}</label>
              <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)}
                placeholder={t('email_placeholder')}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
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
                <input type="file" accept="image/*" className="hidden" ref={photoFileRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { readAsDataUrl(f).then((url) => { set('photoURL', url); setCropTarget('photoURL'); }); e.target.value = ''; }
                  }} />
                <button type="button" onClick={() => photoFileRef.current?.click()}
                  className="shrink-0 px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-[11px] font-medium rounded">
                  {t('image_select_file')}
                </button>
                <button type="button" disabled={!draft.photoURL} onClick={() => setCropTarget('photoURL')}
                  className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded">
                  {t('reframe_profile')}
                </button>
                {draft.photoURL && isBlockedImageHost(draft.photoURL) && (
                  <p className="w-full text-[10px] text-amber-400 mt-0.5">{t('image_blocked_host')}</p>
                )}
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
                <input type="file" accept="image/*" className="hidden" ref={coverFileRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { readAsDataUrl(f).then((url) => { set('coverPhotoURL', url); setCropTarget('coverPhotoURL'); }); e.target.value = ''; }
                  }} />
                <button type="button" onClick={() => coverFileRef.current?.click()}
                  className="shrink-0 px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-[11px] font-medium rounded">
                  {t('image_select_file')}
                </button>
                <button type="button" disabled={!draft.coverPhotoURL} onClick={() => setCropTarget('coverPhotoURL')}
                  className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded">
                  {t('reframe_cover')}
                </button>
                {draft.coverPhotoURL && isBlockedImageHost(draft.coverPhotoURL) && (
                  <p className="w-full text-[10px] text-amber-400 mt-0.5">{t('image_blocked_host')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">Fecha de nacimiento</label>
                <input type="date" value={draft.birthdate || ''} onChange={(e) => set('birthdate', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
              </div>
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
                  {(careerOptions.includes('') ? careerOptions : ['', ...careerOptions]).map((o) => <option key={o || '_blank'} value={o}>{o || t('select_placeholder')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('semester')}</label>
                <select value={draft.semester} onChange={(e) => set('semester', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
                  {(semesterOptions.includes('') ? semesterOptions : ['', ...semesterOptions]).map((o) => <option key={o || '_blank'} value={o}>{o || t('select_placeholder')}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('section_mission')}</p>
              <BilingualField label={t('current_objective')} value={draft.currentObjective}
                onChange={(v) => set('currentObjective', v)} placeholder={{ en: t('objective_ph'), es: t('objective_ph') }} />
              <BilingualField label={t('current_challenge')} value={draft.currentChallenge}
                onChange={(v) => set('currentChallenge', v)} placeholder={{ en: t('challenge_ph'), es: t('challenge_ph') }} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('section_collaboration')}</p>
              <TagInput label={t('looking_for_help_in')} value={draft.lookingForHelpIn} onChange={(v) => set('lookingForHelpIn', v)} placeholder={t('collab_tags_ph')} suggestions={suggestedTags} />
              <TagInput label={t('i_can_help_with')} value={draft.iCanHelpWith} onChange={(v) => set('iCanHelpWith', v)} placeholder={t('collab_tags_ph')} suggestions={suggestedTags} />
              <TagInput label={t('skills_to_learn')} value={draft.skillsToLearnThisSemester} onChange={(v) => set('skillsToLearnThisSemester', v)} placeholder={t('collab_tags_ph')} suggestions={suggestedTags} />
              <TagInput label={t('skills_i_can_teach')} value={draft.skillsICanTeach} onChange={(v) => set('skillsICanTeach', v)} placeholder={t('collab_tags_ph')} suggestions={suggestedTags} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('about_label')}</p>
              <BilingualField label={t('about_me')} value={draft.bio} onChange={(v) => set('bio', v)}
                multiline rows={3} placeholder={{ en: t('tell_team_placeholder'), es: t('tell_team_placeholder') }} />
              <BilingualField label={t('hobbies')} value={draft.hobbies} onChange={(v) => set('hobbies', v)}
                multiline rows={2} placeholder={{ en: t('hobbies_placeholder'), es: t('hobbies_placeholder') }} />
              <BilingualField label={t('fun_fact_label')} value={draft.funFact} onChange={(v) => set('funFact', v)}
                placeholder={{ en: t('fun_fact_ph'), es: t('fun_fact_ph') }} />
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('section_culture')}</p>
              <CultureSongField label={t('culture_what_i_listen')} value={draft.whatIListenTo || []} onChange={(v) => set('whatIListenTo', v)}
                titlePlaceholder={t('song_title_ph')} urlPlaceholder={t('song_url_ph')} addLabel={t('culture_add')} maxItems={3} />
              <CultureListField label={t('culture_book_that_marked')} value={draft.bookThatMarkedMe || []} onChange={(v) => set('bookThatMarkedMe', v)}
                placeholder="e.g. Sapiens" addLabel={t('culture_add')} maxItems={3} />
              <CultureListField label={t('culture_idea_that_motivates')} value={draft.ideaThatMotivatesMe || []} onChange={(v) => set('ideaThatMotivatesMe', v)}
                placeholder="e.g. Build something people love" addLabel={t('culture_add')} maxItems={3} />
              <CultureListField label={t('culture_quote_that_moves')} value={draft.quoteThatMovesMe || []} onChange={(v) => set('quoteThatMovesMe', v)}
                placeholder="e.g. The best time to plant a tree was 20 years ago" addLabel={t('culture_add')} maxItems={3} />
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('personality_tag_label')}</label>
                <select value={draft.personalityTag} onChange={(e) => set('personalityTag', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs">
                  <option value="">{t('select_placeholder')}</option>
                  {(() => {
                    const tags = typeof personalityTags === 'object' && !Array.isArray(personalityTags)
                      ? Object.entries(personalityTags)
                      : (Array.isArray(personalityTags) ? personalityTags : Object.keys(PERSONALITY_TAGS_DEFAULT)).map((k) =>
                          Array.isArray(k) ? k : [k, (PERSONALITY_TAGS_DEFAULT[k] || ensureString(k, lang))]);
                    return tags.map(([k, label]) => <option key={k} value={k}>{label}</option>);
                  })()}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{ensureString(membership.displayName, lang)}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <RoleBadge role={membership.role} />
                  {cat && <span className="text-xs text-slate-400">· {ensureString(cat.name, lang)}</span>}
                  {totalPoints > 0 && (
                    <span className="text-[10px] bg-amber-900/50 text-amber-200 px-2 py-0.5 rounded-full border border-amber-700/50">
                      {totalPoints} pts
                    </span>
                  )}
                  {ensureString(membership.personalityTag, lang) && (
                    <span className="text-[10px] bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full border border-violet-700/50">
                      {(personalityTags && personalityTags[membership.personalityTag]) || membership.personalityTag}
                    </span>
                  )}
                  {membership.ghost && (
                    <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">{t('external_member')}</span>
                  )}
                </div>
                {(membership.birthdate || membership.university || membership.career || membership.semester || membership.email) && (
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                    {membership.birthdate && (
                      <span>🎂 {formatBirthdateDisplay(membership.birthdate)}</span>
                    )}
                    {membership.university && <span>{ensureString(membership.university, lang)}</span>}
                    {membership.career     && <span>{ensureString(membership.career, lang)}</span>}
                    {membership.semester   && (
                      <span>{
                        membership.semester === 'Faculty' ? t('semester_Faculty') :
                        membership.semester === 'Graduate' ? t('semester_Graduate') :
                        `${ensureString(membership.semester, lang)} ${t('semester_suffix')}`
                      }</span>
                    )}
                    {membership.email      && <a href={`mailto:${membership.email}`} className="text-emerald-400 hover:text-emerald-300">{membership.email}</a>}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {canEditThis && (
                  <button onClick={startEdit} className="text-xs text-amber-400 underline">{t('edit_profile')}</button>
                )}
                <button onClick={handleExportRecord} className="text-xs text-slate-400 hover:text-slate-200 underline">
                  {t('export_my_record')}
                </button>
              </div>
            </div>

            {/* Two-column layout: Acerca de mí | Esta semana, then rest */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
            {/* Row 1: Acerca de mí (left) | Esta semana (right) */}
            <div className="min-w-0">
              <SectionHeading label={t('about_label')} />
              {(getL(membership.bio, lang) || getL(membership.hobbies, lang) || getL(membership.funFact, lang)) ? (
                <>
                  {getL(membership.bio, lang) && <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{getL(membership.bio, lang)}</p>}
                  {getL(membership.hobbies, lang) && (
                    <div className="mt-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1.5">{t('hobbies')}</p>
                      <ul className="list-disc list-inside text-sm text-slate-200 leading-relaxed space-y-0.5">
                        {getL(membership.hobbies, lang)
                          .split(/\n+/)
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {getL(membership.funFact, lang) && (
                    <div className="mt-3 bg-yellow-950/20 border border-yellow-800/40 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{t('fun_fact_label')}</p>
                      <p className="text-sm text-slate-200 italic">&quot;{getL(membership.funFact, lang)}&quot;</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500 italic">{t('no_info')}</p>
              )}
            </div>

            <div className="min-w-0">
              <SectionHeading label={t('section_weekly')} />
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
                    <button onClick={() => setEditingWeekly(false)} disabled={savingWeekly} className="text-xs text-slate-400 underline disabled:opacity-50">{t('cancel')}</button>
                    <button onClick={handleSaveWeekly} disabled={savingWeekly} className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded disabled:opacity-60">
                      {savingWeekly ? '…' : t('save')}
                    </button>
                  </div>
                </div>
              ) : thisWeek ? (
                <div className="bg-slate-800/60 rounded-lg p-4 space-y-3 border border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">{`Semana del ${new Date(weekOf + 'T12:00').toLocaleDateString()}`}</p>
                    {canEditThis && <button onClick={startWeeklyEdit} className="text-[11px] text-amber-400 underline">{t('edit')}</button>}
                  </div>
                  {[['advanced', t('weekly_advanced'), thisWeek.advanced], ['failedAt', t('weekly_failed_at'), thisWeek.failedAt], ['learned', t('weekly_learned'), thisWeek.learned]].map(([key, label, text]) => {
                    const str = ensureString(text, lang);
                    return str ? (
                      <div key={label}>
                        <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
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
            </div>

            {(getL(membership.currentObjective, lang) || getL(membership.currentChallenge, lang)) && (
              <div className="min-w-0">
                <SectionHeading label={t('section_mission')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
            )}

            {(membership.lookingForHelpIn?.length || membership.iCanHelpWith?.length ||
              membership.skillsToLearnThisSemester?.length || membership.skillsICanTeach?.length) && (
              <div className="min-w-0">
                <SectionHeading label={t('section_collaboration')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
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
                      <p className="text-[10px] text-slate-500 font-semibold">{t('skills_to_learn')}</p>
                      <TagList tags={membership.skillsToLearnThisSemester} colorClass="bg-blue-900/40 text-blue-200 border-blue-700/50" lang={lang} />
                    </div>
                  )}
                  {membership.skillsICanTeach?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">{t('skills_i_can_teach')}</p>
                      <TagList tags={membership.skillsICanTeach} colorClass="bg-purple-900/40 text-purple-200 border-purple-700/50" lang={lang} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {((membership.whatIListenTo?.length) || (membership.bookThatMarkedMe?.length) || (membership.ideaThatMotivatesMe?.length) || (membership.quoteThatMovesMe?.length)) ? (
              <div className="min-w-0 space-y-3">
                <SectionHeading label={t('section_culture')} />
                <div className="space-y-2">
                  {membership.whatIListenTo?.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-slate-700/30">
                      <p className="text-[10px] text-slate-500 mb-1">{t('culture_what_i_listen')}</p>
                      <ul className="text-sm text-slate-200 space-y-0.5">
                        {membership.whatIListenTo.map((s, i) => {
                          const title = typeof s === 'string' ? s : ensureString(s?.title ?? s?.text, lang);
                          const url = typeof s === 'object' && s ? (s.url || '') : '';
                          return (
                            <li key={i}>
                              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:text-emerald-200 underline">{title || t('song_on_repeat')}</a> : (title || '—')}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {membership.bookThatMarkedMe?.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-slate-700/30">
                      <p className="text-[10px] text-slate-500 mb-1">{t('culture_book_that_marked')}</p>
                      <ul className="text-sm text-slate-200 space-y-0.5">{membership.bookThatMarkedMe.map((s, i) => <li key={i}>{ensureString(s, lang)}</li>)}</ul>
                    </div>
                  )}
                  {membership.ideaThatMotivatesMe?.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-slate-700/30">
                      <p className="text-[10px] text-slate-500 mb-1">{t('culture_idea_that_motivates')}</p>
                      <ul className="text-sm text-slate-200 space-y-0.5">{membership.ideaThatMotivatesMe.map((s, i) => <li key={i}>{ensureString(s, lang)}</li>)}</ul>
                    </div>
                  )}
                  {membership.quoteThatMovesMe?.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-slate-700/30">
                      <p className="text-[10px] text-slate-500 mb-1">{t('culture_quote_that_moves')}</p>
                      <ul className="text-sm text-slate-200 space-y-0.5 italic">{membership.quoteThatMovesMe.map((s, i) => <li key={i}>&quot;{ensureString(s, lang)}&quot;</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="min-w-0 xl:col-span-2">
              <SectionHeading label={t('profile_logros_obtained')} />
              {meritEvents.filter((e) => e.type === 'award').length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const awards = meritEvents.filter((e) => e.type === 'award');
                    const groups = {};
                    awards.forEach((evt) => {
                      const key = `${evt.meritId || ''}_${evt.meritName || ''}_${evt.points || 0}`;
                      if (!groups[key]) groups[key] = { evt, count: 0, autoAward: false };
                      groups[key].count++;
                      if (evt.autoAward) groups[key].autoAward = true;
                    });
                    return Object.values(groups)
                      .sort((a, b) => (b.evt.createdAt?.seconds || 0) - (a.evt.createdAt?.seconds || 0))
                      .map(({ evt, count, autoAward }) => {
                        const merit = evt.meritId ? merits?.find((m) => m.id === evt.meritId) : null;
                        const meritName = (evt.meritName || '').trim();
                        const sysDesc = meritName && (SYSTEM_MERIT_DESCRIPTIONS[meritName] || SYSTEM_MERIT_DESCRIPTIONS[evt.meritName]);
                        const displayMerit = merit || (meritName ? {
                          name: meritName,
                          logo: evt.meritLogo || '🏆',
                          points: evt.points || 0,
                          categoryId: null,
                          shortDescription: sysDesc?.shortDescription,
                          longDescription: sysDesc?.longDescription,
                        } : null);
                        return (
                          <button
                            key={`${evt.meritId || ''}-${evt.meritName || ''}-${evt.id}`}
                            type="button"
                            onClick={() => displayMerit && setDetailMerit(displayMerit)}
                            title={t('merit_click_to_view') || 'Clic para ver descripción'}
                            className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 text-left w-full sm:w-auto hover:bg-amber-950/50 hover:border-amber-500/60 transition-colors cursor-pointer group"
                          >
                            <span className="text-xl shrink-0">{evt.meritLogo || '🏆'}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-200 group-hover:text-amber-200 transition-colors">
                                {evt.meritName || t('merit')}{count > 1 && <span className="text-slate-400 ml-1">×{count}</span>}
                              </p>
                              <p className="text-xs text-amber-400/90">
                                +{(evt.points || 0) * count} pts
                                {autoAward && <span className="text-slate-500 ml-1">· {t('merit_awarded_by_system')}</span>}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {t('merit_click_to_view')}
                              </p>
                            </div>
                          </button>
                        );
                      });
                  })()}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">{t('profile_logros_empty')}</p>
              )}
            </div>

            {!getL(membership.bio, lang) && !getL(membership.hobbies, lang) && !getL(membership.funFact, lang) && !getL(membership.currentObjective, lang) && !getL(membership.currentChallenge, lang) && !membership.lookingForHelpIn?.length && !membership.iCanHelpWith?.length && !(membership.whatIListenTo?.length) && !(membership.bookThatMarkedMe?.length) && !(membership.ideaThatMotivatesMe?.length) && !(membership.quoteThatMovesMe?.length) && !thisWeek && (
              <p className="text-xs text-slate-600 italic text-center py-4 col-span-full">{t('no_profile_info')}</p>
            )}
            </div>
          </div>
        )}
      </div>

      {cropTarget === 'photoURL' && (
        <ImageCropModal src={draft.photoURL} label="Reframe Profile Photo" cropWidth={400} cropHeight={400} focusTop
          onApply={(url) => { set('photoURL', url); setCropTarget(null); }} onCancel={() => setCropTarget(null)} />
      )}
      {cropTarget === 'coverPhotoURL' && (
        <ImageCropModal src={draft.coverPhotoURL} label="Reframe Cover Photo" cropWidth={1280} cropHeight={427}
          onApply={(url) => { set('coverPhotoURL', url); setCropTarget(null); }} onCancel={() => setCropTarget(null)} />
      )}

      {/* Merit detail popup (when clicking a logro) — portaled to body for proper overlay */}
      {detailMerit && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
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
                  {detailMerit.categoryId && categories?.find((c) => c.id === detailMerit.categoryId) && (
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
                  {getL(detailMerit.longDescription, lang) || getL(detailMerit.shortDescription, lang) || t('no_long_desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailMerit(null)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                {t('merit_detail_close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
