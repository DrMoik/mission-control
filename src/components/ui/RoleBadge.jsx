// ─── RoleBadge ────────────────────────────────────────────────────────────────
// Renders a small coloured pill showing a member's role.
// Uses the translation key `role_<roleId>` so the label adapts to the active language.

import React from 'react';
import LangContext from '../../i18n/LangContext.js';

/** Tailwind colour classes per role. Falls back to slate if unknown. */
const ROLE_COLORS = {
  aspirant:      'bg-slate-700 text-slate-300',
  rookie:        'bg-blue-900/60 text-blue-300',
  junior:        'bg-cyan-900/60 text-cyan-300',
  senior:        'bg-violet-900/60 text-violet-300',
  leader:        'bg-amber-900/60 text-amber-300',
  facultyAdvisor:'bg-purple-900/60 text-purple-300',
  teamAdmin:     'bg-emerald-900/60 text-emerald-300',
};

/**
 * @param {{ role: string }} props
 */
export default function RoleBadge({ role }) {
  const { t } = React.useContext(LangContext);
  const colorClass = ROLE_COLORS[role] || 'bg-slate-700 text-slate-300';
  // Prefer translated label; fall back to the raw role string
  const label = t('role_' + role) || role;

  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${colorClass}`}>
      {label}
    </span>
  );
}
