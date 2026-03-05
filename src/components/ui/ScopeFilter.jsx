// ─── ScopeFilter ──────────────────────────────────────────────────────────────
// Tab strip: "Todos" / "Global" / per-category. Uses ensureString for category names.

import React from 'react';
import { ensureString } from '../../utils.js';

/**
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   categories: Array<{ id: string, name: unknown }>,
 *   userCategoryId: string | null,
 *   canEdit: boolean,
 * }} props
 */
export default function ScopeFilter({ value, onChange, categories = [], userCategoryId, canEdit }) {
  const options = [
    { id: 'all',    label: 'Todos'    },
    { id: 'global', label: 'Global'   },
    ...(categories || [])
      .filter((c) => canEdit || c.id === userCategoryId)
      .map((c) => ({ id: c.id, label: ensureString(c.name) })),
  ];

  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
            value === opt.id
              ? 'bg-emerald-500 text-black'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
