// ─── HRView ───────────────────────────────────────────────────────────────────
// Human Resources: Suggestions (may be anonymous) and Complaints (non-anonymous,
// author visible only to team faculty). Complaints require evidence.

import React, { useState } from 'react';
import { t } from '../strings.js';
import { ensureString, tsToDate } from '../utils.js';
import EvidenceInput from '../components/EvidenceInput.jsx';

/**
 * @param {{
 *   suggestions: object[],
 *   complaints: object[],
 *   categories: object[],
 *   memberships: object[],
 *   canViewHr: boolean,      // team admin or faculty
 *   isFaculty: boolean,      // facultyAdvisor or platformAdmin — can see complaint author
 *   onSubmitSuggestion: (content: string, isAnonymous: boolean) => Promise<void>,
 *   onSubmitComplaint: (data: { type, targetCategoryId?, targetMembershipId?, content, evidence }) => Promise<void>,
 * }} props
 */
export default function HRView({
  suggestions,
  complaints,
  categories,
  memberships,
  canViewHr,
  isFaculty,
  onSubmitSuggestion,
  onSubmitComplaint,
}) {
  const [tab, setTab] = useState('suggestions');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionAnonymous, setSuggestionAnonymous] = useState(false);
  const [suggestionSaving, setSuggestionSaving] = useState(false);

  const [complaintType, setComplaintType] = useState('team');
  const [complaintTargetCat, setComplaintTargetCat] = useState('');
  const [complaintTargetMember, setComplaintTargetMember] = useState('');
  const [complaintContent, setComplaintContent] = useState('');
  const [complaintEvidence, setComplaintEvidence] = useState({});
  const [complaintSaving, setComplaintSaving] = useState(false);

  const activeMembers = memberships.filter((m) => m.status === 'active');

  const handleSubmitSuggestion = async (e) => {
    e.preventDefault();
    const content = (suggestionContent || '').trim();
    if (!content) return;
    setSuggestionSaving(true);
    try {
      await onSubmitSuggestion(content, suggestionAnonymous);
      setSuggestionContent('');
      setSuggestionAnonymous(false);
    } catch (err) {
      console.error(err);
      alert(err?.message || t('save_failed'));
    } finally {
      setSuggestionSaving(false);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    const content = (complaintContent || '').trim();
    const hasEvidence =
      (complaintEvidence.text || '').trim() ||
      (complaintEvidence.link || '').trim();
    if (!content || !hasEvidence) {
      alert(t('hr_complaint_evidence_required'));
      return;
    }
    if (complaintType === 'area' && !complaintTargetCat) {
      alert(t('hr_complaint_select_area'));
      return;
    }
    if (complaintType === 'person' && !complaintTargetMember) {
      alert(t('hr_complaint_select_person'));
      return;
    }
    setComplaintSaving(true);
    try {
      await onSubmitComplaint({
        type: complaintType,
        targetCategoryId: complaintType === 'area' ? complaintTargetCat : undefined,
        targetMembershipId: complaintType === 'person' ? complaintTargetMember : undefined,
        content,
        evidence: complaintEvidence,
      });
      setComplaintContent('');
      setComplaintEvidence({});
      setComplaintTargetCat('');
      setComplaintTargetMember('');
    } catch (err) {
      console.error(err);
      alert(err?.message || t('save_failed'));
    } finally {
      setComplaintSaving(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : tsToDate(ts);
    return d.toLocaleDateString(undefined, { dateStyle: 'short' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-semibold text-slate-200">{t('hr_page_title')}</h2>
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setTab('suggestions')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            tab === 'suggestions' ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {t('hr_suggestions')}
        </button>
        <button
          onClick={() => setTab('complaints')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            tab === 'complaints' ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {t('hr_complaints')}
        </button>
      </div>

      {tab === 'suggestions' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('hr_suggestions_submit')}</h3>
            <form onSubmit={handleSubmitSuggestion} className="space-y-3">
              <textarea
                value={suggestionContent}
                onChange={(e) => setSuggestionContent(e.target.value)}
                placeholder={t('hr_suggestion_placeholder')}
                rows={4}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                required
              />
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={suggestionAnonymous}
                  onChange={(e) => setSuggestionAnonymous(e.target.checked)}
                />
                {t('hr_suggestion_anonymous')}
              </label>
              <button
                type="submit"
                disabled={suggestionSaving}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-semibold rounded"
              >
                {suggestionSaving ? t('saving') : t('hr_suggestion_submit')}
              </button>
            </form>
          </div>

          {canViewHr && suggestions.length > 0 && (
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
              <div className="px-4 py-3 border-b border-slate-700 text-xs font-semibold text-slate-400">
                {t('hr_suggestions_list')} ({suggestions.length})
              </div>
              <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
                {suggestions.map((s) => (
                  <div key={s.id} className="px-4 py-3 text-xs">
                    <p className="text-slate-200 whitespace-pre-wrap">{ensureString(s.content)}</p>
                    <p className="text-slate-500 mt-1">
                      {s.isAnonymous ? t('hr_anonymous') : `${ensureString(s.authorName)} — `}
                      {formatDate(s.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {canViewHr && suggestions.length === 0 && (
            <p className="text-slate-500 text-xs">{t('hr_no_suggestions')}</p>
          )}
        </div>
      )}

      {tab === 'complaints' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('hr_complaints_submit')}</h3>
            <p className="text-[11px] text-slate-500 mb-3">{t('hr_complaint_non_anonymous')}</p>
            <form onSubmit={handleSubmitComplaint} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">{t('hr_complaint_type')}</label>
                <select
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                >
                  <option value="team">{t('hr_complaint_type_team')}</option>
                  <option value="area">{t('hr_complaint_type_area')}</option>
                  <option value="person">{t('hr_complaint_type_person')}</option>
                </select>
              </div>
              {complaintType === 'area' && (
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">{t('hr_complaint_target_area')}</label>
                  <select
                    value={complaintTargetCat}
                    onChange={(e) => setComplaintTargetCat(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                    required
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{ensureString(c.name)}</option>
                    ))}
                  </select>
                </div>
              )}
              {complaintType === 'person' && (
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">{t('hr_complaint_target_person')}</label>
                  <select
                    value={complaintTargetMember}
                    onChange={(e) => setComplaintTargetMember(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                    required
                  >
                    <option value="">—</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>{ensureString(m.displayName)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">{t('hr_complaint_content')}</label>
                <textarea
                  value={complaintContent}
                  onChange={(e) => setComplaintContent(e.target.value)}
                  placeholder={t('hr_complaint_content_ph')}
                  rows={3}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">{t('hr_complaint_evidence')}</label>
                <EvidenceInput value={complaintEvidence} onChange={setComplaintEvidence} required />
              </div>
              <button
                type="submit"
                disabled={complaintSaving}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-semibold rounded"
              >
                {complaintSaving ? t('saving') : t('hr_complaint_submit')}
              </button>
            </form>
          </div>

          {canViewHr && complaints.length > 0 && (
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
              <div className="px-4 py-3 border-b border-slate-700 text-xs font-semibold text-slate-400">
                {t('hr_complaints_list')} ({complaints.length})
              </div>
              <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                {complaints.map((c) => {
                  const targetLabel =
                    c.type === 'area'
                      ? ensureString(categories.find((cat) => cat.id === c.targetCategoryId)?.name)
                      : c.type === 'person'
                        ? ensureString(memberships.find((m) => m.id === c.targetMembershipId)?.displayName)
                        : null;
                  return (
                    <div key={c.id} className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-2 mb-1">
                        <span className="bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">
                          {t('hr_complaint_type_' + c.type)}
                        </span>
                        {targetLabel && (
                          <span className="text-slate-400">→ {targetLabel}</span>
                        )}
                      </div>
                      <p className="text-slate-200 whitespace-pre-wrap">{ensureString(c.content)}</p>
                      {(c.evidence?.text || c.evidence?.link) && (
                        <div className="mt-2 text-slate-500">
                          {c.evidence.text && <p className="line-clamp-2">{c.evidence.text}</p>}
                          {c.evidence.link && (
                            <a href={c.evidence.link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline truncate block">
                              {c.evidence.link}
                            </a>
                          )}
                        </div>
                      )}
                      <p className="text-slate-500 mt-1">
                        {isFaculty ? `${ensureString(c.authorName)} — ` : ''}
                        {formatDate(c.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {canViewHr && complaints.length === 0 && (
            <p className="text-slate-500 text-xs">{t('hr_no_complaints')}</p>
          )}
        </div>
      )}
    </div>
  );
}
