// ─── HRView ───────────────────────────────────────────────────────────────────
// Human Resources: Suggestions (may be anonymous) and Complaints (non-anonymous,
// author visible only to team faculty). Complaints require evidence.

import React, { useState, useMemo } from 'react';
import { t } from '../strings.js';
import { ensureString, tsToDate } from '../utils.js';
import EvidenceInput from '../components/EvidenceInput.jsx';
import { Button, Textarea } from '../components/ui/index.js';

/**
 * @param {{
 *   suggestions: object[],
 *   complaints: object[],
 *   categories: object[],
 *   memberships: object[],
 *   canViewHr: boolean,
 *   isFaculty: boolean,
 *   authUserId: string | null,
 *   onSubmitSuggestion: (content: string, isAnonymous: boolean) => Promise<void>,
 *   onSubmitComplaint: (data) => Promise<void>,
 *   onAcceptSuggestion: (suggestionId: string, points: number) => Promise<void>,
 *   onDismissSuggestion: (suggestionId: string) => Promise<void>,
 *   onReconsiderSuggestion: (suggestionId: string) => Promise<void>,
 *   suggestionMeritPoints: number[],
 * }} props
 */
export default function HRView({
  suggestions,
  complaints,
  categories,
  memberships,
  canViewHr,
  isFaculty,
  authUserId,
  onSubmitSuggestion,
  onSubmitComplaint,
  onAcceptSuggestion,
  onDismissSuggestion,
  onReconsiderSuggestion,
  suggestionMeritPoints = [50, 100, 150, 200],
}) {
  const memberNameByUserId = useMemo(
    () => new Map(memberships.map((m) => [m.userId, ensureString(m.displayName)])),
    [memberships],
  );

  const getLiveAuthorName = (entry) => memberNameByUserId.get(entry?.authorId) || ensureString(entry?.authorName);

  const [tab, setTab] = useState('suggestions');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionAnonymous, setSuggestionAnonymous] = useState(false);
  const [suggestionSaving, setSuggestionSaving] = useState(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState('pending');
  const [viewModalSuggestion, setViewModalSuggestion] = useState(null);
  const [acceptSaving, setAcceptSaving] = useState(false);
  const [showAcceptPoints, setShowAcceptPoints] = useState(false);

  const [complaintType, setComplaintType] = useState('team');
  const [complaintTargetCat, setComplaintTargetCat] = useState('');
  const [complaintTargetMember, setComplaintTargetMember] = useState('');
  const [complaintContent, setComplaintContent] = useState('');
  const [complaintEvidence, setComplaintEvidence] = useState({});
  const [complaintSaving, setComplaintSaving] = useState(false);

  const activeMembers = memberships.filter((m) => m.status === 'active');

  const mySuggestionsCount = useMemo(() =>
    authUserId ? suggestions.filter((s) => s.authorId === authUserId).length : 0,
  [suggestions, authUserId]);

  const myImplementedCount = useMemo(() =>
    authUserId ? suggestions.filter((s) => s.authorId === authUserId && s.status === 'accepted').length : 0,
  [suggestions, authUserId]);

  const filteredSuggestions = useMemo(() => {
    if (suggestionStatusFilter === 'all') return suggestions;
    return suggestions.filter((s) => (s.status || 'pending') === suggestionStatusFilter);
  }, [suggestions, suggestionStatusFilter]);

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
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-gradient tracking-tight">{t('hr_page_title')}</h2>
      </div>
      <div className="flex gap-2 border-b border-slate-700/40 pb-2 animate-slide-up animate-delay-1">
        {[['suggestions', t('hr_suggestions')], ['complaints', t('hr_complaints')]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${tab === id ? 'bg-primary/20 border-primary/40 text-primary shadow-glow-sm' : 'bg-surface-overlay border-slate-700/40 text-content-secondary hover:bg-slate-700/50 hover:text-content-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'suggestions' && (
        <div className="space-y-4">
          {authUserId && (
            <div className="flex gap-4 p-3 rounded-xl border border-slate-700/40 bg-surface-raised">
              <span className="text-xs text-content-tertiary">
                {t('hr_my_suggestions_posted')}: <strong className="text-content-primary">{mySuggestionsCount}</strong>
              </span>
              <span className="text-xs text-content-tertiary">
                {t('hr_my_suggestions_implemented')}: <strong className="text-primary">{myImplementedCount}</strong>
              </span>
            </div>
          )}

          <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-content-primary mb-2">{t('hr_suggestions_submit')}</h3>
            <form onSubmit={handleSubmitSuggestion} className="space-y-3">
              <Textarea value={suggestionContent} onChange={(e) => setSuggestionContent(e.target.value)} placeholder={t('hr_suggestion_placeholder')} rows={4} required />
              <label className="flex items-center gap-2 text-xs text-content-tertiary cursor-pointer">
                <input type="checkbox" checked={suggestionAnonymous} onChange={(e) => setSuggestionAnonymous(e.target.checked)} />
                {t('hr_suggestion_anonymous')}
              </label>
              <Button type="submit" variant="primary" size="sm" disabled={suggestionSaving}>
                {suggestionSaving ? t('saving') : t('hr_suggestion_submit')}
              </Button>
            </form>
          </div>

          {canViewHr && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['pending', `${t('hr_suggestions_pending')} (${suggestions.filter((s) => (s.status || 'pending') === 'pending').length})`],
                  ['accepted', `${t('hr_suggestions_accepted')} (${suggestions.filter((s) => s.status === 'accepted').length})`],
                  ['dismissed', `${t('hr_suggestions_dismissed')} (${suggestions.filter((s) => s.status === 'dismissed').length})`],
                  ['all', `${t('hr_suggestions_all')} (${suggestions.length})`],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setSuggestionStatusFilter(id)}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 ${suggestionStatusFilter === id ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-surface-overlay border-slate-700/40 text-content-tertiary hover:bg-slate-700/50 hover:text-content-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto">
                {filteredSuggestions.map((s) => {
                  const preview = (ensureString(s.content) || '').slice(0, 80);
                  const status = s.status || 'pending';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setViewModalSuggestion(s);
                        setShowAcceptPoints(false);
                      }}
                      className="text-left p-4 rounded-xl border border-slate-700/40 bg-surface-raised hover:border-primary/25 hover:shadow-glow-sm transition-all duration-200"
                    >
                      <p className="text-content-primary text-xs line-clamp-3">{preview}{preview.length >= 80 ? '…' : ''}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-content-tertiary">
                            {s.isAnonymous ? t('hr_anonymous') : getLiveAuthorName(s)}
                          </span>
                        <span className="text-[10px] text-content-tertiary">{formatDate(s.createdAt)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          status === 'pending' ? 'bg-amber-900/40 text-amber-300 border border-amber-700/40' :
                          status === 'accepted' ? 'bg-primary/15 text-primary border border-primary/30' :
                          'bg-surface-overlay text-content-tertiary border border-slate-700/40'
                        }`}>
                          {status === 'pending' ? t('hr_suggestions_pending') : status === 'accepted' ? t('hr_suggestions_accepted') : t('hr_suggestions_dismissed')}
                        </span>
                        {s.status === 'accepted' && s.meritPoints && (
                          <span className="text-[10px] text-primary">+{s.meritPoints} pts</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {canViewHr && suggestions.length === 0 && (
            <p className="text-content-tertiary text-xs italic">{t('hr_no_suggestions')}</p>
          )}
        </div>
      )}

      {viewModalSuggestion && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !acceptSaving && (setViewModalSuggestion(null), setShowAcceptPoints(false))}
        >
          <div
            className="rounded-xl border border-slate-700/40 bg-surface-raised p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-surface-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-content-primary mb-2">{t('hr_suggestions_list')}</h3>
              <p className="text-sm text-content-primary whitespace-pre-wrap mb-4">{ensureString(viewModalSuggestion.content)}</p>
              <p className="text-xs text-content-tertiary mb-4">
                {viewModalSuggestion.isAnonymous ? t('hr_anonymous') : getLiveAuthorName(viewModalSuggestion)}
                {' · '}{formatDate(viewModalSuggestion.createdAt)}
              {viewModalSuggestion.status === 'accepted' && viewModalSuggestion.meritPoints && (
                <span className="ml-2 text-primary">+{viewModalSuggestion.meritPoints} pts</span>
              )}
            </p>

            {showAcceptPoints ? (
              <div>
                <p className="text-xs text-content-tertiary mb-2">{t('hr_suggestions_accept_points')}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestionMeritPoints.map((pts) => (
                    <Button key={pts} variant="primary" size="sm" disabled={acceptSaving}
                      onClick={async () => {
                        setAcceptSaving(true);
                        try {
                          await onAcceptSuggestion?.(viewModalSuggestion.id, pts);
                          setViewModalSuggestion(null);
                          setShowAcceptPoints(false);
                        } catch (err) {
                          console.error(err);
                          alert(err?.message || t('save_failed'));
                        } finally {
                          setAcceptSaving(false);
                        }
                      }}
                    >
                      {pts} pts
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => !acceptSaving && setShowAcceptPoints(false)}>{t('cancel')}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(viewModalSuggestion.status || 'pending') === 'pending' && (
                  <>
                    <Button variant="primary" size="sm" disabled={!!viewModalSuggestion.isAnonymous} title={viewModalSuggestion.isAnonymous ? t('hr_suggestion_anonymous_no_merit') : t('hr_suggestions_consider')} onClick={() => setShowAcceptPoints(true)}>
                      {t('hr_suggestions_consider')}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={acceptSaving}
                      onClick={async () => {
                        setAcceptSaving(true);
                        try {
                          await onDismissSuggestion?.(viewModalSuggestion.id);
                          setViewModalSuggestion(null);
                        } catch (err) {
                          console.error(err);
                          alert(err?.message || t('save_failed'));
                        } finally {
                          setAcceptSaving(false);
                        }
                      }}
                    >
                      {t('hr_suggestions_dismiss')}
                    </Button>
                  </>
                )}
                {viewModalSuggestion.status === 'dismissed' && (
                  <button
                    onClick={async () => {
                      setAcceptSaving(true);
                      try {
                        await onReconsiderSuggestion?.(viewModalSuggestion.id);
                        setViewModalSuggestion(null);
                      } catch (err) {
                        console.error(err);
                        alert(err?.message || t('save_failed'));
                      } finally {
                        setAcceptSaving(false);
                      }
                    }}
                    disabled={acceptSaving}
                    className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 text-xs rounded-lg px-2.5 py-1.5 bg-amber-600/90 text-white hover:bg-amber-500 active:scale-[0.96] disabled:opacity-40"
                  >
                    {t('hr_suggestions_reconsider')}
                  </button>
                )}
                <Button variant="ghost" size="sm" onClick={() => !acceptSaving && (setViewModalSuggestion(null), setShowAcceptPoints(false))}>
                  {t('close')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'complaints' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/40 bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-content-primary mb-2">{t('hr_complaints_submit')}</h3>
            <p className="text-[11px] text-content-tertiary mb-3">{t('hr_complaint_non_anonymous')}</p>
            <form onSubmit={handleSubmitComplaint} className="space-y-3">
              <div>
                <label className="text-[11px] text-content-tertiary block mb-1">{t('hr_complaint_type')}</label>
                <select
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary"
                >
                  <option value="team">{t('hr_complaint_type_team')}</option>
                  <option value="area">{t('hr_complaint_type_area')}</option>
                  <option value="person">{t('hr_complaint_type_person')}</option>
                </select>
              </div>
              {complaintType === 'area' && (
                <div>
                  <label className="text-[11px] text-content-tertiary block mb-1">{t('hr_complaint_target_area')}</label>
                  <select
                    value={complaintTargetCat}
                    onChange={(e) => setComplaintTargetCat(e.target.value)}
                    className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary"
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
                  <label className="text-[11px] text-content-tertiary block mb-1">{t('hr_complaint_target_person')}</label>
                  <select
                    value={complaintTargetMember}
                    onChange={(e) => setComplaintTargetMember(e.target.value)}
                    className="w-full px-2 py-1.5 bg-surface-overlay border border-slate-600/60 rounded-lg text-xs text-content-primary"
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
                <label className="text-[11px] text-content-tertiary block mb-1">{t('hr_complaint_content')}</label>
                <Textarea value={complaintContent} onChange={(e) => setComplaintContent(e.target.value)} placeholder={t('hr_complaint_content_ph')} rows={3} required />
              </div>
              <div>
                <label className="text-[11px] text-content-tertiary block mb-1">{t('hr_complaint_evidence')}</label>
                <EvidenceInput value={complaintEvidence} onChange={setComplaintEvidence} required />
              </div>
              <button type="submit" disabled={complaintSaving}
                className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 text-xs rounded-lg px-2.5 py-1.5 bg-amber-600/90 text-white hover:bg-amber-500 active:scale-[0.96] disabled:opacity-40">
                {complaintSaving ? t('saving') : t('hr_complaint_submit')}
              </button>
            </form>
          </div>

          {canViewHr && complaints.length > 0 && (
            <div className="rounded-xl border border-slate-700/40 bg-surface-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/40 bg-surface-sunken/30 text-xs font-semibold text-content-tertiary uppercase tracking-wider">
                {t('hr_complaints_list')} ({complaints.length})
              </div>
              <div className="divide-y divide-slate-700/40 max-h-96 overflow-y-auto">
                {complaints.map((c) => {
                  const targetLabel =
                    c.type === 'area'
                      ? ensureString(categories.find((cat) => cat.id === c.targetCategoryId)?.name)
                      : c.type === 'person'
                        ? ensureString(memberships.find((m) => m.id === c.targetMembershipId)?.displayName)
                        : null;
                  return (
                    <div key={c.id} className="px-4 py-3 text-xs hover:bg-slate-700/20 transition-colors">
                      <div className="flex flex-wrap gap-2 mb-1">
                        <span className="bg-amber-900/40 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded-md">
                          {t('hr_complaint_type_' + c.type)}
                        </span>
                        {targetLabel && (
                          <span className="text-content-tertiary">→ {targetLabel}</span>
                        )}
                      </div>
                      <p className="text-content-primary whitespace-pre-wrap">{ensureString(c.content)}</p>
                      {(c.evidence?.text || c.evidence?.link) && (
                        <div className="mt-2 text-content-tertiary">
                          {c.evidence.text && <p className="line-clamp-2">{c.evidence.text}</p>}
                          {c.evidence.link && (
                            <a href={c.evidence.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline truncate block">
                              {c.evidence.link}
                            </a>
                          )}
                        </div>
                      )}
                        <p className="text-content-tertiary mt-1">
                          {isFaculty ? `${getLiveAuthorName(c)} — ` : ''}
                          {formatDate(c.createdAt)}
                        </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {canViewHr && complaints.length === 0 && (
            <p className="text-content-tertiary text-xs italic">{t('hr_no_complaints')}</p>
          )}
        </div>
      )}
    </div>
  );
}
