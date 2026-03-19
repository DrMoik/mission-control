// ─── ProfileModal ─────────────────────────────────────────────────────────────
// Full-screen overlay showing a member's community profile.
//
// View-mode section order (per spec):
//   1. Identity  — name, role, category, photos
//   2. Mission   — currentObjective + currentChallenge
//   3. Collaboration — lookingForHelpIn, iCanHelpWith, skillsToLearn, skillsICanTeach
//   4. Culture   — what I listen, book, idea, quote (up to 3 each), fun fact, personalityTag
//   5. Weekly Status — this week's advanced / failedAt / learned entry
//   6. About     — bio, hobbies, university, career, semester
//
// All bilingual fields (bio, hobbies) handled by BilingualField.
// Collaboration: SkillPicker (taxonomy) + legacy tags (no estandarizado).

import React, { useState, useMemo, useRef } from 'react';
import { X, Cake } from 'lucide-react';
import { t, lang } from '../strings.js';
import { CAREER_OPTIONS, SEMESTER_OPTIONS } from '../constants.js';
import { RoleBadge, BilingualField, SkillPicker, CultureListField, CultureSongField } from './ui/index.js';
import PickerField from './ui/PickerField.jsx';
import ImageCropModal           from './ImageCropModal.jsx';
import ModalOverlay             from './ModalOverlay.jsx';
import SafeProfileImage         from './ui/SafeProfileImage.jsx';
import { getL, toL, fillL, ensureString, getSundayOfWeekLocal, normalizeWeekOfToSunday, formatBirthdateDisplay, isBlockedImageHost } from '../utils.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PERSONALITY_TAGS = [
  'ptag_creative', 'ptag_analytical', 'ptag_detail', 'ptag_bigpicture',
  'ptag_solver', 'ptag_collaborator', 'ptag_independent', 'ptag_mentor',
  'ptag_learner', 'ptag_builder', 'ptag_researcher',
];

// ── Helper: small section heading ─────────────────────────────────────────────
function SectionHeading({ label }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</h4>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

// ── Helper: tag chip list (read-only) ──────────────────────────────────────────
function TagList({ tags, colorClass = 'bg-emerald-900/50 text-emerald-200 border-emerald-700/50', lang = 'es' }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {tags.map((tag, i) => {
        const str = typeof tag === 'string' ? tag : ensureString(tag, lang);
        return (
          <span key={str || `tag-${i}`}
            className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
            {str}
          </span>
        );
      })}
    </div>
  );
}

// ── Helper: legacy tag chip with "no estandarizado" (read-only) ─────────────────
function LegacyTagList({ tags, colorClass, onRemove, lang = 'es' }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {tags.map((tag, i) => {
        const str = typeof tag === 'string' ? tag : ensureString(tag, lang);
        return (
          <span key={`leg-${i}`} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
            {str} <span className="text-[10px] italic opacity-80">({t('skill_not_standardized')})</span>
            {onRemove && (
              <button type="button" onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-400 leading-none transition-colors">×</button>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileModal({
  membership, categories, canEditThis, onClose, onSave,
  weeklyStatuses = [], onSaveWeeklyStatus,
  careerOptions: careerOptionsProp, semesterOptions: semesterOptionsProp,
  knowledgeAreas = [], skillDictionary = [], onProposeSkill,
}) {
  const careerOptions = careerOptionsProp ?? CAREER_OPTIONS;
  const semesterOptions = semesterOptionsProp ?? SEMESTER_OPTIONS;
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState({});
  const [cropTarget, setCropTarget] = useState(null);
  const photoFileRef = useRef(null);
  const coverFileRef = useRef(null);

  // Weekly status edit state
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyDraft,   setWeeklyDraft]   = useState({ advanced: '', failedAt: '', learned: '' });
  const [savingWeekly,  setSavingWeekly]  = useState(false);
  const currentWeekOf = getSundayOfWeekLocal();
  const [selectedWeekOf, setSelectedWeekOf] = useState(currentWeekOf);

  if (!membership) return null;

  const cat     = categories.find((c) => c.id === membership.categoryId);
  const weekOf  = selectedWeekOf || currentWeekOf;
  const thisWeek = weeklyStatuses.find((s) => s.weekOf && normalizeWeekOfToSunday(s.weekOf) === weekOf);
  const availableWeeks = useMemo(() => {
    const set = new Set([currentWeekOf]);
    weeklyStatuses.forEach((s) => {
      const norm = s.weekOf && normalizeWeekOfToSunday(s.weekOf);
      if (norm) set.add(norm);
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [currentWeekOf, weeklyStatuses]);

  // ── Edit form helpers ──────────────────────────────────────────────────────

  const startEdit = () => {
    setDraft({
      displayName:   membership.displayName   || '',
      email:         membership.email         || '',
      photoURL:      membership.photoURL      || '',
      coverPhotoURL: membership.coverPhotoURL || '',
      // Bilingual
      bio:           toL(membership.bio),
      hobbies:       toL(membership.hobbies),
      // Academic
      career:        membership.career     || '',
      semester:      membership.semester   || '',
      university:    membership.university || '',
      // Mission
      currentObjective: toL(membership.currentObjective),
      currentChallenge: toL(membership.currentChallenge),
      // Collaboration — canonical (taxonomy IDs) + legacy (free-text)
      helpNeedsAreas:            membership.helpNeedsAreas ?? [],
      helpOfferAreas:            membership.helpOfferAreas ?? [],
      learnAreas:                membership.learnAreas ?? [],
      teachAreas:                membership.teachAreas ?? [],
      lookingForHelpIn:          (membership.lookingForHelpIn || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      iCanHelpWith:              (membership.iCanHelpWith || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      skillsToLearnThisSemester: (membership.skillsToLearnThisSemester || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      skillsICanTeach:           (membership.skillsICanTeach || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      // Culture — up to 3 per field; migrate old songOnRepeatTitle/songOnRepeatUrl to whatIListenTo
      whatIListenTo:      (() => {
        const raw = membership.whatIListenTo?.length ? membership.whatIListenTo : (membership.songOnRepeatTitle ? [{ title: membership.songOnRepeatTitle, url: membership.songOnRepeatUrl || '' }] : []);
        return raw.map((t) => typeof t === 'string' ? { title: t, url: '' } : { title: ensureString(t?.title ?? t?.text, lang), url: t?.url ?? '' });
      })(),
      bookThatMarkedMe:   (membership.bookThatMarkedMe   || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      ideaThatMotivatesMe: (membership.ideaThatMotivatesMe || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      quoteThatMovesMe:   (membership.quoteThatMovesMe   || []).map((t) => typeof t === 'string' ? t : ensureString(t, lang)),
      funFact:            toL(membership.funFact),
      personalityTag:     membership.personalityTag     || '',
      birthdate:          membership.birthdate         || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await onSave(membership.id, {
        ...draft,
        bio:              fillL(draft.bio),
        hobbies:          fillL(draft.hobbies),
        currentObjective: fillL(draft.currentObjective),
        currentChallenge: fillL(draft.currentChallenge),
        funFact:          fillL(draft.funFact),
        helpNeedsAreas:            draft.helpNeedsAreas ?? [],
        helpOfferAreas:            draft.helpOfferAreas ?? [],
        learnAreas:                draft.learnAreas ?? [],
        teachAreas:                draft.teachAreas ?? [],
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
      onClose();
    } catch (err) {
      console.error('Profile save failed:', err);
      const msg = (err?.message || '').toLowerCase();
      const isImage = msg.includes('image') || msg.includes('size') || msg.includes('quota') || msg.includes('too large');
      alert(isImage ? `${t('save_failed')} ${t('save_failed_image')}` : `${t('save_failed')} ${err?.message || ''}`);
    }
  };

  // ── Weekly status helpers ──────────────────────────────────────────────────

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
      await onSaveWeeklyStatus({
        membershipId: membership.id,
        weekOf,
        ...weeklyDraft,
      });
      setEditingWeekly(false);
    } catch (err) {
      console.error('Weekly status save failed:', err);
      alert(t('save_weekly_failed') || `Error: ${err?.message || ''}`);
    } finally {
      setSavingWeekly(false);
    }
  };

  // ── Utility: set a single draft key ───────────────────────────────────────
  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ModalOverlay onClickBackdrop={onClose}>
      <div
        className="bg-slate-900 rounded-xl w-full max-w-lg overflow-hidden shadow-surface-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Cover photo + avatar — z-10 so they render above content */}
        <div className="relative z-10 shrink-0">
          <div className="h-48 bg-gradient-to-r from-emerald-900 via-slate-800 to-slate-900 relative overflow-hidden rounded-t-xl">
            {(editing ? draft.coverPhotoURL : membership.coverPhotoURL) && (
              <SafeProfileImage
                src={editing ? draft.coverPhotoURL : membership.coverPhotoURL}
                fallback={<div className="w-full h-full bg-gradient-to-br from-emerald-900/60 to-slate-800" />}
                className="w-full h-full object-cover"
                alt=""
              />
            )}
            <button onClick={onClose}
              className="absolute top-3 right-3 z-30 text-white/80 hover:text-white w-7 h-7 bg-black/50 rounded-full flex items-center justify-center"
              title={t('close') || 'Cerrar'}
              aria-label={t('close') || 'Cerrar'}>
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          {/* Avatar — z-20 so it renders above content section */}
          <div className="absolute -bottom-12 left-5 z-20">
            {(editing ? draft.photoURL : membership.photoURL) ? (
              <SafeProfileImage
                src={editing ? draft.photoURL : membership.photoURL}
                fallback={
                  <div className="w-36 h-36 rounded-full border-4 border-slate-900 bg-slate-600 flex items-center justify-center text-3xl font-bold">
                    {(membership.displayName || '?')[0].toUpperCase()}
                  </div>
                }
                className="w-36 h-36 rounded-full border-4 border-slate-900 object-cover object-[center_top]"
                alt=""
              />
            ) : (
              <div className="w-36 h-36 rounded-full border-4 border-slate-900 bg-slate-600 flex items-center justify-center text-3xl font-bold">
                {(membership.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          </div>
        </div>

        <div className="relative z-0 pt-16 px-5 pb-5">

          {/* ════════════ EDIT FORM ════════════ */}
          {editing ? (
            <div className="space-y-4">
              {/* Save / cancel bar */}
              <div className="flex justify-between items-center pb-1 border-b border-slate-700">
                <span className="text-xs text-slate-400">{t('edit_profile')}</span>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-400 underline">{t('cancel')}</button>
                  <button onClick={handleSave} className="text-xs bg-emerald-500 text-black font-semibold px-4 py-1.5 rounded">{t('save_profile')}</button>
                </div>
              </div>

              {/* ── Identity fields ── */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('display_name')}</label>
                <input value={draft.displayName} onChange={(e) => set('displayName', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('email')}</label>
                <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)}
                  placeholder={t('email_placeholder')}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm" />
              </div>

              {/* Profile photo URL + reframe */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('profile_photo_url')}</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {draft.photoURL ? (
                    <SafeProfileImage
                      src={draft.photoURL}
                      fallback={<div className="w-9 h-9 rounded-full shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">?</div>}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-600"
                      alt=""
                    />
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
                    className="shrink-0 px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-[11px] font-medium rounded transition-colors">
                    {t('image_select_file')}
                  </button>
                  <button type="button" disabled={!draft.photoURL} onClick={() => setCropTarget('photoURL')}
                    className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded transition-colors">
                    {t('reframe_profile')}
                  </button>
                  {draft.photoURL && isBlockedImageHost(draft.photoURL) && (
                    <p className="w-full text-[10px] text-amber-400 mt-0.5">{t('image_blocked_host')}</p>
                  )}
                </div>
              </div>

              {/* Cover photo URL + reframe */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">{t('cover_photo_url')}</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {draft.coverPhotoURL ? (
                    <SafeProfileImage
                      src={draft.coverPhotoURL}
                      fallback={<div className="w-14 h-9 rounded shrink-0 border border-slate-700 bg-slate-700 flex items-center justify-center text-slate-500 text-[10px]">{t('cover_photo')}</div>}
                      className="w-14 h-9 rounded object-cover shrink-0 border border-slate-600"
                      alt=""
                    />
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
                    className="shrink-0 px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-[11px] font-medium rounded transition-colors">
                    {t('image_select_file')}
                  </button>
                  <button type="button" disabled={!draft.coverPhotoURL} onClick={() => setCropTarget('coverPhotoURL')}
                    className="shrink-0 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded transition-colors">
                    {t('reframe_cover')}
                  </button>
                  {draft.coverPhotoURL && isBlockedImageHost(draft.coverPhotoURL) && (
                    <p className="w-full text-[10px] text-amber-400 mt-0.5">{t('image_blocked_host')}</p>
                  )}
                </div>
              </div>

              {/* Birthdate / University / Career / Semester */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Fecha de nacimiento</label>
                  <PickerField type="date" value={draft.birthdate || ''} onChange={(value) => set('birthdate', value)}
                    placeholder="Seleccionar fecha"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">{t('university')}</label>
                  <input value={draft.university} onChange={(e) => set('university', e.target.value)}
                    placeholder="e.g. Tec de Monterrey"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs" />
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

              {/* ── Mission ── */}
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('section_mission')}</p>
                <BilingualField
                  label={t('current_objective')}
                  value={draft.currentObjective}
                  onChange={(v) => set('currentObjective', v)}
                  placeholder={{ en: t('objective_ph'), es: t('objective_ph') }}
                />
                <BilingualField
                  label={t('current_challenge')}
                  value={draft.currentChallenge}
                  onChange={(v) => set('currentChallenge', v)}
                  placeholder={{ en: t('challenge_ph'), es: t('challenge_ph') }}
                />
              </div>

              {/* ── Collaboration ── */}
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('section_collaboration')}</p>
                <p className="text-[10px] text-slate-500">{t('collab_skill_hint')}</p>
                <SkillPicker label={t('looking_for_help_in')} value={draft.helpNeedsAreas ?? []} onChange={(v) => set('helpNeedsAreas', v)} skills={skillDictionary} allowedTypes={['technical','learning','support','collaboration']} onProposeSkill={onProposeSkill} placeholder={t('collab_tags_ph')} />
                {draft.lookingForHelpIn?.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500">{t('skill_not_standardized')}:</span>
                    <LegacyTagList tags={draft.lookingForHelpIn} colorClass="bg-amber-900/20 text-amber-300/80 border-amber-700/30" onRemove={(i) => set('lookingForHelpIn', draft.lookingForHelpIn.filter((_, idx) => idx !== i))} lang={lang} />
                  </div>
                )}
                <SkillPicker label={t('i_can_help_with')} value={draft.helpOfferAreas ?? []} onChange={(v) => set('helpOfferAreas', v)} skills={skillDictionary} allowedTypes={['technical','learning','support','collaboration']} onProposeSkill={onProposeSkill} placeholder={t('collab_tags_ph')} />
                {draft.iCanHelpWith?.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500">{t('skill_not_standardized')}:</span>
                    <LegacyTagList tags={draft.iCanHelpWith} colorClass="bg-emerald-900/20 text-emerald-300/80 border-emerald-700/30" onRemove={(i) => set('iCanHelpWith', draft.iCanHelpWith.filter((_, idx) => idx !== i))} lang={lang} />
                  </div>
                )}
                <SkillPicker label={t('skills_to_learn')} value={draft.learnAreas ?? []} onChange={(v) => set('learnAreas', v)} skills={skillDictionary} allowedTypes={['technical','learning']} onProposeSkill={onProposeSkill} placeholder={t('collab_tags_ph')} />
                {draft.skillsToLearnThisSemester?.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500">{t('skill_not_standardized')}:</span>
                    <LegacyTagList tags={draft.skillsToLearnThisSemester} colorClass="bg-blue-900/20 text-blue-300/80 border-blue-700/30" onRemove={(i) => set('skillsToLearnThisSemester', draft.skillsToLearnThisSemester.filter((_, idx) => idx !== i))} lang={lang} />
                  </div>
                )}
                <SkillPicker label={t('skills_i_can_teach')} value={draft.teachAreas ?? []} onChange={(v) => set('teachAreas', v)} skills={skillDictionary} allowedTypes={['technical','learning','support','collaboration']} onProposeSkill={onProposeSkill} placeholder={t('collab_tags_ph')} />
                {draft.skillsICanTeach?.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500">{t('skill_not_standardized')}:</span>
                    <LegacyTagList tags={draft.skillsICanTeach} colorClass="bg-purple-900/20 text-purple-300/80 border-purple-700/30" onRemove={(i) => set('skillsICanTeach', draft.skillsICanTeach.filter((_, idx) => idx !== i))} lang={lang} />
                  </div>
                )}
              </div>

              {/* ── Culture ── */}
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
                    {PERSONALITY_TAGS.map((k) => (
                      <option key={k} value={k}>{t(k)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── About ── */}
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('about_label')}</p>
                <BilingualField
                  label={t('about_me')}
                  value={draft.bio}
                  onChange={(v) => set('bio', v)}
                  multiline rows={3}
                  placeholder={{ en: t('tell_team_placeholder'), es: t('tell_team_placeholder') }}
                />
                <BilingualField
                  label={t('hobbies')}
                  value={draft.hobbies}
                  onChange={(v) => set('hobbies', v)}
                  multiline rows={2}
                  placeholder={{ en: t('hobbies_placeholder'), es: t('hobbies_placeholder') }}
                />
                <BilingualField
                  label={t('fun_fact_label')}
                  value={draft.funFact}
                  onChange={(v) => set('funFact', v)}
                  placeholder={{ en: t('fun_fact_ph'), es: t('fun_fact_ph') }}
                />
              </div>

            </div>

          ) : (
            /* ════════════ VIEW MODE ════════════ */
            <div className="space-y-0.5">

              {/* ── Section 1: Identity ── */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{membership.displayName}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <RoleBadge role={membership.role} />
                    {cat && <span className="text-xs text-slate-400">· {getL(cat.name, lang)}</span>}
                    {membership.personalityTag && (
                      <span className="text-[10px] bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full border border-violet-700/50">
                        {t(membership.personalityTag)}
                      </span>
                    )}
                    {membership.ghost && (
                      <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">{t('external_member')}</span>
                    )}
                  </div>
                  {(membership.birthdate || membership.university || membership.career || membership.semester || membership.email) && (
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                      {membership.birthdate && (
                        <span className="inline-flex items-center gap-1.5">
                          <Cake className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2} />
                          {formatBirthdateDisplay(membership.birthdate)}
                        </span>
                      )}
                      {membership.university && <span>{membership.university}</span>}
                      {membership.career     && <span>{membership.career}</span>}
                      {membership.semester   && (
                        <span>{
                          membership.semester === 'Faculty' ? t('semester_Faculty') :
                          membership.semester === 'Graduate' ? t('semester_Graduate') :
                          `${membership.semester} ${t('semester_suffix')}`
                        }</span>
                      )}
                      {membership.email     && <a href={`mailto:${membership.email}`} className="text-emerald-400 hover:text-emerald-300">{membership.email}</a>}
                    </div>
                  )}
                </div>
                {canEditThis && (
                  <button onClick={startEdit} className="text-xs text-amber-400 underline shrink-0">{t('edit_profile')}</button>
                )}
              </div>

              {/* ── Section 2: Mission ── */}
              {(getL(membership.currentObjective, lang) || getL(membership.currentChallenge, lang)) && (
                <>
                  <SectionHeading label={t('section_mission')} />
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

              {/* ── Section 3: Collaboration ── */}
              {((membership.helpNeedsAreas?.length || membership.helpOfferAreas?.length || membership.learnAreas?.length || membership.teachAreas?.length) ||
                (membership.lookingForHelpIn?.length || membership.iCanHelpWith?.length ||
                 membership.skillsToLearnThisSemester?.length || membership.skillsICanTeach?.length)) && (
                <>
                  <SectionHeading label={t('section_collaboration')} />
                  <div className="space-y-2">
                    {((membership.helpNeedsAreas?.length) || (membership.lookingForHelpIn?.length)) > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold">{t('looking_for_help_in')}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(membership.helpNeedsAreas || []).map((id) => {
                            const s = skillDictionary.find((x) => x.id === id);
                            const label = id.startsWith('proposed:') ? id.slice(9) : (s?.label || knowledgeAreas.find((x) => x.id === id)?.name || id);
                            return <span key={id} className="text-xs px-2.5 py-1 rounded-full border bg-amber-900/40 text-amber-200 border-amber-700/50">{label}</span>;
                          })}
                          {(membership.lookingForHelpIn || []).map((tag, i) => (
                            <span key={`leg-${i}`} className="text-xs px-2.5 py-1 rounded-full border bg-amber-900/20 text-amber-300/80 border-amber-700/30">
                              {ensureString(tag, lang)} <span className="text-[10px] italic opacity-80">({t('skill_not_standardized')})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {((membership.helpOfferAreas?.length) || (membership.iCanHelpWith?.length)) > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold">{t('i_can_help_with')}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(membership.helpOfferAreas || []).map((id) => {
                            const s = skillDictionary.find((x) => x.id === id);
                            const label = id.startsWith('proposed:') ? id.slice(9) : (s?.label || knowledgeAreas.find((x) => x.id === id)?.name || id);
                            return <span key={id} className="text-xs px-2.5 py-1 rounded-full border bg-emerald-900/40 text-emerald-200 border-emerald-700/50">{label}</span>;
                          })}
                          {(membership.iCanHelpWith || []).map((tag, i) => (
                            <span key={`leg-${i}`} className="text-xs px-2.5 py-1 rounded-full border bg-emerald-900/20 text-emerald-300/80 border-emerald-700/30">
                              {ensureString(tag, lang)} <span className="text-[10px] italic opacity-80">({t('skill_not_standardized')})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {((membership.learnAreas?.length) || (membership.skillsToLearnThisSemester?.length)) > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold">{t('skills_to_learn')}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(membership.learnAreas || []).map((id) => {
                            const s = skillDictionary.find((x) => x.id === id);
                            const label = id.startsWith('proposed:') ? id.slice(9) : (s?.label || knowledgeAreas.find((x) => x.id === id)?.name || id);
                            return <span key={id} className="text-xs px-2.5 py-1 rounded-full border bg-blue-900/40 text-blue-200 border-blue-700/50">{label}</span>;
                          })}
                          {(membership.skillsToLearnThisSemester || []).map((tag, i) => (
                            <span key={`leg-${i}`} className="text-xs px-2.5 py-1 rounded-full border bg-blue-900/20 text-blue-300/80 border-blue-700/30">
                              {ensureString(tag, lang)} <span className="text-[10px] italic opacity-80">({t('skill_not_standardized')})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {((membership.teachAreas?.length) || (membership.skillsICanTeach?.length)) > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold">{t('skills_i_can_teach')}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(membership.teachAreas || []).map((id) => {
                            const s = skillDictionary.find((x) => x.id === id);
                            const label = id.startsWith('proposed:') ? id.slice(9) : (s?.label || knowledgeAreas.find((x) => x.id === id)?.name || id);
                            return <span key={id} className="text-xs px-2.5 py-1 rounded-full border bg-purple-900/40 text-purple-200 border-purple-700/50">{label}</span>;
                          })}
                          {(membership.skillsICanTeach || []).map((tag, i) => (
                            <span key={`leg-${i}`} className="text-xs px-2.5 py-1 rounded-full border bg-purple-900/20 text-purple-300/80 border-purple-700/30">
                              {ensureString(tag, lang)} <span className="text-[10px] italic opacity-80">({t('skill_not_standardized')})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Section 4: Culture ── */}
              {((membership.whatIListenTo?.length) || (membership.bookThatMarkedMe?.length) || (membership.ideaThatMotivatesMe?.length) || (membership.quoteThatMovesMe?.length)) ? (
                <>
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
                </>
              ) : null}

              {/* ── Section 5: Weekly Status ── */}
              <SectionHeading label={t('section_weekly')} />
              {availableWeeks.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableWeeks.indexOf(weekOf);
                      const nextIdx = Math.min(idx + 1, availableWeeks.length - 1);
                      if (nextIdx !== idx) setSelectedWeekOf(availableWeeks[nextIdx]);
                    }}
                    disabled={availableWeeks.indexOf(weekOf) >= availableWeeks.length - 1}
                    className="text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm px-1"
                    aria-label={t('week_prev') || 'Semana anterior'}
                  >
                    ←
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium flex-1 text-center">
                    {weekOf === currentWeekOf ? t('weekly_this_week') : `Semana del ${new Date(weekOf + 'T12:00').toLocaleDateString()}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableWeeks.indexOf(weekOf);
                      const nextIdx = Math.max(idx - 1, 0);
                      if (nextIdx !== idx) setSelectedWeekOf(availableWeeks[nextIdx]);
                    }}
                    disabled={availableWeeks.indexOf(weekOf) <= 0}
                    className="text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm px-1"
                    aria-label={t('week_next') || 'Semana siguiente'}
                  >
                    →
                  </button>
                </div>
              )}
              {editingWeekly ? (
                <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                  {[
                    ['advanced', t('weekly_advanced'), t('weekly_ph_advanced')],
                    ['failedAt', t('weekly_failed_at'), t('weekly_ph_failed')],
                    ['learned',  t('weekly_learned'),  t('weekly_ph_learned')],
                  ].map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="text-[11px] text-slate-400 block mb-0.5">{label}</label>
                      <textarea rows={2} value={weeklyDraft[key]}
                        onChange={(e) => setWeeklyDraft((d) => ({ ...d, [key]: e.target.value }))}
                        placeholder={ph}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm resize-none" />
                    </div>
                  ))}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingWeekly(false)} disabled={savingWeekly} className="text-xs text-slate-400 underline disabled:opacity-50">{t('cancel')}</button>
                    <button onClick={handleSaveWeekly} disabled={savingWeekly}
                      className="text-xs bg-emerald-500 text-black font-semibold px-3 py-1.5 rounded disabled:opacity-60">
                      {savingWeekly ? '…' : t('save')}
                    </button>
                  </div>
                </div>
              ) : thisWeek ? (
                <div className="bg-slate-800/60 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    {availableWeeks.length <= 1 && (
                      <p className="text-[10px] text-slate-500">{weekOf === currentWeekOf ? t('weekly_this_week') : `Semana del ${new Date(weekOf + 'T12:00').toLocaleDateString()}`}</p>
                    )}
                    {availableWeeks.length > 1 && <span />}
                    {canEditThis && (
                      <button onClick={startWeeklyEdit} className="text-[11px] text-amber-400 underline">{t('edit')}</button>
                    )}
                  </div>
                  {[
                    [t('weekly_advanced'), thisWeek.advanced],
                    [t('weekly_failed_at'), thisWeek.failedAt],
                    [t('weekly_learned'),  thisWeek.learned],
                  ].map(([label, text]) => {
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
                  <p className="text-xs text-slate-500 italic">
                    {availableWeeks.length > 1
                      ? `${weekOf === currentWeekOf ? t('weekly_this_week') : `Semana del ${new Date(weekOf + 'T12:00').toLocaleDateString()}`} — ${t('no_weekly_status')}`
                      : t('no_weekly_status')}
                  </p>
                  {canEditThis && (
                    <button onClick={startWeeklyEdit}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded transition-colors">
                      {t('post_weekly_status')}
                    </button>
                  )}
                </div>
              )}

              {/* ── Section 6: About ── */}
              {(getL(membership.bio, lang) || getL(membership.hobbies, lang) || getL(membership.funFact, lang)) && (
                <>
                  <SectionHeading label={t('about_label')} />
                  {getL(membership.bio, lang) && (
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{getL(membership.bio, lang)}</p>
                  )}
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
              )}

              {/* Empty state */}
              {!getL(membership.bio, lang) && !getL(membership.hobbies, lang) && !getL(membership.funFact, lang)
                && !getL(membership.currentObjective, lang) && !getL(membership.currentChallenge, lang)
                && !(membership.helpNeedsAreas?.length || membership.helpOfferAreas?.length || membership.learnAreas?.length || membership.teachAreas?.length)
                && !membership.lookingForHelpIn?.length && !membership.iCanHelpWith?.length
                && !(membership.whatIListenTo?.length) && !(membership.bookThatMarkedMe?.length)
                && !(membership.ideaThatMotivatesMe?.length) && !(membership.quoteThatMovesMe?.length)
                && !thisWeek && (
                <p className="text-xs text-slate-600 italic text-center py-4">{t('no_profile_info')}</p>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Crop modals — outside the scroll container so they always overlay */}
      {cropTarget === 'photoURL' && (
        <ImageCropModal src={draft.photoURL} label="Reframe Profile Photo"
          cropWidth={400} cropHeight={400} focusTop
          onApply={(url) => { set('photoURL', url); setCropTarget(null); }}
          onCancel={() => setCropTarget(null)} />
      )}
      {cropTarget === 'coverPhotoURL' && (
        <ImageCropModal src={draft.coverPhotoURL} label="Reframe Cover Photo"
          cropWidth={1280} cropHeight={427}
          onApply={(url) => { set('coverPhotoURL', url); setCropTarget(null); }}
          onCancel={() => setCropTarget(null)} />
      )}
    </ModalOverlay>
  );
}
