// ─── JoinRequestModal ─────────────────────────────────────────────────────────
// Shown when a user clicks "Request to Join" on a team card.
// Lets the user pick a category preference and optionally add a motivation note.
// The admin sees this motivation text in the pending requests list.

import React, { useState } from 'react';
import LangContext from '../i18n/LangContext.js';
import { getL, ensureString } from '../utils.js';

/**
 * @param {{
 *   team:       object,    – the team the user is requesting to join
 *   categories: object[],  – categories available in that team
 *   onSubmit:   function(categoryId: string, motivation: string) → void
 *   onCancel:   function
 * }} props
 */
export default function JoinRequestModal({ team, categories, onSubmit, onCancel }) {
  const { t, lang } = React.useContext(LangContext);
  const [categoryId,  setCategoryId]  = useState('');
  const [motivation,  setMotivation]  = useState('');

  const canSubmit = Boolean(categoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-slate-800 px-6 py-5">
          <h2 className="text-white font-bold text-lg">{t('join_title')}</h2>
          <p className="text-emerald-300/80 text-sm mt-0.5">{team.name}</p>
          {getL(team.overview?.tagline, lang) && (
            <p className="text-slate-400 text-xs mt-1 italic">"{getL(team.overview.tagline, lang)}"</p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Category picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t('which_category')} <span className="text-red-400">*</span>
            </label>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`px-3 py-2.5 rounded-lg text-sm text-left border transition-all ${
                      categoryId === c.id
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-semibold'
                        : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {ensureString(c.name, lang)}
                    {getL(c.description, lang) && (
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                        {getL(c.description, lang)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">{t('no_categories_join')}</p>
            )}
          </div>

          {/* Motivation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t('why_join')} <span className="text-slate-500 font-normal">{t('optional_label')}</span>
            </label>
            <textarea
              rows={3}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder={t('join_motivation_placeholder')}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm resize-none focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <p className="text-[11px] text-slate-500">{t('pending_review_note')}</p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => canSubmit && onSubmit(categoryId, motivation)}
              disabled={!canSubmit}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition-colors"
            >
              {t('join_send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
