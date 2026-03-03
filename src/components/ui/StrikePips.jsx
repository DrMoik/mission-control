// ─── StrikePips ───────────────────────────────────────────────────────────────
// Three small dots — red for each strike received, dark for unused slots.
// Reaching 3 strikes triggers automatic suspension.

import React from 'react';

/**
 * @param {{ count: number }} props  – number of active strikes (0–3)
 */
export default function StrikePips({ count }) {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < count ? 'bg-red-500' : 'bg-slate-700'}`}
        />
      ))}
    </span>
  );
}
