// ─── RoleBadge ────────────────────────────────────────────────────────────────
// Renders a small coloured pill showing a member's role.
// Uses the translation key `role_<roleId>` so the label adapts to the active language.

import React from 'react';
import { t } from '../../strings.js';

/** Tailwind colour classes per role. Falls back to slate if unknown. */
const ROLE_COLORS = {
  aspirant:      'bg-slate-700/80 text-slate-300',
  rookie:        'bg-blue-900/50 text-blue-300',
  junior:        'bg-cyan-900/50 text-cyan-300',
  senior:        'bg-violet-900/50 text-violet-300',
  leader:        'bg-amber-900/50 text-amber-300',
  facultyAdvisor:'bg-purple-900/50 text-purple-300',
  teamAdmin:     'bg-primary/20 text-primary',
};

/**
 * @param {{ role: string }} props
 */
export default function RoleBadge({ role }) {
  const colorClass = ROLE_COLORS[role] || 'bg-slate-700/80 text-slate-300';
  const label = t('role_' + role) || role;

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md ${colorClass}`}>
      {label}
    </span>
  );
}
