// ─── Breadcrumbs ──────────────────────────────────────────────────────────────
// Shows navigation path for context and quick back-navigation.

import React from 'react';
import { t } from '../strings.js';
import { ensureString } from '../utils.js';

const VIEW_LABELS = {
  inicio:      'nav_inicio',
  overview:    'nav_overview',
  feed:        'nav_feed',
  categories:  'nav_categories',
  members:     'nav_members',
  merits:      'nav_merits',
  leaderboard: 'nav_leaderboard',
  calendar:    'nav_calendar',
  tools:       'nav_tools',
  academy:     'nav_academy',
  funding:     'nav_funding',
  tasks:       'nav_tasks',
  hr:          'nav_hr',
  myprofile:   'nav_myprofile',
  profile:     'nav_members',
  admin:       'nav_admin',
};

/**
 * @param {{
 *   view: string,
 *   profileMember?: object | null,
 *   onNavigate: (viewId: string) => void,
 *   lang?: string,
 * }} props
 */
export default function Breadcrumbs({ view, profileMember = null, onNavigate, lang = 'es' }) {
  const items = [];

  if (view === 'inicio') {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: true });
  } else if (view === 'overview') {
    items.push({ id: 'overview', label: t('nav_overview'), isLast: true });
  } else if (view === 'myprofile') {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    items.push({ id: 'myprofile', label: t('nav_myprofile'), isLast: true });
  } else if (view === 'profile' && profileMember) {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    items.push({ id: 'members', label: t('nav_members'), isLast: false });
    items.push({ id: 'profile', label: ensureString(profileMember.displayName, lang), isLast: true });
  } else {
    const key = VIEW_LABELS[view];
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    items.push({ id: view, label: key ? t(key) : view, isLast: true });
  }

  if (items.length <= 1) {
    return (
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4">
        <span className="font-medium text-slate-400">{items[0]?.label}</span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4 flex items-center gap-1.5 flex-wrap">
      {items.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-600">/</span>}
          {item.isLast ? (
            <span className="font-medium text-slate-400">{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="text-slate-500 hover:text-slate-300 hover:underline transition-colors"
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
