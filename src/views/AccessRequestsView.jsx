// ─── AccessRequestsView ──────────────────────────────────────────────────────
// Solicitudes de acceso al campus (Quantum Robotics only — gated in nav).
// Leaders and above file requests; only ACCESS_APPROVER_EMAIL sees them all and
// approves. Approving opens a ready-to-send Outlook draft to campus security.
// Firestore rules (teamAccessRequests) enforce the same split.

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Check, Mail, Plus, Trash2, X } from 'lucide-react';
import { db } from '../firebase.js';
import { t } from '../strings.js';
import { tsToDate } from '../utils.js';
import { ACCESS_APPROVER_EMAIL, ACCESS_SECURITY_EMAIL, accessRequestEmailUrl } from '../accessRequestEmail.js';

const EMPTY = {
  visitors: '', origin: '', reason: '', period: '', schedule: '',
  location: 'Semisótano de aulas 6 (Taller Quantum)',
  responsible: 'Dr. Miguel Ángel Gálvez Zúñiga',
};
const FIELDS = [
  ['visitors', 'access_f_visitors', true],
  ['origin', 'access_f_origin'],
  ['reason', 'access_f_reason', true],
  ['period', 'access_f_period', false, 'access_f_period_ph'],
  ['schedule', 'access_f_schedule', false, 'access_f_schedule_ph'],
  ['location', 'access_f_location'],
  ['responsible', 'access_f_responsible'],
];
const STATUS_CLS = {
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  approved: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  rejected: 'bg-red-400/15 text-red-300 border-red-400/30',
};
const inputCls = 'w-full bg-surface-raised border border-hairline rounded-lg px-3 py-2 text-sm text-content-primary';

export default function AccessRequestsView({ authUser, currentTeam, currentMembership }) {
  const isApprover = authUser?.email === ACCESS_APPROVER_EMAIL;
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentTeam?.id || !authUser) return undefined;
    // Rules only let non-approvers read their own requests, so the query must say so.
    const constraints = [where('teamId', '==', currentTeam.id)];
    if (!isApprover) constraints.push(where('createdBy', '==', authUser.uid));
    return onSnapshot(query(collection(db, 'teamAccessRequests'), ...constraints), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (tsToDate(b.createdAt)?.getTime() || 0) - (tsToDate(a.createdAt)?.getTime() || 0));
      setRequests(rows);
    }, (e) => setError(e.message));
  }, [currentTeam?.id, authUser, isApprover]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await addDoc(collection(db, 'teamAccessRequests'), {
        ...data,
        teamId: currentTeam.id,
        status: 'pending',
        createdBy: authUser.uid,
        createdByName: currentMembership?.displayName || authUser.displayName || '',
        createdAt: serverTimestamp(),
      });
      setForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = (r, status) => {
    // Open the draft synchronously inside the click so the popup isn't blocked.
    if (status === 'approved') window.open(accessRequestEmailUrl(r), '_blank', 'noopener');
    updateDoc(doc(db, 'teamAccessRequests', r.id), { status, decidedAt: serverTimestamp() })
      .catch((err) => setError(err.message));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">{t('nav_access_requests')}</h1>
          <p className="text-sm text-content-tertiary">
            {isApprover ? t('access_intro_approver').replace('{email}', ACCESS_SECURITY_EMAIL) : t('access_intro')}
          </p>
        </div>
        {!form && (
          <button onClick={() => setForm(EMPTY)}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2 text-sm rounded-lg bg-primary text-white">
            <Plus className="w-4 h-4" /> {t('access_new')}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {form && (
        <form onSubmit={submit} className="rounded-xl border border-hairline bg-surface-raised/60 p-4 space-y-3">
          {FIELDS.map(([key, label, multiline, ph]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-medium text-content-secondary">{t(label)}</span>
              {multiline ? (
                <textarea required rows={2} value={form[key]} className={inputCls}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              ) : (
                <input required value={form[key]} className={inputCls} placeholder={ph ? t(ph) : ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              )}
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-3 py-1.5 text-sm text-content-secondary">{t('cancel')}</button>
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white disabled:opacity-50">{t('access_submit')}</button>
          </div>
        </form>
      )}

      {requests.length === 0 && !form && <p className="text-sm text-content-tertiary">{t('access_empty')}</p>}

      {requests.map((r) => (
        <div key={r.id} className="rounded-xl border border-hairline bg-surface-raised/40 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-content-primary whitespace-pre-line">{r.visitors}</div>
              <div className="text-xs text-content-tertiary">
                {r.origin} · {t('access_by')} {r.createdByName}
                {tsToDate(r.createdAt) && ` · ${tsToDate(r.createdAt).toLocaleDateString('es-MX')}`}
              </div>
            </div>
            <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_CLS[r.status] || ''}`}>
              {t(`access_status_${r.status}`)}
            </span>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {FIELDS.slice(2).map(([key, label]) => (
              <div key={key}>
                <dt className="inline text-content-tertiary">{t(label)}: </dt>
                <dd className="inline text-content-secondary whitespace-pre-line">{r[key]}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {isApprover && r.status === 'pending' && (
              <>
                <button onClick={() => decide(r, 'rejected')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-red-300 hover:bg-red-400/10">
                  <X className="w-4 h-4" /> {t('access_reject')}
                </button>
                <button onClick={() => decide(r, 'approved')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">
                  <Check className="w-4 h-4" /> {t('access_approve')}
                </button>
              </>
            )}
            {isApprover && r.status === 'approved' && (
              <a href={accessRequestEmailUrl(r)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-primary hover:bg-white/5">
                <Mail className="w-4 h-4" /> {t('access_reopen_email')}
              </a>
            )}
            {(isApprover || (r.createdBy === authUser?.uid && r.status === 'pending')) && (
              <button onClick={() => window.confirm(t('access_confirm_delete')) && deleteDoc(doc(db, 'teamAccessRequests', r.id)).catch((err) => setError(err.message))}
                className="p-1.5 text-content-tertiary hover:text-red-400" aria-label={t('delete')}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
