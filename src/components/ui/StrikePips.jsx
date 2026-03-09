// ─── StrikePips ───────────────────────────────────────────────────────────────
// Three small dots — red for each strike received, dark for unused slots.
// Reaching 3 strikes triggers automatic suspension.

import React from 'react';

/**
 * @param {{ count: number }} props  – number of active strikes (0–3)
 */
export default function StrikePips({ count }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${count} strike${count !== 1 ? 's' : ''}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-150 ${i < count ? 'bg-error' : 'bg-slate-600/60'}`}
        />
      ))}
    </span>
  );
}
