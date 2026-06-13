// --- RoleBadge ---
import React from 'react';
import { t } from '../../strings.js';

const ROLE_COLORS = {
  aspirant:       { pill: 'bg-slate-700/60 text-slate-300 border-slate-600/40',    dot: 'bg-slate-400' },
  rookie:         { pill: 'bg-blue-950/70  text-blue-300  border-blue-700/30',     dot: 'bg-blue-400' },
  junior:         { pill: 'bg-cyan-950/70  text-cyan-300  border-cyan-700/30',     dot: 'bg-cyan-400' },
  senior:         { pill: 'bg-violet-950/70 text-violet-300 border-violet-700/30', dot: 'bg-violet-400' },
  leader:         { pill: 'bg-amber-950/70 text-amber-300 border-amber-700/30',    dot: 'bg-amber-400' },
  facultyAdvisor: { pill: 'bg-purple-950/70 text-purple-300 border-purple-700/30', dot: 'bg-purple-400' },
  teamAdmin:      { pill: 'bg-teal-950/70  text-teal-300  border-teal-700/40',     dot: 'bg-teal-400' },
};
const DEFAULT_COLORS = { pill: 'bg-slate-700/60 text-slate-300 border-slate-600/40', dot: 'bg-slate-400' };

export default function RoleBadge({ role }) {
  const colors = ROLE_COLORS[role] || DEFAULT_COLORS;
  const label = t('role_' + role) || role;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${colors.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {label}
    </span>
  );
}
