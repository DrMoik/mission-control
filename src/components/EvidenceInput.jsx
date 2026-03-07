// ─── EvidenceInput ───────────────────────────────────────────────────────────
// Reusable form for text and link evidence. Used by complaints and similar flows.

import React from 'react';
import { t } from '../strings.js';

/**
 * @param {{
 *   value: { text?: string, link?: string },
 *   onChange: (v: { text?: string, link?: string }) => void,
 *   required?: boolean,
 *   textLabel?: string,
 *   textPlaceholder?: string,
 * }} props
 */
export default function EvidenceInput({
  value = {},
  onChange,
  required = false,
  textLabel,
  textPlaceholder,
}) {
  const text = value.text ?? '';
  const link = value.link ?? '';

  const emit = (updates) => {
    onChange({ ...value, ...updates });
  };

  const hasEvidence = (text || '').trim().length > 0 || (link || '').trim().length > 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] text-slate-500 block mb-1">{textLabel ?? t('strike_evidence_text')}</label>
        <textarea
          value={text}
          onChange={(e) => emit({ text: e.target.value })}
          placeholder={textPlaceholder ?? t('strike_evidence_text_ph')}
          rows={3}
          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
        />
      </div>
      <div>
        <label className="text-[11px] text-slate-500 block mb-1">{t('strike_evidence_link')}</label>
        <input
          type="url"
          value={link}
          onChange={(e) => emit({ link: e.target.value })}
          placeholder={t('strike_evidence_link_ph')}
          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs"
        />
      </div>
      {required && !hasEvidence && (
        <p className="text-[11px] text-amber-400">{t('hr_evidence_required')}</p>
      )}
    </div>
  );
}
