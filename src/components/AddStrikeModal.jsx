// ─── AddStrikeModal ───────────────────────────────────────────────────────────
// Modal to add a strike with evidence: text and/or link.

import React, { useState, useEffect } from 'react';
import { t } from '../strings.js';

/**
 * @param {{
 *   memberName: string,
 *   onConfirm: (evidence: { text?: string, link?: string }) => Promise<void>,
 *   onCancel: () => void,
 * }} props
 */
export default function AddStrikeModal({ memberName, onConfirm, onCancel }) {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);

  const hasEvidence = (text || '').trim().length > 0 || (link || '').trim().length > 0;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasEvidence) return;
    setSaving(true);
    try {
      await onConfirm({
        text: (text || '').trim() || undefined,
        link: (link || '').trim() || undefined,
      });
      onCancel();
    } catch (err) {
      console.error('Add strike failed:', err);
      alert(err?.message || t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200">{t('add_strike_evidence_title')}</h3>
          <p className="text-[11px] text-slate-500 mt-1">{t('add_strike_evidence_hint')}</p>
          {memberName && (
            <p className="text-xs text-slate-400 mt-1">{t('add_strike_for')}: <strong>{memberName}</strong></p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('strike_evidence_text')}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('strike_evidence_text_ph')}
              rows={3}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{t('strike_evidence_link')}</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={t('strike_evidence_link_ph')}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!hasEvidence || saving}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded"
            >
              {saving ? t('saving') : t('add_strike')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
