// ─── TrashBin ("Papelera") ───────────────────────────────────────────────────
// Collapsible inline recycle bin, styled like the boards "archived" toggle.
// Lists soft-deleted items with a restore button, a purge-countdown, and a
// permanent-delete button. Renders nothing when the trash is empty.

import React, { useState } from 'react';
import { Trash2, RotateCcw, ChevronDown } from 'lucide-react';
import { t } from '../../strings.js';
import { confirmDialog } from '../../services/feedback.js';
import { daysUntilPurge } from '../../services/softDelete.js';

const purgeLabel = (item) => {
  const days = daysUntilPurge(item);
  if (days == null) return '';
  return days <= 0 ? t('trash_purge_today') : t('trash_purge_in_days').replace('{days}', days);
};

/**
 * @param {{
 *   items: object[],
 *   onRestore: (id: string) => void,
 *   onPurge: (id: string) => void,
 *   renderLabel: (item: object) => React.ReactNode,
 *   className?: string,
 * }} props
 */
export default function TrashBin({ items = [], onRestore, onPurge, renderLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div className={`rounded-xl border border-slate-700/40 bg-surface-raised ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-content-tertiary hover:text-content-secondary transition-colors"
      >
        <span className="flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" />
          {t('trash_bin')} ({items.length})
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-150${open ? ' rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-slate-700/40 p-3">
          <p className="mb-1 text-[11px] italic text-content-tertiary">{t('trash_hint')}</p>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/40 bg-surface-overlay px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-content-secondary">{renderLabel(item)}</div>
                <div className="text-[10px] text-content-tertiary">
                  {purgeLabel(item)}
                  {item.deletedBy ? ` · ${t('trash_deleted_by').replace('{name}', item.deletedBy)}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRestore(item.id)}
                className="flex items-center gap-1 rounded border border-teal-600/50 px-2 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-900/30 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                {t('trash_restore')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await confirmDialog({ message: t('trash_purge_confirm'), confirmLabel: t('trash_delete_forever'), danger: true })) {
                    onPurge(item.id);
                  }
                }}
                className="rounded px-2 py-1 text-[11px] font-semibold text-error hover:text-red-400 transition-colors"
              >
                {t('trash_delete_forever')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
